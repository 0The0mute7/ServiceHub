const prisma = require("../config/prisma");
const { sendSuccess, sendError } = require("../utils/responses");

const getOtherParticipant = (conversation, userId) => {
  return conversation.buyerId === userId ? conversation.provider : conversation.buyer;
};

const formatConversation = (conversation, userId) => {
  return {
    id: conversation.id,
    service: conversation.service,
    otherParticipant: getOtherParticipant(conversation, userId),
    latestMessage: conversation.messages[0] || null,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };
};

const conversationInclude = {
  service: {
    select: {
      id: true,
      title: true,
      category: true,
      location: true,
      price: true,
    },
  },
  buyer: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  provider: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  messages: {
    orderBy: {
      createdAt: "desc",
    },
    take: 1,
    include: {
      sender: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  },
};

const findParticipantConversation = async (conversationId, userId) => {
  return prisma.conversation.findFirst({
    where: {
      id: conversationId,
      OR: [{ buyerId: userId }, { providerId: userId }],
    },
  });
};

const startConversation = async (req, res) => {
  try {
    const { serviceId, content } = req.body;
    const senderId = req.user.id;

    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      select: {
        id: true,
        ownerId: true,
      },
    });

    if (!service) {
      return sendError(res, 404, "Service not found");
    }

    if (service.ownerId === senderId) {
      return sendError(res, 400, "You cannot message yourself");
    }

    const conversation = await prisma.conversation.upsert({
      where: {
        serviceId_buyerId_providerId: {
          serviceId: service.id,
          buyerId: senderId,
          providerId: service.ownerId,
        },
      },
      update: {},
      create: {
        serviceId: service.id,
        buyerId: senderId,
        providerId: service.ownerId,
      },
    });

    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId,
        content,
      },
    });

    const fullConversation = await prisma.conversation.findUnique({
      where: { id: conversation.id },
      include: conversationInclude,
    });

    return sendSuccess(
      res,
      201,
      "Conversation started successfully",
      formatConversation(fullConversation, senderId)
    );
  } catch (err) {
    return sendError(res, 500, "Server error");
  }
};

const getConversations = async (req, res) => {
  try {
    const userId = req.user.id;

    const conversations = await prisma.conversation.findMany({
      where: {
        OR: [{ buyerId: userId }, { providerId: userId }],
      },
      include: conversationInclude,
      orderBy: {
        updatedAt: "desc",
      },
    });

    return sendSuccess(
      res,
      200,
      "Conversations fetched successfully",
      conversations.map((conversation) => formatConversation(conversation, userId))
    );
  } catch (err) {
    return sendError(res, 500, "Server error");
  }
};

const getMessages = async (req, res) => {
  try {
    const conversationId = Number(req.params.conversationId);
    const conversation = await findParticipantConversation(conversationId, req.user.id);

    if (!conversation) {
      return sendError(res, 404, "Conversation not found");
    }

    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return sendSuccess(res, 200, "Messages fetched successfully", messages);
  } catch (err) {
    return sendError(res, 500, "Server error");
  }
};

const createMessage = async (req, res) => {
  try {
    const conversationId = Number(req.params.conversationId);
    const conversation = await findParticipantConversation(conversationId, req.user.id);

    if (!conversation) {
      return sendError(res, 404, "Conversation not found");
    }

    const message = await prisma.message.create({
      data: {
        conversationId,
        senderId: req.user.id,
        content: req.body.content,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return sendSuccess(res, 201, "Message sent successfully", message);
  } catch (err) {
    return sendError(res, 500, "Server error");
  }
};

module.exports = {
  startConversation,
  getConversations,
  getMessages,
  createMessage,
};
