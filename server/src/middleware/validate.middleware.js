const { sendError } = require("../utils/responses");

const validate = (schema) => {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      const errors = [];

      for (const [field, messages] of Object.entries(fieldErrors)) {
        if (messages && messages.length > 0) {
          errors.push({
            field,
            message: messages[0] // Take the first error message for each field
          });
        }
      }

      return sendError(res, 400, "Validation error", errors);
    }

    req.body = result.data;
    next();
  };
};

module.exports = validate;
