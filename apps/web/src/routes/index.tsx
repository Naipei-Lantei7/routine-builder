import { createFileRoute } from '@tanstack/react-router'
import { TodayView } from '../components/today/TodayView'

export const Route = createFileRoute('/')({
  component: TodayView,
})
