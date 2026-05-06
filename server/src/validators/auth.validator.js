const { z } = require("zod");

const registerSchema = z.object({
  name: z.string().nonempty("Name is required").min(2, "Name must be at least 2 characters"),
  email: z.string().nonempty("Email is required").email("Email must be valid"),
  password: z.string().nonempty("Password is required").min(6, "Password must be at least 6 characters"),
});

const loginSchema = z.object({
  email: z.string().nonempty("Email is required").email("Email must be valid"),
  password: z.string().nonempty("Password is required"),
});

module.exports = { registerSchema, loginSchema };
