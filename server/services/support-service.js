const SupportTicket = require("../models/support-ticket-model");

const MAX_ACTIVE_TICKETS = 10;

class SupportError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "SupportError";
    this.statusCode = statusCode;
    this.publicMessage = message;
  }
}

const createTicket = async ({ seller, input }) => {
  const activeTicketCount = await SupportTicket.countDocuments({
    seller: seller._id,
    status: { $ne: "closed" },
  });
  if (activeTicketCount >= MAX_ACTIVE_TICKETS) {
    throw new SupportError(
      "目前已有多筆尚未結案的問題，請等待回覆後再新增",
      429
    );
  }

  return SupportTicket.create({
    seller: seller._id,
    username: seller.username,
    category: input.category,
    message: input.message,
    pagePath: input.pagePath,
  });
};

const listSellerTickets = (sellerId) =>
  SupportTicket.find({ seller: sellerId })
    .sort({ createdAt: -1 })
    .limit(30)
    .lean();

const listAdminTickets = ({ status }) => {
  const filter = status ? { status } : {};
  return SupportTicket.find(filter).sort({ createdAt: -1 }).limit(100).lean();
};

const updateTicket = async ({ ticketId, input }) => {
  const ticket = await SupportTicket.findById(ticketId);
  if (!ticket) throw new SupportError("找不到指定的問題單", 404);

  if (Object.prototype.hasOwnProperty.call(input, "adminReply")) {
    const replyChanged = ticket.adminReply !== input.adminReply;
    ticket.adminReply = input.adminReply;
    ticket.repliedAt = input.adminReply ? new Date() : null;
    if (replyChanged) {
      ticket.sellerFeedback = "";
      ticket.sellerFeedbackAt = null;
    }
  }
  if (input.status) ticket.status = input.status;
  if (input.adminReply && ticket.status === "open") {
    ticket.status = "answered";
  }

  await ticket.save();
  return ticket;
};

const respondToTicket = async ({ ticketId, sellerId, feedback }) => {
  const ticket = await SupportTicket.findOne({
    _id: ticketId,
    seller: sellerId,
  });
  if (!ticket) throw new SupportError("找不到指定的問題單", 404);
  if (!ticket.adminReply || !["answered", "closed"].includes(ticket.status)) {
    throw new SupportError("這張問題單目前還沒有可回饋的客服回覆", 409);
  }

  ticket.sellerFeedback = feedback;
  ticket.sellerFeedbackAt = new Date();
  ticket.status = feedback === "resolved" ? "closed" : "open";
  await ticket.save();
  return ticket;
};

const deleteSellerTicket = async ({ ticketId, sellerId }) => {
  const ticket = await SupportTicket.findOne({
    _id: ticketId,
    seller: sellerId,
  });
  if (!ticket) throw new SupportError("找不到指定的問題單", 404);

  await ticket.deleteOne();
  return {
    message: "問題單已刪除",
    ticketId,
  };
};

const deleteTicket = async ({ ticketId }) => {
  const ticket = await SupportTicket.findById(ticketId);
  if (!ticket) throw new SupportError("找不到指定的問題單", 404);
  if (ticket.status !== "closed") {
    throw new SupportError("只有已結案的問題單可以刪除", 409);
  }

  await ticket.deleteOne();
  return {
    message: "問題單已刪除",
    ticketId,
  };
};

module.exports = {
  SupportError,
  createTicket,
  deleteSellerTicket,
  deleteTicket,
  listAdminTickets,
  listSellerTickets,
  respondToTicket,
  updateTicket,
};
