jest.mock("../models/qr-code-model", () => ({
  deleteOne: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  insertMany: jest.fn(),
}));

const QrCode = require("../models/qr-code-model");
const {
  createQrCodes,
  deleteQrCode,
} = require("../controllers/qr-code-controller");

const createResponse = () => ({
  send: jest.fn(),
  status: jest.fn().mockReturnThis(),
});

describe("QR Code table number stability", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("sequential creation continues after the current largest table number", async () => {
    QrCode.findOne.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ tableNumber: 5 }),
      }),
    });
    QrCode.insertMany.mockResolvedValue([]);
    QrCode.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          { _id: "qr-1", tableNumber: 1 },
          { _id: "qr-2", tableNumber: 2 },
          { _id: "qr-4", tableNumber: 4 },
          { _id: "qr-5", tableNumber: 5 },
          { _id: "qr-6", tableNumber: 6 },
          { _id: "qr-7", tableNumber: 7 },
        ]),
      }),
    });

    const req = {
      validatedBody: { mode: "sequential", count: 2 },
      user: { _id: "seller-1" },
    };
    const res = createResponse();

    await createQrCodes(req, res);

    expect(QrCode.insertMany).toHaveBeenCalledWith([
      expect.objectContaining({ seller: "seller-1", tableNumber: 6 }),
      expect.objectContaining({ seller: "seller-1", tableNumber: 7 }),
    ]);
    expect(res.send).toHaveBeenCalledTimes(1);
  });

  test("specific creation restores the exact requested table number", async () => {
    QrCode.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });
    QrCode.insertMany.mockResolvedValue([]);
    QrCode.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          { _id: "qr-1", tableNumber: 1 },
          { _id: "qr-3", tableNumber: 3 },
          { _id: "qr-4", tableNumber: 4 },
          { _id: "qr-5", tableNumber: 5 },
        ]),
      }),
    });

    const req = {
      validatedBody: { mode: "specific", tableNumber: 3 },
      user: { _id: "seller-1" },
    };
    const res = createResponse();

    await createQrCodes(req, res);

    expect(QrCode.findOne).toHaveBeenCalledWith({
      seller: "seller-1",
      tableNumber: 3,
    });
    expect(QrCode.insertMany).toHaveBeenCalledWith([
      expect.objectContaining({ seller: "seller-1", tableNumber: 3 }),
    ]);
    expect(res.send).toHaveBeenCalledTimes(1);
  });

  test("specific creation rejects a table number that already exists", async () => {
    QrCode.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        _id: "qr-3",
        tableNumber: 3,
      }),
    });

    const req = {
      validatedBody: { mode: "specific", tableNumber: 3 },
      user: { _id: "seller-1" },
    };
    const res = createResponse();

    await createQrCodes(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.send).toHaveBeenCalledWith("桌號 3 已存在");
    expect(QrCode.insertMany).not.toHaveBeenCalled();
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
    const res = createResponse();

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
