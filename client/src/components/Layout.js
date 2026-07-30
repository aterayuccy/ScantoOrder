import { Outlet } from "react-router-dom";
import { useAuth } from "../auth/auth-context";
import Nav from "./nav-component";

const Layout = () => {
  const { currentUser, setCurrentUser } = useAuth();

  return (
    <>
      {currentUser && (
        <Nav currentUser={currentUser} setCurrentUser={setCurrentUser} />
      )}
      <Outlet />
    </>
  );
};

export default Layout;
