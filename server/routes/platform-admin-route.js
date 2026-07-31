const router = require("express").Router();

const platformAdminController = require("../controllers/platform-admin-controller");
const supportAdminOnly = require("../middlewares/support-admin");

router.use(supportAdminOnly);
router.get("/stores", platformAdminController.listStores);

module.exports = router;
