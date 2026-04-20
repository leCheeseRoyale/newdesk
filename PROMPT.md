Build a prototype hybrid node editor that uses the @chenglou/pretext skill
for all text layout. The goal is a runnable Vite + React + TypeScript app
demonstrating that pretext can be the foundation of a performant,
editable, text-defined node graph — without throwing out React or the DOM
where they're best.

## Stack

- Vite + React 18 + TypeScript
- @chenglou/pretext for all text measurement/layout
- Zustand for app state
- Single canvas for the graph; absolutely-positioned React overlays for
  the active editor, context menu, and a small inspector panel
- No UI library — raw CSS modules or inline styles are fine
- No tests, no routing, no backend

## Architecture (non-negotiable)

Hybrid, layered by concern. Each layer uses the tech that's cheapest for
its workload. They're kept in sync by a shared coordinate system derived
entirely from pretext:

1. **Canvas layer** renders the graph substrate (grid), all edges (bezier),
   all node frames, and all node text content *when not being edited*.
   One canvas, one requestAnimationFrame loop, zero per-node React
   components.

2. **Pretext layer** computes every node's internal geometry. When a
   node's source string or width changes, call `prepareWithSegments` +
   `layoutWithLines` and derive:
     - lines[] for canvas to draw
     - height (node auto-sizes to content)
     - ports[] — each port's (x, y) is derived from the line index of its
       marker in the source, NOT stored separately
     - editable regions[] — each parameter's bounding rect in world space

3. **DOM overlay layer** (React) renders only what's actively being
   interacted with: one <textarea> when a parameter is being edited,
   positioned at the pretext-computed world coordinates. Also renders
   the app shell (toolbar, inspector panel). Never one-component-per-node.

4. **Zustand store** is the seam. Canvas and React both read from it;
   neither calls the other directly.

## Node source format

A node is a string with embedded markers. Example:

    # Mix Colors
    [:in-a]  Color A
    [:in-b]  Color B
    {param:ratio} Blend ratio: 0.5
    ----
    [:out>]  Result
    
    Blends two colors using linear interpolation.

- `# Title` → header line
- `[:id]` → input port on the left edge of the node at that line's y
- `[:id>]` → output port on the right edge
- `{param:name}` → editable parameter; double-click brings up the overlay
- `----` → visual divider
- Everything else is prose

Parse with regex per line — keep it simple.

## Prototype requirements

- 3-4 sample node types (color input, color mix, output; add a text node
  whose description streams in character-by-character on button press to
  demonstrate that port positions and edges follow automatically as the
  node grows)
- At least 30 initial nodes, wired up with a handful of edges, so the
  scale benefit is visible
- Pan (space+drag or middle-mouse drag) and zoom (scroll wheel, zoom at
  cursor position)
- Drag nodes to reposition (left-click on node body, not on a port or
  editable region)
- Drag from an output port to an input port to create an edge; click an
  edge to delete it
- Double-click a `{param:...}` region → <textarea> overlay appears,
  positioned precisely over the canvas-drawn text, using the exact same
  font string pretext used. On blur or Enter, write value back into the
  node's source string, re-run pretext for that node, canvas picks up
  the change next frame.
- A small inspector panel (React) on the right showing selected node's
  source as a regular <textarea>, editable
- Viewport culling: only run `layout()` for nodes intersecting the
  visible world rect

## Non-obvious constraints

1. **The DOM overlay's font must match pretext's `font` string EXACTLY**
   (same weight, size, family, everything). If they drift, the overlay
   text will visibly shift when it appears over the canvas text. Derive
   both from a single NODE_FONT constant.

2. **Cache `prepared` handles per (source, font) pair.** Re-run pretext
   only when source or width changes. Most frames should call only
   `layoutWithLines` or even nothing (if layout is cached).

3. **Port positions are DERIVED, never stored.** Ports live on the node's
   layout object, regenerated whenever the layout runs. Edges look them
   up by (nodeId, portId) at draw time. This is what makes dynamic
   node sizes "just work" — when a node grows, edges follow with zero
   orchestration code.

4. **Hide the canvas-drawn text** for the parameter line when the
   overlay is active (fade to 0 opacity or skip that line in the draw
   loop) so there's no double-render.

5. **Pan/zoom is ONE canvas transform** (`ctx.setTransform`), and the
   overlay layer applies the same transform via CSS `transform: translate
   + scale` on its container. World coordinates are the shared language.

6. **Wait for fonts to load** before the first pretext pass:
   `document.fonts.ready.then(initialLayout)`. Otherwise measurements
   drift on first paint.

## Out of scope

- Undo/redo (store it structurally but don't implement UI)
- Saving/loading
- Real computation (node "outputs" can be dummy values)
- Accessibility / keyboard navigation (leave a TODO comment where the
  parallel a11y tree would go)
- Physics effects (leave hooks where they'd plug in, don't implement)
- Multiplayer, virtualization beyond viewport culling, sub-pixel
  antialiasing, LOD rendering

## Deliverable

A working project I can `pnpm install && pnpm dev` into. Aim for ~600-900
lines of hand-written code total across 6-10 files. Prefer clarity over
cleverness — this is a reference implementation I'll extend, not a
product. Add a short README explaining the architecture and which file
owns which concern.

Use the pretext skill for all layout work. Consult the skill's
references/api.md for exact function signatures, references/patterns.md
for the React caching idiom, references/pitfalls.md for font-matching
rules, and references/physics-text.md ONLY if you're tempted to add
physics (you're not — it's out of scope for this prototype).

Start by sketching the file layout and the store shape, show me both
before writing code, then proceed.