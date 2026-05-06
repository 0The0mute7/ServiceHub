const express = require("express");
const router = express.Router();

const {
  startConversation,
  getConversations,
  getMessages,
  createMessage,
} = require("../controllers/message.controller");
const protect = require("../middleware/auth.middleware");
const validate = require("../middleware/validate.middleware");
const {
  startMessageSchema,
  createMessageSchema,
} = require("../validators/message.validator");

router.post("/start", protect, validate(startMessageSchema), startConversation);
router.get("/conversations", protect, getConversations);
router.get("/:conversationId", protect, getMessages);
router.post("/:conversationId", protect, validate(createMessageSchema), createMessage);

module.exports = router;
