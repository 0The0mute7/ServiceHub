const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const prisma = require("./config/prisma");
const { sendSuccess, sendError } = require("./utils/responses");

const setupSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: { origin: true },
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth && socket.handshake.auth.token;
      if (!token) return next(new Error("Missing token"));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch (e) {
      next(new Error("Invalid token"));
    }
  });

  const assertParticipant = async (conversationId) => {
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        OR: [{ buyerId: socket.user.id }, { providerId: socket.user.id }],
      },
      select: { id: true },
    });

    return !!conversation;
  };

  io.on("connection", (socket) => {
    socket.on("joinConversation", async ({ conversationId }, ack) => {
      try {
        if (!conversationId) return ack && ack({ ok: false, error: "Missing conversationId" });

        // Only allow join if user is a participant
        const allowed = await prisma.conversation.findFirst({
          where: {
            id: Number(conversationId),
            OR: [{ buyerId: socket.user.id }, { providerId: socket.user.id }],
          },
          select: { id: true },
        });

        if (!allowed) return ack && ack({ ok: false, error: "Forbidden" });

        socket.join(`conversation:${conversationId}`);
        return ack && ack({ ok: true });
      } catch (e) {
        return ack && ack({ ok: false, error: "Failed to join" });
      }
    });

    socket.on("typing:start", ({ conversationId }) => {
      if (!conversationId) return;
      socket.to(`conversation:${conversationId}`).emit("typing:other", { conversationId, userId: socket.user.id, typing: true });
    });

    socket.on("typing:stop", ({ conversationId }) => {
      if (!conversationId) return;
      socket.to(`conversation:${conversationId}`).emit("typing:other", { conversationId, userId: socket.user.id, typing: false });
    });

    socket.on("sendMessage", async ({ conversationId, content }, ack) => {
      try {
        if (!conversationId) return ack && ack({ ok: false, error: "Missing conversationId" });
        if (!content || typeof content !== "string" || !content.trim()) {
          return ack && ack({ ok: false, error: "Missing content" });
        }

        // Participant check
        const isParticipant = await prisma.conversation.findFirst({
          where: {
            id: Number(conversationId),
            OR: [{ buyerId: socket.user.id }, { providerId: socket.user.id }],
          },
          select: { id: true },
        });

        if (!isParticipant) return ack && ack({ ok: false, error: "Forbidden" });

        const message = await prisma.message.create({
          data: {
            conversationId: Number(conversationId),
            senderId: socket.user.id,
            content: content.trim(),
            status: "sent",
          },
          include: {
            sender: { select: { id: true, name: true } },
          },
        });

        // Immediately mark as delivered (WhatsApp-like: reached recipient's device/server)
        const delivered = await prisma.message.update({
          where: { id: message.id },
          data: { status: "delivered" },
          select: { id: true, status: true },
        });

        // Convert to payload shape the frontend can render
        const payload = {
          id: message.id,
          conversationId: message.conversationId,
          sender: message.sender,
          content: message.content,
          status: message.status,
          createdAt: message.createdAt,
        };

        // Emit message (sent)
        io.to(`conversation:${conversationId}`).emit("message:new", payload);

        // Emit status (delivered) so sender ticks become ✔✔
        io.to(`conversation:${conversationId}`).emit("message:status", {
          conversationId: Number(conversationId),
          messageId: delivered.id,
          status: delivered.status,
        });

        return ack && ack({ ok: true, messageId: message.id, status: "delivered" });
      } catch (e) {
        return ack && ack({ ok: false, error: "Failed to send message" });
      }
    });

    socket.on("messageSeen", async ({ conversationId, messageId }, ack) => {
      try {
        if (!conversationId || !messageId) return ack && ack({ ok: false, error: "Missing params" });

        // Participant check
        const isParticipant = await prisma.conversation.findFirst({
          where: {
            id: Number(conversationId),
            OR: [{ buyerId: socket.user.id }, { providerId: socket.user.id }],
          },
          select: { id: true },
        });

        if (!isParticipant) return ack && ack({ ok: false, error: "Forbidden" });

        // Only mark as seen if recipient is the other party (i.e., they are not the sender)
        const message = await prisma.message.findFirst({
          where: { id: Number(messageId), conversationId: Number(conversationId) },
          select: { id: true, senderId: true, status: true },
        });

        if (!message) return ack && ack({ ok: false, error: "Message not found" });
        if (message.senderId === socket.user.id) return ack && ack({ ok: false, error: "Cannot see own message" });

        const updated = await prisma.message.update({
          where: { id: Number(messageId) },
          data: { status: "seen", seenAt: new Date() },
          select: { id: true, status: true, seenAt: true },
        });

        io.to(`conversation:${conversationId}`).emit("message:status", {
          conversationId: Number(conversationId),
          messageId: updated.id,
          status: updated.status,
          seenAt: updated.seenAt,
        });

        return ack && ack({ ok: true });
      } catch (e) {
        return ack && ack({ ok: false, error: "Failed to mark seen" });
      }
    });

    socket.on("disconnect", () => {
      // No-op
    });
  });

  return io;
};

module.exports = { setupSocket };
