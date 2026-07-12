import React from "react";
import AuthEntryComponent from "./auth-entry-component";

const LoginComponent = ({ setCurrentUser }) => {
  return <AuthEntryComponent setCurrentUser={setCurrentUser} />;
};

export default LoginComponent;
