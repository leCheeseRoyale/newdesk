# newdesk — hybrid node editor prototype

A canvas-based node graph editor using [@chenglou/pretext](https://github.com/chenglou/pretext) for all text measurement and layout. React handles overlays; canvas handles rendering; pretext is the bridge that keeps them in sync.

## Quick start

```bash
bun install && bun dev
```

## Architecture

Four layers, kept in sync by a shared coordinate system derived from pretext:

### 1. Canvas layer (`CanvasLayer.tsx`)
Single `<canvas>` with a `requestAnimationFrame` loop. Draws the grid, all node frames, all node text, all edges, and in-progress edge drags. Reads from the Zustand store each frame via `getState()` — no React re-renders involved. Viewport culling skips off-screen nodes.

### 2. Pretext layer (`pretextLayout.ts`)
Owns all interaction with `@chenglou/pretext`. When a node's source changes, parses it into lines, runs `prepareWithSegments` + `layoutWithLines` per line, and derives:
- **displayLines[]** — what canvas draws (text, y position, font info)
- **ports[]** — (x, y) positions derived from which line has a port marker
- **editableRegions[]** — bounding rects for `{param:...}` markers
- **height** — node auto-sizes to its text content

Caches layouts by source string. The `prepared` handle (expensive) is also cached per (text, font) pair.

### 3. DOM overlay layer (`OverlayLayer.tsx`)
React components positioned absolutely over the canvas. Renders only what's being interacted with:
- A `<textarea>` for inline parameter editing, positioned at the pretext-computed world coordinates
- An inspector panel showing the selected node's raw source

The overlay container applies the same viewport transform as the canvas (`translate + scale`), so world coordinates are the shared language.

### 4. Zustand store (`store.ts`)
The seam between canvas and React. Holds nodes, edges, viewport state, and interaction state (selection, editing, dragging). Both layers read from it; neither calls the other directly.

## Other files

| File | Concern |
|---|---|
| `types.ts` | Shared constants (`NODE_FONT`, dimensions) and interfaces |
| `nodeParser.ts` | Regex-per-line parser for the node source format |
| `sampleNodes.ts` | 30 initial nodes with 21 edges |
| `App.tsx` | Event handling: pan, zoom, node drag, edge creation, hit testing |
| `main.tsx` | Font loading gate + React mount |

## Node source format

```
# Mix Colors
[:in-a]  Color A
[:in-b]  Color B
{param:ratio} Blend: 0.5
----
[:out>]  Result
```

- `# Title` — header line
- `[:id]` — input port (left edge)
- `[:id>]` — output port (right edge)
- `{param:name} Label: value` — editable parameter (double-click to edit)
- `----` — visual divider

## Key design constraint

The DOM overlay's font string must match pretext's font string **exactly** — both derive from the `NODE_FONT` constant in `types.ts`. If they drift, the overlay text shifts visibly when it appears over canvas text.
