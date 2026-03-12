import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
const VaultAgentModule = buildModule("VaultAgentModule", (m) => {
  const feeWrapper = m.contract("VaultAgentFeeWrapper", [
    process.env.FEE_RECIPIENT || "",
    25,
  ]);
  return { feeWrapper };
});
export default VaultAgentModule;
