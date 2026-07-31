import { Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/auth-context";
import Nav from "./nav-component";
import SupportWidgetComponent from "./support-widget-component";

const Layout = () => {
  const { currentUser, setCurrentUser } = useAuth();
  const location = useLocation();
  const isSupportAdminPage = location.pathname === "/support-admin";

  return (
    <>
      {currentUser && !isSupportAdminPage && (
        <Nav currentUser={currentUser} setCurrentUser={setCurrentUser} />
      )}
      <Outlet />
      {currentUser?.user?.role === "seller" && !isSupportAdminPage && (
        <SupportWidgetComponent currentUser={currentUser} />
      )}
    </>
  );
};

export default Layout;
