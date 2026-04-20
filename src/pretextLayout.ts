import { prepareWithSegments, layoutWithLines } from '@chenglou/pretext'
import { parseNodeSource } from './nodeParser'
import type {
  NodeData,
  NodeLayout,
  ParsedLine,
  PortLayout,
  EditableRegion,
  DisplayLine,
} from './types'
import {
  NODE_FONT,
  NODE_HEADER_FONT,
  NODE_LINE_HEIGHT,
  NODE_HEADER_LINE_HEIGHT,
  NODE_WIDTH,
  NODE_PADDING_X,
  NODE_PADDING_Y,
} from './types'

const layoutCache = new Map<string, NodeLayout>()

const prepareCache = new Map<string, ReturnType<typeof prepareWithSegments>>()

function getCachedPrepare(text: string, font: string) {
  const key = `${font}::${text}`
  let prepared = prepareCache.get(key)
  if (!prepared) {
    prepared = prepareWithSegments(text, font)
    prepareCache.set(key, prepared)
  }
  return prepared
}

export function computeNodeLayout(source: string, nodeWidth: number = NODE_WIDTH): NodeLayout {
  const parsedLines = parseNodeSource(source)
  const contentWidth = nodeWidth - 2 * NODE_PADDING_X

  const ports: PortLayout[] = []
  const editableRegions: EditableRegion[] = []
  const displayLines: DisplayLine[] = []

  let y = NODE_PADDING_Y

  for (const line of parsedLines) {
    const isHeader = line.type === 'header'
    const isDivider = line.type === 'divider'
    const font = isHeader ? NODE_HEADER_FONT : NODE_FONT
    const lineHeight = isHeader ? NODE_HEADER_LINE_HEIGHT : NODE_LINE_HEIGHT

    if (isDivider) {
      displayLines.push({
        text: '',
        y,
        lineHeight: NODE_LINE_HEIGHT,
        isHeader: false,
        isDivider: true,
      })
      y += NODE_LINE_HEIGHT
      continue
    }

    const text = line.text
    const prepared = getCachedPrepare(text, font)
    const result = layoutWithLines(prepared, contentWidth, lineHeight)

    const blockStartY = y

    for (const resultLine of result.lines) {
      displayLines.push({
        text: resultLine.text,
        y,
        lineHeight,
        isHeader,
        isDivider: false,
      })
      y += lineHeight
    }

    if (result.lines.length === 0) {
      displayLines.push({
        text,
        y,
        lineHeight,
        isHeader,
        isDivider: false,
      })
      y += lineHeight
    }

    const centerOfFirstLineY = blockStartY + lineHeight / 2

    if (line.type === 'input-port' && line.portId) {
      ports.push({
        x: 0,
        y: centerOfFirstLineY,
        type: 'input',
        portId: line.portId,
      })
    }

    if (line.type === 'output-port' && line.portId) {
      ports.push({
        x: nodeWidth,
        y: centerOfFirstLineY,
        type: 'output',
        portId: line.portId,
      })
    }

    if (line.type === 'param' && line.paramName) {
      const blockHeight = y - blockStartY
      editableRegions.push({
        x: NODE_PADDING_X,
        y: blockStartY,
        width: contentWidth,
        height: blockHeight,
        paramName: line.paramName,
        value: line.paramValue ?? '',
      })
    }
  }

  const height = y + NODE_PADDING_Y

  return {
    width: nodeWidth,
    height,
    ports,
    editableRegions,
    parsedLines,
    displayLines,
  }
}

export function getNodeLayout(node: NodeData): NodeLayout {
  const w = node.width ?? NODE_WIDTH
  const key = `${w}::${node.source}`
  const cached = layoutCache.get(key)
  if (cached) return cached
  const layout = computeNodeLayout(node.source, w)
  layoutCache.set(key, layout)
  return layout
}

export function invalidateLayout(nodeId: string, source: string): void {
  layoutCache.delete(source)
}

export function getPortWorldPos(
  node: NodeData,
  portId: string
): { x: number; y: number } | null {
  const layout = getNodeLayout(node)
  const port = layout.ports.find((p) => p.portId === portId)
  if (!port) return null
  return { x: node.x + port.x, y: node.y + port.y }
}

export interface BenchmarkResult {
  pretextPrepareMs: number
  pretextLayoutMs: number
  pretextTotalMs: number
  domMs: number
  speedup: number
  nodeCount: number
  iterations: number
}

export function runBenchmark(nodes: Record<string, NodeData>, iterations = 50): BenchmarkResult {
  const nodeList = Object.values(nodes)
  const contentWidth = NODE_WIDTH - 2 * NODE_PADDING_X
  const sources = nodeList.map(n => parseNodeSource(n.source))

  // --- Pretext: prepare phase (cold — no cache) ---
  const tempPrepareCache: [string, string, ReturnType<typeof prepareWithSegments>][] = []
  const prepStart = performance.now()
  for (const parsed of sources) {
    for (const line of parsed) {
      if (line.type === 'divider') continue
      const font = line.type === 'header' ? NODE_HEADER_FONT : NODE_FONT
      const p = prepareWithSegments(line.text, font)
      tempPrepareCache.push([line.text, font, p])
    }
  }
  const prepEnd = performance.now()
  const pretextPrepareMs = prepEnd - prepStart

  // --- Pretext: layout phase (run many times, cheap) ---
  const layoutStart = performance.now()
  for (let i = 0; i < iterations; i++) {
    for (const [, , prepared] of tempPrepareCache) {
      layoutWithLines(prepared, contentWidth, NODE_LINE_HEIGHT)
    }
  }
  const layoutEnd = performance.now()
  const pretextLayoutMs = layoutEnd - layoutStart

  // --- DOM measurement baseline ---
  const measurer = document.createElement('div')
  measurer.style.cssText = `
    position:absolute; visibility:hidden; pointer-events:none;
    width:${contentWidth}px; font:${NODE_FONT};
    white-space:pre-wrap; word-break:break-word; line-height:${NODE_LINE_HEIGHT}px;
  `
  document.body.appendChild(measurer)

  const allTexts: { text: string; font: string }[] = []
  for (const parsed of sources) {
    for (const line of parsed) {
      if (line.type === 'divider') continue
      allTexts.push({
        text: line.text,
        font: line.type === 'header' ? NODE_HEADER_FONT : NODE_FONT,
      })
    }
  }

  const domStart = performance.now()
  for (let i = 0; i < iterations; i++) {
    for (const { text, font } of allTexts) {
      measurer.style.font = font
      measurer.textContent = text
      measurer.getBoundingClientRect()
    }
  }
  const domEnd = performance.now()
  const domMs = domEnd - domStart

  document.body.removeChild(measurer)

  const pretextTotalMs = pretextPrepareMs + pretextLayoutMs

  return {
    pretextPrepareMs: +pretextPrepareMs.toFixed(3),
    pretextLayoutMs: +pretextLayoutMs.toFixed(3),
    pretextTotalMs: +pretextTotalMs.toFixed(3),
    domMs: +domMs.toFixed(3),
    speedup: +(domMs / pretextTotalMs).toFixed(1),
    nodeCount: nodeList.length,
    iterations,
  }
}
