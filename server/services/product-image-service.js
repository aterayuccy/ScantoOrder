const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const multer = require("multer");

const uploadsDirectory = require("../uploads");
const { ProductOptionError } = require("../product-options");

const allowedImageMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const allowedImageExtensions = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
]);

const storage = multer.diskStorage({
  destination(req, file, callback) {
    callback(null, uploadsDirectory);
  },
  filename(req, file, callback) {
    callback(
      null,
      `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${path
        .extname(file.originalname)
        .toLowerCase()}`
    );
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
  fileFilter(req, file, callback) {
    const extension = path.extname(file.originalname).toLowerCase();
    if (
      !allowedImageMimeTypes.has(file.mimetype) ||
      !allowedImageExtensions.has(extension)
    ) {
      return callback(new Error("圖片只接受 JPG、PNG、WEBP 或 GIF 格式"));
    }
    return callback(null, true);
  },
});

const uploadProductImage = (req, res, next) => {
  upload.single("image")(req, res, (error) => {
    if (!error) return next();
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).send("圖片大小不可超過 5 MB");
    }
    return res.status(400).send(error.message || "圖片上傳失敗");
  });
};

const removeUploadedFile = async (file) => {
  if (!file?.filename) return;
  await fs.promises
    .unlink(path.join(uploadsDirectory, file.filename))
    .catch(() => {});
};

const verifyUploadedImage = async (file) => {
  if (!file?.path) return;
  const handle = await fs.promises.open(file.path, "r");
  const header = Buffer.alloc(12);

  try {
    await handle.read(header, 0, header.length, 0);
  } finally {
    await handle.close();
  }

  const isJpeg = header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
  const isPng = header
    .subarray(0, 8)
    .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const signature = header.toString("ascii");
  const isGif =
    signature.startsWith("GIF87a") || signature.startsWith("GIF89a");
  const isWebp =
    signature.startsWith("RIFF") && signature.slice(8, 12) === "WEBP";

  if (!isJpeg && !isPng && !isGif && !isWebp) {
    throw new ProductOptionError("圖片內容不是有效的圖片格式");
  }
};

module.exports = {
  removeUploadedFile,
  uploadProductImage,
  verifyUploadedImage,
};
