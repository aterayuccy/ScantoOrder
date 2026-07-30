const path = require("path");

const dotenv = require("dotenv");
const mongoose = require("mongoose");

dotenv.config({ path: path.join(__dirname, ".env") });

const { createApp } = require("./app");
const Payment = require("./models/payment-model");
const User = require("./models/user-model");

const port = Number(process.env.PORT || 8080);

const startServer = async () => {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/mernDB"
    );
    await Promise.all([User.init(), Payment.init()]);
    console.log("MongoDB connection ready");

    const app = createApp();
    return app.listen(port, () => {
      console.log(`Server listening on port ${port}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error);
    process.exitCode = 1;
    return null;
  }
};

if (require.main === module) {
  startServer();
}

module.exports = {
  startServer,
};
