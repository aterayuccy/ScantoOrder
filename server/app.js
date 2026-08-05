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

const getAllowedOrigins = (environment = process.env) => {
  const configuredOrigins = [
    environment.CLIENT_BASE_URL,
    ...(String(environment.CORS_ALLOWED_ORIGINS || "").split(",")),
  ];

  return new Set(
    configuredOrigins
      .map((origin) => String(origin || "").trim())
      .filter(Boolean)
      .map((origin) => {
        try {
          return new URL(origin).origin;
        } catch {
          return "";
        }
      })
      .filter(Boolean)
  );
};

const setSecurityHeaders = (req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );

  if (process.env.NODE_ENV === "production") {
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' https://api-pay.line.me https://sandbox-api-pay.line.me; upgrade-insecure-requests"
    );
  }

  next();
};

const createApp = ({ serveClient = true } = {}) => {
  const app = express();
  const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);
  const allowedOrigins = getAllowedOrigins();

  if (Number.isInteger(trustProxyHops) && trustProxyHops > 0) {
    app.set("trust proxy", trustProxyHops);
  }

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(setSecurityHeaders);
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || process.env.NODE_ENV !== "production") {
          return callback(null, true);
        }
        return callback(null, allowedOrigins.has(origin));
      },
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    })
  );
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
