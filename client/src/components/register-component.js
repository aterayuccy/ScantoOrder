import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthService from "../services/auth.service";

const RegisterComponent = ({setCurrentUser}) => {
  const navigate = useNavigate();
  let [username,setUsername] = useState("");
  let [email,setEmail] = useState("");
  let [password,setPassword] = useState("");
  let [role] = useState("seller");
  let [message,setMessage] = useState("");

  const handleUsername = (e) => {
    setUsername(e.target.value);
  }
  const handleEmail = (e) => {
    setEmail(e.target.value);
  }
  const handlePassword = (e) => {
    setPassword(e.target.value);
  }
  const handleRegister = (e) => {
    AuthService.clearQrUser();
    if (setCurrentUser) {
      setCurrentUser(AuthService.getCurrentUser());
    }

    AuthService.register(username,email,password,role).then(() => {
      window.alert("您已成功註冊"); 
      navigate("/login");
    }).catch((e) => {
      setMessage(e.response.data);
    })
  }
  

  return (
    <div style={{ padding: "3rem" }} className="col-md-12">
      <div>
        {message && <div className="alert alert-danger">{message}</div>}
        <div>
          <label htmlFor="username">用戶名稱:</label>
          <input
            onChange={handleUsername}
            type="text"
            className="form-control"
            name="username"
          />
        </div>
        <br />
        <div className="form-group">
          <label htmlFor="email">電子信箱：</label>
          <input
            onChange={handleEmail}
            type="text"
            className="form-control"
            name="email"
          />
        </div>
        <br />
        <div className="form-group">
          <label htmlFor="password">密碼：</label>
          <input
            onChange={handlePassword}
            type="password"
            className="form-control"
            name="password"
            placeholder="長度至少超過6個英文或數字"
          />
        </div>        
        <br />
        <button onClick={handleRegister} className="btn btn-primary">
          <span>註冊會員</span>
        </button>
      </div>
    </div>
  );
};

export default RegisterComponent;
