const { Lead } = require("../models/Lead.model");
const { Deal } = require("../models/Deal.model");
const { FollowUp } = require("../models/FollowUp.model");
const Customer = require("../models/Customer.model");
const User = require("../models/User.model");

const FULL_ACCESS_ROLES = ["ADMIN", "MANAGER"];

const OPEN_LEAD_STATUSES = ["NEW", "CONTACTED", "INTERESTED", "NEGOTIATION"];

/*
 * Build date range
 */
const buildDateFilter = (query, field = "createdAt") => {
  if (!query.startDate && !query.endDate) {
    return null;
  }

  const filter = {};

  if (query.startDate) {
    const startDate = new Date(query.startDate);

    if (Number.isNaN(startDate.getTime())) {
      throw new Error("Invalid startDate");
    }

    filter.$gte = startDate;
  }

  if (query.endDate) {
    const endDate = new Date(query.endDate);

    if (Number.isNaN(endDate.getTime())) {
      throw new Error("Invalid endDate");
    }

    // Include the entire end date
    endDate.setDate(endDate.getDate() + 1);

    filter.$lt = endDate;
  }

  return {
    [field]: filter,
  };
};

/*
 * Build filter based on role
 *
 * ADMIN / MANAGER
 * → all data
 * → can filter by assignedTo
 *
 * SALES_AGENT
 * → own assigned data only
 */
const buildBaseFilter = (user, query, dateField = "createdAt") => {
  const filter = {};

  /*
   * SALES_AGENT can only see own data
   */
  if (user.role === "SALES_AGENT") {
    filter.assignedTo = user._id;
  } else if (query.assignedTo) {
    /*
     * ADMIN / MANAGER can filter by assigned user
     */
    filter.assignedTo = query.assignedTo;
  }

  /*
   * Date filter
   */
  const dateFilter = buildDateFilter(query, dateField);

  if (dateFilter) {
    Object.assign(filter, dateFilter);
  }

  return filter;
};

/*
 * Get overview metrics
 */
const getOverviewMetrics = async (user, query) => {
  const customerFilter = buildBaseFilter(user, query, "createdAt");

  const leadFilter = buildBaseFilter(user, query, "createdAt");

  /*
   * Revenue / deals are filtered by createdAt
   * for general deal metrics.
   *
   * Revenue itself will use actualCloseDate
   * in getRevenueByPeriod().
   */
  const dealFilter = buildBaseFilter(user, query, "createdAt");

  const followUpFilter = buildBaseFilter(user, query, "createdAt");

  /*
   * Allow separate filters
   */
  if (user.role !== "SALES_AGENT" && query.leadAssignedTo) {
    leadFilter.assignedTo = query.leadAssignedTo;
  }

  if (user.role !== "SALES_AGENT" && query.dealAssignedTo) {
    dealFilter.assignedTo = query.dealAssignedTo;
  }

  if (user.role !== "SALES_AGENT" && query.followUpAssignedTo) {
    followUpFilter.assignedTo = query.followUpAssignedTo;
  }

  const now = new Date();

  const [
    totalCustomers,
    totalLeads,
    newLeads,
    openLeads,
    wonLeads,
    lostLeads,

    totalDeals,
    openDeals,
    wonDeals,
    lostDeals,

    revenueResult,

    pendingFollowUps,
    overdueFollowUps,

    totalUsers,
  ] = await Promise.all([
    /*
     * Customers
     */
    Customer.countDocuments(customerFilter),

    /*
     * Leads
     */
    Lead.countDocuments(leadFilter),

    Lead.countDocuments({
      ...leadFilter,
      status: "NEW",
    }),

    Lead.countDocuments({
      ...leadFilter,
      status: {
        $in: OPEN_LEAD_STATUSES,
      },
    }),

    Lead.countDocuments({
      ...leadFilter,
      status: "WON",
    }),

    Lead.countDocuments({
      ...leadFilter,
      status: "LOST",
    }),

    /*
     * Deals
     */
    Deal.countDocuments(dealFilter),

    Deal.countDocuments({
      ...dealFilter,
      stage: "NEGOTIATION",
    }),

    Deal.countDocuments({
      ...dealFilter,
      stage: "WON",
    }),

    Deal.countDocuments({
      ...dealFilter,
      stage: "LOST",
    }),

    /*
     * Revenue
     *
     * Revenue = WON deals
     */
    Deal.aggregate([
      {
        $match: {
          ...dealFilter,
          stage: "WON",
        },
      },
      {
        $group: {
          _id: "$currency",
          totalRevenue: {
            $sum: "$value",
          },
        },
      },
    ]),

    /*
     * Follow-ups
     */
    FollowUp.countDocuments({
      ...followUpFilter,
      status: "PENDING",
    }),

    FollowUp.countDocuments({
      ...followUpFilter,
      status: "PENDING",
      dueDate: {
        $lt: now,
      },
    }),

    /*
     * Users
     *
     * User count is system-wide for ADMIN/MANAGER.
     * SALES_AGENT doesn't need a user count filter.
     */
    User.countDocuments({
      status: "ACTIVE",
    }),
  ]);

  /*
   * Conversion rate
   *
   * Won Deals / Total Deals
   */
  const conversionRate =
    totalDeals > 0 ? Number(((wonDeals / totalDeals) * 100).toFixed(2)) : 0;

  /*
   * Format revenue
   *
   * Example:
   *
   * {
   *   EGP: 150000,
   *   USD: 5000
   * }
   */
  const revenue = {};

  revenueResult.forEach((item) => {
    revenue[item._id] = item.totalRevenue;
  });

  return {
    totalCustomers,
    totalLeads,
    totalUsers,

    leads: {
      total: totalLeads,
      new: newLeads,
      open: openLeads,
      won: wonLeads,
      lost: lostLeads,
    },

    deals: {
      total: totalDeals,
      open: openDeals,
      won: wonDeals,
      lost: lostDeals,
    },

    revenue,

    conversionRate,

    followUps: {
      pending: pendingFollowUps,
      overdue: overdueFollowUps,
    },
  };
};

/*
 * Get leads by status
 */
const getLeadsByStatus = async (user, query) => {
  const filter = buildBaseFilter(user, query, "createdAt");

  const result = await Lead.aggregate([
    {
      $match: filter,
    },

    {
      $group: {
        _id: "$status",
        count: {
          $sum: 1,
        },
      },
    },

    {
      $sort: {
        _id: 1,
      },
    },
  ]);

  const byStatus = {};

  result.forEach((item) => {
    byStatus[item._id] = item.count;
  });

  return byStatus;
};

/*
 * Get deals by stage
 */
const getDealsByStage = async (user, query) => {
  const filter = buildBaseFilter(user, query, "createdAt");

  const result = await Deal.aggregate([
    {
      $match: filter,
    },

    {
      $group: {
        _id: "$stage",

        count: {
          $sum: 1,
        },

        totalValue: {
          $sum: "$value",
        },
      },
    },

    {
      $sort: {
        _id: 1,
      },
    },
  ]);

  const byStage = {};

  result.forEach((item) => {
    byStage[item._id] = {
      count: item.count,
      totalValue: item.totalValue,
    };
  });

  return byStage;
};

/*
 * Get leads by source
 *
 * Manager metric
 */
const getLeadsBySource = async (user, query) => {
  const filter = buildBaseFilter(user, query, "createdAt");

  const result = await Lead.aggregate([
    {
      $match: filter,
    },

    {
      $group: {
        _id: {
          $ifNull: ["$source", "UNKNOWN"],
        },

        count: {
          $sum: 1,
        },
      },
    },

    {
      $sort: {
        count: -1,
      },
    },
  ]);

  const bySource = {};

  result.forEach((item) => {
    bySource[item._id] = item.count;
  });

  return bySource;
};

/*
 * Get sales performance
 *
 * ADMIN / MANAGER only
 */
const getSalesPerformance = async (query) => {
  const matchFilter = {};

  const dateFilter = buildDateFilter(query, "createdAt");

  if (dateFilter) {
    Object.assign(matchFilter, dateFilter);
  }

  const result = await Deal.aggregate([
    {
      $match: matchFilter,
    },

    {
      $group: {
        _id: "$assignedTo",

        totalDeals: {
          $sum: 1,
        },

        wonDeals: {
          $sum: {
            $cond: [
              {
                $eq: ["$stage", "WON"],
              },
              1,
              0,
            ],
          },
        },

        lostDeals: {
          $sum: {
            $cond: [
              {
                $eq: ["$stage", "LOST"],
              },
              1,
              0,
            ],
          },
        },

        totalValue: {
          $sum: "$value",
        },

        wonValue: {
          $sum: {
            $cond: [
              {
                $eq: ["$stage", "WON"],
              },
              "$value",
              0,
            ],
          },
        },
      },
    },

    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "user",
      },
    },

    {
      $unwind: {
        path: "$user",
        preserveNullAndEmptyArrays: true,
      },
    },

    {
      $project: {
        _id: 1,

        name: "$user.name",

        email: "$user.email",

        totalDeals: 1,

        wonDeals: 1,

        lostDeals: 1,

        totalValue: 1,

        wonValue: 1,
      },
    },

    {
      $sort: {
        wonValue: -1,
      },
    },
  ]);

  return result;
};

/*
 * Get revenue by period
 *
 * Revenue is calculated using actualCloseDate
 */
const getRevenueByPeriod = async (user, query) => {
  const matchFilter = {
    stage: "WON",
  };

  /*
   * Manager/Admin → optional assignedTo filter
   *
   * SALES_AGENT is not expected to call this
   * because this is a manager metric.
   */
  if (query.assignedTo) {
    matchFilter.assignedTo = query.assignedTo;
  }

  const dateFilter = buildDateFilter(query, "actualCloseDate");

  if (dateFilter) {
    Object.assign(matchFilter, dateFilter);
  }

  const result = await Deal.aggregate([
    {
      $match: matchFilter,
    },

    {
      $group: {
        _id: {
          year: {
            $year: "$actualCloseDate",
          },

          month: {
            $month: "$actualCloseDate",
          },
        },

        totalRevenue: {
          $sum: "$value",
        },

        dealCount: {
          $sum: 1,
        },
      },
    },

    {
      $sort: {
        "_id.year": -1,
        "_id.month": -1,
      },
    },

    {
      $limit: 12,
    },
  ]);

  return result.map((item) => ({
    period: `${item._id.year}-${String(item._id.month).padStart(2, "0")}`,

    totalRevenue: item.totalRevenue,

    dealCount: item.dealCount,
  }));
};

/*
 * Get complete dashboard
 */
const getDashboard = async (user, query) => {
  /*
   * Run common dashboard sections in parallel
   */
  const [overview, leadsByStatus, dealsByStage] = await Promise.all([
    getOverviewMetrics(user, query),
    getLeadsByStatus(user, query),
    getDealsByStage(user, query),
  ]);

  const result = {
    overview,
    leadsByStatus,
    dealsByStage,
  };

  /*
   * ADMIN / MANAGER metrics
   */
  if (FULL_ACCESS_ROLES.includes(user.role)) {
    const [leadsBySource, salesPerformance, revenueByPeriod] =
      await Promise.all([
        getLeadsBySource(user, query),
        getSalesPerformance(query),
        getRevenueByPeriod(user, query),
      ]);

    result.leadsBySource = leadsBySource;

    result.salesPerformance = salesPerformance;

    result.revenueByPeriod = revenueByPeriod;
  }

  return result;
};

module.exports = {
  getDashboard,
  getOverviewMetrics,
  getLeadsByStatus,
  getDealsByStage,
  getLeadsBySource,
  getSalesPerformance,
  getRevenueByPeriod,
};
