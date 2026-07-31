const supportService = require("../services/support-service");

const createTicket = async (req, res, next) => {
  try {
    return res.status(201).send(
      await supportService.createTicket({
        seller: req.user,
        input: req.validatedBody,
      })
    );
  } catch (error) {
    return next(error);
  }
};

const listSellerTickets = async (req, res, next) => {
  try {
    return res.send(await supportService.listSellerTickets(req.user._id));
  } catch (error) {
    return next(error);
  }
};

const listAdminTickets = async (req, res, next) => {
  try {
    return res.send(
      await supportService.listAdminTickets({
        status: req.query.status || "",
      })
    );
  } catch (error) {
    return next(error);
  }
};

const respondToTicket = async (req, res, next) => {
  try {
    return res.send(
      await supportService.respondToTicket({
        ticketId: req.params.ticketId,
        sellerId: req.user._id,
        feedback: req.validatedBody.feedback,
      })
    );
  } catch (error) {
    return next(error);
  }
};

const deleteSellerTicket = async (req, res, next) => {
  try {
    return res.send(
      await supportService.deleteSellerTicket({
        ticketId: req.params.ticketId,
        sellerId: req.user._id,
      })
    );
  } catch (error) {
    return next(error);
  }
};

const updateTicket = async (req, res, next) => {
  try {
    return res.send(
      await supportService.updateTicket({
        ticketId: req.params.ticketId,
        input: req.validatedBody,
      })
    );
  } catch (error) {
    return next(error);
  }
};

const deleteTicket = async (req, res, next) => {
  try {
    return res.send(
      await supportService.deleteTicket({
        ticketId: req.params.ticketId,
      })
    );
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createTicket,
  deleteSellerTicket,
  deleteTicket,
  listAdminTickets,
  listSellerTickets,
  respondToTicket,
  updateTicket,
};
