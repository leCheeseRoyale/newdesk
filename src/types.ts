export const NODE_FONT = '500 13px Inter'
export const NODE_HEADER_FONT = '600 14px Inter'
export const NODE_LINE_HEIGHT = 19
export const NODE_HEADER_LINE_HEIGHT = 22
export const NODE_WIDTH = 220
export const NODE_PADDING_X = 14
export const NODE_PADDING_Y = 10
export const PORT_RADIUS = 6
export const GRID_SIZE = 20

export interface NodeData {
  id: string
  source: string
  x: number
  y: number
  width?: number
  minHeight?: number
}

export interface EdgeData {
  id: string
  fromNode: string
  fromPort: string
  toNode: string
  toPort: string
}

export interface ParsedLine {
  type: 'header' | 'input-port' | 'output-port' | 'param' | 'divider' | 'prose' | 'media'
  text: string
  portId?: string
  paramName?: string
  paramValue?: string
  mediaUrl?: string
}

export interface PortLayout {
  x: number
  y: number
  type: 'input' | 'output'
  portId: string
}

export interface EditableRegion {
  x: number
  y: number
  width: number
  height: number
  paramName: string
  value: string
}

export interface DisplayLine {
  text: string
  y: number
  lineHeight: number
  isHeader: boolean
  isDivider: boolean
  isMedia?: boolean
  mediaUrl?: string
  mediaHeight?: number
}

export interface NodeLayout {
  width: number
  height: number
  ports: PortLayout[]
  editableRegions: EditableRegion[]
  parsedLines: ParsedLine[]
  displayLines: DisplayLine[]
  hasMedia: boolean
}
