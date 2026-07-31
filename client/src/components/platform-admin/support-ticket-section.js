import { useCallback, useEffect, useRef, useState } from "react";

import SupportService from "../../services/support.service";
import { CATEGORY_LABELS, STATUS_LABELS, formatDate } from "./admin-formatters";

const ADMIN_REFRESH_INTERVAL_MS = 10_000;

const SupportTicketSection = ({ adminKey, onChanged }) => {
  const [statusFilter, setStatusFilter] = useState("");
  const [tickets, setTickets] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [reply, setReply] = useState("");
  const [ticketStatus, setTicketStatus] = useState("open");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const requestInProgressRef = useRef(false);
  const formTicketIdRef = useRef("");

  const selectedTicket =
    tickets.find((ticket) => ticket._id === selectedId) || null;

  const loadTickets = useCallback(
    async ({ background = false } = {}) => {
      if (requestInProgressRef.current) return;
      requestInProgressRef.current = true;

      if (!background) {
        setLoading(true);
        setMessage("");
      }

      try {
        const response = await SupportService.listAdminTickets(
          adminKey,
          statusFilter
        );
        const nextTickets = response.data || [];
        setTickets(nextTickets);
        setSelectedId((current) =>
          nextTickets.some((ticket) => ticket._id === current)
            ? current
            : nextTickets[0]?._id || ""
        );
      } catch (error) {
        setMessage(
          error.response?.data?.message ||
            error.response?.data ||
            "客服問題單載入失敗"
        );
      } finally {
        requestInProgressRef.current = false;
        if (!background) setLoading(false);
      }
    },
    [adminKey, statusFilter]
  );

  useEffect(() => {
    loadTickets();

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        loadTickets({ background: true });
      }
    };

    const intervalId = window.setInterval(
      refreshWhenVisible,
      ADMIN_REFRESH_INTERVAL_MS
    );
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [loadTickets]);

  useEffect(() => {
    if (!selectedTicket) {
      formTicketIdRef.current = "";
      setReply("");
      setTicketStatus("open");
      return;
    }

    if (formTicketIdRef.current === selectedTicket._id) return;
    formTicketIdRef.current = selectedTicket._id;
    setReply(selectedTicket.adminReply || "");
    setTicketStatus(selectedTicket.status);
  }, [selectedTicket]);

  const saveTicket = async (event) => {
    event.preventDefault();
    if (!selectedTicket) return;

    setLoading(true);
    setMessage("");
    try {
      const response = await SupportService.updateAdminTicket(
        adminKey,
        selectedTicket._id,
        {
          adminReply: reply,
          status: ticketStatus,
        }
      );
      let updatedTicket = response.data;

      if (
        reply.trim() &&
        updatedTicket.status !== "closed" &&
        window.confirm("回覆已儲存。這個問題是否已處理完成並結案？")
      ) {
        const closeResponse = await SupportService.updateAdminTicket(
          adminKey,
          selectedTicket._id,
          { status: "closed" }
        );
        updatedTicket = closeResponse.data;
      }

      setTickets((current) =>
        current.map((ticket) =>
          ticket._id === updatedTicket._id ? updatedTicket : ticket
        )
      );
      setTicketStatus(updatedTicket.status);
      setMessage(
        updatedTicket.status === "closed"
          ? "回覆已儲存，問題單已結案。"
          : "回覆已儲存，問題單目前為已回覆。"
      );
      onChanged?.();
    } catch (error) {
      setMessage(
        error.response?.data?.message ||
          error.response?.data ||
          "問題單更新失敗"
      );
    } finally {
      setLoading(false);
    }
  };

  const deleteClosedTicket = async (ticket) => {
    if (
      ticket.status !== "closed" ||
      !window.confirm(`確定要刪除 ${ticket.username} 的已結案問題單嗎？`)
    ) {
      return;
    }

    setLoading(true);
    setMessage("");
    try {
      await SupportService.deleteAdminTicket(adminKey, ticket._id);
      const remainingTickets = tickets.filter(
        (current) => current._id !== ticket._id
      );
      setTickets(remainingTickets);
      if (selectedId === ticket._id) {
        setSelectedId(remainingTickets[0]?._id || "");
      }
      setMessage("已刪除問題單。");
      onChanged?.();
    } catch (error) {
      setMessage(
        error.response?.data?.message ||
          error.response?.data ||
          "問題單刪除失敗"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="platform-admin-section" aria-labelledby="tickets-title">
      <div className="platform-admin-section__heading">
        <div>
          <p className="ui-eyebrow">店家回饋</p>
          <h2 id="tickets-title">客服問題單</h2>
          <p>回覆店家的操作或系統問題，並用狀態確認是否已結案。</p>
        </div>
      </div>

      {message && <div className="alert alert-info">{message}</div>}

      <div className="ui-toolbar support-admin-toolbar">
        <label>
          <span>問題單狀態</span>
          <select
            className="form-select"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="">全部</option>
            <option value="open">待回覆</option>
            <option value="answered">已回覆</option>
            <option value="closed">已結案</option>
          </select>
        </label>
        <span className="ui-toolbar-result">
          {loading ? "載入中…" : `共 ${tickets.length} 筆`}
        </span>
      </div>

      {tickets.length === 0 ? (
        <section className="ui-empty">
          <h3>目前沒有問題單</h3>
          <p>店家從右下角客服按鈕送出問題後，會顯示在這裡。</p>
        </section>
      ) : (
        <div className="support-admin-layout">
          <section className="support-admin-list" aria-label="問題單列表">
            {tickets.map((ticket) => (
              <div
                className={`support-admin-ticket-wrap${
                  ticket.status === "closed"
                    ? " support-admin-ticket-wrap--closed"
                    : ""
                }`}
                key={ticket._id}
              >
                <button
                  type="button"
                  className={`support-admin-ticket${
                    ticket._id === selectedId ? " is-selected" : ""
                  }`}
                  onClick={() => setSelectedId(ticket._id)}
                >
                  <span>
                    <strong>{ticket.username}</strong>
                    <small>{CATEGORY_LABELS[ticket.category]}</small>
                  </span>
                  <span
                    className={`support-status support-status--${ticket.status}`}
                  >
                    {STATUS_LABELS[ticket.status]}
                  </span>
                  <p>{ticket.message}</p>
                  <time>{formatDate(ticket.createdAt)}</time>
                </button>
                {ticket.status === "closed" && (
                  <button
                    type="button"
                    className="support-admin-ticket-delete"
                    aria-label={`刪除 ${ticket.username} 的已結案問題單`}
                    title="刪除已結案問題單"
                    disabled={loading}
                    onClick={() => deleteClosedTicket(ticket)}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </section>

          {selectedTicket && (
            <form
              className="ui-card support-admin-detail"
              onSubmit={saveTicket}
            >
              <div className="support-admin-detail__heading">
                <div>
                  <p className="ui-eyebrow">
                    {CATEGORY_LABELS[selectedTicket.category]}
                  </p>
                  <h3>{selectedTicket.username}</h3>
                </div>
                <time>{formatDate(selectedTicket.createdAt)}</time>
              </div>
              <div className="support-admin-message">
                <strong>店家問題</strong>
                <p>{selectedTicket.message}</p>
                {selectedTicket.pagePath && (
                  <small>問題頁面：{selectedTicket.pagePath}</small>
                )}
              </div>
              <label className="support-admin-field">
                <span>客服回覆</span>
                <textarea
                  className="form-control"
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                  placeholder="輸入給店家的處理方式或操作說明。"
                  maxLength={2000}
                />
              </label>
              <label className="support-admin-field">
                <span>處理狀態</span>
                <select
                  className="form-select"
                  value={ticketStatus}
                  onChange={(event) => setTicketStatus(event.target.value)}
                >
                  <option value="open">待回覆</option>
                  <option value="answered">已回覆</option>
                  <option value="closed">已結案</option>
                </select>
              </label>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
              >
                儲存回覆
              </button>
            </form>
          )}
        </div>
      )}
    </section>
  );
};

export default SupportTicketSection;
