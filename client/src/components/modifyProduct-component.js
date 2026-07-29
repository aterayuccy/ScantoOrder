import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import ProductService from "../services/product.service";
import {
  createDefaultSpecialRequestConfig,
  normalizeOptionGroups,
  normalizeSpecialRequestConfig,
  validateProductOptions,
} from "../utils/product-options";
import ProductOptionsEditor from "./product-options-editor";

const toMessage = (error, fallback) => {
  const data = error?.response?.data;
  if (typeof data === "string") return data;
  return data?.message || fallback;
};

const ModifyProductComponent = ({ currentUser }) => {
  const { productId } = useParams();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [type, setType] = useState("");
  const [image, setImage] = useState(null);
  const [optionGroups, setOptionGroups] = useState([]);
  const [specialRequestConfig, setSpecialRequestConfig] = useState(() =>
    createDefaultSpecialRequestConfig()
  );
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!currentUser || currentUser.user.role !== "seller") {
      setLoading(false);
      return;
    }

    ProductService.getProductById(productId)
      .then((response) => {
        const product = response.data || {};
        setTitle(product.title || "");
        setDescription(product.description || "");
        setPrice(product.price ?? "");
        setType(product.type || "");
        setOptionGroups(normalizeOptionGroups(product.optionGroups || []));
        setSpecialRequestConfig(
          product.specialRequestConfig
            ? normalizeSpecialRequestConfig(product.specialRequestConfig)
            : createDefaultSpecialRequestConfig()
        );
      })
      .catch((error) => {
        setMessage(toMessage(error, "讀取品項失敗"));
      })
      .finally(() => setLoading(false));
  }, [currentUser, productId]);

  const saveProduct = async (event) => {
    event.preventDefault();
    setMessage("");
    const optionValidation = validateProductOptions(
      optionGroups,
      specialRequestConfig,
      Number(price)
    );
    if (!optionValidation.valid) {
      setMessage(optionValidation.errors[0].message);
      return;
    }
    setSubmitting(true);

    try {
      await ProductService.updateProductWithImage(
        productId,
        title,
        description,
        Number(price),
        type,
        image,
        optionGroups,
        specialRequestConfig
      );
      window.alert("品項修改成功");
      navigate("/myProduct");
    } catch (error) {
      setMessage(toMessage(error, "修改失敗，請檢查輸入內容"));
    } finally {
      setSubmitting(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="product-form-page">
        <p>請先登入店家帳號。</p>
        <button
          className="btn btn-primary btn-lg"
          onClick={() => navigate("/login")}
        >
          前往登入
        </button>
      </div>
    );
  }

  if (currentUser.user.role !== "seller") {
    return (
      <div className="product-form-page">
        <div className="alert alert-warning">只有店家帳號可以修改品項。</div>
      </div>
    );
  }

  if (loading) {
    return <div className="product-form-page">載入中…</div>;
  }

  return (
    <div className="product-form-page">
      <form className="product-form" onSubmit={saveProduct}>
        <div className="product-form-heading">
          <div>
            <p className="product-form-eyebrow">菜單管理</p>
            <h2>修改品項</h2>
          </div>
          <p>可依商品調整步驟數量、名稱、顧客可點內容與價格差額。</p>
        </div>

        <section className="product-form-section">
          <h3>基本資料</h3>
          <div className="product-form-grid">
            <label className="form-label-field product-form-grid-wide">
              <span>品項名稱</span>
              <input
                type="text"
                className="form-control"
                value={title}
                maxLength="50"
                required
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>

            <label className="form-label-field">
              <span>價格（NT$）</span>
              <input
                type="number"
                className="form-control"
                value={price}
                min="0"
                max="9999"
                step="1"
                required
                onChange={(event) => setPrice(event.target.value)}
              />
            </label>

            <label className="form-label-field">
              <span>分類</span>
              <input
                type="text"
                className="form-control"
                value={type}
                maxLength="50"
                required
                onChange={(event) => setType(event.target.value)}
              />
            </label>

            <label className="form-label-field product-form-grid-wide">
              <span>品項說明</span>
              <textarea
                className="form-control"
                value={description}
                maxLength="255"
                rows="3"
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>

            <label className="form-label-field product-form-grid-wide">
              <span>更換圖片（未選擇時保留原圖）</span>
              <input
                type="file"
                className="form-control"
                accept="image/*"
                onChange={(event) => setImage(event.target.files[0] || null)}
              />
            </label>
          </div>
        </section>

        <ProductOptionsEditor
          optionGroups={optionGroups}
          setOptionGroups={setOptionGroups}
          specialRequestConfig={specialRequestConfig}
          setSpecialRequestConfig={setSpecialRequestConfig}
        />

        {message && (
          <div className="alert alert-warning" role="alert">
            {message}
          </div>
        )}

        <div className="product-form-actions">
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => navigate("/myProduct")}
          >
            取消
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting}
          >
            {submitting ? "儲存中…" : "儲存修改"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ModifyProductComponent;
