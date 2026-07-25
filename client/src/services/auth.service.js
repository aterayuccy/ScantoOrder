import axios from "axios";

const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL ||
  `${window.location.protocol}//${window.location.hostname}:8080`;
const API_URL = `${API_BASE_URL}/api/user`;
const LOCAL_USER_KEY = "user";
const QR_USER_KEY = "qrUser";
const SELLER_USER_KEY = "sellerUser";
const QR_BUYER_NAV_KEY = "qrBuyerNavigation";

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

  return pathname === "/" || pathname === "/product" || pathname === "/submit";
};
const isHomePage = () => window.location.pathname === "/";
const isAuthPage = () =>
  window.location.pathname === "/login" ||
  window.location.pathname === "/register";
const takeQrBuyerNavigation = () => {
  const isQrBuyerNavigation = sessionStorage.getItem(QR_BUYER_NAV_KEY) === "1";

  if (isQrBuyerNavigation) {
    sessionStorage.removeItem(QR_BUYER_NAV_KEY);
  }

  return isQrBuyerNavigation;
};
const getCurrentSessionUser = () => {
  const sellerUser = getStoredSellerUser();
  const qrUser = getQrUser();

  if (isAuthPage()) {
    return null;
  }

  if (isHomePage() && !takeQrBuyerNavigation()) {
    if (qrUser) {
      sessionStorage.removeItem(QR_USER_KEY);
    }

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
    if (sessionStorage.getItem(QR_USER_KEY)) {
      sessionStorage.removeItem(QR_USER_KEY);
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

  getCurrentUser() {
    return getCurrentSessionUser();
  }

  setQrUser(user) {
    sessionStorage.setItem(QR_USER_KEY, JSON.stringify(user));
  }

  markQrBuyerNavigation() {
    if (sessionStorage.getItem(QR_USER_KEY)) {
      sessionStorage.setItem(QR_BUYER_NAV_KEY, "1");
    }
  }

  clearQrUser() {
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
    return axios.post(API_URL + "/qr-login", { qrToken });
  }

}

const authService = new AuthService();

export default authService;
