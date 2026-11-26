import { useRef, useState, type FormEvent } from 'react'
import { flushSync } from 'react-dom'
import {
  addActivity,
  createEmptyDraft,
  deleteRoutine,
  draftToRoutine,
  moveActivity,
  removeActivity,
  type RoutineDraft,
  sortActivitiesByTime,
  toDraft,
  toggleDay,
  updateActivity,
  upsertRoutine,
  validateDraft,
  WEEKDAY_LONG,
  WEEKDAY_SHORT,
  WEEKDAYS,
} from '@routine-builder/domain'
import { useAppState } from '../../state/appStateContext'
import { ActivityFields } from '../components/ActivityFields'
import { Field } from '../components/Field'

interface Props {
  // Null to create a new routine.
  routineId: string | null
  onDone: () => void
  newId?: () => string
}

export function RoutineEditor({ routineId, onDone, newId = () => crypto.randomUUID() }: Props) {
  const { state, update } = useAppState()
  const existing = routineId ? state.routines.find((r) => r.id === routineId) : undefined

  const [draft, setDraft] = useState<RoutineDraft>(() =>
    existing ? toDraft(existing) : createEmptyDraft(),
  )
  const [submitted, setSubmitted] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const errorSummaryRef = useRef<HTMLDivElement>(null)

  if (routineId && !existing) {
    return (
      <section>
        <h2>Routine not found</h2>
        <p>It may have been deleted in another tab.</p>
        <button type="button" onClick={onDone}>
          Back to routines
        </button>
      </section>
    )
  }

  // Validate live once the user has tried to save, so errors clear as they are fixed.
  const errors = submitted ? validateDraft(draft) : {}
  const errorCount = Object.keys(errors).length

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const outcome = draftToRoutine(draft, { now: new Date(), newId })
    if (!outcome.ok) {
      // Render the error summary synchronously so it exists to receive focus.
      flushSync(() => setSubmitted(true))
      errorSummaryRef.current?.focus()
      return
    }
    update((s) => upsertRoutine(s, outcome.routine))
    onDone()
  }

  function handleAddActivity() {
    const id = newId()
    // Render the new activity synchronously so its title can take focus.
    flushSync(() => setDraft((d) => addActivity(d, id)))
    document.getElementById(`activity-${id}-title`)?.focus()
  }

  function handleDelete() {
    if (!routineId) return
    update((s) => deleteRoutine(s, routineId))
    onDone()
  }

  const heading = existing ? `Edit ${existing.name}` : 'New routine'

  return (
    <section aria-labelledby="editor-heading">
      <h2 id="editor-heading">{heading}</h2>

      <form onSubmit={handleSubmit} noValidate>
        {errorCount > 0 && (
          <div className="notice notice-error" role="alert" tabIndex={-1} ref={errorSummaryRef}>
            {errorCount === 1
              ? 'Fix 1 problem before saving.'
              : `Fix ${errorCount} problems before saving.`}
          </div>
        )}

        <Field id="routine-name" label="Name" error={errors.name}>
          <input
            id="routine-name"
            type="text"
            value={draft.name}
            maxLength={60}
            placeholder="e.g. Weekday morning"
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </Field>

        <fieldset
          className="days"
          aria-invalid={errors.days ? true : undefined}
          aria-describedby={errors.days ? 'days-error' : undefined}
        >
          <legend>Days</legend>
          <div className="day-picker">
            {WEEKDAYS.map((day) => (
              <label key={day} className="day-chip">
                <input
                  type="checkbox"
                  checked={draft.days.includes(day)}
                  onChange={() => setDraft(toggleDay(draft, day))}
                />
                <span aria-hidden="true">{WEEKDAY_SHORT[day]}</span>
                <span className="visually-hidden">{WEEKDAY_LONG[day]}</span>
              </label>
            ))}
          </div>
          {errors.days && (
            <p id="days-error" className="field-error">
              {errors.days}
            </p>
          )}
        </fieldset>

        <label className="toggle">
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
          />
          <span>Routine is on</span>
        </label>

        <div className="page-header">
          <h3>Activities</h3>
          {draft.activities.length > 1 && (
            <button type="button" onClick={() => setDraft(sortActivitiesByTime(draft))}>
              Sort by time
            </button>
          )}
        </div>

        {draft.activities.length === 0 && (
          <p className="muted">No activities yet. Add the first thing you do in this routine.</p>
        )}

        {draft.activities.map((activity, index) => (
          <ActivityFields
            key={activity.id}
            activity={activity}
            index={index}
            count={draft.activities.length}
            errors={errors}
            onChange={(changes) => setDraft((d) => updateActivity(d, activity.id, changes))}
            onMove={(direction) => setDraft((d) => moveActivity(d, activity.id, direction))}
            onRemove={() => setDraft((d) => removeActivity(d, activity.id))}
          />
        ))}

        <button type="button" onClick={handleAddActivity}>
          Add activity
        </button>

        <div className="form-actions">
          <button type="submit" className="button-primary">
            Save routine
          </button>
          <button type="button" onClick={onDone}>
            Cancel
          </button>

          {existing && (
            <div className="delete-zone">
              {confirmingDelete ? (
                <>
                  <span>Delete this routine?</span>
                  <button type="button" className="button-danger" onClick={handleDelete}>
                    Yes, delete
                  </button>
                  <button type="button" onClick={() => setConfirmingDelete(false)}>
                    Keep it
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="button-danger"
                  onClick={() => setConfirmingDelete(true)}
                >
                  Delete routine
                </button>
              )}
            </div>
          )}
        </div>
      </form>
    </section>
  )
}
