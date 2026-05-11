# Service Blueprint Tool — Design System

## 1. Design Direction

This system is based on:
- **Visual style**: Light, soft, structured (inspired by Zapier / Retool / Airtable)
- **Layout model**: Canvas-first with floating UI (inspired by Figma / Framer)

### Core Principle
> The canvas is primary. All controls float above it.

---

## 2. Design Tokens

### Color Tokens (Semantic)

```css
:root {
  color-scheme: light;

  --canvas-bg: #F5F6F8;
  --canvas-grid: #DDE1E7;

  --surface-bg: #FFFFFF;
  --surface-bg-muted: #F3F4F6;
  --surface-bg-hover: #F9FAFB;

  --border-subtle: #E5E7EB;
  --border-strong: #D1D5DB;

  --text-primary: #111827;
  --text-secondary: #6B7280;
  --text-muted: #9CA3AF;

  --accent-primary: #3B82F6;
  --accent-primary-soft: #EEF2FF;

  --accent-success: #22C55E;
  --accent-success-soft: #ECFDF5;

  --accent-warning: #F59E0B;
  --accent-danger: #EF4444;

  --action-primary-bg: #F97316;
  --action-primary-text: #FFFFFF;

  --shadow-sm: 0 1px 2px rgba(0,0,0,0.04);
  --shadow-md: 0 2px 8px rgba(0,0,0,0.08);
}
```

### Dark Mode

```css
[data-theme="dark"] {
  color-scheme: dark;

  --canvas-bg: #111318;
  --canvas-grid: #252A33;

  --surface-bg: #181B22;
  --surface-bg-muted: #222631;
  --surface-bg-hover: #272C38;

  --border-subtle: #2B303B;
  --border-strong: #3A4150;

  --text-primary: #F9FAFB;
  --text-secondary: #A1A8B3;
  --text-muted: #6B7280;

  --accent-primary: #60A5FA;
  --accent-primary-soft: rgba(96,165,250,0.16);

  --accent-success: #34D399;
  --accent-success-soft: rgba(52,211,153,0.14);

  --accent-warning: #FBBF24;
  --accent-danger: #F87171;

  --action-primary-bg: #F97316;
  --action-primary-text: #FFFFFF;

  --shadow-sm: 0 1px 2px rgba(0,0,0,0.35);
  --shadow-md: 0 4px 16px rgba(0,0,0,0.45);
}
```

---

### Spacing

```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
```

### Radius

```css
--radius-sm: 6px;
--radius-md: 10px;
--radius-lg: 12px;
--radius-pill: 999px;
```

---

## 3. Layout System

### Canvas (Base Layer)
- Full screen
- Infinite feel
- Light grid

```css
.canvas {
  background-color: var(--canvas-bg);
  background-image: radial-gradient(var(--canvas-grid) 1px, transparent 1px);
}
```

---

### Floating UI Zones

#### Top Center
- Mode switcher

```
[ Create | Settings | Results ]
```

#### Top Right
- Actions

```
[ Live Preview ] [ Publish ]
```

#### Left Side
- Tool palette (floating panel)

#### Bottom Right
- Zoom controls
- Minimap

---

## 4. Core Components

### 4.1 Node Card

```css
.node-card {
  width: 260px;
  background: var(--surface-bg);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}
```

Structure:

```
Node
├─ Header
├─ Blocks
└─ Outputs
```

---

### 4.2 Blocks System

#### Message Block

```css
.message-block {
  background: var(--surface-bg-muted);
  padding: var(--space-3);
  border-radius: var(--radius-md);
}
```

#### Input Block

Visual:

```
Collect [name]
```

#### Condition Block

Visual:

```
Where [phone] equals [value]
```

#### Action Block

Visual:

```
Then go to [Next Node]
```

---

### 4.3 Chips

```css
.chip {
  padding: 4px 10px;
  border-radius: var(--radius-pill);
  background: var(--accent-primary-soft);
  color: var(--accent-primary);
  font-size: 12px;
}
```

---

### 4.4 Connections

```css
.connection {
  stroke: var(--accent-primary);
  stroke-width: 2;
}
```

---

### 4.5 Buttons

#### Primary

```css
.button-primary {
  background: var(--action-primary-bg);
  color: var(--action-primary-text);
  border-radius: var(--radius-md);
  padding: 8px 14px;
}
```

#### Ghost

```css
.button-ghost {
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
}
```

---

## 5. Node Data Schema

```ts
type FlowNode = {
  id: string;
  type: "message" | "question" | "condition" | "action";
  title: string;
  icon?: string;
  blocks: NodeBlock[];
  outputs: NodeOutput[];
};
```

### Block Types

```ts
type MessageBlock = {
  type: "message";
  text: string;
};


type InputBlock = {
  type: "input";
  field: string;
  inputKind: "text" | "number" | "email" | "phone" | "file" | "button";
};


type ConditionBlock = {
  type: "condition";
  left: string;
  operator: "equals" | "not_equals" | "contains" | "exists";
  right: string;
};


type ActionBlock = {
  type: "action";
  action: "go_to" | "assign" | "send_email" | "webhook" | "tag_user";
  config: Record<string, unknown>;
};
```

---

### Outputs

```ts
type NodeOutput = {
  id: string;
  label?: string;
  targetNodeId?: string;
};
```

---

## 6. Interaction Principles

1. Canvas is always primary
2. UI floats, not docks
3. Progressive disclosure
4. Hover reveals controls
5. Minimal visual noise

---

## 7. Build Order

1. Canvas + grid
2. Node card
3. Blocks system
4. Connections
5. Floating toolbar
6. Floating panel
7. Actions (publish / preview)

---

## 8. Interaction Model

The interaction model should make the tool feel like a visual canvas first, with controls revealed only when needed.

---

### 8.1 Canvas Interaction

#### Pan
- Click-drag on empty canvas to pan
- Spacebar + drag should also pan
- Cursor changes to grab / grabbing

#### Zoom
- Trackpad pinch
- Mouse wheel + modifier key
- Floating zoom controls in bottom-right

#### Select
- Click a node to select it
- Click empty canvas to deselect
- Shift-click to multi-select
- Drag selection marquee on empty canvas

#### Canvas Rule
> Empty canvas interactions should always manipulate the workspace, not the UI.

---

### 8.2 Node States

Nodes should have clear visual states without becoming visually noisy.

#### Default
- White / themed surface
- Subtle border
- No visible action controls

#### Hover
- Slightly stronger border
- Node actions appear
- Connection handles become visible

```css
.node-card:hover {
  border-color: var(--border-strong);
  box-shadow: var(--shadow-md);
}
```

#### Selected
- Accent border
- Slight glow / focus ring

```css
.node-card[data-selected="true"] {
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px var(--accent-primary-soft), var(--shadow-md);
}
```

#### Dragging
- Node lifts visually
- Shadow increases
- Opacity may reduce slightly

```css
.node-card[data-dragging="true"] {
  box-shadow: var(--shadow-md);
  opacity: 0.92;
}
```

#### Error
- Danger border
- Small inline issue indicator
- Do not use large red backgrounds

```css
.node-card[data-error="true"] {
  border-color: var(--accent-danger);
}
```

---

### 8.3 Node Editing

Nodes should support two editing modes.

#### Inline Edit
Used for quick changes:
- Rename node title
- Edit message text
- Edit chip labels
- Change simple input type

Interaction:
- Double-click content to edit
- Enter saves
- Escape cancels
- Blur saves if valid

#### Inspector Edit
Used for deeper configuration:
- Conditional logic
- Webhooks
- Data mapping
- Advanced validation

Interaction:
- Selecting a complex block can open a floating inspector panel
- Inspector should float on the right side, not replace the canvas

---

### 8.4 Connection Interaction

Connections are core to the product and should feel lightweight.

#### Create Connection
- Hover node to reveal output handle
- Drag from output handle
- Nearby compatible inputs highlight
- Release on target node or target handle

#### While Dragging
- Temporary curved line follows cursor
- Valid targets show accent highlight
- Invalid targets remain muted

#### Complete Connection
- Connection line animates in subtly
- Output label appears if relevant

#### Edit Connection
- Click a connection to select it
- Selected connection becomes accent-colored
- Delete key removes selected connection

```css
.connection[data-selected="true"] {
  stroke: var(--accent-primary);
  stroke-width: 2.5;
}
```

#### Connection Rules
- Avoid crossing lines when auto-layout is used
- Preserve manual user positioning
- Do not auto-rearrange after every connection

---

### 8.5 Block Interaction

Blocks inside nodes should feel editable but not heavy.

#### Hover
- Reveal subtle block-level actions
- Examples: duplicate, delete, convert type

#### Drag Within Node
- Blocks can be reordered inside a node
- Drag handle appears only on hover

#### Add Block
- Small “+” affordance appears between blocks on hover
- Clicking opens a compact insert menu

```
Message
   +
Input
   +
Condition
```

#### Block Selection
- Selecting a block highlights only that block, not the whole node
- Node remains parent-selected if needed

---

### 8.6 Floating Panels

Floating panels should be predictable and never block core canvas work.

#### Tool Palette
- Left floating panel
- Collapsible
- Dragging an item from the palette creates a node or block

#### Mode Switcher
- Top-center floating toolbar
- Always visible
- Uses active pill state

#### Action Cluster
- Top-right floating controls
- Includes Live Preview and Publish

#### Inspector
- Right-side floating panel
- Opens contextually
- Can be dismissed with Escape or canvas click

---

### 8.7 Keyboard Shortcuts

Initial shortcuts:

| Shortcut | Action |
|---|---|
| Space + Drag | Pan canvas |
| Cmd/Ctrl + Plus | Zoom in |
| Cmd/Ctrl + Minus | Zoom out |
| Cmd/Ctrl + 0 | Reset zoom |
| Delete / Backspace | Delete selected item |
| Enter | Edit selected node/block |
| Escape | Cancel / close panel / deselect |
| Cmd/Ctrl + D | Duplicate selected node |
| Cmd/Ctrl + Z | Undo |
| Cmd/Ctrl + Shift + Z | Redo |

---

### 8.8 Empty States

The empty canvas should guide the user without becoming a modal.

Recommended empty state:

```
Start building your blueprint
Drag in a block or create your first node.

[ Add first node ]
```

Visual:
- Centered on canvas
- Low contrast
- Disappears once the first node exists

---

### 8.9 Interaction Principles

1. Reveal controls on hover, not by default
2. Preserve spatial memory
3. Prefer inline edits for simple changes
4. Use floating inspectors for complex changes
5. Never let panels permanently shrink the canvas
6. Make invalid actions visible but quiet
7. Keep drag, connect, and edit interactions distinct

---

## 9. Key Rule

> Components never use raw colors — only tokens.

This ensures full light/dark compatibility without redesign.

