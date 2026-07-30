import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthService from "../services/auth.service";

const USERNAME_PATTERN = /^[\p{Script=Han}A-Za-z0-9_]+$/u;
const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).*$/;
const PASSWORD_ALLOWED_PATTERN = /^[\x20-\x7E]+$/;

const RegisterComponent = ({ setCurrentUser }) => {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");

  const validateForm = () => {
    const trimmedUsername = username.normalize("NFKC").trim();
    const usernameLength = Array.from(trimmedUsername).length;

    if (usernameLength < 2 || usernameLength > 20) {
      return "使用者名稱必須為 2～20 個字";
    }

    if (!USERNAME_PATTERN.test(trimmedUsername)) {
      return "使用者名稱只能包含中文、英文字母、數字與底線";
    }

    if (trimmedUsername.toLowerCase().startsWith("guest_")) {
      return "此使用者名稱為系統保留";
    }

    if (password.length < 8 || password.length > 64) {
      return "密碼必須為 8～64 個字元";
    }

    if (!PASSWORD_ALLOWED_PATTERN.test(password)) {
      return "密碼只能使用半形英文、數字及符號";
    }

    if (!PASSWORD_PATTERN.test(password)) {
      return "密碼必須同時包含英文字母與數字";
    }

    return "";
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    setMessage("");

    const validationMessage = validateForm();
    if (validationMessage) {
      setMessage(validationMessage);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await AuthService.register(
        username.normalize("NFKC").trim(),
        password
      );
      AuthService.clearQrUser();

      if (setCurrentUser) {
        setCurrentUser(null);
      }

      setRecoveryCode(response.data.recoveryCode);
    } catch (e) {
      setMessage(e.response?.data || "註冊失敗，請稍後再試");
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyRecoveryCode = () => {
    navigator.clipboard?.writeText(recoveryCode);
    setMessage("救援碼已複製，請妥善保存");
  };

  return (
    <main className="auth-entry-page">
      <section className="auth-entry-panel">
        <h1 className="auth-entry-title">
          Scan to Order
          <br />
          <span className="auth-entry-subtitle">掃描點餐</span>
        </h1>

        {recoveryCode ? (
          <section className="auth-entry-card">
            <h2 className="auth-entry-heading">註冊完成</h2>
            <p>這是忘記密碼時唯一可使用的救援碼，只顯示這一次，請立即保存。</p>
            <code className="recovery-code">{recoveryCode}</code>
            {message && <div className="alert alert-success">{message}</div>}
            <button
              type="button"
              className="btn btn-outline-primary"
              onClick={copyRecoveryCode}
            >
              複製救援碼
            </button>
            <button
              type="button"
              className="auth-entry-submit btn btn-primary"
              onClick={() => navigate("/login")}
            >
              前往登入
            </button>
          </section>
        ) : (
          <form className="auth-entry-card" onSubmit={handleRegister}>
            <h2 className="auth-entry-heading">建立帳號</h2>

            {message && <div className="alert alert-danger">{message}</div>}

            <label className="auth-entry-field">
              <span>使用者名稱</span>
              <input
                type="text"
                className="form-control"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="2～20 個中文、英數字或底線"
                autoComplete="username"
                minLength={2}
                maxLength={20}
                required
              />
            </label>

            <label className="auth-entry-field">
              <span>密碼</span>
              <input
                type="password"
                className="form-control"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="8～64 字，須包含英文與數字"
                autoComplete="new-password"
                minLength={8}
                maxLength={64}
                required
              />
            </label>

            <p className="auth-entry-help">
              支援中文、英文字母、數字與底線；英文大小寫視為相同帳號。
            </p>

            <button
              type="submit"
              className="auth-entry-submit btn btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? "註冊中…" : "註冊會員"}
            </button>

            <p className="auth-entry-switch">
              已經有帳號？
              <Link to="/login">前往登入</Link>
            </p>
          </form>
        )}
      </section>
    </main>
  );
};

export default RegisterComponent;
