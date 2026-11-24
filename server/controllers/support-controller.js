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

module.exports = {
  createTicket,
  deleteSellerTicket,
  listSellerTickets,
  respondToTicket,
};
