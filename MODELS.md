# CRM Model Schemas

This document describes the Mongoose schemas in [`src/models`](E:/Node_try/CRM/src/models).
Unless noted otherwise, schemas use MongoDB `ObjectId` values for identifiers and
Mongoose timestamps.

## Common conventions

- `timestamps: true` adds `createdAt` and `updatedAt`.
- `versionKey: false` disables Mongoose's `__v` field. `Activity` does not disable it.
- A `ref` documents the intended Mongoose population relationship; it does not by
  itself enforce that the referenced document exists.
- `unique` creates a MongoDB unique index. It is not a replacement for application
  validation and requires the index to be present in the database.
- Fields without `required` are optional unless a default is specified.

## User

Source: [`User.model.js`](E:/Node_try/CRM/src/models/User.model.js)

| Field | Type | Rules and defaults |
| --- | --- | --- |
| `name` | String | Required; trimmed |
| `email` | String | Required; unique; lowercased and trimmed; must match `^\S+@\S+\.\S+$` |
| `password` | String | Required; minimum 8 characters; excluded from query results by default (`select: false`) |
| `passwordConfirm` | String | Required; must equal `password` during validation |
| `phone` | String | Required; unique; trimmed |
| `role` | String | Required; one of `ADMIN`, `MANAGER`, `SALES_AGENT` |
| `avatar` | String | Defaults to `null` |
| `status` | String | One of `ACTIVE`, `INACTIVE`; defaults to `ACTIVE` |

The save hook hashes a modified password with bcrypt (12 rounds), then removes
`passwordConfirm` before persistence. The schema uses timestamps and disables `__v`.

## Customer

Source: [`Customer.model.js`](E:/Node_try/CRM/src/models/Customer.model.js)

| Field | Type | Rules and defaults |
| --- | --- | --- |
| `name` | String | Required; trimmed |
| `phone` | String | Required; unique; trimmed |
| `email` | String | Optional; lowercased and trimmed; must match `^\S+@\S+\.\S+$` when supplied |
| `avatar` | String | Defaults to `null` |
| `tags` | String array | Defaults to `[]` |
| `source` | String | Optional; trimmed |
| `notes` | String | Optional; trimmed |
| `assignedTo` | ObjectId | Optional reference to `User` |

Indexes: `name`, `email`, and the compound index `assignedTo + name`.
The schema uses timestamps and disables `__v`.

## Lead

Source: [`Lead.model.js`](E:/Node_try/CRM/src/models/Lead.model.js)

| Field | Type | Rules and defaults |
| --- | --- | --- |
| `customerId` | ObjectId | Required reference to `Customer` |
| `title` | String | Required; trimmed |
| `product` | String | Optional; trimmed |
| `budget` | Number | Optional; minimum `0` |
| `source` | String | Optional; trimmed |
| `status` | String | One of `NEW`, `CONTACTED`, `INTERESTED`, `NEGOTIATION`, `WON`, `LOST`; defaults to `NEW` |
| `lostReason` | String | Optional; one of `TOO_EXPENSIVE`, `BOUGHT_FROM_COMPETITOR`, `NOT_INTERESTED`, `DELAYED`, `OTHER` |
| `assignedTo` | ObjectId | Optional reference to `User` |
| `expectedCloseDate` | Date | Optional |

Indexes: `title`, `product`, `assignedTo + title`, and `customerId + createdAt`
(descending on `createdAt`).

Use `transitionTo(newStatus, { reason })` to change status. Allowed transitions
are:

```text
NEW -> CONTACTED
CONTACTED -> INTERESTED
INTERESTED -> NEGOTIATION | LOST
NEGOTIATION -> WON | LOST
WON and LOST -> no further transitions
```

Transitioning to `LOST` requires a reason and stores it in `lostReason`;
transitions to other statuses clear `lostReason`. The schema uses timestamps and
disables `__v`.

## Deal

Source: [`Deal.model.js`](E:/Node_try/CRM/src/models/Deal.model.js)

| Field | Type | Rules and defaults |
| --- | --- | --- |
| `customerId` | ObjectId | Required reference to `Customer` |
| `leadId` | ObjectId | Required reference to `Lead` |
| `title` | String | Required; trimmed |
| `value` | Number | Required; minimum `0` |
| `currency` | String | Trimmed and uppercased; defaults to `EGP` |
| `assignedTo` | ObjectId | Optional reference to `User` |
| `stage` | String | One of `NEGOTIATION`, `WON`, `LOST`; uppercased; defaults to `NEGOTIATION` |
| `lostReason` | String | Optional; one of `TOO_EXPENSIVE`, `BOUGHT_FROM_COMPETITOR`, `NOT_INTERESTED`, `DELAYED`, `OTHER` |
| `expectedCloseDate` | Date | Optional |
| `actualCloseDate` | Date | Defaults to `null` |
| `notes` | String | Optional; trimmed; defaults to `null` |

Indexes: `customerId + createdAt`, `leadId`, `assignedTo + stage`,
`stage + createdAt`, descending `value`, `title`, and `assignedTo + title`.

Use `transitionTo(newStage, { reason })` to change stage. Only
`NEGOTIATION -> WON|LOST` is allowed; `WON` and `LOST` are terminal. A `LOST`
transition requires a reason, sets `actualCloseDate`, and stores `lostReason`.
Other transitions clear `lostReason`. The `isClosed` virtual is true for `WON`
or `LOST`. The schema uses timestamps and disables `__v`.

## Conversation

Source: [`Conversation.model.js`](E:/Node_try/CRM/src/models/Conversation.model.js)

| Field | Type | Rules and defaults |
| --- | --- | --- |
| `customerId` | ObjectId | Required reference to `Customer` |
| `leadId` | ObjectId | Optional reference to `Lead`; defaults to `null` |
| `assignedTo` | ObjectId | Optional reference to `User`; defaults to `null` |
| `status` | String | One of `OPEN`, `CLOSED`, `ARCHIVED`; defaults to `OPEN` |
| `lastMessage` | ObjectId | Optional reference to `Message`; defaults to `null` |
| `lastMessageAt` | Date | Defaults to `null` |
| `unreadCount` | Number | Defaults to `0`; minimum `0` |

Indexes: `assignedTo + status + updatedAt` (descending `updatedAt`) and
`customerId + updatedAt` (descending `updatedAt`). The schema uses timestamps
and disables `__v`.

## Message

Source: [`Message.model.js`](E:/Node_try/CRM/src/models/Message.model.js)

| Field | Type | Rules and defaults |
| --- | --- | --- |
| `conversationId` | ObjectId | Required reference to `Conversation` |
| `senderId` | ObjectId | Required reference to `User` |
| `content` | String | Required; trimmed |
| `type` | String | One of `TEXT`, `IMAGE`, `FILE`, `AUDIO`, `VIDEO`, `SYSTEM`; uppercased; defaults to `TEXT` |
| `direction` | String | One of `INBOUND`, `OUTBOUND`; defaults to `OUTBOUND` |
| `attachments` | String array | Defaults to `[]` |
| `replyTo` | ObjectId | Optional self-reference to `Message`; defaults to `null` |
| `status` | String | One of `SENT`, `DELIVERED`, `READ`; defaults to `SENT` |

Indexes: `conversationId + createdAt`, `senderId + createdAt`,
`replyTo`, and a text index on `content`.

`markAs(newStatus)` permits only forward status movement:
`SENT -> DELIVERED -> READ`. Backward transitions and invalid statuses throw.
The schema uses timestamps and disables `__v`.

## FollowUp

Source: [`FollowUp.model.js`](E:/Node_try/CRM/src/models/FollowUp.model.js)

| Field | Type | Rules and defaults |
| --- | --- | --- |
| `customerId` | ObjectId | Required reference to `Customer` |
| `leadId` | ObjectId | Optional reference to `Lead`; defaults to `null` |
| `assignedTo` | ObjectId | Required reference to `User` |
| `createdBy` | ObjectId | Required reference to `User` |
| `title` | String | Required; trimmed |
| `description` | String | Optional; trimmed; defaults to `null` |
| `type` | String | One of `CALL`, `MEETING`, `EMAIL`, `TASK`, `OTHER`; uppercased; defaults to `TASK` |
| `dueDate` | Date | Required |
| `status` | String | One of `PENDING`, `COMPLETED`, `CANCELLED`, `OVERDUE`; uppercased; defaults to `PENDING` |
| `result` | String | Optional; trimmed; defaults to `null` |
| `completedAt` | Date | Defaults to `null` |

Indexes support assignment/due-date, customer/due-date, lead, status/due-date,
and creator/creation-time queries.

Behavior methods:

- `checkOverdue()` changes `PENDING` to `OVERDUE` when `dueDate` is in the past.
- `complete(result)` accepts only `PENDING` or `OVERDUE`, sets `COMPLETED`, stores
  the result, and sets `completedAt`.
- `cancel(reason)` cannot cancel a completed follow-up and stores the reason in `result`.
- `reopen()` accepts only `COMPLETED` or `CANCELLED`, restoring `PENDING` and clearing completion data.

The `isOverdue` virtual is true when status is `PENDING` and the due date has
passed. Virtuals are included in JSON and object output. The schema uses
timestamps and disables `__v`.

## Note

Source: [`Note.model.js`](E:/Node_try/CRM/src/models/Note.model.js)

| Field | Type | Rules and defaults |
| --- | --- | --- |
| `customerId` | ObjectId | Optional reference to `Customer`; defaults to `null` |
| `leadId` | ObjectId | Optional reference to `Lead`; defaults to `null` |
| `content` | String | Required; trimmed |
| `createdBy` | ObjectId | Required reference to `User` |

Cross-field validation requires exactly one owner: a note must have either
`customerId` or `leadId`, but never both.

Indexes: `customerId + createdAt`, `leadId + createdAt`, and
`createdBy + createdAt`, all with descending `createdAt`. The schema uses
timestamps and disables `__v`.

## Notification

Source: [`Notification.model.js`](E:/Node_try/CRM/src/models/Notification.model.js)

| Field | Type | Rules and defaults |
| --- | --- | --- |
| `userId` | ObjectId | Required reference to `User` |
| `type` | String | Required; one of `NEW_MESSAGE`, `CONVERSATION_ASSIGNED`, `LEAD_ASSIGNED`, `FOLLOWUP_ASSIGNED`, `FOLLOWUP_DUE`, `FOLLOWUP_OVERDUE`, `DEAL_UPDATED`, `DEAL_WON`, `NOTE_MENTION` |
| `title` | String | Required; trimmed |
| `message` | String | Required; trimmed |
| `entityType` | String | Required |
| `entityId` | ObjectId | Required |
| `read` | Boolean | Defaults to `false` |

Indexes: `userId + read + createdAt` and `userId + createdAt`, both optimized
for recent notification queries. The schema uses timestamps and disables `__v`.

## Activity

Source: [`Activity.model.js`](E:/Node_try/CRM/src/models/Activity.model.js)

| Field | Type | Rules and defaults |
| --- | --- | --- |
| `actorId` | ObjectId | Required reference to `User` |
| `action` | String | Required; one of `LEAD_CREATED`, `LEAD_ASSIGNED`, `STATUS_CHANGED`, `CONVERSATION_ASSIGNED`, `MESSAGE_SENT`, `FOLLOWUP_CREATED`, `FOLLOWUP_COMPLETED`, `NOTE_CREATED`, `DEAL_CREATED`, `DEAL_WON`, `DEAL_LOST` |
| `entityType` | String | Required; one of `LEAD`, `CUSTOMER`, `CONVERSATION`, `MESSAGE`, `FOLLOWUP`, `NOTE`, `DEAL` |
| `entityId` | ObjectId | Required identifier of the affected entity |
| `metadata` | Mixed | Defaults to `{}`; accepts arbitrary additional data |

Indexes: `entityType + entityId + createdAt` and `actorId + createdAt`, both
with descending `createdAt`.

Only `createdAt` is timestamp-managed (`updatedAt` is disabled). Unlike the
other models, this schema retains Mongoose's default `__v` version key.
