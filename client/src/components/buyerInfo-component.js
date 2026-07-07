import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import ProductService from "../services/product.service";

const BuyerInfoComponent = () => {
  const { productId } = useParams();
  const [product, setProduct] = useState(null);

  useEffect(() => {
    ProductService.getProductById(productId)
      .then((res) => setProduct(res.data))
      .catch((e) => console.log(e));
  }, [productId]);

  if (!product) return <div style={{ padding: "3rem" }}>載入中...</div>;
  return (
  <div style={{ padding: "3rem" }}>

    <div style={{ display: "flex", flexWrap: "wrap" }}>
      {product.buyer && product.buyer.length > 0 ? (
        product.buyer.map((b, idx) => {
          const u = b.user;
          const buyerName = typeof u === "string" ? u : u?._id || "未知買家";
          const buyerUsername = typeof u === "string" ? "（未載入姓名）" : u?.username;

          return (
            <div
              key={(typeof u === "string" ? u : u?._id) || idx}
              className="card"
              style={{ margin: "1rem" ,width: "20rem" }}
            >
              <div className="card-body">
                <p style={{ margin: "0.1rem 0rem" }}>買家姓名:{buyerUsername}</p>
                <p style={{ margin: "0.5rem 0rem" }}>買家ID:{buyerName}</p>
                <p style={{ margin: "0rem 0rem" }}>購買數量:{Number(b.quantity) || 0}</p>
              </div>
            </div>
          );
        })
      ) : (
        <div>尚無買家</div>
      )}









    </div>




  </div>
);
  
};

export default BuyerInfoComponent;