import { AppTimestamp } from './timestamp';

export type GroupType = 'personal' | 'household' | 'trip' | 'other' | 'custom';
export type SplitType = 'equal' | 'percentage' | 'exact';
export type MemberRole = 'admin' | 'member';
export type BudgetType = 'weekly' | 'monthly' | 'total';

export interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  createdAt: AppTimestamp;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  createdBy: string;
  createdAt: AppTimestamp;
  type: GroupType;
  memberIds: string[];
  maxBudget?: number;
  budgetType?: BudgetType;
  themeColor?: string;
  /** Display currency for this group's amounts; null/undefined = the viewer's preferred currency. */
  currency?: 'BRL' | 'USD' | 'EUR' | 'GBP' | null;
}

export interface GroupMember {
  uid: string;
  role: MemberRole;
  joinedAt: AppTimestamp;
  displayName?: string;
  email?: string;
}

export interface Expense {
  id: string;
  amount: number;
  description: string;
  category: string;
  paidBy: string; // userId
  date: AppTimestamp;
  dueDate?: AppTimestamp;
  status?: 'paid' | 'pending';
  createdAt: AppTimestamp;
  splitType: SplitType;
  splitDetails?: Record<string, number>;
  isRecurring?: boolean;
  recurrenceId?: string;
}

/** A settle-up payment: `fromUser` paid `toUser` `amount` in the group's currency. */
export interface Settlement {
  id: string;
  groupId: string;
  fromUser: string;
  toUser: string;
  amount: number;
  date: AppTimestamp;
  note?: string | null;
  createdBy: string;
  createdAt: AppTimestamp;
}

export const CATEGORIES = [
  'Food',
  'Rent',
  'Utilities',
  'Transport',
  'Entertainment',
  'Shopping',
  'Health',
  'Travel',
  'Other'
];
