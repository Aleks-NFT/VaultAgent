// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract VaultAgent is Ownable {
    uint256 public constant FEE_BPS = 65;
    uint256 public constant BPS_DENOM = 10000;

    address public feeRecipient;

    event ExecutionFeeCollected(
        address indexed payer,
        address indexed token,
        uint256 amount,
        uint256 fee,
        string vaultId
    );

    constructor(address _feeRecipient) Ownable(msg.sender) {
        feeRecipient = _feeRecipient;
    }

    function collectFee(
        address token,
        uint256 grossAmount,
        string calldata vaultId
    ) external returns (uint256 fee) {
        fee = (grossAmount * FEE_BPS) / BPS_DENOM;
        require(
            IERC20(token).transferFrom(msg.sender, feeRecipient, fee),
            "Fee transfer failed"
        );
        emit ExecutionFeeCollected(msg.sender, token, grossAmount, fee, vaultId);
    }

    function setFeeRecipient(address _new) external onlyOwner {
        feeRecipient = _new;
    }
}
