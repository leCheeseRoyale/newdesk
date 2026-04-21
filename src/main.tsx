import { createRoot } from 'react-dom/client'
import { App } from './App'
import { useStore } from './store'
import { deserializeGraph } from './serializer'
import './global.css'

document.fonts.ready.then(() => {
  const hash = window.location.hash.slice(1)
  if (hash) {
    try {
      const text = decodeURIComponent(escape(atob(hash)))
      const { nodes, edges } = deserializeGraph(text)
      useStore.getState().loadGraph(nodes, edges)
      window.location.hash = ''
    } catch (e) {
      console.warn('Failed to load from URL hash:', e)
    }
  } else {
    const saved = localStorage.getItem('newdesk-graph')
    if (saved) {
      try {
        const { nodes, edges } = deserializeGraph(saved)
        useStore.getState().loadGraph(nodes, edges)
      } catch (e) {
        console.warn('Failed to load from localStorage:', e)
      }
    }
  }

  createRoot(document.getElementById('root')!).render(<App />)
})
