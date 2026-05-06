const { z } = require("zod");

const startMessageSchema = z.object({
  serviceId: z.number({ required_error: "Service ID is required", invalid_type_error: "Service ID must be valid" }).int().positive("Service ID must be valid"),
  content: z.string().trim().min(1, "Message content is required"),
});

const createMessageSchema = z.object({
  content: z.string().trim().min(1, "Message content is required"),
});

module.exports = { startMessageSchema, createMessageSchema };
