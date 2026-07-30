const Product = require("../models/product-model");
const {
  buildProductFields,
  buildProductUpdateFields,
} = require("../services/product-input-service");
const {
  deleteStoredImage,
  removeUploadedFile,
  storeUploadedImage,
  verifyUploadedImage,
} = require("../services/product-image-service");
const { requireSeller, sameId } = require("../middlewares/authorization");

const listProducts = async (req, res, next) => {
  try {
    const products = await Product.find({})
      .select("-buyer")
      .populate("seller", ["username"])
      .exec();
    return res.send(products);
  } catch (error) {
    return next(error);
  }
};

const getMenu = async (req, res, next) => {
  const { sellerId } = req.params;

  try {
    const isOwnSellerMenu =
      req.user?.isSeller?.() && sameId(req.user._id, sellerId);
    const isAuthorizedBuyer =
      req.user?.isBuyer?.() && sameId(req.user.qrSeller, sellerId);

    if (!isOwnSellerMenu && !isAuthorizedBuyer) {
      return res.status(403).send("無法存取其他店家的菜單");
    }

    const products = await Product.find({ seller: sellerId })
      .select("-buyer")
      .populate("seller", ["username"])
      .exec();
    return res.send(products);
  } catch (error) {
    return next(error);
  }
};

const getSellerProducts = async (req, res, next) => {
  const { sellerId } = req.params;

  try {
    if (!requireSeller(req, res)) return;
    if (!sameId(req.user._id, sellerId)) {
      return res.status(403).send("無法存取其他店家的資料");
    }

    const products = await Product.find({ seller: sellerId })
      .populate("seller", ["username"])
      .populate({ path: "buyer.user", select: "username" })
      .exec();
    return res.send(products);
  } catch (error) {
    return next(error);
  }
};

const getBuyerProducts = async (req, res, next) => {
  const { buyerId } = req.params;

  try {
    if (!req.user?.isBuyer?.() || !sameId(req.user._id, buyerId)) {
      return res.status(403).send("只能查看自己的購物車");
    }

    const products = await Product.find({ "buyer.user": req.user._id })
      .populate("seller", ["username"])
      .lean()
      .exec();
    const ownProducts = products.map((product) => ({
      ...product,
      buyer: (product.buyer || []).filter((buyerItem) =>
        sameId(buyerItem.user, req.user._id)
      ),
    }));

    return res.send(ownProducts);
  } catch (error) {
    return next(error);
  }
};

const findByName = async (req, res, next) => {
  try {
    const products = await Product.find({
      seller: req.user._id,
      title: req.params.name,
    })
      .select("-buyer")
      .populate("seller", ["username"])
      .exec();
    return res.send(products);
  } catch (error) {
    return next(error);
  }
};

const getProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params._id)
      .populate("seller", ["username"])
      .populate({ path: "buyer.user", select: "username" })
      .exec();

    if (!product) return res.status(404).send("找不到品項");
    if (!sameId(product.seller?._id || product.seller, req.user._id)) {
      return res.status(403).send("無法存取其他店家的品項");
    }
    return res.send(product);
  } catch (error) {
    return next(error);
  }
};

const createProduct = async (req, res, next) => {
  let storedImage;
  try {
    await verifyUploadedImage(req.file);
    storedImage = await storeUploadedImage(req.file);
    const product = await Product.create({
      ...buildProductFields(req.body || {}),
      ...storedImage,
      seller: req.user._id,
    });
    return res.send({
      message: "品項新增成功",
      savedProduct: product,
    });
  } catch (error) {
    if (storedImage?.image) {
      await deleteStoredImage(storedImage);
    } else {
      await removeUploadedFile(req.file);
    }
    return next(error);
  }
};

const updateProduct = async (req, res, next) => {
  let storedImage;
  try {
    await verifyUploadedImage(req.file);
    const product = await Product.findById(req.params._id).select(
      "+imagePublicId"
    );
    if (!product) return res.status(404).send("找不到品項");
    if (!sameId(product.seller, req.user._id)) {
      return res.status(403).send("無法修改其他店家的品項");
    }

    Object.assign(product, buildProductUpdateFields(req.body || {}, product));
    const previousImage = {
      image: product.image,
      imagePublicId: product.imagePublicId,
      imageStorage: product.imageStorage,
    };
    if (req.file) {
      storedImage = await storeUploadedImage(req.file);
      Object.assign(product, storedImage);
    }
    await product.save();
    if (storedImage?.image) {
      await deleteStoredImage(previousImage);
    }

    return res.send({
      message: "品項修改成功",
      updatedProduct: product,
    });
  } catch (error) {
    if (storedImage?.image) {
      await deleteStoredImage(storedImage);
    } else {
      await removeUploadedFile(req.file);
    }
    return next(error);
  }
};

const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params._id).select(
      "+imagePublicId"
    );
    if (!product) return res.status(404).send("找不到品項");
    if (!sameId(product.seller, req.user._id)) {
      return res.status(403).send("無法刪除其他店家的品項");
    }
    if ((product.buyer || []).some((item) => item.submittedAt)) {
      return res
        .status(409)
        .send("此品項仍有店家訂單紀錄，完成相關訂單後才能刪除");
    }

    await product.deleteOne();
    await deleteStoredImage(product);
    return res.send({ message: "品項刪除成功" });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createProduct,
  deleteProduct,
  findByName,
  getBuyerProducts,
  getMenu,
  getProduct,
  getSellerProducts,
  listProducts,
  updateProduct,
};
