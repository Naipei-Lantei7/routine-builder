import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AppStateProvider } from './state/AppStateProvider.tsx'
import { createLocalStorageRepository } from './storage/localStorageRepository.ts'

const repository = createLocalStorageRepository()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppStateProvider repository={repository}>
      <App />
    </AppStateProvider>
  </StrictMode>,
)
