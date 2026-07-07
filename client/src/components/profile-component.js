import {useState,useEffect} from 'react';
import AuthService from '../services/auth.service';
import { Navigate, useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";

const ProfileComponent = ({currentUser,setCurrentUser}) => {  
  const navigate = useNavigate();
  const handleLogout = () => {
      AuthService.logout();
      window.alert("您已成功登出");
      setCurrentUser(null);
    }
  const changeRole = async () => {
    console.log("✅ changeRole 被執行了");

  try {
    
    const res = await AuthService.updateRole("seller");   
    const updatedUser = {
    token: currentUser.token,
    user: res.data.user,
    };    

    localStorage.setItem("user", JSON.stringify(updatedUser));
    AuthService.setSellerUser(updatedUser);
    setCurrentUser(updatedUser);

    window.alert("您已成為賣家");
    navigate("/postProduct");
  } catch (e) {
    window.alert("更新角色失敗：" + (e.response?.data || e.message));
  }
};

  if (currentUser?.user?.role === "buyer") {
    return <Navigate to="/product" />;
  }

  return (
    <div style={{ padding: "3rem" }}>
      {!currentUser && <div>在獲取您的個人資料之前，您必須先登錄。</div>}
      {currentUser && (
        <div >
          

          <table className="table" style={{ maxWidth: "60rem" }}>
            <tbody>
              <tr>
                <td>
                  <strong>姓名：{currentUser.user.username}</strong>
                </td>
              </tr>
              <tr>
                <td>
                  <strong>您的用戶ID: {currentUser.user._id}</strong>
                </td>
              </tr>
              <tr>
                <td>
                  <strong>您註冊的電子信箱: {currentUser.user.email}</strong>
                </td>
              </tr>
              <tr>
                <td>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <strong>身份: {currentUser.user.role}</strong>

                    {currentUser && currentUser.user.role == "buyer" && (
                      <button className="btn btn-primary" onClick={changeRole}>
                        成為賣家
                      </button>
                    )}
                  </div>
                </td>
              </tr>             
            </tbody>
          </table>
          
          {currentUser /*&& currentUser.user.role == 'buyer'*/ &&
                <Link className="btn btn-warning" onClick={handleLogout} to="/">
            登出 
          </Link>}
        </div>
      )}
    </div>
  );
};

export default ProfileComponent;
