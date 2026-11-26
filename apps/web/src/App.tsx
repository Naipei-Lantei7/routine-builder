import { useState } from 'react'
import './App.css'
import { StorageNotice } from './ui/components/StorageNotice'
import { RoutineEditor } from './ui/pages/RoutineEditor'
import { RoutineList } from './ui/pages/RoutineList'

type View = { name: 'list' } | { name: 'edit'; routineId: string | null }

interface Props {
  /** Overrides id generation; used by tests. */
  newId?: () => string
}

function App({ newId }: Props) {
  const [view, setView] = useState<View>({ name: 'list' })
  const showList = () => setView({ name: 'list' })

  return (
    <>
      <header className="app-header">
        <h1>Routine Builder</h1>
      </header>
      <main>
        <StorageNotice />
        {view.name === 'list' ? (
          <RoutineList
            onCreate={() => setView({ name: 'edit', routineId: null })}
            onEdit={(routineId) => setView({ name: 'edit', routineId })}
          />
        ) : (
          <RoutineEditor
            // Remount per routine so the draft starts from the right data.
            key={view.routineId ?? 'new'}
            routineId={view.routineId}
            onDone={showList}
            newId={newId}
          />
        )}
      </main>
    </>
  )
}

export default App
