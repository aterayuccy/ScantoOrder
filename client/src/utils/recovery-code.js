const buildRecoveryCodeFile = ({ code, username }) =>
  [
    "Scan to Order 掃描點餐",
    "忘記密碼救援碼",
    "",
    `使用者名稱：${username || "未提供"}`,
    `救援碼：${code}`,
    "",
    "請將此檔案保存在安全的位置，不要傳給其他人。",
    "每次使用救援碼重設密碼後，舊救援碼會立即失效。",
  ].join("\n");

const fallbackCopy = (text) => {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    return document.execCommand("copy");
  } finally {
    textarea.remove();
  }
};

export const copyRecoveryCode = async (code) => {
  if (!code) return false;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(code);
      return true;
    }
    return fallbackCopy(code);
  } catch (_error) {
    return fallbackCopy(code);
  }
};

export const downloadRecoveryCode = ({ code, username }) => {
  if (!code) return false;

  const safeUsername =
    String(username || "account")
      .normalize("NFKC")
      .replace(/[\\/:*?"<>|]+/g, "-")
      .trim() || "account";
  const blob = new Blob([buildRecoveryCodeFile({ code, username })], {
    type: "text/plain;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `scan-to-order-${safeUsername}-救援碼.txt`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return true;
};
