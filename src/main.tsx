import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { bootstrapTheme } from './lib/theme'
import './index.css'

// Both the interface and the documents are English; keep the root declaration
// agreeing with `<html lang="en">` in index.html.
document.documentElement.lang = 'en'

bootstrapTheme()

const container = document.getElementById('root')
if (!container) throw new Error('Root container #root is missing from index.html')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
