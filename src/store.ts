import { create } from 'zustand'
import type { NodeData, EdgeData } from './types'
import { initialNodes, initialEdges } from './sampleNodes'

interface DraggingEdge {
  fromNode: string
  fromPort: string
  wx: number
  wy: number
}

interface EditingParam {
  nodeId: string
  paramName: string
}

interface Viewport {
  x: number
  y: number
  zoom: number
}

interface StoreState {
  nodes: Record<string, NodeData>
  edges: EdgeData[]
  viewport: Viewport
  selectedNodeId: string | null
  editingParam: EditingParam | null
  editingNodeId: string | null
  draggingEdge: DraggingEdge | null
  chaosIntensity: number
  history: Array<{ nodes: Record<string, NodeData>; edges: EdgeData[] }>
  historyIndex: number

  moveNode: (id: string, x: number, y: number) => void
  resizeNode: (id: string, width: number, x?: number) => void
  setNodeMinHeight: (id: string, minHeight: number) => void
  updateNodeSource: (id: string, source: string) => void
  addEdge: (fromNode: string, fromPort: string, toNode: string, toPort: string) => void
  removeEdge: (id: string) => void
  selectNode: (id: string | null) => void
  setEditingParam: (p: EditingParam | null) => void
  setEditingNode: (id: string | null) => void
  addNode: (source: string, x: number, y: number) => void
  setDraggingEdge: (e: DraggingEdge | null) => void
  setChaosIntensity: (v: number) => void
  setNodePositions: (positions: Record<string, { x: number; y: number }>) => void
  loadGraph: (nodes: Record<string, NodeData>, edges: EdgeData[]) => void
  panViewport: (dx: number, dy: number) => void
  zoomViewport: (delta: number, cx: number, cy: number) => void
  pushHistory: () => void
  undo: () => void
  redo: () => void
}

export const useStore = create<StoreState>((set) => ({
  nodes: initialNodes,
  edges: initialEdges,
  viewport: { x: 0, y: 0, zoom: 1 },
  selectedNodeId: null,
  editingParam: null,
  editingNodeId: null,
  draggingEdge: null,
  chaosIntensity: 0,
  history: [{ nodes: structuredClone(initialNodes), edges: structuredClone(initialEdges) }],
  historyIndex: 0,

  moveNode: (id, x, y) =>
    set((state) => ({
      nodes: {
        ...state.nodes,
        [id]: { ...state.nodes[id], x, y },
      },
    })),

  resizeNode: (id, width, x?) =>
    set((state) => ({
      nodes: {
        ...state.nodes,
        [id]: { ...state.nodes[id], width, ...(x !== undefined ? { x } : {}) },
      },
    })),

  setNodeMinHeight: (id, minHeight) =>
    set((state) => ({
      nodes: {
        ...state.nodes,
        [id]: { ...state.nodes[id], minHeight },
      },
    })),

  updateNodeSource: (id, source) =>
    set((state) => ({
      nodes: {
        ...state.nodes,
        [id]: { ...state.nodes[id], source },
      },
    })),

  addEdge: (fromNode, fromPort, toNode, toPort) =>
    set((state) => {
      const duplicate = state.edges.some(
        (e) =>
          e.fromNode === fromNode &&
          e.fromPort === fromPort &&
          e.toNode === toNode &&
          e.toPort === toPort
      )
      if (duplicate) return state
      const id = `e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      return {
        edges: [...state.edges, { id, fromNode, fromPort, toNode, toPort }],
      }
    }),

  removeEdge: (id) =>
    set((state) => ({
      edges: state.edges.filter((e) => e.id !== id),
    })),

  selectNode: (id) => set({ selectedNodeId: id }),

  setEditingParam: (p) => set({ editingParam: p }),

  setEditingNode: (id) => set({ editingNodeId: id }),

  addNode: (source, x, y) => {
    const id = `n-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    set((state) => ({
      nodes: { ...state.nodes, [id]: { id, source, x, y } },
      selectedNodeId: id,
    }))
  },

  setDraggingEdge: (e) => set({ draggingEdge: e }),

  setChaosIntensity: (v) => set({ chaosIntensity: v }),

  setNodePositions: (positions) =>
    set((state) => {
      const nodes = { ...state.nodes }
      for (const id in positions) {
        if (nodes[id]) {
          nodes[id] = { ...nodes[id], ...positions[id] }
        }
      }
      return { nodes }
    }),

  loadGraph: (nodes, edges) =>
    set({
      nodes,
      edges,
      selectedNodeId: null,
      editingParam: null,
      editingNodeId: null,
      draggingEdge: null,
    }),

  panViewport: (dx, dy) =>
    set((state) => ({
      viewport: {
        ...state.viewport,
        x: state.viewport.x + dx,
        y: state.viewport.y + dy,
      },
    })),

  zoomViewport: (delta, cx, cy) =>
    set((state) => {
      const oldZoom = state.viewport.zoom
      const newZoom = Math.min(3, Math.max(0.1, oldZoom + delta))
      const scale = newZoom / oldZoom
      return {
        viewport: {
          x: cx - (cx - state.viewport.x) * scale,
          y: cy - (cy - state.viewport.y) * scale,
          zoom: newZoom,
        },
      }
    }),

  pushHistory: () =>
    set((state) => {
      const snapshot = {
        nodes: structuredClone(state.nodes),
        edges: structuredClone(state.edges),
      }
      const newHistory = state.history.slice(0, state.historyIndex + 1)
      newHistory.push(snapshot)
      if (newHistory.length > 50) newHistory.shift()
      return {
        history: newHistory,
        historyIndex: Math.min(newHistory.length - 1, state.historyIndex + 1),
      }
    }),

  undo: () =>
    set((state) => {
      if (state.historyIndex <= 0) return state
      const newIndex = state.historyIndex - 1
      const snapshot = state.history[newIndex]
      return {
        nodes: structuredClone(snapshot.nodes),
        edges: structuredClone(snapshot.edges),
        historyIndex: newIndex,
        selectedNodeId: null,
        editingParam: null,
      }
    }),

  redo: () =>
    set((state) => {
      if (state.historyIndex >= state.history.length - 1) return state
      const newIndex = state.historyIndex + 1
      const snapshot = state.history[newIndex]
      return {
        nodes: structuredClone(snapshot.nodes),
        edges: structuredClone(snapshot.edges),
        historyIndex: newIndex,
        selectedNodeId: null,
        editingParam: null,
      }
    }),
}))
