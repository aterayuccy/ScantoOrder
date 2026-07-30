import { Route, Routes, BrowserRouter, useLocation } from "react-router-dom";
import { useEffect } from "react";
import {
  AuthenticatedRoute,
  AuthInjectedComponent,
  RoleRoute,
} from "./auth/auth-routes";
import { AuthProvider } from "./auth/auth-context";
import { OrderNotificationProvider } from "./notifications/order-notification-context";
import Layout from "./components/Layout";
import RegisterComponent from "./components/register-component";
import LoginComponent from "./components/login-component";
import ProfileComponent from "./components/profile-component";
import ProductComponent from "./components/cart-component";
import PostProductComponent from "./components/postProduct-component";
import EnrollComponent from "./components/menu-component";
import MyProductComponent from "./components/myProduct-component";
import BuyerInfoComponent from "./components/buyerInfo-component";
import ModifyProductComponent from "./components/modifyProduct-component";
import SubmitComponent from "./components/order-confirmation-component";
import OrderComponent from "./components/seller-order-component";
import QrcodeComponent from "./components/qrcode-component";
import QRLoginComponent from "./components/qrcode-login-component";
import LinePayComponent from "./components/line-pay-component";
import ForgotPasswordComponent from "./components/forgot-password-component";

function AppRoutes() {
  const location = useLocation();

  // React Router keeps the previous page's scroll position by default.  Reset
  // it on every page change so a long product form never opens halfway down.
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname, location.search]);

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route
          index
          element={<AuthInjectedComponent component={EnrollComponent} />}
        />
        <Route
          path="register"
          element={<AuthInjectedComponent component={RegisterComponent} />}
        />
        <Route
          path="login"
          element={<AuthInjectedComponent component={LoginComponent} />}
        />
        <Route path="forgot-password" element={<ForgotPasswordComponent />} />

        <Route element={<AuthenticatedRoute />}>
          <Route
            path="profile"
            element={<AuthInjectedComponent component={ProfileComponent} />}
          />
        </Route>

        <Route element={<RoleRoute role="buyer" />}>
          <Route
            path="product"
            element={<AuthInjectedComponent component={ProductComponent} />}
          />
          <Route
            path="submit"
            element={<AuthInjectedComponent component={SubmitComponent} />}
          />
          <Route
            path="payment/line-pay"
            element={<AuthInjectedComponent component={LinePayComponent} />}
          />
        </Route>

        <Route element={<RoleRoute role="seller" />}>
          <Route
            path="myProduct"
            element={<AuthInjectedComponent component={MyProductComponent} />}
          />
          <Route
            path="postProduct"
            element={<AuthInjectedComponent component={PostProductComponent} />}
          />
          <Route
            path="buyerInfo/:productId"
            element={<AuthInjectedComponent component={BuyerInfoComponent} />}
          />
          <Route
            path="modifyProduct/:productId"
            element={
              <AuthInjectedComponent component={ModifyProductComponent} />
            }
          />
          <Route
            path="order"
            element={<AuthInjectedComponent component={OrderComponent} />}
          />
          <Route
            path="qrcode"
            element={<AuthInjectedComponent component={QrcodeComponent} />}
          />
        </Route>

        <Route
          path="qr-login"
          element={<AuthInjectedComponent component={QRLoginComponent} />}
        />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <OrderNotificationProvider>
          <AppRoutes />
        </OrderNotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
