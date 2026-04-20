import { createRoot } from 'react-dom/client'
import { App } from './App'
import './global.css'

document.fonts.ready.then(() => {
  createRoot(document.getElementById('root')!).render(<App />)
})
