const Notification = require("../models/Notification.model");

const createNotification = (data) => Notification.create(data);

const notify = (userId, type, title, message, entityType, entityId) =>
  createNotification({ userId, type, title, message, entityType, entityId });

const markOverdueFollowUps = async (FollowUp, notifyUser) => {
  const due = await FollowUp.find({
    status: "PENDING",
    dueDate: { $lt: new Date() },
  });
  for (const followUp of due) {
    followUp.status = "OVERDUE";
    await followUp.save();
    const exists = await Notification.exists({
      userId: followUp.assignedTo,
      type: "FOLLOWUP_OVERDUE",
      entityType: "FOLLOWUP",
      entityId: followUp._id,
    });
    if (!exists) {
      await notifyUser(
        followUp.assignedTo,
        "FOLLOWUP_OVERDUE",
        "Follow-up overdue",
        `Follow-up "${followUp.title}" is overdue.`,
        "FOLLOWUP",
        followUp._id,
      );
    }
  }
};

module.exports = { createNotification, notify, markOverdueFollowUps };
