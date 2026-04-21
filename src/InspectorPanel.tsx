import { useEffect, useState, useCallback } from 'react'
import { useStore } from './store'
import { NODE_FONT } from './types'
import { invalidateLayout, getNodeLayout, renderHeight } from './pretextLayout'

function nodeTitle(source: string): string {
  const m = source.match(/^#\s+(.+)$/m)
  return m ? m[1] : 'Untitled'
}

export function InspectorPanel() {
  const selectedNodeIds = useStore(s => s.selectedNodeIds)
  const nodes = useStore(s => s.nodes)
  const edges = useStore(s => s.edges)
  const selectedNodeId = selectedNodeIds[0] ?? null
  const selectedNode = selectedNodeId ? nodes[selectedNodeId] : null
  const [localSource, setLocalSource] = useState('')

  useEffect(() => {
    if (selectedNode) setLocalSource(selectedNode.source)
  }, [selectedNode?.source, selectedNodeId])

  const handleSourceChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newSource = e.target.value
    setLocalSource(newSource)
    if (selectedNodeId) {
      const store = useStore.getState()
      const node = store.nodes[selectedNodeId]
      if (node) invalidateLayout(node.source)
      store.updateNodeSource(selectedNodeId, newSource)
    }
  }, [selectedNodeId])

  const navigateToNode = useCallback((nodeId: string) => {
    const store = useStore.getState()
    store.selectNode(nodeId)
    const node = store.nodes[nodeId]
    if (!node) return
    const layout = getNodeLayout(node)
    const rh = renderHeight(node, layout)
    const vpW = window.innerWidth - 280
    const vpH = window.innerHeight
    const zoom = store.viewport.zoom
    store.setViewport({
      x: vpW / 2 - (node.x + layout.width / 2) * zoom,
      y: vpH / 2 - (node.y + rh / 2) * zoom,
      zoom,
    })
  }, [])

  const inEdges = selectedNodeId ? edges.filter(e => e.toNode === selectedNodeId) : []
  const outEdges = selectedNodeId ? edges.filter(e => e.fromNode === selectedNodeId) : []
  const connCount = inEdges.length + outEdges.length

  let layout: ReturnType<typeof getNodeLayout> | null = null
  if (selectedNode) layout = getNodeLayout(selectedNode)

  const nodeList = Object.values(nodes)

  return (
    <div style={{
      position: 'fixed', right: 0, top: 0, width: 280, height: '100%',
      background: '#12121a', borderLeft: '1px solid #2a2a4a',
      display: 'flex', flexDirection: 'column', zIndex: 5,
      color: '#ccc', fontFamily: 'Inter, sans-serif', fontSize: 13,
    }}>
      <div style={{
        height: 48, padding: '0 16px',
        borderBottom: '1px solid #2a2a4a',
        fontWeight: 600, fontSize: 14, color: '#fff',
        display: 'flex', alignItems: 'center',
      }}>
        {selectedNode ? nodeTitle(selectedNode.source) : 'Properties'}
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {selectedNode && layout ? (
          <>
            <Section label="Source">
              <textarea
                value={localSource}
                onChange={handleSourceChange}
                spellCheck={false}
                style={{
                  minHeight: 140, width: '100%',
                  background: '#1a1a2e', color: '#e0e0e0',
                  border: '1px solid #2a2a4a', borderRadius: 4,
                  padding: 10, font: NODE_FONT,
                  resize: 'vertical', outline: 'none',
                }}
              />
            </Section>

            <Section label="Layout">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <Field label="X" value={Math.round(selectedNode.x)} />
                <Field label="Y" value={Math.round(selectedNode.y)} />
                <Field label="W" value={Math.round(layout.width)} />
                <Field label="H" value={Math.round(renderHeight(selectedNode, layout))} />
              </div>
            </Section>

            <Section label="Ports">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {layout.ports.map(p => (
                  <div key={p.portId} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '4px 8px', fontSize: 12,
                  }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: 4, flexShrink: 0,
                      background: p.type === 'output' ? '#4a6cf7' : '#2ecc71',
                    }} />
                    <span style={{ color: '#aaa' }}>{p.portId}</span>
                    <span style={{ color: '#555', fontSize: 10, marginLeft: 'auto' }}>
                      {p.type}
                    </span>
                  </div>
                ))}
                {layout.ports.length === 0 && (
                  <span style={{ color: '#444', fontSize: 12, padding: '2px 8px' }}>None</span>
                )}
              </div>
            </Section>

            {connCount > 0 && (
              <Section label={`Connections (${connCount})`}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {inEdges.map(edge => {
                    const from = nodes[edge.fromNode]
                    if (!from) return null
                    return (
                      <ConnRow
                        key={edge.id}
                        direction="in"
                        title={nodeTitle(from.source)}
                        ports={`${edge.fromPort} → ${edge.toPort}`}
                        onClick={() => navigateToNode(edge.fromNode)}
                      />
                    )
                  })}
                  {outEdges.map(edge => {
                    const to = nodes[edge.toNode]
                    if (!to) return null
                    return (
                      <ConnRow
                        key={edge.id}
                        direction="out"
                        title={nodeTitle(to.source)}
                        ports={`${edge.fromPort} → ${edge.toPort}`}
                        onClick={() => navigateToNode(edge.toNode)}
                      />
                    )
                  })}
                </div>
              </Section>
            )}
          </>
        ) : (
          <Section label={`All Nodes (${nodeList.length})`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {nodeList.map(node => {
                const nl = getNodeLayout(node)
                const ins = nl.ports.filter(p => p.type === 'input').length
                const outs = nl.ports.filter(p => p.type === 'output').length
                return (
                  <NodeRow
                    key={node.id}
                    title={nodeTitle(node.source)}
                    inputs={ins}
                    outputs={outs}
                    onClick={() => navigateToNode(node.id)}
                  />
                )
              })}
            </div>
          </Section>
        )}
      </div>
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: '12px 16px', borderBottom: '1px solid #1a1a2e' }}>
      <div style={{
        fontSize: 10, color: '#555', textTransform: 'uppercase',
        letterSpacing: 1.2, fontWeight: 600, marginBottom: 8,
      }}>
        {label}
      </div>
      {children}
    </div>
  )
}

function Field({ label, value }: { label: string; value: number }) {
  return (
    <div style={{
      background: '#1a1a2e', borderRadius: 4, padding: '5px 10px',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      border: '1px solid #222240',
    }}>
      <span style={{ color: '#555', fontSize: 11 }}>{label}</span>
      <span style={{ color: '#999', fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{value}</span>
    </div>
  )
}

function ConnRow({ direction, title, ports, onClick }: {
  direction: 'in' | 'out'; title: string; ports: string; onClick: () => void
}) {
  const [h, setH] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 6, width: '100%',
        padding: '5px 8px', background: h ? '#1e1e38' : 'transparent',
        border: 'none', borderRadius: 4, cursor: 'pointer',
        fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#bbb', textAlign: 'left',
      }}
    >
      <span style={{
        color: direction === 'in' ? '#2ecc71' : '#4a6cf7',
        fontSize: 10, flexShrink: 0,
      }}>
        {direction === 'in' ? '←' : '→'}
      </span>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {title}
      </span>
      <span style={{ color: '#444', fontSize: 10, flexShrink: 0 }}>{ports}</span>
    </button>
  )
}

function NodeRow({ title, inputs, outputs, onClick }: {
  title: string; inputs: number; outputs: number; onClick: () => void
}) {
  const [h, setH] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 6, width: '100%',
        padding: '6px 8px', background: h ? '#1e1e38' : 'transparent',
        border: 'none', borderRadius: 4, cursor: 'pointer',
        fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#ccc', textAlign: 'left',
      }}
    >
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {title}
      </span>
      {inputs > 0 && <span style={{ color: '#2ecc71', fontSize: 10 }}>{inputs}in</span>}
      {outputs > 0 && <span style={{ color: '#4a6cf7', fontSize: 10 }}>{outputs}out</span>}
    </button>
  )
}
