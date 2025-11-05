// verify_railway_files.mjs
import fs from "fs";
import path from "path";

console.log("📦 Checking all top-level folders in Railway container...");

const root = "/";
const entries = fs.readdirSync(root);

console.log("🧭 Root folders:", entries);

const appPath = "/app";
if (fs.existsSync(appPath)) {
  console.log("📂 /app contents:", fs.readdirSync(appPath));
}

const frontendPath = "/app/frontend";
if (fs.existsSync(frontendPath)) {
  console.log("✅ /app/frontend exists. Files:");
  console.log(fs.readdirSync(frontendPath));
} else {
  console.log("❌ /app/frontend folder is missing!");
}
