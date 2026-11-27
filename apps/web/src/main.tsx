import { RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { captureInstallPrompt } from './pwa/install'
import { registerServiceWorker } from './pwa/registerServiceWorker'
import { AuthProvider } from './auth/AuthProvider'
import { createAppRouter } from './router'
import { AppStateProvider } from './state/AppStateProvider'
import { SyncProvider } from './sync/SyncProvider'
import { createLocalStorageRepository } from './storage/localStorageRepository'

registerServiceWorker()
captureInstallPrompt()

const repository = createLocalStorageRepository()
const router = createAppRouter()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <AppStateProvider repository={repository}>
        <SyncProvider>
          <RouterProvider router={router} />
        </SyncProvider>
      </AppStateProvider>
    </AuthProvider>
  </StrictMode>,
)
