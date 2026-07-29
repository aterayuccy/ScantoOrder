import { Link, useNavigate } from "react-router-dom";

import AuthService from "../services/auth.service";

const AVATAR_COLORS = [
  "#0f766e",
  "#2563eb",
  "#7c3aed",
  "#c2410c",
  "#be123c",
  "#047857",
];

const getAvatarColor = (username = "") => {
  const hash = Array.from(username).reduce(
    (total, character) => total + character.codePointAt(0),
    0
  );
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
};

const getUsernameInitial = (username = "") =>
  Array.from(username.trim())[0]?.toUpperCase() || "?";

const ProfileComponent = ({ currentUser, setCurrentUser }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    AuthService.logout();
    setCurrentUser(null);
    navigate("/login", { replace: true });
  };

  if (!currentUser) {
    return (
      <main className="app-page profile-page">
        <div className="app-page__inner app-page__inner--narrow">
          <section className="ui-empty">
            <h1>請先登入</h1>
            <p>登入後即可查看個人資料。</p>
            <Link className="btn btn-primary" to="/login">
              前往登入
            </Link>
          </section>
        </div>
      </main>
    );
  }

  const { username, role } = currentUser.user;
  const isSeller = role === "seller";

  return (
    <main className="app-page profile-page">
      <div className="app-page__inner app-page__inner--narrow">
        <header className="app-page-header profile-page-heading">
          <div>
            <p className="ui-eyebrow">帳號設定</p>
            <h1>個人頁面</h1>
            <p>查看目前登入的帳號與身分類型。</p>
          </div>
        </header>

        <section className="profile-card">
          <div
            className="profile-avatar"
            style={{ backgroundColor: getAvatarColor(username) }}
            aria-label={`${username} 的頭像`}
          >
            {getUsernameInitial(username)}
          </div>

          <h2 className="profile-username">{username}</h2>
          <span className="profile-role">
            {isSeller ? "店家帳號" : "顧客帳號"}
          </span>

          <dl className="profile-details">
            <div>
              <dt>使用者名稱</dt>
              <dd>{username}</dd>
            </div>
            <div>
              <dt>帳號身分</dt>
              <dd>{isSeller ? "店家" : "顧客"}</dd>
            </div>
          </dl>

          <div className="profile-actions">
            <Link
              className="btn btn-outline-secondary"
              to={isSeller ? "/myProduct" : "/"}
            >
              返回{isSeller ? "餐點管理" : "點餐頁"}
            </Link>
            <button
              type="button"
              className="btn btn-outline-danger"
              onClick={handleLogout}
            >
              登出
            </button>
          </div>
        </section>
      </div>
    </main>
  );
};

export default ProfileComponent;
