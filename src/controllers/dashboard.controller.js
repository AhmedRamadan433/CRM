const dashboardService = require("../services/dashboard.service");
const asyncwrapper = require("../utils/Async_Wrapper");
const HttpStatusText = require("../utils/HttpStatusText");

// Get full dashboard
const getDashboard = asyncwrapper(async (req, res, next) => {
  const data = await dashboardService.getDashboard(req.user, req.query);

  res.status(200).json({
    status: HttpStatusText.SUCCESS,
    data,
  });
});

// Get overview metrics
const getOverviewMetrics = asyncwrapper(async (req, res, next) => {
  const data = await dashboardService.getOverviewMetrics(req.user, req.query);

  res.status(200).json({
    status: HttpStatusText.SUCCESS,
    data,
  });
});

// Get leads by status
const getLeadsByStatus = asyncwrapper(async (req, res, next) => {
  const data = await dashboardService.getLeadsByStatus(req.user, req.query);

  res.status(200).json({
    status: HttpStatusText.SUCCESS,
    data,
  });
});

// Get deals by stage
const getDealsByStage = asyncwrapper(async (req, res, next) => {
  const data = await dashboardService.getDealsByStage(req.user, req.query);

  res.status(200).json({
    status: HttpStatusText.SUCCESS,
    data,
  });
});

// Get leads by source
const getLeadsBySource = asyncwrapper(async (req, res, next) => {
  const data = await dashboardService.getLeadsBySource(req.user, req.query);

  res.status(200).json({
    status: HttpStatusText.SUCCESS,
    data,
  });
});

// Get sales performance
const getSalesPerformance = asyncwrapper(async (req, res, next) => {
  const data = await dashboardService.getSalesPerformance(req.query);

  res.status(200).json({
    status: HttpStatusText.SUCCESS,
    data,
  });
});

// Get revenue by period
const getRevenueByPeriod = asyncwrapper(async (req, res, next) => {
  const data = await dashboardService.getRevenueByPeriod(req.user, req.query);

  res.status(200).json({
    status: HttpStatusText.SUCCESS,
    data,
  });
});

module.exports = {
  getDashboard,
  getOverviewMetrics,
  getLeadsByStatus,
  getDealsByStage,
  getLeadsBySource,
  getSalesPerformance,
  getRevenueByPeriod,
};
