const prisma = require("../config/prisma");
const { sendSuccess, sendError } = require("../utils/responses");

const serviceInclude = {
  owner: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
};

const formatService = (service, canViewContact) => {
  if (!service) return service;

  const formatted = {
    ...service,
    provider: service.owner,
  };

  delete formatted.owner;

  if (!canViewContact) {
    delete formatted.contact;
  }

  return formatted;
};

const createService = async (req, res) => {
  try {
    const { title, description, price, category, location, contact } = req.body;

    const newService = await prisma.service.create({
      data: {
        title,
        description,
        price,
        category,
        location,
        contact,
        ownerId: req.user.id,
      },
      include: serviceInclude,
    });

    return sendSuccess(res, 201, "Service created successfully", formatService(newService, true));
  } catch (err) {
    return sendError(res, 500, "Server error");
  }
};

const getServices = async (req, res) => {
  try {
    const services = await prisma.service.findMany({
      include: serviceInclude,
      orderBy: { createdAt: "desc" },
    });

    const canViewContact = Boolean(req.user);
    const formattedServices = services.map((service) =>
      formatService(service, canViewContact)
    );

    return sendSuccess(res, 200, "Services fetched successfully", formattedServices);
  } catch (err) {
    return sendError(res, 500, "Server error");
  }
};

const getMyServices = async (req, res) => {
  try {
    const services = await prisma.service.findMany({
      where: {
        ownerId: req.user.id,
      },
      include: serviceInclude,
      orderBy: {
        createdAt: "desc",
      },
    });

    const formattedServices = services.map((service) => formatService(service, true));

    return sendSuccess(res, 200, "My services fetched successfully", formattedServices);
  } catch (err) {
    return sendError(res, 500, "Server error");
  }
};

const getServiceById = async (req, res) => {
  try {
    const serviceId = Number(req.params.id);
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      include: serviceInclude,
    });

    if (!service) {
      return sendError(res, 404, "Service not found");
    }

    return sendSuccess(
      res,
      200,
      "Service fetched successfully",
      formatService(service, Boolean(req.user))
    );
  } catch (err) {
    return sendError(res, 500, "Server error");
  }
};

const updateService = async (req, res) => {
  try {
    const serviceId = Number(req.params.id);
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      return sendError(res, 404, "Service not found");
    }

    if (service.ownerId !== req.user.id) {
      return sendError(res, 403, "Not authorized to update this service");
    }

    const updatedService = await prisma.service.update({
      where: { id: serviceId },
      data: req.body,
      include: serviceInclude,
    });

    return sendSuccess(
      res,
      200,
      "Service updated successfully",
      formatService(updatedService, true)
    );
  } catch (err) {
    return sendError(res, 500, "Server error");
  }
};

const deleteService = async (req, res) => {
  try {
    const serviceId = Number(req.params.id);
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      return sendError(res, 404, "Service not found");
    }

    if (service.ownerId !== req.user.id) {
      return sendError(res, 403, "Not authorized to delete this service");
    }

    const deletedService = await prisma.service.delete({
      where: { id: serviceId },
      include: serviceInclude,
    });

    return sendSuccess(
      res,
      200,
      "Service deleted successfully",
      formatService(deletedService, true)
    );
  } catch (err) {
    return sendError(res, 500, "Server error");
  }
};

module.exports = {
  createService,
  getServices,
  getMyServices,
  getServiceById,
  updateService,
  deleteService,
};
