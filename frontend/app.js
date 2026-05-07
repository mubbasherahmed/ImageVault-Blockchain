/**
 * ImageVault Frontend Application
 * Connects to the deployed ImageVault smart contract via ethers.js + MetaMask
 */

// ============================================================
//  CONTRACT ABI (only the functions we need)
// ============================================================
const CONTRACT_ABI = [
  "function registerImage(bytes32 imageHash, string name, string description) external",
  "function grantAccess(bytes32 imageHash, address user) external",
  "function revokeAccess(bytes32 imageHash, address user) external",
  "function transferImageOwnership(bytes32 imageHash, address newOwner) external",
  "function hasAccess(bytes32 imageHash, address user) external view returns (bool)",
  "function getImageData(bytes32 imageHash) external view returns (tuple(bytes32 imageHash, string name, string description, address owner, uint256 registeredAt, uint256 accessCount, bool exists))",
  "function getImageOwner(bytes32 imageHash) external view returns (address)",
  "function getOwnedImages(address owner) external view returns (bytes32[])",
  "function getAccessibleImages(address user) external view returns (bytes32[])",
  "function getTotalImages() external view returns (uint256)",
  "function getAllImageHashes() external view returns (bytes32[])",
  "function isRegistered(bytes32 imageHash) external view returns (bool)",
  "event ImageRegistered(bytes32 indexed imageHash, address indexed owner, string name, uint256 timestamp)",
  "event AccessGranted(bytes32 indexed imageHash, address indexed owner, address indexed grantee)",
  "event AccessRevoked(bytes32 indexed imageHash, address indexed owner, address indexed revokee)",
  "event OwnershipTransferred(bytes32 indexed imageHash, address indexed previousOwner, address indexed newOwner)",
];

// ============================================================
//  STATE
// ============================================================
let provider = null;
let signer = null;
let contract = null;
let currentAccount = null;
let contractAddress = null; // Will be set from deployment-info.json
let pendingImageHash = null;
let pendingImageFile = null;

// Local image storage: hash -> { file: File, dataUrl: string }
const imageStore = {};

// ============================================================
//  INITIALIZATION
// ============================================================
document.addEventListener("DOMContentLoaded", async () => {
  setupTabs();
  setupDropZone();
  setupButtons();
  await tryLoadDeploymentInfo();
});

async function tryLoadDeploymentInfo() {
  try {
    const res = await fetch("deployment-info.json");
    if (res.ok) {
      const info = await res.json();
      contractAddress = info.contractAddress;
      console.log("Loaded contract address:", contractAddress);
    }
  } catch (e) {
    console.log("No deployment-info.json found. Please deploy the contract first.");
  }
}

// ============================================================
//  WALLET CONNECTION
// ============================================================
async function connectWallet() {
  if (!window.ethereum) {
    showToast("MetaMask not found. Please install MetaMask to continue.", "error");
    return;
  }

  try {
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    provider = new ethers.providers.Web3Provider(window.ethereum);
    signer = provider.getSigner();
    currentAccount = accounts[0];

    // Prompt for contract address if not loaded
    if (!contractAddress) {
      contractAddress = prompt(
        "Enter the deployed ImageVault contract address:\n(Deploy with: npx hardhat ignition deploy ./ignition/modules/ImageVault.js --network localhost)"
      );
      if (!contractAddress) return;
    }

    contract = new ethers.Contract(contractAddress, CONTRACT_ABI, signer);

    // Update UI
    updateConnectionUI(true);
    await refreshStats();
    await refreshGallery();
    await refreshSelects();

    showToast("Wallet connected successfully!", "success");

    // Listen for account changes
    window.ethereum.on("accountsChanged", (accs) => {
      if (accs.length === 0) {
        updateConnectionUI(false);
      } else {
        currentAccount = accs[0];
        updateConnectionUI(true);
        refreshStats();
        refreshGallery();
        refreshSelects();
      }
    });
  } catch (err) {
    console.error(err);
    showToast("Failed to connect wallet: " + err.message, "error");
  }
}

function updateConnectionUI(connected) {
  const badge = document.getElementById("network-badge");
  const btn = document.getElementById("connect-btn");
  const addrStat = document.getElementById("stat-address");

  if (connected) {
    badge.className = "badge badge-success";
    badge.innerHTML = `<span class="badge-dot"></span><span>Connected</span>`;
    btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>${currentAccount.slice(0, 6)}...${currentAccount.slice(-4)}`;
    addrStat.textContent = `${currentAccount.slice(0, 6)}...${currentAccount.slice(-4)}`;
  } else {
    badge.className = "badge badge-warning";
    badge.innerHTML = `<span class="badge-dot"></span><span>Not Connected</span>`;
    btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>Connect Wallet`;
    addrStat.textContent = "---";
  }
}

// ============================================================
//  TABS
// ============================================================
function setupTabs() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
    });
  });
}

// ============================================================
//  DROP ZONE & IMAGE HASHING
// ============================================================
function setupDropZone() {
  const dropZone = document.getElementById("drop-zone");
  const fileInput = document.getElementById("image-input");

  dropZone.addEventListener("click", () => fileInput.click());
  dropZone.addEventListener("dragover", (e) => { e.preventDefault(); dropZone.classList.add("dragover"); });
  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));
  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    if (e.dataTransfer.files.length) handleImageFile(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener("change", (e) => {
    if (e.target.files.length) handleImageFile(e.target.files[0]);
  });
}

async function handleImageFile(file) {
  if (!file.type.startsWith("image/")) {
    showToast("Please select a valid image file.", "error");
    return;
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    const dataUrl = e.target.result;

    // Show preview
    document.getElementById("drop-zone").classList.add("hidden");
    const previewArea = document.getElementById("image-preview-area");
    previewArea.classList.remove("hidden");
    document.getElementById("preview-img").src = dataUrl;
    document.getElementById("preview-name").textContent = file.name;
    document.getElementById("preview-size").textContent = `${(file.size / 1024).toFixed(1)} KB`;

    // Hash the image
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = "0x" + hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    document.getElementById("preview-hash-value").textContent = hashHex;
    pendingImageHash = hashHex;
    pendingImageFile = file;

    // Store locally
    imageStore[hashHex] = { file, dataUrl };

    // Enable register button
    document.getElementById("register-btn").disabled = false;

    // Pre-fill name
    const nameInput = document.getElementById("reg-name");
    if (!nameInput.value) {
      nameInput.value = file.name.replace(/\.[^.]+$/, "").replace(/[_-]/g, " ");
    }
  };
  reader.readAsDataURL(file);
}

// ============================================================
//  BUTTON HANDLERS
// ============================================================
function setupButtons() {
  document.getElementById("connect-btn").addEventListener("click", connectWallet);
  document.getElementById("register-btn").addEventListener("click", registerImage);
  document.getElementById("grant-btn").addEventListener("click", grantAccess);
  document.getElementById("revoke-btn").addEventListener("click", revokeAccess);
  document.getElementById("check-btn").addEventListener("click", checkAccess);
  document.getElementById("transfer-btn").addEventListener("click", transferOwnership);
}

// ============================================================
//  CONTRACT INTERACTIONS
// ============================================================

async function registerImage() {
  if (!contract) { showToast("Connect your wallet first.", "error"); return; }
  if (!pendingImageHash) { showToast("Select an image first.", "error"); return; }

  const name = document.getElementById("reg-name").value.trim();
  const desc = document.getElementById("reg-desc").value.trim();
  if (!name) { showToast("Please enter an image name.", "error"); return; }

  showModal("Registering Image...", "Please confirm the transaction in MetaMask");

  try {
    const tx = await contract.registerImage(pendingImageHash, name, desc || "", { gasLimit: 500000 });
    showModal("Mining Transaction...", `TX: ${tx.hash}`);
    document.getElementById("tx-modal-hash").textContent = tx.hash;
    document.getElementById("tx-modal-hash").classList.remove("hidden");

    await tx.wait();
    hideModal();
    showToast(`Image "${name}" registered on blockchain!`, "success");

    // Reset form
    resetRegisterForm();
    await refreshStats();
    await refreshGallery();
    await refreshSelects();
  } catch (err) {
    hideModal();
    showToast("Registration failed: " + parseError(err), "error");
  }
}

async function grantAccess() {
  if (!contract) { showToast("Connect your wallet first.", "error"); return; }

  const hash = document.getElementById("access-hash").value;
  const addr = document.getElementById("access-address").value.trim();
  if (!hash) { showToast("Select an image.", "error"); return; }
  if (!ethers.utils.isAddress(addr)) { showToast("Invalid address.", "error"); return; }

  showModal("Granting Access...", "Please confirm in MetaMask");
  try {
    const tx = await contract.grantAccess(hash, addr, { gasLimit: 500000 });
    await tx.wait();
    hideModal();
    showToast("Access granted successfully!", "success");
    document.getElementById("access-address").value = "";
    await refreshStats();
  } catch (err) {
    hideModal();
    showToast("Grant failed: " + parseError(err), "error");
  }
}

async function revokeAccess() {
  if (!contract) { showToast("Connect your wallet first.", "error"); return; }

  const hash = document.getElementById("access-hash").value;
  const addr = document.getElementById("access-address").value.trim();
  if (!hash) { showToast("Select an image.", "error"); return; }
  if (!ethers.utils.isAddress(addr)) { showToast("Invalid address.", "error"); return; }

  showModal("Revoking Access...", "Please confirm in MetaMask");
  try {
    const tx = await contract.revokeAccess(hash, addr, { gasLimit: 500000 });
    await tx.wait();
    hideModal();
    showToast("Access revoked.", "success");
    document.getElementById("access-address").value = "";
    await refreshStats();
  } catch (err) {
    hideModal();
    showToast("Revoke failed: " + parseError(err), "error");
  }
}

async function checkAccess() {
  if (!contract) { showToast("Connect your wallet first.", "error"); return; }

  const hash = document.getElementById("access-hash").value;
  const addr = document.getElementById("check-address").value.trim();
  if (!hash) { showToast("Select an image.", "error"); return; }
  if (!ethers.utils.isAddress(addr)) { showToast("Invalid address.", "error"); return; }

  try {
    const result = await contract.hasAccess(hash, addr);
    const resultDiv = document.getElementById("check-result");
    resultDiv.classList.remove("hidden", "has-access", "no-access");
    if (result) {
      resultDiv.classList.add("has-access");
      resultDiv.textContent = `✅ Address ${addr.slice(0, 8)}... HAS access to this image`;
    } else {
      resultDiv.classList.add("no-access");
      resultDiv.textContent = `❌ Address ${addr.slice(0, 8)}... does NOT have access`;
    }
  } catch (err) {
    showToast("Check failed: " + parseError(err), "error");
  }
}

async function transferOwnership() {
  if (!contract) { showToast("Connect your wallet first.", "error"); return; }

  const hash = document.getElementById("transfer-hash").value;
  const addr = document.getElementById("transfer-address").value.trim();
  if (!hash) { showToast("Select an image.", "error"); return; }
  if (!ethers.utils.isAddress(addr)) { showToast("Invalid address.", "error"); return; }

  if (!confirm("Are you sure? This will permanently transfer ownership.")) return;

  showModal("Transferring Ownership...", "Please confirm in MetaMask");
  try {
    const tx = await contract.transferImageOwnership(hash, addr, { gasLimit: 500000 });
    await tx.wait();
    hideModal();
    showToast("Ownership transferred successfully!", "success");
    document.getElementById("transfer-address").value = "";
    await refreshStats();
    await refreshGallery();
    await refreshSelects();
  } catch (err) {
    hideModal();
    showToast("Transfer failed: " + parseError(err), "error");
  }
}

// ============================================================
//  DATA REFRESH
// ============================================================

async function refreshStats() {
  if (!contract) return;
  try {
    const total = await contract.getTotalImages();
    const owned = await contract.getOwnedImages(currentAccount);
    const accessible = await contract.getAccessibleImages(currentAccount);

    document.getElementById("stat-total").textContent = total.toString();
    document.getElementById("stat-owned").textContent = owned.length;
    document.getElementById("stat-accessible").textContent = accessible.length;
  } catch (err) {
    console.error("Stats refresh error:", err);
  }
}

async function refreshGallery() {
  if (!contract) return;
  const grid = document.getElementById("gallery-grid");

  try {
    const allHashes = await contract.getAllImageHashes();
    if (allHashes.length === 0) {
      grid.innerHTML = `<div class="empty-state">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
        <p>No images registered yet</p>
        <span>Register your first image to see it here</span>
      </div>`;
      return;
    }

    grid.innerHTML = "";

    for (const hash of allHashes) {
      const data = await contract.getImageData(hash);
      const hasAccessResult = await contract.hasAccess(hash, currentAccount);
      const isOwner = data.owner.toLowerCase() === currentAccount.toLowerCase();

      const card = document.createElement("div");
      card.className = "gallery-card";

      let imgSrc = "";
      let imgClass = "gallery-card-img";
      if (imageStore[hash]) {
        imgSrc = imageStore[hash].dataUrl;
      } else {
        // Try to load from local images folder
        imgSrc = `../images/${guessFileName(data.name)}`;
      }

      if (!hasAccessResult && !isOwner) {
        imgClass += " locked";
      }

      const date = new Date(data.registeredAt.toNumber() * 1000);
      const dateStr = date.toLocaleDateString();

      let badgeClass = "locked";
      let badgeText = "LOCKED";
      if (isOwner) { badgeClass = "owner"; badgeText = "OWNER"; }
      else if (hasAccessResult) { badgeClass = "access"; badgeText = "ACCESS"; }

      card.innerHTML = `
        <img src="${imgSrc}" alt="${data.name}" class="${imgClass}" onerror="this.style.background='linear-gradient(135deg, #1a1a2e, #16213e)'; this.style.display='block';" />
        <div class="gallery-card-body">
          <div class="gallery-card-name">${data.name}</div>
          <div class="gallery-card-desc">${data.description || "No description"}</div>
          <div class="gallery-card-hash">${hash}</div>
          <div class="gallery-card-footer">
            <span class="gallery-badge ${badgeClass}">${badgeText}</span>
            <span class="gallery-card-date">${dateStr}</span>
          </div>
        </div>
      `;
      grid.appendChild(card);
    }
  } catch (err) {
    console.error("Gallery refresh error:", err);
  }
}

async function refreshSelects() {
  if (!contract) return;
  try {
    const owned = await contract.getOwnedImages(currentAccount);
    const accessSelect = document.getElementById("access-hash");
    const transferSelect = document.getElementById("transfer-hash");

    // Clear existing options (keep placeholder)
    accessSelect.innerHTML = `<option value="">Select an image you own...</option>`;
    transferSelect.innerHTML = `<option value="">Select an image you own...</option>`;

    for (const hash of owned) {
      const data = await contract.getImageData(hash);
      const shortHash = hash.slice(0, 10) + "..." + hash.slice(-6);
      const opt1 = new Option(`${data.name} (${shortHash})`, hash);
      const opt2 = new Option(`${data.name} (${shortHash})`, hash);
      accessSelect.appendChild(opt1);
      transferSelect.appendChild(opt2);
    }
  } catch (err) {
    console.error("Select refresh error:", err);
  }
}

// ============================================================
//  HELPERS
// ============================================================

function guessFileName(name) {
  return name.toLowerCase().replace(/\s+/g, "_") + ".png";
}

function resetRegisterForm() {
  document.getElementById("drop-zone").classList.remove("hidden");
  document.getElementById("image-preview-area").classList.add("hidden");
  document.getElementById("reg-name").value = "";
  document.getElementById("reg-desc").value = "";
  document.getElementById("register-btn").disabled = true;
  document.getElementById("image-input").value = "";
  pendingImageHash = null;
  pendingImageFile = null;
}

function parseError(err) {
  if (err.reason) return err.reason;
  if (err.data && err.data.message) return err.data.message;
  if (err.message && err.message.includes("user rejected")) return "Transaction rejected by user";
  if (err.message) {
    const match = err.message.match(/reverted with custom error '(\w+)\(/);
    if (match) return match[1];
  }
  return err.message || "Unknown error";
}

// ============================================================
//  TOAST NOTIFICATIONS
// ============================================================
function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;

  const icons = {
    success: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    error: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    info: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
  };

  toast.innerHTML = `${icons[type] || icons.info}<span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = "slideOut 0.3s ease forwards";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ============================================================
//  MODAL
// ============================================================
function showModal(title, msg) {
  document.getElementById("tx-modal-title").textContent = title;
  document.getElementById("tx-modal-msg").textContent = msg;
  document.getElementById("tx-modal-hash").classList.add("hidden");
  document.getElementById("tx-modal").classList.remove("hidden");
}

function hideModal() {
  document.getElementById("tx-modal").classList.add("hidden");
}
