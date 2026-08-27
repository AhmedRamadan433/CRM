# API Routes Reference

This document describes the Express route modules in `src/routes`.

## Base URL and conventions

- `src/app.js` mounts `src/routes/All_Routes.js` at `/`, so the paths below are the complete API paths.
- Unless noted otherwise, protected endpoints require an `Authorization: Bearer <JWT>` header.
- Protected routes reject missing, invalid, expired, or inactive-user tokens with an authentication error.
- Role restrictions are applied after authentication:
  - `ADMIN`: administrator
  - `MANAGER`: manager
  - `SALES_AGENT`: sales agent
- `:id` represents a MongoDB document ID.
- `PATCH` endpoints accept only the fields supported by their controller.

## Route mounting

`All_Routes.js` mounts these modules:

| Prefix | Route module | Purpose |
| --- | --- | --- |
| `/auth` | `auth.routes.js` | Registration and authentication |
| `/users` | `user.routes.js` | User administration |
| `/customers` | `customer.routes.js` | Customer management and customer searches |
| `/leads` | `lead.routes.js` | Lead management and workflow changes |
| `/deals` | `deal.routes.js` | Deal management and sales workflow |
| `/dashboard` | `dashboard.routes.js` | Dashboard metrics |
| `/activities` | `activity.routes.js` | Activity history |
| `/conversations` | `conversation.routes.js` | Conversations and nested messages |
| `/followups` | `followUp.routes.js` | Follow-up management |
| `/notes` | `note.routes.js` | Notes |
| `/search` | `search.routes.js` | Cross-entity search |
| `/notifications` | `notification.routes.js` | User notifications |

`message.routes.js` exists but is not mounted in `All_Routes.js`. Its endpoints are therefore not reachable through the current application router. Message operations are available through the nested conversation endpoints documented below.

## Authentication: `/auth`

These endpoints are public.

| Method | Endpoint | Controller function | Description |
| --- | --- | --- | --- |
| `POST` | `/auth/register` | `register` | Creates a new sales-agent user and returns a JWT. |
| `POST` | `/auth/login` | `signIn` | Validates email and password, then returns a JWT. Inactive users cannot sign in. |
| `POST` | `/auth/logout` | `logout` | Returns a successful logout response. JWT invalidation is not performed server-side. |

## Users: `/users`

All user endpoints require authentication.

| Method | Endpoint | Roles | Controller function | Description |
| --- | --- | --- | --- | --- |
| `POST` | `/users` | `ADMIN` | `createUser` | Creates a user from the request body. |
| `GET` | `/users` | `ADMIN`, `MANAGER` | `getAllUsers` | Returns all users. |
| `GET` | `/users/:id` | `ADMIN`, `MANAGER` | `getUserById` | Returns one user by ID. |
| `PATCH` | `/users/:id` | `ADMIN` | `updateUserById` | Updates a user's name, email, phone, or avatar. |
| `PATCH` | `/users/:id/deactivate` | `ADMIN` | `deactivateUserById` | Marks a user as inactive. |
| `PATCH` | `/users/:id/role` | `ADMIN` | `assignRoleToUserById` | Changes a user's role. |

## Customers: `/customers`

All endpoints require authentication and one of `ADMIN`, `MANAGER`, or `SALES_AGENT`. Sales agents are limited to customers assigned to themselves.

| Method | Endpoint | Controller function | Description |
| --- | --- | --- | --- |
| `POST` | `/customers` | `createCustomer` | Creates a customer. Sales-agent-created customers are assigned to that sales agent. |
| `GET` | `/customers` | `getAllCustomers` | Lists customers with optional `name`, `phone`, `email`, `source`, `createdAfter`, `createdBefore`, `page`, and `limit` filters. |
| `GET` | `/customers/:id` | `getCustomerById` | Returns one accessible customer by ID. |
| `PATCH` | `/customers/:id` | `updateCustomerById` | Updates customer profile and CRM fields. |
| `GET` | `/customers/search/name?name=...` | `searchCustomerByName` | Searches accessible customers by name. |
| `GET` | `/customers/search/phone?phone=...` | `searchCustomerByPhone` | Searches accessible customers by phone. |
| `GET` | `/customers/search/email?email=...` | `searchCustomerByEmail` | Searches accessible customers by email. |

## Leads: `/leads`

All endpoints require authentication and one of `ADMIN`, `MANAGER`, or `SALES_AGENT`. Assignment is restricted to administrators and managers.

| Method | Endpoint | Roles | Controller function | Description |
| --- | --- | --- | --- | --- |
| `POST` | `/leads` | All three roles | `createLead` | Creates a lead. |
| `GET` | `/leads` | All three roles | `getAllLeads` | Lists leads using the controller's filters and access rules. |
| `GET` | `/leads/:id` | All three roles | `getLeadById` | Returns one lead by ID. |
| `PATCH` | `/leads/:id` | All three roles | `updateLeadById` | Updates lead information. |
| `PATCH` | `/leads/:id/assign` | `ADMIN`, `MANAGER` | `assignLeadToUser` | Assigns a lead to a user. |
| `PATCH` | `/leads/:id/status` | All three roles | `changeLeadStatus` | Changes the lead status. |

## Deals: `/deals`

All endpoints require authentication. Most operations allow all three CRM roles; assignment is restricted to administrators and managers.

| Method | Endpoint | Roles | Controller function | Description |
| --- | --- | --- | --- | --- |
| `GET` | `/deals` | All three roles | `getAllDeals` | Lists deals. |
| `POST` | `/deals` | All three roles | `createDeal` | Creates a deal. |
| `GET` | `/deals/:id` | All three roles | `getDealById` | Returns one deal by ID. |
| `PATCH` | `/deals/:id` | All three roles | `updateDeal` | Updates deal information. |
| `PATCH` | `/deals/:id/assign` | `ADMIN`, `MANAGER` | `assignDeal` | Assigns a deal to a user. |
| `PATCH` | `/deals/:id/stage` | All three roles | `changeDealStage` | Changes the deal stage. |
| `PATCH` | `/deals/:id/won` | All three roles | `markDealAsWon` | Marks a deal as won. |
| `PATCH` | `/deals/:id/lost` | All three roles | `markDealAsLost` | Marks a deal as lost. |

## Dashboard: `/dashboard`

All endpoints require authentication.

| Method | Endpoint | Roles | Controller function | Description |
| --- | --- | --- | --- | --- |
| `GET` | `/dashboard` | All three roles | `getDashboard` | Returns the complete dashboard, including overview and breakdowns. |
| `GET` | `/dashboard/overview` | All three roles | `getOverviewMetrics` | Returns overview metrics only. |
| `GET` | `/dashboard/leads/status` | All three roles | `getLeadsByStatus` | Groups leads by status. |
| `GET` | `/dashboard/deals/stage` | All three roles | `getDealsByStage` | Groups deals by stage. |
| `GET` | `/dashboard/leads/source` | `ADMIN`, `MANAGER` | `getLeadsBySource` | Groups leads by source. |
| `GET` | `/dashboard/sales/performance` | `ADMIN`, `MANAGER` | `getSalesPerformance` | Returns sales performance metrics. |
| `GET` | `/dashboard/revenue/period` | `ADMIN`, `MANAGER` | `getRevenueByPeriod` | Returns revenue grouped by period. |

## Activities: `/activities`

All endpoints require authentication and one of `ADMIN`, `MANAGER`, or `SALES_AGENT`.

| Method | Endpoint | Controller function | Description |
| --- | --- | --- | --- |
| `GET` | `/activities` | `getAllActivities` | Lists activities. |
| `GET` | `/activities/:entityType/:entityId` | `getEntityActivities` | Lists activities belonging to a specific entity type and entity ID. |

## Conversations and messages: `/conversations`

All endpoints require authentication. Conversation assignment is restricted to administrators and managers.

| Method | Endpoint | Roles | Controller function | Description |
| --- | --- | --- | --- | --- |
| `GET` | `/conversations` | All three roles | `getAllConversations` | Lists conversations. |
| `POST` | `/conversations` | All three roles | `createConversation` | Creates a conversation. |
| `GET` | `/conversations/:id` | All three roles | `getConversationById` | Returns one conversation by ID. |
| `PATCH` | `/conversations/:id` | All three roles | `updateConversation` | Updates conversation information. |
| `PATCH` | `/conversations/:id/assign` | `ADMIN`, `MANAGER` | `assignConversation` | Assigns a conversation to a user. |
| `PATCH` | `/conversations/:id/status` | All three roles | `changeConversationStatus` | Changes the conversation status. |
| `POST` | `/conversations/:id/messages` | All three roles | `sendMessage` | Sends a message in a conversation. |
| `GET` | `/conversations/:id/messages` | All three roles | `getConversationMessages` | Returns messages for a conversation. |

## Follow-ups: `/followups`

All endpoints require authentication and one of `ADMIN`, `MANAGER`, or `SALES_AGENT`.

| Method | Endpoint | Controller function | Description |
| --- | --- | --- | --- |
| `GET` | `/followups` | `getAllFollowUps` | Lists follow-ups. |
| `POST` | `/followups` | `createFollowUp` | Creates a follow-up. |
| `GET` | `/followups/:id` | `getFollowUpById` | Returns one follow-up by ID. |
| `PATCH` | `/followups/:id` | `updateFollowUp` | Updates follow-up information. |
| `PATCH` | `/followups/:id/complete` | `completeFollowUp` | Marks a follow-up as completed. |
| `PATCH` | `/followups/:id/cancel` | `cancelFollowUp` | Cancels a follow-up. |

## Notes: `/notes`

All endpoints require authentication and one of `ADMIN`, `MANAGER`, or `SALES_AGENT`.

| Method | Endpoint | Controller function | Description |
| --- | --- | --- | --- |
| `POST` | `/notes` | `createNote` | Creates a note. |
| `GET` | `/notes` | `getAllNotes` | Lists accessible notes. |
| `GET` | `/notes/:id` | `getNoteById` | Returns one accessible note. |
| `PATCH` | `/notes/:id` | `updateNoteById` | Updates a note. |
| `DELETE` | `/notes/:id` | `deleteNoteById` | Deletes a note. |

## Cross-entity search: `/search`

Requires authentication and one of `ADMIN`, `MANAGER`, or `SALES_AGENT`.

| Method | Endpoint | Controller function | Description |
| --- | --- | --- | --- |
| `GET` | `/search` | `search` | Searches supported CRM entities using the query parameters handled by the search controller. |

## Notifications: `/notifications`

Requires authentication and one of `ADMIN`, `MANAGER`, or `SALES_AGENT`.

| Method | Endpoint | Controller function | Description |
| --- | --- | --- | --- |
| `GET` | `/notifications` | `getNotifications` | Lists the authenticated user's notifications. |
| `PATCH` | `/notifications/read-all` | `markAllRead` | Marks all notifications as read. |
| `PATCH` | `/notifications/:id/read` | `markRead` | Marks one notification as read. |
| `DELETE` | `/notifications/:id` | `deleteNotification` | Deletes one notification. |

## Unmounted message route module

The following routes are defined in `src/routes/message.routes.js`, but the module is not included in `All_Routes.js`. They are not active unless the module is mounted separately.

| Method | Relative endpoint | Controller function | Description |
| --- | --- | --- | --- |
| `POST` | `/` | `sendMessage` | Sends a message. |
| `GET` | `/conversation/:conversationId` | `getConversationMessages` | Lists messages for a conversation. |
| `GET` | `/:id` | `getMessageById` | Returns one message by ID. |
| `PATCH` | `/:id/status` | `updateMessageStatus` | Updates a message status. |
