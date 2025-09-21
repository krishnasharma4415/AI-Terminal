import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import PyTerminal from './PyTerminal.jsx';
import { BackendProvider } from './BackendContext';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BackendProvider>
      <PyTerminal />
    </BackendProvider>
  </StrictMode>,
)
