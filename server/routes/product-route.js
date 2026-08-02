const router = require("express").Router();

const cartController = require("../controllers/cart-controller");
const orderController = require("../controllers/order-controller");
const productController = require("../controllers/product-controller");
const { authenticate, sellerOnly } = require("../middlewares/authorization");
const { activeStoreOnly } = require("../middlewares/subscription-access");
const { uploadProductImage } = require("../services/product-image-service");

router.get("/", productController.listProducts);
router.use(authenticate, activeStoreOnly);

router.get("/menu/:sellerId", productController.getMenu);
router.get(
  "/seller/:sellerId",
  sellerOnly,
  productController.getSellerProducts
);
router.get("/buyer/:buyerId", productController.getBuyerProducts);
router.get("/findByName/:name", sellerOnly, productController.findByName);

router.post(
  "/",
  sellerOnly,
  uploadProductImage,
  productController.createProduct
);
router.post("/enroll/:_id", cartController.enrollProduct);
router.patch("/submitOrder", orderController.deprecatedSubmitOrder);
router.patch("/cart/:productId/:lineItemId", cartController.updateCartQuantity);
router.delete("/cart/:productId/:lineItemId", cartController.removeCartItem);
router.delete(
  "/sellerOrder/batch/:orderBatchId",
  sellerOnly,
  orderController.completeOrderBatch
);
router.delete(
  "/sellerOrder/table/:tableNumber",
  sellerOnly,
  orderController.completeTableOrder
);
router.delete(
  "/sellerOrder/:buyerId",
  sellerOnly,
  orderController.completeBuyerOrder
);

router.get("/:_id", sellerOnly, productController.getProduct);
router.patch(
  "/:_id/availability",
  sellerOnly,
  productController.updateProductAvailability
);
router.patch(
  "/:_id",
  sellerOnly,
  uploadProductImage,
  productController.updateProduct
);
router.delete("/:_id", sellerOnly, productController.deleteProduct);

module.exports = router;
