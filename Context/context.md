# Service Blueprint Tool – Product Context

## 1. Core Vision

A structured, AI-assisted service blueprinting tool that transforms messy inputs (transcripts, recordings, notes) into a multi-resolution, navigable model of a service.

The system is not just a canvas—it is a **data model with multiple visual representations**.

---

## 2. Problem Statement

Current tools (e.g., Miro):
- Require manual layout and spacing
- Are overly flexible and inconsistent
- Force users to recreate structure each time
- Require multiple versions for different audiences (high-level vs detailed)
- Are difficult for non-experts to interpret or contribute to

---

## 3. Core Product Principles

1. **Structured over freeform**  
   Use defined components and grid-based layout instead of arbitrary placement

2. **Single source of truth**  
   One blueprint supports multiple levels of fidelity and views

3. **Semantic zoom, not visual zoom**  
   Zooming changes meaning and abstraction, not just size

4. **AI-generated, human-editable**  
   AI creates initial structure; users refine and control

5. **Partner-friendly**  
   Accessible to users unfamiliar with service design frameworks

6. **Blueprint as a model, not a diagram**  
   The canvas is just one view of underlying structured data

---

## 4. Core Concept: Semantic Zoom

### Definition
The blueprint is a **multi-resolution object**. Each element has different representations at different levels of abstraction.

Zooming should:
- Change level of detail
- Collapse or expand structure
- Replace visuals with abstractions

---

## 5. Canonical Zoom Layers

### Level 1: Evidence / Micro Detail
- Screenshots or GIFs
- Granular steps
- Transcript-linked evidence
- Detailed pain points, questions, opportunities

### Level 2: Action Level
- Key actions per actor
- Simplified touchpoints
- Clustered pain points
- Clear swimlane structure

### Level 3: Phase Level
- Major phases
- Summarized actions
- Top pain points/opportunities per phase
- Reduced actor complexity

### Level 4: Story / Presentation Level
- Narrative flow
- Key moments
- Simplified diagram
- Stakeholder-ready view

---

## 6. Navigation Model

- **Free zoom** for fluid exploration
- **Discrete layer controls** to jump between abstraction levels
- Zoom interpolates between layers
- Layers represent semantic states

---

## 7. Core Objects (Initial)

### Actor
- Represents a participant in the service
- Owns a swimlane

### Action
- A step taken by an actor
- Links to touchpoints, pain points, opportunities

### Phase
- Groups actions into higher-level segments
- AI-generated, user-editable

### Touchpoint
- Interface or system interaction
- Can include screenshots or icons

### Pain Point
- Friction or issue
- Can appear in multiple places
- Aggregatable across blueprint

### Opportunity
- Potential improvement
- Linked to pain points or actions

---

## 8. Multi-View System

All views operate on the same underlying data model.

### 8.1 Blueprint View
- Primary canvas
- Swimlanes, actions, phases
- Supports semantic zoom

### 8.2 Pain Point View
- Aggregated list of pain points
- Shows frequency and distribution
- Editable; changes propagate to blueprint

### 8.3 Opportunity View
- Aggregated opportunities
- Can be grouped and edited
- Linked back to blueprint context

### 8.4 Presentation Mode (Core Feature)
- Narrative playback of blueprint
- Respects selected abstraction level
- Sequences phases or key moments
- Replaces need for separate slide decks

---

## 9. Data Model Requirements

Each object must support:
- Multiple representations (detailed, summarized, abstract)
- Parent-child relationships
- Source/evidence linking
- Visibility rules by zoom level
- Many-to-one and one-to-many relationships

Example: Pain points may appear in multiple actions but aggregate into one theme.

---

## 10. Semantic Representation Example

### Action Object
- Detailed: "Resident clicks ‘Submit’ after uploading proof of address"
- Medium: "Submit application"
- Abstract: "Apply"
- Touchpoint: screenshot → icon → hidden
- Linked pain points/opportunities
- Source reference

---

## 11. AI Capabilities (MVP Scope)

### Input Sources
- Transcripts
- Recordings
- Written descriptions

### Output
- Actors
- Actions
- Phases
- Pain points
- Opportunities

### Behavior
- Generates initial draft
- Suggests grouping and summarization
- Leaves full control to user

---

## 12. Additional Capabilities (Future)

### Storyboard Mode
- Auto-generated storyboards per actor
- Consistent AI-generated art direction

### Persona Mode
- Character profiles
- Goals and pain points
- Shared visual style

### Focus Mode
- Filter blueprint by actor, pain point, or opportunity

### Evidence Linking
- Trace elements back to source data

### Abstraction Editing
- Edit groupings at higher levels
- Influence structure downward

### Narrative Presets
- Present by phase, actor, pain points, or opportunities

---

## 13. Key Design Challenges

1. **Abstraction logic**  
   How elements group and collapse across zoom levels

2. **AI + user control balance**  
   Degree of automation vs manual editing

3. **View synchronization**  
   Ensuring consistency across blueprint, pain point, and opportunity views

4. **Usability for non-experts**  
   Reducing need to understand service design frameworks

---

## 14. MVP Definition

Focus on:
- Blueprint editor with semantic zoom
- Core object model (actors, actions, phases, pain points, opportunities)
- AI-assisted blueprint generation from input
- Pain point and opportunity views
- Presentation mode

---

## 15. North Star Statement

The blueprint is not a diagram—it is a **structured, multi-resolution map of a service**, with interchangeable views for analysis, storytelling, and collaboration.

---

## 16. Copy-Friendly Version

If you need to download this, copy everything in this file and save it locally as:

`service-blueprint-tool.md`

