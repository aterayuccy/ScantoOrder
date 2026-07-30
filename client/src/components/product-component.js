import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ProductService, {
  getProductImageUrl,
} from "../services/product.service";

const getPendingBuyerItem = (product, buyerId) => {
  return (product.buyer || []).find((b) => {
    const id =
      b.user && b.user._id
        ? b.user._id.toString()
        : b.user
          ? b.user.toString()
          : "";

    return id === buyerId && !b.submittedAt;
  });
};

const formatOrderTime = (value) => {
  if (!value) return "";

  return new Date(value).toLocaleString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
};

const ProductComponent = ({ currentUser }) => {
  const navigate = useNavigate();
  const [productData, setProductData] = useState([]);
  const [quantities, setQuantities] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser?.user) {
      setLoading(false);
      return;
    }

    const buyerId = currentUser.user._id;

    ProductService.getEnrolledProduct(buyerId)
      .then((data) => {
        const pendingProducts = [];
        const initialQuantities = {};

        data.data.forEach((product) => {
          const pendingBuyerItem = getPendingBuyerItem(product, buyerId);
          if (!pendingBuyerItem) return;

          pendingProducts.push(product);
          initialQuantities[product._id] = Number(
            pendingBuyerItem.quantity || 1
          );
        });

        setProductData(pendingProducts);
        setQuantities(initialQuantities);
        setLoading(false);
      })
      .catch((e) => {
        console.log(e);
        setLoading(false);
      });
  }, [currentUser]);

  const handleTakeToLogin = () => {
    navigate("/login");
  };

  const handleQuantityChange = (e, productId) => {
    const value = Math.max(1, Number(e.target.value) || 1);

    setQuantities((prev) => ({
      ...prev,
      [productId]: value,
    }));
  };

  const handleDeleteOrder = (productId) => {
    if (!window.confirm("確定要刪除這個餐點嗎？")) return;

    ProductService.deleteEnrolledProduct(productId)
      .then(() => {
        window.alert("刪除成功");
        setProductData((prev) => prev.filter((p) => p._id !== productId));
      })
      .catch((e) => {
        console.log(e);
        window.alert("刪除失敗");
      });
  };

  const submit = async () => {
    try {
      if (!productData || productData.length === 0) {
        navigate("/submit");
        return;
      }

      const orderSnapshot = productData.map((product) => ({
        _id: product._id,
        title: product.title,
        price: Number(product.price || 0),
        quantity: Number(quantities[product._id] || 1),
      }));

      const totalAmount = orderSnapshot.reduce((sum, item) => {
        return sum + item.price * item.quantity;
      }, 0);

      await Promise.all(
        productData.map((product) =>
          ProductService.updateEnrolledQuantity(
            product._id,
            Number(quantities[product._id] || 1)
          )
        )
      );

      const res = await ProductService.submitOrder();
      const orderTime = formatOrderTime(res.data.submittedAt);

      sessionStorage.setItem(
        "submittedOrder",
        JSON.stringify({
          orderData: orderSnapshot,
          totalAmount,
          orderTime,
        })
      );

      navigate("/submit");
    } catch (e) {
      console.log(e);
      window.alert("送出訂單失敗");
    }
  };

  if (!currentUser) {
    return (
      <div className="product-page">
        <p>請先登入</p>
        <button className="btn btn-primary btn-lg" onClick={handleTakeToLogin}>
          前往登入頁面
        </button>
      </div>
    );
  }

  if (loading) {
    return <div className="product-page">載入中...</div>;
  }

  return (
    <div className="product-page">
      {productData.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap" }}>
          {productData.map((product) => (
            <div
              key={product._id}
              className="card product-card"
              style={{ width: "80rem", margin: "0 auto", marginTop: "1rem" }}
            >
              <div className="card-body">
                <div
                  className="product-card-layout"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "stretch",
                    gap: "1.5rem",
                  }}
                >
                  <div
                    className="product-info-column"
                    style={{
                      width: "22rem",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                    }}
                  >
                    <p className="card-text" style={{ marginBottom: "1rem" }}>
                      餐點名稱: {product.title}
                    </p>

                    <p style={{ marginBottom: "1rem" }}>
                      餐點價格: {product.price}
                    </p>

                    <div
                      className="input-group"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                      }}
                    >
                      <p style={{ margin: 0, whiteSpace: "nowrap" }}>
                        購買數量:
                      </p>
                      <input
                        type="number"
                        min="1"
                        className="form-control"
                        value={quantities[product._id] || 1}
                        style={{ maxWidth: "5rem" }}
                        onChange={(e) => handleQuantityChange(e, product._id)}
                      />
                    </div>
                  </div>

                  <div
                    className="product-action-column"
                    style={{
                      flex: 1,
                      display: "flex",
                    }}
                  >
                    <button
                      className="btn btn-danger"
                      onClick={() => handleDeleteOrder(product._id)}
                      style={{ minWidth: "8rem", height: "2.4rem" }}
                    >
                      刪除餐點
                    </button>
                  </div>

                  <div
                    className="product-image-wrap"
                    style={{ width: "20rem", flexShrink: 0 }}
                  >
                    {product.image && (
                      <img
                        className="product-image"
                        src={getProductImageUrl(product.image)}
                        alt={product.title}
                        style={{
                          width: "100%",
                          height: "10rem",
                          objectFit: "cover",
                          borderRadius: "0.5rem",
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {productData.length > 0 && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginTop: "2rem",
          }}
        >
          <button
            style={{ minWidth: "8rem" }}
            className="btn btn-primary"
            onClick={submit}
          >
            送出訂單
          </button>
        </div>
      )}
    </div>
  );
};

export default ProductComponent;
