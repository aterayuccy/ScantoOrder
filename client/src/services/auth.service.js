import axios from "axios";

const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL ||
  (window.location.port === "3000"
    ? `${window.location.protocol}//${window.location.hostname}:8080`
    : window.location.origin);
const API_URL = `${API_BASE_URL}/api/user`;
const LOCAL_USER_KEY = "user";
const QR_USER_KEY = "qrUser";
const SELLER_USER_KEY = "sellerUser";
const QR_CLIENT_SESSION_KEY = "qrClientSessionId";

const createClientSessionId = () => {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID().replaceAll("-", "_");
  }

  const bytes = new Uint8Array(24);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join(
    ""
  );
};

const getQrClientSessionId = () => {
  const existing = localStorage.getItem(QR_CLIENT_SESSION_KEY);
  if (existing) return existing;

  const clientSessionId = createClientSessionId();
  localStorage.setItem(QR_CLIENT_SESSION_KEY, clientSessionId);
  return clientSessionId;
};

const getStoredUser = (storage, key) => {
  try {
    const value = storage.getItem(key);
    if (!value) {
      return null;
    }

    const storedUser = JSON.parse(value);

    if (!Number.isInteger(storedUser?.authVersion)) {
      storage.removeItem(key);
      return null;
    }

    return storedUser;
  } catch (e) {
    return null;
  }
};

const getLocalUser = () => getStoredUser(localStorage, LOCAL_USER_KEY);
const getQrUser = () => getStoredUser(sessionStorage, QR_USER_KEY);
const getSellerUser = () => getStoredUser(localStorage, SELLER_USER_KEY);
const getStoredSellerUser = () => {
  const sellerUser = getSellerUser();
  const localUser = getLocalUser();

  if (sellerUser?.user?.role === "seller") {
    return sellerUser;
  }

  return localUser?.user?.role === "seller" ? localUser : null;
};
const isBuyerPage = () => {
  const pathname = window.location.pathname;

  return (
    pathname === "/" ||
    pathname === "/profile" ||
    pathname === "/product" ||
    pathname === "/submit" ||
    pathname === "/payment/line-pay"
  );
};
const isAuthPage = () =>
  window.location.pathname === "/login" ||
  window.location.pathname === "/register" ||
  window.location.pathname === "/forgot-password";
const getCurrentSessionUser = () => {
  const sellerUser = getStoredSellerUser();
  const qrUser = getQrUser();

  if (isAuthPage()) {
    return null;
  }

  if (isBuyerPage()) {
    return qrUser || sellerUser;
  }

  return sellerUser;
};
const getSellerToken = (currentUser) => {
  if (currentUser?.user?.role === "seller") {
    return currentUser.token || "";
  }

  const sellerUser = getSellerUser();
  if (sellerUser?.user?.role === "seller") {
    return sellerUser.token || "";
  }

  const localUser = getLocalUser();
  return localUser?.user?.role === "seller" ? localUser.token || "" : "";
};

class AuthService {
  login(username, password) {
    return axios.post(API_URL + "/login", {
      username,
      password,
    });
  }

  logout() {
    sessionStorage.removeItem("submittedOrder");
    sessionStorage.removeItem("pendingCheckoutToken");
    sessionStorage.removeItem("pendingPaymentOrder");
    if (sessionStorage.getItem(QR_USER_KEY)) {
      sessionStorage.removeItem(QR_USER_KEY);
      localStorage.removeItem(QR_CLIENT_SESSION_KEY);
    } else {
      localStorage.removeItem(LOCAL_USER_KEY);
      localStorage.removeItem(SELLER_USER_KEY);
    }
  }

  register(username, password) {
    return axios.post(API_URL + "/register", {
      username,
      password,
    });
  }

  resetPassword(username, recoveryCode, newPassword) {
    return axios.post(API_URL + "/forgot-password", {
      username,
      recoveryCode,
      newPassword,
    });
  }

  changePassword(currentPassword, newPassword) {
    return axios.post(
      API_URL + "/change-password",
      { currentPassword, newPassword },
      {
        headers: {
          Authorization: "jwt " + getSellerToken(),
        },
      }
    );
  }

  regenerateRecoveryCode(password) {
    return axios.post(
      API_URL + "/recovery-code",
      { password },
      {
        headers: {
          Authorization: "jwt " + getSellerToken(),
        },
      }
    );
  }

  deleteAccount(password) {
    return axios.delete(API_URL + "/account", {
      headers: {
        Authorization: "jwt " + getSellerToken(),
      },
      data: { password },
    });
  }

  getSellerSettings() {
    return axios.get(API_URL + "/settings", {
      headers: {
        Authorization: "jwt " + getSellerToken(),
      },
    });
  }

  getStoreSettings(sellerId, currentUser) {
    return axios.get(API_URL + "/store/" + encodeURIComponent(sellerId), {
      headers: {
        Authorization:
          "jwt " +
          (currentUser?.user?.role === "seller"
            ? getSellerToken(currentUser)
            : getQrUser()?.token || ""),
      },
    });
  }

  updateSellerSettings({
    acceptingOrders,
    linePayMerchantReady,
    linePayChannelId,
    linePayChannelSecret,
  }) {
    return axios.patch(
      API_URL + "/settings",
      {
        acceptingOrders,
        linePayMerchantReady,
        linePayChannelId,
        linePayChannelSecret,
      },
      {
        headers: {
          Authorization: "jwt " + getSellerToken(),
        },
      }
    );
  }

  getCurrentUser() {
    return getCurrentSessionUser();
  }

  setQrUser(user) {
    sessionStorage.removeItem("submittedOrder");
    sessionStorage.removeItem("pendingCheckoutToken");
    sessionStorage.removeItem("pendingPaymentOrder");
    sessionStorage.setItem(QR_USER_KEY, JSON.stringify(user));
  }

  markQrBuyerNavigation() {
    // QR 顧客身分會保留到分頁關閉或登出，不需額外導覽旗標。
  }

  clearQrUser() {
    sessionStorage.removeItem("submittedOrder");
    sessionStorage.removeItem("pendingCheckoutToken");
    sessionStorage.removeItem("pendingPaymentOrder");
    sessionStorage.removeItem(QR_USER_KEY);
  }

  setLocalUser(user) {
    this.clearQrUser();
    localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(user));
    this.setSellerUser(user);
  }

  setSellerUser(user) {
    if (user?.user?.role === "seller") {
      localStorage.setItem(SELLER_USER_KEY, JSON.stringify(user));
    }
  }

  getQrCodes(currentUser) {
    const token = getSellerToken(currentUser);

    return axios.get(API_URL + "/qr-codes", {
      headers: {
        Authorization: "jwt " + token,
      },
    });
  }

  createQrToken(count, currentUser) {
    const token = getSellerToken(currentUser);

    return axios.post(
      API_URL + "/create-qr-token",
      { count },
      {
        headers: {
          Authorization: "jwt " + token,
        },
      }
    );
  }

  deleteQrCode(qrCodeId, currentUser) {
    const token = getSellerToken(currentUser);

    return axios.delete(API_URL + "/qr-codes/" + qrCodeId, {
      headers: {
        Authorization: "jwt " + token,
      },
    });
  }

  qrLogin(qrToken) {
    return axios.post(API_URL + "/qr-login", {
      qrToken,
      clientSessionId: getQrClientSessionId(),
    });
  }
}

const authService = new AuthService();

export default authService;
