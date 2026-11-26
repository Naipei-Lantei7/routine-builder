import { formatDays, setRoutineEnabled, type Routine } from '@routine-builder/domain'
import { Badge } from '@routine-builder/ui/components/badge'
import { Button } from '@routine-builder/ui/components/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@routine-builder/ui/components/card'
import { Switch } from '@routine-builder/ui/components/switch'
import { cn } from '@routine-builder/ui/lib/utils'
import { Link } from '@tanstack/react-router'
import { Bell, CalendarClock, Pencil, Plus } from 'lucide-react'
import { useAppState } from '../../state/appStateContext'
import { EmptyState } from '../layout/EmptyState'
import { reminderLabel } from './reminderOptions'

export function RoutineList() {
  const { state, update } = useAppState()

  return (
    <section aria-labelledby="routines-heading" className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h2 id="routines-heading" className="text-2xl font-semibold tracking-tight">
            Your routines
          </h2>
          <p className="text-sm text-muted-foreground">
            Activities you do at set times, on the days you choose.
          </p>
        </div>
        {state.routines.length > 0 && (
          <Button asChild>
            <Link to="/routines/new">
              <Plus aria-hidden="true" />
              New routine
            </Link>
          </Button>
        )}
      </div>

      {state.routines.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No routines yet."
          description="Create one, like a weekday morning routine, and add the activities you do at set times."
          action={
            <Button asChild>
              <Link to="/routines/new">
                <Plus aria-hidden="true" />
                New routine
              </Link>
            </Button>
          }
        />
      ) : (
        <ul className="space-y-4">
          {state.routines.map((routine) => (
            <li key={routine.id}>
              <RoutineCard
                routine={routine}
                onToggle={(enabled) =>
                  update((s) => setRoutineEnabled(s, routine.id, enabled, new Date()))
                }
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function RoutineCard({
  routine,
  onToggle,
}: {
  routine: Routine
  onToggle: (enabled: boolean) => void
}) {
  const activities = [...routine.activities].sort((a, b) => a.time.localeCompare(b.time))

  return (
    <Card className={cn('gap-4 transition-opacity', !routine.enabled && 'opacity-60')}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <h3>{routine.name}</h3>
          {!routine.enabled && <Badge variant="secondary">Off</Badge>}
        </CardTitle>
        <CardDescription>{summary(routine)}</CardDescription>
        <CardAction className="flex items-center gap-2">
          <Switch
            checked={routine.enabled}
            onCheckedChange={onToggle}
            aria-label={`${routine.name} is ${routine.enabled ? 'on' : 'off'}`}
          />
          <Button variant="ghost" size="icon" asChild>
            <Link
              to="/routines/$routineId/edit"
              params={{ routineId: routine.id }}
              aria-label={`Edit ${routine.name}`}
            >
              <Pencil aria-hidden="true" />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>

      {activities.length > 0 && (
        <CardContent>
          <ol className="divide-y rounded-md border">
            {activities.map((activity) => (
              <li key={activity.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <time className="w-12 shrink-0 font-mono text-muted-foreground tabular-nums">
                  {activity.time}
                </time>
                <span className="min-w-0 flex-1 truncate">{activity.title}</span>
                {activity.reminderMinutesBefore !== null && (
                  <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                    <Bell className="size-3" aria-hidden="true" />
                    {reminderLabel(activity.reminderMinutesBefore)}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </CardContent>
      )}
    </Card>
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
