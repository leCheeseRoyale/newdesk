import { useStore } from './store'
import { ParamTextarea } from './ParamTextarea'
import { NodeSourceTextarea } from './NodeSourceTextarea'
import { InspectorPanel } from './InspectorPanel'
import { DebugPanel } from './DebugPanel'
import { Toolbar } from './Toolbar'

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
      <Toolbar />
      <InspectorPanel />
      <DebugPanel />
    </>
  )
}
