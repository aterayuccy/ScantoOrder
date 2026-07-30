import axios from "axios";

const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL ||
  (window.location.port === "3000"
    ? `${window.location.protocol}//${window.location.hostname}:8080`
    : window.location.origin);
const API_URL = `${API_BASE_URL}/api/product`;

export const UPLOADS_URL = `${API_BASE_URL}/uploads`;
export const getProductImageUrl = (image) => {
  const value = String(image || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return `${UPLOADS_URL}/${encodeURIComponent(value)}`;
};

const isMongoId = (value) => /^[a-f\d]{24}$/i.test(String(value || ""));

const serializeOptionGroups = (groups) =>
  (Array.isArray(groups) ? groups : []).map((group) => {
    const serializedGroup = {
      name: String(group?.name ?? group?.label ?? "").trim(),
      selectionType:
        group?.selectionType === "multiple" ? "multiple" : "single",
      options: (Array.isArray(group?.options) ? group.options : []).map(
        (option) => {
          const rawAdjustment = option?.priceAdjustment ?? option?.priceDelta;
          const serializedOption = {
            name: String(option?.name ?? option?.label ?? "").trim(),
            priceAdjustment:
              rawAdjustment === "" ||
              rawAdjustment === null ||
              rawAdjustment === undefined
                ? 0
                : Number(rawAdjustment),
          };
          const optionId = option?._id || option?.id;
          if (isMongoId(optionId)) serializedOption._id = optionId;
          return serializedOption;
        }
      ),
    };
    const groupId = group?._id || group?.id;
    if (isMongoId(groupId)) serializedGroup._id = groupId;
    return serializedGroup;
  });

const serializeSpecialRequestConfig = (config = {}) => ({
  enabled: config.enabled !== false,
  label: String(config.label || "備註或特殊需求").trim(),
  maxLength: Math.min(300, Math.max(1, Number(config.maxLength) || 200)),
});

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

const getSellerJwtHeaders = () => ({
  Authorization: "jwt " + (getStoredSellerUser()?.token || ""),
});

const getBuyerJwtHeaders = () => ({
  Authorization: "jwt " + (getQrUser()?.token || getLocalUser()?.token || ""),
});

class ProductService {
  post(
    title,
    description,
    price,
    type,
    image,
    optionGroups = [],
    specialRequestConfig = {}
  ) {
    const formData = new FormData();
    formData.append("title", title);
    formData.append("description", description || "");
    formData.append("price", price);
    formData.append("type", type);
    formData.append(
      "optionGroups",
      JSON.stringify(serializeOptionGroups(optionGroups))
    );
    formData.append(
      "specialRequestConfig",
      JSON.stringify(serializeSpecialRequestConfig(specialRequestConfig))
    );
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
      return axios.get(API_URL + "/menu/" + sellerId, {
        headers:
          user?.role === "seller"
            ? getSellerJwtHeaders()
            : getBuyerJwtHeaders(),
      });
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

  enroll(_id, customization = {}) {
    const {
      quantity = 1,
      selections = [],
      specialRequest = "",
    } = customization;

    return axios.post(
      API_URL + "/enroll/" + _id,
      {
        quantity,
        selections,
        specialRequest,
      },
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

  updateAvailability(_id, isAvailable) {
    return axios.patch(
      API_URL + "/" + _id + "/availability",
      { isAvailable },
      { headers: getSellerJwtHeaders() }
    );
  }

  updateProduct(_id, data) {
    return axios.patch(API_URL + "/" + _id, data, {
      headers: getSellerJwtHeaders(),
    });
  }

  updateProductWithImage(
    _id,
    title,
    description,
    price,
    type,
    image,
    optionGroups = [],
    specialRequestConfig = {}
  ) {
    const formData = new FormData();
    formData.append("title", title);
    formData.append("description", description || "");
    formData.append("price", price);
    formData.append("type", type);
    formData.append(
      "optionGroups",
      JSON.stringify(serializeOptionGroups(optionGroups))
    );
    formData.append(
      "specialRequestConfig",
      JSON.stringify(serializeSpecialRequestConfig(specialRequestConfig))
    );

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

  deleteCartLine(productId, lineItemId) {
    return axios.delete(API_URL + "/cart/" + productId + "/" + lineItemId, {
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

  deleteSellerOrderBatch(orderBatchId) {
    return axios.delete(API_URL + "/sellerOrder/batch/" + orderBatchId, {
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

  updateCartLineQuantity(productId, lineItemId, quantity) {
    return axios.patch(
      API_URL + "/cart/" + productId + "/" + lineItemId,
      { quantity },
      {
        headers: getBuyerJwtHeaders(),
      }
    );
  }

  submitOrder(checkoutToken) {
    return axios.patch(
      API_URL + "/submitOrder",
      { checkoutToken },
      {
        headers: getBuyerJwtHeaders(),
      }
    );
  }
}

const productService = new ProductService();

export default productService;
