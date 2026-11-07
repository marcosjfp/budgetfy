import { z } from 'zod';

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/** Positive, finite money amount. Accepts numbers or numeric strings (legacy clients). */
export const amountSchema = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() !== '' ? Number(v) : v),
  z.number({ error: 'Amount must be a number' })
    .finite('Amount must be finite')
    .positive('Amount must be greater than zero')
    .max(1_000_000_000, 'Amount is too large'),
);

const MIN_DATE = Date.UTC(1900, 0, 1);
const MAX_DATE = Date.UTC(2200, 0, 1);

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * ISO-8601 string, "YYYY-MM-DD" or epoch millis -> Date, bounded to a sane range.
 * Calendar dates ("YYYY-MM-DD") are stored at 12:00 UTC, which falls on the same day in every
 * timezone from UTC-11 to UTC+11 (midnight UTC shows as the previous day in Brazil).
 */
export const dateSchema = z
  .union([z.string().trim().min(1).max(64), z.number().finite()])
  .transform((v, ctx) => {
    const m = typeof v === 'string' ? DATE_ONLY.exec(v) : null;
    const d = m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12)) : new Date(v);
    const t = d.getTime();
    if (Number.isNaN(t) || t < MIN_DATE || t > MAX_DATE) {
      ctx.addIssue({ code: 'custom', message: 'Invalid date' });
      return z.NEVER;
    }
    return d;
  });

export const uuidSchema = z.uuid('Invalid id');
/** Firebase UIDs (<=128 chars) or our own UUIDs. */
export const uidSchema = z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/, 'Invalid user id');
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email('Invalid email').max(254));

const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{3,8}$/, 'Invalid color');
const httpsUrlSchema = z
  .url({ protocol: /^https$/, error: 'Must be an https URL' })
  .max(2048);

// ---------------------------------------------------------------------------
// Enums (mirror src/types.ts)
// ---------------------------------------------------------------------------
export const groupTypeSchema = z.enum(['personal', 'household', 'trip', 'other', 'custom']);
export const budgetTypeSchema = z.enum(['weekly', 'monthly', 'total']);
export const memberRoleSchema = z.enum(['admin', 'member']);
export const splitTypeSchema = z.enum(['equal', 'percentage', 'exact']);
export const expenseStatusSchema = z.enum(['paid', 'pending']);
/** Mirrors SUPPORTED_CURRENCIES in src/i18n/core.ts. */
export const currencySchema = z.enum(['BRL', 'USD', 'EUR', 'GBP']);
export const languageSchema = z.enum(['en', 'pt']);
export const themeSchema = z.enum(['light', 'dark']);

// ---------------------------------------------------------------------------
// Params
// ---------------------------------------------------------------------------
export const groupParamsSchema = z.object({ id: uuidSchema });
export const expenseParamsSchema = z.object({ id: uuidSchema, expId: uuidSchema });
export const memberParamsSchema = z.object({ id: uuidSchema, uid: uidSchema });
export const settlementParamsSchema = z.object({ id: uuidSchema, settlementId: uuidSchema });

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  // bcrypt only uses the first 72 bytes; reject longer input instead of silently truncating.
  .refine((p) => Buffer.byteLength(p, 'utf8') <= 72, 'Password must be at most 72 bytes')
  .refine((p) => /[A-Za-z]/.test(p) && /[0-9]/.test(p), 'Password must contain at least one letter and one number');

export const displayNameSchema = z.string().trim().min(1, 'Display name is required').max(100);

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: displayNameSchema,
  /** Language for the verification email. */
  lang: z.enum(['en', 'pt']).optional(),
});

const emailTokenSchema = z.string().trim().min(20).max(200);
export const verifyEmailSchema = z.object({ token: emailTokenSchema });
export const resendVerificationSchema = z.object({ lang: z.enum(['en', 'pt']).optional() });
export const forgotPasswordSchema = z.object({ email: emailSchema, lang: z.enum(['en', 'pt']).optional() });
export const resetPasswordSchema = z.object({ token: emailTokenSchema, password: passwordSchema });

export const firebaseLoginSchema = z.object({
  idToken: z.string().min(1).max(4096),
});

export const loginSchema = z.object({
  email: emailSchema,
  // Don't apply the policy on login (legacy accounts); just bound the size.
  password: z.string().min(1).max(1024),
});

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
export const syncUserSchema = z.object({
  displayName: z.string().trim().max(100).nullish(),
  photoURL: httpsUrlSchema.nullish(),
  // `email` from the body is ignored: the verified token is the source of truth.
});

export const userSearchQuerySchema = z.object({ email: emailSchema });

export const preferencesSchema = z
  .object({
    language: languageSchema.optional(),
    currency: currencySchema.optional(),
    theme: themeSchema.optional(),
  })
  .strict();

/** PATCH /api/users/me — every field optional; at least one required. */
export const updateProfileSchema = z
  .object({
    displayName: displayNameSchema.optional(),
    preferences: preferencesSchema.optional(),
  })
  .strict()
  .refine((b) => b.displayName !== undefined || b.preferences !== undefined, 'No fields to update');

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------
const maxBudgetSchema = amountSchema.nullish();

export const createGroupSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  description: z.string().trim().max(500).nullish(),
  type: groupTypeSchema.optional(),
  themeColor: hexColorSchema.nullish(),
  maxBudget: maxBudgetSchema,
  budgetType: budgetTypeSchema.nullish(),
  currency: currencySchema.nullish(),
});

export const updateGroupSchema = z.object({
  name: z.string().trim().max(100).nullish(),
  description: z.string().trim().max(500).nullish(),
  themeColor: hexColorSchema.nullish(),
  maxBudget: maxBudgetSchema,
  budgetType: budgetTypeSchema.nullish(),
  /** Omitted/null keeps the current currency. */
  currency: currencySchema.nullish(),
});

export const addMemberSchema = z.object({ email: emailSchema });
export const updateMemberRoleSchema = z.object({ role: memberRoleSchema });

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------
const splitDetailsSchema = z
  .record(uidSchema, z.number().finite().min(0).max(1_000_000_000))
  .refine((r) => Object.keys(r).length <= 200, 'Too many split entries');

const descriptionSchema = z.string().trim().min(1, 'Description is required').max(200);
const categorySchema = z.string().trim().min(1).max(50);
const recurrenceIdSchema = z.string().trim().min(1).max(128);

export const createExpenseSchema = z.object({
  amount: amountSchema,
  description: descriptionSchema,
  category: categorySchema.optional(),
  paidBy: uidSchema.optional(),
  date: dateSchema,
  dueDate: dateSchema.nullish(),
  status: expenseStatusSchema.optional(),
  splitType: splitTypeSchema.optional(),
  splitDetails: splitDetailsSchema.nullish(),
  isRecurring: z.boolean().optional(),
  recurrenceId: recurrenceIdSchema.nullish(),
});

/** Single expense or an array (recurring series); the UI caps series at 50. */
export const createExpensesBodySchema = z.union([
  createExpenseSchema,
  z.array(createExpenseSchema).min(1).max(100),
]);

export const recurrenceFrequencySchema = z.enum(['daily', 'weekly', 'monthly', 'yearly']);

/** POST /expenses/series: one expense + a repeat rule; the server creates every occurrence. */
export const createSeriesSchema = z
  .object({
    expense: createExpenseSchema.omit({ isRecurring: true, recurrenceId: true }),
    recurrence: z.object({ frequency: recurrenceFrequencySchema, endDate: dateSchema }),
  })
  .refine((b) => b.recurrence.endDate.getTime() >= b.expense.date.getTime(), {
    message: 'The end date must be on or after the start date',
    path: ['recurrence', 'endDate'],
  });

export const updateExpenseSchema = z.object({
  amount: amountSchema.optional(),
  description: descriptionSchema.optional(),
  category: categorySchema.optional(),
  date: dateSchema.optional(),
  dueDate: dateSchema.nullish(),
  status: expenseStatusSchema.optional(),
  splitType: splitTypeSchema.optional(),
  splitDetails: splitDetailsSchema.nullish(),
});

export const bulkUpdateSchema = z.object({
  recurrenceId: recurrenceIdSchema,
  fromDate: dateSchema.nullish(),
  updates: z
    .object({
      amount: amountSchema.optional(),
      description: descriptionSchema.optional(),
      category: categorySchema.optional(),
      status: expenseStatusSchema.optional(),
      splitType: splitTypeSchema.optional(),
      splitDetails: splitDetailsSchema.nullish(),
    })
    .refine((u) => Object.values(u).some((v) => v !== undefined), 'No fields to update'),
});

export const bulkDeleteSchema = z.object({
  recurrenceId: recurrenceIdSchema,
  fromDate: dateSchema.nullish(),
});

// ---------------------------------------------------------------------------
// Settlements
// ---------------------------------------------------------------------------
export const createSettlementSchema = z
  .object({
    fromUser: uidSchema,
    toUser: uidSchema,
    amount: amountSchema,
    date: dateSchema.optional(),
    note: z.string().trim().max(200).nullish(),
  })
  .refine((s) => s.fromUser !== s.toUser, { message: 'Payer and recipient must differ', path: ['toUser'] });
