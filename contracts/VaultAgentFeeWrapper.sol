// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title VaultAgentFeeWrapper
 * @notice On-chain router for NFTX V3 operations with VaultAgent fee (0.25%)
 * @dev Phase 1: mint + random redeem + swap routing with fee collection
 *
 * Flow:
 *   User → VaultAgentFeeWrapper → NFTXVaultUpgradeableV3
 *   Fee (0.25%) is collected in ETH before forwarding to NFTX
 *
 * Deployed on: Ethereum Mainnet
 * NFTX V3 Vault Factory: 0xC255335bc5aBd6928063F5788a5E420554858f01
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

    function vaultFees()
        external
        view
        returns (
            uint256 mintFee,
            uint256 redeemFee,
            uint256 swapFee
        );
}

interface IERC721 {
    function setApprovalForAll(address operator, bool approved) external;
    function transferFrom(address from, address to, uint256 tokenId) external;
    function isApprovedForAll(address owner, address operator) external view returns (bool);
}

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract VaultAgentFeeWrapper {
    // ─── State ────────────────────────────────────────────────────────────────

    address public owner;
    address public feeRecipient;

    /// @notice VaultAgent fee in basis points (25 = 0.25%)
    uint256 public feeBps = 25;

    /// @notice Maximum fee cap (1% = 100 bps)
    uint256 public constant MAX_FEE_BPS = 100;

    // ─── Events ───────────────────────────────────────────────────────────────

    event MintRouted(
        address indexed user,
        address indexed vault,
        uint256[] tokenIds,
        uint256 vTokensMinted,
        uint256 feeCollectedWei
    );

    event RedeemRouted(
        address indexed user,
        address indexed vault,
        uint256 numNFTs,
        uint256[] specificIds,
        uint256 feeCollectedWei
    );

    event SwapRouted(
        address indexed user,
        address indexed vault,
        uint256[] depositIds,
        uint256[] receiveIds,
        uint256 feeCollectedWei
    );

    event FeeUpdated(uint256 oldBps, uint256 newBps);
    event FeeRecipientUpdated(address oldRecipient, address newRecipient);
    event FeesWithdrawn(address recipient, uint256 amount);

    // ─── Modifiers ────────────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "VaultAgent: not owner");
        _;
    }

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor(address _feeRecipient) {
        require(_feeRecipient != address(0), "VaultAgent: zero address");
        owner = msg.sender;
        feeRecipient = _feeRecipient;
    }

    // ─── Core: Mint ───────────────────────────────────────────────────────────

    /**
     * @notice Deposit NFTs into NFTX vault via VaultAgent router
     * @dev Collects 0.25% fee, then calls vault.mint()
     *      User must approve this contract on the NFT collection first
     *
     * @param vault        NFTX vault address
     * @param nftContract  NFT collection contract
     * @param tokenIds     TokenIds to deposit
     */
    function mintViaWrapper(
        address vault,
        address nftContract,
        uint256[] calldata tokenIds
    ) external payable returns (uint256 vTokensMinted) {
        require(tokenIds.length > 0, "VaultAgent: no tokenIds");
        require(vault != address(0), "VaultAgent: zero vault");

        // Collect VaultAgent fee from msg.value
        uint256 ourFee = _calculateFee(msg.value);
        uint256 amountForNFTX = msg.value - ourFee;

        // Transfer NFTs from user to this contract
        for (uint256 i = 0; i < tokenIds.length; i++) {
            IERC721(nftContract).transferFrom(msg.sender, address(this), tokenIds[i]);
        }

        // Approve vault to take NFTs
        if (!IERC721(nftContract).isApprovedForAll(address(this), vault)) {
            IERC721(nftContract).setApprovalForAll(vault, true);
        }

        // Execute mint on NFTX
        uint256[] memory amounts = new uint256[](0); // ERC-721 — no amounts
        vTokensMinted = INFTXVault(vault).mint{value: amountForNFTX}(
            tokenIds,
            amounts
        );

        // Send vTokens to user
        IERC20(vault).transfer(msg.sender, vTokensMinted);

        // Collect our fee (stays in contract, withdrawn via withdrawFees)
        emit MintRouted(msg.sender, vault, tokenIds, vTokensMinted, ourFee);
    }

    // ─── Core: Random Redeem ──────────────────────────────────────────────────

    /**
     * @notice Redeem random NFT(s) from vault via VaultAgent router
     * @dev User sends vTokens + ETH for fees. We take our cut, forward rest to NFTX.
     *
     * @param vault     NFTX vault address
     * @param numNFTs   Number of random NFTs to redeem
     * @param wethAmount WETH amount for fees (if using WETH payment)
     */
    function redeemRandomViaWrapper(
        address vault,
        uint256 numNFTs,
        uint256 wethAmount
    ) external payable returns (uint256[] memory redeemedIds) {
        require(numNFTs > 0, "VaultAgent: numNFTs = 0");

        // Transfer vTokens from user (numNFTs * 1e18)
        uint256 vTokenAmount = numNFTs * 1e18;
        IERC20(vault).transferFrom(msg.sender, address(this), vTokenAmount);

        // Calculate our fee
        uint256 ourFee = _calculateFee(msg.value);
        uint256 amountForNFTX = msg.value - ourFee;

        // Execute random redeem on NFTX
        uint256[] memory specificIds = new uint256[](0); // empty = random
        redeemedIds = INFTXVault(vault).redeem{value: amountForNFTX}(
            numNFTs,
            specificIds,
            wethAmount,
            false
        );

        // Send NFTs to user
        // Note: vault sends NFTs directly to msg.sender in V3 — verify in prod

        emit RedeemRouted(msg.sender, vault, numNFTs, specificIds, ourFee);
    }

    // ─── Core: Targeted Redeem ────────────────────────────────────────────────

    /**
     * @notice Redeem specific NFT(s) from vault (with premium fee)
     * @dev Premium can be up to 500% in first seconds — always check get_premium_window first!
     */
    function redeemTargetedViaWrapper(
        address vault,
        uint256[] calldata specificIds,
        uint256 wethAmount
    ) external payable returns (uint256[] memory redeemedIds) {
        require(specificIds.length > 0, "VaultAgent: no targetIds");

        // Transfer vTokens from user
        uint256 vTokenAmount = specificIds.length * 1e18;
        IERC20(vault).transferFrom(msg.sender, address(this), vTokenAmount);

        // Calculate our fee (applied on ETH sent for premium)
        uint256 ourFee = _calculateFee(msg.value);
        uint256 amountForNFTX = msg.value - ourFee;

        // Execute targeted redeem (premium paid from amountForNFTX)
        redeemedIds = INFTXVault(vault).redeem{value: amountForNFTX}(
            specificIds.length,
            specificIds,
            wethAmount,
            false
        );

        emit RedeemRouted(msg.sender, vault, specificIds.length, specificIds, ourFee);
    }

    // ─── Fee Calculation ──────────────────────────────────────────────────────

    /**
     * @notice Calculate VaultAgent fee from ETH amount
     * @param amount ETH amount in wei
     * @return fee Fee amount in wei
     */
    function _calculateFee(uint256 amount) internal view returns (uint256 fee) {
        fee = (amount * feeBps) / 10_000;
    }

    /**
     * @notice Public fee quote — use in simulation
     * @param ethAmountWei Transaction value in wei
     * @return feeWei Our fee in wei
     * @return netWei Amount forwarded to NFTX after fee
     */
    function quoteFee(uint256 ethAmountWei)
        external
        view
        returns (uint256 feeWei, uint256 netWei)
    {
        feeWei = _calculateFee(ethAmountWei);
        netWei = ethAmountWei - feeWei;
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    function setFeeBps(uint256 newFeeBps) external onlyOwner {
        require(newFeeBps <= MAX_FEE_BPS, "VaultAgent: fee too high");
        emit FeeUpdated(feeBps, newFeeBps);
        feeBps = newFeeBps;
    }

    function setFeeRecipient(address newRecipient) external onlyOwner {
        require(newRecipient != address(0), "VaultAgent: zero address");
        emit FeeRecipientUpdated(feeRecipient, newRecipient);
        feeRecipient = newRecipient;
    }

    function withdrawFees() external {
        uint256 balance = address(this).balance;
        require(balance > 0, "VaultAgent: nothing to withdraw");
        (bool ok, ) = feeRecipient.call{value: balance}("");
        require(ok, "VaultAgent: transfer failed");
        emit FeesWithdrawn(feeRecipient, balance);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "VaultAgent: zero address");
        owner = newOwner;
    }

    receive() external payable {}
}
