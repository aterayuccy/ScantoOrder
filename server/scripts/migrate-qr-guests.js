const path = require("path");

const dotenv = require("dotenv");
const mongoose = require("mongoose");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const User = require("../models/user-model");
const { getGuestTtlMs } = require("../services/qr-guest-service");

const migrateQrGuests = async () => {
  const mongoUri =
    process.env.MONGODB_URI || "mongodb://localhost:27017/mernDB";
  const ttlMs = getGuestTtlMs();

  await mongoose.connect(mongoUri);
  const result = await User.updateMany(
    {
      role: "buyer",
      username: /^guest_/,
      guestExpiresAt: { $exists: false },
    },
    [
      {
        $set: {
          guestExpiresAt: {
            $add: [{ $ifNull: ["$updatedAt", "$createdAt"] }, ttlMs],
          },
          lastSeenAt: { $ifNull: ["$updatedAt", "$createdAt"] },
        },
      },
    ]
  );

  console.log(
    `QR guest migration complete: ${result.modifiedCount} account(s) updated`
  );
};

migrateQrGuests()
  .catch((error) => {
    console.error("QR guest migration failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
