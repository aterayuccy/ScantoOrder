import axios from "axios";

const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL ||
  (window.location.port === "3000"
    ? `${window.location.protocol}//${window.location.hostname}:8080`
    : window.location.origin);
const API_URL = `${API_BASE_URL}/api/admin`;

const adminHeaders = (adminKey) => ({
  "x-support-admin-key": adminKey,
});

class PlatformAdminService {
  listStores(adminKey) {
    return axios.get(`${API_URL}/stores`, {
      headers: adminHeaders(adminKey),
    });
  }

  getSubscriptionSettings(adminKey) {
    return axios.get(`${API_URL}/subscription-settings`, {
      headers: adminHeaders(adminKey),
    });
  }

  updateSubscriptionSettings(adminKey, input) {
    const formData = new FormData();
    formData.append("monthlyFee", String(input.monthlyFee));
    formData.append("payeeName", input.payeeName || "");
    formData.append("paymentInstructions", input.paymentInstructions || "");
    if (input.image) formData.append("image", input.image);

    return axios.patch(`${API_URL}/subscription-settings`, formData, {
      headers: adminHeaders(adminKey),
    });
  }

  confirmStoreRenewal(adminKey, sellerId) {
    return axios.post(
      `${API_URL}/stores/${encodeURIComponent(sellerId)}/subscription/confirm`,
      {},
      { headers: adminHeaders(adminKey) }
    );
  }

  rejectStoreRenewal(adminKey, sellerId, message = "") {
    return axios.post(
      `${API_URL}/stores/${encodeURIComponent(sellerId)}/subscription/reject`,
      { message },
      { headers: adminHeaders(adminKey) }
    );
  }

  setStoreRenewalTestWindow(adminKey, sellerId) {
    return axios.post(
      `${API_URL}/stores/${encodeURIComponent(sellerId)}/subscription/test-window`,
      {},
      { headers: adminHeaders(adminKey) }
    );
  }

  suspendStore(adminKey, sellerId) {
    return axios.post(
      `${API_URL}/stores/${encodeURIComponent(sellerId)}/subscription/suspend`,
      {},
      { headers: adminHeaders(adminKey) }
    );
  }
}

const platformAdminService = new PlatformAdminService();

export default platformAdminService;
