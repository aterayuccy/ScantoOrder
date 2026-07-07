import axios from "axios";

const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL ||
  `${window.location.protocol}//${window.location.hostname}:8080`;
const API_URL = `${API_BASE_URL}/api/product`;

export const UPLOADS_URL = `${API_BASE_URL}/uploads`;

const getStoredUser = (storage, key) => {
  try {
    const value = storage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch (e) {
    return null;
  }
};

const getQrUser = () => getStoredUser(sessionStorage, "qrUser");
const getLocalUser = () => getStoredUser(localStorage, "user");
const getSellerUser = () => getStoredUser(localStorage, "sellerUser");
const getStoredSellerUser = () => {
  const sellerUser = getSellerUser();
  const localUser = getLocalUser();

  if (sellerUser?.user?.role === "seller") {
    return sellerUser;
  }

  return localUser?.user?.role === "seller" ? localUser : null;
};

const getCurrentUser = () => getQrUser() || getLocalUser() || null;

const getTableNumber = () => {
  const currentUser = getCurrentUser();
  return currentUser?.tableNumber || currentUser?.user?.tableNumber || null;
};

const getSellerJwtHeaders = () => ({
  Authorization: "jwt " + (getStoredSellerUser()?.token || ""),
});

const getBuyerJwtHeaders = () => ({
  Authorization: "jwt " + (getQrUser()?.token || getLocalUser()?.token || ""),
});

class ProductService {
  post(title, description, price, type, image) {
    const formData = new FormData();
    formData.append("title", title);
    formData.append("description", description || "");
    formData.append("price", price);
    formData.append("type", type);
    if (image) {
      formData.append("image", image);
    }

    return axios.post(API_URL, formData, {
      headers: {
        ...getSellerJwtHeaders(),
        "Content-Type": "multipart/form-data",
      },
    });
  }

  getEnrolledProduct(_id) {
    return axios.get(API_URL + "/buyer/" + _id, {
      headers: getBuyerJwtHeaders(),
    });
  }

  get(_id) {
    return axios.get(API_URL + "/seller/" + _id, {
      headers: getSellerJwtHeaders(),
    });
  }

  getMenuProducts(currentUser) {
    const user = currentUser?.user;
    const sellerId =
      user?.role === "seller"
        ? user._id
        : currentUser?.sellerId || user?.qrSeller || null;

    if (sellerId) {
      return this.get(sellerId);
    }

    return Promise.resolve({ data: [] });
  }

  getProductByName(name) {
    return axios.get(API_URL + "/findByName/" + name, {
      headers: getSellerJwtHeaders(),
    });
  }

  getProductById(_id) {
    return axios.get(API_URL + "/" + _id, {
      headers: getSellerJwtHeaders(),
    });
  }

  enroll(_id, quantity = 1) {
    return axios.post(
      API_URL + "/enroll/" + _id,
      { quantity, tableNumber: getTableNumber() },
      {
        headers: getBuyerJwtHeaders(),
      }
    );
  }

  getAll() {
    return axios.get(API_URL + "/", {
      headers: getSellerJwtHeaders(),
    });
  }

  deleteProduct(_id) {
    return axios.delete(API_URL + "/" + _id, {
      headers: getSellerJwtHeaders(),
    });
  }

  updateProduct(_id, data) {
    return axios.patch(API_URL + "/" + _id, data, {
      headers: getSellerJwtHeaders(),
    });
  }

  updateProductWithImage(_id, title, description, price, type, image) {
    const formData = new FormData();
    formData.append("title", title);
    formData.append("description", description || "");
    formData.append("price", price);
    formData.append("type", type);

    if (image) {
      formData.append("image", image);
    }

    return axios.patch(API_URL + "/" + _id, formData, {
      headers: {
        ...getSellerJwtHeaders(),
        "Content-Type": "multipart/form-data",
      },
    });
  }

  deleteEnrolledProduct(_id) {
    return axios.delete(API_URL + "/unenroll/" + _id, {
      headers: getBuyerJwtHeaders(),
    });
  }

  deleteSellerOrder(buyerId) {
    return axios.delete(API_URL + "/sellerOrder/" + buyerId, {
      headers: getSellerJwtHeaders(),
    });
  }

  deleteSellerTableOrder(tableNumber) {
    return axios.delete(API_URL + "/sellerOrder/table/" + tableNumber, {
      headers: getSellerJwtHeaders(),
    });
  }

  updateEnrolledQuantity(_id, quantity) {
    return axios.patch(
      API_URL + "/quantity/" + _id,
      { quantity },
      {
        headers: getBuyerJwtHeaders(),
      }
    );
  }

  submitOrder() {
    return axios.patch(
      API_URL + "/submitOrder",
      {},
      {
        headers: getBuyerJwtHeaders(),
      }
    );
  }
}

export default new ProductService();
