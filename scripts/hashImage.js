/**
 * Image Hashing Utility
 * Generates SHA-256 hashes for image files.
 *
 * Usage:
 *   node scripts/hashImage.js <path-to-image>
 *   node scripts/hashImage.js --all
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function hashFile(filePath) {
  const absolutePath = path.resolve(filePath);
  if (!fs.existsSync(absolutePath)) {
    console.error(`File not found: ${absolutePath}`);
    process.exit(1);
  }
  const fileBuffer = fs.readFileSync(absolutePath);
  const hash = crypto.createHash("sha256").update(fileBuffer).digest("hex");
  return `0x${hash}`;
}

function hashAllImages() {
  const imagesDir = path.join(__dirname, "..", "images");
  if (!fs.existsSync(imagesDir)) { console.error("No images dir"); process.exit(1); }

  const files = fs.readdirSync(imagesDir).filter((f) => {
    const ext = path.extname(f).toLowerCase();
    return [".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp"].includes(ext);
  });

  if (files.length === 0) { console.log("No images found."); return; }

  console.log("\n Image Hash Registry");
  console.log("=".repeat(80));
  const results = [];
  for (const file of files) {
    const filePath = path.join(imagesDir, file);
    const hash = hashFile(filePath);
    const stats = fs.statSync(filePath);
    const sizeKB = (stats.size / 1024).toFixed(1);
    results.push({ file, hash, sizeKB });
    console.log(`  ${file}`);
    console.log(`   Hash:  ${hash}`);
    console.log(`   Size:  ${sizeKB} KB\n`);
  }
  console.log("=".repeat(80));
  console.log(`Hashed ${results.length} image(s)\n`);

  const hashMapPath = path.join(__dirname, "..", "image-hashes.json");
  const hashMap = {};
  for (const r of results) hashMap[r.file] = r.hash;
  fs.writeFileSync(hashMapPath, JSON.stringify(hashMap, null, 2));
  console.log(`Hash map saved to: image-hashes.json\n`);
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.log("Usage:\n  node scripts/hashImage.js <path>\n  node scripts/hashImage.js --all");
  process.exit(0);
}
if (args[0] === "--all") { hashAllImages(); }
else {
  const hash = hashFile(args[0]);
  console.log(`\nFile: ${path.basename(args[0])}\nHash: ${hash}\n`);
}
