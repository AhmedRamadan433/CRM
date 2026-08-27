const Notification = require("../models/Notification.model");
const asyncwrapper = require("../utils/Async_Wrapper");
const AppError = require("../utils/AppError");
const HttpStatusText = require("../utils/HttpStatusText");

const getNotifications = asyncwrapper(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
  const filter = { userId: req.user._id };
  if (req.query.unread === "true") filter.read = false;
  const [notifications, total, unread] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ userId: req.user._id, read: false }),
  ]);
  res.json({ status: HttpStatusText.SUCCESS, results: notifications.length, total, unread, page, limit, data: notifications });
});

const markRead = asyncwrapper(async (req, res, next) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    { read: true },
    { returnDocument: "after" },
  );
  if (!notification) return next(new AppError("Notification not found", 404, HttpStatusText.FAIL));
  res.json({ status: HttpStatusText.SUCCESS, data: notification });
});

const markAllRead = asyncwrapper(async (req, res) => {
  const result = await Notification.updateMany({ userId: req.user._id, read: false }, { read: true });
  res.json({ status: HttpStatusText.SUCCESS, modified: result.modifiedCount });
});

const deleteNotification = asyncwrapper(async (req, res, next) => {
  const notification = await Notification.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
  if (!notification) return next(new AppError("Notification not found", 404, HttpStatusText.FAIL));
  res.status(204).send();
});

module.exports = { getNotifications, markRead, markAllRead, deleteNotification };
