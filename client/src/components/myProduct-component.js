import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import ProductService, {
  getProductImageUrl,
} from "../services/product.service";
import AuthService from "../services/auth.service";

const formatPrice = (value) =>
  Number(value || 0).toLocaleString("zh-TW", {
    maximumFractionDigits: 2,
  });

const MyProductComponent = ({ currentUser }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedType = searchParams.get("type") || "";
  const [products, setProducts] = useState([]);
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [qrCount, setQrCount] = useState(0);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);

  useEffect(() => {
    if (!currentUser?.user || currentUser.user.role !== "seller") {
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setMessage("");
    const onboardingKey = `scanToOrder.onboardingDismissed:${currentUser.user._id}`;
    const onboardingStartedKey = `scanToOrder.onboardingStarted:${currentUser.user._id}`;
    setOnboardingDismissed(localStorage.getItem(onboardingKey) === "true");
    AuthService.setSellerUser(currentUser);

    Promise.all([
      ProductService.get(currentUser.user._id),
      AuthService.getQrCodes(currentUser).catch((error) => {
        console.error("QR Code onboarding status failed:", error);
        return { data: { qrCodes: [] } };
      }),
    ])
      .then(([productResponse, qrResponse]) => {
        if (!active) return;
        const nextProducts = productResponse.data || [];
        const nextQrCount = qrResponse.data.qrCodes?.length || 0;
        const setupIsIncomplete =
          nextProducts.length === 0 || nextQrCount === 0;

        if (setupIsIncomplete) {
          localStorage.setItem(onboardingStartedKey, "true");
        }

        const onboardingStarted =
          localStorage.getItem(onboardingStartedKey) === "true";
        const onboardingWasDismissed =
          localStorage.getItem(onboardingKey) === "true";
        setProducts(nextProducts);
        setQrCount(nextQrCount);
        setOnboardingDismissed(
          onboardingWasDismissed || (!onboardingStarted && !setupIsIncomplete)
        );
      })
      .catch((error) => {
        console.error(error);
        if (active) setMessage("餐點載入失敗，請稍後再試。");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [currentUser]);

  const dismissOnboarding = () => {
    localStorage.setItem(
      `scanToOrder.onboardingDismissed:${currentUser.user._id}`,
      "true"
    );
    setOnboardingDismissed(true);
  };

  const visibleProducts = useMemo(() => {
    const keyword = searchInput.trim().toLocaleLowerCase("zh-TW");

    return products.filter((product) => {
      const matchesType =
        !selectedType || String(product.type || "").trim() === selectedType;
      const matchesKeyword =
        !keyword ||
        [product.title, product.type, product.description]
          .filter(Boolean)
          .some((value) =>
            String(value).toLocaleLowerCase("zh-TW").includes(keyword)
          );

      return matchesType && matchesKeyword;
    });
  }, [products, searchInput, selectedType]);

  const handleDelete = async (productId, title) => {
    if (!window.confirm(`確定要刪除「${title}」嗎？`)) return;

    try {
      await ProductService.deleteProduct(productId);
      setProducts((current) =>
        current.filter((product) => product._id !== productId)
      );
      setMessage("品項已刪除。");
    } catch (error) {
      console.error(error);
      setMessage("刪除失敗，請稍後再試。");
    }
  };

  if (!currentUser) {
    return (
      <main className="app-page">
        <div className="app-page__inner">
          <section className="ui-empty">
            <h1>請先登入</h1>
            <p>登入店家帳號後即可管理餐點。</p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => navigate("/login")}
            >
              前往登入
            </button>
          </section>
        </div>
      </main>
    );
  }

  if (currentUser.user.role !== "seller") {
    return (
      <main className="app-page">
        <div className="app-page__inner">
          <div className="alert alert-warning">只有店家帳號可以管理餐點。</div>
        </div>
      </main>
    );
  }

  return (
    <main className="app-page seller-catalog-page">
      <div className="app-page__inner">
        <header className="app-page-header">
          <div>
            <p className="ui-eyebrow">店家後台</p>
            <h1>{selectedType || "餐點管理"}</h1>
            <p>
              管理顧客看得到的品項、價格與調整選項，共 {products.length}{" "}
              個品項。
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate("/postProduct")}
          >
            ＋ 新增品項
          </button>
        </header>

        {!loading && !onboardingDismissed && (
          <section
            className="seller-onboarding"
            aria-labelledby="onboarding-title"
          >
            <div className="seller-onboarding__heading">
              <div>
                <p className="ui-eyebrow">快速開通</p>
                <h2 id="onboarding-title">3 步驟開始接單</h2>
                <p>完成品項與桌號後，就能用手機掃碼測試點餐流程。</p>
              </div>
              <button
                type="button"
                className="seller-onboarding__dismiss"
                onClick={dismissOnboarding}
                aria-label="隱藏開通引導"
              >
                ×
              </button>
            </div>

            <div className="seller-onboarding__steps">
              <article className={products.length > 0 ? "is-complete" : ""}>
                <span>{products.length > 0 ? "✓" : "1"}</span>
                <div>
                  <strong>建立第一個品項</strong>
                  <small>
                    {products.length > 0
                      ? `已建立 ${products.length} 個品項`
                      : "填入名稱、分類與價格即可"}
                  </small>
                </div>
                {products.length === 0 && (
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={() => navigate("/postProduct")}
                  >
                    新增品項
                  </button>
                )}
              </article>

              <article className={qrCount > 0 ? "is-complete" : ""}>
                <span>{qrCount > 0 ? "✓" : "2"}</span>
                <div>
                  <strong>建立桌號 QR Code</strong>
                  <small>
                    {qrCount > 0
                      ? `已有 ${qrCount} 個桌號`
                      : "輸入桌數後可一次下載 PDF"}
                  </small>
                </div>
                {qrCount === 0 && (
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={() => navigate("/qrcode")}
                  >
                    建立桌號
                  </button>
                )}
              </article>

              <article
                className={
                  products.length > 0 && qrCount > 0 ? "is-complete" : ""
                }
              >
                <span>{products.length > 0 && qrCount > 0 ? "✓" : "3"}</span>
                <div>
                  <strong>掃碼送出測試訂單</strong>
                  <small>用手機掃 QR，確認顧客與店家流程</small>
                </div>
                {products.length > 0 && qrCount > 0 && (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary"
                    onClick={() => navigate("/qrcode")}
                  >
                    前往測試
                  </button>
                )}
              </article>
            </div>
          </section>
        )}

        <section className="ui-toolbar" aria-label="搜尋品項">
          <label className="ui-search">
            <span className="ui-search-icon" aria-hidden="true">
              ⌕
            </span>
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="搜尋品項名稱、分類或說明"
              aria-label="搜尋品項"
            />
          </label>
          <span className="ui-toolbar-result">
            顯示 {visibleProducts.length} 個品項
          </span>
        </section>

        {message && (
          <div
            className={`alert ${
              message.includes("已刪除") ? "alert-success" : "alert-warning"
            }`}
          >
            {message}
          </div>
        )}

        {loading ? (
          <section className="ui-status" aria-live="polite">
            <span className="ui-spinner" aria-hidden="true" />
            <p>餐點載入中…</p>
          </section>
        ) : visibleProducts.length === 0 ? (
          <section className="ui-empty">
            <span className="ui-empty-icon" aria-hidden="true">
              🍽
            </span>
            <h2>
              {searchInput || selectedType ? "找不到符合的品項" : "還沒有品項"}
            </h2>
            <p>
              {searchInput || selectedType
                ? "請調整搜尋內容或切換其他分類。"
                : "新增第一個品項後，顧客就能在點餐頁看到。"}
            </p>
            {!searchInput && !selectedType && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => navigate("/postProduct")}
              >
                新增第一個品項
              </button>
            )}
          </section>
        ) : (
          <section className="seller-catalog-grid">
            {visibleProducts.map((product) => {
              const requestedQuantity = (product.buyer || []).reduce(
                (total, buyer) => total + (Number(buyer.quantity) || 0),
                0
              );
              const optionGroupCount = (product.optionGroups || []).filter(
                (group) => (group.options || []).length > 0
              ).length;

              return (
                <article className="seller-product-card" key={product._id}>
                  {product.image && (
                    <div className="seller-product-card__media">
                      <img
                        src={getProductImageUrl(product.image)}
                        alt={product.title}
                      />
                    </div>
                  )}

                  <div className="seller-product-card__body">
                    <div className="seller-product-card__heading">
                      <span className="ui-pill">{product.type}</span>
                      <strong>NT$ {formatPrice(product.price)}</strong>
                    </div>
                    <h2>{product.title}</h2>
                    <p className="seller-product-card__description">
                      {product.description || "尚未填寫品項說明"}
                    </p>

                    <dl className="seller-product-card__meta">
                      <div>
                        <dt>調整步驟</dt>
                        <dd>{optionGroupCount} 組</dd>
                      </div>
                      <div>
                        <dt>購物車數量</dt>
                        <dd>{requestedQuantity}</dd>
                      </div>
                    </dl>
                  </div>

                  <div className="seller-product-card__actions">
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => navigate(`/buyerInfo/${product._id}`)}
                    >
                      買家資訊
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-primary"
                      onClick={() => navigate(`/modifyProduct/${product._id}`)}
                    >
                      修改
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-danger"
                      onClick={() => handleDelete(product._id, product.title)}
                    >
                      刪除
                    </button>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
};

export default MyProductComponent;
