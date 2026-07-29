import {Route, Routes, BrowserRouter, useLocation} from 'react-router-dom';
import {useEffect, useState} from 'react';
import Layout from './components/Layout';
import RegisterComponent from './components/register-component';
import LoginComponent from './components/login-component';
import ProfileComponent from './components/profile-component';
import AuthService from './services/auth.service';
import ProductComponent from './components/cart-component';
import PostProductComponent from './components/postProduct-component';
import EnrollComponent from './components/menu-component';
import MyProductComponent from './components/myProduct-component';
import BuyerInfoComponent from "./components/buyerInfo-component";
import ModifyProductComponent from "./components/modifyProduct-component";
import SubmitComponent from "./components/order-confirmation-component";
import OrderComponent from "./components/seller-order-component";
import QrcodeComponent from "./components/qrcode-component";
import QRLoginComponent from "./components/qrcode-login-component";
import LinePayComponent from "./components/line-pay-component";

function AppRoutes() {
  const location = useLocation();
  let [currentUser,setCurrentUser]= useState(AuthService.getCurrentUser());

  useEffect(() => {
    setCurrentUser(AuthService.getCurrentUser());
  }, [location.pathname]);

  // React Router keeps the previous page's scroll position by default.  Reset
  // it on every page change so a long product form never opens halfway down.
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname, location.search]);

  return <Routes>
    <Route path="/" element={<Layout currentUser ={currentUser} setCurrentUser={setCurrentUser}/>} >
      <Route path="" element={<EnrollComponent
      currentUser ={currentUser} 
      setCurrentUser={setCurrentUser}/>}/>
      <Route path="register" element={<RegisterComponent
      setCurrentUser={setCurrentUser}/>}/>
      <Route path="login" element={<LoginComponent
      currentUser ={currentUser} 
      setCurrentUser={setCurrentUser}/>}/>
      <Route path="profile" element={<ProfileComponent 
      currentUser ={currentUser} 
      setCurrentUser={setCurrentUser}/>}/>
       <Route path="product" element={<ProductComponent 
      currentUser ={currentUser} 
      setCurrentUser={setCurrentUser}/>}/> 
      <Route path="myProduct" element={<MyProductComponent 
      currentUser ={currentUser} 
      setCurrentUser={setCurrentUser}/>}/>       
      <Route path="postProduct" element={<PostProductComponent 
      currentUser ={currentUser} 
      setCurrentUser={setCurrentUser}/>}/>
      <Route path="buyerInfo/:productId" element={<BuyerInfoComponent 
      currentUser ={currentUser} 
      setCurrentUser={setCurrentUser}/>}/>
      <Route path="modifyProduct/:productId" element={<ModifyProductComponent 
      currentUser ={currentUser} 
      setCurrentUser={setCurrentUser}/>}/>      
      <Route path="submit" element={<SubmitComponent
          currentUser={currentUser}
          setCurrentUser={setCurrentUser}
      />}/>
      <Route path="order" element={<OrderComponent
        currentUser={currentUser}
        setCurrentUser={setCurrentUser}
      />}/>
      <Route path="qrcode" element={<QrcodeComponent
        currentUser={currentUser}
        setCurrentUser={setCurrentUser}
      />}/>
      <Route path="qr-login" element={<QRLoginComponent
        currentUser={currentUser}
        setCurrentUser={setCurrentUser}
      />}/>
      <Route path="payment/line-pay" element={<LinePayComponent
        currentUser={currentUser}
        setCurrentUser={setCurrentUser}
      />}/>
    </Route>
  </Routes>
}

function App() {
  return <BrowserRouter>
    <AppRoutes />
  </BrowserRouter>
}

export default App;
