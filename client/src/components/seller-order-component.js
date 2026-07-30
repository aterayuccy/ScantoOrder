import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import ProductService from "../services/product.service";
import PaymentService from "../services/payment.service";
import ProductSelectionSummary from "./product-selection-summary";

const formatDateTime = (value) =>
  new Date(value).toLocaleString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

const buildOrderGroups = (products, payments = []) => {
  const groups = {};
  const paymentsByBatch = new Map(
    payments.map((payment) => [payment.orderBatchId, payment])
  );

  (products || []).forEach((product) => {
    (product.buyer || []).forEach((buyerItem) => {
      if (!buyerItem.submittedAt) return;

      const buyerId = String(
        buyerItem.user?._id || buyerItem.user || "unknown"
      );
      const buyerName =
        buyerItem.user?.username || buyerItem.buyerUsernameSnapshot || "";
      const tableNumber = buyerItem.tableNumber || null;
      const orderBatchId = buyerItem.orderBatchId || "";
      const legacyKey = `legacy-${tableNumber || buyerId}-${buyerItem.submittedAt}`;
      const groupKey = orderBatchId || legacyKey;

      if (!groups[groupKey]) {
        groups[groupKey] = {
          groupKey,
          orderBatchId,
          buyerId,
          buyerName,
          tableNumber,
          submittedAt: buyerItem.submittedAt,
          payment: paymentsByBatch.get(orderBatchId) || null,
          items: [],
        };
      }

      groups[groupKey].items.push({
        _id: buyerItem._id,
        title: buyerItem.titleSnapshot || product.title,
        basePrice:
          buyerItem.basePrice === null || buyerItem.basePrice === undefined
            ? Number(product.price || 0)
            : Number(buyerItem.basePrice),
        price:
          buyerItem.unitPrice === null || buyerItem.unitPrice === undefined
            ? Number(product.price || 0)
            : Number(buyerItem.unitPrice),
        quantity: Number(buyerItem.quantity || 1),
        selectedOptions: buyerItem.selectedOptions || [],
        specialRequest: buyerItem.specialRequest || "",
        noteLabel:
          buyerItem.specialRequestLabel ||
          product.specialRequestConfig?.label ||
          "備註或特殊需求",
      });
    });
  });

  return Object.values(groups).sort(
    (left, right) =>
      new Date(left.submittedAt).getTime() -
      new Date(right.submittedAt).getTime()
  );
};

const SellerOrderComponent = ({ currentUser }) => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [completedMap, setCompletedMap] = useState({});
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!currentUser?.user || currentUser.user.role !== "seller") {
      setLoading(false);
      return undefined;
    }

    let active = true;
    const loadOrders = () => {
      Promise.all([
        ProductService.get(currentUser.user._id),
        PaymentService.getSellerPayments().catch((error) => {
          console.error(error);
          return { data: [] };
        }),
      ])
        .then(([productResponse, paymentResponse]) => {
          if (active) {
            setOrders(
              buildOrderGroups(productResponse.data, paymentResponse.data)
            );
          }
        })
        .catch((error) => {
          console.error(error);
          if (active) setMessage("店家訂單載入失敗");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    };

    loadOrders();
    const intervalId = window.setInterval(loadOrders, 3000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [currentUser]);

  const orderCount = useMemo(() => orders.length, [orders]);

  const toggleCompleted = (groupKey, lineItemId) => {
    const key = `${groupKey}-${lineItemId}`;
    setCompletedMap((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  const completeOrder = async (order) => {
    const allCompleted = order.items.every(
      (item) => completedMap[`${order.groupKey}-${item._id}`]
    );
    if (!allCompleted) {
      window.alert("請先確認這張訂單的所有品項都已完成");
      return;
    }
    if (order.payment?.status === "pay_at_store") {
      window.alert("請先確認已收到店內付款");
      return;
    }
    if (order.payment?.invoiceStatus === "pending") {
      window.alert("請先處理顧客的手機條碼載具");
      return;
    }
    if (!window.confirm("確定要將這張訂單標示完成並移除嗎？")) return;

    try {
      if (order.orderBatchId) {
        await ProductService.deleteSellerOrderBatch(order.orderBatchId);
      } else if (order.tableNumber) {
        await ProductService.deleteSellerTableOrder(order.tableNumber);
      } else {
        await ProductService.deleteSellerOrder(order.buyerId);
      }
      setOrders((current) =>
        current.filter((item) => item.groupKey !== order.groupKey)
      );
    } catch (error) {
      console.error(error);
      window.alert("完成訂單失敗，請稍後再試");
    }
  };

  const updateOrderPayment = (orderBatchId, payment) => {
    setOrders((current) =>
      current.map((order) =>
        order.orderBatchId === orderBatchId ? { ...order, payment } : order
      )
    );
  };

  const markStorePaymentPaid = async (order) => {
    try {
      const response = await PaymentService.markStorePaymentPaid(
        order.orderBatchId
      );
      updateOrderPayment(order.orderBatchId, response.data.payment);
    } catch (error) {
      console.error(error);
      window.alert("付款狀態更新失敗，請稍後再試");
    }
  };

  const markInvoiceProcessed = async (order) => {
    try {
      const response = await PaymentService.markInvoiceProcessed(
        order.orderBatchId
      );
      updateOrderPayment(order.orderBatchId, response.data.payment);
    } catch (error) {
      console.error(error);
      window.alert("載具狀態更新失敗，請稍後再試");
    }
  };

  if (!currentUser) {
    return (
      <div className="product-page">
        <p>請先登入。</p>
        <button className="btn btn-primary" onClick={() => navigate("/login")}>
          前往登入
        </button>
      </div>
    );
  }

  if (currentUser.user.role !== "seller") {
    return (
      <div className="product-page">
        <div className="alert alert-warning">只有店家帳號可以查看訂單。</div>
      </div>
    );
  }

  if (loading) {
    return <div className="product-page">訂單載入中…</div>;
  }

  return (
    <div className="product-page seller-orders-page">
      <div className="seller-orders-heading">
        <div>
          <p className="product-form-eyebrow">每 3 秒自動更新</p>
          <h2>店家訂單</h2>
        </div>
        <span className="seller-order-count">{orderCount} 張待處理</span>
      </div>

      {message && <div className="alert alert-warning">{message}</div>}

      {orders.length === 0 ? (
        <div className="empty-state">
          <h3>目前沒有待處理訂單</h3>
          <p>顧客送出訂單後會自動出現在這裡。</p>
        </div>
      ) : (
        <div className="seller-order-grid">
          {orders.map((order) => {
            const total = order.items.reduce(
              (sum, item) => sum + item.price * item.quantity,
              0
            );
            const allCompleted = order.items.every(
              (item) => completedMap[`${order.groupKey}-${item._id}`]
            );

            return (
              <article key={order.groupKey} className="card seller-order-card">
                <header className="seller-order-card__header">
                  <div>
                    <span className="seller-order-card__table">
                      {order.tableNumber
                        ? `桌號 ${order.tableNumber}`
                        : order.buyerName || `顧客 ${order.buyerId}`}
                    </span>
                    <time dateTime={order.submittedAt}>
                      {formatDateTime(order.submittedAt)}
                    </time>
                  </div>
                  <strong>NT$ {total}</strong>
                </header>

                {order.payment ? (
                  <section className="seller-payment-panel">
                    <div className="seller-payment-row">
                      <div>
                        <span>付款方式</span>
                        <strong>
                          {order.payment.method === "line_pay"
                            ? "LINE Pay"
                            : "店內付款"}
                        </strong>
                      </div>
                      <span
                        className={`payment-status-badge ${
                          order.payment.status === "paid"
                            ? "payment-status-badge--paid"
                            : "payment-status-badge--pending"
                        }`}
                      >
                        {order.payment.status === "paid" ? "已付款" : "待收款"}
                      </span>
                      {order.payment.status === "pay_at_store" && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-success"
                          onClick={() => markStorePaymentPaid(order)}
                        >
                          確認已收款
                        </button>
                      )}
                    </div>

                    <div className="seller-payment-row">
                      <div>
                        <span>發票載具</span>
                        <strong>
                          {order.payment.invoicePreference === "mobile_carrier"
                            ? order.payment.mobileCarrier
                            : "不使用載具"}
                        </strong>
                      </div>
                      {order.payment.invoicePreference === "mobile_carrier" && (
                        <>
                          <span
                            className={`payment-status-badge ${
                              order.payment.invoiceStatus === "processed"
                                ? "payment-status-badge--paid"
                                : "payment-status-badge--pending"
                            }`}
                          >
                            {order.payment.invoiceStatus === "processed"
                              ? "已處理"
                              : "待處理"}
                          </span>
                          {order.payment.invoiceStatus !== "processed" && (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary"
                              onClick={() => markInvoiceProcessed(order)}
                            >
                              標示已處理
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </section>
                ) : (
                  <p className="seller-payment-legacy">
                    舊版訂單，未記錄付款與載具資料
                  </p>
                )}

                <div className="seller-order-card__items">
                  {order.items.map((item) => {
                    const itemKey = `${order.groupKey}-${item._id}`;
                    return (
                      <div key={item._id} className="seller-order-item">
                        <label className="seller-order-item__check">
                          <input
                            type="checkbox"
                            checked={Boolean(completedMap[itemKey])}
                            onChange={() =>
                              toggleCompleted(order.groupKey, item._id)
                            }
                          />
                          <span className="seller-order-item__title">
                            {item.title}
                          </span>
                          <span className="seller-order-item__quantity">
                            × {item.quantity}
                          </span>
                          <strong>NT$ {item.price * item.quantity}</strong>
                        </label>
                        {Number(item.basePrice) !== Number(item.price) && (
                          <small className="seller-order-item__base-price">
                            原品項 NT$ {item.basePrice}，調整後單價 NT${" "}
                            {item.price}
                          </small>
                        )}
                        <ProductSelectionSummary
                          selectedOptions={item.selectedOptions}
                          specialRequest={item.specialRequest}
                          noteLabel={item.noteLabel}
                        />
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  className={`btn ${
                    allCompleted ? "btn-success" : "btn-outline-secondary"
                  }`}
                  onClick={() => completeOrder(order)}
                >
                  {allCompleted ? "完成此訂單" : "尚有品項未完成"}
                </button>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SellerOrderComponent;
