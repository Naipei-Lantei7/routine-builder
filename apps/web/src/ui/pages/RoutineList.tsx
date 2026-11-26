import { formatDays, type Routine, setRoutineEnabled } from '@routine-builder/domain'
import { useAppState } from '../../state/appStateContext'

interface Props {
  onCreate: () => void
  onEdit: (routineId: string) => void
}

export function RoutineList({ onCreate, onEdit }: Props) {
  const { state, update } = useAppState()

  return (
    <section aria-labelledby="routines-heading">
      <div className="page-header">
        <h2 id="routines-heading">Your routines</h2>
        <button type="button" className="button-primary" onClick={onCreate}>
          New routine
        </button>
      </div>

      {state.routines.length === 0 ? (
        <div className="empty-state">
          <p>No routines yet.</p>
          <p className="muted">
            Create one, like a weekday morning routine, and add the activities you do at set times.
          </p>
        </div>
      ) : (
        <ul className="routine-list">
          {state.routines.map((routine) => (
            <li key={routine.id} className="card routine-card">
              <div className="routine-card-body">
                <h3>{routine.name}</h3>
                <p className="muted">{summary(routine)}</p>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  aria-label={`${routine.name} is ${routine.enabled ? 'on' : 'off'}`}
                  checked={routine.enabled}
                  onChange={(e) =>
                    update((s) => setRoutineEnabled(s, routine.id, e.target.checked, new Date()))
                  }
                />
                <span aria-hidden="true">{routine.enabled ? 'On' : 'Off'}</span>
              </label>
              <button
                type="button"
                aria-label={`Edit ${routine.name}`}
                onClick={() => onEdit(routine.id)}
              >
                Edit
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function summary(routine: Routine): string {
  const count = routine.activities.length
  const activities = count === 1 ? '1 activity' : `${count} activities`
  const times = routine.activities.map((a) => a.time).sort()
  const first = times[0]
  const last = times.at(-1)
  const range = !first ? '' : first === last ? ` · ${first}` : ` · ${first}–${last}`
  return `${formatDays(routine.days)} · ${activities}${range}`
}
