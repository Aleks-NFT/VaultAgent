// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/VaultAgent.sol";

contract Deploy is Script {
    function run() external {
        address feeRecipient = vm.envAddress("FEE_RECIPIENT");
        vm.startBroadcast();
        VaultAgent vault = new VaultAgent(feeRecipient);
        console.log("VaultAgent deployed:", address(vault));
        vm.stopBroadcast();
    }
}
