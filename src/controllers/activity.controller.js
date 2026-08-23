const Activity = require("../models/activity.model");
const AppError = require("../utils/AppError");
const asyncwrapper = require("../utils/Async_Wrapper");
const HttpStatusText = require("../utils/HttpStatusText");

/// get all activities
const getAllActivities = asyncwrapper(async (req, res, next) => {
  const activities = await Activity.find();

  res.status(200).json({
    status: HttpStatusText.SUCCESS,
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
