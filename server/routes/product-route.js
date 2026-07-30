const router = require("express").Router();

const cartController = require("../controllers/cart-controller");
const orderController = require("../controllers/order-controller");
const productController = require("../controllers/product-controller");
const { authenticate, sellerOnly } = require("../middlewares/authorization");
const { uploadProductImage } = require("../services/product-image-service");

router.get("/", productController.listProducts);
router.get("/menu/:sellerId", authenticate, productController.getMenu);
router.get(
  "/seller/:sellerId",
  authenticate,
  sellerOnly,
  productController.getSellerProducts
);
router.get("/buyer/:buyerId", authenticate, productController.getBuyerProducts);
router.get(
  "/findByName/:name",
  authenticate,
  sellerOnly,
  productController.findByName
);

router.post(
  "/",
  authenticate,
  sellerOnly,
  uploadProductImage,
  productController.createProduct
);
router.post("/enroll/:_id", authenticate, cartController.enrollProduct);
router.patch(
  "/submitOrder",
  authenticate,
  orderController.deprecatedSubmitOrder
);
router.patch(
  "/cart/:productId/:lineItemId",
  authenticate,
  cartController.updateCartQuantity
);
router.delete(
  "/cart/:productId/:lineItemId",
  authenticate,
  cartController.removeCartItem
);
router.delete(
  "/sellerOrder/batch/:orderBatchId",
  authenticate,
  sellerOnly,
  orderController.completeOrderBatch
);
router.delete(
  "/sellerOrder/table/:tableNumber",
  authenticate,
  sellerOnly,
  orderController.completeTableOrder
);
router.delete(
  "/sellerOrder/:buyerId",
  authenticate,
  sellerOnly,
  orderController.completeBuyerOrder
);

router.get("/:_id", authenticate, sellerOnly, productController.getProduct);
router.patch(
  "/:_id",
  authenticate,
  sellerOnly,
  uploadProductImage,
  productController.updateProduct
);
router.delete(
  "/:_id",
  authenticate,
  sellerOnly,
  productController.deleteProduct
);

module.exports = router;
