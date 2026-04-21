import type { NodeData, NodeLayout } from './types'

export let activeChaos: NodePhysics | null = null
export function setActiveChaos(p: NodePhysics | null) { activeChaos = p }

const CHAOS_SPEED = 18
const RESTITUTION = 0.85
const SPRING = 0.1
const DAMPING = 0.85

export interface Bounds {
  left: number
  top: number
  right: number
  bottom: number
}

export interface NodePhysics {
  ids: string[]
  homeX: Float32Array
  homeY: Float32Array
  posX: Float32Array
  posY: Float32Array
  velX: Float32Array
  velY: Float32Array
  w: Float32Array
  h: Float32Array
  count: number
  mode: 'chaos' | 'restore' | 'idle'
  bounds: Bounds
}

export function createNodePhysics(
  nodes: Record<string, NodeData>,
  layouts: Map<string, NodeLayout>,
  bounds: Bounds,
): NodePhysics {
  const ids = Object.keys(nodes)
  const count = ids.length
  const p: NodePhysics = {
    ids,
    homeX: new Float32Array(count),
    homeY: new Float32Array(count),
    posX: new Float32Array(count),
    posY: new Float32Array(count),
    velX: new Float32Array(count),
    velY: new Float32Array(count),
    w: new Float32Array(count),
    h: new Float32Array(count),
    count,
    mode: 'idle',
    bounds,
  }

  for (let i = 0; i < count; i++) {
    const node = nodes[ids[i]]
    const layout = layouts.get(ids[i])
    p.homeX[i] = node.x
    p.homeY[i] = node.y
    p.posX[i] = node.x
    p.posY[i] = node.y
    p.w[i] = layout?.width ?? 220
    p.h[i] = layout?.height ?? 100
  }

  return p
}

export function initChaos(physics: NodePhysics): void {
  physics.mode = 'chaos'
  for (let i = 0; i < physics.count; i++) {
    const angle = Math.random() * Math.PI * 2
    const speed = CHAOS_SPEED * (0.5 + Math.random())
    physics.velX[i] = Math.cos(angle) * speed
    physics.velY[i] = Math.sin(angle) * speed
  }
}

export function initRestore(physics: NodePhysics): void {
  physics.mode = 'restore'
}

export function stepNodePhysics(physics: NodePhysics, intensity: number = 0): boolean {
  if (physics.mode === 'idle') return false

  const count = physics.count
  const posX = physics.posX
  const posY = physics.posY
  const velX = physics.velX
  const velY = physics.velY
  const w = physics.w
  const h = physics.h

  if (physics.mode === 'chaos') {
    for (let i = 0; i < count; i++) {
      posX[i] += velX[i]
      posY[i] += velY[i]
    }

    for (let i = 0; i < count; i++) {
      for (let j = i + 1; j < count; j++) {
        const ax = posX[i], ay = posY[i], aw = w[i], ah = h[i]
        const bx = posX[j], by = posY[j], bw = w[j], bh = h[j]

        if (ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by) {
          const overlapX = Math.min(ax + aw - bx, bx + bw - ax)
          const overlapY = Math.min(ay + ah - by, by + bh - ay)

          if (overlapX < overlapY) {
            const sign = ax < bx ? -1 : 1
            posX[i] += sign * overlapX * 0.5
            posX[j] -= sign * overlapX * 0.5
            const tmpVx = velX[i]
            velX[i] = velX[j] * RESTITUTION
            velX[j] = tmpVx * RESTITUTION
          } else {
            const sign = ay < by ? -1 : 1
            posY[i] += sign * overlapY * 0.5
            posY[j] -= sign * overlapY * 0.5
            const tmpVy = velY[i]
            velY[i] = velY[j] * RESTITUTION
            velY[j] = tmpVy * RESTITUTION
          }
        }
      }
    }

    if (intensity > 0) {
      const kick = intensity * 0.4
      for (let i = 0; i < count; i++) {
        velX[i] += (Math.random() - 0.5) * kick
        velY[i] += (Math.random() - 0.5) * kick
      }
    }

    const { left, top, right, bottom } = physics.bounds
    for (let i = 0; i < count; i++) {
      if (posX[i] < left) {
        posX[i] = left
        velX[i] = Math.abs(velX[i]) * RESTITUTION
      } else if (posX[i] + w[i] > right) {
        posX[i] = right - w[i]
        velX[i] = -Math.abs(velX[i]) * RESTITUTION
      }
      if (posY[i] < top) {
        posY[i] = top
        velY[i] = Math.abs(velY[i]) * RESTITUTION
      } else if (posY[i] + h[i] > bottom) {
        posY[i] = bottom - h[i]
        velY[i] = -Math.abs(velY[i]) * RESTITUTION
      }
    }

    return true
  }

  if (physics.mode === 'restore') {
    const homeX = physics.homeX
    const homeY = physics.homeY
    let maxVel = 0
    let maxDist = 0

    for (let i = 0; i < count; i++) {
      const dx = homeX[i] - posX[i]
      const dy = homeY[i] - posY[i]
      velX[i] = (velX[i] + dx * SPRING) * DAMPING
      velY[i] = (velY[i] + dy * SPRING) * DAMPING
      posX[i] += velX[i]
      posY[i] += velY[i]

      const avx = Math.abs(velX[i])
      const avy = Math.abs(velY[i])
      if (avx > maxVel) maxVel = avx
      if (avy > maxVel) maxVel = avy
      const adx = Math.abs(dx)
      const ady = Math.abs(dy)
      if (adx > maxDist) maxDist = adx
      if (ady > maxDist) maxDist = ady
    }

    if (maxVel < 0.01 && maxDist < 0.5) {
      for (let i = 0; i < count; i++) {
        posX[i] = homeX[i]
        posY[i] = homeY[i]
      }
      physics.mode = 'idle'
      return false
    }

    return true
  }

  return false
}

export function readPositions(physics: NodePhysics): Record<string, { x: number; y: number }> {
  const out: Record<string, { x: number; y: number }> = {}
  for (let i = 0; i < physics.count; i++) {
    out[physics.ids[i]] = { x: physics.posX[i], y: physics.posY[i] }
  }
  return out
}
