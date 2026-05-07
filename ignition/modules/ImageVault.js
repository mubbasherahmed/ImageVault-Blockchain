const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

const ImageVaultModule = buildModule("ImageVaultModule", (m) => {
  const imageVault = m.contract("ImageVault");
  return { imageVault };
});

module.exports = ImageVaultModule;
