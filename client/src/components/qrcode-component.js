import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import AuthService from "../services/auth.service";

const QRCodeComponent = ({ currentUser }) => {
  const [count, setCount] = useState("");
  const [qrList, setQrList] = useState([]);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [deletingQrCodeId, setDeletingQrCodeId] = useState("");

  const buildQrUrl = (token) =>
    `${
      process.env.REACT_APP_CLIENT_URL || window.location.origin
    }/qr-login?qrToken=${token}`;

  useEffect(() => {
    if (!currentUser || currentUser.user.role !== "seller") {
      return;
    }

    AuthService.setSellerUser(currentUser);
    setIsLoading(true);
    AuthService.getQrCodes(currentUser)
      .then((res) => {
        setQrList(res.data.qrCodes || []);
        setMessage("");
      })
      .catch((e) => {
        console.log(e);
        setMessage(e?.response?.data || "取得 QR code 失敗");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [currentUser]);

  if (!currentUser) {
    return <Navigate to="/login" />;
  }

  if (currentUser.user.role !== "seller") {
    return <Navigate to="/" />;
  }

  const handleGenerate = async () => {
    const total = Number(count);

    if (!Number.isInteger(total) || total < 1) {
      setMessage("請輸入正確的 QR code 生成數量");
      return;
    }

    try {
      setIsGenerating(true);
      setMessage("正在生成...");

      const res = await AuthService.createQrToken(total, currentUser);

      setQrList(res.data.qrCodes || []);
      setCount("");
      setMessage("");
    } catch (e) {
      console.log(e);
      setMessage(e?.response?.data || "生成 QR code 失敗");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDelete = async (qrCode) => {
    if (!window.confirm(`確定要刪除桌號 ${qrCode.tableNumber} 的 QR code 嗎？`)) {
      return;
    }

    try {
      setDeletingQrCodeId(qrCode._id);
      setMessage("正在刪除...");

      const res = await AuthService.deleteQrCode(qrCode._id, currentUser);

      setQrList(res.data.qrCodes || []);
      setMessage("");
    } catch (e) {
      console.log(e);
      setMessage(e?.response?.data || "刪除 QR code 失敗");
    } finally {
      setDeletingQrCodeId("");
    }
  };

  return (
    <div className="qr-code-page">
      <h2>店家 QR Code</h2>
      <p>選擇要新增的 QR code 數量，系統會自動接續桌號。</p>

      <div
        className="input-group qr-generate-control"
        style={{
          marginTop: "1.5rem",
          marginBottom: "1.5rem",
        }}
      >
        <input
          type="number"
          min="1"
          className="form-control"
          placeholder="新增數量"
          value={count}
          onChange={(e) => setCount(e.target.value)}
        />

        <button
          className="btn btn-primary"
          onClick={handleGenerate}
          disabled={isGenerating}
        >
          {isGenerating ? "生成中..." : "生成"}
        </button>
      </div>

      {message && <p>{message}</p>}

      {isLoading && <p>載入 QR code 中...</p>}

      {!isLoading && qrList.length === 0 && (
        <p>目前尚未生成 QR code，請先輸入數量並生成。</p>
      )}

      {qrList.length > 0 && (
        <div
          className="qr-code-grid"
          style={{
            display: "grid",
            marginTop: "2rem",
          }}
        >
          {qrList.map((item) => (
            <div
              key={item._id}
              className="card qr-code-card"
            >
              <h5 className="qr-code-title">桌號 {item.tableNumber}</h5>

              <QRCodeCanvas value={buildQrUrl(item.token)} size={220} />

              <button
                className="btn btn-danger btn-sm"
                onClick={() => handleDelete(item)}
                disabled={deletingQrCodeId === item._id || isGenerating}
                style={{ width: "220px", maxWidth: "100%" }}
              >
                {deletingQrCodeId === item._id ? "刪除中..." : "刪除"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default QRCodeComponent;
