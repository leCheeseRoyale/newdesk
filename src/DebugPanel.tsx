import { useEffect, useRef, useState, useCallback } from 'react'
import { useStore } from './store'
import { invalidateLayout } from './pretextLayout'
import { perfStats } from './perfStats'

export function DebugPanel() {
  const show = useStore(s => s.showDebugPanel)
  if (!show) return null

  return (
    <div style={{
      position: 'fixed', bottom: 16, left: 16, width: 260,
      background: '#12121a', border: '1px solid #2a2a4a', borderRadius: 8,
      padding: 14, zIndex: 25,
      fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#ccc',
      boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: 600 }}>
          Debug
        </span>
        <span style={{ fontSize: 10, color: '#444' }}>Shift+(</span>
      </div>
      <PerfMonitor />
      <ChaosSlider />
      <StreamTextButton />
    </div>
  )
}

function PerfMonitor() {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(n => n + 1), 500)
    return () => clearInterval(id)
  }, [])

  const { fps, frameMs, nodeCount } = perfStats
  void tick
  const fpsColor = fps >= 55 ? '#2ecc71' : fps >= 30 ? '#f1c40f' : '#e74c3c'

  return (
    <div style={{ background: '#1a1a2e', borderRadius: 4, padding: 10, border: '1px solid #222240' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
        <span style={{ color: '#666' }}>FPS</span>
        <span style={{ color: fpsColor, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fps}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
        <span style={{ color: '#666' }}>Frame</span>
        <span style={{ color: '#999', fontVariantNumeric: 'tabular-nums' }}>{frameMs}ms</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
        <span style={{ color: '#666' }}>Nodes</span>
        <span style={{ color: '#999', fontVariantNumeric: 'tabular-nums' }}>{nodeCount}</span>
      </div>
    </div>
  )
}

function ChaosSlider() {
  const intensity = useStore(s => s.chaosIntensity)

  return (
    <div style={{ background: '#1a1a2e', borderRadius: 4, padding: 10, border: '1px solid #222240' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: '#666' }}>Chaos (J)</span>
        <span style={{ fontSize: 11, color: '#e74c3c', fontWeight: 600 }}>{intensity}</span>
      </div>
      <input
        type="range" min={0} max={100} value={intensity}
        onChange={e => useStore.getState().setChaosIntensity(Number(e.target.value))}
        style={{ width: '100%', accentColor: '#e74c3c' }}
      />
    </div>
  )
}

function StreamTextButton() {
  const streamRef = useRef<number | null>(null)
  const [streaming, setStreaming] = useState(false)

  useEffect(() => {
    return () => { if (streamRef.current !== null) clearInterval(streamRef.current) }
  }, [])

  const handleClick = useCallback(() => {
    if (streamRef.current !== null) {
      clearInterval(streamRef.current)
      streamRef.current = null
      setStreaming(false)
      return
    }

    const store = useStore.getState()
    let aiNodeId: string | null = null
    for (const id in store.nodes) {
      if (store.nodes[id].source.includes('AI Response')) { aiNodeId = id; break }
    }
    if (!aiNodeId) return

    const text = "The quick brown fox jumps over the lazy dog. This is a simulated AI response streaming text to demonstrate the node editor's real-time rendering capabilities."
    let i = 0
    const target = aiNodeId
    setStreaming(true)

    streamRef.current = window.setInterval(() => {
      if (i >= text.length) {
        if (streamRef.current !== null) clearInterval(streamRef.current)
        streamRef.current = null
        setStreaming(false)
        return
      }
      const st = useStore.getState()
      const node = st.nodes[target]
      if (!node) {
        if (streamRef.current !== null) clearInterval(streamRef.current)
        streamRef.current = null
        setStreaming(false)
        return
      }
      const lines = node.source.split('\n')
      let proseIdx = -1
      for (let j = 0; j < lines.length; j++) {
        const t = lines[j].trim()
        if (t !== '' && !t.startsWith('#') && !t.startsWith('>') && !t.startsWith('<') && !t.startsWith('---') && !t.includes(':')) {
          proseIdx = j; break
        }
      }
      let newSource: string
      if (proseIdx >= 0) {
        lines[proseIdx] = lines[proseIdx] + text[i]
        newSource = lines.join('\n')
      } else {
        newSource = node.source + '\n' + text[i]
      }
      i++
      invalidateLayout(node.source)
      st.updateNodeSource(target, newSource)
    }, 30)
  }, [])

  return (
    <button
      onClick={handleClick}
      style={{
        padding: '7px 14px',
        background: streaming ? '#3a2020' : '#1a1a2e',
        color: streaming ? '#e74c3c' : '#999',
        border: '1px solid ' + (streaming ? '#4a2020' : '#222240'),
        borderRadius: 4, cursor: 'pointer',
        fontFamily: 'Inter, sans-serif', fontSize: 12,
      }}
    >
      {streaming ? 'Stop Stream' : 'Stream Text'}
    </button>
  )
}
