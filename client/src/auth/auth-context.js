import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

import AuthService from "../services/auth.service";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const location = useLocation();
  const [currentUser, setCurrentUser] = useState(() =>
    AuthService.getCurrentUser()
  );

  useEffect(() => {
    setCurrentUser(AuthService.getCurrentUser());
  }, [location.pathname]);

  const value = useMemo(() => ({ currentUser, setCurrentUser }), [currentUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth 必須在 AuthProvider 內使用");
  }
  return context;
};
