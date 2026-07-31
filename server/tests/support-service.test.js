jest.mock("../models/support-ticket-model", () => ({
  findById: jest.fn(),
}));

const SupportTicket = require("../models/support-ticket-model");
const { updateTicket } = require("../services/support-service");

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
