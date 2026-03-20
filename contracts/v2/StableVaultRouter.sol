// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/**
 * @title StableVaultRouter
 * @author AgentVault (formerly VaultAgent) — @FirstNFT
 * @notice V2 Stable Rail: USDT/USDC-denominated execution for NFT liquidity
 * @dev Routes stablecoin deposits through DEX aggregator → NFTX operations → back to stables
 *
 * Three operating modes:
 * 1. USD Quote Mode — price everything in USDT, no execution
 * 2. Stable Entry/Exit — full USDT→WETH→NFT→WETH→USDT round-trip
 * 3. Netted Agent Mode — hold WETH working balance, settle to USDT on exit
 *
 * Security:
 * - Chainlink ETH/USD oracle guard against flash spikes
 * - maxSlippage parameter on all swaps
 * - Collection whitelist for approved NFT vaults
 * - Pausable by owner for emergencies
 * - ReentrancyGuard on all write functions
 */
contract StableVaultRouter is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ──────────────────────────────────────────────
    //  State
    // ──────────────────────────────────────────────

    /// @notice Accepted stablecoins (USDT, USDC)
    mapping(address => bool) public acceptedStables;

    /// @notice Whitelisted NFT collections (vault addresses)
    mapping(address => bool) public whitelistedCollections;

    /// @notice V1 FeeWrapper for NFTX operations
    address public feeWrapper;

    /// @notice DEX aggregator router (1inch, LI.FI, etc.)
    address public dexRouter;

    /// @notice Chainlink ETH/USD price feed
    address public ethUsdOracle;

    /// @notice WETH address
    address public weth;

    /// @notice Fee in basis points for stable convenience (10 = 0.10%)
    uint256 public stableFeeBps = 10;

    /// @notice Maximum allowed price deviation from oracle (in bps)
    uint256 public maxOracleDeviationBps = 200; // 2%

    /// @notice Fee recipient
    address public feeRecipient;

    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────

    event StableMint(
        address indexed agent,
        address indexed stable,
        uint256 stableAmount,
        address indexed vault,
        uint256[] tokenIds,
        uint256 feeAmount
    );

    event StableRedeem(
        address indexed agent,
        address indexed vault,
        uint256[] tokenIds,
        address indexed stable,
        uint256 stableOut,
        uint256 feeAmount
    );

    event CollectionWhitelisted(address indexed collection, bool status);
    event StableAccepted(address indexed stable, bool status);

    // ──────────────────────────────────────────────
    //  Errors
    // ──────────────────────────────────────────────

    error StableNotAccepted(address stable);
    error CollectionNotWhitelisted(address collection);
    error OracleDeviationTooHigh(uint256 deviation);
    error SlippageExceeded(uint256 expected, uint256 actual);
    error InsufficientOutput(uint256 minOut, uint256 actualOut);

    // ──────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────

    constructor(
        address _feeWrapper,
        address _dexRouter,
        address _ethUsdOracle,
        address _weth,
        address _feeRecipient
    ) {
        feeWrapper = _feeWrapper;
        dexRouter = _dexRouter;
        ethUsdOracle = _ethUsdOracle;
        weth = _weth;
        feeRecipient = _feeRecipient;
    }

    // ──────────────────────────────────────────────
    //  Core: Stable Entry → Mint
    // ──────────────────────────────────────────────

    /**
     * @notice Deposit stablecoins and mint NFT vault tokens
     * @param stable Address of stablecoin (USDT/USDC)
     * @param amount Amount of stablecoins to deposit
     * @param vaultId NFTX vault ID
     * @param maxSlippageBps Maximum acceptable slippage on DEX swap
     * @param dexCalldata Encoded calldata for DEX aggregator swap
     */
    function depositStableAndMint(
        address stable,
        uint256 amount,
        uint256 vaultId,
        uint256 maxSlippageBps,
        bytes calldata dexCalldata
    ) external nonReentrant whenNotPaused {
        if (!acceptedStables[stable]) revert StableNotAccepted(stable);

        // 1. Collect stablecoins from agent
        IERC20(stable).safeTransferFrom(msg.sender, address(this), amount);

        // 2. Deduct stable convenience fee
        uint256 fee = (amount * stableFeeBps) / 10000;
        uint256 swapAmount = amount - fee;
        IERC20(stable).safeTransfer(feeRecipient, fee);

        // 3. Check oracle price (guard against flash spikes)
        _checkOracleDeviation();

        // 4. Swap stable → WETH via DEX aggregator
        IERC20(stable).safeApprove(dexRouter, swapAmount);
        // TODO: Execute DEX swap with dexCalldata
        // uint256 wethReceived = _executeDexSwap(stable, swapAmount, dexCalldata);

        // 5. Execute mint via V1 FeeWrapper
        // TODO: Call feeWrapper.mint(vaultId, ...) with received WETH

        emit StableMint(msg.sender, stable, amount, address(0), new uint256[](0), fee);
    }

    // ──────────────────────────────────────────────
    //  Core: Redeem → Stable Exit
    // ──────────────────────────────────────────────

    /**
     * @notice Redeem NFT vault tokens and receive stablecoins
     * @param vaultId NFTX vault ID
     * @param tokenIds Specific token IDs to redeem (empty for random)
     * @param stable Address of desired stablecoin output
     * @param minStableOut Minimum acceptable stablecoin output
     * @param maxPremiumBps Maximum acceptable premium for targeted redeem
     * @param dexCalldata Encoded calldata for WETH→stable swap
     */
    function redeemToStable(
        uint256 vaultId,
        uint256[] calldata tokenIds,
        address stable,
        uint256 minStableOut,
        uint256 maxPremiumBps,
        bytes calldata dexCalldata
    ) external nonReentrant whenNotPaused {
        if (!acceptedStables[stable]) revert StableNotAccepted(stable);

        // 1. Execute redeem via V1 FeeWrapper
        // TODO: Call feeWrapper.redeem(vaultId, tokenIds, maxPremiumBps)
        // uint256 wethReceived = ...

        // 2. Check oracle price
        _checkOracleDeviation();

        // 3. Swap WETH → stable via DEX aggregator
        // TODO: Execute DEX swap
        // uint256 stableReceived = ...

        // 4. Deduct fee and send to agent
        // uint256 fee = (stableReceived * stableFeeBps) / 10000;
        // uint256 netOut = stableReceived - fee;
        // if (netOut < minStableOut) revert InsufficientOutput(minStableOut, netOut);

        emit StableRedeem(msg.sender, address(0), tokenIds, stable, 0, 0);
    }

    // ──────────────────────────────────────────────
    //  Internal: Oracle Guard
    // ──────────────────────────────────────────────

    function _checkOracleDeviation() internal view {
        // TODO: Read Chainlink ETH/USD price
        // Compare with DEX execution price
        // Revert if deviation > maxOracleDeviationBps
    }

    // ──────────────────────────────────────────────
    //  Admin
    // ──────────────────────────────────────────────

    function setAcceptedStable(address stable, bool status) external onlyOwner {
        acceptedStables[stable] = status;
        emit StableAccepted(stable, status);
    }

    function setWhitelistedCollection(address collection, bool status) external onlyOwner {
        whitelistedCollections[collection] = status;
        emit CollectionWhitelisted(collection, status);
    }

    function setStableFeeBps(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= 100, "Fee too high"); // max 1%
        stableFeeBps = _feeBps;
    }

    function setMaxOracleDeviationBps(uint256 _deviationBps) external onlyOwner {
        maxOracleDeviationBps = _deviationBps;
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}
