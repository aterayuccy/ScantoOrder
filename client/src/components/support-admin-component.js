import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import PlatformAdminService from "../services/platform-admin.service";
import StoreDirectorySection from "./platform-admin/store-directory-section";
import SupportTicketSection from "./platform-admin/support-ticket-section";

const ADMIN_KEY_STORAGE = "supportAdminKey";

const SupportAdminComponent = () => {
  const [adminKey, setAdminKey] = useState(
    () => sessionStorage.getItem(ADMIN_KEY_STORAGE) || ""
  );
  const [keyInput, setKeyInput] = useState("");
  const [activeSection, setActiveSection] = useState("stores");
  const [storeData, setStoreData] = useState({ total: 0, stores: [] });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const loadStores = async (key = adminKey) => {
    if (!key) return false;

    setLoading(true);
    setMessage("");
    try {
      const response = await PlatformAdminService.listStores(key);
      sessionStorage.setItem(ADMIN_KEY_STORAGE, key);
      setAdminKey(key);
      setStoreData(response.data || { total: 0, stores: [] });
      return true;
    } catch (error) {
      if (error.response?.status === 401) {
        sessionStorage.removeItem(ADMIN_KEY_STORAGE);
        setAdminKey("");
      }
      setMessage(
        error.response?.data?.message ||
          error.response?.data ||
          "後台資料載入失敗"
      );
      return false;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (adminKey) loadStores(adminKey);
    // Restore and verify the saved key once when this page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unlock = async (event) => {
    event.preventDefault();
    const key = keyInput.trim();
    const unlocked = await loadStores(key);
    if (unlocked) setKeyInput("");
  };

  const lockAdmin = () => {
    sessionStorage.removeItem(ADMIN_KEY_STORAGE);
    setAdminKey("");
    setStoreData({ total: 0, stores: [] });
    setMessage("");
  };

  if (!adminKey) {
    return (
      <main className="auth-entry-page">
        <section className="auth-entry-panel">
          <h1 className="auth-entry-title">
            Scan to Order
            <br />
            <span className="auth-entry-subtitle">平台管理後台</span>
          </h1>
          <form className="auth-entry-card" onSubmit={unlock}>
            <h2 className="auth-entry-heading">進入管理後台</h2>
            <p className="support-muted">
              請輸入 Render 環境變數 SUPPORT_ADMIN_KEY 中設定的金鑰。
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
              {loading ? "驗證中…" : "進入管理後台"}
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
            <p className="ui-eyebrow">Scan to Order</p>
            <h1>平台管理後台</h1>
            <p>查看目前已註冊的店家，並處理店家送出的客服問題。</p>
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

        <nav className="platform-admin-tabs" aria-label="後台功能">
          <button
            type="button"
            className={activeSection === "stores" ? "is-active" : ""}
            aria-pressed={activeSection === "stores"}
            onClick={() => setActiveSection("stores")}
          >
            已註冊店家
            <span>{storeData.total || 0}</span>
          </button>
          <button
            type="button"
            className={activeSection === "support" ? "is-active" : ""}
            aria-pressed={activeSection === "support"}
            onClick={() => setActiveSection("support")}
          >
            客服問題單
          </button>
        </nav>

        {activeSection === "stores" ? (
          <StoreDirectorySection
            storeData={storeData}
            loading={loading}
            onRefresh={() => loadStores(adminKey)}
          />
        ) : (
          <SupportTicketSection adminKey={adminKey} />
        )}
      </div>
    </main>
  );
};

export default SupportAdminComponent;
