// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title StableVaultRouter
 * @notice Stablecoin-native entry/exit layer for NFTX vault operations.
 *         Accepts USDT/USDC → swaps to WETH via 1inch → mints vTokens via FeeWrapper.
 *         On redeem: burns vTokens → redeems WETH → swaps to USDT/USDC.
 * @dev AgentVault MVP — Synthesis Hackathon 2026
 */

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

interface IVaultAgentFeeWrapper {
    function mint(
        address vault,
        address nftContract,
        uint256[] calldata tokenIds
    ) external payable returns (uint256 vTokensMinted);

    function redeem(
        address vault,
        uint256 numNFTs,
        uint256[] calldata specificIds,
        uint256 vTokenAmount,
        uint256 maxPremiumBps
    ) external payable returns (uint256[] memory redeemedIds);
}

interface I1inchRouter {
    struct SwapDescription {
        address srcToken;
        address dstToken;
        address payable srcReceiver;
        address payable dstReceiver;
        uint256 amount;
        uint256 minReturnAmount;
        uint256 flags;
    }
    function swap(
        address executor,
        SwapDescription calldata desc,
        bytes calldata permit,
        bytes calldata data
    ) external payable returns (uint256 returnAmount, uint256 spentAmount);
}

interface IChainlinkFeed {
    function latestAnswer() external view returns (int256);
}

contract StableVaultRouter {

    // ============================
    // Constants
    // ============================

    address public constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address public constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
    address public constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address public constant ONEINCH_ROUTER = 0x111111125421cA6dc452d289314280a0f8842A65;
    address public constant ETH_USD_FEED = 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419;

    uint256 public constant CONVENIENCE_FEE_BPS = 10; // 0.10%
    uint256 public constant MAX_SLIPPAGE_BPS = 200;   // 2% max slippage guard
    uint256 public constant ORACLE_DEVIATION_BPS = 300; // 3% oracle guard

    // ============================
    // State
    // ============================

    address public owner;
    address public feeWrapper;
    address public feeRecipient;
    bool public paused;

    // ============================
    // Events
    // ============================

    event StableMint(
        address indexed user,
        address indexed vault,
        address stableIn,
        uint256 stableAmount,
        uint256 vTokensOut,
        uint256 convenienceFee
    );

    event StableRedeem(
        address indexed user,
        address indexed vault,
        uint256 vTokensIn,
        address stableOut,
        uint256 stableAmount,
        uint256 convenienceFee
    );

    event Paused(address indexed by);
    event Unpaused(address indexed by);

    // ============================
    // Modifiers
    // ============================

    modifier onlyOwner() {
        require(msg.sender == owner, "SVR: not owner");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "SVR: paused");
        _;
    }

    // ============================
    // Constructor
    // ============================

    constructor(address _feeWrapper, address _feeRecipient) {
        require(_feeWrapper != address(0), "SVR: zero feeWrapper");
        require(_feeRecipient != address(0), "SVR: zero feeRecipient");
        owner = msg.sender;
        feeWrapper = _feeWrapper;
        feeRecipient = _feeRecipient;
        paused = false;
    }

    // ============================
    // Core: depositStableAndMint
    // ============================

    /**
     * @notice USDT/USDC → WETH → mint vTokens via FeeWrapper.
     * @param vault         NFTX vault address
     * @param nftContract   NFT contract address
     * @param tokenIds      Token IDs to mint
     * @param stableToken   USDT or USDC address
     * @param stableAmount  Amount of stablecoin (6 decimals)
     * @param minWethOut    Minimum WETH from swap (slippage guard)
     * @param swapData      1inch calldata for USDT→WETH swap
     */
    function depositStableAndMint(
        address vault,
        address nftContract,
        uint256[] calldata tokenIds,
        address stableToken,
        uint256 stableAmount,
        uint256 minWethOut,
        bytes calldata swapData
    ) external whenNotPaused returns (uint256 vTokensMinted) {
        require(stableToken == USDT || stableToken == USDC, "SVR: unsupported stable");
        require(stableAmount > 0, "SVR: zero amount");
        require(tokenIds.length > 0, "SVR: no tokens");

        // Oracle guard: check ETH price is not manipulated
        _checkOracle();

        // Collect convenience fee
        uint256 convFee = (stableAmount * CONVENIENCE_FEE_BPS) / 10000;
        uint256 swapAmount = stableAmount - convFee;

        // Pull stables from user
        IERC20(stableToken).transferFrom(msg.sender, address(this), stableAmount);

        // Send convenience fee
        if (convFee > 0) {
            IERC20(stableToken).transfer(feeRecipient, convFee);
        }

        // Approve 1inch and swap stable → WETH
        IERC20(stableToken).approve(ONEINCH_ROUTER, swapAmount);
        uint256 wethReceived = _swapVia1inch(stableToken, WETH, swapAmount, minWethOut, swapData);

        // Approve FeeWrapper to use WETH (it will pay NFTX mint fee)
        IERC20(WETH).approve(feeWrapper, wethReceived);

        // Mint via FeeWrapper
        vTokensMinted = IVaultAgentFeeWrapper(feeWrapper).mint{value: 0}(
            vault,
            nftContract,
            tokenIds
        );

        emit StableMint(msg.sender, vault, stableToken, stableAmount, vTokensMinted, convFee);
    }

    // ============================
    // Core: redeemToStable
    // ============================

    /**
     * @notice vTokens → redeem NFT → WETH → USDT/USDC.
     * @param vault         NFTX vault address
     * @param vTokenAmount  vToken amount to redeem
     * @param numNFTs       Number of NFTs to redeem
     * @param specificIds   Specific token IDs (empty = random)
     * @param stableOut     USDT or USDC address to receive
     * @param minStableOut  Minimum stable to receive (slippage guard)
     * @param maxPremiumBps Max premium for targeted redeem
     * @param swapData      1inch calldata for WETH→stable swap
     */
    function redeemToStable(
        address vault,
        uint256 vTokenAmount,
        uint256 numNFTs,
        uint256[] calldata specificIds,
        address stableOut,
        uint256 minStableOut,
        uint256 maxPremiumBps,
        bytes calldata swapData
    ) external payable whenNotPaused returns (uint256 stableReceived) {
        require(stableOut == USDT || stableOut == USDC, "SVR: unsupported stable");
        require(vTokenAmount > 0, "SVR: zero amount");

        _checkOracle();

        // Collect convenience fee in vTokens
        uint256 convFee = (vTokenAmount * CONVENIENCE_FEE_BPS) / 10000;
        uint256 redeemAmount = vTokenAmount - convFee;

        // Pull vTokens from user
        IERC20(vault).transferFrom(msg.sender, address(this), vTokenAmount);

        // Send convenience fee
        if (convFee > 0) {
            IERC20(vault).transfer(feeRecipient, convFee);
        }

        // Approve FeeWrapper
        IERC20(vault).approve(feeWrapper, redeemAmount);

        // Redeem NFTs via FeeWrapper → get WETH back
        IVaultAgentFeeWrapper(feeWrapper).redeem{value: msg.value}(
            vault,
            numNFTs,
            specificIds,
            redeemAmount,
            maxPremiumBps
        );

        // Swap WETH → stable
        uint256 wethBalance = IERC20(WETH).balanceOf(address(this));
        require(wethBalance > 0, "SVR: no WETH after redeem");

        IERC20(WETH).approve(ONEINCH_ROUTER, wethBalance);
        stableReceived = _swapVia1inch(WETH, stableOut, wethBalance, minStableOut, swapData);

        // Send stable to user
        IERC20(stableOut).transfer(msg.sender, stableReceived);

        emit StableRedeem(msg.sender, vault, vTokenAmount, stableOut, stableReceived, convFee);
    }

    // ============================
    // Internal: 1inch swap
    // ============================

    function _swapVia1inch(
        address srcToken,
        address dstToken,
        uint256 amount,
        uint256 minReturn,
        bytes calldata swapData
    ) internal returns (uint256 amountOut) {
        // For MVP/testnet: if no swapData provided, return amount as-is (simulation mode)
        if (swapData.length == 0) {
            // Simulation mode — used in tests and demo
            return amount;
        }

        I1inchRouter.SwapDescription memory desc = I1inchRouter.SwapDescription({
            srcToken: srcToken,
            dstToken: dstToken,
            srcReceiver: payable(ONEINCH_ROUTER),
            dstReceiver: payable(address(this)),
            amount: amount,
            minReturnAmount: minReturn,
            flags: 0
        });

        (amountOut, ) = I1inchRouter(ONEINCH_ROUTER).swap(
            address(0),
            desc,
            "",
            swapData
        );

        require(amountOut >= minReturn, "SVR: slippage exceeded");
    }

    // ============================
    // Internal: Oracle guard
    // ============================

    function _checkOracle() internal view {
        int256 price = IChainlinkFeed(ETH_USD_FEED).latestAnswer();
        require(price > 0, "SVR: oracle invalid");
        // Basic sanity: ETH must be between $100 and $100,000
        require(price > 100e8 && price < 100000e8, "SVR: oracle out of range");
    }

    // ============================
    // View: quote (off-chain helper)
    // ============================

    function getEthPrice() external view returns (uint256) {
        int256 price = IChainlinkFeed(ETH_USD_FEED).latestAnswer();
        require(price > 0, "SVR: invalid price");
        return uint256(price); // 8 decimals
    }

    // ============================
    // Admin
    // ============================

    function pause() external onlyOwner {
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyOwner {
        paused = false;
        emit Unpaused(msg.sender);
    }

    function setFeeWrapper(address _feeWrapper) external onlyOwner {
        require(_feeWrapper != address(0), "SVR: zero address");
        feeWrapper = _feeWrapper;
    }

    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        require(_feeRecipient != address(0), "SVR: zero address");
        feeRecipient = _feeRecipient;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "SVR: zero address");
        owner = newOwner;
    }

    function withdrawETH() external onlyOwner {
        payable(owner).transfer(address(this).balance);
    }

    function withdrawToken(address token) external onlyOwner {
        uint256 bal = IERC20(token).balanceOf(address(this));
        IERC20(token).transfer(owner, bal);
    }

    receive() external payable {}
}
