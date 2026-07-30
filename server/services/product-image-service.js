const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const multer = require("multer");

const uploadsDirectory = require("../uploads");
const { ProductOptionError } = require("../product-options");

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const CLOUDINARY_FOLDER = "scan-to-order";
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

class ImageStorageError extends Error {
  constructor(message = "圖片儲存服務暫時無法使用") {
    super(message);
    this.name = "ImageStorageError";
    this.statusCode = 503;
    this.publicMessage = message;
  }
}

const getImageStorageProvider = (environment = process.env) => {
  const provider = String(
    environment.IMAGE_STORAGE_PROVIDER || "local"
  ).toLowerCase();

  if (!["local", "cloudinary"].includes(provider)) {
    throw new ImageStorageError("IMAGE_STORAGE_PROVIDER 設定不正確");
  }

  return provider;
};

const buildLocalStorage = () =>
  multer.diskStorage({
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
  storage:
    getImageStorageProvider() === "cloudinary"
      ? multer.memoryStorage()
      : buildLocalStorage(),
  limits: {
    fileSize: MAX_IMAGE_SIZE,
    files: 1,
  },
  fileFilter(req, file, callback) {
    const extension = path.extname(file.originalname).toLowerCase();
    if (
      !allowedImageMimeTypes.has(file.mimetype) ||
      !allowedImageExtensions.has(extension)
    ) {
      return callback(new Error("圖片僅支援 JPG、PNG、WEBP 或 GIF 格式"));
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

const getUploadedBuffer = async (file) => {
  if (file?.buffer) return file.buffer;
  if (file?.path) return fs.promises.readFile(file.path);
  return null;
};

const verifyUploadedImage = async (file) => {
  const content = await getUploadedBuffer(file);
  if (!content) return;

  const header = content.subarray(0, 12);
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
    throw new ProductOptionError("圖片內容與支援的圖片格式不符");
  }
};

const getCloudinaryConfiguration = (environment = process.env) => {
  let cloudName = String(environment.CLOUDINARY_CLOUD_NAME || "").trim();
  let apiKey = String(environment.CLOUDINARY_API_KEY || "").trim();
  let apiSecret = String(environment.CLOUDINARY_API_SECRET || "").trim();

  const cloudinaryUrl = String(environment.CLOUDINARY_URL || "").trim();
  if (cloudinaryUrl) {
    try {
      const parsed = new URL(cloudinaryUrl);
      cloudName = parsed.hostname;
      apiKey = decodeURIComponent(parsed.username);
      apiSecret = decodeURIComponent(parsed.password);
    } catch (_error) {
      throw new ImageStorageError("CLOUDINARY_URL 格式不正確");
    }
  }

  if (!cloudName || !apiKey || !apiSecret) {
    throw new ImageStorageError("Cloudinary 金鑰尚未完整設定");
  }

  return { apiKey, apiSecret, cloudName };
};

const signCloudinaryParameters = (parameters, apiSecret) => {
  const serialized = Object.entries(parameters)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  return crypto
    .createHash("sha1")
    .update(`${serialized}${apiSecret}`)
    .digest("hex");
};

const callCloudinary = async (action, fields, environment = process.env) => {
  const { apiKey, apiSecret, cloudName } =
    getCloudinaryConfiguration(environment);
  const timestamp = Math.floor(Date.now() / 1000);
  const signedFields = { ...fields, timestamp };
  const form = new globalThis.FormData();

  Object.entries(signedFields).forEach(([key, value]) => {
    form.append(key, String(value));
  });
  form.append("api_key", apiKey);
  form.append("signature", signCloudinaryParameters(signedFields, apiSecret));

  let response;
  try {
    response = await globalThis.fetch(
      `https://api.cloudinary.com/v1_1/${encodeURIComponent(
        cloudName
      )}/image/${action}`,
      {
        method: "POST",
        body: form,
        signal: globalThis.AbortSignal.timeout(15000),
      }
    );
  } catch (error) {
    console.error("Cloudinary request failed:", error.message);
    throw new ImageStorageError();
  }

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error(
      "Cloudinary rejected image request:",
      result?.error?.message || response.status
    );
    throw new ImageStorageError();
  }

  return result;
};

const uploadToCloudinary = async (file, environment = process.env) => {
  const content = await getUploadedBuffer(file);
  const fields = {
    folder: String(environment.CLOUDINARY_FOLDER || CLOUDINARY_FOLDER),
  };
  const { apiKey, apiSecret, cloudName } =
    getCloudinaryConfiguration(environment);
  const timestamp = Math.floor(Date.now() / 1000);
  const form = new globalThis.FormData();

  form.append(
    "file",
    new globalThis.Blob([content], { type: file.mimetype }),
    file.originalname
  );
  form.append("folder", fields.folder);
  form.append("timestamp", String(timestamp));
  form.append("api_key", apiKey);
  form.append(
    "signature",
    signCloudinaryParameters({ ...fields, timestamp }, apiSecret)
  );

  let response;
  try {
    response = await globalThis.fetch(
      `https://api.cloudinary.com/v1_1/${encodeURIComponent(
        cloudName
      )}/image/upload`,
      {
        method: "POST",
        body: form,
        signal: globalThis.AbortSignal.timeout(15000),
      }
    );
  } catch (error) {
    console.error("Cloudinary upload failed:", error.message);
    throw new ImageStorageError();
  }

  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.secure_url || !result.public_id) {
    console.error(
      "Cloudinary rejected image upload:",
      result?.error?.message || response.status
    );
    throw new ImageStorageError();
  }

  return {
    image: result.secure_url,
    imagePublicId: result.public_id,
    imageStorage: "cloudinary",
  };
};

const storeUploadedImage = async (file, environment = process.env) => {
  if (!file) {
    return { image: "", imagePublicId: "", imageStorage: "local" };
  }

  if (getImageStorageProvider(environment) === "cloudinary") {
    return uploadToCloudinary(file, environment);
  }

  return {
    image: file.filename,
    imagePublicId: "",
    imageStorage: "local",
  };
};

const removeUploadedFile = async (file) => {
  if (!file?.filename) return;
  await fs.promises
    .unlink(path.join(uploadsDirectory, path.basename(file.filename)))
    .catch(() => {});
};

const deleteStoredImage = async (storedImage, environment = process.env) => {
  if (!storedImage?.image) return;

  if (storedImage.imageStorage === "cloudinary" && storedImage.imagePublicId) {
    await callCloudinary(
      "destroy",
      { public_id: storedImage.imagePublicId },
      environment
    ).catch((error) => {
      console.error("Cloudinary image cleanup failed:", error.message);
    });
    return;
  }

  if (!/^https?:\/\//i.test(storedImage.image)) {
    await fs.promises
      .unlink(path.join(uploadsDirectory, path.basename(storedImage.image)))
      .catch(() => {});
  }
};

module.exports = {
  deleteStoredImage,
  getCloudinaryConfiguration,
  getImageStorageProvider,
  ImageStorageError,
  removeUploadedFile,
  storeUploadedImage,
  uploadProductImage,
  verifyUploadedImage,
};
