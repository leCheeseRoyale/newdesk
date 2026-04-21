# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development

```bash
bun install   # install dependencies
bun dev       # start Vite dev server (http://localhost:5173)
bun run build # production build to dist/
```

No tests, no linter, no CI. Vite + React 18 + TypeScript (strict). Uses `@chenglou/pretext` for all text measurement/layout.

## File map

| File | Lines | Purpose | Key exports |
|---|---|---|---|
| `types.ts` | 67 | Shared constants and interfaces | `NODE_FONT`, `NODE_HEADER_FONT`, `NODE_LINE_HEIGHT`, `NODE_WIDTH`, `NODE_PADDING_X`, `NODE_PADDING_Y`, `PORT_RADIUS`, `GRID_SIZE`, `NodeData`, `EdgeData`, `NodeLayout`, `ParsedLine`, `DisplayLine`, `PortLayout`, `EditableRegion` |
| `store.ts` | 245 | Zustand store — single source of truth for both canvas and React | `useStore` (contains `nodes`, `edges`, `viewport`, `selectedNodeIds`, editing/dragging state, undo/redo history, `removeNode`, `toggleSelectNode`, `clearSelection`) |
| `nodeParser.ts` | 58 | Regex-per-line parser for the node source DSL | `parseNodeSource(source) → ParsedLine[]`, `updateParamInSource(source, paramName, newValue) → string` |
| `pretextLayout.ts` | 193 | All pretext interaction: layout computation, caching, port/region derivation | `getNodeLayout(node) → NodeLayout`, `getPortWorldPos(node, portId)`, `computeNodeLayout(source, width?)`, `invalidateLayout(source)`, `renderHeight(node, layout)` |
| `hitTesting.ts` | 130 | Pure hit-testing functions for mouse interaction | `screenToWorld`, `hitTestPort`, `hitTestEditableRegion`, `hitTestNode`, `hitTestResize`, `hitTestEdge`, `ResizeMode` |
| `perfStats.ts` | 1 | Shared mutable perf stats object (written by CanvasLayer, read by InspectorPanel) | `perfStats` |
| `CanvasLayer.tsx` | 384 | Canvas rendering: grid, nodes (with bitmap cache), edges, dashed edge preview | `CanvasLayer`, `invalidateBitmapCache(node, layout)` |
| `ParamTextarea.tsx` | 74 | DOM overlay: textarea for inline parameter editing | `ParamTextarea` |
| `NodeSourceTextarea.tsx` | 61 | DOM overlay: textarea for full-node source editing | `NodeSourceTextarea` |
| `InspectorPanel.tsx` | 246 | Right sidebar: node source editor, stream text button, perf monitor, chaos slider | `InspectorPanel` (PerfMonitor + ChaosSlider are private) |
| `OverlayLayer.tsx` | 29 | Thin composition wrapper for all DOM overlays | `OverlayLayer` |
| `App.tsx` | 409 | All user interaction: pan, zoom, node drag, edge creation, resize, keyboard shortcuts | `App` |
| `physics.ts` | 202 | SoA physics engine for chaos mode (Float32Array typed arrays) | `createNodePhysics`, `initChaos`, `initRestore`, `stepNodePhysics`, `readPositions`, `activeChaos`, `setActiveChaos` |
| `serializer.ts` | 80 | Text-based save/load format for graphs | `serializeGraph(nodes, edges) → string`, `deserializeGraph(text) → {nodes, edges}` |
| `sampleNodes.ts` | 172 | 30 initial nodes (color inputs, mixers, math ops, filters, displays, AI response) with 21 edges | `initialNodes`, `initialEdges` |
| `main.tsx` | 31 | Font loading gate + URL hash / localStorage deserialization + React mount | — |
| `global.css` | 3 | Reset styles, Inter font, dark background | — |

### Import graph

```
main.tsx ─→ App, store, serializer, global.css
App.tsx ─→ store, CanvasLayer, OverlayLayer, pretextLayout, hitTesting, physics, serializer, types
CanvasLayer.tsx ─→ store, pretextLayout, perfStats, physics, types
OverlayLayer.tsx ─→ store, ParamTextarea, NodeSourceTextarea, InspectorPanel
ParamTextarea.tsx ─→ store, pretextLayout, nodeParser, types
NodeSourceTextarea.tsx ─→ store, pretextLayout, types
InspectorPanel.tsx ─→ store, pretextLayout, perfStats, types
hitTesting.ts ─→ pretextLayout, types
pretextLayout.ts ─→ nodeParser, types, @chenglou/pretext
physics.ts ─→ types
serializer.ts ─→ types
nodeParser.ts ─→ types
store.ts ─→ types, sampleNodes
sampleNodes.ts ─→ types
perfStats.ts ─→ (none)
```

**Cross-layer imports:** `App.tsx` imports `invalidateBitmapCache` from `CanvasLayer` for resize invalidation. This is the only cross-layer import — all other shared utilities (`renderHeight`, `perfStats`) live in dedicated modules.

## Architecture

Four layers kept in sync by a shared coordinate system derived from pretext. Canvas and React never call each other — both read from a Zustand store.

**Canvas layer** (`CanvasLayer.tsx`) — single `<canvas>` with a `requestAnimationFrame` loop. Draws grid, node frames, text, edges, and in-progress edge drags. Reads store via `useStore.getState()` each frame (no React subscriptions, no re-renders). Uses a bitmap cache (`HTMLCanvasElement` at 2x DPR) for non-selected/non-editing nodes; bypasses cache for selected, editing, or physics-animated nodes.

**Pretext layer** (`pretextLayout.ts`) — all interaction with `@chenglou/pretext`. For each node source string: parses into `ParsedLine[]`, runs `prepareWithSegments` + `layoutWithLines` per line, derives `displayLines[]`, `ports[]`, `editableRegions[]`, and auto-computed `height`. Nodes auto-shrink-wrap to their content width (clamped to 120–400px) unless manually resized via `node.width`.

**DOM overlay layer** (`OverlayLayer.tsx` + `ParamTextarea.tsx` + `NodeSourceTextarea.tsx` + `InspectorPanel.tsx`) — absolutely-positioned React components over the canvas. `ParamTextarea` handles inline parameter editing, `NodeSourceTextarea` handles full-node source editing, and `InspectorPanel` provides the right sidebar with source editor, stream text demo, perf monitor, and chaos slider. `OverlayLayer` is a thin wrapper that composes them with the shared viewport transform.

**Zustand store** (`store.ts`) — the seam. Holds `nodes` (Record by ID), `edges[]`, viewport, `selectedNodeIds[]`, editing/dragging state, undo/redo history (50 snapshots max). Both layers read from it; neither calls the other directly.

### Data flow: editing a node

1. User types in textarea (ParamTextarea / NodeSourceTextarea / InspectorPanel)
2. `invalidateLayout(oldSource)` cleans up stale layout cache entry
3. `store.updateNodeSource(id, newSource)` updates the store
4. Next canvas frame: `getNodeLayout(node)` cache-misses on new source → recomputes layout via pretext
5. Canvas draws node with new layout; port positions update automatically; edges follow

## Caching architecture

Three content-addressed caches (keyed by content, not by node ID):

| Cache | Location | Key format | Holds |
|---|---|---|---|
| `prepareCache` | `pretextLayout.ts` | `"${font}::${text}"` | pretext `PreparedTextWithSegments` handles (expensive to create) |
| `layoutCache` | `pretextLayout.ts` | `"${width}::${source}"` or `"auto::${source}"` | `NodeLayout` objects (ports, display lines, editable regions, height) |
| `bitmapCache` | `CanvasLayer.tsx` | `"${width}::${minHeight}::${source}"` | Pre-rendered `HTMLCanvasElement` at 2x DPR |

**Content-addressed = self-correcting.** When source changes, new content creates a new key, which cache-misses and recomputes fresh. Old entries are orphaned.

**When to invalidate:**
- After changing node source: call `invalidateLayout(oldSource)` BEFORE calling `store.updateNodeSource()` — this cleans up the stale layout cache entry for the old source
- After changing node size/appearance: call `invalidateBitmapCache(node, layout)` to force re-render of the bitmap
- The bitmap cache auto-invalidates on source changes (different key), so you only need `invalidateBitmapCache` for visual changes NOT reflected in the cache key (e.g., resize in progress)

**No eviction.** Caches grow with unique (source, width) combinations. Acceptable at prototype scale (~30 nodes). For production, add LRU eviction.

**Returned layouts are shared references.** Never mutate a `NodeLayout` returned by `getNodeLayout()` — it's the cached instance.

## Key invariants

1. **Font matching is critical.** The DOM overlay font string must match pretext's font string exactly. Both derive from `NODE_FONT` / `NODE_HEADER_FONT` constants in `types.ts`. If they drift, overlay text shifts visibly over canvas text. Never use `system-ui` — use the pinned Inter webfont loaded in `index.html`.

2. **Port positions are derived, never stored.** Ports live on the `NodeLayout` object, regenerated whenever `getNodeLayout()` runs. Edges look up ports by `(nodeId, portId)` at draw time. This is what makes dynamic node sizes work — when a node grows, edges follow automatically.

3. **Wait for fonts before first layout.** `main.tsx` gates the React mount on `document.fonts.ready`. Otherwise pretext measurements drift on first paint.

4. **Viewport transform is shared.** Canvas uses `ctx.setTransform()`; the overlay container applies the same transform via CSS `translate + scale`. World coordinates are the shared language between layers.

5. **Canvas reads store imperatively.** The `requestAnimationFrame` loop calls `useStore.getState()` each frame — no React subscriptions. Canvas rendering is fully decoupled from React's render cycle.

6. **`renderHeight(node, layout)`** returns `Math.max(layout.height, node.minHeight ?? 0)`. Always use this instead of `layout.height` directly when you need the actual rendered height of a node, since users can resize nodes taller than their content.

## Node source format

Nodes are defined by a text DSL parsed line-by-line in `nodeParser.ts`:

```
# Title              → header line (drawn with NODE_HEADER_FONT)
[:port-id]  Label    → input port (left edge)
[:port-id>] Label    → output port (right edge)
{param:name} K: V    → editable parameter (double-click to edit)
----                  → visual divider (rendered as horizontal line)
Everything else      → prose text
(empty line)         → blank line (preserved in layout)
```

Regexes are anchored to trimmed lines. Order matters — output port `[:id>]` is tested before input port `[:id]` to avoid ambiguity.

## Modification recipes

### Adding a new line type to the node DSL

1. **`types.ts`**: Add to `ParsedLine.type` union
2. **`nodeParser.ts`**: Add regex constant and match case in `parseNodeSource()` — order matters (more specific patterns first)
3. **`pretextLayout.ts:computeNodeLayout()`**: Handle the new type — decide font, lineHeight, whether it generates ports or editable regions
4. **`CanvasLayer.tsx:drawNodeInner()`**: Add rendering logic for how it appears on canvas
5. If editable: add hit-test in `hitTesting.ts`, wire into `App.tsx`, and add overlay component

### Adding a new user interaction

1. **`hitTesting.ts`**: Add hit-test function if needed (see `hitTestPort`, `hitTestNode` pattern — iterate nodes, check bounds, return hit info or null)
2. **`App.tsx`**: Add ref(s) for tracking state (see `isPanning`, `dragNodeId`, `resizingNodeId` pattern)
3. Wire into `onMouseDown` / `onMouseMove` / `onMouseUp` callbacks — each checks interaction refs in priority order
4. If it modifies graph state, add a store action and call `pushHistory()` when the interaction completes

### Adding a new store action

1. **`store.ts`**: Add method signature to `StoreState` interface
2. Implement in the `create()` call — use `set((state) => ({...}))` pattern for state updates
3. For undoable actions, call `pushHistory()` at the appropriate point (typically after the interaction completes, not on every intermediate state)

### Adding a new overlay component

1. Create `src/MyComponent.tsx` — import `useStore`, relevant types/constants, and `getNodeLayout`/`invalidateLayout` from `pretextLayout`
2. Import and add to `OverlayLayer.tsx` (inside the viewport-transformed div if it needs world coordinates, outside if it's fixed UI)

### Changing node visual appearance

1. Edit `drawNodeFrame()` (frame, ports, dividers) or `drawNodeInner()` (text rendering) in `CanvasLayer.tsx`
2. If the change affects something in the bitmap cache key (`width`, `minHeight`, `source`), cache auto-invalidates
3. If the change is to colors, constants, or rendering logic NOT in the cache key, the bitmap cache will serve stale renders — clear it by restarting the dev server, or add the varying property to `bitmapKey()`

### Adding a new keyboard shortcut

Add to the `onKeyDown` handler in `App.tsx` (the `useEffect` starting around line 35). Always guard with `!store.editingParam && !store.editingNodeId` to avoid conflicts with textarea input, unless the shortcut should work during editing.

## Interaction model

- **Pan**: Space+drag or middle-mouse drag
- **Zoom**: scroll wheel (at cursor position)
- **Drag nodes**: left-click on body, world-space delta applied to node position
- **Create edge**: drag from output port (blue) to input port (green); click edge to delete
- **Edit param**: double-click `{param:...}` region → textarea overlay, Enter or blur to commit
- **Edit full node**: double-click node body → textarea overlay, Escape or blur to commit
- **Resize**: drag left edge (width), bottom edge (height), or bottom-left corner (both); snaps to grid
- **Copy/paste**: Ctrl+C copies first selected node source text, Ctrl+V pastes as new node at viewport center
- **Delete**: Delete or Backspace removes all selected nodes and their connected edges
- **Undo/redo**: Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y (50-snapshot history)
- **Save**: Ctrl+S (localStorage), Ctrl+Shift+S (copies shareable URL with hash-encoded graph)
- **Chaos mode**: J key toggles physics scatter/restore; intensity slider in inspector panel

### Hit-test priority (onMouseDown)

1. Port → start edge drag
2. Resize handle (left edge / bottom edge / corner, 10px zone) → start resize
3. Editable region → select node (double-click to edit)
4. Node body → select + start drag
5. Nothing → deselect
6. Edge (onMouseUp only, if no drag occurred) → delete edge

## Selection model

`selectedNodeIds: string[]` supports multi-select. Store actions:
- `selectNode(id)` — sets selection to `[id]` (or `[]` if null)
- `toggleSelectNode(id)` — add/remove from selection (for Shift+click)
- `clearSelection()` — empty the selection

Currently all interactions use single-select via `selectNode()`. Multi-select with Shift+click is wired in the store but not yet connected in the mouse handlers.

## Persistence

`serializer.ts` handles a text-based save format. Nodes are `[node:ID]\nx=N y=N [w=N] [h=N]\n<source>` blocks separated by `===`. Edges follow after `===edges===` in `fromNode:fromPort -> toNode:toPort` DSL.

Load priority: URL hash (base64-encoded) → localStorage key `newdesk-graph` → `sampleNodes.ts` defaults.

## Physics

`physics.ts` runs SoA (struct-of-arrays) node physics during chaos mode. Operates on `Float32Array` typed arrays — zero store writes per frame. The canvas loop reads positions from the physics state via a `posOver` map each frame. Positions are committed back to the store only when physics settles (restore mode converges). Three modes: `chaos` (bouncing with collision), `restore` (spring back to home positions), `idle` (done).

## Known limitations

- **No spatial index.** Hit testing iterates all nodes — O(n). Fine at ~30 nodes.
- **Unbounded caches.** `prepareCache`, `layoutCache`, `bitmapCache` grow with unique edits. Fine at prototype scale.
- **No accessibility.** Nodes are canvas-rendered with no DOM mirror for screen readers or keyboard navigation.
- **Edge hit testing is approximate.** Samples 11 points along the bezier curve with 10px threshold.
- **Inspector panel overlaps canvas.** Fixed 280px width on right side, not accounted for in viewport calculations.
- **Shift+click multi-select not wired.** Store supports it (`toggleSelectNode`), but mouse handlers always use `selectNode`.
