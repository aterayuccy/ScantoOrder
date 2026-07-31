const fs = require("fs");
const path = require("path");

const cors = require("cors");
const express = require("express");
const passport = require("passport");

const uploadsDirectory = require("./uploads");
const {
  errorHandler,
  notFoundHandler,
} = require("./middlewares/error-handler");

require("./config/passport")(passport);

const createApp = ({ serveClient = true } = {}) => {
  const app = express();
  const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);

  if (Number.isInteger(trustProxyHops) && trustProxyHops > 0) {
    app.set("trust proxy", trustProxyHops);
  }

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cors());
  app.use(passport.initialize());

  app.get("/health", (req, res) => {
    res.status(200).send({
      status: "healthy",
      uptime: process.uptime(),
    });
  });

  app.use("/uploads", express.static(uploadsDirectory));
  app.use("/api/user", require("./routes/auth"));
  app.use("/api/product", require("./routes/product-route"));
  app.use("/api/payment", require("./routes/payment-route"));
  app.use("/api/support", require("./routes/support-route"));
  app.use("/api/admin", require("./routes/platform-admin-route"));
  app.use("/api", notFoundHandler);

  if (serveClient) {
    const clientBuildPath = path.join(__dirname, "..", "client", "build");
    const clientIndexPath = path.join(clientBuildPath, "index.html");

    if (fs.existsSync(clientIndexPath)) {
      app.use(express.static(clientBuildPath));
      app.use((req, res, next) => {
        if (req.method !== "GET") return next();
        return res.sendFile(clientIndexPath);
      });
    }
  }

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};

module.exports = {
  createApp,
};
