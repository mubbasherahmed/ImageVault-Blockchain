# 🔐 ImageVault — Blockchain Image Registry

A **smart contract system** where images are registered as non-fungible digital assets on the Ethereum blockchain. Each image gets a unique **SHA-256 hash ID**, and only holders of the correct **cryptographic keys** (wallet addresses) can access the images.

> Think of it like Bitcoin, but for images — each image-hash is a unique asset with ownership and key-based access control.

![Solidity](https://img.shields.io/badge/Solidity-0.8.27-363636?logo=solidity)
![Hardhat](https://img.shields.io/badge/Hardhat-2.x-yellow?logo=ethereum)
![Tests](https://img.shields.io/badge/Tests-22%2F22%20passing-brightgreen)
![License](https://img.shields.io/badge/License-MIT-blue)

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 📸 **Register Images** | Hash any image with SHA-256 and register it on-chain |
| 🔑 **Access Control** | Grant/revoke viewing access to other wallet addresses |
| 🔄 **Ownership Transfer** | Transfer full ownership like sending crypto |
| 🛡️ **Tamper-Proof** | Image hashes are immutable on the blockchain |
| 🖥️ **Web Frontend** | Premium dark-themed UI with MetaMask integration |
| 🏥 **Demo X-Rays** | Comes with 3 sample X-ray images for demonstration |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────┐
│              Smart Contract                  │
│              (ImageVault.sol)                 │
│                                              │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  │
│  │ Registry │  │  Access   │  │ Ownership │  │
│  │ hash→meta│  │ hash→keys│  │ hash→owner│  │
│  └──────────┘  └──────────┘  └───────────┘  │
└─────────────────────────────────────────────┘
        ↑                    ↑
    Frontend            CLI Scripts
  (ethers.js)         (hashImage.js)
```

---

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) v18+
- [MetaMask](https://metamask.io/) browser extension (for frontend)

### 1. Install dependencies
```bash
npm install
```

### 2. Compile the smart contract
```bash
npx hardhat compile
```

### 3. Run tests
```bash
npx hardhat test
```

### 4. Start local blockchain
```bash
npx hardhat node
```

### 5. Deploy (in a new terminal)
```bash
npx hardhat ignition deploy ./ignition/modules/ImageVault.js --network localhost
```

### 6. Run the CLI demo
```bash
npx hardhat run scripts/interact.js --network localhost
```

### 7. Open the frontend
Open `frontend/index.html` in a browser with MetaMask connected to `localhost:8545`.

---

## 📁 Project Structure

```
Blockchain/
├── contracts/
│   └── ImageVault.sol          # Core smart contract
├── ignition/modules/
│   └── ImageVault.js           # Deployment module
├── scripts/
│   ├── hashImage.js            # SHA-256 image hashing utility
│   └── interact.js             # CLI demo script
├── test/
│   └── ImageVault.test.js      # 22 unit tests
├── frontend/
│   ├── index.html              # Web UI
│   ├── style.css               # Premium dark theme
│   └── app.js                  # ethers.js + MetaMask
├── images/                     # Demo X-ray images
│   ├── xray_hand.png
│   ├── xray_chest.png
│   └── xray_knee.png
├── hardhat.config.js
└── package.json
```

---

## 🔧 Smart Contract API

### Core Functions

```solidity
// Register an image on the blockchain
function registerImage(bytes32 imageHash, string name, string description)

// Grant viewing access to another wallet
function grantAccess(bytes32 imageHash, address user)

// Revoke viewing access
function revokeAccess(bytes32 imageHash, address user)

// Transfer full ownership
function transferImageOwnership(bytes32 imageHash, address newOwner)

// Check if an address has access
function hasAccess(bytes32 imageHash, address user) → bool

// Get image metadata
function getImageData(bytes32 imageHash) → ImageData
```

---

## 🛠️ Utility Scripts

### Hash an image
```bash
node scripts/hashImage.js images/xray_hand.png
# Output: 0x2697aee1a04cbbb76e5d912455976109e534d2688214880eb657f15a3eb20517

node scripts/hashImage.js --all   # Hash all images in /images
```

---

## 🧪 Test Coverage

```
ImageVault
  Registration
    ✔ should register a new image
    ✔ should auto-grant access to owner
    ✔ should track owned images
    ✔ should increment total count
    ✔ should REVERT on duplicate hash
    ✔ should REVERT on zero hash
  Access Control
    ✔ should grant access
    ✔ should revoke access
    ✔ should REVERT non-owner grant
    ✔ should REVERT duplicate grant
    ✔ should REVERT revoking owner access
    ✔ should grant to multiple users
  Ownership Transfer
    ✔ should transfer ownership
    ✔ should grant access to new owner
    ✔ should update owned lists
    ✔ should let new owner manage access
    ✔ should REVERT non-owner transfer
    ✔ should REVERT transfer to zero address
    ✔ should REVERT transfer to self
  Querying
    ✔ should return all hashes
    ✔ should report isRegistered correctly
    ✔ should REVERT on nonexistent image query

22 passing
```

---

## 📜 License

MIT
