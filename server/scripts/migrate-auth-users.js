const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const User = require("../models/user-model");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/mernDB";

const migrateAuthUsers = async () => {
  await mongoose.connect(mongoUri);

  const duplicateUsernames = await User.collection
    .aggregate([
      {
        $group: {
          _id: { $toLower: { $trim: { input: "$username" } } },
          count: { $sum: 1 },
        },
      },
      { $match: { count: { $gt: 1 } } },
    ])
    .toArray();

  if (duplicateUsernames.length > 0) {
    throw new Error("偵測到重複的使用者名稱，請先處理後再執行遷移");
  }

  const emailCleanupResult = await User.collection.updateMany(
    { email: { $exists: true } },
    { $unset: { email: "" } }
  );

  await User.createIndexes();

  console.log(
    `帳號資料遷移完成：移除 ${emailCleanupResult.modifiedCount} 筆信箱資料，並建立唯一使用者名稱索引`
  );
};

migrateAuthUsers()
  .catch((error) => {
    console.error("帳號資料遷移失敗：", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
