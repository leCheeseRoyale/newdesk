import { useEffect, useRef, useState, useCallback } from 'react'
import { useStore } from './store'
import { NODE_FONT, NODE_PADDING_X, NODE_PADDING_Y, NODE_LINE_HEIGHT } from './types'
import { getNodeLayout, invalidateLayout } from './pretextLayout'
import { renderHeight, perfStats } from './CanvasLayer'
import { updateParamInSource } from './nodeParser'

function ParamTextarea() {
  const editingParam = useStore(s => s.editingParam)
  const nodes = useStore(s => s.nodes)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  if (!editingParam) return null

  const node = nodes[editingParam.nodeId]
  if (!node) return null

  const layout = getNodeLayout(node)
  const region = layout.editableRegions.find(r => r.paramName === editingParam.paramName)
  if (!region) return null

  const left = node.x + region.x
  const top = node.y + region.y
  const width = region.width
  const height = Math.max(region.height, 40)

  const commit = (value: string) => {
    const store = useStore.getState()
    const currentNode = store.nodes[editingParam.nodeId]
    if (currentNode) {
      const newSource = updateParamInSource(currentNode.source, editingParam.paramName, value)
      store.updateNodeSource(editingParam.nodeId, newSource)
      invalidateLayout(editingParam.nodeId, newSource)
    }
    store.setEditingParam(null)
    store.pushHistory()
  }

  return (
    <textarea
      ref={textareaRef}
      defaultValue={region.value}
      autoFocus
      onFocus={e => {
        e.currentTarget.select()
      }}
      onBlur={e => {
        commit(e.currentTarget.value)
      }}
      onKeyDown={e => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          commit(e.currentTarget.value)
        }
      }}
      style={{
        position: 'absolute',
        left,
        top,
        width,
        height,
        font: NODE_FONT,
        background: 'transparent',
        color: 'white',
        border: 'none',
        padding: 0,
        margin: 0,
        outline: 'none',
        resize: 'none',
        overflow: 'hidden',
        zIndex: 1,
      }}
    />
  )
}

function NodeSourceTextarea() {
  const editingNodeId = useStore(s => s.editingNodeId)
  const nodes = useStore(s => s.nodes)

  if (!editingNodeId) return null

  const node = nodes[editingNodeId]
  if (!node) return null

  const layout = getNodeLayout(node)
  const rh = renderHeight(node, layout)

  const left = node.x + NODE_PADDING_X
  const top = node.y + NODE_PADDING_Y
  const width = layout.width - 2 * NODE_PADDING_X
  const height = rh - 2 * NODE_PADDING_Y

  return (
    <textarea
      defaultValue={node.source}
      autoFocus
      onFocus={e => e.currentTarget.select()}
      onChange={e => {
        const store = useStore.getState()
        store.updateNodeSource(editingNodeId, e.target.value)
        invalidateLayout(editingNodeId, e.target.value)
      }}
      onBlur={() => {
        useStore.getState().setEditingNode(null)
      }}
      onKeyDown={e => {
        if (e.key === 'Escape') e.currentTarget.blur()
      }}
      style={{
        position: 'absolute',
        left,
        top,
        width,
        height,
        font: NODE_FONT,
        background: 'transparent',
        color: '#e0e0e0',
        border: 'none',
        outline: 'none',
        resize: 'none',
        padding: 0,
        margin: 0,
        overflow: 'hidden',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        lineHeight: NODE_LINE_HEIGHT + 'px',
        zIndex: 1,
      }}
    />
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
    <div style={{ background: '#1a1a2e', borderRadius: 4, padding: 10, border: '1px solid #2a2a4a' }}>
      <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
        Performance
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
        <span style={{ color: '#888' }}>FPS</span>
        <span style={{ color: fpsColor, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fps}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
        <span style={{ color: '#888' }}>Frame</span>
        <span style={{ color: '#ccc', fontVariantNumeric: 'tabular-nums' }}>{frameMs}ms</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
        <span style={{ color: '#888' }}>Nodes</span>
        <span style={{ color: '#ccc', fontVariantNumeric: 'tabular-nums' }}>{nodeCount}</span>
      </div>
    </div>
  )
}

function ChaosSlider() {
  const intensity = useStore(s => s.chaosIntensity)

  return (
    <div style={{ background: '#1a1a2e', borderRadius: 4, padding: 10, border: '1px solid #2a2a4a' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>
          Chaos (J)
        </span>
        <span style={{ fontSize: 11, color: '#e74c3c', fontWeight: 600 }}>{intensity}</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={intensity}
        onChange={e => useStore.getState().setChaosIntensity(Number(e.target.value))}
        style={{ width: '100%', accentColor: '#e74c3c' }}
      />
    </div>
  )
}

function InspectorPanel() {
  const selectedNodeId = useStore(s => s.selectedNodeId)
  const nodes = useStore(s => s.nodes)
  const selectedNode = selectedNodeId ? nodes[selectedNodeId] : null
  const [localSource, setLocalSource] = useState('')
  const streamIntervalRef = useRef<number | null>(null)

  useEffect(() => {
    if (selectedNode) {
      setLocalSource(selectedNode.source)
    }
  }, [selectedNode?.source, selectedNodeId])

  useEffect(() => {
    return () => {
      if (streamIntervalRef.current !== null) {
        clearInterval(streamIntervalRef.current)
      }
    }
  }, [])

  const handleSourceChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newSource = e.target.value
    setLocalSource(newSource)
    if (selectedNodeId) {
      const store = useStore.getState()
      store.updateNodeSource(selectedNodeId, newSource)
      invalidateLayout(selectedNodeId, newSource)
    }
  }, [selectedNodeId])

  const handleStreamText = useCallback(() => {
    if (streamIntervalRef.current !== null) {
      clearInterval(streamIntervalRef.current)
      streamIntervalRef.current = null
      return
    }

    const store = useStore.getState()
    const allNodes = store.nodes
    let aiNodeId: string | null = null
    for (const id in allNodes) {
      if (allNodes[id].source.includes('AI Response')) {
        aiNodeId = id
        break
      }
    }
    if (!aiNodeId) return

    const streamText = "The quick brown fox jumps over the lazy dog. This is a simulated AI response streaming text to demonstrate the node editor's real-time rendering capabilities."
    let charIndex = 0
    const targetNodeId = aiNodeId

    streamIntervalRef.current = window.setInterval(() => {
      if (charIndex >= streamText.length) {
        if (streamIntervalRef.current !== null) {
          clearInterval(streamIntervalRef.current)
          streamIntervalRef.current = null
        }
        return
      }

      const st = useStore.getState()
      const targetNode = st.nodes[targetNodeId]
      if (!targetNode) {
        if (streamIntervalRef.current !== null) {
          clearInterval(streamIntervalRef.current)
          streamIntervalRef.current = null
        }
        return
      }

      const lines = targetNode.source.split('\n')
      let proseLineIdx = -1
      for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim()
        if (
          trimmed !== '' &&
          !trimmed.startsWith('#') &&
          !trimmed.startsWith('>') &&
          !trimmed.startsWith('<') &&
          !trimmed.startsWith('---') &&
          !trimmed.includes(':')
        ) {
          proseLineIdx = i
          break
        }
      }

      let newSource: string
      if (proseLineIdx >= 0) {
        lines[proseLineIdx] = lines[proseLineIdx] + streamText[charIndex]
        newSource = lines.join('\n')
      } else {
        newSource = targetNode.source + '\n' + streamText[charIndex]
      }

      charIndex++
      st.updateNodeSource(targetNodeId, newSource)
      invalidateLayout(targetNodeId, newSource)
    }, 30)
  }, [])

  return (
    <div
      style={{
        position: 'fixed',
        right: 0,
        top: 0,
        width: 280,
        height: '100%',
        background: '#12121a',
        borderLeft: '1px solid #2a2a4a',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 10,
        color: '#ccc',
        fontFamily: 'Inter, sans-serif',
        fontSize: 13,
      }}
    >
      <div
        style={{
          padding: '14px 16px',
          borderBottom: '1px solid #2a2a4a',
          fontWeight: 600,
          fontSize: 14,
          color: '#fff',
        }}
      >
        Inspector
      </div>
      <div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'auto' }}>
        {selectedNode ? (
          <>
            <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>
              Node Source
            </div>
            <textarea
              value={localSource}
              onChange={handleSourceChange}
              spellCheck={false}
              style={{
                flex: 1,
                minHeight: 200,
                background: '#1a1a2e',
                color: '#e0e0e0',
                border: '1px solid #2a2a4a',
                borderRadius: 4,
                padding: 10,
                font: NODE_FONT,
                resize: 'vertical',
                outline: 'none',
              }}
            />
          </>
        ) : (
          <div style={{ color: '#666', marginTop: 20, textAlign: 'center' }}>
            Select a node to inspect
          </div>
        )}
        <button
          onClick={handleStreamText}
          style={{
            padding: '8px 16px',
            background: '#2a2a5a',
            color: '#ccc',
            border: '1px solid #3a3a6a',
            borderRadius: 4,
            cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
            fontSize: 13,
            marginTop: 8,
          }}
        >
          Stream Text
        </button>
        <PerfMonitor />
        <ChaosSlider />
      </div>
    </div>
  )
}

export function OverlayLayer() {
  const viewport = useStore(s => s.viewport)
  const editingParam = useStore(s => s.editingParam)
  const editingNodeId = useStore(s => s.editingNodeId)

  return (
    <>
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          transformOrigin: '0 0',
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          pointerEvents: (editingParam || editingNodeId) ? 'auto' : 'none',
        }}
      >
        <ParamTextarea />
        <NodeSourceTextarea />
      </div>
      <InspectorPanel />
    </>
  )
}
