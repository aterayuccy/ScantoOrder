import { useEffect, useState } from "react";

export const SELLER_ONBOARDING_STAGES = Object.freeze({
  PRODUCT: "product",
  PRODUCT_FORM: "product-form",
  QR_NAV: "qr-nav",
  QR_CREATE: "qr-create",
  QR_REVIEW: "qr-review",
  PROFILE_NAV: "profile-nav",
  PAYMENT: "payment",
});

export const SELLER_ONBOARDING_EVENT = "scan-to-order:seller-onboarding";

const stageKey = (sellerId) =>
  `scanToOrder.guidedOnboarding.v2:stage:${sellerId}`;
const completedKey = (sellerId) =>
  `scanToOrder.guidedOnboarding.v2:completed:${sellerId}`;

const announceStage = (sellerId, stage) => {
  window.dispatchEvent(
    new CustomEvent(SELLER_ONBOARDING_EVENT, {
      detail: { sellerId: String(sellerId), stage },
    })
  );
};

export const getSellerOnboardingStage = (sellerId) => {
  if (!sellerId || localStorage.getItem(completedKey(sellerId)) === "true") {
    return "";
  }
  return localStorage.getItem(stageKey(sellerId)) || "";
};

export const startSellerOnboarding = (sellerId, initialStage) => {
  if (!sellerId || localStorage.getItem(completedKey(sellerId)) === "true") {
    return "";
  }

  const currentStage = getSellerOnboardingStage(sellerId);
  if (currentStage) return currentStage;

  localStorage.setItem(stageKey(sellerId), initialStage);
  announceStage(sellerId, initialStage);
  return initialStage;
};

export const setSellerOnboardingStage = (sellerId, stage) => {
  if (!sellerId || !stage) return;
  localStorage.setItem(stageKey(sellerId), stage);
  announceStage(sellerId, stage);
};

export const completeSellerOnboarding = (sellerId) => {
  if (!sellerId) return;
  localStorage.setItem(completedKey(sellerId), "true");
  localStorage.removeItem(stageKey(sellerId));
  announceStage(sellerId, "");
};

export const useSellerOnboardingStage = (currentUser) => {
  const sellerId =
    currentUser?.user?.role === "seller" ? currentUser.user._id : "";
  const [stage, setStage] = useState(() =>
    sellerId ? getSellerOnboardingStage(sellerId) : ""
  );

  useEffect(() => {
    setStage(sellerId ? getSellerOnboardingStage(sellerId) : "");
    if (!sellerId) return undefined;

    const handleStageChange = (event) => {
      if (String(event.detail?.sellerId || "") === String(sellerId)) {
        setStage(event.detail?.stage || "");
      }
    };

    window.addEventListener(SELLER_ONBOARDING_EVENT, handleStageChange);
    return () =>
      window.removeEventListener(SELLER_ONBOARDING_EVENT, handleStageChange);
  }, [sellerId]);

  return stage;
};
