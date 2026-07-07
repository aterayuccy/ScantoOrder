import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ProductService from "../services/product.service";

const ModifyProductComponent = ({ currentUser }) => {
  const { productId } = useParams();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState("");
  const [image, setImage] = useState("");

  const handleTakeToLogin = () => {
    navigate("/login");
  };
  const handleChangeImage = (e) => {
  setImage(e.target.files[0]);
};
  const toText = (data, fallback = "發生錯誤") => {
    if (data == null) return fallback;
    if (typeof data === "string") return data;
    if (typeof data === "number" || typeof data === "boolean") {
      return String(data);
    }
    if (data.message && typeof data.message === "string") {
      return data.message;
    }
    try {
      return JSON.stringify(data);
    } catch (e) {
      return fallback;
    }
  };

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    if (currentUser.user.role !== "seller") {
      setMessage("只有賣家可以修改商品");
      setLoading(false);
      return;
    }

    ProductService.getProductById(productId)
      .then((res) => {
        const product = res.data || {};
        setTitle(product.title || "");
        setDescription(product.description || "");
        setPrice(product.price ?? "");
        setLoading(false);
        setType(product.type || "");
      })
      .catch((error) => {
        console.log(error?.response || error);
        setMessage(toText(error?.response?.data, "讀取商品失敗"));
        setLoading(false);
      });
  }, [currentUser, productId]);

  const saveProduct = () => {
    setMessage("");

    ProductService.updateProductWithImage(
      productId,
      title,
      description,
      Number(price),
      type,
      image
    )
      .then(() => {
        window.alert("已儲存修改");
        navigate("/myProduct");
      })
      .catch((error) => {
        console.log(error?.response || error);
        setMessage(toText(error?.response?.data, "儲存失敗"));
      });
  };

  return (
    <div style={{ padding: "3rem" }}>
      {!currentUser && (
        <div>
          <p>在修改商品之前，您必須先登入。</p>
          <button
            className="btn btn-primary btn-lg"
            onClick={handleTakeToLogin}
          >
            帶我進入登入頁面
          </button>
        </div>
      )}

      {currentUser && currentUser.user.role === "seller" && (
        <div className="form-group">

          {loading ? (
            <div>載入中...</div>
          ) : (
            <>
              <label htmlFor="exampleforTitle">商品標題：</label>
              <input
                name="title"
                type="text"
                className="form-control"
                id="exampleforTitle"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <br />

              <label htmlFor="exampleforContent">內容：</label>
              <textarea
                className="form-control"
                id="exampleforContent"
                name="content"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <br />

              <label htmlFor="exampleforPrice">價格：</label>
              <input
                name="price"
                type="number"
                className="form-control"
                id="exampleforPrice"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
              <br />
              <label htmlFor="exampleforType">分類：</label>
              <input
                name="type"
                type="text"
                className="form-control"
                id="exampleforType"
                value={type}
                onChange={(e) => setType(e.target.value)}
              />
              <br />
              <label htmlFor="exampleforImage">商品圖片：</label>
              <input
                name="image"
                type="file"
                className="form-control"
                id="exampleforImage"
                accept="image/*"
                onChange={handleChangeImage}
              />
              <br />
              <button className="btn btn-primary" onClick={saveProduct}>
                儲存
              </button>

              <br />
              <br />

              {message && (
                <div className="alert alert-warning" role="alert">
                  {typeof message === "string"
                    ? message
                    : JSON.stringify(message)}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {currentUser && currentUser.user.role !== "seller" && (
        <div className="alert alert-warning" role="alert">
          {typeof message === "string"
            ? message || "只有賣家可以修改商品"
            : JSON.stringify(message)}
        </div>
      )}
    </div>
  );
};

export default ModifyProductComponent;
