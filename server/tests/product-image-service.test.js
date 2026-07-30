const {
  getCloudinaryConfiguration,
  getImageStorageProvider,
  ImageStorageError,
} = require("../services/product-image-service");

describe("product image storage configuration", () => {
  test("uses local storage by default", () => {
    expect(getImageStorageProvider({})).toBe("local");
  });

  test("rejects an unknown storage provider", () => {
    expect(() =>
      getImageStorageProvider({ IMAGE_STORAGE_PROVIDER: "unknown" })
    ).toThrow(ImageStorageError);
  });

  test("reads Cloudinary credentials from CLOUDINARY_URL", () => {
    expect(
      getCloudinaryConfiguration({
        CLOUDINARY_URL: "cloudinary://api-key:api-secret@demo-cloud",
      })
    ).toEqual({
      apiKey: "api-key",
      apiSecret: "api-secret",
      cloudName: "demo-cloud",
    });
  });

  test("requires complete Cloudinary credentials", () => {
    expect(() =>
      getCloudinaryConfiguration({ CLOUDINARY_CLOUD_NAME: "demo-cloud" })
    ).toThrow(ImageStorageError);
  });
});
