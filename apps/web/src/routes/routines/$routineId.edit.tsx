import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { RoutineEditor } from '../../components/routines/RoutineEditor'

export const Route = createFileRoute('/routines/$routineId/edit')({
  component: EditRoutinePage,
})

function EditRoutinePage() {
  const { routineId } = Route.useParams()
  const navigate = useNavigate()
  // Keyed so switching between routines starts a fresh draft.
  return (
    <RoutineEditor
      key={routineId}
      routineId={routineId}
      onDone={() => navigate({ to: '/routines' })}
    />
  )
}
