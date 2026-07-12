import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthService from "../services/auth.service";

const AuthEntryComponent = ({ setCurrentUser }) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleLogin = async () => {
    setMessage("");

    try {
      const response = await AuthService.login(email, password);
      AuthService.setLocalUser(response.data);
      setCurrentUser(response.data);
      navigate("/myProduct");
    } catch (e) {
      setMessage(e.response?.data || "登入失敗，請確認帳號密碼");
    }
  };

  return (
    <main className="auth-entry-page">
      <section className="auth-entry-panel">
        <h1 className="auth-entry-title">點餐網站</h1>

        <div className="auth-entry-card">
          <h2 className="auth-entry-heading">登入</h2>

          {message && <div className="alert alert-danger">{message}</div>}

          <label className="auth-entry-field">
            <span>帳號</span>
            <input
              type="text"
              className="form-control"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="請輸入帳號"
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
            />
          </label>

          <button
            type="button"
            className="auth-entry-submit btn btn-primary"
            onClick={handleLogin}
          >
            登入
          </button>

          <p className="auth-entry-switch">
            還沒有帳號？
            <Link to="/register">註冊</Link>
          </p>
        </div>
      </section>
    </main>
  );
};

export default AuthEntryComponent;
