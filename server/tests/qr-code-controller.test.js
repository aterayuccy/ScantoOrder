jest.mock("../models/qr-code-model", () => ({
  deleteOne: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
}));

const QrCode = require("../models/qr-code-model");
const { deleteQrCode } = require("../controllers/qr-code-controller");

describe("QR Code table number stability", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("deleting a table does not renumber remaining QR Codes", async () => {
    QrCode.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        _id: "qr-2",
        seller: "seller-1",
        tableNumber: 2,
      }),
    });
    QrCode.deleteOne.mockResolvedValue({ deletedCount: 1 });
    QrCode.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          { _id: "qr-1", tableNumber: 1 },
          { _id: "qr-3", tableNumber: 3 },
        ]),
      }),
    });

    const req = {
      params: { qrCodeId: "qr-2" },
      user: { _id: "seller-1" },
    };
    const res = {
      send: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };

    await deleteQrCode(req, res);

    expect(QrCode.deleteOne).toHaveBeenCalledWith({ _id: "qr-2" });
    expect(QrCode.find).toHaveBeenCalledTimes(1);
    expect(QrCode.find).toHaveBeenCalledWith({ seller: "seller-1" });
    expect(res.send).toHaveBeenCalledWith({
      qrCodes: [
        { _id: "qr-1", tableNumber: 1 },
        { _id: "qr-3", tableNumber: 3 },
      ],
    });
  });
});
