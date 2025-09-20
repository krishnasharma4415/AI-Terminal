import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import PyTerminal from './PyTerminal.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PyTerminal />
  </StrictMode>,
)
