import { useState } from "react";

import { copyRecoveryCode, downloadRecoveryCode } from "../utils/recovery-code";

const RecoveryCodeActions = ({ code, username, saved, onSaved }) => {
  const [actionMessage, setActionMessage] = useState("");

  const handleCopy = async () => {
    if (await copyRecoveryCode(code)) {
      onSaved();
      setActionMessage("救援碼已複製，可以安全離開此頁。");
      return;
    }
    setActionMessage("瀏覽器無法複製，請改用下載救援碼。");
  };

  const handleDownload = () => {
    if (downloadRecoveryCode({ code, username })) {
      onSaved();
      setActionMessage("救援碼檔案已下載，可以安全離開此頁。");
    }
  };

  return (
    <div className="recovery-save-panel">
      <div className="recovery-code-actions">
        <button
          type="button"
          className="btn btn-outline-primary"
          onClick={handleCopy}
        >
          複製救援碼
        </button>
        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={handleDownload}
        >
          下載救援碼
        </button>
      </div>
      <p
        className={`recovery-save-status${saved ? " is-saved" : ""}`}
        role="status"
      >
        {actionMessage ||
          (saved
            ? "救援碼已保存，可以安全離開此頁。"
            : "請先複製或下載救援碼，完成後才能離開此頁。")}
      </p>
    </div>
  );
};

export default RecoveryCodeActions;
