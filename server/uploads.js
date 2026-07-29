const fs = require("fs");
const path = require("path");

const uploadsDirectory =
  process.env.UPLOADS_DIR || path.join(__dirname, "uploads");

fs.mkdirSync(uploadsDirectory, { recursive: true });

module.exports = uploadsDirectory;
