import { useRef, useCallback, useEffect } from 'react'
import { useStore } from './store'
import { CanvasLayer } from './CanvasLayer'
import { OverlayLayer } from './OverlayLayer'
import { getNodeLayout } from './pretextLayout'
import { GRID_SIZE } from './types'
import { invalidateBitmapCache } from './CanvasLayer'
import { serializeGraph } from './serializer'
import { zoomToFit } from './Toolbar'
import { createNodePhysics, initChaos, initRestore, activeChaos, setActiveChaos } from './physics'
import { screenToWorld, hitTestPort, hitTestEditableRegion, hitTestNode, hitTestResize, hitTestEdge } from './hitTesting'
import type { ResizeMode } from './hitTesting'
import type { NodeLayout } from './types'

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
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault()
        if (e.shiftKey) {
          useStore.getState().redo()
        } else {
          useStore.getState().undo()
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
        e.preventDefault()
        useStore.getState().redo()
      }
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyC') {
        const st = useStore.getState()
        const copyNodeId = st.selectedNodeIds[0]
        if (copyNodeId && !st.editingParam) {
          e.preventDefault()
          navigator.clipboard.writeText(st.nodes[copyNodeId].source)
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyV') {
        const st = useStore.getState()
        if (!st.editingParam && !st.editingNodeId) {
          e.preventDefault()
          navigator.clipboard.readText().then((text) => {
            if (!text) return
            const vp = useStore.getState().viewport
            const cx = (-vp.x + window.innerWidth / 2) / vp.zoom + (Math.random() - 0.5) * 60
            const cy = (-vp.y + window.innerHeight / 2) / vp.zoom + (Math.random() - 0.5) * 60
            useStore.getState().addNode(text, cx, cy)
          })
        }
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const st = useStore.getState()
        if (st.editingParam || st.editingNodeId) return
        if (st.selectedNodeIds.length === 0) return
        st.pushHistory()
        for (const nid of [...st.selectedNodeIds]) {
          st.removeNode(nid)
        }
      }
      if (e.key === '(' && e.shiftKey) {
        e.preventDefault()
        useStore.getState().toggleDebugPanel()
      }
      if (e.code === 'KeyF' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const st = useStore.getState()
        if (st.editingParam || st.editingNodeId) return
        e.preventDefault()
        zoomToFit()
      }
      if (e.code === 'KeyJ' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        if (activeChaos && activeChaos.mode === 'chaos') {
          initRestore(activeChaos)
        } else if (!activeChaos || activeChaos.mode === 'idle') {
          const store = useStore.getState()
          if (store.editingParam || store.editingNodeId) return
          const layouts = new Map<string, NodeLayout>()
          for (const id in store.nodes) {
            layouts.set(id, getNodeLayout(store.nodes[id]))
          }
          const vp = store.viewport
          const rect = containerRef.current?.getBoundingClientRect()
          const vpW = rect?.width ?? window.innerWidth
          const vpH = rect?.height ?? window.innerHeight
          const bounds = {
            left: -vp.x / vp.zoom,
            top: -vp.y / vp.zoom,
            right: (-vp.x + vpW) / vp.zoom,
            bottom: (-vp.y + vpH) / vp.zoom,
          }
          const physics = createNodePhysics(store.nodes, layouts, bounds)
          initChaos(physics)
          setActiveChaos(physics)
        }
      }
      if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        const st = useStore.getState()
        const serialized = serializeGraph(st.nodes, st.edges)
        localStorage.setItem('newdesk-graph', serialized)
        if (e.shiftKey) {
          const hash = btoa(unescape(encodeURIComponent(serialized)))
          const url = `${window.location.origin}${window.location.pathname}#${hash}`
          navigator.clipboard.writeText(url)
        }
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

    // 5. Nothing hit — deselect
    store.clearSelection()
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
        const currentWidth = layout.width
        const rightEdge = node.x + currentWidth
        const minW = GRID_SIZE * 5
        const mode = resizeMode.current

        invalidateBitmapCache(node, layout)

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
          useStore.getState().pushHistory()
        }
      }
      store.setDraggingEdge(null)
      dragNodeId.current = null
      return
    }

    // End resize
    if (resizingNodeId.current) {
      useStore.getState().pushHistory()
      resizingNodeId.current = null
      resizeMode.current = null
      return
    }

    // End node drag
    if (dragNodeId.current) {
      useStore.getState().pushHistory()
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
        useStore.getState().pushHistory()
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
      return
    }

    const nodeHit = hitTestNode(wx, wy, store.nodes)
    if (nodeHit) {
      store.setEditingNode(nodeHit)
      return
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
