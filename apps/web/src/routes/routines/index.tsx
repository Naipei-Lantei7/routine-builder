import { createFileRoute } from '@tanstack/react-router'
import { RoutineList } from '../components/routines/RoutineList'

export const Route = createFileRoute('/')({
  component: RoutineList,
})
