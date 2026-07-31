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
}

const platformAdminService = new PlatformAdminService();

export default platformAdminService;
