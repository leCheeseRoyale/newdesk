import { PORT_RADIUS } from './types'
import { getNodeLayout, getPortWorldPos, renderHeight } from './pretextLayout'
import type { NodeData, EdgeData } from './types'

export type ResizeMode = 'horizontal' | 'vertical' | 'diagonal'

export function screenToWorld(sx: number, sy: number, viewport: { x: number; y: number; zoom: number }) {
  return {
    x: (sx - viewport.x) / viewport.zoom,
    y: (sy - viewport.y) / viewport.zoom,
  }
}

export function hitTestPort(
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

export function hitTestEditableRegion(
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

export function hitTestNode(
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

export function hitTestResize(
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

export function hitTestEdge(
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
