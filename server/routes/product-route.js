const router = require("express").Router();
const Product = require("../models").product;
const productValidation = require("../validation").productValidation;
const passport = require("passport");
const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + ext);
  },
});

const upload = multer({ storage });

router.use((req,res,next)=>{
    console.log("product route正在接受請求");
    next();
});

router.get("/", async (req, res) => {
    try{
        let productFound = await Product.find({})    
        .populate("seller",["username"])
        .exec();
        return res.send(productFound);
    } catch (e) {
        return res.status(5000).send(e);
    }    
});


router.get("/seller/:_seller_id",  async(req, res) => {
    let {_seller_id} = req.params;
    let productFound = await Product.find({seller:_seller_id})
    .populate("seller",["username"])
    .exec();
    return res.send(productFound);
});

router.get("/buyer/:_buyer_id",async(req,res)=>{
    let{_buyer_id}=req.params;
    let productFound = await Product.find({"buyer.user":_buyer_id})
    .populate("seller",["username"])
    .exec();
    return res.send(productFound);

});

router.get("/findByName/:name",async(req,res)=>{
    let {name} =req.params;
    try{
        let productFound = await Product.find({title:name})
        .populate("seller",["username"])
        .exec();
        return res.send(productFound);
    } catch (e) {
        return res.status(500).send(e);
    }
});


router.get("/:_id",async(req,res)=>{
    let {_id} =req.params;
    try{
        let productFound = await Product.findOne({_id})
        .populate("seller",["username"])
        .populate({ path: "buyer.user", select: "username" })
        .exec();
        return res.send(productFound);
    } catch (e) {
        return res.status(500).send(e);
    }
});

router.post(
  "/",
  passport.authenticate("jwt", { session: false }),
  upload.single("image"),
  async (req, res) => {
    try {
      const body = req.body || {};
      const { title, description, price, type } = body;

      const { error } = productValidation(body);
      if (error) return res.status(400).send(error.details[0].message);

      if (req.user.isBuyer()) {
        return res.status(400).send("只有賣家才能發布新商品");
      }

      const newProduct = new Product({
        title,
        description: description || "",
        price,
        type,
        image: req.file ? req.file.filename : "",
        seller: req.user._id,
      });

      const savedProduct = await newProduct.save();
      return res.send({
        message: "新商品已經保存",
        savedProduct,
      });
    } catch (e) {
      console.log("post /api/product error:", e);
      return res.status(500).send("無法發布商品");
    }
  }
);

router.post(  "/enroll/:_id",  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    const { _id } = req.params;
    const quantity = Number(req.body.quantity || 1);
    const tableNumber = req.user.tableNumber || req.body.tableNumber || null;

    if (!Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).send("購買數量必須至少為 1");
    }

    try {
      const product = await Product.findOne({ _id }).exec();
      if (!product) return res.status(404).send("找不到商品");

      const existingBuyer = product.buyer.find((b) => {
        const buyerId = b.user ? b.user.toString() : b.toString(); 
        return buyerId === req.user._id.toString() && !b.submittedAt;
      });

      if (existingBuyer) {
        existingBuyer.quantity = (Number(existingBuyer.quantity) || 0) + quantity;        
        if (tableNumber) {
          existingBuyer.tableNumber = tableNumber;
        }
      } else {
        product.buyer.push({
          user: req.user._id,
          quantity,
          tableNumber,
        });
      }

      await product.save();
      return res.send({ message: "購買成功", product });
    } catch (e) {
      return res.status(500).send(e);
    }
  }
);

router.patch(
  "/submitOrder",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    try {
      const now = new Date();

      const products = await Product.find({ "buyer.user": req.user._id });

      for (const product of products) {
        const buyerItems = product.buyer.filter(
          (b) => b.user && b.user.toString() === req.user._id.toString() && !b.submittedAt
        );

        for (const buyerItem of buyerItems) {
          if (!buyerItem.tableNumber && req.user.tableNumber) {
            buyerItem.tableNumber = req.user.tableNumber;
          }
          buyerItem.submittedAt = now;
        }

        if (buyerItems.length > 0) {
          await product.save();
        }
      }

      return res.send({ message: "訂單已送出", submittedAt: now });
    } catch (e) {
      return res.status(500).send({ message: e.message });
    }
  }
);

router.patch("/:_id",passport.authenticate("jwt", { session: false }),upload.single("image"),async(req,res)=>{
    let{error}=productValidation(req.body);
    if (error) return res.status(400).send(error.details[0].message);

    let{_id}=req.params;
    try{
        let productFound = await Product.findOne({_id});
        if (!productFound) {
            return res.send("找不到商品，無法更新");      
            }        
        
        if (productFound.seller.equals(req.user._id)){
                const updateData = {
                    ...req.body,
                    description: req.body.description || "",
                };

                if (req.file) {
                    updateData.image = req.file.filename;
                }

                let updatedProduct=await Product.findOneAndUpdate({_id},updateData,{
                    new:true,
                    runValidators:true
                });
                return res.send({
                    message:"您的商品已被更新成功",
                    updatedProduct,
                })
                } else {
                    return res.status(403).send("只有此商品的賣家可以編輯商品");
                }
        } catch (e) {
        return res.status(500).send(e);
    }
})


router.delete("/:_id",passport.authenticate("jwt", { session: false }),async(req,res)=>{
     let{_id}=req.params;
    try{
        let productFound = await Product.findOne({_id});
        if (!productFound) {
            return res.send("找不到商品，無法刪除");      
            }       
        
        if (productFound.seller.equals(req.user._id)){
            await Product.deleteOne({_id}).exec();
            return res.send({
                message:"您的商品已被刪除",
            })

               
                } else {
                    return res.status(403).send("只有此商品的賣家可以刪除商品");
                }
        } catch (e) {
        return res.status(500).send(e);
    }
    
})
router.delete(
  "/unenroll/:_id",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    const { _id } = req.params;

    try {
      const product = await Product.findOne({ _id });
      if (!product) {
        return res.status(404).send("找不到商品");
      }

      product.buyer = product.buyer.filter((b) => {
        const buyerId = b.user ? b.user.toString() : b.toString();
        return buyerId !== req.user._id.toString() || b.submittedAt;
      });

      await product.save();
      return res.send("已刪除這項購買紀錄");
    } catch (e) {
      return res.status(500).send(e);
    }
  }


  
);


router.delete(
  "/sellerOrder/table/:tableNumber",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    const tableNumber = Number(req.params.tableNumber);

    if (!Number.isInteger(tableNumber) || tableNumber < 1) {
      return res.status(400).send("桌號不正確");
    }

    try {
      const result = await Product.updateMany(
        {
          seller: req.user._id,
          "buyer.tableNumber": tableNumber,
        },
        {
          $pull: {
            buyer: { tableNumber },
          },
        }
      );

      return res.send({
        message: "桌號訂單已刪除",
        result,
      });
    } catch (e) {
      return res.status(500).send(e);
    }
  }
);

router.delete(
  "/sellerOrder/:buyerId",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    const { buyerId } = req.params;

    try {
      const result = await Product.updateMany(
        {
          seller: req.user._id,
          "buyer.user": buyerId,
        },
        {
          $pull: {
            buyer: { user: buyerId },
          },
        }
      );

      return res.send({
        message: "該買家的訂單已刪除",
        result,
      });
    } catch (e) {
      return res.status(500).send(e);
    }
  }
);

router.patch(
  "/quantity/:_id",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    const { _id } = req.params;
    const quantity = Number(req.body.quantity);

    if (!Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).send("購買數量必須至少為 1");
    }

    try {
      const product = await Product.findOne({ _id });
      if (!product) {
        return res.status(404).send("找不到商品");
      }

      const existingBuyer = product.buyer.find((b) => {
        const buyerId = b.user ? b.user.toString() : b.toString();
        return buyerId === req.user._id.toString() && !b.submittedAt;
      });

      if (!existingBuyer) {
        return res.status(404).send("找不到此購買紀錄");
      }

      existingBuyer.quantity = quantity; // 這裡是覆蓋，不是累加
      await product.save();

      return res.send({
        message: "購買數量已更新",
        product,
      });
    } catch (e) {
      return res.status(500).send(e);
    }
  }
);



module.exports = router;
