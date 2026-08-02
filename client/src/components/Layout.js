import { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/auth-context";
import {
  SELLER_ONBOARDING_STAGES,
  useSellerOnboardingStage,
} from "../onboarding/seller-onboarding";
import Nav from "./nav-component";
import SupportWidgetComponent from "./support-widget-component";

const GUIDE_COPY = {
  [SELLER_ONBOARDING_STAGES.PRODUCT]: {
    step: 1,
    title: "點選「新增品項」",
    detail: "先建立顧客可以點選的第一個品項。",
  },
  [SELLER_ONBOARDING_STAGES.PRODUCT_FORM]: {
    step: 1,
    title: "建立第一個品項",
    detail: "填寫名稱、價格與分類，再按下新增品項。",
  },
  [SELLER_ONBOARDING_STAGES.QR_NAV]: {
    step: 2,
    title: "點選導覽列的「QR Code」",
    detail: "接著建立顧客掃描使用的桌號。",
  },
  [SELLER_ONBOARDING_STAGES.QR_CREATE]: {
    step: 3,
    title: "使用「依序新增」建立桌號",
    detail: "輸入要建立的數量，再按下產生。",
  },
  [SELLER_ONBOARDING_STAGES.QR_REVIEW]: {
    step: 3,
    title: "下載最小桌號的 QR Code",
    detail: "先下載第一張 QR Code，完成後會前往付款設定。",
  },
  [SELLER_ONBOARDING_STAGES.PROFILE_NAV]: {
    step: 4,
    title: "點選右上角的個人頁面",
    detail: "最後設定自動 LINE Pay 或先使用店內付款。",
  },
  [SELLER_ONBOARDING_STAGES.PAYMENT]: {
    step: 4,
    title: "設定 LINE Pay 商家金鑰",
    detail: "輸入 Channel ID 與 Channel Secret，即可完成開通。",
  },
};

const Layout = () => {
  const { currentUser, setCurrentUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isSupportAdminPage = location.pathname === "/support-admin";
  const onboardingStage = useSellerOnboardingStage(currentUser);
  const serviceSuspended =
    currentUser?.user?.role === "seller" &&
    currentUser.user.subscriptionStatus === "suspended";
  const guide = serviceSuspended ? undefined : GUIDE_COPY[onboardingStage];

  useEffect(() => {
    document.body.classList.toggle("seller-guided-mode", Boolean(guide));
    return () => document.body.classList.remove("seller-guided-mode");
  }, [guide]);

  useEffect(() => {
    const requiredPath = {
      [SELLER_ONBOARDING_STAGES.PRODUCT]: "/myProduct",
      [SELLER_ONBOARDING_STAGES.PRODUCT_FORM]: "/postProduct",
      [SELLER_ONBOARDING_STAGES.QR_CREATE]: "/qrcode",
      [SELLER_ONBOARDING_STAGES.QR_REVIEW]: "/qrcode",
      [SELLER_ONBOARDING_STAGES.PAYMENT]: "/profile",
    }[onboardingStage];

    if (requiredPath && location.pathname !== requiredPath) {
      navigate(requiredPath, { replace: true });
    }
  }, [location.pathname, navigate, onboardingStage]);

  return (
    <>
      {currentUser && !isSupportAdminPage && (
        <Nav currentUser={currentUser} setCurrentUser={setCurrentUser} />
      )}
      <Outlet />
      {currentUser?.user?.role === "seller" && !isSupportAdminPage && (
        <SupportWidgetComponent
          currentUser={currentUser}
          setCurrentUser={setCurrentUser}
        />
      )}
      {guide && (
        <>
          <div className="seller-guide-overlay" aria-hidden="true" />
          <aside
            className={`seller-guide-banner seller-guide-banner--${onboardingStage}`}
            aria-live="polite"
          >
            <span>開通引導 {guide.step}/4</span>
            <strong>{guide.title}</strong>
            <small>{guide.detail}</small>
          </aside>
        </>
      )}
    </>
  );
};

export default Layout;
