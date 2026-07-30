const { CheckoutError } = require("./checkout-service");

const MOBILE_CARRIER_PATTERN = /^\/[0-9A-Z.+-]{7}$/;

const normalizeInvoicePreference = (body = {}) => {
  const invoicePreference =
    body.invoicePreference === "mobile_carrier" ? "mobile_carrier" : "none";
  const mobileCarrier = String(body.mobileCarrier || "")
    .trim()
    .toUpperCase();

  if (
    invoicePreference === "mobile_carrier" &&
    !MOBILE_CARRIER_PATTERN.test(mobileCarrier)
  ) {
    throw new CheckoutError(
      "手機條碼須為「/」開頭加上 7 碼英數字或 . + - 符號"
    );
  }

  return {
    invoicePreference,
    mobileCarrier: invoicePreference === "mobile_carrier" ? mobileCarrier : "",
    invoiceStatus:
      invoicePreference === "mobile_carrier" ? "pending" : "not_requested",
  };
};

module.exports = {
  MOBILE_CARRIER_PATTERN,
  normalizeInvoicePreference,
};
