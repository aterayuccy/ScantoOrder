import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

import SupportService from "../services/support.service";

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

const SELLER_REFRESH_INTERVAL_MS = 15_000;

const formatDate = (value) =>
  new Intl.DateTimeFormat("zh-TW", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));

const SupportWidgetComponent = ({ currentUser }) => {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("operation");
  const [message, setMessage] = useState("");
  const [tickets, setTickets] = useState([]);
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [busyTicketId, setBusyTicketId] = useState("");

  useEffect(() => {
    if (!open) return undefined;

    const handleEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    let active = true;
    let requestInProgress = false;

    const loadTickets = async ({ initial = false } = {}) => {
      if (requestInProgress) return;
      requestInProgress = true;

      if (initial) {
        setLoading(true);
        setFeedback("");
      }

      try {
        const response = await SupportService.listSellerTickets(currentUser);
        if (active) setTickets(response.data || []);
      } catch (error) {
        if (active && initial) {
          setFeedback(
            error.response?.data?.message ||
              error.response?.data ||
              "問題單載入失敗"
          );
        }
      } finally {
        requestInProgress = false;
        if (active && initial) setLoading(false);
      }
    };

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") loadTickets();
    };

    loadTickets({ initial: true });
    const intervalId = window.setInterval(
      refreshWhenVisible,
      SELLER_REFRESH_INTERVAL_MS
    );
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [currentUser, open]);

  const submitTicket = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setFeedback("");

    try {
      const response = await SupportService.createTicket(currentUser, {
        category,
        message,
        pagePath: `${location.pathname}${location.search}`,
      });
      setTickets((current) => [response.data, ...current]);
      setMessage("");
      setFeedback("問題已送出，你可以在下方查看回覆狀態。");
    } catch (error) {
      setFeedback(
        error.response?.data?.message ||
          error.response?.data ||
          "問題送出失敗，請稍後再試"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const answerTicketFeedback = async (ticketId, answer) => {
    setBusyTicketId(ticketId);
    setFeedback("");
    try {
      const response = await SupportService.updateSellerTicketFeedback(
        currentUser,
        ticketId,
        answer
      );
      setTickets((current) =>
        current.map((ticket) =>
          ticket._id === ticketId ? response.data : ticket
        )
      );
      setFeedback(
        answer === "resolved"
          ? "謝謝你的回饋，問題單已結案。"
          : "已通知客服問題仍未解決，問題單會重新列為待回覆。"
      );
    } catch (error) {
      setFeedback(
        error.response?.data?.message ||
          error.response?.data ||
          "回饋送出失敗，請稍後再試"
      );
    } finally {
      setBusyTicketId("");
    }
  };

  const deleteTicket = async (ticketId) => {
    if (!window.confirm("確定要刪除這張問題單嗎？刪除後無法復原。")) {
      return;
    }

    setBusyTicketId(ticketId);
    setFeedback("");
    try {
      await SupportService.deleteSellerTicket(currentUser, ticketId);
      setTickets((current) =>
        current.filter((ticket) => ticket._id !== ticketId)
      );
      setFeedback("問題單已刪除。");
    } catch (error) {
      setFeedback(
        error.response?.data?.message ||
          error.response?.data ||
          "問題單刪除失敗，請稍後再試"
      );
    } finally {
      setBusyTicketId("");
    }
  };

  return (
    <>
      {open && (
        <aside
          className="support-panel"
          aria-label="聯絡系統客服"
          aria-live="polite"
        >
          <header className="support-panel__header">
            <div>
              <p className="ui-eyebrow">系統協助</p>
              <h2>聯絡客服</h2>
              <p>操作問題或系統異常都可以從這裡送出。</p>
            </div>
            <button
              type="button"
              className="support-panel__close"
              aria-label="關閉客服"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </header>

          <div className="support-panel__body">
            <form className="support-form" onSubmit={submitTicket}>
              <label>
                <span>問題類型</span>
                <select
                  className="form-select"
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                >
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                    <option value={value} key={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>問題內容</span>
                <textarea
                  className="form-control"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="請說明遇到的情況，以及你原本想完成的操作。"
                  minLength={5}
                  maxLength={2000}
                  required
                />
              </label>
              <div className="support-form__footer">
                <small>{message.length}/2000</small>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting || message.trim().length < 5}
                >
                  {submitting ? "送出中…" : "送出問題"}
                </button>
              </div>
            </form>

            {feedback && <div className="alert alert-info">{feedback}</div>}

            <section className="support-history">
              <div className="support-history__heading">
                <h3>我的問題單</h3>
                <span>{tickets.length} 筆</span>
              </div>
              {loading ? (
                <p className="support-muted">載入中…</p>
              ) : tickets.length === 0 ? (
                <p className="support-muted">目前還沒有送出的問題。</p>
              ) : (
                <div className="support-ticket-list">
                  {tickets.map((ticket) => (
                    <article className="support-ticket" key={ticket._id}>
                      <button
                        type="button"
                        className="support-ticket__delete"
                        aria-label="刪除問題單"
                        title="刪除問題單"
                        disabled={busyTicketId === ticket._id}
                        onClick={() => deleteTicket(ticket._id)}
                      >
                        ×
                      </button>
                      <div className="support-ticket__meta">
                        <strong>{CATEGORY_LABELS[ticket.category]}</strong>
                        <span
                          className={`support-status support-status--${ticket.status}`}
                        >
                          {STATUS_LABELS[ticket.status]}
                        </span>
                      </div>
                      <p>{ticket.message}</p>
                      <time>{formatDate(ticket.createdAt)}</time>
                      {ticket.adminReply && (
                        <div className="support-ticket__reply">
                          <strong>客服回覆</strong>
                          <p>{ticket.adminReply}</p>
                          {ticket.repliedAt && (
                            <time className="support-ticket__reply-time">
                              回覆時間：{formatDate(ticket.repliedAt)}
                            </time>
                          )}
                        </div>
                      )}
                      {ticket.adminReply && !ticket.sellerFeedback && (
                        <div className="support-ticket__feedback">
                          <strong>這次回覆是否解決你的問題？</strong>
                          <div className="support-ticket__feedback-actions">
                            <button
                              type="button"
                              className="btn btn-primary"
                              disabled={busyTicketId === ticket._id}
                              onClick={() =>
                                answerTicketFeedback(ticket._id, "resolved")
                              }
                            >
                              問題已解決
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline-secondary"
                              disabled={busyTicketId === ticket._id}
                              onClick={() =>
                                answerTicketFeedback(ticket._id, "unresolved")
                              }
                            >
                              仍未解決
                            </button>
                          </div>
                        </div>
                      )}
                      {ticket.sellerFeedback && (
                        <p className="support-ticket__feedback-result">
                          你的回饋：
                          {ticket.sellerFeedback === "resolved"
                            ? "問題已解決"
                            : "仍未解決，已重新通知客服"}
                        </p>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        </aside>
      )}

      <button
        type="button"
        className={`support-fab${open ? " is-open" : ""}`}
        aria-label={open ? "關閉客服" : "聯絡客服"}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        +
      </button>
    </>
  );
};

export default SupportWidgetComponent;
