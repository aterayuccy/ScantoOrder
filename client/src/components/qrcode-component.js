import React, { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";

import AuthService from "../services/auth.service";

const QRCodeComponent = ({ currentUser }) => {
  const [count, setCount] = useState("");
  const [qrList, setQrList] = useState([]);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("warning");
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [deletingQrCodeId, setDeletingQrCodeId] = useState("");
  const qrCardRefs = useRef(new Map());

  const buildQrUrl = (token) =>
    `${
      process.env.REACT_APP_CLIENT_URL || window.location.origin
    }/qr-login?qrToken=${token}`;

  useEffect(() => {
    if (!currentUser || currentUser.user.role !== "seller") return;

    let active = true;
    AuthService.setSellerUser(currentUser);
    setIsLoading(true);

    AuthService.getQrCodes(currentUser)
      .then((response) => {
        if (!active) return;
        setQrList(response.data.qrCodes || []);
        setMessage("");
      })
      .catch((error) => {
        console.error(error);
        if (!active) return;
        setMessage(error?.response?.data || "QR Code 載入失敗。");
        setMessageType("warning");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [currentUser]);

  if (!currentUser) return <Navigate to="/login" />;
  if (currentUser.user.role !== "seller") return <Navigate to="/" />;

  const handleGenerate = async () => {
    const total = Number(count);

    if (!Number.isInteger(total) || total < 1 || total > 100) {
      setMessage("請輸入 1～100 之間的整數。");
      setMessageType("warning");
      return;
    }

    try {
      setIsGenerating(true);
      setMessage("");
      const response = await AuthService.createQrToken(total, currentUser);
      setQrList(response.data.qrCodes || []);
      setCount("");
      setMessage(`已新增 ${total} 個桌號 QR Code。`);
      setMessageType("success");
    } catch (error) {
      console.error(error);
      setMessage(error?.response?.data || "產生 QR Code 失敗。");
      setMessageType("warning");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDelete = async (qrCode) => {
    if (
      !window.confirm(`確定要刪除桌號 ${qrCode.tableNumber} 的 QR Code 嗎？`)
    ) {
      return;
    }

    try {
      setDeletingQrCodeId(qrCode._id);
      setMessage("");
      const response = await AuthService.deleteQrCode(qrCode._id, currentUser);
      setQrList(response.data.qrCodes || []);
      setMessage(`桌號 ${qrCode.tableNumber} 已刪除。`);
      setMessageType("success");
    } catch (error) {
      console.error(error);
      setMessage(error?.response?.data || "刪除 QR Code 失敗。");
      setMessageType("warning");
    } finally {
      setDeletingQrCodeId("");
    }
  };

  const handleDownload = (qrCode) => {
    const card = qrCardRefs.current.get(qrCode._id);
    const qrCanvas = card?.querySelector("canvas");

    if (!qrCanvas) {
      setMessage("QR Code 尚未載入完成，請稍後再試。");
      setMessageType("warning");
      return;
    }

    const padding = 32;
    const titleHeight = 48;
    const outputCanvas = document.createElement("canvas");
    outputCanvas.width = qrCanvas.width + padding * 2;
    outputCanvas.height = qrCanvas.height + padding * 2 + titleHeight;

    const context = outputCanvas.getContext("2d");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, outputCanvas.width, outputCanvas.height);
    context.fillStyle = "#0f172a";
    context.font = "bold 24px Arial, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(
      `桌號 ${qrCode.tableNumber}`,
      outputCanvas.width / 2,
      padding + titleHeight / 2
    );
    context.drawImage(qrCanvas, padding, padding + titleHeight);

    const link = document.createElement("a");
    link.download = `桌號-${qrCode.tableNumber}-QRCode.png`;
    link.href = outputCanvas.toDataURL("image/png");
    link.click();
  };

  return (
    <main className="app-page qr-code-page">
      <div className="app-page__inner">
        <header className="app-page-header">
          <div>
            <p className="ui-eyebrow">店家後台</p>
            <h1>桌號 QR Code</h1>
            <p>產生桌號後即可下載列印，顧客掃描後會自動帶入桌號。</p>
          </div>
          <span className="ui-count-badge">{qrList.length} 個桌號</span>
        </header>

        <section className="ui-card qr-control-card">
          <div>
            <h2>新增桌號</h2>
            <p>輸入要新增的數量，系統會接續目前最大的桌號。</p>
          </div>
          <div className="qr-generate-control">
            <input
              type="number"
              min="1"
              max="100"
              className="form-control"
              placeholder="新增數量"
              value={count}
              onChange={(event) => setCount(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleGenerate();
              }}
              aria-label="新增 QR Code 數量"
            />
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? "產生中…" : "產生"}
            </button>
          </div>
        </section>

        {message && (
          <div className={`alert alert-${messageType}`} role="status">
            {message}
          </div>
        )}

        {isLoading ? (
          <section className="ui-status" aria-live="polite">
            <span className="ui-spinner" aria-hidden="true" />
            <p>QR Code 載入中…</p>
          </section>
        ) : qrList.length === 0 ? (
          <section className="ui-empty">
            <span className="ui-empty-icon" aria-hidden="true">
              ▦
            </span>
            <h2>還沒有桌號 QR Code</h2>
            <p>從上方輸入新增數量，即可建立第一批桌號。</p>
          </section>
        ) : (
          <section className="qr-code-grid">
            {qrList.map((item) => (
              <article
                key={item._id}
                ref={(node) => {
                  if (node) qrCardRefs.current.set(item._id, node);
                  else qrCardRefs.current.delete(item._id);
                }}
                className="qr-code-card"
              >
                <div className="qr-code-card__header">
                  <div>
                    <span>桌號</span>
                    <h2>{item.tableNumber}</h2>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => handleDownload(item)}
                  >
                    下載
                  </button>
                </div>

                <div className="qr-code-canvas">
                  <QRCodeCanvas value={buildQrUrl(item.token)} size={220} />
                </div>

                <button
                  type="button"
                  className="btn btn-outline-danger"
                  onClick={() => handleDelete(item)}
                  disabled={deletingQrCodeId === item._id || isGenerating}
                >
                  {deletingQrCodeId === item._id ? "刪除中…" : "刪除桌號"}
                </button>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
};

export default QRCodeComponent;
