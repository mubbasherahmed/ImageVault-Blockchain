const hre = require("hardhat");

async function main() {
  const code1 = await hre.ethers.provider.getCode("0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512");
  const code2 = await hre.ethers.provider.getCode("0x5FbDB2315678afecb367f032d93F642f64180aa3");
  console.log("0xe7f1... length:", code1.length);
  console.log("0x5FbD... length:", code2.length);
}

main();
