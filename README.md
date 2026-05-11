# Touchpoints

An AI-assisted tool for creating and exploring service blueprints — structured maps that show how a service works across every actor, phase, and touchpoint.

---

## What it does

Service blueprints are used in UX research and service design to visualise the full end-to-end experience of a service: who's involved, what they do at each stage, where things go wrong, and where the opportunities are.

Most teams build these in Miro or Figma — freeform tools that require manual layout, produce inconsistent output, and are hard to maintain. Touchpoints is purpose-built for the job.

**Paste in a transcript, document, or describe a service in plain text.** Claude analyses it and generates a structured blueprint: actors across the rows, phases across the columns, and actions at every intersection. From there you can explore, annotate, present, and iterate.

### Key features

**AI generation** — Describe a service or paste a research transcript. Claude builds the full blueprint: actors, phases, steps, pain points, opportunities, and open questions.

**Structured canvas** — Every card lives at a precise `(actor, phase, step)` coordinate. Nothing floats. You drag cards between cells; the grid enforces the structure.

**Multi-resolution views** — Switch between full detail, a filtered view (pains / opportunities / questions only), and a compact Overview mode that zooms out to the big picture.

**Versions & compare** — Fork the blueprint into named versions (e.g. "As-Is" vs "To-Be") and view them side by side in a split canvas with optional pan/zoom sync.

**Presentations** — Capture viewport positions as slides and play them back as a guided walkthrough of the blueprint for stakeholders.

**Journey Maps** — Generate a visual storyboard of the service using DALL-E 3, with consistent character illustrations per actor. Useful for communicating the human experience to a non-technical audience.

---

## Running it locally

You'll need [Node.js](https://nodejs.org) installed.

**1. Clone the repo**
```
git clone https://github.com/MatthewGlibbery/touchpoints.git
cd touchpoints/app
```

**2. Install dependencies**
```
npm install
```

**3. Add your API keys**

Copy the example env file and fill in your keys:
```
cp .env.example .env.local
```

Open `.env.local` and add:
- `VITE_ANTHROPIC_API_KEY` — from [console.anthropic.com](https://console.anthropic.com). Required for blueprint generation.
- `VITE_OPENAI_API_KEY` — from [platform.openai.com](https://platform.openai.com/api-keys). Optional; only needed for Journey Map image generation.

**4. Start the app**
```
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Tech

React · TypeScript · Vite · ReactFlow · Zustand · Anthropic Claude API · OpenAI DALL-E 3

---

## Status

Active personal project. Not production-ready — API keys are handled client-side and data lives in browser localStorage.
