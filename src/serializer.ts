import type { NodeData, EdgeData } from './types'

export function serializeGraph(
  nodes: Record<string, NodeData>,
  edges: EdgeData[],
): string {
  const nodeBlocks = Object.values(nodes).map((node) => {
    let pos = `x=${Math.round(node.x)} y=${Math.round(node.y)}`
    if (node.width != null) pos += ` w=${Math.round(node.width)}`
    if (node.minHeight != null) pos += ` h=${Math.round(node.minHeight)}`
    return `[node:${node.id}]\n${pos}\n${node.source}`
  })

  const edgeLines = edges.map(
    (e) => `${e.fromNode}:${e.fromPort} -> ${e.toNode}:${e.toPort}`,
  )

  return nodeBlocks.join('\n===\n') + '\n===edges===\n' + edgeLines.join('\n')
}

export function deserializeGraph(
  text: string,
): { nodes: Record<string, NodeData>; edges: EdgeData[] } {
  const [nodeSection, edgeSection] = text.split('===edges===')
  const nodes: Record<string, NodeData> = {}

  if (nodeSection) {
    const blocks = nodeSection.split('\n===\n')
    for (const block of blocks) {
      const trimmed = block.trim()
      if (!trimmed) continue

      const lines = trimmed.split('\n')
      // First line: [node:ID]
      const idMatch = lines[0].match(/^\[node:(.+)\]$/)
      if (!idMatch) continue
      const id = idMatch[1]

      // Second line: x=N y=N [w=N] [h=N]
      const posLine = lines[1] || ''
      const xMatch = posLine.match(/x=(-?\d+)/)
      const yMatch = posLine.match(/y=(-?\d+)/)
      const wMatch = posLine.match(/w=(\d+)/)
      const hMatch = posLine.match(/h=(\d+)/)

      const x = xMatch ? parseInt(xMatch[1], 10) : 0
      const y = yMatch ? parseInt(yMatch[1], 10) : 0

      // Remaining lines are source
      const source = lines.slice(2).join('\n')

      const node: NodeData = { id, source, x, y }
      if (wMatch) node.width = parseInt(wMatch[1], 10)
      if (hMatch) node.minHeight = parseInt(hMatch[1], 10)

      nodes[id] = node
    }
  }

  const edges: EdgeData[] = []
  if (edgeSection) {
    const edgeLines = edgeSection.trim().split('\n')
    for (const line of edgeLines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      const match = trimmed.match(/^(.+):(.+) -> (.+):(.+)$/)
      if (!match) continue
      const id = `e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      edges.push({
        id,
        fromNode: match[1],
        fromPort: match[2],
        toNode: match[3],
        toPort: match[4],
      })
    }
  }

  return { nodes, edges }
}
