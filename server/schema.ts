import { pgTable, text, uuid, numeric, timestamp, jsonb, boolean } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  uid: text('uid').primaryKey(),
  displayName: text('display_name'),
  email: text('email').unique(),
  passwordHash: text('password_hash'),
  /** Firebase (Google) account linked to this user, if any. */
  firebaseUid: text('firebase_uid').unique(),
  photoURL: text('photo_url'),
  /** UI preferences synced across devices: { language?, currency?, theme? }. */
  preferences: jsonb('preferences').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const groups = pgTable('groups', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  description: text('description').default(''),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  type: text('type').notNull().default('other'),
  maxBudget: numeric('max_budget'),
  budgetType: text('budget_type').default('total'),
  themeColor: text('theme_color'),
  /**
   * ISO 4217 code (BRL/USD/EUR/GBP) used to display this group's amounts.
   * NULL for groups created before per-group currencies existed: the client then falls back
   * to the viewer's preferred currency (the previous behaviour).
   */
  currency: text('currency'),
});

export const groupMembers = pgTable('group_members', {
  id: uuid('id').defaultRandom().primaryKey(),
  groupId: uuid('group_id').notNull(),
  userId: text('user_id').notNull(),
  role: text('role').notNull().default('member'),
  joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow(),
  displayName: text('display_name'),
  email: text('email'),
});

export const expenses = pgTable('expenses', {
  id: uuid('id').defaultRandom().primaryKey(),
  groupId: uuid('group_id').notNull(),
  amount: numeric('amount').notNull(),
  description: text('description').notNull(),
  category: text('category').notNull().default('Other'),
  paidBy: text('paid_by').notNull(),
  date: timestamp('date', { withTimezone: true }).notNull(),
  dueDate: timestamp('due_date', { withTimezone: true }),
  status: text('status').default('paid'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  splitType: text('split_type').notNull().default('equal'),
  splitDetails: jsonb('split_details').default({}),
  isRecurring: boolean('is_recurring').default(false),
  recurrenceId: text('recurrence_id'),
});

/**
 * Settle-up payments: `fromUser` paid `toUser` `amount` (in the group's currency) outside the app.
 * Balances are derived from expenses (+ who paid / splitDetails) plus these records.
 */
export const settlements = pgTable('settlements', {
  id: uuid('id').defaultRandom().primaryKey(),
  groupId: uuid('group_id').notNull(),
  fromUser: text('from_user').notNull(),
  toUser: text('to_user').notNull(),
  amount: numeric('amount').notNull(),
  date: timestamp('date', { withTimezone: true }).notNull().defaultNow(),
  note: text('note'),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
