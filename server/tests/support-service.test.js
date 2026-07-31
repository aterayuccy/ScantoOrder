jest.mock("../models/support-ticket-model", () => ({
  findById: jest.fn(),
  findOne: jest.fn(),
}));

const SupportTicket = require("../models/support-ticket-model");
const {
  deleteSellerTicket,
  deleteTicket,
  respondToTicket,
  updateTicket,
} = require("../services/support-service");

describe("support ticket replies", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("automatically marks a pending ticket as answered after a reply", async () => {
    const ticket = {
      status: "open",
      adminReply: "",
      repliedAt: null,
      sellerFeedback: "unresolved",
      sellerFeedbackAt: new Date("2026-07-31T01:00:00.000Z"),
      save: jest.fn().mockResolvedValue(undefined),
    };
    SupportTicket.findById.mockResolvedValue(ticket);

    await updateTicket({
      ticketId: "ticket-1",
      input: {
        adminReply: "請重新整理後再試一次。",
        status: "open",
      },
    });

    expect(ticket.status).toBe("answered");
    expect(ticket.adminReply).toBe("請重新整理後再試一次。");
    expect(ticket.repliedAt).toBeInstanceOf(Date);
    expect(ticket.sellerFeedback).toBe("");
    expect(ticket.sellerFeedbackAt).toBeNull();
    expect(ticket.save).toHaveBeenCalledTimes(1);
  });

  test("keeps a closed ticket closed when its reply is edited", async () => {
    const ticket = {
      status: "closed",
      adminReply: "已處理完成。",
      repliedAt: new Date("2026-07-31T01:00:00.000Z"),
      save: jest.fn().mockResolvedValue(undefined),
    };
    SupportTicket.findById.mockResolvedValue(ticket);

    await updateTicket({
      ticketId: "ticket-2",
      input: {
        adminReply: "已協助處理完成。",
        status: "closed",
      },
    });

    expect(ticket.status).toBe("closed");
  });
});

describe("seller support feedback", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("closes an answered ticket when the seller confirms it is resolved", async () => {
    const ticket = {
      status: "answered",
      adminReply: "請重新登入後再操作。",
      sellerFeedback: "",
      sellerFeedbackAt: null,
      save: jest.fn().mockResolvedValue(undefined),
    };
    SupportTicket.findOne.mockResolvedValue(ticket);

    const result = await respondToTicket({
      ticketId: "ticket-feedback-1",
      sellerId: "seller-1",
      feedback: "resolved",
    });

    expect(SupportTicket.findOne).toHaveBeenCalledWith({
      _id: "ticket-feedback-1",
      seller: "seller-1",
    });
    expect(result.status).toBe("closed");
    expect(result.sellerFeedback).toBe("resolved");
    expect(result.sellerFeedbackAt).toBeInstanceOf(Date);
    expect(ticket.save).toHaveBeenCalledTimes(1);
  });

  test("reopens a ticket when the seller says it is unresolved", async () => {
    const ticket = {
      status: "answered",
      adminReply: "請重新整理後再操作。",
      sellerFeedback: "",
      sellerFeedbackAt: null,
      save: jest.fn().mockResolvedValue(undefined),
    };
    SupportTicket.findOne.mockResolvedValue(ticket);

    const result = await respondToTicket({
      ticketId: "ticket-feedback-2",
      sellerId: "seller-1",
      feedback: "unresolved",
    });

    expect(result.status).toBe("open");
    expect(result.sellerFeedback).toBe("unresolved");
  });

  test("rejects feedback before the administrator replies", async () => {
    const ticket = {
      status: "open",
      adminReply: "",
      save: jest.fn(),
    };
    SupportTicket.findOne.mockResolvedValue(ticket);

    await expect(
      respondToTicket({
        ticketId: "ticket-feedback-3",
        sellerId: "seller-1",
        feedback: "resolved",
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      publicMessage: "這張問題單目前還沒有可回饋的客服回覆",
    });
    expect(ticket.save).not.toHaveBeenCalled();
  });
});

describe("support ticket deletion", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("deletes a closed ticket", async () => {
    const ticket = {
      status: "closed",
      deleteOne: jest.fn().mockResolvedValue(undefined),
    };
    SupportTicket.findById.mockResolvedValue(ticket);

    const result = await deleteTicket({ ticketId: "ticket-3" });

    expect(ticket.deleteOne).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      message: "問題單已刪除",
      ticketId: "ticket-3",
    });
  });

  test("rejects deletion while a ticket is not closed", async () => {
    const ticket = {
      status: "answered",
      deleteOne: jest.fn(),
    };
    SupportTicket.findById.mockResolvedValue(ticket);

    await expect(deleteTicket({ ticketId: "ticket-4" })).rejects.toMatchObject({
      statusCode: 409,
      publicMessage: "只有已結案的問題單可以刪除",
    });
    expect(ticket.deleteOne).not.toHaveBeenCalled();
  });

  test("allows a seller to delete their own ticket", async () => {
    const ticket = {
      deleteOne: jest.fn().mockResolvedValue(undefined),
    };
    SupportTicket.findOne.mockResolvedValue(ticket);

    const result = await deleteSellerTicket({
      ticketId: "ticket-5",
      sellerId: "seller-1",
    });

    expect(SupportTicket.findOne).toHaveBeenCalledWith({
      _id: "ticket-5",
      seller: "seller-1",
    });
    expect(ticket.deleteOne).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      message: "問題單已刪除",
      ticketId: "ticket-5",
    });
  });
});
