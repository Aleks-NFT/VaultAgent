// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title VaultAgentFeeWrapper
 * @notice Wrapper contract that routes NFT operations through NFTX vaults
 *         and collects a small fee (0.25% by default) for VaultAgent.
 * @dev Phase 2 — write tools: mint, redeem, swap via NFTX V3
 *      v1.1.0 — added emergency pause (kill-switch)
 */

interface INFTXVault {
    function mint(
        uint256[] calldata tokenIds,
        uint256[] calldata amounts
    ) external payable returns (uint256 vTokensMinted);

    function redeem(
        uint256 numNFTs,
        uint256[] calldata specificIds,
        uint256 wethAmount,
        bool forceFees
    ) external payable returns (uint256[] memory redeemedIds);

    function swap(
        uint256[] calldata tokenIds,
        uint256[] calldata amounts,
        uint256[] calldata specificIds,
        uint256 wethAmount,
        bool forceFees
    ) external payable returns (uint256[] memory swappedIds);
}

interface IERC721 {
    function setApprovalForAll(address operator, bool approved) external;
    function isApprovedForAll(address owner, address operator) external view returns (bool);
    function transferFrom(address from, address to, uint256 tokenId) external;
}

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

contract VaultAgentFeeWrapper {

    // ============================
    // State
    // ============================

    address public owner;
    address public feeRecipient;
    uint256 public feeBps;             // basis points: 25 = 0.25%
    uint256 public constant MAX_FEE_BPS = 100; // max 1%

    bool public paused;                // kill-switch: true = all executions blocked

    // ============================
    // Events
    // ============================

    event FeesCollected(address indexed token, uint256 amount);
    event FeeUpdated(uint256 oldFeeBps, uint256 newFeeBps);
    event FeeRecipientUpdated(address oldRecipient, address newRecipient);
    event OwnershipTransferred(address indexed oldOwner, address indexed newOwner);

    event Paused(address indexed by);
    event Unpaused(address indexed by);

    event MintExecuted(
        address indexed vault,
        address indexed user,
        uint256[] tokenIds,
        uint256 vTokensMinted,
        uint256 feeCollected
    );

    event RedeemExecuted(
        address indexed vault,
        address indexed user,
        uint256 numNFTs,
        uint256[] redeemedIds,
        uint256 feeCollected
    );

    event SwapExecuted(
        address indexed vault,
        address indexed user,
        uint256[] tokenIds,
        uint256[] swappedIds,
        uint256 feeCollected
    );

    // ============================
    // Modifiers
    // ============================

    modifier onlyOwner() {
        require(msg.sender == owner, "VaultAgent: not owner");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "VaultAgent: contract is paused");
        _;
    }

    // ============================
    // Constructor
    // ============================

    constructor(address _feeRecipient, uint256 _feeBps) {
        require(_feeRecipient != address(0), "VaultAgent: zero fee recipient");
        require(_feeBps <= MAX_FEE_BPS, "VaultAgent: fee too high");

        owner = msg.sender;
        feeRecipient = _feeRecipient;
        feeBps = _feeBps;
        paused = false;
    }

    // ============================
    // Core: Mint (NFT → vToken)
    // ============================

    /**
     * @notice Deposit NFTs into NFTX vault, collect VaultAgent fee from vTokens.
     * @dev Blocked when paused. Agent must simulate first, then call with user confirm.
     * @param vault       NFTX vault address
     * @param nftContract NFT contract address
     * @param tokenIds    Token IDs to mint
     */
    function mint(
        address vault,
        address nftContract,
        uint256[] calldata tokenIds
    ) external payable whenNotPaused returns (uint256 vTokensMinted) {
        require(tokenIds.length > 0, "VaultAgent: no tokens");

        // Transfer NFTs from user to this contract
        for (uint256 i = 0; i < tokenIds.length; i++) {
            IERC721(nftContract).transferFrom(msg.sender, address(this), tokenIds[i]);
        }

        // Approve vault to take NFTs
        if (!IERC721(nftContract).isApprovedForAll(address(this), vault)) {
            IERC721(nftContract).setApprovalForAll(vault, true);
        }

        uint256[] memory amounts = new uint256[](0);

        // Mint vTokens via NFTX vault
        vTokensMinted = INFTXVault(vault).mint{value: msg.value}(tokenIds, amounts);

        // Calculate and collect fee from vTokens
        uint256 fee = (vTokensMinted * feeBps) / 10000;
        uint256 userAmount = vTokensMinted - fee;

        if (fee > 0) {
            IERC20(vault).transfer(feeRecipient, fee);
            emit FeesCollected(vault, fee);
        }

        IERC20(vault).transfer(msg.sender, userAmount);

        emit MintExecuted(vault, msg.sender, tokenIds, vTokensMinted, fee);
    }

    // ============================
    // Core: Redeem (vToken → NFT)
    // ============================

    /**
     * @notice Redeem NFTs from NFTX vault (random or targeted).
     * @dev Blocked when paused. Agent must simulate first, then call with user confirm.
     *      maxPremiumBps: slippage guard — reverts if current premium exceeds this limit.
     * @param vault          NFTX vault address
     * @param numNFTs        Number of NFTs to redeem
     * @param specificIds    Specific token IDs (empty = random)
     * @param vTokenAmount   Total vToken amount to spend (including NFTX fees)
     * @param maxPremiumBps  Max acceptable premium in bps (0 = no check, e.g. 5000 = 50%)
     */
    function redeem(
        address vault,
        uint256 numNFTs,
        uint256[] calldata specificIds,
        uint256 vTokenAmount,
        uint256 maxPremiumBps
    ) external payable whenNotPaused returns (uint256[] memory redeemedIds) {
        require(numNFTs > 0, "VaultAgent: zero NFTs");

        // Premium safety check: if maxPremiumBps set, validate msg.value does not exceed it
        // Targeted redeems cost premium ETH. maxPremiumBps guards against overpaying.
        if (maxPremiumBps > 0 && specificIds.length > 0) {
            uint256 maxPremiumEth = (vTokenAmount * maxPremiumBps) / 10000;
            require(msg.value <= maxPremiumEth, "VaultAgent: premium exceeds max");
        }

        // Calculate VaultAgent fee
        uint256 fee = (vTokenAmount * feeBps) / 10000;
        uint256 totalRequired = vTokenAmount + fee;

        // Pull total vTokens from user
        IERC20(vault).transferFrom(msg.sender, address(this), totalRequired);

        // Collect fee
        if (fee > 0) {
            IERC20(vault).transfer(feeRecipient, fee);
            emit FeesCollected(vault, fee);
        }

        // Approve vault
        IERC20(vault).approve(vault, vTokenAmount);

        // Execute redeem
        redeemedIds = INFTXVault(vault).redeem{value: msg.value}(
            numNFTs,
            specificIds,
            0,
            false
        );

        emit RedeemExecuted(vault, msg.sender, numNFTs, redeemedIds, fee);
    }

    // ============================
    // Core: Swap (NFT ↔ NFT)
    // ============================

    /**
     * @notice Swap NFTs within an NFTX vault.
     * @dev Blocked when paused. Agent must simulate first, then call with user confirm.
     * @param vault           NFTX vault address
     * @param nftContract     NFT contract address
     * @param tokenIds        Token IDs to swap in
     * @param specificIds     Specific token IDs to receive (empty = random)
     * @param swapFeeVTokens  vToken amount for swap fees
     */
    function swap(
        address vault,
        address nftContract,
        uint256[] calldata tokenIds,
        uint256[] calldata specificIds,
        uint256 swapFeeVTokens
    ) external payable whenNotPaused returns (uint256[] memory swappedIds) {
        require(tokenIds.length > 0, "VaultAgent: no tokens");

        // Transfer NFTs in
        for (uint256 i = 0; i < tokenIds.length; i++) {
            IERC721(nftContract).transferFrom(msg.sender, address(this), tokenIds[i]);
        }

        if (!IERC721(nftContract).isApprovedForAll(address(this), vault)) {
            IERC721(nftContract).setApprovalForAll(vault, true);
        }

        // Calculate and collect fee
        uint256 fee = (swapFeeVTokens * feeBps) / 10000;
        if (swapFeeVTokens > 0) {
            IERC20(vault).transferFrom(msg.sender, address(this), swapFeeVTokens + fee);
            if (fee > 0) {
                IERC20(vault).transfer(feeRecipient, fee);
                emit FeesCollected(vault, fee);
            }
            IERC20(vault).approve(vault, swapFeeVTokens);
        }

        uint256[] memory amounts = new uint256[](0);

        swappedIds = INFTXVault(vault).swap{value: msg.value}(
            tokenIds,
            amounts,
            specificIds,
            0,
            false
        );

        emit SwapExecuted(vault, msg.sender, tokenIds, swappedIds, fee);
    }

    // ============================
    // Kill-switch (Emergency)
    // ============================

    /**
     * @notice Pause all executions (mint/redeem/swap). Read-only tools unaffected.
     * @dev Use in emergencies: exploit detected, suspicious activity, pre-upgrade freeze.
     */
    function pause() external onlyOwner {
        require(!paused, "VaultAgent: already paused");
        paused = true;
        emit Paused(msg.sender);
    }

    /**
     * @notice Resume all executions.
     */
    function unpause() external onlyOwner {
        require(paused, "VaultAgent: not paused");
        paused = false;
        emit Unpaused(msg.sender);
    }

    // ============================
    // Admin
    // ============================

    function setFeeBps(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= MAX_FEE_BPS, "VaultAgent: fee too high");
        emit FeeUpdated(feeBps, _feeBps);
        feeBps = _feeBps;
    }

    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        require(_feeRecipient != address(0), "VaultAgent: zero address");
        emit FeeRecipientUpdated(feeRecipient, _feeRecipient);
        feeRecipient = _feeRecipient;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "VaultAgent: zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    // Emergency: withdraw stuck ETH
    function withdrawETH() external onlyOwner {
        payable(owner).transfer(address(this).balance);
    }

    // Emergency: withdraw stuck tokens
    function withdrawToken(address token) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        IERC20(token).transfer(owner, balance);
    }

    receive() external payable {}
}
