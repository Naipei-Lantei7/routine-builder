import { RoutineSchema, type Routine, type Weekday } from './schema'
import { toMinutes } from './time'

/**
 * Form-friendly version of an activity. Numeric fields are strings so an
 * input can be temporarily empty or invalid while the user types.
 */
export interface ActivityDraft {
  id: string
  title: string
  time: string
  /** Minutes, or "" for no duration. */
  duration: string
  notes: string
  /** Minutes before, or "none". */
  reminder: string
}

export interface RoutineDraft {
  /** Undefined until the routine is saved for the first time. */
  id?: string
  name: string
  days: Weekday[]
  enabled: boolean
  activities: ActivityDraft[]
  createdAt?: string
}

export const NO_REMINDER = 'none'
export const DEFAULT_REMINDER = '5'
export const DEFAULT_ACTIVITY_TIME = '08:00'

export function createEmptyDraft(): RoutineDraft {
  return { name: '', days: [1, 2, 3, 4, 5, 6, 7], enabled: true, activities: [] }
}

export function toDraft(routine: Routine): RoutineDraft {
  return {
    id: routine.id,
    name: routine.name,
    days: [...routine.days],
    enabled: routine.enabled,
    createdAt: routine.createdAt,
    activities: routine.activities.map((activity) => ({
      id: activity.id,
      title: activity.title,
      time: activity.time,
      duration: activity.durationMinutes === undefined ? '' : String(activity.durationMinutes),
      notes: activity.notes ?? '',
      reminder:
        activity.reminderMinutesBefore === null
          ? NO_REMINDER
          : String(activity.reminderMinutesBefore),
    })),
  }
}

export function toggleDay(draft: RoutineDraft, day: Weekday): RoutineDraft {
  const days = draft.days.includes(day)
    ? draft.days.filter((d) => d !== day)
    : [...draft.days, day].sort((a, b) => a - b)
  return { ...draft, days }
}

/** Appends a blank activity, starting at the same time as the last one. */
export function addActivity(draft: RoutineDraft, id: string): RoutineDraft {
  const last = draft.activities.at(-1)
  const activity: ActivityDraft = {
    id,
    title: '',
    time: last?.time ?? DEFAULT_ACTIVITY_TIME,
    duration: '',
    notes: '',
    reminder: DEFAULT_REMINDER,
  }
  return { ...draft, activities: [...draft.activities, activity] }
}

export function updateActivity(
  draft: RoutineDraft,
  id: string,
  changes: Partial<Omit<ActivityDraft, 'id'>>,
): RoutineDraft {
  return {
    ...draft,
    activities: draft.activities.map((a) => (a.id === id ? { ...a, ...changes } : a)),
  }
}

export function removeActivity(draft: RoutineDraft, id: string): RoutineDraft {
  return { ...draft, activities: draft.activities.filter((a) => a.id !== id) }
}

/** Moves an activity one place up (-1) or down (+1). No-op at the ends. */
export function moveActivity(draft: RoutineDraft, id: string, direction: -1 | 1): RoutineDraft {
  const from = draft.activities.findIndex((a) => a.id === id)
  const to = from + direction
  if (from === -1 || to < 0 || to >= draft.activities.length) return draft
  const activities = [...draft.activities]
  ;[activities[from], activities[to]] = [activities[to], activities[from]]
  return { ...draft, activities }
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

/**
 * Sorts activities by time. Stable, so activities at the same time keep
 * their order. Activities with an invalid time go last.
 */
export function sortActivitiesByTime(draft: RoutineDraft): RoutineDraft {
  const sortKey = (a: ActivityDraft) =>
    TIME_PATTERN.test(a.time) ? toMinutes(a.time) : Number.POSITIVE_INFINITY
  const activities = [...draft.activities].sort((a, b) => sortKey(a) - sortKey(b))
  return { ...draft, activities }
}

/** Field path ("name", "days", "activities.0.title") to error message. */
export type DraftErrors = Record<string, string>

export type DraftResult = { ok: true; routine: Routine } | { ok: false; errors: DraftErrors }

export interface DraftContext {
  now: Date
  /** Used only when the draft has no id yet. */
  newId: () => string
}

/** Validates a draft and turns it into a Routine ready to save. */
export function draftToRoutine(draft: RoutineDraft, context: DraftContext): DraftResult {
  const errors: DraftErrors = {}
  const timestamp = context.now.toISOString()

  const activities = draft.activities.map((activity, index) => {
    const duration = parseWholeNumber(activity.duration)
    if (duration === 'invalid') {
      errors[`activities.${index}.durationMinutes`] = 'Duration must be a whole number of minutes'
    }
    const reminder = activity.reminder === NO_REMINDER ? null : parseWholeNumber(activity.reminder)
    if (reminder === 'invalid' || reminder === undefined) {
      errors[`activities.${index}.reminderMinutesBefore`] = 'Choose a reminder'
    }
    const notes = activity.notes.trim()
    return {
      id: activity.id,
      title: activity.title,
      time: activity.time,
      ...(typeof duration === 'number' ? { durationMinutes: duration } : {}),
      ...(notes ? { notes } : {}),
      reminderMinutesBefore: typeof reminder === 'number' ? reminder : null,
    }
  })

  const result = RoutineSchema.safeParse({
    id: draft.id ?? context.newId(),
    name: draft.name,
    days: draft.days,
    enabled: draft.enabled,
    activities,
    createdAt: draft.createdAt ?? timestamp,
    updatedAt: timestamp,
  })

  if (!result.success) {
    for (const issue of result.error.issues) {
      const path = issue.path.join('.')
      errors[path] ??= friendlyMessage(path, issue.code)
    }
  }

  if (Object.keys(errors).length > 0 || !result.success) {
    return { ok: false, errors }
  }
  return { ok: true, routine: result.data }
}

function parseWholeNumber(value: string): number | undefined | 'invalid' {
  const trimmed = value.trim()
  if (trimmed === '') return undefined
  if (!/^\d+$/.test(trimmed)) return 'invalid'
  return Number(trimmed)
}

function friendlyMessage(path: string, code: string): string {
  const field = path.split('.').at(-1)
  switch (field) {
    case 'name':
      return code === 'too_big' ? 'Name must be 60 characters or fewer' : 'Give the routine a name'
    case 'days':
      return 'Pick at least one day'
    case 'title':
      return code === 'too_big'
        ? 'Title must be 100 characters or fewer'
        : 'Give the activity a title'
    case 'time':
      return 'Enter a time'
    case 'durationMinutes':
      return 'Duration must be between 1 and 1440 minutes'
    case 'notes':
      return 'Notes must be 500 characters or fewer'
    default:
      return 'This value is not valid'
  }
}
