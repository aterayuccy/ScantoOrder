import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import PaymentService from "../services/payment.service";

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

const readPendingOrder = () => {
  try {
    const value = sessionStorage.getItem("pendingPaymentOrder");
    return value ? JSON.parse(value) : null;
  } catch (error) {
    return null;
  }
};

const buildFallbackOrderData = (payment) =>
  (payment?.items || []).map((item) => ({
    _id: item.lineItemId,
    title: item.title,
    basePrice: item.unitPrice,
    price: item.unitPrice,
    quantity: item.quantity,
    lineTotal: item.lineTotal,
    selectedOptions: [],
    specialRequest: "",
    noteLabel: "備註或特殊需求",
  }));

const LinePayComponent = ({ currentUser }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const handledCallback = useRef(false);
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");

  const orderId = searchParams.get("orderId") || "";
  const transactionId = searchParams.get("transactionId") || "";
  const isMock = searchParams.get("mock") === "1";
  const isCancelled = searchParams.get("cancel") === "1";

  const finishPayment = useCallback((response) => {
    const pendingOrder = readPendingOrder();
    const paidPayment = response.data.payment;
    sessionStorage.setItem(
      "submittedOrder",
      JSON.stringify({
        orderData:
          pendingOrder?.orderData || buildFallbackOrderData(paidPayment),
        totalAmount: paidPayment.amount,
        orderTime: formatOrderTime(response.data.submittedAt),
        orderBatchId: response.data.orderBatchId,
        payment: paidPayment,
      })
    );
    sessionStorage.removeItem("pendingPaymentOrder");
    sessionStorage.removeItem("pendingCheckoutToken");
    navigate("/submit", { replace: true });
  }, [navigate]);

  const confirmPayment = async () => {
    if (!orderId || confirming) return;
    setConfirming(true);
    setError("");
    try {
      const response = await PaymentService.confirm(
        orderId,
        transactionId
      );
      finishPayment(response);
    } catch (requestError) {
      const data = requestError?.response?.data;
      setError(
        typeof data === "string"
          ? data
          : data?.message || "付款確認失敗，請稍後再試"
      );
      setConfirming(false);
    }
  };

  const cancelPayment = async () => {
    if (!orderId) return;
    setConfirming(true);
    try {
      await PaymentService.cancel(orderId);
    } catch (requestError) {
      console.error(requestError);
    } finally {
      sessionStorage.removeItem("pendingPaymentOrder");
      sessionStorage.removeItem("pendingCheckoutToken");
      navigate("/product", { replace: true });
    }
  };

  useEffect(() => {
    if (
      handledCallback.current ||
      !currentUser?.user ||
      currentUser.user.role !== "buyer" ||
      !orderId
    ) {
      setLoading(false);
      return;
    }
    handledCallback.current = true;

    if (isCancelled) {
      PaymentService.cancel(orderId)
        .catch((requestError) => console.error(requestError))
        .finally(() => {
          sessionStorage.removeItem("pendingPaymentOrder");
          sessionStorage.removeItem("pendingCheckoutToken");
          setLoading(false);
        });
      return;
    }

    PaymentService.getBuyerPayment(orderId)
      .then((response) => {
        setPayment(response.data);
        if (!isMock && transactionId) {
          setLoading(false);
          setConfirming(true);
          return PaymentService.confirm(orderId, transactionId).then(
            finishPayment
          );
        }
        setLoading(false);
        return null;
      })
      .catch((requestError) => {
        const data = requestError?.response?.data;
        setError(
          typeof data === "string"
            ? data
            : data?.message || "無法載入付款資料"
        );
        setLoading(false);
        setConfirming(false);
      });
  }, [
    currentUser,
    finishPayment,
    isCancelled,
    isMock,
    orderId,
    transactionId,
  ]);

  if (!currentUser?.user || currentUser.user.role !== "buyer") {
    return (
      <div className="payment-return-page">
        <div className="payment-return-card">
          <h2>請從掃描點餐流程進入付款頁面</h2>
        </div>
      </div>
    );
  }

  if (loading || confirming) {
    return (
      <div className="payment-return-page">
        <div className="payment-return-card payment-return-card--center">
          <span className="payment-spinner" aria-hidden="true" />
          <h2>{confirming ? "正在確認付款…" : "正在載入付款資料…"}</h2>
          <p>請不要關閉或重新整理頁面。</p>
        </div>
      </div>
    );
  }

  if (isCancelled) {
    return (
      <div className="payment-return-page">
        <div className="payment-return-card payment-return-card--center">
          <span className="payment-result-icon payment-result-icon--cancel">
            ×
          </span>
          <h2>付款已取消</h2>
          <p>購物車內容仍然保留，可以重新選擇付款方式。</p>
          <button
            className="btn btn-primary"
            onClick={() => navigate("/product", { replace: true })}
          >
            返回購物車
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="payment-return-page">
      <div className="payment-return-card">
        <div className="line-pay-brand">
          <span>LINE Pay</span>
          <small>展示付款</small>
        </div>
        <p className="payment-demo-notice">
          目前為作品展示模式，不會扣除任何真實款項。
        </p>

        {error && <div className="alert alert-warning">{error}</div>}

        <dl className="payment-detail-list">
          <div>
            <dt>訂單編號</dt>
            <dd>{payment?.orderId || orderId}</dd>
          </div>
          <div>
            <dt>桌號</dt>
            <dd>{payment?.tableNumber || "—"}</dd>
          </div>
          <div>
            <dt>付款金額</dt>
            <dd className="payment-amount">NT$ {payment?.amount || 0}</dd>
          </div>
        </dl>

        <div className="payment-return-actions">
          <button
            type="button"
            className="btn btn-outline-secondary"
            disabled={confirming}
            onClick={cancelPayment}
          >
            取消付款
          </button>
          <button
            type="button"
            className="btn line-pay-button"
            disabled={confirming}
            onClick={confirmPayment}
          >
            模擬付款 NT$ {payment?.amount || 0}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LinePayComponent;
