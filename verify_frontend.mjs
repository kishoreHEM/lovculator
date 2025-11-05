// verify_frontend.mjs
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const frontendPath = path.resolve(__dirname, "frontend");
console.log("🧭 Checking frontend folder at:", frontendPath);

if (!fs.existsSync(frontendPath)) {
  console.error("❌ ERROR: 'frontend' folder does not exist in project root!");
  process.exit(1);
}

const files = fs.readdirSync(frontendPath);
console.log("📂 Found contents:", files);

if (files.length === 0) {
  console.error("⚠️ WARNING: Frontend folder exists but is empty!");
} else if (!files.includes("index.html")) {
  console.error("⚠️ WARNING: index.html not found in frontend/");
} else {
  console.log("✅ Frontend looks perfect for Railway deployment!");
}

// Check for .railwayignore
const ignoreFile = path.resolve(__dirname, ".railwayignore");
if (fs.existsSync(ignoreFile)) {
  const content = fs.readFileSync(ignoreFile, "utf-8");
  if (content.includes("frontend") && !content.includes("!frontend")) {
    console.warn("🚨 ALERT: '.railwayignore' might be excluding 'frontend' folder!");
  } else {
    console.log("✅ .railwayignore looks good — frontend will be uploaded.");
  }
} else {
  console.warn("⚠️ No .railwayignore file found (not critical, but recommended).");
}
