export const CATEGORY_LABELS = {
  technical: "系統異常",
  operation: "操作問題",
  suggestion: "功能建議",
  other: "其他問題",
};

export const STATUS_LABELS = {
  open: "待回覆",
  answered: "已回覆",
  closed: "已結案",
};

export const formatDate = (value, emptyLabel = "尚無紀錄") => {
  if (!value) return emptyLabel;

  return new Intl.DateTimeFormat("zh-TW", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};
