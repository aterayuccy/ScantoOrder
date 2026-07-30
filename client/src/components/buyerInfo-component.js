import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import ProductService from "../services/product.service";
import ProductSelectionSummary from "./product-selection-summary";

const BuyerInfoComponent = () => {
  const { productId } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    ProductService.getProductById(productId)
      .then((response) => {
        if (active) setProduct(response.data);
      })
      .catch((error) => {
        console.error(error);
        if (active) {
          setMessage(error?.response?.data || "買家資訊載入失敗。");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [productId]);

  const buyers = product?.buyer || [];
  const totalQuantity = buyers.reduce(
    (total, buyer) => total + (Number(buyer.quantity) || 0),
    0
  );

  return (
    <main className="app-page buyer-info-page">
      <div className="app-page__inner">
        <header className="app-page-header">
          <div>
            <button
              type="button"
              className="ui-back-button"
              onClick={() => navigate("/myProduct")}
            >
              ← 返回餐點管理
            </button>
            <p className="ui-eyebrow">品項需求</p>
            <h1>{product?.title || "買家資訊"}</h1>
            <p>查看目前將此品項加入購物車或已送出的顧客。</p>
          </div>
          {!loading && (
            <span className="ui-count-badge">{totalQuantity} 份</span>
          )}
        </header>

        {message && <div className="alert alert-warning">{message}</div>}

        {loading ? (
          <section className="ui-status" aria-live="polite">
            <span className="ui-spinner" aria-hidden="true" />
            <p>買家資訊載入中…</p>
          </section>
        ) : buyers.length === 0 ? (
          <section className="ui-empty">
            <span className="ui-empty-icon" aria-hidden="true">
              ◌
            </span>
            <h2>目前沒有顧客選擇此品項</h2>
            <p>顧客加入購物車後，資料會顯示在這裡。</p>
          </section>
        ) : (
          <section className="buyer-info-grid">
            {buyers.map((buyer, index) => {
              const user = buyer.user;
              const username =
                typeof user === "object" && user?.username
                  ? user.username
                  : buyer.buyerUsernameSnapshot || "掃碼顧客";
              const unitPrice =
                buyer.unitPrice === null || buyer.unitPrice === undefined
                  ? Number(product?.price || 0)
                  : Number(buyer.unitPrice || 0);

              return (
                <article
                  className="buyer-info-card"
                  key={buyer._id || `${username}-${index}`}
                >
                  <div className="buyer-info-card__header">
                    <span className="buyer-info-avatar" aria-hidden="true">
                      {Array.from(username)[0]?.toUpperCase() || "客"}
                    </span>
                    <div>
                      <h2>{username}</h2>
                      <p>
                        {buyer.tableNumber
                          ? `桌號 ${buyer.tableNumber}`
                          : "尚未帶入桌號"}
                      </p>
                    </div>
                    <span
                      className={`ui-status-badge ${
                        buyer.submittedAt ? "is-success" : "is-neutral"
                      }`}
                    >
                      {buyer.submittedAt ? "已送單" : "購物車中"}
                    </span>
                  </div>

                  <dl className="buyer-info-card__meta">
                    <div>
                      <dt>數量</dt>
                      <dd>{Number(buyer.quantity) || 1} 份</dd>
                    </div>
                    <div>
                      <dt>單價</dt>
                      <dd>NT$ {unitPrice.toLocaleString("zh-TW")}</dd>
                    </div>
                  </dl>

                  <ProductSelectionSummary
                    selectedOptions={buyer.selectedOptions || []}
                    specialRequest={buyer.specialRequest || ""}
                    noteLabel={
                      buyer.specialRequestLabel ||
                      product?.specialRequestConfig?.label ||
                      "備註或特殊需求"
                    }
                    className="buyer-info-selection"
                  />
                </article>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
};

export default BuyerInfoComponent;
