import { prepareWithSegments, layoutWithLines, measureNaturalWidth } from '@chenglou/pretext'
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
    prepared = prepareWithSegments(text, font, { whiteSpace: 'pre-wrap' })
    prepareCache.set(key, prepared)
  }
  return prepared
}

const AUTO_WIDTH_MIN = 120
const AUTO_WIDTH_MAX = 400

export function computeNodeLayout(source: string, nodeWidth?: number): NodeLayout {
  const parsedLines = parseNodeSource(source)

  let width: number
  if (nodeWidth !== undefined) {
    width = nodeWidth
  } else {
    let maxNatural = 0
    for (const line of parsedLines) {
      if (line.type === 'divider' || line.text === '') continue
      const font = line.type === 'header' ? NODE_HEADER_FONT : NODE_FONT
      const prepared = getCachedPrepare(line.text, font)
      const natural = measureNaturalWidth(prepared)
      if (natural > maxNatural) maxNatural = natural
    }
    width = Math.min(AUTO_WIDTH_MAX, Math.max(AUTO_WIDTH_MIN, Math.ceil(maxNatural) + 2 * NODE_PADDING_X))
  }

  const contentWidth = width - 2 * NODE_PADDING_X

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

    if (text === '') {
      displayLines.push({ text: '', y, lineHeight, isHeader: false, isDivider: false })
      y += lineHeight
      continue
    }

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
        x: width,
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
    width,
    height,
    ports,
    editableRegions,
    parsedLines,
    displayLines,
  }
}

export function getNodeLayout(node: NodeData): NodeLayout {
  const w = node.width
  const key = w !== undefined ? `${w}::${node.source}` : `auto::${node.source}`
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

