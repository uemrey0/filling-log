import {
  pgTable,
  uuid,
  varchar,
  integer,
  boolean,
  real,
  text,
  timestamp,
  date,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

export const personnel = pgTable(
  'personnel',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    fullName: varchar('full_name', { length: 255 }).notNull(),
    isActive: boolean('is_active').notNull().default(true),
    notes: text('notes'),
    ratingCount: integer('rating_count').notNull().default(0),
    avgWorkEthic: real('avg_work_ethic'),
    avgQuality: real('avg_quality'),
    avgTeamwork: real('avg_teamwork'),
    avgOverall: real('avg_overall'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('personnel_is_active_idx').on(table.isActive)],
)

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    department: varchar('department', { length: 50 }).notNull(),
    discountContainer: boolean('discount_container').notNull().default(false),
    colliCount: integer('colli_count').notNull(),
    expectedMinutes: integer('expected_minutes').notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('tasks_department_idx').on(table.department)],
)

export const taskSessions = pgTable(
  'task_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    personnelId: uuid('personnel_id')
      .notNull()
      .references(() => personnel.id, { onDelete: 'restrict' }),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    isPaused: boolean('is_paused').notNull().default(false),
    pausedSince: timestamp('paused_since', { withTimezone: true }),
    totalPausedMinutes: real('total_paused_minutes').notNull().default(0),
    workDate: date('work_date').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('sessions_personnel_idx').on(table.personnelId),
    index('sessions_task_idx').on(table.taskId),
    index('sessions_work_date_idx').on(table.workDate),
    index('sessions_ended_at_idx').on(table.endedAt),
    index('sessions_is_paused_idx').on(table.isPaused),
  ],
)

export const personnelComments = pgTable(
  'personnel_comments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    personnelId: uuid('personnel_id')
      .notNull()
      .references(() => personnel.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('comments_personnel_idx').on(table.personnelId)],
)

export const personnelRatings = pgTable(
  'personnel_ratings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    personnelId: uuid('personnel_id')
      .notNull()
      .references(() => personnel.id, { onDelete: 'cascade' }),
    taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'set null' }),
    workEthicScore: integer('work_ethic_score').notNull(),
    qualityScore: integer('quality_score').notNull(),
    teamworkScore: integer('teamwork_score').notNull(),
    comment: text('comment'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('ratings_personnel_idx').on(table.personnelId)],
)

export const personnelDailyStats = pgTable(
  'personnel_daily_stats',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    personnelId: uuid('personnel_id').notNull().references(() => personnel.id, { onDelete: 'cascade' }),
    workDate: date('work_date').notNull(),
    sessionCount: integer('session_count').notNull().default(0),
    actualMinutesSum: real('actual_minutes_sum').notNull().default(0),
    expectedMinutesSum: real('expected_minutes_sum').notNull().default(0),
    diffMinutesSum: real('diff_minutes_sum').notNull().default(0),
    actualPerColliSum: real('actual_per_colli_sum').notNull().default(0),
    actualPerColliCount: integer('actual_per_colli_count').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('personnel_daily_stats_unique').on(table.personnelId, table.workDate),
    index('personnel_daily_stats_date_idx').on(table.workDate),
  ],
)

export const departmentDailyStats = pgTable(
  'department_daily_stats',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workDate: date('work_date').notNull(),
    department: varchar('department', { length: 50 }).notNull(),
    sessionCount: integer('session_count').notNull().default(0),
    actualMinutesSum: real('actual_minutes_sum').notNull().default(0),
    expectedMinutesSum: real('expected_minutes_sum').notNull().default(0),
    diffMinutesSum: real('diff_minutes_sum').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('department_daily_stats_unique').on(table.workDate, table.department),
    index('department_daily_stats_date_idx').on(table.workDate),
    index('department_daily_stats_dept_idx').on(table.department),
  ],
)

export const personnelDepartmentDailyStats = pgTable(
  'personnel_department_daily_stats',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    personnelId: uuid('personnel_id').notNull().references(() => personnel.id, { onDelete: 'cascade' }),
    workDate: date('work_date').notNull(),
    department: varchar('department', { length: 50 }).notNull(),
    sessionCount: integer('session_count').notNull().default(0),
    actualMinutesSum: real('actual_minutes_sum').notNull().default(0),
    expectedMinutesSum: real('expected_minutes_sum').notNull().default(0),
    diffMinutesSum: real('diff_minutes_sum').notNull().default(0),
    actualPerColliSum: real('actual_per_colli_sum').notNull().default(0),
    actualPerColliCount: integer('actual_per_colli_count').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('personnel_department_daily_stats_unique').on(
      table.personnelId,
      table.workDate,
      table.department,
    ),
    index('personnel_department_daily_stats_personnel_idx').on(table.personnelId),
    index('personnel_department_daily_stats_date_idx').on(table.workDate),
    index('personnel_department_daily_stats_dept_idx').on(table.department),
  ],
)

export const authUsers = pgTable(
  'auth_user',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    emailVerified: boolean('email_verified').notNull().default(false),
    image: text('image'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    username: text('username'),
    displayUsername: text('display_username'),
    role: text('role').notNull().default('user'),
    banned: boolean('banned').notNull().default(false),
    banReason: text('ban_reason'),
    banExpires: timestamp('ban_expires', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('auth_user_email_idx').on(table.email),
    uniqueIndex('auth_user_username_idx').on(table.username),
    index('auth_user_role_idx').on(table.role),
  ],
)

export const authSessions = pgTable(
  'auth_session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    token: text('token').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    impersonatedBy: text('impersonated_by'),
  },
  (table) => [
    uniqueIndex('auth_session_token_idx').on(table.token),
    index('auth_session_user_id_idx').on(table.userId),
  ],
)

export const authAccounts = pgTable(
  'auth_account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('auth_account_user_id_idx').on(table.userId),
    uniqueIndex('auth_account_provider_account_idx').on(table.providerId, table.accountId),
  ],
)

export const authVerifications = pgTable(
  'auth_verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('auth_verification_identifier_idx').on(table.identifier)],
)

export const personnelRelations = relations(personnel, ({ many }) => ({
  sessions: many(taskSessions),
  comments: many(personnelComments),
  ratings: many(personnelRatings),
}))

export const tasksRelations = relations(tasks, ({ many }) => ({
  sessions: many(taskSessions),
}))

export const taskSessionsRelations = relations(taskSessions, ({ one }) => ({
  task: one(tasks, { fields: [taskSessions.taskId], references: [tasks.id] }),
  personnel: one(personnel, {
    fields: [taskSessions.personnelId],
    references: [personnel.id],
  }),
}))

export const personnelCommentsRelations = relations(personnelComments, ({ one }) => ({
  personnel: one(personnel, { fields: [personnelComments.personnelId], references: [personnel.id] }),
}))

export const personnelRatingsRelations = relations(personnelRatings, ({ one }) => ({
  personnel: one(personnel, { fields: [personnelRatings.personnelId], references: [personnel.id] }),
  task: one(tasks, { fields: [personnelRatings.taskId], references: [tasks.id] }),
}))

export type Personnel = typeof personnel.$inferSelect
export type NewPersonnel = typeof personnel.$inferInsert
export type Task = typeof tasks.$inferSelect
export type NewTask = typeof tasks.$inferInsert
export type TaskSession = typeof taskSessions.$inferSelect
export type NewTaskSession = typeof taskSessions.$inferInsert
export type PersonnelComment = typeof personnelComments.$inferSelect
export type NewPersonnelComment = typeof personnelComments.$inferInsert
export type PersonnelRating = typeof personnelRatings.$inferSelect
export type NewPersonnelRating = typeof personnelRatings.$inferInsert
export type PersonnelDailyStat = typeof personnelDailyStats.$inferSelect
export type DepartmentDailyStat = typeof departmentDailyStats.$inferSelect
export type PersonnelDepartmentDailyStat = typeof personnelDepartmentDailyStats.$inferSelect
export type AuthUser = typeof authUsers.$inferSelect
export type NewAuthUser = typeof authUsers.$inferInsert
