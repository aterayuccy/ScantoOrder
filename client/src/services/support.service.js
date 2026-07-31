import axios from "axios";

const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL ||
  (window.location.port === "3000"
    ? `${window.location.protocol}//${window.location.hostname}:8080`
    : window.location.origin);
const API_URL = `${API_BASE_URL}/api/support`;

const sellerHeaders = (currentUser) => ({
  Authorization: `jwt ${currentUser?.token || ""}`,
});

class SupportService {
  createTicket(currentUser, input) {
    return axios.post(`${API_URL}/tickets`, input, {
      headers: sellerHeaders(currentUser),
    });
  }

  listSellerTickets(currentUser) {
    return axios.get(`${API_URL}/tickets`, {
      headers: sellerHeaders(currentUser),
    });
  }

  updateSellerTicketFeedback(currentUser, ticketId, feedback) {
    return axios.patch(
      `${API_URL}/tickets/${ticketId}/feedback`,
      { feedback },
      { headers: sellerHeaders(currentUser) }
    );
  }

  deleteSellerTicket(currentUser, ticketId) {
    return axios.delete(`${API_URL}/tickets/${ticketId}`, {
      headers: sellerHeaders(currentUser),
    });
  }

  listAdminTickets(adminKey, status = "") {
    return axios.get(`${API_URL}/admin/tickets`, {
      headers: { "x-support-admin-key": adminKey },
      params: status ? { status } : undefined,
    });
  }

  updateAdminTicket(adminKey, ticketId, input) {
    return axios.patch(`${API_URL}/admin/tickets/${ticketId}`, input, {
      headers: { "x-support-admin-key": adminKey },
    });
  }

  deleteAdminTicket(adminKey, ticketId) {
    return axios.delete(`${API_URL}/admin/tickets/${ticketId}`, {
      headers: { "x-support-admin-key": adminKey },
    });
  }
}

const supportService = new SupportService();

export default supportService;
