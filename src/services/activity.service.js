const Activity = require("../models/activity.model");

// Create activity
const createActivity = async ({
  actorId,
  action,
  entityType,
  entityId,
  metadata = {},
}) => {
  try {
    const activity = await Activity.create({
      actorId,
      action,
      entityType,
      entityId,
      metadata,
    });

    return activity;
  } catch (error) {
    throw new Error(`Failed to create activity: ${error.message}`);
  }
};

module.exports = {
  createActivity,
};
