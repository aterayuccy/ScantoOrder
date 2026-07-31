jest.mock("../models/support-ticket-model", () => ({
  findById: jest.fn(),
}));

const SupportTicket = require("../models/support-ticket-model");
const { deleteTicket, updateTicket } = require("../services/support-service");

describe("support ticket replies", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("automatically marks a pending ticket as answered after a reply", async () => {
    const ticket = {
      status: "open",
      adminReply: "",
      repliedAt: null,
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
});
