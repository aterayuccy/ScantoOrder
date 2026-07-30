import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import ProductService, {
  getProductImageUrl,
} from "../services/product.service";
import AuthEntryComponent from "./auth-entry-component";
import ProductCustomizeModal from "./product-customize-modal";

const MenuComponent = ({ currentUser, setCurrentUser }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedType = searchParams.get("type");
  const [menuProducts, setMenuProducts] = useState([]);
  const [searchInput, setSearchInput] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const filterProducts = useCallback(
    (products) => {
      const keyword = searchInput.trim().toLocaleLowerCase("zh-TW");
      return products.filter((product) => {
        const matchesType =
          !selectedType || (product.type || "").trim() === selectedType;
        const matchesSearch =
          !keyword ||
          (product.title || "").toLocaleLowerCase("zh-TW").includes(keyword);
        return matchesType && matchesSearch;
      });
    },
    [searchInput, selectedType]
  );

  useEffect(() => {
    if (!currentUser) {
      setMenuProducts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    ProductService.getMenuProducts(currentUser)
      .then((response) => setMenuProducts(response.data || []))
      .catch((error) => {
        console.error(error);
        setMessage(
          typeof error?.response?.data === "string"
            ? error.response.data
            : "菜單載入失敗"
        );
      })
      .finally(() => setLoading(false));
  }, [currentUser]);

  const visibleProducts = filterProducts(menuProducts);

  const handleConfirm = async (customization) => {
    if (!selectedProduct) return;
    setAdding(true);
    setMessage("");

    try {
      await ProductService.enroll(selectedProduct._id, customization);
      setMessage(`已將「${selectedProduct.title}」加入購物車`);
      setSelectedProduct(null);
    } catch (error) {
      const data = error?.response?.data;
      const errorMessage =
        typeof data === "string"
          ? data
          : data?.message || error.message || "加入購物車失敗";
      throw new Error(errorMessage);
    } finally {
      setAdding(false);
    }
  };

  const handleDirectAdd = async (product) => {
    if (!product || adding) return;

    setAdding(true);
    setMessage("");

    try {
      await ProductService.enroll(product._id, {
        quantity: 1,
        selections: [],
        specialRequest: "",
      });
      navigate("/product");
    } catch (error) {
      const data = error?.response?.data;
      setMessage(
        typeof data === "string"
          ? data
          : data?.message || error.message || "加入購物車失敗"
      );
    } finally {
      setAdding(false);
    }
  };

  if (!currentUser) {
    return <AuthEntryComponent setCurrentUser={setCurrentUser} />;
  }

  return (
    <div className="product-page menu-page">
      <div className="menu-toolbar">
        <div>
          <p className="product-form-eyebrow">店內菜單</p>
          <h2>{selectedType || "選擇品項"}</h2>
        </div>
        <div className="input-group menu-search">
          <input
            type="search"
            className="form-control"
            value={searchInput}
            placeholder="搜尋品項"
            aria-label="搜尋品項"
            onChange={(event) => setSearchInput(event.target.value)}
          />
          <span className="input-group-text">即時搜尋</span>
        </div>
      </div>

      {message && (
        <div className="cart-notice" role="status">
          <span>{message}</span>
          <button
            type="button"
            className="btn btn-sm btn-outline-primary"
            onClick={() => navigate("/product")}
          >
            查看購物車
          </button>
        </div>
      )}

      {loading ? (
        <p className="empty-state">菜單載入中…</p>
      ) : visibleProducts.length === 0 ? (
        <p className="empty-state">目前沒有符合條件的品項。</p>
      ) : (
        <div className="menu-product-list">
          {visibleProducts.map((product) => {
            const groupCount = (product.optionGroups || []).filter((group) =>
              (Array.isArray(group?.options) ? group.options : []).some(
                (option) => String(option?.name ?? option?.label ?? "").trim()
              )
            ).length;

            return (
              <article
                key={product._id}
                className="card product-card menu-product-card"
              >
                <div className="card-body product-card-layout">
                  <div className="product-info-column">
                    <div>
                      <span className="menu-product-type">
                        {product.type || "未分類"}
                      </span>
                      <h3 className="menu-product-title">{product.title}</h3>
                      <p className="menu-product-description">
                        {product.description || "店家尚未提供品項說明"}
                      </p>
                    </div>
                    <div className="menu-product-footer">
                      <div>
                        <strong className="menu-product-price">
                          NT$ {Number(product.price || 0)}
                        </strong>
                        <small>
                          {groupCount > 0
                            ? `${groupCount} 個調整步驟`
                            : "不需調整，可直接加入"}
                        </small>
                      </div>
                      <button
                        className="btn btn-primary"
                        type="button"
                        disabled={adding}
                        onClick={() => {
                          setMessage("");
                          if (groupCount === 0) {
                            handleDirectAdd(product);
                          } else {
                            setSelectedProduct(product);
                          }
                        }}
                      >
                        {adding ? "處理中…" : "加入購物車"}
                      </button>
                    </div>
                  </div>

                  {product.image && (
                    <div className="product-image-wrap">
                      <img
                        className="product-image"
                        src={getProductImageUrl(product.image)}
                        alt={product.title}
                      />
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <ProductCustomizeModal
        product={selectedProduct}
        isOpen={Boolean(selectedProduct)}
        isSubmitting={adding}
        onClose={() => {
          if (!adding) setSelectedProduct(null);
        }}
        onConfirm={handleConfirm}
      />
    </div>
  );
};

export default MenuComponent;
