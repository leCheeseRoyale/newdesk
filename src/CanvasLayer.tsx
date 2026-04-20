import { useEffect, useRef } from 'react'
import { useStore } from './store'
import { getNodeLayout, getPortWorldPos } from './pretextLayout'
import {
  NODE_FONT,
  NODE_HEADER_FONT,
  NODE_PADDING_X,
  NODE_WIDTH,
  PORT_RADIUS,
  GRID_SIZE,
} from './types'
import type { NodeData, NodeLayout } from './types'

// ── Bitmap cache ────────────────────────────────────────────────
// Each non-active node is rendered once to an offscreen canvas,
// then stamped with a single drawImage call each frame.

const CACHE_SCALE = 2
const PAD = PORT_RADIUS + 2

interface CachedBitmap {
  canvas: HTMLCanvasElement
  w: number
  h: number
}

const bitmapCache = new Map<string, CachedBitmap>()

export function renderHeight(node: NodeData, layout: NodeLayout): number {
  return Math.max(layout.height, node.minHeight ?? 0)
}

function bitmapKey(node: NodeData): string {
  return `${node.width ?? NODE_WIDTH}::${node.minHeight ?? 0}::${node.source}`
}

function getOrCreateBitmap(node: NodeData, layout: NodeLayout): CachedBitmap {
  const key = bitmapKey(node)
  const rh = renderHeight(node, layout)
  const cached = bitmapCache.get(key)
  if (cached && cached.w === layout.width && cached.h === rh) return cached

  const w = layout.width + PAD * 2
  const h = rh + PAD * 2
  const c = document.createElement('canvas')
  c.width = w * CACHE_SCALE
  c.height = h * CACHE_SCALE
  const octx = c.getContext('2d')!
  octx.scale(CACHE_SCALE, CACHE_SCALE)
  octx.translate(PAD, PAD)

  drawNodeInner(octx, 0, 0, layout, rh, false, null)

  const entry: CachedBitmap = { canvas: c, w: layout.width, h: rh }
  bitmapCache.set(key, entry)
  return entry
}

export function invalidateBitmapCache(node: NodeData) {
  bitmapCache.delete(bitmapKey(node))
}

// ── Drawing helpers ─────────────────────────────────────────────

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

function drawNodeInner(
  ctx: CanvasRenderingContext2D,
  nx: number, ny: number,
  layout: NodeLayout,
  rh: number,
  isSelected: boolean,
  editingParamName: string | null,
) {
  const w = layout.width
  const h = rh

  drawRoundedRect(ctx, nx, ny, w, h, 8)
  ctx.fillStyle = '#1a1a2e'
  ctx.fill()

  if (isSelected) {
    ctx.strokeStyle = '#4a6cf7'
    ctx.lineWidth = 2
  } else {
    ctx.strokeStyle = '#2a2a4a'
    ctx.lineWidth = 1
  }
  ctx.stroke()

  const firstLine = layout.displayLines[0]
  if (firstLine && firstLine.isHeader) {
    let headerEndY = firstLine.y + firstLine.lineHeight
    for (let i = 1; i < layout.displayLines.length; i++) {
      if (layout.displayLines[i].isHeader) {
        headerEndY = layout.displayLines[i].y + layout.displayLines[i].lineHeight
      } else break
    }
    ctx.save()
    drawRoundedRect(ctx, nx, ny, w, h, 8)
    ctx.clip()
    ctx.fillStyle = '#252545'
    ctx.fillRect(nx, ny, w, headerEndY)
    ctx.restore()
  }

  const contentWidth = w - 2 * NODE_PADDING_X
  for (const dl of layout.displayLines) {
    if (dl.isDivider) {
      ctx.beginPath()
      ctx.moveTo(nx + NODE_PADDING_X, ny + dl.y + dl.lineHeight / 2)
      ctx.lineTo(nx + NODE_PADDING_X + contentWidth, ny + dl.y + dl.lineHeight / 2)
      ctx.strokeStyle = '#333'
      ctx.lineWidth = 1
      ctx.stroke()
      continue
    }

    if (editingParamName) {
      const inEdit = layout.editableRegions.some(
        r => r.paramName === editingParamName &&
          dl.y >= r.y && dl.y < r.y + r.height,
      )
      if (inEdit) continue
    }

    ctx.font = dl.isHeader ? NODE_HEADER_FONT : NODE_FONT
    ctx.fillStyle = dl.isHeader ? '#e0e0e0' : '#b0b0b0'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText(dl.text, nx + NODE_PADDING_X, ny + dl.y + dl.lineHeight * 0.78)
  }

  for (const port of layout.ports) {
    ctx.beginPath()
    ctx.arc(nx + port.x, ny + port.y, PORT_RADIUS, 0, Math.PI * 2)
    ctx.fillStyle = port.type === 'output' ? '#4a6cf7' : '#2ecc71'
    ctx.fill()
  }

  // Resize grip — L-shaped dots at bottom-left corner
  ctx.fillStyle = '#555'
  const bx = nx + 4
  const by = ny + h - 4
  ctx.fillRect(bx, by, 2, 2)
  ctx.fillRect(bx + 4, by, 2, 2)
  ctx.fillRect(bx + 8, by, 2, 2)
  ctx.fillRect(bx, by - 4, 2, 2)
  ctx.fillRect(bx, by - 8, 2, 2)
}

function drawEdge(
  ctx: CanvasRenderingContext2D,
  fromX: number, fromY: number,
  toX: number, toY: number,
  dashed: boolean,
) {
  const dx = Math.min(Math.abs(toX - fromX) * 0.5, 100)
  ctx.beginPath()
  ctx.moveTo(fromX, fromY)
  ctx.bezierCurveTo(fromX + dx, fromY, toX - dx, toY, toX, toY)

  if (dashed) {
    ctx.setLineDash([6, 4])
    ctx.strokeStyle = '#4a6cf7aa'
  } else {
    ctx.setLineDash([])
    ctx.strokeStyle = '#4a6cf755'
  }
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.setLineDash([])
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  worldLeft: number, worldTop: number,
  worldRight: number, worldBottom: number,
  zoom: number,
) {
  if (zoom < 0.15) return
  const step = zoom < 0.4 ? GRID_SIZE * 5 : zoom < 0.7 ? GRID_SIZE * 2 : GRID_SIZE
  ctx.fillStyle = '#222'

  const startX = Math.floor(worldLeft / step) * step
  const startY = Math.floor(worldTop / step) * step
  for (let gx = startX; gx <= worldRight; gx += step) {
    for (let gy = startY; gy <= worldBottom; gy += step) {
      ctx.fillRect(gx - 1, gy - 1, 2, 2)
    }
  }
}

// ── Component ───────────────────────────────────────────────────

export function CanvasLayer() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let rafId = 0
    let dpr = window.devicePixelRatio || 1

    function resize() {
      if (!canvas) return
      const parent = canvas.parentElement
      if (!parent) return
      dpr = window.devicePixelRatio || 1
      const rect = parent.getBoundingClientRect()
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      canvas.style.width = rect.width + 'px'
      canvas.style.height = rect.height + 'px'
    }

    resize()
    const ro = new ResizeObserver(resize)
    const parent = canvas.parentElement
    if (parent) ro.observe(parent)

    function frame() {
      if (!canvas || !ctx) return
      const state = useStore.getState()
      const vp = state.viewport

      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.setTransform(dpr * vp.zoom, 0, 0, dpr * vp.zoom, dpr * vp.x, dpr * vp.y)

      const worldLeft = -vp.x / vp.zoom
      const worldTop = -vp.y / vp.zoom
      const worldRight = worldLeft + canvas.width / (dpr * vp.zoom)
      const worldBottom = worldTop + canvas.height / (dpr * vp.zoom)

      drawGrid(ctx, worldLeft, worldTop, worldRight, worldBottom, vp.zoom)

      const nodes = state.nodes
      for (const edge of state.edges) {
        const fromNode = nodes[edge.fromNode]
        const toNode = nodes[edge.toNode]
        if (!fromNode || !toNode) continue
        const from = getPortWorldPos(fromNode, edge.fromPort)
        const to = getPortWorldPos(toNode, edge.toPort)
        if (!from || !to) continue
        drawEdge(ctx, from.x, from.y, to.x, to.y, false)
      }

      for (const nodeId of Object.keys(nodes)) {
        const node = nodes[nodeId]
        const layout = getNodeLayout(node)
        const rh = renderHeight(node, layout)

        if (
          node.x + layout.width < worldLeft || node.x > worldRight ||
          node.y + rh < worldTop || node.y > worldBottom
        ) continue

        const isSelected = state.selectedNodeId === nodeId
        const isEditing = state.editingParam?.nodeId === nodeId

        if (isSelected || isEditing) {
          const editParamName = isEditing ? state.editingParam!.paramName : null
          drawNodeInner(ctx, node.x, node.y, layout, rh, isSelected, editParamName)
        } else {
          const bmp = getOrCreateBitmap(node, layout)
          ctx.drawImage(
            bmp.canvas,
            node.x - PAD, node.y - PAD,
            layout.width + PAD * 2, rh + PAD * 2,
          )
        }
      }

      if (state.draggingEdge) {
        const de = state.draggingEdge
        const fromNode = nodes[de.fromNode]
        if (fromNode) {
          const from = getPortWorldPos(fromNode, de.fromPort)
          if (from) drawEdge(ctx, from.x, from.y, de.wx, de.wy, true)
        }
      }

      rafId = requestAnimationFrame(frame)
    }

    rafId = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(rafId); ro.disconnect() }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', width: '100%', height: '100%', pointerEvents: 'none' }}
    />
  )
}
