import { useRef } from 'react'
import { useStore } from './store'
import { NODE_FONT } from './types'
import { getNodeLayout, invalidateLayout } from './pretextLayout'
import { updateParamInSource } from './nodeParser'

export function ParamTextarea() {
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
      invalidateLayout(currentNode.source)
      const newSource = updateParamInSource(currentNode.source, editingParam.paramName, value)
      store.updateNodeSource(editingParam.nodeId, newSource)
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
