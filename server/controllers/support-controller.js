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

module.exports = {
  createTicket,
  listAdminTickets,
  listSellerTickets,
  updateTicket,
};
