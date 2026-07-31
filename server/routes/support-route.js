const router = require("express").Router();

const supportController = require("../controllers/support-controller");
const { authenticate, sellerOnly } = require("../middlewares/authorization");
const supportAdminOnly = require("../middlewares/support-admin");
const validateRequest = require("../middlewares/validate-request");
const {
  createSupportTicketSchema,
  sellerSupportFeedbackSchema,
  updateSupportTicketSchema,
} = require("../validators/support-validator");

router.post(
  "/tickets",
  authenticate,
  sellerOnly,
  validateRequest(createSupportTicketSchema),
  supportController.createTicket
);
router.get(
  "/tickets",
  authenticate,
  sellerOnly,
  supportController.listSellerTickets
);
router.patch(
  "/tickets/:ticketId/feedback",
  authenticate,
  sellerOnly,
  validateRequest(sellerSupportFeedbackSchema),
  supportController.respondToTicket
);
router.delete(
  "/tickets/:ticketId",
  authenticate,
  sellerOnly,
  supportController.deleteSellerTicket
);

router.get(
  "/admin/tickets",
  supportAdminOnly,
  supportController.listAdminTickets
);
router.patch(
  "/admin/tickets/:ticketId",
  supportAdminOnly,
  validateRequest(updateSupportTicketSchema),
  supportController.updateTicket
);
router.delete(
  "/admin/tickets/:ticketId",
  supportAdminOnly,
  supportController.deleteTicket
);

module.exports = router;
