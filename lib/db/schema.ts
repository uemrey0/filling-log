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
