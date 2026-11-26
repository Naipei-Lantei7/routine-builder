import type { ActivityDraft } from '@routine-builder/domain'
import { Button } from '@routine-builder/ui/components/button'
import { Card, CardContent } from '@routine-builder/ui/components/card'
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from '@routine-builder/ui/components/field'
import { Input } from '@routine-builder/ui/components/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@routine-builder/ui/components/select'
import { Textarea } from '@routine-builder/ui/components/textarea'
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react'
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

  // Wires a control to its error message for screen readers.
  const invalid = (field: string) =>
    error(field)
      ? { 'aria-invalid': true as const, 'aria-describedby': `${id}-${field}-error` }
      : {}

  return (
    <Card className="py-4">
      <CardContent className="px-4">
        <FieldSet className="gap-4" aria-labelledby={`${id}-heading`}>
          <div className="flex items-center justify-between gap-2">
            <span id={`${id}-heading`} className="text-sm font-medium text-muted-foreground">
              Activity {index + 1}
            </span>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={`Move ${name} up`}
                disabled={index === 0}
                onClick={() => onMove(-1)}
              >
                <ArrowUp aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={`Move ${name} down`}
                disabled={index === count - 1}
                onClick={() => onMove(1)}
              >
                <ArrowDown aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 text-destructive hover:text-destructive"
                aria-label={`Remove ${name}`}
                onClick={onRemove}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </div>
          </div>

          <FieldGroup className="grid grid-cols-2 gap-4 sm:grid-cols-6">
            <Field data-invalid={!!error('title')} className="col-span-2 sm:col-span-4">
              <FieldLabel htmlFor={`${id}-title`}>Title</FieldLabel>
              <Input
                id={`${id}-title`}
                value={activity.title}
                maxLength={100}
                placeholder="e.g. Stretch"
                onChange={(e) => onChange({ title: e.target.value })}
                {...invalid('title')}
              />
              <ErrorText id={`${id}-title-error`} message={error('title')} />
            </Field>

            <Field data-invalid={!!error('time')} className="sm:col-span-2">
              <FieldLabel htmlFor={`${id}-time`}>Time</FieldLabel>
              <Input
                id={`${id}-time`}
                type="time"
                value={activity.time}
                onChange={(e) => onChange({ time: e.target.value })}
                {...invalid('time')}
              />
              <ErrorText id={`${id}-time-error`} message={error('time')} />
            </Field>

            <Field data-invalid={!!error('durationMinutes')} className="sm:col-span-2">
              <FieldLabel htmlFor={`${id}-duration`}>Duration (min)</FieldLabel>
              <Input
                id={`${id}-duration`}
                type="number"
                inputMode="numeric"
                min={1}
                max={1440}
                placeholder="Optional"
                value={activity.duration}
                onChange={(e) => onChange({ duration: e.target.value })}
                {...invalid('durationMinutes')}
              />
              <ErrorText id={`${id}-durationMinutes-error`} message={error('durationMinutes')} />
            </Field>

            <Field
              data-invalid={!!error('reminderMinutesBefore')}
              className="col-span-2 sm:col-span-4"
            >
              <FieldLabel htmlFor={`${id}-reminder`}>Reminder</FieldLabel>
              <Select
                value={activity.reminder}
                onValueChange={(reminder) => onChange({ reminder })}
              >
                <SelectTrigger
                  id={`${id}-reminder`}
                  className="w-full"
                  {...invalid('reminderMinutesBefore')}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REMINDER_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <ErrorText
                id={`${id}-reminderMinutesBefore-error`}
                message={error('reminderMinutesBefore')}
              />
            </Field>

            <Field data-invalid={!!error('notes')} className="col-span-2 sm:col-span-6">
              <FieldLabel htmlFor={`${id}-notes`}>Notes</FieldLabel>
              <Textarea
                id={`${id}-notes`}
                rows={2}
                maxLength={500}
                placeholder="Optional"
                value={activity.notes}
                className="min-h-0 resize-y"
                onChange={(e) => onChange({ notes: e.target.value })}
                {...invalid('notes')}
              />
              <ErrorText id={`${id}-notes-error`} message={error('notes')} />
            </Field>
          </FieldGroup>
        </FieldSet>
      </CardContent>
    </Card>
  )
}

// FieldError announces itself (role="alert"); the summary at the top of the form
// already does that, so per-field messages are plain text tied via aria-describedby.
export function ErrorText({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return <FieldError id={id} role={undefined} errors={[{ message }]} />
}
