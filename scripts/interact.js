/**
 * Interactive CLI Script for ImageVault Contract
 * Usage: npx hardhat run scripts/interact.js --network localhost
 */
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

async function main() {
  const [deployer, user1, user2] = await hre.ethers.getSigners();

  console.log("\n ImageVault - Interactive CLI");
  console.log("=".repeat(60));
  console.log(`Network:  ${hre.network.name}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`User 1:   ${user1.address}`);
  console.log(`User 2:   ${user2.address}`);
  console.log("=".repeat(60));

  console.log("\nDeploying ImageVault...");
  const ImageVault = await hre.ethers.getContractFactory("ImageVault");
  const vault = await ImageVault.deploy();
  await vault.waitForDeployment();
  const contractAddress = await vault.getAddress();
  console.log(`Deployed at: ${contractAddress}\n`);

  // Hash demo images
  const imagesDir = path.join(__dirname, "..", "images");
  const imageFiles = fs.readdirSync(imagesDir).filter((f) =>
    [".png", ".jpg", ".jpeg"].includes(path.extname(f).toLowerCase())
  );
  const imageHashes = {};
  for (const file of imageFiles) {
    const buffer = fs.readFileSync(path.join(imagesDir, file));
    imageHashes[file] = "0x" + crypto.createHash("sha256").update(buffer).digest("hex");
  }

  // Register images
  console.log("REGISTERING IMAGES");
  console.log("-".repeat(60));
  const descs = {
    "xray_hand.png": "X-ray of human hand",
    "xray_chest.png": "X-ray of human thorax",
    "xray_knee.png": "X-ray of human knee",
  };
  for (const [file, hash] of Object.entries(imageHashes)) {
    const name = file.replace(/\.[^.]+$/, "").replace(/_/g, " ").toUpperCase();
    await (await vault.registerImage(hash, name, descs[file] || file)).wait();
    console.log(`  Registered: ${name} -> ${hash.substring(0, 20)}...`);
  }

  // Check access
  const firstHash = Object.values(imageHashes)[0];
  console.log("\nACCESS CHECK");
  console.log("-".repeat(60));
  console.log(`  Deployer: ${await vault.hasAccess(firstHash, deployer.address)}`);
  console.log(`  User1:    ${await vault.hasAccess(firstHash, user1.address)}`);

  // Grant access
  console.log("\nGRANT ACCESS TO USER1");
  await (await vault.grantAccess(firstHash, user1.address)).wait();
  console.log(`  User1 now: ${await vault.hasAccess(firstHash, user1.address)}`);

  // Transfer
  if (Object.keys(imageHashes).length > 1) {
    const secondHash = Object.values(imageHashes)[1];
    console.log("\nTRANSFER OWNERSHIP");
    await (await vault.transferImageOwnership(secondHash, user2.address)).wait();
    console.log(`  New owner: ${await vault.getImageOwner(secondHash)}`);
  }

  // Stats
  console.log("\nSTATS");
  console.log(`  Total images: ${await vault.getTotalImages()}`);
  console.log(`  Deployer owns: ${(await vault.getOwnedImages(deployer.address)).length}`);

  // Save deployment info
  const info = { contractAddress, deployer: deployer.address, imageHashes, deployedAt: new Date().toISOString() };
  fs.writeFileSync(path.join(__dirname, "..", "deployment-info.json"), JSON.stringify(info, null, 2));
  console.log("\nDeployment info saved to deployment-info.json\n");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
