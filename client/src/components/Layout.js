import { Outlet } from "react-router-dom";
import Nav from "./nav-component";

const Layout = ({currentUser,setCurrentUser}) => {
  return (
    <>
      {currentUser && (
        <Nav currentUser ={currentUser} setCurrentUser={setCurrentUser}/>
      )}
      <Outlet />
    </>
  );
};

export default Layout;
