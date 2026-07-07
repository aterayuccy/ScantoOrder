import { useEffect, useState } from "react";

const SubmitComponent = () => {
  const [submittedOrder, setSubmittedOrder] = useState(null);

  useEffect(() => {
    const savedOrder = sessionStorage.getItem("submittedOrder");
    if (savedOrder) {
      setSubmittedOrder(JSON.parse(savedOrder));
    }
  }, []);

  return (
    <div className="order-summary-page">
      <div className="order-summary-panel">
        <h2 style={{ marginBottom: "2rem", textAlign: "center" }}>訂單明細</h2>

        {submittedOrder && submittedOrder.orderData.length !== 0 ? (
          <div className="order-summary-table-wrap">
            <table className="table table-bordered order-summary-table">
              <thead>
                <tr>
                  <th>餐點</th>
                  <th>價格</th>
                  <th>數量</th>
                </tr>
              </thead>
              <tbody>
                {submittedOrder.orderData.map((item) => (
                  <tr key={item._id}>
                    <td>{item.title}</td>
                    <td>{item.price}</td>
                    <td>{item.quantity}</td>
                  </tr>
                ))}
                <tr>
                  <td>
                    <strong>總金額</strong>
                  </td>
                  <td>
                    <strong>{submittedOrder.totalAmount}</strong>
                  </td>
                  <td>
                    <strong>{submittedOrder.orderTime}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ textAlign: "center" }}>目前沒有訂單資料</p>
        )}
      </div>
    </div>
  );
};

export default SubmitComponent;
