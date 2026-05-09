const express = require("express");
const cors = require("cors");
require("dotenv").config();

const authRoutes = require("./routes/auth.routes");
const serviceRoutes = require("./routes/service.routes");
const messageRoutes = require("./routes/message.routes");
const pushRoutes = require("./routes/push.routes");
const { notFound, errorHandler } = require("./middleware/error.middleware");
const { sendSuccess } = require("./utils/responses");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  return sendSuccess(res, 200, "ServiceHub API running");
});

app.use("/api/auth", authRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/push", pushRoutes);
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
