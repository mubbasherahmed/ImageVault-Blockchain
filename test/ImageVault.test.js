const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ImageVault", function () {
  let vault, owner, user1, user2, user3;
  const HASH_1 = ethers.keccak256(ethers.toUtf8Bytes("xray_hand.png"));
  const HASH_2 = ethers.keccak256(ethers.toUtf8Bytes("xray_chest.png"));
  const HASH_3 = ethers.keccak256(ethers.toUtf8Bytes("xray_knee.png"));

  beforeEach(async function () {
    [owner, user1, user2, user3] = await ethers.getSigners();
    const ImageVault = await ethers.getContractFactory("ImageVault");
    vault = await ImageVault.deploy();
    await vault.waitForDeployment();
  });

  describe("Registration", function () {
    it("should register a new image", async function () {
      await vault.registerImage(HASH_1, "X-Ray Hand", "Hand radiograph");
      const data = await vault.getImageData(HASH_1);
      expect(data.name).to.equal("X-Ray Hand");
      expect(data.owner).to.equal(owner.address);
      expect(data.exists).to.be.true;
    });

    it("should auto-grant access to owner", async function () {
      await vault.registerImage(HASH_1, "Hand", "Desc");
      expect(await vault.hasAccess(HASH_1, owner.address)).to.be.true;
    });

    it("should track owned images", async function () {
      await vault.registerImage(HASH_1, "Hand", "D1");
      await vault.registerImage(HASH_2, "Chest", "D2");
      const owned = await vault.getOwnedImages(owner.address);
      expect(owned.length).to.equal(2);
    });

    it("should increment total count", async function () {
      await vault.registerImage(HASH_1, "I1", "D");
      expect(await vault.getTotalImages()).to.equal(1);
    });

    it("should REVERT on duplicate hash", async function () {
      await vault.registerImage(HASH_1, "Orig", "D");
      await expect(vault.registerImage(HASH_1, "Dup", "D"))
        .to.be.revertedWithCustomError(vault, "ImageAlreadyRegistered");
    });

    it("should REVERT on zero hash", async function () {
      await expect(vault.registerImage(ethers.ZeroHash, "Bad", "D"))
        .to.be.revertedWithCustomError(vault, "InvalidAddress");
    });
  });

  describe("Access Control", function () {
    beforeEach(async () => {
      await vault.registerImage(HASH_1, "Hand", "Desc");
    });

    it("should grant access", async function () {
      await vault.grantAccess(HASH_1, user1.address);
      expect(await vault.hasAccess(HASH_1, user1.address)).to.be.true;
    });

    it("should revoke access", async function () {
      await vault.grantAccess(HASH_1, user1.address);
      await vault.revokeAccess(HASH_1, user1.address);
      expect(await vault.hasAccess(HASH_1, user1.address)).to.be.false;
    });

    it("should REVERT non-owner grant", async function () {
      await expect(vault.connect(user1).grantAccess(HASH_1, user2.address))
        .to.be.revertedWithCustomError(vault, "NotImageOwner");
    });

    it("should REVERT duplicate grant", async function () {
      await vault.grantAccess(HASH_1, user1.address);
      await expect(vault.grantAccess(HASH_1, user1.address))
        .to.be.revertedWithCustomError(vault, "AlreadyHasAccess");
    });

    it("should REVERT revoking owner access", async function () {
      await expect(vault.revokeAccess(HASH_1, owner.address))
        .to.be.revertedWithCustomError(vault, "CannotRevokeOwnerAccess");
    });

    it("should grant to multiple users", async function () {
      await vault.grantAccess(HASH_1, user1.address);
      await vault.grantAccess(HASH_1, user2.address);
      expect(await vault.hasAccess(HASH_1, user1.address)).to.be.true;
      expect(await vault.hasAccess(HASH_1, user2.address)).to.be.true;
    });
  });

  describe("Ownership Transfer", function () {
    beforeEach(async () => {
      await vault.registerImage(HASH_1, "Hand", "Desc");
    });

    it("should transfer ownership", async function () {
      await vault.transferImageOwnership(HASH_1, user1.address);
      expect(await vault.getImageOwner(HASH_1)).to.equal(user1.address);
    });

    it("should grant access to new owner", async function () {
      await vault.transferImageOwnership(HASH_1, user1.address);
      expect(await vault.hasAccess(HASH_1, user1.address)).to.be.true;
    });

    it("should update owned lists", async function () {
      await vault.transferImageOwnership(HASH_1, user1.address);
      const ownerImgs = await vault.getOwnedImages(owner.address);
      const user1Imgs = await vault.getOwnedImages(user1.address);
      expect(ownerImgs).to.not.include(HASH_1);
      expect(user1Imgs).to.include(HASH_1);
    });

    it("should let new owner manage access", async function () {
      await vault.transferImageOwnership(HASH_1, user1.address);
      await vault.connect(user1).grantAccess(HASH_1, user2.address);
      expect(await vault.hasAccess(HASH_1, user2.address)).to.be.true;
    });

    it("should REVERT non-owner transfer", async function () {
      await expect(vault.connect(user1).transferImageOwnership(HASH_1, user2.address))
        .to.be.revertedWithCustomError(vault, "NotImageOwner");
    });

    it("should REVERT transfer to zero address", async function () {
      await expect(vault.transferImageOwnership(HASH_1, ethers.ZeroAddress))
        .to.be.revertedWithCustomError(vault, "InvalidAddress");
    });

    it("should REVERT transfer to self", async function () {
      await expect(vault.transferImageOwnership(HASH_1, owner.address))
        .to.be.revertedWithCustomError(vault, "CannotTransferToSelf");
    });
  });

  describe("Querying", function () {
    it("should return all hashes", async function () {
      await vault.registerImage(HASH_1, "H", "D");
      await vault.registerImage(HASH_2, "C", "D");
      const all = await vault.getAllImageHashes();
      expect(all.length).to.equal(2);
    });

    it("should report isRegistered correctly", async function () {
      await vault.registerImage(HASH_1, "H", "D");
      expect(await vault.isRegistered(HASH_1)).to.be.true;
      expect(await vault.isRegistered(HASH_2)).to.be.false;
    });

    it("should REVERT on nonexistent image query", async function () {
      await expect(vault.getImageData(HASH_1))
        .to.be.revertedWithCustomError(vault, "ImageNotFound");
    });
  });
});
