import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import AuthService from "../services/auth.service";
import { getProductImageUrl } from "../services/product.service";
import RecoveryCodeActions from "./recovery-code-actions";
import useRecoveryCodeGuard from "../hooks/use-recovery-code-guard";

const AVATAR_COLORS = [
  "#0f766e",
  "#2563eb",
  "#7c3aed",
  "#c2410c",
  "#be123c",
  "#047857",
];

const getAvatarColor = (username = "") => {
  const hash = Array.from(username).reduce(
    (total, character) => total + character.codePointAt(0),
    0
  );
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
};

const getUsernameInitial = (username = "") =>
  Array.from(username.trim())[0]?.toUpperCase() || "?";

const ProfileComponent = ({ currentUser, setCurrentUser }) => {
  const navigate = useNavigate();
  const [settings, setSettings] = useState({
    acceptingOrders: true,
    paymentQrImage: "",
  });
  const [paymentQrFile, setPaymentQrFile] = useState(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [accountRecoveryCode, setAccountRecoveryCode] = useState("");
  const [recoveryPassword, setRecoveryPassword] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [recoveryCodeSaved, setRecoveryCodeSaved] = useState(true);

  const isSeller = currentUser?.user?.role === "seller";
  const hasUnsavedRecoveryCode =
    Boolean(accountRecoveryCode) && !recoveryCodeSaved;

  useRecoveryCodeGuard(hasUnsavedRecoveryCode);

  useEffect(() => {
    if (!isSeller) return;

    AuthService.getSellerSettings()
      .then((response) => setSettings(response.data))
      .catch((error) => {
        console.error(error);
        setMessage("店家設定載入失敗");
      });
  }, [isSeller]);

  const handleLogout = () => {
    if (hasUnsavedRecoveryCode) {
      window.alert("請先複製或下載救援碼，保存完成後才能登出。");
      return;
    }
    AuthService.logout();
    setCurrentUser(null);
    navigate("/login", { replace: true });
  };

  const saveStoreSettings = async ({
    acceptingOrders = settings.acceptingOrders,
    removePaymentQr = false,
  } = {}) => {
    setSaving(true);
    setMessage("");
    try {
      const response = await AuthService.updateSellerSettings({
        acceptingOrders,
        paymentQrImage: paymentQrFile,
        removePaymentQr,
      });
      setSettings(response.data);
      setPaymentQrFile(null);
      setMessage("店家設定已儲存");
    } catch (error) {
      setMessage(
        error.response?.data?.message || error.response?.data || "設定儲存失敗"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (event) => {
    event.preventDefault();
    setMessage("");
    if (newPassword !== confirmPassword) {
      setMessage("兩次輸入的新密碼不一致");
      return;
    }

    setSaving(true);
    try {
      const response = await AuthService.changePassword(
        currentPassword,
        newPassword
      );
      AuthService.setLocalUser(response.data);
      setCurrentUser(response.data);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage(response.data.message);
    } catch (error) {
      setMessage(error.response?.data || "密碼修改失敗");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async (event) => {
    event.preventDefault();
    if (hasUnsavedRecoveryCode) {
      window.alert("請先複製或下載救援碼，保存完成後才能刪除帳號。");
      return;
    }
    if (
      !window.confirm(
        "帳號、菜單、QR Code 與訂單資料都會永久刪除，確定繼續嗎？"
      )
    ) {
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      await AuthService.deleteAccount(deletePassword);
      AuthService.logout();
      setCurrentUser(null);
      navigate("/register", { replace: true });
    } catch (error) {
      setMessage(
        error.response?.data?.message || error.response?.data || "帳號刪除失敗"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerateRecoveryCode = async () => {
    if (
      !window.confirm("產生新救援碼後，之前的救援碼會立即失效。確定繼續嗎？")
    ) {
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      const response =
        await AuthService.regenerateRecoveryCode(recoveryPassword);
      setAccountRecoveryCode(response.data.recoveryCode);
      setRecoveryCodeSaved(false);
      setRecoveryPassword("");
      setMessage("新的救援碼已產生，請立即保存");
    } catch (error) {
      setMessage(error.response?.data || "救援碼產生失敗");
    } finally {
      setSaving(false);
    }
  };

  if (!currentUser) {
    return (
      <main className="app-page profile-page">
        <div className="app-page__inner app-page__inner--narrow">
          <section className="ui-empty">
            <h1>請先登入</h1>
            <p>登入後即可查看個人資料。</p>
            <Link className="btn btn-primary" to="/login">
              前往登入
            </Link>
          </section>
        </div>
      </main>
    );
  }

  const { username } = currentUser.user;

  return (
    <main className="app-page profile-page">
      <div className="app-page__inner app-page__inner--narrow">
        <header className="app-page-header profile-page-heading">
          <div>
            <p className="ui-eyebrow">帳號與設定</p>
            <h1>個人頁面</h1>
            <p>查看登入資料並管理店家的營業設定。</p>
          </div>
        </header>

        {message && <div className="alert alert-info">{message}</div>}

        <section className="profile-card">
          <div
            className="profile-avatar"
            style={{ backgroundColor: getAvatarColor(username) }}
            aria-label={`${username} 的頭像`}
          >
            {getUsernameInitial(username)}
          </div>

          <h2 className="profile-username">{username}</h2>
          <span className="profile-role">
            {isSeller ? "店家帳號" : "顧客帳號"}
          </span>

          <dl className="profile-details">
            <div>
              <dt>使用者名稱</dt>
              <dd>{username}</dd>
            </div>
            <div>
              <dt>帳號身分</dt>
              <dd>{isSeller ? "店家" : "顧客"}</dd>
            </div>
          </dl>

          <div className="profile-actions">
            <Link
              className="btn btn-outline-secondary"
              to={isSeller ? "/myProduct" : "/"}
            >
              返回{isSeller ? "餐點管理" : "菜單"}
            </Link>
            <button
              type="button"
              className="btn btn-outline-danger"
              onClick={handleLogout}
            >
              登出
            </button>
          </div>
        </section>

        {isSeller && (
          <div className="profile-settings-stack">
            <section className="profile-settings-card">
              <div>
                <p className="ui-eyebrow">營業設定</p>
                <h2>
                  {settings.acceptingOrders ? "目前接單中" : "目前暫停接單"}
                </h2>
                <p>暫停後顧客仍可查看菜單，但不能加入購物車或送出訂單。</p>
              </div>
              <button
                type="button"
                className={`btn ${
                  settings.acceptingOrders
                    ? "btn-outline-danger"
                    : "btn-success"
                }`}
                disabled={saving}
                onClick={() =>
                  saveStoreSettings({
                    acceptingOrders: !settings.acceptingOrders,
                  })
                }
              >
                {settings.acceptingOrders ? "暫停接單" : "恢復接單"}
              </button>
            </section>

            <section className="profile-settings-card">
              <div>
                <p className="ui-eyebrow">店家收款碼</p>
                <h2>掃碼付款</h2>
                <p>
                  上傳店家自己的 LINE Pay、街口或其他收款 QR
                  Code。款項會直接進入店家的收款帳戶，店家需人工確認。
                </p>
              </div>
              {settings.paymentQrImage && (
                <img
                  className="seller-payment-qr"
                  src={getProductImageUrl(settings.paymentQrImage)}
                  alt="店家收款 QR Code"
                />
              )}
              <input
                type="file"
                className="form-control"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={(event) =>
                  setPaymentQrFile(event.target.files?.[0] || null)
                }
              />
              <div className="profile-inline-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={saving || !paymentQrFile}
                  onClick={() => saveStoreSettings()}
                >
                  儲存收款碼
                </button>
                {settings.paymentQrImage && (
                  <button
                    type="button"
                    className="btn btn-outline-danger"
                    disabled={saving}
                    onClick={() => saveStoreSettings({ removePaymentQr: true })}
                  >
                    移除收款碼
                  </button>
                )}
              </div>
            </section>

            <form
              className="profile-settings-card"
              onSubmit={handleChangePassword}
            >
              <div>
                <p className="ui-eyebrow">帳號安全</p>
                <h2>修改密碼</h2>
                <p>修改後，其他裝置上的登入會失效。</p>
              </div>
              <input
                type="password"
                className="form-control"
                placeholder="目前密碼"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
              <input
                type="password"
                className="form-control"
                placeholder="新密碼（8～64 字，包含英文與數字）"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                maxLength={64}
                required
              />
              <input
                type="password"
                className="form-control"
                placeholder="再次輸入新密碼"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                maxLength={64}
                required
              />
              <button className="btn btn-primary" disabled={saving}>
                修改密碼
              </button>
            </form>

            <section className="profile-settings-card">
              <div>
                <p className="ui-eyebrow">忘記密碼救援</p>
                <h2>救援碼</h2>
                <p>
                  現有帳號可在這裡建立救援碼。產生後只會顯示在目前畫面，請自行保存。
                </p>
              </div>
              {accountRecoveryCode && (
                <>
                  <code className="recovery-code">{accountRecoveryCode}</code>
                  <RecoveryCodeActions
                    code={accountRecoveryCode}
                    username={username}
                    saved={recoveryCodeSaved}
                    onSaved={() => setRecoveryCodeSaved(true)}
                  />
                </>
              )}
              <input
                type="password"
                className="form-control"
                placeholder="輸入目前密碼"
                value={recoveryPassword}
                onChange={(event) => setRecoveryPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="btn btn-outline-primary"
                disabled={saving || !recoveryPassword || hasUnsavedRecoveryCode}
                onClick={handleRegenerateRecoveryCode}
              >
                {accountRecoveryCode ? "重新產生救援碼" : "產生救援碼"}
              </button>
            </section>

            <form
              className="profile-settings-card profile-settings-card--danger"
              onSubmit={handleDeleteAccount}
            >
              <div>
                <p className="ui-eyebrow">危險操作</p>
                <h2>刪除帳號</h2>
                <p>將永久刪除菜單、桌號 QR Code、訂單及付款紀錄，無法復原。</p>
              </div>
              <input
                type="password"
                className="form-control"
                placeholder="輸入密碼確認刪除"
                value={deletePassword}
                onChange={(event) => setDeletePassword(event.target.value)}
                autoComplete="current-password"
                required
              />
              <button className="btn btn-danger" disabled={saving}>
                永久刪除帳號
              </button>
            </form>
          </div>
        )}
      </div>
    </main>
  );
};

export default ProfileComponent;
