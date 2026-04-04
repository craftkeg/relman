import { createRoot } from 'react-dom/client'
import RM from './relegation-manager.jsx'
import './index.css'

// No StrictMode: dev double-mount + timers was a common source of duplicated match commentary.
createRoot(document.getElementById('root')).render(<RM />)
