import { useEffect, useState } from "react";

import ProductSelectionSummary from "./product-selection-summary";

const OrderConfirmationComponent = () => {
  const [submittedOrder, setSubmittedOrder] = useState(null);

  useEffect(() => {
    try {
      const savedOrder = sessionStorage.getItem("submittedOrder");
      if (savedOrder) setSubmittedOrder(JSON.parse(savedOrder));
    } catch (error) {
      console.error("Unable to read submitted order", error);
    }
  }, []);

  const items = submittedOrder?.orderData || [];
  const payment = submittedOrder?.payment;
  const paymentMethodLabel =
    payment?.method === "line_pay" ? "LINE Pay" : "店內付款";
  const paymentStatusLabel = payment?.status === "paid" ? "已付款" : "到店付款";

  return (
    <div className="order-summary-page">
      <div className="order-summary-panel">
        <div className="order-confirmation-heading">
          <span className="order-confirmation-icon" aria-hidden="true">
            ✓
          </span>
          <p className="product-form-eyebrow">已傳送至店家</p>
          <h2>訂單送出成功</h2>
          {submittedOrder?.orderTime && (
            <p>送出時間：{submittedOrder.orderTime}</p>
          )}
        </div>

        {items.length > 0 ? (
          <>
            <div className="submitted-item-list">
              {items.map((item) => (
                <article key={item._id} className="submitted-item">
                  <div className="submitted-item-heading">
                    <div>
                      <h3>{item.title}</h3>
                      <span>
                        NT$ {item.price} × {item.quantity}
                      </span>
                      {Number(item.basePrice) !== Number(item.price) && (
                        <span>原品項 NT$ {item.basePrice}</span>
                      )}
                    </div>
                    <strong>NT$ {item.lineTotal}</strong>
                  </div>
                  <ProductSelectionSummary
                    selectedOptions={item.selectedOptions}
                    specialRequest={item.specialRequest}
                    noteLabel={item.noteLabel}
                  />
                </article>
              ))}
            </div>
            <div className="submitted-order-total">
              <span>訂單合計</span>
              <strong>NT$ {submittedOrder.totalAmount}</strong>
            </div>
            {payment && (
              <section className="submitted-payment-summary">
                <div>
                  <span>付款方式</span>
                  <strong>{paymentMethodLabel}</strong>
                </div>
                <div>
                  <span>付款狀態</span>
                  <strong
                    className={
                      payment.status === "paid"
                        ? "status-text status-text--paid"
                        : "status-text status-text--pending"
                    }
                  >
                    {paymentStatusLabel}
                  </strong>
                </div>
                <div>
                  <span>發票載具</span>
                  <strong>
                    {payment.invoicePreference === "mobile_carrier"
                      ? payment.mobileCarrier
                      : "不使用載具"}
                  </strong>
                </div>
              </section>
            )}
          </>
        ) : (
          <p className="empty-state">目前沒有訂單資料。</p>
        )}
      </div>
    </div>
  );
};

export default OrderConfirmationComponent;
