import { useEffect, useMemo, useState } from "react";

import { getProductImageUrl } from "../../services/product.service";
import PlatformAdminService from "../../services/platform-admin.service";

const SubscriptionSettingsSection = ({ adminKey }) => {
  const [settings, setSettings] = useState({
    monthlyFee: 299,
    payeeName: "",
    paymentInstructions: "",
    paymentQrImage: "",
  });
  const [image, setImage] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const previewUrl = useMemo(
    () => (image ? URL.createObjectURL(image) : ""),
    [image]
  );

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl]
  );

  useEffect(() => {
    let active = true;
    PlatformAdminService.getSubscriptionSettings(adminKey)
      .then((response) => {
        if (active) setSettings(response.data);
      })
      .catch((error) => {
        if (active) {
          setMessage(
            error.response?.data?.message ||
              error.response?.data ||
              "收款設定載入失敗"
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [adminKey]);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await PlatformAdminService.updateSubscriptionSettings(
        adminKey,
        { ...settings, image }
      );
      setSettings(response.data);
      setImage(null);
      setMessage("平台收款設定已儲存。");
    } catch (error) {
      setMessage(
        error.response?.data?.message ||
          error.response?.data ||
          "收款設定儲存失敗"
      );
    } finally {
      setSaving(false);
    }
  };

  const qrPreview = previewUrl || getProductImageUrl(settings.paymentQrImage);

  return (
    <section
      className="platform-admin-section"
      aria-labelledby="subscription-settings-title"
    >
      <div className="platform-admin-section__heading">
        <div>
          <p className="ui-eyebrow">平台收款</p>
          <h2 id="subscription-settings-title">收款碼與月費</h2>
          <p>店家進入最後七天或帳號暫停後，會在個人頁面看到這組資料。</p>
        </div>
      </div>

      {message && <div className="alert alert-info">{message}</div>}

      <form className="platform-payment-settings" onSubmit={submit}>
        <label className="profile-settings-field">
          <span>每月費用</span>
          <div className="platform-payment-fee-input">
            <input
              type="number"
              className="form-control"
              min="1"
              max="100000"
              step="1"
              value={settings.monthlyFee}
              disabled={loading}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  monthlyFee: event.target.value,
                }))
              }
              required
            />
            <span>元／月</span>
          </div>
        </label>

        <label className="profile-settings-field">
          <span>收款人名稱</span>
          <input
            type="text"
            className="form-control"
            value={settings.payeeName}
            disabled={loading}
            maxLength={100}
            placeholder="例如：王小明"
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                payeeName: event.target.value,
              }))
            }
          />
        </label>

        <label className="profile-settings-field">
          <span>收款碼圖片</span>
          <input
            type="file"
            className="form-control"
            accept="image/png,image/jpeg,image/webp,image/gif"
            disabled={loading}
            onChange={(event) => setImage(event.target.files?.[0] || null)}
          />
        </label>

        {qrPreview ? (
          <img
            className="platform-payment-qr-preview"
            src={qrPreview}
            alt="平台續費收款碼預覽"
          />
        ) : (
          <div className="subscription-payment-missing">
            尚未上傳收款碼，店家目前無法提交續費申請。
          </div>
        )}

        <label className="profile-settings-field">
          <span>付款說明</span>
          <textarea
            className="form-control"
            value={settings.paymentInstructions}
            disabled={loading}
            maxLength={500}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                paymentInstructions: event.target.value,
              }))
            }
          />
        </label>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading || saving}
        >
          {saving ? "儲存中…" : "儲存收款設定"}
        </button>
      </form>
    </section>
  );
};

export default SubscriptionSettingsSection;
