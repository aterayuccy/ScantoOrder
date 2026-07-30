import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import ProductService, {
  getProductImageUrl,
} from "../services/product.service";
import PaymentService from "../services/payment.service";
import AuthService from "../services/auth.service";
import ProductSelectionSummary from "./product-selection-summary";

const formatOrderTime = (value) =>
  new Date(value).toLocaleString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

const getBuyerId = (buyerItem) =>
  String(buyerItem?.user?._id || buyerItem?.user || "");

const getCheckoutToken = () => {
  const existingToken = sessionStorage.getItem("pendingCheckoutToken");
  if (existingToken) return existingToken;

  const token =
    window.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  sessionStorage.setItem("pendingCheckoutToken", token);
  return token;
};

const buildCartLines = (products, buyerId) =>
  (Array.isArray(products) ? products : []).flatMap((product) =>
    (product.buyer || [])
      .filter(
        (buyerItem) =>
          getBuyerId(buyerItem) === String(buyerId) && !buyerItem.submittedAt
      )
      .map((buyerItem) => ({
        ...buyerItem,
        productId: product._id,
        productTitle: buyerItem.titleSnapshot || product.title,
        productImage: product.image,
        noteLabel:
          buyerItem.specialRequestLabel ||
          product.specialRequestConfig?.label ||
          "備註或特殊需求",
        basePrice:
          buyerItem.basePrice === null || buyerItem.basePrice === undefined
            ? Number(product.price || 0)
            : Number(buyerItem.basePrice),
        unitPrice:
          buyerItem.unitPrice === null || buyerItem.unitPrice === undefined
            ? Number(product.price || 0)
            : Number(buyerItem.unitPrice),
      }))
  );

const CartComponent = ({ currentUser }) => {
  const navigate = useNavigate();
  const [cartLines, setCartLines] = useState([]);
  const [quantities, setQuantities] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("store");
  const [invoicePreference, setInvoicePreference] = useState("none");
  const [mobileCarrier, setMobileCarrier] = useState("");
  const [linePayMode, setLinePayMode] = useState("mock");
  const [storeSettings, setStoreSettings] = useState({
    acceptingOrders: true,
    paymentQrImage: "",
  });

  useEffect(() => {
    if (!currentUser?.user) {
      setLoading(false);
      return;
    }

    const sellerId = currentUser.sellerId || currentUser.user.qrSeller || null;

    Promise.all([
      ProductService.getEnrolledProduct(currentUser.user._id),
      sellerId
        ? AuthService.getStoreSettings(sellerId, currentUser)
        : Promise.resolve({
            data: { acceptingOrders: true, paymentQrImage: "" },
          }),
    ])
      .then(([cartResponse, settingsResponse]) => {
        const lines = buildCartLines(cartResponse.data, currentUser.user._id);
        setCartLines(lines);
        setStoreSettings(settingsResponse.data);
        setQuantities(
          lines.reduce((values, line) => {
            values[line._id] = Number(line.quantity || 1);
            return values;
          }, {})
        );
      })
      .catch((error) => {
        console.error(error);
        setMessage("購物車載入失敗");
      })
      .finally(() => setLoading(false));
  }, [currentUser]);

  useEffect(() => {
    PaymentService.getMode()
      .then((response) => setLinePayMode(response.data.linePayMode))
      .catch(() => setLinePayMode("mock"));
  }, []);

  const totalAmount = useMemo(
    () =>
      cartLines.reduce(
        (sum, line) =>
          sum + Number(line.unitPrice || 0) * Number(quantities[line._id] || 1),
        0
      ),
    [cartLines, quantities]
  );

  const goToMenu = () => {
    AuthService.markQrBuyerNavigation();
    navigate("/");
  };

  const handleQuantityChange = (event, lineItemId) => {
    const value = Math.min(99, Math.max(1, Number(event.target.value) || 1));
    setQuantities((current) => ({
      ...current,
      [lineItemId]: value,
    }));
  };

  const handleDelete = async (line) => {
    if (!window.confirm(`確定要移除「${line.productTitle}」嗎？`)) return;

    try {
      await ProductService.deleteCartLine(line.productId, line._id);
      setCartLines((current) =>
        current.filter((item) => item._id !== line._id)
      );
    } catch (error) {
      console.error(error);
      window.alert("移除失敗，請稍後再試");
    }
  };

  const submit = async () => {
    if (cartLines.length === 0) return;
    setSubmitting(true);
    setMessage("");

    try {
      const checkoutToken = getCheckoutToken();
      await Promise.all(
        cartLines.map((line) =>
          ProductService.updateCartLineQuantity(
            line.productId,
            line._id,
            Number(quantities[line._id] || 1)
          )
        )
      );

      const orderSnapshot = cartLines.map((line) => {
        const quantity = Number(quantities[line._id] || 1);
        return {
          _id: line._id,
          title: line.productTitle,
          basePrice: Number(line.basePrice || 0),
          price: Number(line.unitPrice || 0),
          quantity,
          lineTotal: Number(line.unitPrice || 0) * quantity,
          selectedOptions: line.selectedOptions || [],
          specialRequest: line.specialRequest || "",
          noteLabel: line.noteLabel,
        };
      });
      const response = await PaymentService.checkout({
        checkoutToken,
        method: paymentMethod,
        invoicePreference,
        mobileCarrier:
          invoicePreference === "mobile_carrier" ? mobileCarrier : "",
      });
      const payment = response.data.payment;

      if (paymentMethod === "line_pay") {
        sessionStorage.setItem(
          "pendingPaymentOrder",
          JSON.stringify({
            orderData: orderSnapshot,
            totalAmount,
            payment,
          })
        );
        window.location.assign(response.data.redirectUrl);
        return;
      }

      const submittedAt = response.data.submittedAt || payment?.submittedAt;
      sessionStorage.setItem(
        "submittedOrder",
        JSON.stringify({
          orderData: orderSnapshot,
          totalAmount,
          orderTime: formatOrderTime(submittedAt),
          orderBatchId: response.data.orderBatchId || payment?.orderBatchId,
          payment,
        })
      );
      sessionStorage.removeItem("pendingCheckoutToken");
      navigate("/submit");
    } catch (error) {
      console.error(error);
      const data = error?.response?.data;
      if (error?.response?.status === 409) {
        sessionStorage.removeItem("pendingCheckoutToken");
      }
      setMessage(
        typeof data === "string" ? data : data?.message || "訂單送出失敗"
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="product-page">
        <p>請先登入。</p>
        <button
          className="btn btn-primary btn-lg"
          onClick={() => navigate("/login")}
        >
          前往登入
        </button>
      </div>
    );
  }

  if (loading) {
    return <div className="product-page">購物車載入中…</div>;
  }

  return (
    <div className="product-page cart-page">
      <div className="cart-heading">
        <div>
          <p className="product-form-eyebrow">本次點餐</p>
          <h2>購物車</h2>
        </div>
        <button
          type="button"
          className="btn btn-outline-primary"
          onClick={goToMenu}
        >
          繼續選購
        </button>
      </div>

      {message && <div className="alert alert-warning">{message}</div>}
      {!storeSettings.acceptingOrders && (
        <div className="alert alert-warning">
          店家目前暫停接單，請稍後再送出訂單。
        </div>
      )}

      {cartLines.length === 0 ? (
        <div className="empty-state cart-empty-state">
          <h3>購物車目前是空的</h3>
          <p>回到菜單選擇想要的品項。</p>
          <button className="btn btn-primary" onClick={goToMenu}>
            查看菜單
          </button>
        </div>
      ) : (
        <>
          <div className="cart-line-list">
            {cartLines.map((line) => (
              <article
                key={line._id}
                className={`card cart-line-card${
                  line.productImage ? "" : " cart-line-card--without-image"
                }`}
              >
                {line.productImage && (
                  <div className="cart-line-image-wrap">
                    <img
                      src={getProductImageUrl(line.productImage)}
                      alt={line.productTitle}
                    />
                  </div>
                )}

                <div className="cart-line-content">
                  <div className="cart-line-title-row">
                    <div>
                      <h3>{line.productTitle}</h3>
                      {Number(line.basePrice) !== Number(line.unitPrice) ? (
                        <p>
                          原品項 NT$ {Number(line.basePrice || 0)}
                          {" · "}
                          調整後 NT$ {Number(line.unitPrice || 0)}
                        </p>
                      ) : (
                        <p>單價 NT$ {Number(line.unitPrice || 0)}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => handleDelete(line)}
                    >
                      移除
                    </button>
                  </div>

                  <ProductSelectionSummary
                    selectedOptions={line.selectedOptions}
                    specialRequest={line.specialRequest}
                    noteLabel={line.noteLabel}
                  />

                  <div className="cart-line-bottom">
                    <label>
                      <span>數量</span>
                      <input
                        type="number"
                        className="form-control"
                        min="1"
                        max="99"
                        value={quantities[line._id] || 1}
                        onChange={(event) =>
                          handleQuantityChange(event, line._id)
                        }
                      />
                    </label>
                    <strong>
                      小計 NT${" "}
                      {Number(line.unitPrice || 0) *
                        Number(quantities[line._id] || 1)}
                    </strong>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <section className="checkout-settings">
            <div className="checkout-settings__heading">
              <div>
                <p className="product-form-eyebrow">付款與發票設定</p>
                <h3>選擇結帳方式</h3>
              </div>
              <span>應付 NT$ {totalAmount}</span>
            </div>

            <div className="checkout-settings__grid">
              <fieldset className="checkout-setting-card">
                <legend>付款方式</legend>
                <label
                  className={`checkout-choice${
                    paymentMethod === "store" ? " is-selected" : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="store"
                    checked={paymentMethod === "store"}
                    onChange={() => setPaymentMethod("store")}
                  />
                  <span>
                    <strong>店內付款</strong>
                    <small>送出訂單後至櫃檯付款</small>
                  </span>
                </label>
                {storeSettings.paymentQrImage && (
                  <label
                    className={`checkout-choice${
                      paymentMethod === "merchant_qr" ? " is-selected" : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="merchant_qr"
                      checked={paymentMethod === "merchant_qr"}
                      onChange={() => setPaymentMethod("merchant_qr")}
                    />
                    <span>
                      <strong>掃描店家收款碼</strong>
                      <small>款項直接進入店家帳戶，由店家人工確認</small>
                    </span>
                  </label>
                )}
                {paymentMethod === "merchant_qr" &&
                  storeSettings.paymentQrImage && (
                    <div className="merchant-qr-payment">
                      <img
                        src={getProductImageUrl(storeSettings.paymentQrImage)}
                        alt="店家收款 QR Code"
                      />
                      <strong>應付 NT$ {totalAmount}</strong>
                      <p>
                        請使用付款 App
                        掃描或辨識此圖片，確認金額後完成付款，再按下方按鈕送出訂單。
                      </p>
                    </div>
                  )}
                <label
                  className={`checkout-choice${
                    paymentMethod === "line_pay" ? " is-selected" : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="line_pay"
                    checked={paymentMethod === "line_pay"}
                    onChange={() => setPaymentMethod("line_pay")}
                  />
                  <span>
                    <strong>LINE Pay</strong>
                    <small>前往 LINE Pay 畫面完成付款</small>
                  </span>
                </label>
                {paymentMethod === "line_pay" && (
                  <p className="checkout-mode-note">
                    {linePayMode === "mock"
                      ? "目前為作品展示模式，不會實際扣款。"
                      : linePayMode === "sandbox"
                        ? "目前連接 LINE Pay Sandbox，不會實際扣款。"
                        : "將前往 LINE Pay 完成真實付款。"}
                  </p>
                )}
              </fieldset>

              <fieldset className="checkout-setting-card">
                <legend>電子發票載具</legend>
                <label
                  className={`checkout-choice${
                    invoicePreference === "none" ? " is-selected" : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="invoicePreference"
                    value="none"
                    checked={invoicePreference === "none"}
                    onChange={() => setInvoicePreference("none")}
                  />
                  <span>
                    <strong>不使用載具</strong>
                    <small>由店家現場處理發票</small>
                  </span>
                </label>
                <label
                  className={`checkout-choice${
                    invoicePreference === "mobile_carrier" ? " is-selected" : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="invoicePreference"
                    value="mobile_carrier"
                    checked={invoicePreference === "mobile_carrier"}
                    onChange={() => setInvoicePreference("mobile_carrier")}
                  />
                  <span>
                    <strong>手機條碼載具</strong>
                    <small>輸入「/」開頭的 8 碼條碼</small>
                  </span>
                </label>
                {invoicePreference === "mobile_carrier" && (
                  <label className="mobile-carrier-field">
                    <span>手機條碼</span>
                    <input
                      type="text"
                      className="form-control"
                      maxLength="8"
                      value={mobileCarrier}
                      placeholder="/ABC.122"
                      autoComplete="off"
                      onChange={(event) =>
                        setMobileCarrier(event.target.value.toUpperCase())
                      }
                    />
                  </label>
                )}
                <p className="checkout-invoice-note">
                  本功能先記錄載具需求，不會直接開立電子發票。
                </p>
              </fieldset>
            </div>
          </section>

          <div className="cart-checkout-bar">
            <div>
              <span>合計</span>
              <strong>NT$ {totalAmount}</strong>
            </div>
            <button
              className="btn btn-primary btn-lg"
              disabled={submitting || !storeSettings.acceptingOrders}
              onClick={submit}
            >
              {submitting
                ? "處理中…"
                : paymentMethod === "line_pay"
                  ? "前往 LINE Pay"
                  : paymentMethod === "merchant_qr"
                    ? "我已付款並送出訂單"
                    : "送出訂單"}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default CartComponent;
