import React, { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import AuthService from "../services/auth.service";

const QRLoginComponent = ({ setCurrentUser }) => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("正在確認桌號…");
  const loginStartedRef = useRef(false);

  useEffect(() => {
    if (loginStartedRef.current) return undefined;
    loginStartedRef.current = true;
    const qrToken = searchParams.get("qrToken");

    if (!qrToken) {
      setStatus("error");
      setMessage("這個連結缺少 QR Code 資訊。");
      return undefined;
    }

    let redirectTimer;
    AuthService.qrLogin(qrToken)
      .then((response) => {
        AuthService.setQrUser(response.data);
        if (setCurrentUser) setCurrentUser(response.data);
        setStatus("success");
        setMessage("桌號確認完成，即將進入點餐頁。");

        redirectTimer = window.setTimeout(() => {
          window.location.href = "/";
        }, 900);
      })
      .catch((error) => {
        console.error(error);
        setStatus("error");
        setMessage(error?.response?.data || "QR Code 登入失敗。");
      });

    return () => {
      if (redirectTimer) window.clearTimeout(redirectTimer);
    };
  }, [searchParams, setCurrentUser]);

  return (
    <main className="auth-entry-page qr-login-page">
      <section className="qr-login-card" aria-live="polite">
        <div className={`qr-login-icon is-${status}`} aria-hidden="true">
          {status === "loading" ? (
            <span className="ui-spinner" />
          ) : status === "success" ? (
            "✓"
          ) : (
            "!"
          )}
        </div>
        <p className="ui-eyebrow">Scan to Order</p>
        <h1>
          {status === "loading"
            ? "確認桌號"
            : status === "success"
              ? "可以開始點餐"
              : "無法進入點餐頁"}
        </h1>
        <p>{message}</p>
        {status === "error" && (
          <Link className="btn btn-primary" to="/login">
            前往登入
          </Link>
        )}
      </section>
    </main>
  );
};

export default QRLoginComponent;
