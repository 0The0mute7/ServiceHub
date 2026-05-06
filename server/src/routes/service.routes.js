const express = require("express");
const router = express.Router();

const {
  createService,
  getServices,
  getMyServices,
  getServiceById,
  updateService,
  deleteService,
} = require("../controllers/service.controller");
const protect = require("../middleware/auth.middleware");
const validate = require("../middleware/validate.middleware");
const {
  createServiceSchema,
  updateServiceSchema,
} = require("../validators/service.validator");
const optionalAuth = require("../middleware/optionalAuth.middleware");

router.post("/", protect, validate(createServiceSchema), createService);
router.get("/", optionalAuth, getServices);
router.get("/mine", protect, getMyServices);
router.get("/:id", optionalAuth, getServiceById);
router.put("/:id", protect, validate(updateServiceSchema), updateService);
router.delete("/:id", protect, deleteService);

module.exports = router;
