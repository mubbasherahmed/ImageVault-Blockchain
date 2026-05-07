const { ethers } = require("ethers");
async function main() {
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
  const nonce1 = await provider.getTransactionCount("0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266");
  const nonce2 = await provider.getTransactionCount("0x70997970C51812dc3A010C7d01b50e0d17dc79C8");
  console.log("RPC Nonce 1:", nonce1, "RPC Nonce 2:", nonce2);
}
main();
