import type { ParsedLine } from './types'

const HEADER_RE = /^#\s+(.+)$/
const OUTPUT_PORT_RE = /^\[:([^\]>]+)>\]\s*(.*)$/
const INPUT_PORT_RE = /^\[:([^\]]+)\]\s*(.*)$/
const PARAM_RE = /^\{param:([^}]+)\}\s*(.*)$/
const DIVIDER_RE = /^-{3,}$/

export function parseNodeSource(source: string): ParsedLine[] {
  return source
    .split('\n')
    .map(line => {
      const trimmed = line.trim()
      let m: RegExpMatchArray | null

      if (trimmed === '') {
        return { type: 'prose' as const, text: '' }
      }

      if ((m = trimmed.match(HEADER_RE))) {
        return { type: 'header' as const, text: m[1] }
      }
      if ((m = trimmed.match(OUTPUT_PORT_RE))) {
        return { type: 'output-port' as const, portId: m[1], text: m[2] || m[1] }
      }
      if ((m = trimmed.match(INPUT_PORT_RE))) {
        return { type: 'input-port' as const, portId: m[1], text: m[2] || m[1] }
      }
      if ((m = trimmed.match(PARAM_RE))) {
        const full = m[2]
        const ci = full.indexOf(':')
        return {
          type: 'param' as const,
          paramName: m[1],
          text: full,
          paramValue: ci >= 0 ? full.slice(ci + 1).trim() : full,
        }
      }
      if (DIVIDER_RE.test(trimmed)) {
        return { type: 'divider' as const, text: '\u2015'.repeat(13) }
      }
      return { type: 'prose' as const, text: trimmed }
    })
}

export function updateParamInSource(source: string, paramName: string, newValue: string): string {
  return source
    .split('\n')
    .map(line => {
      const m = line.trim().match(PARAM_RE)
      if (m && m[1] === paramName) {
        const label = m[2].split(':')[0]
        return `{param:${paramName}} ${label}: ${newValue}`
      }
      return line
    })
    .join('\n')
}
