import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "./auth-context";

export const AuthenticatedRoute = () => {
  const { currentUser } = useAuth();
  const location = useLocation();

  if (!currentUser?.user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ returnTo: `${location.pathname}${location.search}` }}
      />
    );
  }

  return <Outlet />;
};

export const RoleRoute = ({ role }) => {
  const { currentUser } = useAuth();
  const location = useLocation();

  if (!currentUser?.user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ returnTo: `${location.pathname}${location.search}` }}
      />
    );
  }

  if (currentUser.user.role !== role) {
    return (
      <Navigate
        to={currentUser.user.role === "seller" ? "/myProduct" : "/"}
        replace
      />
    );
  }

  if (
    role === "seller" &&
    currentUser.user.subscriptionStatus === "suspended"
  ) {
    return <Navigate to="/profile" replace />;
  }

  return <Outlet />;
};

export const AuthInjectedComponent = ({ component: Component }) => {
  const auth = useAuth();
  return <Component {...auth} />;
};
