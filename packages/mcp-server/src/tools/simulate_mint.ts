import { z } from "zod";
import { getAddress, isAddress } from "viem";
import { publicClient } from "../utils/client.js";
import {
  VAULT_ABI,
  ERC721_ABI,
  VAULT_AGENT_FEE_BPS,
  CONTRACTS,
} from "../abi/contracts.js";

export const SimulateMintSchema = z.object({
  vault_address: z.string().describe("Адрес NFTX vault"),
  token_ids: z
    .array(z.number())
    .min(1)
    .describe("TokenId(s) NFT для депозита"),
  owner_address: z
    .string()
    .describe("Адрес владельца NFT (для проверки approval)"),
  eth_price_per_vtoken: z
    .string()
    .optional()
    .describe("Текущая цена vToken в ETH (wei) — для расчета fee в ETH"),
});

export type SimulateMintInput = z.infer<typeof SimulateMintSchema>;

export async function simulateMint(input: SimulateMintInput) {
  if (!isAddress(input.vault_address) || !isAddress(input.owner_address)) {
    return { success: false, error: "Invalid address format" };
  }

  const vaultAddr = getAddress(input.vault_address);
  const ownerAddr = getAddress(input.owner_address);

  // Получаем данные vault параллельно
  const [name, symbol, vaultFees, assetAddress] = await Promise.all([
    publicClient.readContract({ address: vaultAddr, abi: VAULT_ABI, functionName: "name" }),
    publicClient.readContract({ address: vaultAddr, abi: VAULT_ABI, functionName: "symbol" }),
    publicClient.readContract({ address: vaultAddr, abi: VAULT_ABI, functionName: "vaultFees" }),
    publicClient.readContract({ address: vaultAddr, abi: VAULT_ABI, functionName: "assetAddress" }),
  ]);

  const fees = vaultFees as [bigint, bigint, bigint];
  const nftContractAddr = assetAddress as `0x${string}`;

  // Проверяем ownership и approval для каждого токена
  const tokenChecks = await Promise.all(
    input.token_ids.map(async (tokenId) => {
      try {
        const [owner, isApproved] = await Promise.all([
          publicClient.readContract({
            address: nftContractAddr,
            abi: ERC721_ABI,
            functionName: "ownerOf",
            args: [BigInt(tokenId)],
          }),
          publicClient.readContract({
            address: nftContractAddr,
            abi: ERC721_ABI,
            functionName: "isApprovedForAll",
            args: [ownerAddr, vaultAddr],
          }),
        ]);

        const isOwner =
          (owner as string).toLowerCase() === ownerAddr.toLowerCase();

        return {
          token_id: tokenId,
          is_owner: isOwner,
          is_approved: isApproved as boolean,
          needs_approval: !isApproved,
          status: isOwner
            ? isApproved
              ? "✅ Ready to mint"
              : "🔑 Needs setApprovalForAll"
            : "❌ Not owned by provided address",
        };
      } catch {
        return {
          token_id: tokenId,
          error: "Could not verify — token may not exist",
          status: "❓ Unknown",
        };
      }
    })
  );

  // Расчет fees
  const nftCount = input.token_ids.length;
  const mintFeeFraction = fees[0]; // доля от 1e18
  const ethPricePerVToken = input.eth_price_per_vtoken
    ? BigInt(input.eth_price_per_vtoken)
    : BigInt("1000000000000000000"); // 1 ETH fallback

  // mintFee = nftCount * (mintFeeFraction / 1e18) * ethPricePerVToken
  const nftxMintFeeEth =
    (BigInt(nftCount) * mintFeeFraction * ethPricePerVToken) /
    BigInt(10 ** 36);

  // VaultAgent fee: 0.25% от стоимости позиции
  const positionValueWei = BigInt(nftCount) * ethPricePerVToken;
  const vaultAgentFeeWei =
    (positionValueWei * BigInt(VAULT_AGENT_FEE_BPS)) / BigInt(10_000);

  const readyToMint = tokenChecks.every((t) => !("error" in t) && t.is_owner);
  const needsApproval = tokenChecks.some(
    (t) => !("error" in t) && !t.is_approved
  );

  return {
    success: true,
    simulation: {
      action: "MINT",
      vault: { address: vaultAddr, name, symbol },
      nft_contract: nftContractAddr,
      token_ids: input.token_ids,
      vtokens_to_receive: nftCount.toString() + " " + symbol,
    },
    fee_breakdown: {
      nftx_mint_fee_eth: (Number(nftxMintFeeEth) / 1e18).toFixed(6),
      vault_agent_fee_eth: (Number(vaultAgentFeeWei) / 1e18).toFixed(6),
      vault_agent_fee_bps: VAULT_AGENT_FEE_BPS,
      total_fees_eth: (
        (Number(nftxMintFeeEth) + Number(vaultAgentFeeWei)) /
        1e18
      ).toFixed(6),
    },
    ownership_checks: tokenChecks,
    pre_flight: {
      all_owned: readyToMint,
      needs_approval: needsApproval,
      ready_to_execute: readyToMint && !needsApproval,
      next_steps: needsApproval
        ? [
            "1. Call setApprovalForAll(vault_address, true) on the NFT contract",
            "2. Re-run simulation to confirm",
            "3. Execute mint transaction",
          ]
        : readyToMint
        ? ["Execute mint transaction via execute_mint tool"]
        : ["Verify NFT ownership first"],
    },
    warning:
      "⚠️ This is a simulation only. Always verify on-chain state before executing.",
  };
}
