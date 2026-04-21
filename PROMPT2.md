**State, persistence, history**

- *Undo/redo.* Snapshot `{nodes, edges, positions}` to an array on committed changes (debounced ~300ms), keep a pointer. Or stash the JSON in a hidden `<textarea>` and let the browser's native undo stack handle it — ~20 lines, correct platform shortcuts for free.
- *Save/load.* Define a text format where nodes are separated by `===` and edges by a short DSL. The saved file *is* editable in vim. Round-trip is `text.split('===').map(parseNode)`.
- *Autosave and versioning.* IndexedDB keyed by timestamp, append-only. For branches/diffs, `isomorphic-git` against OPFS — every save is a commit, `git diff` gives visual diff for free.
- *CI-time layout assertions.* Pretext is DOM-free and deterministic, so run `layout()` in tests: "assert every sample node fits within 400px at default font." Layout correctness becomes a property test.

**Interaction**

- *Multi-select and grouping.* A `Set<id>` in the store. Marquee select is an AABB test against pretext-cached node bounds.
- *Copy/paste.* `navigator.clipboard.writeText(nodeSource)`. Because nodes are text, you can paste into VS Code, edit, paste back. Node source becomes a portable interchange format by accident.
- *Find (Cmd+F).* Render a visually-hidden DOM mirror of every node's text. Browser native find works, screen readers work, Tab navigation works. One trick, three problems.
- *Keyboard navigation.* Same mirror — each node a focusable `<div tabindex="0">`; on focus, pan canvas to its position.
- *Touch / pinch-zoom.* Pointer Events + ~40-line gesture handler. No dependency.

**Graph semantics**

- *Port types.* Extend the marker syntax: `[:in-a:color]`. Type-checking is string equality on connect.
- *Connection validation.* Same mechanism — reject bad drops, write the reason into the edge label (text again).
- *Graph execution.* Node body is literal JS: `[:out>] = mix($a, $b, $ratio)`. Compile to `new Function(...)` once per source change, reusing the source-keyed cache pattern. Topological sort → evaluate. If you want safety, HyperFormula does this in ~5 lines.
- *Subgraphs.* A node whose source starts with `# Group:` contains more nodes. Recursion is free because groups are just text.
- *Comments.* A node with no ports, no params, just a title. Zero new code path.
- *Error display.* Append `!! error: <msg>` to the node's source on failure — pretext lays it out like any other line. Errors are searchable, copy-pasteable, survive reloads.
- *i18n.* Free. Pretext handles bidi, CJK, emoji, soft hyphens — `# 颜色混合` or `# اختلاط الألوان` as a node title just works.
- *Streaming LLM output into a node.* Pretext was built at Midjourney for this exact problem — appending tokens reflows the node per-frame without jank. First-class capability if nodes ever become prompt/response cells.

**Node sizing and layout polish**

- *Shrink-wrap nodes.* Use pretext's `measureNaturalWidth` — each node auto-sizes to exactly the width its content wants, no hand-tuned constants.
- *Minimum-width search.* Binary-search widths with `walkLineRanges` to find the narrowest width that keeps a node under N lines tall. "Pack dense graphs" mode.
- *Correct whitespace mode.* Use `prepare(text, font, { whiteSpace: 'pre-wrap' })` so indentation, hard breaks, and separator lines in node source are preserved instead of collapsed.
- *Edge labels are just more text.* Pretext measures them the same way it measures node bodies. One layout primitive for everything text-shaped.
- *Pin a named font.* Never `system-ui` — it silently drifts between canvas and DOM on macOS, breaking the overlay-over-canvas trick. Use `-apple-system` or a bundled webfont.

**Performance and scale**

- *Spatial index.* Flat grid buckets (~500px cells). Viewport query is four bucket lookups. ~30 lines. Skip rbush unless you measure it helping.
- *Layout off the main thread.* Pretext in a Web Worker — it's DOM-free so this just works. Source-keyed cache survives `postMessage`.
- *Offscreen rendering.* Render static node frames to `OffscreenCanvas`, blit each frame. Use pretext's per-line measurements to detect when layout actually changed (not just source) and only re-rasterize then.

**The differentiating move: per-glyph physics**

- *Every character is a physics body whose home position is its pretext-computed layout spot.* Spring-damper loop in the RAF tick: text lags when you drag a node, scatters when nodes collide, shakes on error, snaps to new homes when pretext re-runs after a source change. This is the feature that justifies the architecture over React Flow — it's impossible in a DOM-based editor and trivial here. SoA typed arrays and object pools to hit 2000+ glyphs at 60fps.

**Collaboration and sharing**

- *Multiplayer.* Wrap each node's source in a `Y.Text`, graph structure in `Y.Map`. CRDT merging of node bodies just works because they're strings. Yjs + y-webrtc, ~50 lines of setup.
- *Share a snapshot.* Base64 the save file, put it in the URL hash. No backend.
- *Embedding.* Expose `<NodeEditor source="..." onChange={...} />`, drop into a blog post.

**Quality of life**

- *Minimap.* Render at 0.1x using pretext's `layout()` alone (no text rendering) — block heights become gray bars. ~20 lines.
- *Inspector panel.* Already exists (raw source view). That's the entire inspector.
- *Plugins.* No plugin API. A plugin is a regex + layout hint + execute function in a `Map<pattern, handler>`. The node source syntax *is* the plugin surface.
- *Theming.* Two `const DARK/LIGHT = {...}` objects, swap at runtime.
- *Debug mode.* Keypress dumps store JSON into a `<pre>`. That's dev tools.

**What to explicitly refuse**

Any state manager bigger than Zustand. Any UI kit. Any plugin framework. A dedicated graph library (dagre, elk, cytoscape) — if you need auto-layout, run dagre once on demand and throw it away. A form library for parameter editing (textarea-over-canvas handles every type because every parameter is text). An animation library (RAF + lerp covers 95%, and the physics layer covers the rest).

**The test**

Every feature should either *be text* or *compose with the three properties that make pretext the right engine*: fast enough per frame, accurate enough to overlay DOM on canvas, rich enough (natural width, per-line, per-glyph) to support shrink-wrap, physics, and streaming. Features that match fit. Features that don't are normal node-editor features being shoved into a codebase that was pretending not to be one.