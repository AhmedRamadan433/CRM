const { Activity } = require("../models/Activity.model");
const AppError = require("../utils/AppError");
const asyncwrapper = require("../utils/Async_Wrapper");
const HttpStatusText = require("../utils/HttpStatusText");

const activityAccessFilter = (req) =>
  req.user.role === "SALES_AGENT" ? { actorId: req.user._id } : {};

/// get all activities
const getAllActivities = asyncwrapper(async (req, res, next) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(
    Math.max(parseInt(req.query.limit, 10) || 20, 1),
    100,
  );
  const filter = activityAccessFilter(req);
  const [activities, total] = await Promise.all([
    Activity.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Activity.countDocuments(filter),
  ]);

  res.status(200).json({
    status: HttpStatusText.SUCCESS,
    results: activities.length,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    data: {
      activities,
    },
  });
});

//// get activities for specific entity
const getEntityActivities = asyncwrapper(async (req, res, next) => {
  const { entityType, entityId } = req.params;
  const activities = await Activity.find({
    entityType,
    entityId,
    ...activityAccessFilter(req),
  });

  res.status(200).json({
    status: HttpStatusText.SUCCESS,
    data: {
      activities,
    },
  });
});
////
module.exports = {
  getAllActivities,
  getEntityActivities,
};
