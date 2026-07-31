import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

import ProductService from "../services/product.service";
import {
  SELLER_ONBOARDING_STAGES,
  setSellerOnboardingStage,
  useSellerOnboardingStage,
} from "../onboarding/seller-onboarding";
import {
  createDefaultOptionGroups,
  createDefaultSpecialRequestConfig,
  validateProductOptions,
} from "../utils/product-options";
import ProductOptionsEditor from "./product-options-editor";

const toMessage = (error, fallback) => {
  const data = error?.response?.data;
  if (typeof data === "string") return data;
  return data?.message || fallback;
};

const PostProductComponent = ({ currentUser }) => {
  const navigate = useNavigate();
  const onboardingStage = useSellerOnboardingStage(currentUser);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [type, setType] = useState("");
  const [image, setImage] = useState(null);
  const [optionGroups, setOptionGroups] = useState(() =>
    createDefaultOptionGroups()
  );
  const [specialRequestConfig, setSpecialRequestConfig] = useState(() =>
    createDefaultSpecialRequestConfig()
  );
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const postProduct = async (event) => {
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
      await ProductService.post(
        title,
        description,
        Number(price),
        type,
        image,
        optionGroups,
        specialRequestConfig
      );
      if (onboardingStage === SELLER_ONBOARDING_STAGES.PRODUCT_FORM) {
        setSellerOnboardingStage(
          currentUser.user._id,
          SELLER_ONBOARDING_STAGES.QR_NAV
        );
      }
      window.alert("品項新增成功");
      navigate("/myProduct");
    } catch (error) {
      setMessage(toMessage(error, "新增失敗，請檢查輸入內容"));
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
        <div className="alert alert-warning">只有店家帳號可以新增品項。</div>
      </div>
    );
  }

  return (
    <div className="product-form-page">
      <form
        className={`product-form${
          onboardingStage === SELLER_ONBOARDING_STAGES.PRODUCT_FORM
            ? " seller-guide-target seller-guide-form"
            : ""
        }`}
        onSubmit={postProduct}
      >
        <div className="product-form-heading">
          <div>
            <p className="product-form-eyebrow">菜單管理</p>
            <h2>新增品項</h2>
          </div>
          <p>先建立原品項價格，再設定顧客可以選擇的調整步驟。</p>
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
                placeholder="例如：主餐、飲品、甜點"
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
              <span>品項圖片</span>
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
            disabled={onboardingStage === SELLER_ONBOARDING_STAGES.PRODUCT_FORM}
            onClick={() => navigate("/myProduct")}
          >
            取消
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting}
          >
            {submitting ? "儲存中…" : "新增品項"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PostProductComponent;
