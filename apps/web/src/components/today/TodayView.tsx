import { getTodaysActivities, setActivityDone, type TodayItem } from '@routine-builder/domain'
import { Badge } from '@routine-builder/ui/components/badge'
import { Button } from '@routine-builder/ui/components/button'
import { Card } from '@routine-builder/ui/components/card'
import { Checkbox } from '@routine-builder/ui/components/checkbox'
import { Progress } from '@routine-builder/ui/components/progress'
import { cn } from '@routine-builder/ui/lib/utils'
import { Link } from '@tanstack/react-router'
import { Bell, CalendarCheck, CalendarClock, Plus } from 'lucide-react'
import { useNow } from '../../hooks/useNow'
import { EmptyState } from '../layout/EmptyState'
import { useAppState } from '../../state/appStateContext'
import { reminderLabel } from '../routines/reminderOptions'

const dateFormat = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

export function TodayView() {
  const { state, update } = useAppState()
  const now = useNow()
  const items = getTodaysActivities(state, now)
  const doneCount = items.filter((item) => item.status === 'done').length

  function toggle(item: TodayItem, done: boolean) {
    update((s) =>
      setActivityDone(
        s,
        { routineId: item.routineId, activityId: item.activity.id, date: item.date },
        done,
        new Date(),
      ),
    )
  }

  return (
    <section aria-labelledby="today-heading" className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h2 id="today-heading" className="text-2xl font-semibold tracking-tight">
            Today
          </h2>
          <p className="text-sm text-muted-foreground">{dateFormat.format(now)}</p>
        </div>
        {items.length > 0 && (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            <span className="font-medium text-foreground tabular-nums">
              {doneCount} of {items.length}
            </span>{' '}
            done
          </p>
        )}
      </div>

      {items.length > 0 && (
        <Progress
          value={(doneCount / items.length) * 100}
          aria-label="Today's progress"
          className="h-1.5"
        />
      )}

      {state.routines.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No routines yet."
          description="Create a routine and its activities will show up here on the days it runs."
          action={
            <Button asChild>
              <Link to="/routines/new">
                <Plus aria-hidden="true" />
                New routine
              </Link>
            </Button>
          }
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title="Nothing scheduled today."
          description="None of your routines run today, or they are turned off."
          action={
            <Button asChild variant="outline">
              <Link to="/routines">See your routines</Link>
            </Button>
          }
        />
      ) : (
        <>
          <Card className="gap-0 overflow-hidden py-0">
            <ol className="divide-y">
              {items.map((item) => (
                <TodayRow
                  key={`${item.routineId}:${item.activity.id}`}
                  item={item}
                  now={now}
                  onToggle={(done) => toggle(item, done)}
                />
              ))}
            </ol>
          </Card>
          {doneCount === items.length && (
            <p className="text-center text-sm text-muted-foreground">All done for today.</p>
          )}
        </>
      )}
    </section>
  )
}

function TodayRow({
  item,
  now,
  onToggle,
}: {
  item: TodayItem
  now: Date
  onToggle: (done: boolean) => void
}) {
  const { activity, status } = item
  const id = `today-${item.routineId}-${activity.id}`
  const done = status === 'done'

  const meta = [
    item.routineName,
    activity.durationMinutes ? `${activity.durationMinutes} min` : null,
  ].filter(Boolean)

  return (
    <li
      className={cn(
        'flex items-start gap-3 px-4 py-3 transition-colors',
        status === 'next' && 'bg-accent/60',
      )}
      aria-current={status === 'next' ? 'step' : undefined}
    >
      <Checkbox
        id={id}
        checked={done}
        onCheckedChange={(checked) => onToggle(checked === true)}
        className="mt-0.5"
      />
      <time
        dateTime={activity.time}
        className="w-12 shrink-0 pt-px font-mono text-sm text-muted-foreground tabular-nums"
      >
        {activity.time}
      </time>
      <div className="min-w-0 flex-1 space-y-0.5">
        <label
          htmlFor={id}
          className={cn(
            'block cursor-pointer text-sm leading-5 font-medium',
            done && 'text-muted-foreground line-through',
          )}
        >
          {activity.title}
        </label>
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          <span>{meta.join(' · ')}</span>
          {activity.reminderMinutesBefore !== null && !done && (
            <span className="flex items-center gap-1">
              <Bell className="size-3" aria-hidden="true" />
              {reminderLabel(activity.reminderMinutesBefore)}
            </span>
          )}
        </p>
        {activity.notes && <p className="text-xs text-muted-foreground">{activity.notes}</p>}
      </div>
      <StatusBadge item={item} now={now} />
    </li>
  )
}

function StatusBadge({ item, now }: { item: TodayItem; now: Date }) {
  if (item.status === 'next') {
    const minutes = Math.ceil((item.start.getTime() - now.getTime()) / 60_000)
    return <Badge>{minutes <= 0 ? 'Now' : `Next · in ${formatMinutes(minutes)}`}</Badge>
  }
  if (item.status === 'overdue') {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        Overdue
      </Badge>
    )
  }
  return null
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
}
