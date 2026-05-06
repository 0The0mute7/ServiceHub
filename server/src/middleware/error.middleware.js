const { sendError } = require("../utils/responses");

const notFound = (req, res) => {
  return sendError(res, 404, "Route not found");
};

const errorHandler = (err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return sendError(res, 400, "Invalid JSON body");
  }

  return sendError(res, 500, "Server error");
};

module.exports = { notFound, errorHandler };
