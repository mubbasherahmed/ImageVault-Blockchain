const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const contractAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  const ImageVault = await hre.ethers.getContractFactory("ImageVault");
  const contract = ImageVault.attach(contractAddress);

  // generate random hash
  const randomHash = hre.ethers.utils.hexlify(hre.ethers.utils.randomBytes(32));
  console.log("Registering random hash:", randomHash);

  try {
    const tx = await contract.registerImage(randomHash, "Test Image", "Test Description");
    const receipt = await tx.wait();
    console.log("Success! TX Hash:", receipt.transactionHash);
  } catch(e) {
    console.error("Failed!", e);
  }
}

main();
