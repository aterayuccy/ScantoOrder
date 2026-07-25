import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthService from "../services/auth.service";

const AuthEntryComponent = ({ setCurrentUser }) => {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async (event) => {
    event.preventDefault();
    setMessage("");
    setIsSubmitting(true);

    try {
      const response = await AuthService.login(username.trim(), password);
      AuthService.setLocalUser(response.data);
      setCurrentUser(response.data);
      navigate("/myProduct");
    } catch (e) {
      setMessage(e.response?.data || "登入失敗，請確認帳號密碼");
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

        <form className="auth-entry-card" onSubmit={handleLogin}>
          <h2 className="auth-entry-heading">登入</h2>

          {message && <div className="alert alert-danger">{message}</div>}

          <label className="auth-entry-field">
            <span>使用者名稱</span>
            <input
              type="text"
              className="form-control"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="請輸入使用者名稱"
              autoComplete="username"
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
              onChange={(e) => setPassword(e.target.value)}
              placeholder="請輸入密碼"
              autoComplete="current-password"
              maxLength={64}
              required
            />
          </label>

          <button
            type="submit"
            className="auth-entry-submit btn btn-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? "登入中…" : "登入"}
          </button>

          <p className="auth-entry-switch">
            還沒有帳號？
            <Link to="/register">前往註冊</Link>
          </p>
        </form>
      </section>
    </main>
  );
};

export default AuthEntryComponent;
