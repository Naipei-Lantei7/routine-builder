import type { ActivityDraft } from '../../domain/routineDraft'
import { Field } from './Field'
import { REMINDER_OPTIONS } from './reminderOptions'

interface Props {
  activity: ActivityDraft
  index: number
  count: number
  errors: Record<string, string>
  onChange: (changes: Partial<Omit<ActivityDraft, 'id'>>) => void
  onMove: (direction: -1 | 1) => void
  onRemove: () => void
}

export function ActivityFields({
  activity,
  index,
  count,
  errors,
  onChange,
  onMove,
  onRemove,
}: Props) {
  const id = `activity-${activity.id}`
  const name = activity.title.trim() || `activity ${index + 1}`
  const error = (field: string) => errors[`activities.${index}.${field}`]

  return (
    <fieldset className="card activity">
      <legend>Activity {index + 1}</legend>

      <div className="activity-grid">
        <Field id={`${id}-title`} label="Title" error={error('title')} className="span-2">
          <input
            id={`${id}-title`}
            type="text"
            value={activity.title}
            maxLength={100}
            onChange={(e) => onChange({ title: e.target.value })}
          />
        </Field>

        <Field id={`${id}-time`} label="Time" error={error('time')}>
          <input
            id={`${id}-time`}
            type="time"
            value={activity.time}
            onChange={(e) => onChange({ time: e.target.value })}
          />
        </Field>

        <Field id={`${id}-duration`} label="Duration (min)" error={error('durationMinutes')}>
          <input
            id={`${id}-duration`}
            type="number"
            inputMode="numeric"
            min={1}
            max={1440}
            placeholder="Optional"
            value={activity.duration}
            onChange={(e) => onChange({ duration: e.target.value })}
          />
        </Field>

        <Field id={`${id}-reminder`} label="Reminder" error={error('reminderMinutesBefore')}>
          <select
            id={`${id}-reminder`}
            value={activity.reminder}
            onChange={(e) => onChange({ reminder: e.target.value })}
          >
            {REMINDER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>

        <Field id={`${id}-notes`} label="Notes" error={error('notes')} className="span-2">
          <input
            id={`${id}-notes`}
            type="text"
            value={activity.notes}
            maxLength={500}
            placeholder="Optional"
            onChange={(e) => onChange({ notes: e.target.value })}
          />
        </Field>
      </div>

      <div className="activity-actions">
        <button
          type="button"
          aria-label={`Move ${name} up`}
          onClick={() => onMove(-1)}
          disabled={index === 0}
        >
          ↑
        </button>
        <button
          type="button"
          aria-label={`Move ${name} down`}
          onClick={() => onMove(1)}
          disabled={index === count - 1}
        >
          ↓
        </button>
        <button
          type="button"
          className="button-danger"
          aria-label={`Remove ${name}`}
          onClick={onRemove}
        >
          Remove
        </button>
      </div>
    </fieldset>
  )
}
