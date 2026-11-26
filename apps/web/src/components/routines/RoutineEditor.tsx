import {
  addActivity,
  createEmptyDraft,
  deleteRoutine,
  draftToRoutine,
  moveActivity,
  removeActivity,
  sortActivitiesByTime,
  toDraft,
  updateActivity,
  upsertRoutine,
  validateDraft,
  WEEKDAY_LONG,
  WEEKDAY_SHORT,
  WEEKDAYS,
  type RoutineDraft,
  type Weekday,
} from '@routine-builder/domain'
import { Alert, AlertTitle } from '@routine-builder/ui/components/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@routine-builder/ui/components/alert-dialog'
import { Button } from '@routine-builder/ui/components/button'
import { Card, CardContent } from '@routine-builder/ui/components/card'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@routine-builder/ui/components/field'
import { Input } from '@routine-builder/ui/components/input'
import { Switch } from '@routine-builder/ui/components/switch'
import { ToggleGroup, ToggleGroupItem } from '@routine-builder/ui/components/toggle-group'
import { Link } from '@tanstack/react-router'
import { AlertCircle, ArrowDownUp, ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'
import { flushSync } from 'react-dom'
import { useAppState } from '../../state/appStateContext'
import { ActivityFields, ErrorText } from './ActivityFields'

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
  const errorSummaryRef = useRef<HTMLDivElement>(null)

  if (routineId && !existing) {
    return (
      <div className="space-y-4 text-center">
        <h2 className="text-xl font-semibold">Routine not found</h2>
        <p className="text-muted-foreground">It may have been deleted in another tab.</p>
        <Button variant="outline" onClick={onDone}>
          Back to routines
        </Button>
      </div>
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

  return (
    <section aria-labelledby="editor-heading" className="space-y-6">
      <div className="space-y-2">
        <Button variant="link" asChild className="h-auto px-0 text-muted-foreground">
          <Link to="/">
            <ArrowLeft aria-hidden="true" />
            Routines
          </Link>
        </Button>
        <h2 id="editor-heading" className="text-2xl font-semibold tracking-tight">
          {existing ? `Edit ${existing.name}` : 'New routine'}
        </h2>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-8">
        {errorCount > 0 && (
          <Alert variant="destructive" ref={errorSummaryRef} tabIndex={-1}>
            <AlertCircle aria-hidden="true" />
            <AlertTitle>
              {errorCount === 1
                ? 'Fix 1 problem before saving.'
                : `Fix ${errorCount} problems before saving.`}
            </AlertTitle>
          </Alert>
        )}

        <Card>
          <CardContent>
            <FieldGroup>
              <Field data-invalid={!!errors.name}>
                <FieldLabel htmlFor="routine-name">Name</FieldLabel>
                <Input
                  id="routine-name"
                  value={draft.name}
                  maxLength={60}
                  placeholder="e.g. Weekday morning"
                  aria-invalid={errors.name ? true : undefined}
                  aria-describedby={errors.name ? 'routine-name-error' : undefined}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
                <ErrorText id="routine-name-error" message={errors.name} />
              </Field>

              <FieldSet
                data-invalid={!!errors.days}
                aria-describedby={errors.days ? 'days-error' : undefined}
              >
                <FieldLegend variant="label">Days</FieldLegend>
                <ToggleGroup
                  type="multiple"
                  variant="outline"
                  spacing={1}
                  className="flex-wrap"
                  value={draft.days.map(String)}
                  onValueChange={(values) =>
                    setDraft({
                      ...draft,
                      days: values.map((v) => Number(v) as Weekday).sort((a, b) => a - b),
                    })
                  }
                >
                  {WEEKDAYS.map((day) => (
                    <ToggleGroupItem
                      key={day}
                      value={String(day)}
                      aria-label={WEEKDAY_LONG[day]}
                      className="min-w-12 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                    >
                      {WEEKDAY_SHORT[day]}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                <ErrorText id="days-error" message={errors.days} />
              </FieldSet>

              <Field orientation="horizontal">
                <Switch
                  id="routine-enabled"
                  checked={draft.enabled}
                  onCheckedChange={(enabled) => setDraft({ ...draft, enabled })}
                />
                <FieldContent>
                  <FieldLabel htmlFor="routine-enabled">Routine is on</FieldLabel>
                  <FieldDescription>Turn it off to pause it without deleting it.</FieldDescription>
                </FieldContent>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        <section aria-labelledby="activities-heading" className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 id="activities-heading" className="text-lg font-semibold">
              Activities
            </h3>
            {draft.activities.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setDraft(sortActivitiesByTime(draft))}
              >
                <ArrowDownUp aria-hidden="true" />
                Sort by time
              </Button>
            )}
          </div>

          {draft.activities.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No activities yet. Add the first thing you do in this routine.
            </p>
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

          <Button
            type="button"
            variant="outline"
            className="w-full border-dashed"
            onClick={handleAddActivity}
          >
            <Plus aria-hidden="true" />
            Add activity
          </Button>
        </section>

        <div className="flex flex-wrap items-center gap-2 border-t pt-6">
          <Button type="submit">Save routine</Button>
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancel
          </Button>

          {existing && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className="ml-auto text-destructive hover:text-destructive"
                >
                  <Trash2 aria-hidden="true" />
                  Delete routine
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {existing.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This removes the routine and its activities. It cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep it</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" onClick={handleDelete}>
                    Yes, delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </form>
    </section>
  )
}
