import { useMemo, useState } from "react";

import { formatDate } from "./admin-formatters";
import PlatformAdminService from "../../services/platform-admin.service";

const formatDateOnly = (value) =>
  value
    ? new Intl.DateTimeFormat("zh-TW", { dateStyle: "medium" }).format(
        new Date(value)
      )
    : "—";

const StoreDirectorySection = ({ adminKey, storeData, loading, onReload }) => {
  const [query, setQuery] = useState("");
  const [busyStoreId, setBusyStoreId] = useState("");
  const [message, setMessage] = useState("");
  const stores = storeData.stores;
  const normalizedQuery = query.normalize("NFKC").trim().toLocaleLowerCase();
  const visibleStores = useMemo(
    () =>
      normalizedQuery
        ? stores.filter((store) =>
            store.username
              .normalize("NFKC")
              .toLocaleLowerCase()
              .includes(normalizedQuery)
          )
        : stores,
    [normalizedQuery, stores]
  );

  const confirmRenewal = async (store) => {
    const actionLabel =
      store.subscription?.status === "suspended"
        ? "恢復帳號使用"
        : "延續帳號使用";
    if (
      !window.confirm(
        `請先確認已收到 ${store.username} 的款項。確定要${actionLabel}嗎？`
      )
    ) {
      return;
    }

    setBusyStoreId(store.id);
    setMessage("");
    try {
      await PlatformAdminService.confirmStoreRenewal(adminKey, store.id);
      setMessage(`${store.username} 已${actionLabel}。`);
      await onReload();
    } catch (error) {
      setMessage(
        error.response?.data?.message ||
          error.response?.data ||
          `${actionLabel}失敗`
      );
    } finally {
      setBusyStoreId("");
    }
  };

  const rejectRenewal = async (store) => {
    const reason = window.prompt(
      `退回 ${store.username} 的續費申請，請輸入原因：`,
      "查無款項，請確認後重新提交。"
    );
    if (reason === null) return;

    setBusyStoreId(store.id);
    setMessage("");
    try {
      await PlatformAdminService.rejectStoreRenewal(adminKey, store.id, reason);
      setMessage(`${store.username} 的續費申請已退回。`);
      await onReload();
    } catch (error) {
      setMessage(
        error.response?.data?.message ||
          error.response?.data ||
          "續費申請退回失敗"
      );
    } finally {
      setBusyStoreId("");
    }
  };

  const setRenewalTestWindow = async (store) => {
    if (
      !window.confirm(
        `確定要將 ${store.username} 調整為最後 7 天嗎？這會清除尚未完成的續費測試資料。`
      )
    ) {
      return;
    }

    setBusyStoreId(store.id);
    setMessage("");
    try {
      await PlatformAdminService.setStoreRenewalTestWindow(adminKey, store.id);
      setMessage(`${store.username} 已進入最後 7 天。`);
      await onReload();
    } catch (error) {
      setMessage(
        error.response?.data?.message ||
          error.response?.data ||
          "測試期限調整失敗"
      );
    } finally {
      setBusyStoreId("");
    }
  };

  return (
    <section className="platform-admin-section" aria-labelledby="stores-title">
      <div className="platform-admin-section__heading">
        <div>
          <p className="ui-eyebrow">店家管理</p>
          <h2 id="stores-title">已註冊店家</h2>
          <p>只列出店家身分帳號，不包含掃描 QR Code 產生的臨時顧客。</p>
        </div>
      </div>

      <article className="platform-store-total">
        <span>目前註冊店家</span>
        <strong>{storeData.total || 0}</strong>
        <small>家</small>
      </article>

      {message && <div className="alert alert-info">{message}</div>}

      <div className="ui-toolbar platform-store-toolbar">
        <label>
          <span>搜尋店家</span>
          <input
            type="search"
            className="form-control"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="輸入使用者名稱"
          />
        </label>
        <span className="ui-toolbar-result">
          {loading
            ? "載入中…"
            : query
              ? `找到 ${visibleStores.length} 家`
              : `顯示 ${visibleStores.length} 家`}
        </span>
      </div>

      {visibleStores.length === 0 ? (
        <section className="ui-empty">
          <h3>{query ? "找不到符合的店家" : "目前還沒有店家帳號"}</h3>
          <p>
            {query ? "請換一個使用者名稱搜尋。" : "店家註冊後會顯示在這裡。"}
          </p>
        </section>
      ) : (
        <div className="platform-store-table-wrap">
          <table className="platform-store-table">
            <thead>
              <tr>
                <th>店家帳號</th>
                <th>註冊時間</th>
                <th>使用模式</th>
                <th>使用期限</th>
                <th>上次付費</th>
                <th>續費狀態</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {visibleStores.map((store) => (
                <tr key={store.id}>
                  <td>
                    <strong>{store.username}</strong>
                  </td>
                  <td>{formatDate(store.createdAt)}</td>
                  <td>
                    <span
                      className={`subscription-status subscription-status--${store.subscription?.status}`}
                    >
                      {store.subscription?.statusLabel || "—"}
                    </span>
                  </td>
                  <td>
                    {formatDateOnly(store.subscription?.expiresAt)}
                    <small className="platform-store-subtext">
                      {store.subscription?.status === "suspended"
                        ? "服務已暫停"
                        : store.subscription?.inRenewalWindow
                          ? `最後 ${store.subscription.daysRemaining} 天`
                          : "仍未到最後七天"}
                    </small>
                  </td>
                  <td>{formatDateOnly(store.subscription?.lastPaymentAt)}</td>
                  <td>
                    {store.subscription?.renewalRequest?.status === "pending"
                      ? "待核帳"
                      : store.subscription?.renewalRequest?.status ===
                          "rejected"
                        ? "已退回"
                        : store.subscription?.canRenew
                          ? "尚未申請"
                          : "未開放"}
                    {store.subscription?.renewalRequest?.status ===
                      "pending" && (
                      <small className="platform-store-subtext">
                        末五碼：
                        {store.subscription.renewalRequest.accountLastFive}
                        <br />
                        {formatDate(
                          store.subscription.renewalRequest.transferAt
                        )}
                      </small>
                    )}
                  </td>
                  <td>
                    {store.subscription?.renewalRequest?.status ===
                    "pending" ? (
                      <div className="platform-store-actions">
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={busyStoreId === store.id}
                          onClick={() => confirmRenewal(store)}
                        >
                          {store.subscription.status === "suspended"
                            ? "恢復帳號使用"
                            : "延續帳號使用"}
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-danger"
                          disabled={busyStoreId === store.id}
                          onClick={() => rejectRenewal(store)}
                        >
                          查無款項
                        </button>
                      </div>
                    ) : (
                      <div className="platform-store-actions">
                        <span className="platform-store-subtext">
                          {store.subscription?.status === "suspended"
                            ? "等待店家申請恢復"
                            : store.subscription?.inRenewalWindow
                              ? "等待店家選擇續費"
                              : "無需操作"}
                        </span>
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                          disabled={busyStoreId === store.id}
                          onClick={() => setRenewalTestWindow(store)}
                        >
                          測試最後 7 天
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {storeData.total > stores.length && (
        <p className="platform-admin-updated">
          第一版最多顯示最近註冊的 200 家店。
        </p>
      )}
    </section>
  );
};

export default StoreDirectorySection;
