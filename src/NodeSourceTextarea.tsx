import { useStore } from './store'
import { NODE_FONT, NODE_PADDING_X, NODE_PADDING_Y, NODE_LINE_HEIGHT } from './types'
import { getNodeLayout, invalidateLayout, renderHeight } from './pretextLayout'

export function NodeSourceTextarea() {
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
        const n = store.nodes[editingNodeId]
        if (n) invalidateLayout(n.source)
        store.updateNodeSource(editingNodeId, e.target.value)
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
