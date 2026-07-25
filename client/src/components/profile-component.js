import { Link, Navigate } from "react-router-dom";
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

const getUsernameInitial = (username = "") => {
  const firstCharacter = Array.from(username.trim())[0];
  return firstCharacter ? firstCharacter.toUpperCase() : "?";
};

const ProfileComponent = ({ currentUser, setCurrentUser }) => {
  const handleLogout = () => {
    AuthService.logout();
    window.alert("您已成功登出");
    setCurrentUser(null);
  };

  if (currentUser?.user?.role === "buyer") {
    return <Navigate to="/product" />;
  }

  if (!currentUser) {
    return (
      <main className="profile-page">
        <section className="profile-card">
          <p>查看個人資料前，請先登入。</p>
          <Link className="btn btn-primary" to="/login">
            前往登入
          </Link>
        </section>
      </main>
    );
  }

  const { username, role } = currentUser.user;

  return (
    <main className="profile-page">
      <section className="profile-card">
        <div
          className="profile-avatar"
          style={{ backgroundColor: getAvatarColor(username) }}
          aria-label={`${username} 的使用者頭像`}
        >
          {getUsernameInitial(username)}
        </div>

        <h1 className="profile-username">{username}</h1>
        <p className="profile-role">{role === "seller" ? "店家帳號" : "顧客帳號"}</p>

        <dl className="profile-details">
          <div>
            <dt>使用者名稱</dt>
            <dd>{username}</dd>
          </div>
          <div>
            <dt>帳號身分</dt>
            <dd>{role === "seller" ? "店家" : "顧客"}</dd>
          </div>
        </dl>

        <Link className="btn btn-warning profile-logout" onClick={handleLogout} to="/">
          登出
        </Link>
      </section>
    </main>
  );
};

export default ProfileComponent;
