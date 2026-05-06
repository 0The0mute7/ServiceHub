const { z } = require("zod");

const createServiceSchema = z.object({
  title: z.string().nonempty("Title is required").min(2, "Title must be at least 2 characters"),
  description: z.string().nonempty("Description is required").min(10, "Description must be at least 10 characters"),
  price: z.number({ required_error: "Price is required", invalid_type_error: "Price must be a number" }).positive("Price must be greater than 0"),
  category: z.string().nonempty("Category is required").min(2, "Category must be at least 2 characters"),
  location: z.string().nonempty("Location is required").min(2, "Location must be at least 2 characters"),
  contact: z.string().nonempty("Contact is required").min(2, "Contact must be at least 2 characters"),
});

const updateServiceSchema = createServiceSchema.partial();

module.exports = { createServiceSchema, updateServiceSchema };
