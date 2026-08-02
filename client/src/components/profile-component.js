import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import AuthService from "../services/auth.service";
import { getProductImageUrl } from "../services/product.service";
import {
  completeSellerOnboarding,
  SELLER_ONBOARDING_STAGES,
  useSellerOnboardingStage,
} from "../onboarding/seller-onboarding";
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

const formatSubscriptionDate = (value) =>
  value
    ? new Intl.DateTimeFormat("zh-TW", { dateStyle: "long" }).format(
        new Date(value)
      )
    : "尚未設定";

const getLocalDateTimeInputValue = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 16);
};

const ProfileComponent = ({ currentUser, setCurrentUser }) => {
  const navigate = useNavigate();
  const onboardingStage = useSellerOnboardingStage(currentUser);
  const paymentSectionRef = useRef(null);
  const [settings, setSettings] = useState({
    acceptingOrders: true,
    linePayAvailable: false,
    linePayMerchantReady: false,
    linePayConfigured: false,
    linePayChannelIdHint: "",
  });
  const [linePayChannelId, setLinePayChannelId] = useState("");
  const [linePayChannelSecret, setLinePayChannelSecret] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [accountRecoveryCode, setAccountRecoveryCode] = useState("");
  const [recoveryPassword, setRecoveryPassword] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [recoveryCodeSaved, setRecoveryCodeSaved] = useState(true);
  const [subscriptionData, setSubscriptionData] = useState({
    subscription: null,
    paymentSettings: null,
  });
  const [renewalOpen, setRenewalOpen] = useState(false);
  const [renewalTransferAt, setRenewalTransferAt] = useState(
    getLocalDateTimeInputValue
  );
  const [renewalAccountLastFive, setRenewalAccountLastFive] = useState("");
  const [renewalNote, setRenewalNote] = useState("");

  const isSeller = currentUser?.user?.role === "seller";
  const hasUnsavedRecoveryCode =
    Boolean(accountRecoveryCode) && !recoveryCodeSaved;

  useRecoveryCodeGuard(hasUnsavedRecoveryCode);

  useEffect(() => {
    if (!isSeller) return;

    Promise.all([
      AuthService.getSellerSettings(),
      AuthService.getSubscription(),
    ])
      .then(([settingsResponse, subscriptionResponse]) => {
        setSettings(settingsResponse.data);
        setSubscriptionData(subscriptionResponse.data);

        const subscriptionStatus =
          subscriptionResponse.data?.subscription?.status;
        if (
          subscriptionStatus &&
          currentUser?.user?.subscriptionStatus !== subscriptionStatus
        ) {
          const nextUser = {
            ...currentUser,
            user: {
              ...currentUser.user,
              subscriptionStatus,
              serviceExpiresAt:
                subscriptionResponse.data.subscription.expiresAt,
            },
          };
          AuthService.setLocalUser(nextUser);
          setCurrentUser(nextUser);
        }
      })
      .catch((error) => {
        console.error(error);
        setMessage("店家設定載入失敗");
      });
  }, [currentUser, isSeller, setCurrentUser]);

  useEffect(() => {
    if (
      onboardingStage === SELLER_ONBOARDING_STAGES.PAYMENT &&
      paymentSectionRef.current
    ) {
      paymentSectionRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [onboardingStage]);

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
    linePayMerchantReady,
    linePayChannelId: nextLinePayChannelId,
    linePayChannelSecret: nextLinePayChannelSecret,
    successMessage = "店家設定已儲存",
  } = {}) => {
    setSaving(true);
    setMessage("");
    try {
      const response = await AuthService.updateSellerSettings({
        acceptingOrders,
        linePayMerchantReady,
        linePayChannelId: nextLinePayChannelId,
        linePayChannelSecret: nextLinePayChannelSecret,
      });
      setSettings(response.data);
      if (typeof linePayMerchantReady === "boolean") {
        setLinePayChannelId("");
        setLinePayChannelSecret("");
      }
      setMessage(successMessage);
      return response.data;
    } catch (error) {
      setMessage(
        error.response?.data?.message || error.response?.data || "設定儲存失敗"
      );
      return null;
    } finally {
      setSaving(false);
    }
  };

  const savePaymentSettings = async () => {
    const hasChannelId = Boolean(linePayChannelId.trim());
    const hasChannelSecret = Boolean(linePayChannelSecret.trim());
    if (hasChannelId !== hasChannelSecret) {
      setMessage("請同時輸入 Channel ID 與 Channel Secret");
      return;
    }
    if (!settings.linePayConfigured && !hasChannelId) {
      setMessage("請輸入 LINE Pay 網路串接金鑰");
      return;
    }

    const savedSettings = await saveStoreSettings({
      linePayMerchantReady: true,
      linePayChannelId,
      linePayChannelSecret,
      successMessage: "自動 LINE Pay 設定已儲存",
    });
    if (savedSettings && onboardingStage === SELLER_ONBOARDING_STAGES.PAYMENT) {
      completeSellerOnboarding(currentUser.user._id);
      setMessage("自動 LINE Pay 已開啟，店家開通引導完成。");
    }
  };

  const finishWithStorePayment = () => {
    completeSellerOnboarding(currentUser.user._id);
    setMessage("已先使用店內付款，之後可隨時回來設定 LINE Pay 金鑰。");
  };

  const disableLinePay = async () => {
    if (
      !window.confirm(
        "停用後會刪除已儲存的 LINE Pay 金鑰，客人只會看到店內付款。確定繼續嗎？"
      )
    ) {
      return;
    }

    await saveStoreSettings({
      linePayMerchantReady: false,
      successMessage: "已停用自動 LINE Pay，客人目前只能選擇店內付款",
    });
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

  const submitRenewal = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await AuthService.submitSubscriptionRenewal({
        transferAt: new Date(renewalTransferAt).toISOString(),
        accountLastFive: renewalAccountLastFive,
        note: renewalNote,
      });
      setSubscriptionData((current) => ({
        ...current,
        subscription: response.data.subscription,
      }));
      setRenewalOpen(false);
      setRenewalAccountLastFive("");
      setRenewalNote("");
      setMessage("續費申請已送出，待平台確認款項後才會延長使用期限。");
    } catch (error) {
      setMessage(
        error.response?.data?.message ||
          error.response?.data ||
          "續費申請送出失敗"
      );
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
  const subscription = subscriptionData.subscription;
  const subscriptionPayment = subscriptionData.paymentSettings;
  const renewalPending = subscription?.renewalRequest?.status === "pending";
  const renewalRejected = subscription?.renewalRequest?.status === "rejected";
  const serviceSuspended = subscription?.status === "suspended";

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
            {!serviceSuspended && (
              <Link
                className="btn btn-outline-secondary"
                to={isSeller ? "/myProduct" : "/"}
              >
                返回{isSeller ? "餐點管理" : "菜單"}
              </Link>
            )}
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
            <section className="profile-settings-card subscription-card">
              <div className="subscription-card__heading">
                <div>
                  <p className="ui-eyebrow">使用模式</p>
                  <h2>{subscription?.statusLabel || "載入中…"}</h2>
                  <p>
                    {serviceSuspended
                      ? "服務功能目前暫停，完成續費並由平台確認後即可恢復。"
                      : "到期日前皆可正常使用；進入最後七天時會開放付費續用。"}
                  </p>
                </div>
                {subscription && (
                  <span
                    className={`subscription-status subscription-status--${subscription.status}`}
                  >
                    {subscription.statusLabel}
                  </span>
                )}
              </div>

              {subscription && (
                <dl className="subscription-details">
                  <div>
                    <dt>開始日期</dt>
                    <dd>{formatSubscriptionDate(subscription.startedAt)}</dd>
                  </div>
                  <div>
                    <dt>使用期限</dt>
                    <dd>{formatSubscriptionDate(subscription.expiresAt)}</dd>
                  </div>
                  <div>
                    <dt>剩餘天數</dt>
                    <dd>
                      {serviceSuspended
                        ? "已到期"
                        : `${subscription.daysRemaining} 天`}
                    </dd>
                  </div>
                  <div>
                    <dt>續費金額</dt>
                    <dd>每月 {subscriptionPayment?.monthlyFee ?? 299} 元</dd>
                  </div>
                </dl>
              )}

              {renewalPending && (
                <div className="alert alert-info subscription-inline-alert">
                  已申報轉帳，正在等待平台人工核帳；確認前不會視為完成續費。
                </div>
              )}
              {renewalRejected && (
                <div className="alert alert-danger subscription-inline-alert">
                  {subscription.renewalRequest.reviewMessage ||
                    "查無款項，請確認後重新提交。"}
                </div>
              )}

              {subscription?.canRenew && !renewalPending && (
                <button
                  type="button"
                  className="btn btn-primary subscription-renew-button"
                  onClick={() => setRenewalOpen((current) => !current)}
                >
                  {serviceSuspended ? "付費恢復使用" : "付費續用"}
                </button>
              )}

              {renewalOpen && subscription?.canRenew && !renewalPending && (
                <form
                  className="subscription-renewal-panel"
                  onSubmit={submitRenewal}
                >
                  <div>
                    <h3>掃描收款碼完成轉帳</h3>
                    <p>
                      請轉帳 {subscriptionPayment?.monthlyFee ?? 299}
                      元。提交資料後，需等待平台人工查帳並確認。
                    </p>
                  </div>

                  {subscriptionPayment?.paymentQrImage ? (
                    <img
                      className="subscription-payment-qr"
                      src={getProductImageUrl(
                        subscriptionPayment.paymentQrImage
                      )}
                      alt="平台續費收款碼"
                    />
                  ) : (
                    <div className="subscription-payment-missing">
                      平台尚未設定收款碼，請先聯絡客服。
                    </div>
                  )}

                  {subscriptionPayment?.payeeName && (
                    <p className="subscription-payee">
                      收款人：{subscriptionPayment.payeeName}
                    </p>
                  )}
                  {subscriptionPayment?.paymentInstructions && (
                    <p className="subscription-payment-note">
                      {subscriptionPayment.paymentInstructions}
                    </p>
                  )}

                  <label className="profile-settings-field">
                    <span>轉帳時間</span>
                    <input
                      type="datetime-local"
                      className="form-control"
                      value={renewalTransferAt}
                      onChange={(event) =>
                        setRenewalTransferAt(event.target.value)
                      }
                      required
                    />
                  </label>
                  <label className="profile-settings-field">
                    <span>轉帳帳號末五碼</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      className="form-control"
                      value={renewalAccountLastFive}
                      onChange={(event) =>
                        setRenewalAccountLastFive(
                          event.target.value.replace(/\D/g, "").slice(0, 5)
                        )
                      }
                      placeholder="五位數字"
                      pattern="\d{5}"
                      maxLength={5}
                      required
                    />
                  </label>
                  <label className="profile-settings-field">
                    <span>備註（選填）</span>
                    <input
                      type="text"
                      className="form-control"
                      value={renewalNote}
                      onChange={(event) => setRenewalNote(event.target.value)}
                      maxLength={200}
                    />
                  </label>
                  <div className="profile-inline-actions">
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={
                        saving ||
                        renewalAccountLastFive.length !== 5 ||
                        !subscriptionPayment?.paymentQrImage
                      }
                    >
                      我已完成轉帳
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => setRenewalOpen(false)}
                    >
                      取消
                    </button>
                  </div>
                </form>
              )}
            </section>

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
                disabled={saving || serviceSuspended}
                onClick={() =>
                  saveStoreSettings({
                    acceptingOrders: !settings.acceptingOrders,
                  })
                }
              >
                {settings.acceptingOrders ? "暫停接單" : "恢復接單"}
              </button>
            </section>

            <section
              ref={paymentSectionRef}
              className={`profile-settings-card${
                onboardingStage === SELLER_ONBOARDING_STAGES.PAYMENT
                  ? " seller-guide-target seller-guide-payment"
                  : ""
              }`}
            >
              <div>
                <p className="ui-eyebrow">付款設定</p>
                <h2>店家如何收款？</h2>
                <p>
                  店內付款永遠可以使用；如已申請 LINE Pay
                  合作商店，可輸入金鑰開啟自動付款。
                </p>
              </div>

              <div className="profile-payment-setup-panel">
                <div
                  className={`profile-payment-status${
                    settings.linePayConfigured ? " is-ready" : ""
                  }`}
                >
                  {settings.linePayConfigured
                    ? `自動 LINE Pay 已開啟（Channel ID 尾碼 ${settings.linePayChannelIdHint}）`
                    : "尚未開啟自動 LINE Pay，目前僅提供店內付款"}
                </div>
                <label className="profile-settings-field">
                  <span>Channel ID</span>
                  <input
                    type="text"
                    className="form-control"
                    value={linePayChannelId}
                    placeholder={
                      settings.linePayConfigured
                        ? "留空表示不更換"
                        : "輸入 LINE Pay Channel ID"
                    }
                    maxLength={100}
                    autoComplete="off"
                    onChange={(event) =>
                      setLinePayChannelId(event.target.value)
                    }
                  />
                </label>
                <label className="profile-settings-field">
                  <span>Channel Secret</span>
                  <input
                    type="password"
                    className="form-control"
                    value={linePayChannelSecret}
                    placeholder={
                      settings.linePayConfigured
                        ? "留空表示不更換"
                        : "輸入 LINE Pay Channel Secret"
                    }
                    maxLength={300}
                    autoComplete="new-password"
                    onChange={(event) =>
                      setLinePayChannelSecret(event.target.value)
                    }
                  />
                </label>
                <p className="profile-payment-security-note">
                  只有 LINE Pay
                  合作商店的正式金鑰可以使用。金鑰會加密保存，儲存後不會再次顯示完整內容。
                </p>
              </div>

              <div className="profile-inline-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={saving}
                  onClick={savePaymentSettings}
                >
                  {settings.linePayConfigured
                    ? "更新 LINE Pay 金鑰"
                    : "開啟自動 LINE Pay"}
                </button>
                {settings.linePayConfigured && (
                  <button
                    type="button"
                    className="btn btn-outline-danger"
                    disabled={saving}
                    onClick={disableLinePay}
                  >
                    停用自動 LINE Pay
                  </button>
                )}
                {onboardingStage === SELLER_ONBOARDING_STAGES.PAYMENT &&
                  !settings.linePayConfigured && (
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      disabled={saving}
                      onClick={finishWithStorePayment}
                    >
                      尚無商家金鑰，先使用店內付款
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
              <label className="profile-settings-field">
                <span>目前密碼</span>
                <input
                  type="password"
                  className="form-control"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                />
              </label>
              <label className="profile-settings-field">
                <span>新密碼</span>
                <input
                  type="password"
                  className="form-control"
                  placeholder="8～64 字，包含英文與數字"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={64}
                  required
                />
              </label>
              <label className="profile-settings-field">
                <span>再次輸入新密碼</span>
                <input
                  type="password"
                  className="form-control"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={64}
                  required
                />
              </label>
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
              <label className="profile-settings-field">
                <span>目前密碼</span>
                <input
                  type="password"
                  className="form-control"
                  value={recoveryPassword}
                  onChange={(event) => setRecoveryPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                />
              </label>
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
              <label className="profile-settings-field">
                <span>輸入密碼確認刪除</span>
                <input
                  type="password"
                  className="form-control"
                  value={deletePassword}
                  onChange={(event) => setDeletePassword(event.target.value)}
                  autoComplete="current-password"
                  required
                />
              </label>
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
