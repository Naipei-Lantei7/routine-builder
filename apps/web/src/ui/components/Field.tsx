import { cloneElement, type InputHTMLAttributes, type ReactElement } from 'react'

interface FieldProps {
  id: string
  label: string
  error?: string
  className?: string
  children: ReactElement<InputHTMLAttributes<HTMLElement>>
}

// Label + control + error message, wired up with aria-invalid and aria-describedby.
export function Field({ id, label, error, className, children }: FieldProps) {
  const errorId = `${id}-error`
  return (
    <div className={`field ${className ?? ''}`}>
      <label htmlFor={id}>{label}</label>
      {cloneElement(children, {
        'aria-invalid': error ? true : undefined,
        'aria-describedby': error ? errorId : undefined,
      })}
      {error && (
        <p id={errorId} className="field-error">
          {error}
        </p>
      )}
    </div>
  )
}
