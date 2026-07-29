import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthService from "../services/auth.service";

const USERNAME_PATTERN = /^[A-Za-z0-9_]+$/;
const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).*$/;
const PASSWORD_ALLOWED_PATTERN = /^[\x20-\x7E]+$/;

const RegisterComponent = ({ setCurrentUser }) => {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = () => {
    const trimmedUsername = username.trim();

    if (trimmedUsername.length < 3 || trimmedUsername.length > 20) {
      return "使用者名稱必須為 3～20 個字元";
    }

    if (!USERNAME_PATTERN.test(trimmedUsername)) {
      return "使用者名稱只能包含英文字母、數字及底線";
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
      await AuthService.register(username.trim(), password);
      AuthService.clearQrUser();

      if (setCurrentUser) {
        setCurrentUser(null);
      }

      window.alert("您已成功註冊");
      navigate("/login");
    } catch (e) {
      setMessage(e.response?.data || "註冊失敗，請稍後再試");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-entry-page">
      <section className="auth-entry-panel">
        <h1 className="auth-entry-title">
          Scan to Order
          <br />
          <span className="auth-entry-subtitle">掃描點餐</span>
        </h1>

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
              placeholder="3～20 個英文字母、數字或底線"
              autoComplete="username"
              minLength={3}
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
            使用者名稱不分英文大小寫，註冊後不可與其他人重複。
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
      </section>
    </main>
  );
};

export default RegisterComponent;
