import { useRef, useCallback, useEffect } from 'react'
import { useStore } from './store'
import { CanvasLayer } from './CanvasLayer'
import { OverlayLayer } from './OverlayLayer'
import { getNodeLayout, getPortWorldPos } from './pretextLayout'
import { PORT_RADIUS, GRID_SIZE, NODE_WIDTH } from './types'
import { invalidateBitmapCache, renderHeight } from './CanvasLayer'
import type { NodeData, EdgeData } from './types'

type ResizeMode = 'horizontal' | 'vertical' | 'diagonal'

// ── Hit-testing helpers ──────────────────────────────────────────

function screenToWorld(sx: number, sy: number, viewport: { x: number; y: number; zoom: number }) {
  return {
    x: (sx - viewport.x) / viewport.zoom,
    y: (sy - viewport.y) / viewport.zoom,
  }
}

function hitTestPort(
  wx: number,
  wy: number,
  nodes: Record<string, NodeData>,
): { nodeId: string; portId: string; type: 'input' | 'output' } | null {
  const threshold = PORT_RADIUS * 2
  for (const id in nodes) {
    const node = nodes[id]
    const layout = getNodeLayout(node)
    for (const port of layout.ports) {
      const px = node.x + port.x
      const py = node.y + port.y
      const dx = wx - px
      const dy = wy - py
      if (dx * dx + dy * dy <= threshold * threshold) {
        return { nodeId: id, portId: port.portId, type: port.type }
      }
    }
  }
  return null
}

function hitTestEditableRegion(
  wx: number,
  wy: number,
  nodes: Record<string, NodeData>,
): { nodeId: string; paramName: string } | null {
  for (const id in nodes) {
    const node = nodes[id]
    const layout = getNodeLayout(node)
    for (const region of layout.editableRegions) {
      const rx = node.x + region.x
      const ry = node.y + region.y
      if (wx >= rx && wx <= rx + region.width && wy >= ry && wy <= ry + region.height) {
        return { nodeId: id, paramName: region.paramName }
      }
    }
  }
  return null
}

function hitTestNode(
  wx: number,
  wy: number,
  nodes: Record<string, NodeData>,
): string | null {
  for (const id in nodes) {
    const node = nodes[id]
    const layout = getNodeLayout(node)
    const rh = renderHeight(node, layout)
    if (wx >= node.x && wx <= node.x + layout.width && wy >= node.y && wy <= node.y + rh) {
      return id
    }
  }
  return null
}

function hitTestResize(
  wx: number,
  wy: number,
  nodes: Record<string, NodeData>,
): { nodeId: string; mode: ResizeMode } | null {
  const zone = 10
  const corner = 16
  for (const id in nodes) {
    const node = nodes[id]
    const layout = getNodeLayout(node)
    const rh = renderHeight(node, layout)
    const leftEdge = node.x
    const bottom = node.y + rh

    const nearLeft = wx >= leftEdge - zone && wx <= leftEdge + zone && wy >= node.y && wy <= bottom
    const nearBottom = wy >= bottom - zone && wy <= bottom + zone && wx >= leftEdge && wx <= node.x + layout.width
    const nearCorner = wx <= leftEdge + corner && wy >= bottom - corner

    if (nearLeft && nearBottom && nearCorner) return { nodeId: id, mode: 'diagonal' }
    if (nearLeft) return { nodeId: id, mode: 'horizontal' }
    if (nearBottom) return { nodeId: id, mode: 'vertical' }
  }
  return null
}

function hitTestEdge(
  wx: number,
  wy: number,
  edges: EdgeData[],
  nodes: Record<string, NodeData>,
): string | null {
  const threshold = 10
  for (const edge of edges) {
    const fromNode = nodes[edge.fromNode]
    const toNode = nodes[edge.toNode]
    if (!fromNode || !toNode) continue

    const fromPos = getPortWorldPos(fromNode, edge.fromPort)
    const toPos = getPortWorldPos(toNode, edge.toPort)
    if (!fromPos || !toPos) continue

    // Sample points along a cubic bezier
    const cpOffset = Math.abs(toPos.x - fromPos.x) * 0.5 + 40
    const cp1x = fromPos.x + cpOffset
    const cp1y = fromPos.y
    const cp2x = toPos.x - cpOffset
    const cp2y = toPos.y

    for (let t = 0; t <= 1; t += 0.1) {
      const it = 1 - t
      const bx = it * it * it * fromPos.x + 3 * it * it * t * cp1x + 3 * it * t * t * cp2x + t * t * t * toPos.x
      const by = it * it * it * fromPos.y + 3 * it * it * t * cp1y + 3 * it * t * t * cp2y + t * t * t * toPos.y
      const dx = wx - bx
      const dy = wy - by
      if (dx * dx + dy * dy <= threshold * threshold) {
        return edge.id
      }
    }
  }
  return null
}

// ── App ──────────────────────────────────────────────────────────

export function App() {
  const containerRef = useRef<HTMLDivElement>(null)

  // Ephemeral interaction state in refs
  const isPanning = useRef(false)
  const dragNodeId = useRef<string | null>(null)
  const dragStartWX = useRef(0)
  const dragStartWY = useRef(0)
  const nodeStartX = useRef(0)
  const nodeStartY = useRef(0)
  const lastMouseX = useRef(0)
  const lastMouseY = useRef(0)
  const spaceHeld = useRef(false)
  const didDrag = useRef(false)
  const resizingNodeId = useRef<string | null>(null)
  const resizeMode = useRef<ResizeMode | null>(null)

  // Track space key via window listeners so it works regardless of focus
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault()
        spaceHeld.current = true
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceHeld.current = false
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  const getScreenCoords = useCallback((e: React.MouseEvent) => {
    const rect = containerRef.current!.getBoundingClientRect()
    return { sx: e.clientX - rect.left, sy: e.clientY - rect.top }
  }, [])

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return
    const { sx, sy } = getScreenCoords(e)
    lastMouseX.current = e.clientX
    lastMouseY.current = e.clientY
    didDrag.current = false
    const vp = useStore.getState().viewport

    // Pan: space+left click or middle mouse
    if ((e.button === 0 && spaceHeld.current) || e.button === 1) {
      e.preventDefault()
      isPanning.current = true
      return
    }

    if (e.button !== 0) return

    // Ignore if editing param
    const store = useStore.getState()
    if (store.editingParam) return

    const { x: wx, y: wy } = screenToWorld(sx, sy, vp)
    const nodes = store.nodes

    // 1. Port hit test
    const portHit = hitTestPort(wx, wy, nodes)
    if (portHit) {
      if (portHit.type === 'output') {
        store.setDraggingEdge({
          fromNode: portHit.nodeId,
          fromPort: portHit.portId,
          wx,
          wy,
        })
        return
      }
      // Input ports are drop targets only
      return
    }

    // 2. Resize handle (left edge / bottom edge / corner)
    const resizeHit = hitTestResize(wx, wy, nodes)
    if (resizeHit) {
      store.selectNode(resizeHit.nodeId)
      resizingNodeId.current = resizeHit.nodeId
      resizeMode.current = resizeHit.mode
      return
    }

    // 3. Editable region — ignore click, handled by double-click
    const regionHit = hitTestEditableRegion(wx, wy, nodes)
    if (regionHit) {
      store.selectNode(regionHit.nodeId)
      return
    }

    // 4. Node body
    const nodeHit = hitTestNode(wx, wy, nodes)
    if (nodeHit) {
      store.selectNode(nodeHit)
      dragNodeId.current = nodeHit
      dragStartWX.current = wx
      dragStartWY.current = wy
      const hitNode = nodes[nodeHit]
      nodeStartX.current = hitNode.x
      nodeStartY.current = hitNode.y
      return
    }

    // 4. Nothing hit — deselect
    store.selectNode(null)
  }, [getScreenCoords])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const dx = e.clientX - lastMouseX.current
    const dy = e.clientY - lastMouseY.current
    lastMouseX.current = e.clientX
    lastMouseY.current = e.clientY

    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
      didDrag.current = true
    }

    // Panning (screen-space deltas)
    if (isPanning.current) {
      useStore.getState().panViewport(dx, dy)
      return
    }

    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    const vp = useStore.getState().viewport
    const { x: wx, y: wy } = screenToWorld(sx, sy, vp)

    // Resizing a node — snap to grid
    if (resizingNodeId.current && resizeMode.current) {
      const st = useStore.getState()
      const node = st.nodes[resizingNodeId.current]
      if (node) {
        const layout = getNodeLayout(node)
        const currentWidth = node.width ?? NODE_WIDTH
        const rightEdge = node.x + currentWidth
        const minW = GRID_SIZE * 5
        const mode = resizeMode.current

        invalidateBitmapCache(node)

        if (mode === 'horizontal' || mode === 'diagonal') {
          const snappedX = Math.round(wx / GRID_SIZE) * GRID_SIZE
          const newWidth = Math.max(minW, rightEdge - snappedX)
          const newX = rightEdge - newWidth
          st.resizeNode(resizingNodeId.current, newWidth, newX)
        }

        if (mode === 'vertical' || mode === 'diagonal') {
          const rawH = wy - node.y
          const snappedH = Math.max(layout.height, Math.round(rawH / GRID_SIZE) * GRID_SIZE)
          st.setNodeMinHeight(resizingNodeId.current, snappedH)
        }
      }
      return
    }

    // Dragging a node
    if (dragNodeId.current) {
      const newX = nodeStartX.current + (wx - dragStartWX.current)
      const newY = nodeStartY.current + (wy - dragStartWY.current)
      useStore.getState().moveNode(dragNodeId.current, newX, newY)
      return
    }

    // Dragging an edge
    const store = useStore.getState()
    if (store.draggingEdge) {
      store.setDraggingEdge({ ...store.draggingEdge, wx, wy })
      return
    }

    // Cursor hint for resize zones
    if (containerRef.current) {
      const rz = hitTestResize(wx, wy, store.nodes)
      if (rz) {
        const cursors: Record<ResizeMode, string> = {
          horizontal: 'ew-resize',
          vertical: 'ns-resize',
          diagonal: 'nesw-resize',
        }
        containerRef.current.style.cursor = cursors[rz.mode]
      } else {
        containerRef.current.style.cursor = ''
      }
    }
  }, [])

  const onMouseUp = useCallback((e: React.MouseEvent) => {
    // End panning
    if (isPanning.current) {
      isPanning.current = false
      return
    }

    const store = useStore.getState()

    // End edge drag
    if (store.draggingEdge) {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        const sx = e.clientX - rect.left
        const sy = e.clientY - rect.top
        const vp = store.viewport
        const { x: wx, y: wy } = screenToWorld(sx, sy, vp)

        const portHit = hitTestPort(wx, wy, store.nodes)
        if (portHit && portHit.type === 'input') {
          store.addEdge(
            store.draggingEdge.fromNode,
            store.draggingEdge.fromPort,
            portHit.nodeId,
            portHit.portId,
          )
        }
      }
      store.setDraggingEdge(null)
      dragNodeId.current = null
      return
    }

    // End resize
    if (resizingNodeId.current) {
      resizingNodeId.current = null
      resizeMode.current = null
      return
    }

    // End node drag
    if (dragNodeId.current) {
      dragNodeId.current = null
      return
    }

    // Click on edge to delete (only if no drag occurred)
    if (!didDrag.current && e.button === 0 && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      const vp = store.viewport
      const { x: wx, y: wy } = screenToWorld(sx, sy, vp)

      const edgeHit = hitTestEdge(wx, wy, store.edges, store.nodes)
      if (edgeHit) {
        store.removeEdge(edgeHit)
      }
    }
  }, [])

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    useStore.getState().zoomViewport(-e.deltaY * 0.001, sx, sy)
  }, [])

  const onDoubleClick = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return
    const { sx, sy } = getScreenCoords(e)
    const vp = useStore.getState().viewport
    const { x: wx, y: wy } = screenToWorld(sx, sy, vp)
    const store = useStore.getState()

    const regionHit = hitTestEditableRegion(wx, wy, store.nodes)
    if (regionHit) {
      store.setEditingParam({ nodeId: regionHit.nodeId, paramName: regionHit.paramName })
    }
  }, [getScreenCoords])

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onWheel={onWheel}
      onDoubleClick={onDoubleClick}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        outline: 'none',
      }}
    >
      <CanvasLayer />
      <OverlayLayer />
    </div>
  )
}
