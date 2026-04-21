import { useState, useRef, useEffect, useCallback } from 'react'
import { useStore } from './store'
import { getNodeLayout, renderHeight } from './pretextLayout'

interface NodeTemplate {
  name: string
  category: string
  source: string
  description: string
}

const NODE_TEMPLATES: NodeTemplate[] = [
  {
    name: 'Blank',
    category: 'Basic',
    source: '# New Node\n[:in] Input\n[:out>] Output',
    description: 'One input, one output',
  },
  {
    name: 'Note',
    category: 'Basic',
    source: '# Note\nWrite your notes here.',
    description: 'Text only, no ports',
  },
  {
    name: 'Input',
    category: 'I/O',
    source: '# Input\n{param:value} Value: 0\n----\n[:out>] Output',
    description: 'Data source with editable value',
  },
  {
    name: 'Display',
    category: 'I/O',
    source: '# Display\n[:in] Input\n{param:label} Label: Output\n----\nResult shown here.',
    description: 'Data sink with label',
  },
  {
    name: 'Processor',
    category: 'Processing',
    source: '# Process\n[:in] Input\n{param:amount} Amount: 1.0\n----\n[:out>] Output',
    description: 'Transform with parameter',
  },
  {
    name: 'Combiner',
    category: 'Processing',
    source: '# Combine\n[:in-a] Input A\n[:in-b] Input B\n{param:ratio} Blend: 0.5\n----\n[:out>] Result',
    description: 'Blend two inputs',
  },
  {
    name: 'Math',
    category: 'Processing',
    source: '# Add\n[:a] A\n[:b] B\n----\n[:out>] Sum',
    description: 'Two-input operation',
  },
  {
    name: 'Media',
    category: 'I/O',
    source: '# Media\n!media https://example.com/image.png\n----\n[:out>] Output',
    description: 'Image or video embed',
  },
]

const CATEGORIES = [...new Set(NODE_TEMPLATES.map(t => t.category))]

function getViewportCenter() {
  const vp = useStore.getState().viewport
  const vpW = window.innerWidth - 280
  const cx = (-vp.x + vpW / 2) / vp.zoom
  const cy = (-vp.y + window.innerHeight / 2) / vp.zoom
  return { x: cx + (Math.random() - 0.5) * 60, y: cy + (Math.random() - 0.5) * 60 }
}

export function zoomToFit() {
  const store = useStore.getState()
  const ids = Object.keys(store.nodes)
  if (ids.length === 0) return

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const id of ids) {
    const node = store.nodes[id]
    const layout = getNodeLayout(node)
    const rh = renderHeight(node, layout)
    if (node.x < minX) minX = node.x
    if (node.y < minY) minY = node.y
    if (node.x + layout.width > maxX) maxX = node.x + layout.width
    if (node.y + rh > maxY) maxY = node.y + rh
  }

  const pad = 80
  minX -= pad; minY -= pad; maxX += pad; maxY += pad

  const graphW = maxX - minX
  const graphH = maxY - minY
  const vpW = window.innerWidth - 280
  const vpH = window.innerHeight

  const newZoom = Math.min(vpW / graphW, vpH / graphH, 1)
  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2

  store.setViewport({
    x: vpW / 2 - centerX * newZoom,
    y: vpH / 2 - centerY * newZoom,
    zoom: newZoom,
  })
}

export function Toolbar() {
  const [showTemplates, setShowTemplates] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const zoom = useStore(s => s.viewport.zoom)
  const historyIndex = useStore(s => s.historyIndex)
  const historyLength = useStore(s => s.history.length)
  const canUndo = historyIndex > 0
  const canRedo = historyIndex < historyLength - 1

  useEffect(() => {
    if (!showTemplates) return
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowTemplates(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showTemplates])

  useEffect(() => {
    if (!showTemplates) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowTemplates(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [showTemplates])

  const addFromTemplate = useCallback((source: string) => {
    const { x, y } = getViewportCenter()
    useStore.getState().addNode(source, x, y)
    useStore.getState().pushHistory()
    setShowTemplates(false)
  }, [])

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 280,
      height: 48,
      background: '#12121a',
      borderBottom: '1px solid #2a2a4a',
      display: 'flex',
      alignItems: 'center',
      padding: '0 8px',
      gap: 2,
      zIndex: 20,
      fontFamily: 'Inter, sans-serif',
      fontSize: 13,
    }}>
      {/* ── Add Node ── */}
      <div ref={dropdownRef} style={{ position: 'relative' }}>
        <TButton
          onClick={() => setShowTemplates(!showTemplates)}
          active={showTemplates}
          title="Add node"
        >
          <span style={{ fontSize: 15, marginRight: 4, fontWeight: 300 }}>+</span>
          Add
          <span style={{ fontSize: 9, marginLeft: 5, color: '#666' }}>▾</span>
        </TButton>

        {showTemplates && (
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            width: 240,
            background: '#1a1a2e',
            border: '1px solid #2a2a4a',
            borderRadius: 8,
            padding: '4px 0',
            zIndex: 30,
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          }}>
            {CATEGORIES.map(cat => (
              <div key={cat}>
                <div style={{
                  padding: '8px 14px 4px',
                  fontSize: 10,
                  color: '#555',
                  textTransform: 'uppercase',
                  letterSpacing: 1.2,
                  fontWeight: 600,
                }}>
                  {cat}
                </div>
                {NODE_TEMPLATES.filter(t => t.category === cat).map(t => (
                  <TemplateItem
                    key={t.name}
                    template={t}
                    onClick={() => addFromTemplate(t.source)}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      <Sep />

      {/* ── Undo / Redo ── */}
      <TButton
        onClick={() => useStore.getState().undo()}
        disabled={!canUndo}
        title="Undo (Ctrl+Z)"
      >
        ↩
      </TButton>
      <TButton
        onClick={() => useStore.getState().redo()}
        disabled={!canRedo}
        title="Redo (Ctrl+Shift+Z)"
      >
        ↪
      </TButton>

      <Sep />

      {/* ── Zoom ── */}
      <TButton
        onClick={() => {
          const cx = (window.innerWidth - 280) / 2
          useStore.getState().zoomViewport(-0.15, cx, window.innerHeight / 2)
        }}
        title="Zoom out"
      >
        −
      </TButton>
      <div style={{
        padding: '4px 6px',
        color: '#888',
        fontSize: 12,
        fontVariantNumeric: 'tabular-nums',
        minWidth: 44,
        textAlign: 'center',
        userSelect: 'none',
      }}>
        {Math.round(zoom * 100)}%
      </div>
      <TButton
        onClick={() => {
          const cx = (window.innerWidth - 280) / 2
          useStore.getState().zoomViewport(0.15, cx, window.innerHeight / 2)
        }}
        title="Zoom in"
      >
        +
      </TButton>
      <TButton onClick={zoomToFit} title="Zoom to fit all nodes (F)">
        Fit
      </TButton>
    </div>
  )
}

// ── Subcomponents ──────────────────────────────────────────

function TButton({ children, onClick, disabled, active, title }: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  active?: boolean
  title?: string
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '6px 10px',
        background: active ? '#252545' : (hovered && !disabled) ? '#1e1e38' : 'transparent',
        color: disabled ? '#444' : '#ccc',
        border: 'none',
        borderRadius: 6,
        cursor: disabled ? 'default' : 'pointer',
        fontFamily: 'Inter, sans-serif',
        fontSize: 13,
        fontWeight: 500,
        lineHeight: '1',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {children}
    </button>
  )
}

function Sep() {
  return <div style={{ width: 1, height: 20, background: '#2a2a4a', margin: '0 4px' }} />
}

function TemplateItem({ template, onClick }: { template: NodeTemplate; onClick: () => void }) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: '6px 14px',
        background: hovered ? '#252545' : 'transparent',
        border: 'none',
        borderRadius: 0,
        color: '#ccc',
        cursor: 'pointer',
        fontFamily: 'Inter, sans-serif',
        fontSize: 13,
      }}
    >
      <div style={{ fontWeight: 500 }}>{template.name}</div>
      <div style={{ fontSize: 11, color: '#666', marginTop: 1 }}>{template.description}</div>
    </button>
  )
}
