import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import AuthService from "../services/auth.service";

const QRLoginComponent = ({ setCurrentUser }) => {
  const [searchParams] = useSearchParams();
  const [message, setMessage] = useState("登入中...");

  useEffect(() => {
    const qrToken = searchParams.get("qrToken");

    if (!qrToken) {
      setMessage("無效的 QR Code");
      return;
    }

    AuthService.qrLogin(qrToken)
      .then((res) => {
        console.log("qr login success =", res.data);

        AuthService.setQrUser(res.data);

        if (setCurrentUser) {
          setCurrentUser(res.data);
        }

        setMessage(
          `登入成功，身分：${res.data?.user?.role}，帳號：${res.data?.user?.username}`
        );

        setTimeout(() => {
          window.location.href = "/product";
        }, 1500);
      })
      .catch((e) => {
        console.log("qr login failed =", e);
        console.log("response =", e.response);
        setMessage(e?.response?.data || "QR 登入失敗");
      });
  }, [searchParams, setCurrentUser]);

  return (
    <div style={{ padding: "3rem" }}>
      <p>{message}</p>
    </div>
  );
};

export default QRLoginComponent;
