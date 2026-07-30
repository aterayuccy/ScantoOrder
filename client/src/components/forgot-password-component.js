import { useState } from "react";
import { Link } from "react-router-dom";

import AuthService from "../services/auth.service";

const ForgotPasswordComponent = () => {
  const [username, setUsername] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [nextRecoveryCode, setNextRecoveryCode] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setMessage("");

    if (newPassword !== confirmPassword) {
      setMessage("兩次輸入的新密碼不一致");
      return;
    }

    setSubmitting(true);
    try {
      const response = await AuthService.resetPassword(
        username.normalize("NFKC").trim(),
        recoveryCode,
        newPassword
      );
      setNextRecoveryCode(response.data.recoveryCode);
    } catch (error) {
      setMessage(error.response?.data || "密碼重設失敗");
    } finally {
      setSubmitting(false);
    }
  };

  const copyRecoveryCode = () => {
    navigator.clipboard?.writeText(nextRecoveryCode);
    setMessage("新的救援碼已複製");
  };

  return (
    <main className="auth-entry-page">
      <section className="auth-entry-panel">
        <h1 className="auth-entry-title">
          Scan to Order
          <br />
          <span className="auth-entry-subtitle">掃描點餐</span>
        </h1>

        {nextRecoveryCode ? (
          <section className="auth-entry-card">
            <h2 className="auth-entry-heading">密碼已重設</h2>
            <p>舊救援碼已失效，請立即保存下面的新救援碼。</p>
            <code className="recovery-code">{nextRecoveryCode}</code>
            {message && <div className="alert alert-success">{message}</div>}
            <button
              type="button"
              className="btn btn-outline-primary"
              onClick={copyRecoveryCode}
            >
              複製救援碼
            </button>
            <Link className="auth-entry-submit btn btn-primary" to="/login">
              返回登入
            </Link>
          </section>
        ) : (
          <form className="auth-entry-card" onSubmit={submit}>
            <h2 className="auth-entry-heading">忘記密碼</h2>
            <p>輸入註冊時保存的救援碼，即可設定新密碼。</p>

            {message && <div className="alert alert-danger">{message}</div>}

            <label className="auth-entry-field">
              <span>使用者名稱</span>
              <input
                className="form-control"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                required
              />
            </label>
            <label className="auth-entry-field">
              <span>救援碼</span>
              <input
                className="form-control"
                value={recoveryCode}
                onChange={(event) => setRecoveryCode(event.target.value)}
                autoComplete="off"
                required
              />
            </label>
            <label className="auth-entry-field">
              <span>新密碼</span>
              <input
                type="password"
                className="form-control"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                maxLength={64}
                required
              />
            </label>
            <label className="auth-entry-field">
              <span>再次輸入新密碼</span>
              <input
                type="password"
                className="form-control"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                maxLength={64}
                required
              />
            </label>
            <button
              type="submit"
              className="auth-entry-submit btn btn-primary"
              disabled={submitting}
            >
              {submitting ? "處理中…" : "重設密碼"}
            </button>
            <p className="auth-entry-switch">
              <Link to="/login">返回登入</Link>
            </p>
          </form>
        )}
      </section>
    </main>
  );
};

export default ForgotPasswordComponent;
