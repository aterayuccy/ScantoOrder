import axios from "axios";

const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL ||
  (window.location.port === "3000"
    ? `${window.location.protocol}//${window.location.hostname}:8080`
    : window.location.origin);
const API_URL = `${API_BASE_URL}/api/payment`;

const getStoredUser = (storage, key) => {
  try {
    const value = storage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    return null;
  }
};

const getBuyerHeaders = () => {
  const qrUser = getStoredUser(sessionStorage, "qrUser");
  const localUser = getStoredUser(localStorage, "user");
  return {
    Authorization: `jwt ${qrUser?.token || localUser?.token || ""}`,
  };
};

const getSellerHeaders = () => {
  const sellerUser = getStoredUser(localStorage, "sellerUser");
  const localUser = getStoredUser(localStorage, "user");
  const current = sellerUser?.user?.role === "seller" ? sellerUser : localUser;
  return {
    Authorization: `jwt ${current?.token || ""}`,
  };
};

class PaymentService {
  getMode() {
    return axios.get(`${API_URL}/mode`);
  }

  checkout(data) {
    return axios.post(`${API_URL}/checkout`, data, {
      headers: getBuyerHeaders(),
    });
  }

  getBuyerPayment(orderId) {
    return axios.get(`${API_URL}/buyer/${encodeURIComponent(orderId)}`, {
      headers: getBuyerHeaders(),
    });
  }

  confirm(orderId, transactionId = "") {
    return axios.post(
      `${API_URL}/confirm`,
      { orderId, transactionId },
      { headers: getBuyerHeaders() }
    );
  }

  cancel(orderId) {
    return axios.post(
      `${API_URL}/cancel`,
      { orderId },
      { headers: getBuyerHeaders() }
    );
  }

  getSellerPayments() {
    return axios.get(`${API_URL}/seller`, {
      headers: getSellerHeaders(),
    });
  }

  getSellerDailyStats() {
    return axios.get(`${API_URL}/seller/stats/today`, {
      headers: getSellerHeaders(),
    });
  }

  markStorePaymentPaid(orderBatchId) {
    return axios.patch(
      `${API_URL}/seller/${encodeURIComponent(orderBatchId)}/mark-paid`,
      {},
      { headers: getSellerHeaders() }
    );
  }

  markInvoiceProcessed(orderBatchId) {
    return axios.patch(
      `${API_URL}/seller/${encodeURIComponent(orderBatchId)}/invoice-processed`,
      {},
      { headers: getSellerHeaders() }
    );
  }

  updateOrderStatus(orderBatchId, status) {
    return axios.patch(
      `${API_URL}/seller/${encodeURIComponent(orderBatchId)}/status`,
      { status },
      { headers: getSellerHeaders() }
    );
  }
}

const paymentService = new PaymentService();

export default paymentService;
