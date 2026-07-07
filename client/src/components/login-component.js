import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthService from "../services/auth.service";

const LoginComponent = ({currentUser,setCurrentUser}) => {
  const navigate = useNavigate();
  let [email,setEmail] = useState("");
  let [password,setPassword] = useState("");
  let [message,setMessage] = useState("");

  const handleEmail = (e) => {
    setEmail(e.target.value);
  }
  const handlePassword = (e) => {
    setPassword(e.target.value);
  }
  const handleLogin = async() => {
    try{
        let response =await AuthService.login(email,password);
        AuthService.setLocalUser(response.data);
        window.alert("您已成功登入");
        setCurrentUser(response.data);
        navigate("/myProduct");
    } catch(e) {
      setMessage(e.response.data);
    }    
  };

  return (
    <div style={{ padding: "3rem" }} className="col-md-12">
      <div>
        {message && <div className="alert alert-danger">{message}</div>}
        <div className="form-group">
          <label htmlFor="username">電子信箱：</label>
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
          />
        </div>
        <br />
        <div className="form-group text-center">
          <button
            onClick={handleLogin}
            className="btn btn-primary"
            style={{ minWidth: "8rem" }}
          >
            <span>登入</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginComponent;
