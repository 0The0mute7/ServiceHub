const express = require("express");
const router = express.Router();

const protect = require("../middleware/auth.middleware");
const validate = require("../middleware/validate.middleware");
const {
  subscribeSchema,
  sendSchema,
} = require("../validators/push.validator");

const { subscribe, sendToUser } = require("../controllers/push.controller");

router.post("/subscribe", protect, validate(subscribeSchema), subscribe);
router.post("/send", protect, validate(sendSchema), sendToUser);

module.exports = router;
