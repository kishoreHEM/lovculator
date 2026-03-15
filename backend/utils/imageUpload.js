import fs from "fs";
import path from "path";
import sharp from "sharp";

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function sanitizePrefix(prefix = "image") {
  return String(prefix).replace(/[^a-z0-9_-]/gi, "").toLowerCase() || "image";
}

export function imageFileFilter(req, file, cb) {
  if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
    return cb(new Error("Only JPG, PNG, or WebP images are allowed"));
  }
  cb(null, true);
}

export async function optimizeImageUpload(file, { outputDir, urlBasePath, prefix = "image", maxWidth = 800, quality = 55 }) {
  if (!file?.buffer) {
    throw new Error("Image buffer missing");
  }

  ensureDir(outputDir);

  const safePrefix = sanitizePrefix(prefix);
  const filename = `${safePrefix}-${Date.now()}-${Math.round(Math.random() * 1e9)}.avif`;
  const outputPath = path.join(outputDir, filename);

  const image = sharp(file.buffer, { failOnError: false }).rotate();
  const metadata = await image.metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error("Invalid image file");
  }

  const pipeline = image.resize({
    width: Math.min(metadata.width, maxWidth),
    withoutEnlargement: true
  });

  await pipeline
    .avif({
      quality,
      effort: 4
    })
    .toFile(outputPath);

  return {
    filename,
    path: outputPath,
    url: `${urlBasePath}/${filename}`
  };
}

export async function optimizeManyImageUploads(files, optionsFactory) {
  const uploads = Array.isArray(files) ? files : [];
  const results = [];

  for (const [index, file] of uploads.entries()) {
    const options = typeof optionsFactory === "function" ? optionsFactory(file, index) : optionsFactory;
    results.push(await optimizeImageUpload(file, options));
  }

  return results;
}
