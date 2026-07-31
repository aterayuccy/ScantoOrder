import React, { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";

import AuthService from "../services/auth.service";
import {
  SELLER_ONBOARDING_STAGES,
  setSellerOnboardingStage,
  useSellerOnboardingStage,
} from "../onboarding/seller-onboarding";

const buildQrCardCanvas = (qrCanvas, tableNumber, shopName) => {
  const scale = 2;
  const padding = 32 * scale;
  const shopNameHeight = 38 * scale;
  const tableHeight = 48 * scale;
  const footerHeight = 38 * scale;
  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = qrCanvas.width * scale + padding * 2;
  outputCanvas.height =
    qrCanvas.height * scale +
    padding * 2 +
    shopNameHeight +
    tableHeight +
    footerHeight;

  const context = outputCanvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, outputCanvas.width, outputCanvas.height);
  context.strokeStyle = "#dbe3ef";
  context.lineWidth = 2 * scale;
  context.strokeRect(
    scale,
    scale,
    outputCanvas.width - 2 * scale,
    outputCanvas.height - 2 * scale
  );
  context.fillStyle = "#0f172a";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = `600 ${18 * scale}px "Microsoft JhengHei", Arial, sans-serif`;
  context.fillText(
    String(shopName || "Scan to Order").slice(0, 20),
    outputCanvas.width / 2,
    padding + shopNameHeight / 2
  );
  context.font = `bold ${26 * scale}px "Microsoft JhengHei", Arial, sans-serif`;
  context.fillText(
    `桌號 ${tableNumber}`,
    outputCanvas.width / 2,
    padding + shopNameHeight + tableHeight / 2
  );
  context.imageSmoothingEnabled = false;
  context.drawImage(
    qrCanvas,
    padding,
    padding + shopNameHeight + tableHeight,
    qrCanvas.width * scale,
    qrCanvas.height * scale
  );
  context.fillStyle = "#0f766e";
  context.font = `600 ${16 * scale}px "Microsoft JhengHei", Arial, sans-serif`;
  context.fillText(
    "Scan to Order · 掃描點餐",
    outputCanvas.width / 2,
    outputCanvas.height - padding - footerHeight / 2
  );

  return outputCanvas;
};

const QRCodeComponent = ({ currentUser }) => {
  const onboardingStage = useSellerOnboardingStage(currentUser);
  const [createMode, setCreateMode] = useState("sequential");
  const [count, setCount] = useState("");
  const [specificTableNumber, setSpecificTableNumber] = useState("");
  const [qrList, setQrList] = useState([]);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("warning");
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
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

  useEffect(() => {
    if (onboardingStage === SELLER_ONBOARDING_STAGES.QR_CREATE) {
      setCreateMode("sequential");
    }
  }, [onboardingStage]);

  if (!currentUser) return <Navigate to="/login" />;
  if (currentUser.user.role !== "seller") return <Navigate to="/" />;

  const handleGenerate = async () => {
    const isSequential = createMode === "sequential";
    const total = Number(count);
    const tableNumber = Number(specificTableNumber);

    if (
      isSequential &&
      (!Number.isInteger(total) || total < 1 || total > 100)
    ) {
      setMessage("請輸入 1～100 之間的整數。");
      setMessageType("warning");
      return;
    }
    if (
      !isSequential &&
      (!Number.isInteger(tableNumber) || tableNumber < 1 || tableNumber > 9999)
    ) {
      setMessage("請輸入 1～9999 之間的桌號。");
      setMessageType("warning");
      return;
    }

    try {
      setIsGenerating(true);
      setMessage("");
      const response = await AuthService.createQrToken(
        isSequential
          ? { mode: "sequential", count: total }
          : { mode: "specific", tableNumber },
        currentUser
      );
      setQrList(response.data.qrCodes || []);
      setCount("");
      setSpecificTableNumber("");
      setMessage(
        isSequential
          ? `已依序新增 ${total} 個桌號 QR Code。`
          : `已新增桌號 ${tableNumber} 的 QR Code。`
      );
      setMessageType("success");
      if (
        isSequential &&
        onboardingStage === SELLER_ONBOARDING_STAGES.QR_CREATE
      ) {
        setSellerOnboardingStage(
          currentUser.user._id,
          SELLER_ONBOARDING_STAGES.QR_REVIEW
        );
      }
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
      setMessage(
        `桌號 ${qrCode.tableNumber} 已刪除，其他桌號與已印出的 QR Code 不會改號。`
      );
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

    const outputCanvas = buildQrCardCanvas(
      qrCanvas,
      qrCode.tableNumber,
      currentUser.user.username
    );

    const link = document.createElement("a");
    link.download = `桌號-${qrCode.tableNumber}-QRCode.png`;
    link.href = outputCanvas.toDataURL("image/png");
    link.click();

    if (
      onboardingStage === SELLER_ONBOARDING_STAGES.QR_REVIEW &&
      qrCode.tableNumber ===
        Math.min(...qrList.map((item) => Number(item.tableNumber)))
    ) {
      setSellerOnboardingStage(
        currentUser.user._id,
        SELLER_ONBOARDING_STAGES.PROFILE_NAV
      );
    }
  };

  const handleDownloadPdf = async () => {
    if (qrList.length === 0) return;

    try {
      setIsDownloadingPdf(true);
      setMessage("");
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
      const { jsPDF } = await import("jspdf");

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });
      const columns = 2;
      const rows = 2;
      const cardsPerPage = columns * rows;
      const cardWidth = 76;
      const cardHeight = 109;
      const columnGap = 10;
      const rowGap = 12;
      const startX =
        (210 - (cardWidth * columns + columnGap * (columns - 1))) / 2;
      const startY = (297 - (cardHeight * rows + rowGap * (rows - 1))) / 2;

      qrList.forEach((qrCode, index) => {
        if (index > 0 && index % cardsPerPage === 0) pdf.addPage();

        const card = qrCardRefs.current.get(qrCode._id);
        const qrCanvas = card?.querySelector("canvas");
        if (!qrCanvas) {
          throw new Error(`桌號 ${qrCode.tableNumber} QR Code 尚未載入`);
        }

        const pagePosition = index % cardsPerPage;
        const column = pagePosition % columns;
        const row = Math.floor(pagePosition / columns);
        const outputCanvas = buildQrCardCanvas(
          qrCanvas,
          qrCode.tableNumber,
          currentUser.user.username
        );

        pdf.addImage(
          outputCanvas.toDataURL("image/png"),
          "PNG",
          startX + column * (cardWidth + columnGap),
          startY + row * (cardHeight + rowGap),
          cardWidth,
          cardHeight,
          undefined,
          "FAST"
        );
      });

      const safeShopName = currentUser.user.username.replace(
        /[\\/:*?"<>|]/g,
        "-"
      );
      pdf.save(`${safeShopName}-桌號-QRCode.pdf`);
      setMessage(`已下載 ${qrList.length} 個桌號的 PDF。`);
      setMessageType("success");
    } catch (error) {
      console.error(error);
      setMessage(error.message || "PDF 下載失敗，請稍後再試。");
      setMessageType("warning");
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const minimumTableNumber =
    qrList.length > 0
      ? Math.min(...qrList.map((item) => Number(item.tableNumber)))
      : null;

  return (
    <main className="app-page qr-code-page">
      <div className="app-page__inner">
        <header className="app-page-header">
          <div>
            <p className="ui-eyebrow">店家後台</p>
            <h1>桌號 QR Code</h1>
            <p>產生桌號後即可下載列印，顧客掃描後會自動帶入桌號。</p>
          </div>
          <div className="qr-page-actions">
            <span className="ui-count-badge">{qrList.length} 個桌號</span>
            <button
              type="button"
              className="btn btn-outline-primary"
              onClick={handleDownloadPdf}
              disabled={
                isLoading || isGenerating || isDownloadingPdf || !qrList.length
              }
            >
              {isDownloadingPdf ? "PDF 製作中…" : "下載全部 PDF"}
            </button>
          </div>
        </header>

        <section
          className={`ui-card qr-control-card${
            onboardingStage === SELLER_ONBOARDING_STAGES.QR_CREATE
              ? " seller-guide-target"
              : ""
          }`}
        >
          <div>
            <h2>新增桌號</h2>
            <p>
              {createMode === "sequential"
                ? "輸入要新增的數量，系統會接續目前最大的桌號。"
                : "輸入指定桌號，可補回已刪除或需要對應的號碼。"}
            </p>
          </div>
          <div className="qr-create-settings">
            <fieldset className="qr-create-mode">
              <legend>新增方式</legend>
              <label
                className={createMode === "sequential" ? "is-selected" : ""}
              >
                <input
                  type="radio"
                  name="qrCreateMode"
                  value="sequential"
                  checked={createMode === "sequential"}
                  onChange={() => setCreateMode("sequential")}
                />
                <span>
                  <strong>依序新增</strong>
                  <small>從目前最大桌號繼續增加</small>
                </span>
              </label>
              <label className={createMode === "specific" ? "is-selected" : ""}>
                <input
                  type="radio"
                  name="qrCreateMode"
                  value="specific"
                  checked={createMode === "specific"}
                  disabled={
                    onboardingStage === SELLER_ONBOARDING_STAGES.QR_CREATE
                  }
                  onChange={() => setCreateMode("specific")}
                />
                <span>
                  <strong>對應桌號新增</strong>
                  <small>直接建立指定的桌號</small>
                </span>
              </label>
            </fieldset>

            <div className="qr-generate-control">
              {createMode === "sequential" ? (
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
              ) : (
                <input
                  type="number"
                  min="1"
                  max="9999"
                  className="form-control"
                  placeholder="輸入桌號"
                  value={specificTableNumber}
                  onChange={(event) =>
                    setSpecificTableNumber(event.target.value)
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") handleGenerate();
                  }}
                  aria-label="指定新增桌號"
                />
              )}
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleGenerate}
                disabled={isGenerating}
              >
                {isGenerating
                  ? "產生中…"
                  : createMode === "sequential"
                    ? "依序產生"
                    : "新增指定桌號"}
              </button>
            </div>
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
            <p>從上方選擇新增方式，即可建立第一批桌號。</p>
          </section>
        ) : (
          <section className="qr-code-grid">
            {qrList.map((item) => {
              const isGuideTarget =
                onboardingStage === SELLER_ONBOARDING_STAGES.QR_REVIEW &&
                Number(item.tableNumber) === minimumTableNumber;

              return (
                <article
                  key={item._id}
                  ref={(node) => {
                    if (node) qrCardRefs.current.set(item._id, node);
                    else qrCardRefs.current.delete(item._id);
                  }}
                  className={`qr-code-card${
                    isGuideTarget
                      ? " seller-guide-target seller-guide-qr-card"
                      : ""
                  }`}
                >
                  {isGuideTarget && (
                    <span className="seller-guide-qr-label">
                      先下載最小桌號
                    </span>
                  )}
                  <div className="qr-code-card__header">
                    <div>
                      <span>桌號</span>
                      <h2>{item.tableNumber}</h2>
                    </div>
                    <button
                      type="button"
                      className={`btn btn-sm btn-outline-secondary${
                        isGuideTarget ? " seller-guide-allowed-action" : ""
                      }`}
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
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
};

export default QRCodeComponent;
