import type { NodeData, EdgeData } from './types'

// Grid layout: ~300px spacing, 6 columns, 5-6 rows
const COL = 300
const ROW = 300

function col(c: number) { return 80 + c * COL }
function row(r: number) { return 60 + r * ROW }

// --- Color Input nodes (column 0-1) ---

const colorInputSource = (name: string, hex: string) =>
`# ${name}
{param:hex} Color: ${hex}
----
[:out>]  Color`

const n1: NodeData  = { id: 'n-1',  source: colorInputSource('Red', '#ff3333'),         x: col(0), y: row(0) }
const n2: NodeData  = { id: 'n-2',  source: colorInputSource('Green', '#33ff33'),       x: col(0), y: row(1) }
const n3: NodeData  = { id: 'n-3',  source: colorInputSource('Blue', '#3333ff'),        x: col(0), y: row(2) }
const n4: NodeData  = { id: 'n-4',  source: colorInputSource('Yellow', '#ffff33'),      x: col(0), y: row(3) }
const n5: NodeData  = { id: 'n-5',  source: colorInputSource('Cyan', '#33ffff'),        x: col(0), y: row(4) }
const n6: NodeData  = { id: 'n-6',  source: colorInputSource('Magenta', '#ff33ff'),     x: col(1), y: row(0) }
const n7: NodeData  = { id: 'n-7',  source: colorInputSource('Orange', '#ff9933'),      x: col(1), y: row(1) }
const n8: NodeData  = { id: 'n-8',  source: colorInputSource('Teal', '#339999'),        x: col(1), y: row(2) }
const n9: NodeData  = { id: 'n-9',  source: colorInputSource('Coral', '#ff7f50'),       x: col(1), y: row(3) }
const n10: NodeData = { id: 'n-10', source: colorInputSource('Lavender', '#b57edc'),    x: col(1), y: row(4) }

// --- Color Mix nodes (column 2-3) ---

const colorMixSource = (name: string, ratio: string) =>
`# ${name}
[:in-a]  Color A
[:in-b]  Color B
{param:ratio} Blend: ${ratio}
----
[:out>]  Result`

const n11: NodeData = { id: 'n-11', source: colorMixSource('Mix Colors', '0.5'),        x: col(2), y: row(0) }
const n12: NodeData = { id: 'n-12', source: colorMixSource('Mix Warm', '0.7'),           x: col(2), y: row(1) }
const n13: NodeData = { id: 'n-13', source: colorMixSource('Mix Cool', '0.3'),           x: col(2), y: row(2) }
const n14: NodeData = { id: 'n-14', source: colorMixSource('Mix Primary', '0.5'),        x: col(2), y: row(3) }
const n15: NodeData = { id: 'n-15', source: colorMixSource('Mix Accent', '0.6'),         x: col(3), y: row(0) }
const n16: NodeData = { id: 'n-16', source: colorMixSource('Mix Pastel', '0.4'),         x: col(3), y: row(1) }
const n17: NodeData = { id: 'n-17', source: colorMixSource('Mix Neon', '0.8'),           x: col(3), y: row(2) }

// --- Math nodes (column 2-3, lower rows) ---

const mathAddSource =
`# Add
[:a]  A
[:b]  B
----
[:out>]  Sum`

const mathMultiplySource =
`# Multiply
[:a]  A
[:b]  B
----
[:out>]  Product`

const mathSubtractSource =
`# Subtract
[:a]  A
[:b]  B
----
[:out>]  Difference`

const mathAverageSource =
`# Average
[:a]  A
[:b]  B
----
[:out>]  Mean`

const n18: NodeData = { id: 'n-18', source: mathAddSource,       x: col(3), y: row(3) }
const n19: NodeData = { id: 'n-19', source: mathMultiplySource,  x: col(3), y: row(4) }
const n20: NodeData = { id: 'n-20', source: mathSubtractSource,  x: col(2), y: row(4) }
const n21: NodeData = { id: 'n-21', source: mathAverageSource,   x: col(2), y: row(5) }

// --- Filter / Brightness nodes (column 3-4) ---

const filterSource = (name: string, amount: string) =>
`# ${name}
[:in]  Input
{param:amount} Amount: ${amount}
----
[:out>]  Output`

const n22: NodeData = { id: 'n-22', source: filterSource('Brightness', '1.2'),   x: col(4), y: row(0) }
const n23: NodeData = { id: 'n-23', source: filterSource('Saturation', '0.8'),   x: col(4), y: row(1) }
const n24: NodeData = { id: 'n-24', source: filterSource('Contrast', '1.5'),     x: col(4), y: row(2) }

// --- Display / Output nodes (column 5) ---

const displaySource = (label: string) =>
`# Display
[:in]  Input
{param:label} Label: ${label}
----
Final color value shown here.`

const n25: NodeData = { id: 'n-25', source: displaySource('Output 1'), x: col(5), y: row(0) }
const n26: NodeData = { id: 'n-26', source: displaySource('Output 2'), x: col(5), y: row(1) }
const n27: NodeData = { id: 'n-27', source: displaySource('Output 3'), x: col(5), y: row(2) }
const n28: NodeData = { id: 'n-28', source: displaySource('Output 4'), x: col(5), y: row(3) }
const n29: NodeData = { id: 'n-29', source: displaySource('Output 5'), x: col(5), y: row(4) }

// --- Text Stream / AI Response node ---

const n30: NodeData = {
  id: 'n-30',
  source: `# AI Response
[:in]  Prompt
{param:model} Model: gpt-4
----
[:out>]  Response

This text will stream in character by character to demonstrate that port positions and edges follow automatically as the node grows.`,
  x: col(4), y: row(3),
}

// --- Assemble nodes ---

export const initialNodes: Record<string, NodeData> = {}
const allNodes = [
  n1, n2, n3, n4, n5, n6, n7, n8, n9, n10,
  n11, n12, n13, n14, n15, n16, n17,
  n18, n19, n20, n21,
  n22, n23, n24,
  n25, n26, n27, n28, n29,
  n30,
]
for (const n of allNodes) {
  initialNodes[n.id] = n
}

// --- Edges (left-to-right flow) ---

export const initialEdges: EdgeData[] = [
  // Color inputs -> Mix nodes
  { id: 'e-1',  fromNode: 'n-1',  fromPort: 'out', toNode: 'n-11', toPort: 'in-a' },
  { id: 'e-2',  fromNode: 'n-2',  fromPort: 'out', toNode: 'n-11', toPort: 'in-b' },
  { id: 'e-3',  fromNode: 'n-3',  fromPort: 'out', toNode: 'n-13', toPort: 'in-a' },
  { id: 'e-4',  fromNode: 'n-5',  fromPort: 'out', toNode: 'n-13', toPort: 'in-b' },
  { id: 'e-5',  fromNode: 'n-4',  fromPort: 'out', toNode: 'n-12', toPort: 'in-a' },
  { id: 'e-6',  fromNode: 'n-7',  fromPort: 'out', toNode: 'n-12', toPort: 'in-b' },
  { id: 'e-7',  fromNode: 'n-6',  fromPort: 'out', toNode: 'n-15', toPort: 'in-a' },
  { id: 'e-8',  fromNode: 'n-8',  fromPort: 'out', toNode: 'n-15', toPort: 'in-b' },
  { id: 'e-9',  fromNode: 'n-9',  fromPort: 'out', toNode: 'n-16', toPort: 'in-a' },
  { id: 'e-10', fromNode: 'n-10', fromPort: 'out', toNode: 'n-16', toPort: 'in-b' },
  { id: 'e-11', fromNode: 'n-1',  fromPort: 'out', toNode: 'n-14', toPort: 'in-a' },
  { id: 'e-12', fromNode: 'n-3',  fromPort: 'out', toNode: 'n-14', toPort: 'in-b' },

  // Mix nodes -> Filter nodes
  { id: 'e-13', fromNode: 'n-11', fromPort: 'out', toNode: 'n-22', toPort: 'in' },
  { id: 'e-14', fromNode: 'n-12', fromPort: 'out', toNode: 'n-23', toPort: 'in' },
  { id: 'e-15', fromNode: 'n-13', fromPort: 'out', toNode: 'n-24', toPort: 'in' },

  // Filter nodes -> Display nodes
  { id: 'e-16', fromNode: 'n-22', fromPort: 'out', toNode: 'n-25', toPort: 'in' },
  { id: 'e-17', fromNode: 'n-23', fromPort: 'out', toNode: 'n-26', toPort: 'in' },
  { id: 'e-18', fromNode: 'n-24', fromPort: 'out', toNode: 'n-27', toPort: 'in' },

  // Mix directly -> Display
  { id: 'e-19', fromNode: 'n-15', fromPort: 'out', toNode: 'n-28', toPort: 'in' },
  { id: 'e-20', fromNode: 'n-16', fromPort: 'out', toNode: 'n-29', toPort: 'in' },

  // AI Response node: mix output -> prompt
  { id: 'e-21', fromNode: 'n-17', fromPort: 'out', toNode: 'n-30', toPort: 'in' },
]
