import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { RoutineEditor } from '../../components/routines/RoutineEditor'

export const Route = createFileRoute('/routines/new')({
  component: NewRoutinePage,
})

function NewRoutinePage() {
  const navigate = useNavigate()
  return <RoutineEditor routineId={null} onDone={() => navigate({ to: '/routines' })} />
}
