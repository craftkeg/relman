import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import RM from './relegation-manager.jsx'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RM />
  </StrictMode>,
)
