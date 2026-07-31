import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import SupportService from "../services/support.service";

const ADMIN_KEY_STORAGE = "supportAdminKey";
const CATEGORY_LABELS = {
  technical: "系統異常",
  operation: "操作問題",
  suggestion: "功能建議",
  other: "其他問題",
};
const STATUS_LABELS = {
  open: "待回覆",
  answered: "已回覆",
  closed: "已結案",
};

const formatDate = (value) =>
  new Intl.DateTimeFormat("zh-TW", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

const SupportAdminComponent = () => {
  const [adminKey, setAdminKey] = useState(
    () => sessionStorage.getItem(ADMIN_KEY_STORAGE) || ""
  );
  const [keyInput, setKeyInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [tickets, setTickets] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [reply, setReply] = useState("");
  const [ticketStatus, setTicketStatus] = useState("open");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedTicket =
    tickets.find((ticket) => ticket._id === selectedId) || null;

  const loadTickets = async (key = adminKey, filter = statusFilter) => {
    if (!key) return;

    setLoading(true);
    setMessage("");
    try {
      const response = await SupportService.listAdminTickets(key, filter);
      const nextTickets = response.data || [];
      sessionStorage.setItem(ADMIN_KEY_STORAGE, key);
      setAdminKey(key);
      setTickets(nextTickets);
      setSelectedId((current) =>
        nextTickets.some((ticket) => ticket._id === current)
          ? current
          : nextTickets[0]?._id || ""
      );
    } catch (error) {
      if (error.response?.status === 401) {
        sessionStorage.removeItem(ADMIN_KEY_STORAGE);
        setAdminKey("");
      }
      setMessage(
        error.response?.data?.message ||
          error.response?.data ||
          "客服問題單載入失敗"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (adminKey) loadTickets(adminKey, statusFilter);
    // Only refresh when the filter changes or a saved key is restored.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminKey, statusFilter]);

  useEffect(() => {
    if (!selectedTicket) {
      setReply("");
      setTicketStatus("open");
      return;
    }
    setReply(selectedTicket.adminReply || "");
    setTicketStatus(selectedTicket.status);
  }, [selectedTicket]);

  const unlock = async (event) => {
    event.preventDefault();
    await loadTickets(keyInput.trim(), statusFilter);
    setKeyInput("");
  };

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
      setTickets((current) =>
        current.map((ticket) =>
          ticket._id === response.data._id ? response.data : ticket
        )
      );
      setMessage("問題單已更新，店家下次開啟客服時即可看到回覆。");
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

  const lockAdmin = () => {
    sessionStorage.removeItem(ADMIN_KEY_STORAGE);
    setAdminKey("");
    setTickets([]);
    setSelectedId("");
  };

  if (!adminKey) {
    return (
      <main className="auth-entry-page">
        <section className="auth-entry-panel">
          <h1 className="auth-entry-title">
            Scan to Order
            <br />
            <span className="auth-entry-subtitle">客服後台</span>
          </h1>
          <form className="auth-entry-card" onSubmit={unlock}>
            <h2 className="auth-entry-heading">進入客服收件匣</h2>
            <p className="support-muted">
              請輸入部署環境中設定的客服後台金鑰。
            </p>
            {message && <div className="alert alert-danger">{message}</div>}
            <label className="auth-entry-field">
              <span>後台金鑰</span>
              <input
                type="password"
                className="form-control"
                value={keyInput}
                onChange={(event) => setKeyInput(event.target.value)}
                autoComplete="off"
                required
              />
            </label>
            <button
              type="submit"
              className="auth-entry-submit btn btn-primary"
              disabled={loading || !keyInput.trim()}
            >
              {loading ? "驗證中…" : "進入收件匣"}
            </button>
            <p className="auth-entry-switch">
              <Link to="/login">返回登入</Link>
            </p>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="app-page support-admin-page">
      <div className="app-page__inner">
        <header className="app-page-header">
          <div>
            <p className="ui-eyebrow">系統管理</p>
            <h1>客服問題單</h1>
            <p>查看店家遇到的系統或操作問題，回覆後可標記為已結案。</p>
          </div>
          <div className="support-admin-actions">
            <Link className="btn btn-outline-secondary" to="/login">
              回到網站
            </Link>
            <button
              type="button"
              className="btn btn-outline-danger"
              onClick={lockAdmin}
            >
              鎖定後台
            </button>
          </div>
        </header>

        {message && <div className="alert alert-info">{message}</div>}

        <section className="ui-toolbar support-admin-toolbar">
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
        </section>

        {tickets.length === 0 ? (
          <section className="ui-empty">
            <h2>目前沒有問題單</h2>
            <p>店家從右下角客服按鈕送出問題後，會顯示在這裡。</p>
          </section>
        ) : (
          <div className="support-admin-layout">
            <section className="support-admin-list" aria-label="問題單列表">
              {tickets.map((ticket) => (
                <button
                  type="button"
                  className={`support-admin-ticket${
                    ticket._id === selectedId ? " is-selected" : ""
                  }`}
                  key={ticket._id}
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
                    <h2>{selectedTicket.username}</h2>
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
      </div>
    </main>
  );
};

export default SupportAdminComponent;
