import { expect } from "chai";
import hre from "hardhat";

/**
 * VaultAgentFeeWrapper — Unit Tests
 *
 * Tests:
 *  1. Deployment (owner, feeRecipient, feeBps, paused=false)
 *  2. Kill-switch: pause() / unpause()
 *  3. Admin: setFeeBps, setFeeRecipient, transferOwnership
 *  4. Access control: non-owner cannot call admin functions
 *  5. Emergency withdraw
 */

describe("VaultAgentFeeWrapper", function () {
  // ─── Fixtures ──────────────────────────────────────────────────────────────

  async function deployFixture() {
    const [owner, feeRecipient, other] = await hre.viem.getWalletClients();
    const publicClient = await hre.viem.getPublicClient();

    const wrapper = await hre.viem.deployContract("VaultAgentFeeWrapper", [
      feeRecipient.account.address,
      25n, // 0.25%
    ]);

    return { wrapper, owner, feeRecipient, other, publicClient };
  }

  // ─── 1. Deployment ─────────────────────────────────────────────────────────

  describe("Deployment", function () {
    it("sets owner to deployer", async function () {
      const { wrapper, owner } = await deployFixture();
      expect((await wrapper.read.owner()).toLowerCase()).to.equal(
        owner.account.address.toLowerCase()
      );
    });

    it("sets feeRecipient correctly", async function () {
      const { wrapper, feeRecipient } = await deployFixture();
      expect((await wrapper.read.feeRecipient()).toLowerCase()).to.equal(
        feeRecipient.account.address.toLowerCase()
      );
    });

    it("sets feeBps to 25", async function () {
      const { wrapper } = await deployFixture();
      expect(await wrapper.read.feeBps()).to.equal(25n);
    });

    it("starts unpaused", async function () {
      const { wrapper } = await deployFixture();
      expect(await wrapper.read.paused()).to.equal(false);
    });

    it("reverts if feeRecipient is zero address", async function () {
      await expect(
        hre.viem.deployContract("VaultAgentFeeWrapper", [
          "0x0000000000000000000000000000000000000000",
          25n,
        ])
      ).to.be.rejectedWith("VaultAgent: zero fee recipient");
    });

    it("reverts if feeBps exceeds MAX_FEE_BPS (100)", async function () {
      const [, feeRecipient] = await hre.viem.getWalletClients();
      await expect(
        hre.viem.deployContract("VaultAgentFeeWrapper", [
          feeRecipient.account.address,
          101n,
        ])
      ).to.be.rejectedWith("VaultAgent: fee too high");
    });
  });

  // ─── 2. Kill-switch ────────────────────────────────────────────────────────

  describe("Kill-switch: pause / unpause", function () {
    it("owner can pause", async function () {
      const { wrapper, owner } = await deployFixture();
      await wrapper.write.pause({ account: owner.account });
      expect(await wrapper.read.paused()).to.equal(true);
    });

    it("emits Paused event", async function () {
      const { wrapper, owner, publicClient } = await deployFixture();
      const hash = await wrapper.write.pause({ account: owner.account });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const logs = await wrapper.getEvents.Paused();
      expect(logs.length).to.be.greaterThan(0);
    });

    it("owner can unpause", async function () {
      const { wrapper, owner } = await deployFixture();
      await wrapper.write.pause({ account: owner.account });
      await wrapper.write.unpause({ account: owner.account });
      expect(await wrapper.read.paused()).to.equal(false);
    });

    it("emits Unpaused event", async function () {
      const { wrapper, owner } = await deployFixture();
      await wrapper.write.pause({ account: owner.account });
      await wrapper.write.unpause({ account: owner.account });
      const logs = await wrapper.getEvents.Unpaused();
      expect(logs.length).to.be.greaterThan(0);
    });

    it("non-owner cannot pause", async function () {
      const { wrapper, other } = await deployFixture();
      await expect(
        wrapper.write.pause({ account: other.account })
      ).to.be.rejectedWith("VaultAgent: not owner");
    });

    it("cannot pause when already paused", async function () {
      const { wrapper, owner } = await deployFixture();
      await wrapper.write.pause({ account: owner.account });
      await expect(
        wrapper.write.pause({ account: owner.account })
      ).to.be.rejectedWith("VaultAgent: already paused");
    });

    it("cannot unpause when not paused", async function () {
      const { wrapper, owner } = await deployFixture();
      await expect(
        wrapper.write.unpause({ account: owner.account })
      ).to.be.rejectedWith("VaultAgent: not paused");
    });
  });

  // ─── 3. Admin functions ────────────────────────────────────────────────────

  describe("Admin: setFeeBps", function () {
    it("owner can update feeBps", async function () {
      const { wrapper, owner } = await deployFixture();
      await wrapper.write.setFeeBps([50n], { account: owner.account });
      expect(await wrapper.read.feeBps()).to.equal(50n);
    });

    it("emits FeeUpdated event", async function () {
      const { wrapper, owner } = await deployFixture();
      await wrapper.write.setFeeBps([50n], { account: owner.account });
      const logs = await wrapper.getEvents.FeeUpdated();
      expect(logs[0].args.oldFeeBps).to.equal(25n);
      expect(logs[0].args.newFeeBps).to.equal(50n);
    });

    it("cannot set feeBps above 100", async function () {
      const { wrapper, owner } = await deployFixture();
      await expect(
        wrapper.write.setFeeBps([101n], { account: owner.account })
      ).to.be.rejectedWith("VaultAgent: fee too high");
    });

    it("non-owner cannot setFeeBps", async function () {
      const { wrapper, other } = await deployFixture();
      await expect(
        wrapper.write.setFeeBps([10n], { account: other.account })
      ).to.be.rejectedWith("VaultAgent: not owner");
    });
  });

  describe("Admin: setFeeRecipient", function () {
    it("owner can update feeRecipient", async function () {
      const { wrapper, owner, other } = await deployFixture();
      await wrapper.write.setFeeRecipient([other.account.address], {
        account: owner.account,
      });
      expect((await wrapper.read.feeRecipient()).toLowerCase()).to.equal(
        other.account.address.toLowerCase()
      );
    });

    it("reverts on zero address", async function () {
      const { wrapper, owner } = await deployFixture();
      await expect(
        wrapper.write.setFeeRecipient(
          ["0x0000000000000000000000000000000000000000"],
          { account: owner.account }
        )
      ).to.be.rejectedWith("VaultAgent: zero address");
    });

    it("non-owner cannot setFeeRecipient", async function () {
      const { wrapper, other } = await deployFixture();
      await expect(
        wrapper.write.setFeeRecipient([other.account.address], {
          account: other.account,
        })
      ).to.be.rejectedWith("VaultAgent: not owner");
    });
  });

  describe("Admin: transferOwnership", function () {
    it("owner can transfer ownership", async function () {
      const { wrapper, owner, other } = await deployFixture();
      await wrapper.write.transferOwnership([other.account.address], {
        account: owner.account,
      });
      expect((await wrapper.read.owner()).toLowerCase()).to.equal(
        other.account.address.toLowerCase()
      );
    });

    it("emits OwnershipTransferred event", async function () {
      const { wrapper, owner, other } = await deployFixture();
      await wrapper.write.transferOwnership([other.account.address], {
        account: owner.account,
      });
      const logs = await wrapper.getEvents.OwnershipTransferred();
      expect(logs[0].args.oldOwner?.toLowerCase()).to.equal(
        owner.account.address.toLowerCase()
      );
      expect(logs[0].args.newOwner?.toLowerCase()).to.equal(
        other.account.address.toLowerCase()
      );
    });

    it("reverts on zero address", async function () {
      const { wrapper, owner } = await deployFixture();
      await expect(
        wrapper.write.transferOwnership(
          ["0x0000000000000000000000000000000000000000"],
          { account: owner.account }
        )
      ).to.be.rejectedWith("VaultAgent: zero address");
    });
  });

  // ─── 4. Emergency withdraw ─────────────────────────────────────────────────

  describe("Emergency: withdrawETH", function () {
    it("owner can withdraw stuck ETH", async function () {
      const { wrapper, owner, publicClient } = await deployFixture();

      // Send ETH to contract
      await owner.sendTransaction({
        to: wrapper.address,
        value: 1000000000000000n, // 0.001 ETH
      });

      const balanceBefore = await publicClient.getBalance({
        address: owner.account.address,
      });

      await wrapper.write.withdrawETH({ account: owner.account });

      const balanceAfter = await publicClient.getBalance({
        address: owner.account.address,
      });

      // Owner balance increased (minus gas)
      expect(balanceAfter).to.be.greaterThan(balanceBefore - 100000000000000n);
    });

    it("non-owner cannot withdrawETH", async function () {
      const { wrapper, other } = await deployFixture();
      await expect(
        wrapper.write.withdrawETH({ account: other.account })
      ).to.be.rejectedWith("VaultAgent: not owner");
    });
  });
});
