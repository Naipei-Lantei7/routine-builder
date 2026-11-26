import { RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { createAppRouter } from './router'
import { AppStateProvider } from './state/AppStateProvider'
import { createLocalStorageRepository } from './storage/localStorageRepository'

const repository = createLocalStorageRepository()
const router = createAppRouter()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppStateProvider repository={repository}>
      <RouterProvider router={router} />
    </AppStateProvider>
  </StrictMode>,
)
