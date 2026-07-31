import { useEffect } from "react";

const WARNING_MESSAGE = "請先複製或下載救援碼，保存完成後才能離開此頁。";

const useRecoveryCodeGuard = (active) => {
  useEffect(() => {
    if (!active) return undefined;

    const currentUrl = window.location.href;
    window.history.pushState({ recoveryCodeGuard: true }, "", currentUrl);

    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };

    const handleLinkClick = (event) => {
      const link = event.target.closest?.("a[href]");
      if (!link || link.hasAttribute("download")) return;

      event.preventDefault();
      event.stopPropagation();
      window.alert(WARNING_MESSAGE);
    };

    const handlePopState = () => {
      window.history.pushState({ recoveryCodeGuard: true }, "", currentUrl);
      window.alert(WARNING_MESSAGE);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("popstate", handlePopState);
    document.addEventListener("click", handleLinkClick, true);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handlePopState);
      document.removeEventListener("click", handleLinkClick, true);
    };
  }, [active]);
};

export default useRecoveryCodeGuard;
