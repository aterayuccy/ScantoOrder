import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ProductService from "../services/product.service";

const OrderComponent = ({ currentUser }) => {
  const navigate = useNavigate();
  const [groupedOrders, setGroupedOrders] = useState({});
  const [loading, setLoading] = useState(true);
  const [completedMap, setCompletedMap] = useState({});

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    const loadOrders = () => {
      ProductService.get(currentUser.user._id)
        .then((res) => {
          const products = res.data;
          const grouped = {};

          products.forEach((product) => {
            if (!product.buyer || product.buyer.length === 0) return;

            product.buyer.forEach((buyerItem) => {
              if (!buyerItem.submittedAt) return;

              const buyerId =
                typeof buyerItem.user === "string"
                  ? buyerItem.user
                  : buyerItem.user?._id || "unknown";
              const tableNumber = buyerItem.tableNumber || null;
              const groupKey = tableNumber ? `table-${tableNumber}` : `buyer-${buyerId}`;

              if (!grouped[groupKey]) {
                grouped[groupKey] = {
                  buyerId,
                  buyerIds: [],
                  tableNumber,
                  items: [],
                };
              }

              if (!grouped[groupKey].buyerIds.includes(buyerId)) {
                grouped[groupKey].buyerIds.push(buyerId);
              }

              grouped[groupKey].items.push({
                title: product.title,
                price: Number(product.price || 0),
                quantity: Number(buyerItem.quantity || 0),
                orderTime: new Date(buyerItem.submittedAt).toLocaleString("zh-TW", {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: false,
                }),
              });
            });
          });

          setGroupedOrders(grouped);
          setLoading(false);
        })
        .catch((e) => {
          console.log(e);
          setLoading(false);
        });
    };

    loadOrders();
    const intervalId = setInterval(loadOrders, 3000);

    return () => clearInterval(intervalId);
  }, [currentUser]);

  const getOrderTotal = (items) => {
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  };

  const handleCheckChange = (groupKey, index) => {
    const key = `${groupKey}-${index}`;
    setCompletedMap((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleDeleteOrder = (groupKey, orderGroup) => {
    const allCompleted = orderGroup.items.every((_, index) => {
      const key = `${groupKey}-${index}`;
      return !!completedMap[key];
    });

    if (!allCompleted) {
      window.alert("訂單尚未全部完成");
      return;
    }

    if (!window.confirm("確定要刪除這筆訂單嗎？")) return;

    const deleteRequest = orderGroup.tableNumber
      ? ProductService.deleteSellerTableOrder(orderGroup.tableNumber)
      : ProductService.deleteSellerOrder(orderGroup.buyerId);

    deleteRequest
      .then(() => {
        window.alert("刪除成功");

        setGroupedOrders((prev) => {
          const newOrders = { ...prev };
          delete newOrders[groupKey];
          return newOrders;
        });

        setCompletedMap((prev) => {
          const newMap = { ...prev };
          Object.keys(newMap).forEach((key) => {
            if (key.startsWith(`${groupKey}-`)) {
              delete newMap[key];
            }
          });
          return newMap;
        });
      })
      .catch((e) => {
        console.log(e);
        window.alert("刪除失敗");
      });
  };

  if (!currentUser) {
    return (
      <div style={{ padding: "3rem" }}>
        <p>請先登入</p>
        <button className="btn btn-primary" onClick={() => navigate("/login")}>
          前往登入頁面
        </button>
      </div>
    );
  }

  if (loading) {
    return <div style={{ padding: "3rem" }}>載入中...</div>;
  }

  return (
    <div style={{ padding: "3rem" }}>
      <h2 style={{ marginBottom: "2rem" }}>店家訂單資訊</h2>

      {Object.keys(groupedOrders).length === 0 ? (
        <p>目前沒有訂單</p>
      ) : (
        Object.entries(groupedOrders).map(([groupKey, orderGroup]) => (
          <div
            key={groupKey}
            className="card"
            style={{ margin: "2rem", maxWidth: "60rem" }}
          >
            <div className="card-body">
              <h5 style={{ marginBottom: "1rem" }}>
                {orderGroup.tableNumber
                  ? `桌號 ${orderGroup.tableNumber}`
                  : `買家 ID：${orderGroup.buyerId}`}
              </h5>

              <table
                className="table table-bordered"
                style={{
                  margin: "1rem",
                  maxWidth: "56rem",
                  width: "100%",
                  tableLayout: "fixed",
                }}
              >
                <thead>
                  <tr>
                    <th>餐點</th>
                    <th>價格</th>
                    <th>數量</th>
                    <th>餐點狀態</th>
                  </tr>
                </thead>
                <tbody>
                  {orderGroup.items.map((item, index) => {
                    const key = `${groupKey}-${index}`;

                    return (
                      <tr key={key}>
                        <td>{item.title}</td>
                        <td>{item.price}</td>
                        <td>{item.quantity}</td>
                        <td>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "0.5rem",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={!!completedMap[key]}
                              onChange={() => handleCheckChange(groupKey, index)}
                            />
                            <span>完成</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  <tr>
                    <td>
                      <strong>總金額</strong>
                    </td>
                    <td>{getOrderTotal(orderGroup.items)}</td>
                    <td>
                      <strong>{orderGroup.items[0]?.orderTime || "尚未送出"}</strong>
                    </td>
                    <td>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDeleteOrder(groupKey, orderGroup)}
                      >
                        刪除訂單
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default OrderComponent;
