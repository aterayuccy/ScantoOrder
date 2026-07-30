const { normalizeInvoicePreference } = require("../services/invoice-service");

describe("invoice service", () => {
  test("normalizes a valid mobile carrier", () => {
    expect(
      normalizeInvoicePreference({
        invoicePreference: "mobile_carrier",
        mobileCarrier: "/ab12+.-",
      })
    ).toEqual({
      invoicePreference: "mobile_carrier",
      mobileCarrier: "/AB12+.-",
      invoiceStatus: "pending",
    });
  });

  test("rejects an invalid mobile carrier", () => {
    expect(() =>
      normalizeInvoicePreference({
        invoicePreference: "mobile_carrier",
        mobileCarrier: "AB123",
      })
    ).toThrow();
  });

  test("does not retain a carrier when no invoice is requested", () => {
    expect(
      normalizeInvoicePreference({
        invoicePreference: "none",
        mobileCarrier: "/ABCD123",
      })
    ).toEqual({
      invoicePreference: "none",
      mobileCarrier: "",
      invoiceStatus: "not_requested",
    });
  });
});
