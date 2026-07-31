import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import AuthService from "../services/auth.service";
import ProductService from "../services/product.service";
import {
  SELLER_ONBOARDING_STAGES,
  setSellerOnboardingStage,
  useSellerOnboardingStage,
} from "../onboarding/seller-onboarding";

const getInitial = (username = "") =>
  Array.from(String(username).trim())[0]?.toUpperCase() || "?";

const NavComponent = ({ currentUser }) => {
  const [types, setTypes] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const user = currentUser?.user;
  const isSeller = user?.role === "seller";
  const onboardingStage = useSellerOnboardingStage(currentUser);
  const guideHeaderActive = [
    SELLER_ONBOARDING_STAGES.QR_NAV,
    SELLER_ONBOARDING_STAGES.PROFILE_NAV,
  ].includes(onboardingStage);
  const selectedType = useMemo(
    () => new URLSearchParams(location.search).get("type") || "",
    [location.search]
  );

  useEffect(() => {
    setMenuOpen(guideHeaderActive);
  }, [guideHeaderActive, location.pathname, location.search, onboardingStage]);

  useEffect(() => {
    if (!currentUser) {
      setTypes([]);
      return;
    }

    let active = true;
    ProductService.getMenuProducts(currentUser)
      .then((response) => {
        if (!active) return;
        setTypes([
          ...new Set(
            (response.data || [])
              .map((product) => String(product.type || "").trim())
              .filter(Boolean)
          ),
        ]);
      })
      .catch((error) => {
        console.error(error);
        if (active) setTypes([]);
      });

    return () => {
      active = false;
    };
  }, [currentUser]);

  const isActive = (path) =>
    location.pathname === path ||
    (path !== "/" && location.pathname.startsWith(`${path}/`));

  const buyerNavigation = () => AuthService.markQrBuyerNavigation();

  return (
    <header
      className={`app-header${guideHeaderActive ? " seller-guide-header" : ""}`}
    >
      <div className="app-nav-shell">
        <Link
          className="app-brand"
          to={isSeller ? "/myProduct" : "/"}
          onClick={isSeller ? undefined : buyerNavigation}
        >
          <span className="app-brand-mark" aria-hidden="true">
            S
          </span>
          <span className="app-brand-copy">
            <strong>Scan to Order</strong>
            <small>掃描點餐</small>
          </span>
        </Link>

        <button
          type="button"
          className="app-nav-toggle"
          aria-label={menuOpen ? "關閉選單" : "開啟選單"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((current) => !current)}
        >
          <span />
          <span />
          <span />
        </button>

        <div className={`app-nav-content${menuOpen ? " is-open" : ""}`}>
          <nav className="app-nav-main" aria-label="主要導覽">
            {isSeller ? (
              <>
                <Link
                  className={`app-nav-link${
                    isActive("/myProduct") ? " is-active" : ""
                  }`}
                  to="/myProduct"
                >
                  餐點管理
                </Link>
                <Link
                  className={`app-nav-link${
                    isActive("/postProduct") ? " is-active" : ""
                  }`}
                  to="/postProduct"
                >
                  新增品項
                </Link>
                <Link
                  className={`app-nav-link${
                    isActive("/order") ? " is-active" : ""
                  }`}
                  to="/order"
                >
                  訂單
                </Link>
                <Link
                  className={`app-nav-link${
                    isActive("/qrcode") ? " is-active" : ""
                  }${
                    onboardingStage === SELLER_ONBOARDING_STAGES.QR_NAV
                      ? " seller-guide-target"
                      : ""
                  }`}
                  to="/qrcode"
                  onClick={() => {
                    if (onboardingStage === SELLER_ONBOARDING_STAGES.QR_NAV) {
                      setSellerOnboardingStage(
                        user._id,
                        SELLER_ONBOARDING_STAGES.QR_CREATE
                      );
                    }
                  }}
                >
                  QR Code
                </Link>
              </>
            ) : (
              <>
                <Link
                  className={`app-nav-link${isActive("/") ? " is-active" : ""}`}
                  to="/"
                  onClick={buyerNavigation}
                >
                  全部餐點
                </Link>
                <Link
                  className={`app-nav-link${
                    isActive("/product") ? " is-active" : ""
                  }`}
                  to="/product"
                >
                  購物車
                </Link>
              </>
            )}
          </nav>

          <Link
            className={`app-profile-link${
              isActive("/profile") ? " is-active" : ""
            }${
              onboardingStage === SELLER_ONBOARDING_STAGES.PROFILE_NAV
                ? " seller-guide-target"
                : ""
            }`}
            to="/profile"
            title="個人頁面"
            onClick={() => {
              if (onboardingStage === SELLER_ONBOARDING_STAGES.PROFILE_NAV) {
                setSellerOnboardingStage(
                  user._id,
                  SELLER_ONBOARDING_STAGES.PAYMENT
                );
              }
            }}
          >
            <span className="app-profile-avatar" aria-hidden="true">
              {getInitial(user?.username)}
            </span>
            <span className="app-profile-copy">
              <strong>{user?.username}</strong>
              <small>{isSeller ? "店家帳號" : "顧客帳號"}</small>
            </span>
          </Link>
        </div>
      </div>

      {types.length > 0 && (
        <nav className="app-category-bar" aria-label="餐點分類">
          <div className="app-category-scroll">
            <Link
              className={`app-category-chip${!selectedType ? " is-active" : ""}`}
              to={isSeller ? "/myProduct" : "/"}
              onClick={isSeller ? undefined : buyerNavigation}
            >
              全部
            </Link>
            {types.map((type) => (
              <Link
                className={`app-category-chip${
                  selectedType === type ? " is-active" : ""
                }`}
                key={type}
                to={`${
                  isSeller ? "/myProduct/" : "/"
                }?type=${encodeURIComponent(type)}`}
                onClick={isSeller ? undefined : buyerNavigation}
              >
                {type}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
};

export default NavComponent;
