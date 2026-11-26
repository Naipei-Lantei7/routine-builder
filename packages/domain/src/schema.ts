import { z } from 'zod'

/** ISO weekday: 1 = Monday ... 7 = Sunday. */
export const WeekdaySchema = z.number().int().min(1).max(7)

/** Wall-clock local time, "HH:mm" in 24-hour format. Not a timestamp. */
export const TimeOfDaySchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected a time in HH:mm format')

/** Local calendar date, "YYYY-MM-DD". */
export const DateKeySchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, 'Expected a date in YYYY-MM-DD format')

const MINUTES_PER_DAY = 24 * 60

export const ActivitySchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(1).max(100),
  time: TimeOfDaySchema,
  durationMinutes: z.number().int().positive().max(MINUTES_PER_DAY).optional(),
  notes: z.string().max(500).optional(),
  /** Minutes before `time` to remind the user. `null` means no reminder. */
  reminderMinutesBefore: z.number().int().min(0).max(MINUTES_PER_DAY).nullable(),
})

export const RoutineSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(60),
  days: z
    .array(WeekdaySchema)
    .min(1)
    .refine((days) => new Set(days).size === days.length, 'Days must not repeat'),
  activities: z.array(ActivitySchema),
  enabled: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

/** One record per activity per local day it was completed. */
export const CompletionSchema = z.object({
  routineId: z.uuid(),
  activityId: z.uuid(),
  date: DateKeySchema,
  completedAt: z.iso.datetime(),
})

export const CURRENT_VERSION = 1

export const AppStateSchema = z.object({
  version: z.literal(CURRENT_VERSION),
  routines: z.array(RoutineSchema),
  completions: z.array(CompletionSchema),
  /** Keys of reminders already shown: `${routineId}:${activityId}:${date}`. */
  firedReminders: z.array(z.string()),
})

export type Weekday = z.infer<typeof WeekdaySchema>
export type TimeOfDay = z.infer<typeof TimeOfDaySchema>
export type DateKey = z.infer<typeof DateKeySchema>
export type Activity = z.infer<typeof ActivitySchema>
export type Routine = z.infer<typeof RoutineSchema>
export type Completion = z.infer<typeof CompletionSchema>
export type AppState = z.infer<typeof AppStateSchema>

export function createEmptyState(): AppState {
  return { version: CURRENT_VERSION, routines: [], completions: [], firedReminders: [] }
}
