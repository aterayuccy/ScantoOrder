import { useMemo, useState } from "react";

import { formatDate } from "./admin-formatters";

const StoreDirectorySection = ({ storeData, loading }) => {
  const [query, setQuery] = useState("");
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
              </tr>
            </thead>
            <tbody>
              {visibleStores.map((store) => (
                <tr key={store.id}>
                  <td>
                    <strong>{store.username}</strong>
                  </td>
                  <td>{formatDate(store.createdAt)}</td>
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
