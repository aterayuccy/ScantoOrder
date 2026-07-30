import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useOrderNotifications } from "../notifications/order-notification-context";
import ProductService from "../services/product.service";
import PaymentService from "../services/payment.service";
import AuthService from "../services/auth.service";
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

const ORDER_STATUS_LABELS = {
  new: "新訂單",
  accepted: "已接單",
  preparing: "製作中",
  completed: "已完成",
  cancelled: "已取消",
};

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
  const { notificationsEnabled, toggleOrderNotifications } =
    useOrderNotifications();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [completedMap, setCompletedMap] = useState({});
  const [message, setMessage] = useState("");
  const [acceptingOrders, setAcceptingOrders] = useState(true);
  const [dailyStats, setDailyStats] = useState({
    orderCount: 0,
    orderAmount: 0,
    itemCount: 0,
    completedCount: 0,
    pendingStorePaymentCount: 0,
    popularItems: [],
  });
  const handleToggleOrderNotifications = async () => {
    setMessage(await toggleOrderNotifications());
  };

  useEffect(() => {
    if (!currentUser?.user || currentUser.user.role !== "seller") {
      setLoading(false);
      return undefined;
    }

    let active = true;
    AuthService.getSellerSettings()
      .then((response) => {
        if (active) setAcceptingOrders(response.data.acceptingOrders);
      })
      .catch((error) => console.error("seller settings failed:", error));
    const loadDailyStats = () => {
      PaymentService.getSellerDailyStats()
        .then((response) => {
          if (active) setDailyStats(response.data);
        })
        .catch((error) => {
          console.error("daily order stats failed:", error);
        });
    };
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
            const nextOrders = buildOrderGroups(
              productResponse.data,
              paymentResponse.data
            );
            setOrders(nextOrders);
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
    loadDailyStats();
    const intervalId = window.setInterval(loadOrders, 3000);
    const statsIntervalId = window.setInterval(loadDailyStats, 15000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.clearInterval(statsIntervalId);
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
      if (order.payment && order.orderBatchId) {
        await PaymentService.updateOrderStatus(order.orderBatchId, "completed");
      } else if (order.orderBatchId) {
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

  const setOrderStatus = async (order, status) => {
    try {
      const response = await PaymentService.updateOrderStatus(
        order.orderBatchId,
        status
      );
      if (["completed", "cancelled"].includes(status)) {
        setOrders((current) =>
          current.filter((item) => item.groupKey !== order.groupKey)
        );
      } else {
        updateOrderPayment(order.orderBatchId, response.data.payment);
      }
    } catch (error) {
      console.error(error);
      window.alert(error.response?.data || "訂單狀態更新失敗");
    }
  };

  const cancelOrder = async (order) => {
    const paidWarning =
      order.payment?.status === "paid"
        ? "這張訂單已付款，系統不會自動退款，請由店家另外處理退款。\n\n"
        : "";
    if (!window.confirm(`${paidWarning}確定要取消這張訂單嗎？`)) return;
    await setOrderStatus(order, "cancelled");
  };

  const toggleAcceptingOrders = async () => {
    try {
      const response = await AuthService.updateSellerSettings({
        acceptingOrders: !acceptingOrders,
      });
      setAcceptingOrders(response.data.acceptingOrders);
      setMessage(
        response.data.acceptingOrders
          ? "已恢復接單"
          : "已暫停接單，顧客目前無法加入購物車或送單"
      );
    } catch (error) {
      setMessage(error.response?.data || "接單狀態更新失敗");
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
        <div className="seller-order-heading-actions">
          <button
            type="button"
            className={`btn ${
              acceptingOrders ? "btn-outline-danger" : "btn-success"
            }`}
            onClick={toggleAcceptingOrders}
          >
            {acceptingOrders ? "暫停接單" : "恢復接單"}
          </button>
          <button
            type="button"
            className={`btn ${
              notificationsEnabled
                ? "btn-outline-success"
                : "btn-outline-secondary"
            }`}
            onClick={handleToggleOrderNotifications}
          >
            {notificationsEnabled ? "🔔 新訂單提示已開啟" : "開啟新訂單提示"}
          </button>
          <span className="seller-order-count">{orderCount} 張待處理</span>
        </div>
      </div>

      {message && <div className="alert alert-warning">{message}</div>}

      <section className="seller-daily-stats" aria-label="今日訂單統計">
        <article>
          <span>今日訂單</span>
          <strong>{dailyStats.orderCount} 張</strong>
          <small>{dailyStats.itemCount} 個品項</small>
        </article>
        <article>
          <span>今日訂單金額</span>
          <strong>
            NT$ {Number(dailyStats.orderAmount || 0).toLocaleString("zh-TW")}
          </strong>
          <small>包含店內付款、收款碼與 LINE Pay</small>
        </article>
        <article>
          <span>已完成</span>
          <strong>{dailyStats.completedCount} 張</strong>
          <small>{dailyStats.pendingStorePaymentCount} 張店內付款待收款</small>
        </article>
        <article>
          <span>今日熱門</span>
          <strong>{dailyStats.popularItems?.[0]?.title || "尚無資料"}</strong>
          <small>
            {dailyStats.popularItems?.[0]
              ? `${dailyStats.popularItems[0].quantity} 份`
              : "有訂單後會自動統計"}
          </small>
        </article>
      </section>

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
                    <span className="order-status-label">
                      {ORDER_STATUS_LABELS[
                        order.payment?.orderStatus || "new"
                      ] || "新訂單"}
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
                            : order.payment.method === "merchant_qr"
                              ? "店家收款碼"
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
                      {["pay_at_store", "awaiting_confirmation"].includes(
                        order.payment.status
                      ) && (
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

                {order.payment ? (
                  <div className="order-status-actions">
                    {(order.payment.orderStatus || "new") === "new" && (
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => setOrderStatus(order, "accepted")}
                      >
                        接受訂單
                      </button>
                    )}
                    {order.payment.orderStatus === "accepted" && (
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => setOrderStatus(order, "preparing")}
                      >
                        開始製作
                      </button>
                    )}
                    {order.payment.orderStatus === "preparing" && (
                      <button
                        type="button"
                        className={`btn ${
                          allCompleted ? "btn-success" : "btn-outline-secondary"
                        }`}
                        onClick={() => completeOrder(order)}
                      >
                        {allCompleted ? "完成此訂單" : "尚有品項未完成"}
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-outline-danger"
                      onClick={() => cancelOrder(order)}
                    >
                      取消訂單
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className={`btn ${
                      allCompleted ? "btn-success" : "btn-outline-secondary"
                    }`}
                    onClick={() => completeOrder(order)}
                  >
                    {allCompleted ? "完成此訂單" : "尚有品項未完成"}
                  </button>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SellerOrderComponent;
