<div align="center">

<img src="assets/logo.png" width="240" height="240">

AI-powered 3D generation from a single prompt.

[![GitHub stars](https://img.shields.io/github/stars/sihaowu1/zendai?style=social)](https://github.com/sihaowu1/zendai)
[![GitHub forks](https://img.shields.io/github/forks/sihaowu1/zendai?style=social)](https://github.com/sihaowu1/zendai/network/members)

</div>

---

**Don't settle for black-box mesh generators you can't edit.**

Zendai turns natural language prompts (or reference photos) into fully editable Three.js code — component-based, tunable, and running live in the browser. Every result is real code you can tweak, remix, animate, and export.

[View the Devpost](https://devpost.com)

## Key Features

### Model Generation

Describe what you want and get a live 3D scene back instantly.

- **Prompt to 3D**: Natural language descriptions become component-based Three.js scenes with named parts.
- **Image to 3D**: Upload a reference photo and the img2threejs pipeline decomposes it into primitives, extracts PBR materials, and reconstructs it as editable code.
- **Tunable Sliders**: Every model exposes per-part size, color, and material parameters as real-time sliders.
- **Code Editor**: Full CodeMirror editor with syntax highlighting — edit the generated code directly and see changes live.
- **Iterative Refinement**: Follow-up prompts modify the existing model ("make the wheels bigger", "add metallic material") without rebuilding from scratch.

### Video & Animation

Animate models and compose them into exportable videos.

- **Natural Language Animation**: Describe the motion you want and the AI adds one-shot timeline animation.
- **Timeline Composer**: Drag and arrange animated clips on a visual timeline.
- **MP4 Export**: Server-side rendering via Remotion produces production-quality video.

### Export & Collaboration

Ship your work anywhere.

- **GitHub Integration**: Push models to a linked repo, pull remote state, version your scenes.
- **Geometry Export**: Download as GLB, OBJ, or STL for use in any 3D pipeline.
- **Code Export**: Standalone JS/TS bundles ready to drop into any Three.js project.

## Tech Stack

### Frontend

- React 18, TypeScript, Vite
- Three.js (WebGL live viewport with OrbitControls)
- Tailwind CSS v4, Lucide icons
- CodeMirror 6 (scene code editor)
- localStorage persistence

### Backend

- Express, Node.js, TypeScript (tsx)
- Anthropic Claude Sonnet 4.5 via OpenRouter
- Skill-based prompt architecture (Markdown system prompts)
- Remotion (server-side MP4 rendering)
- Auth0 (optional OAuth), MongoDB Atlas (optional marketplace)

## How It Works

```
Prompt (+ optional image)
  → Skill selection (threejs-modelling or img2threejs)
  → Claude generates Three.js scene module
  → Validator enforces contract (PARAMS, buildScene, updateScene)
  → Retry with feedback if validation fails
  → Hot-loaded as ES module in WebGL viewport
  → Live 60fps rendering with tunable sliders
```

For image inputs, the img2threejs pipeline adds a structured decomposition step:
1. **Component inventory** — identify every part, choose best-fit primitives
2. **Material extraction** — extract colors, metalness, roughness from the photo
3. **Proportion mapping** — measure relative sizes and parent-child hierarchy
4. **Assembly** — build composed Three.js groups with proper PBR materials

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# add your OPENROUTER_API_KEY (minimum for AI features; app works without it via offline fallback)

# 3. Start dev server (backend + frontend)
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:5174

## Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `OPENROUTER_API_KEY` | Claude API access for AI generation | No (offline fallback) |
| `VITE_AUTH0_DOMAIN` | Auth0 tenant domain | No |
| `VITE_AUTH0_CLIENT_ID` | Auth0 SPA client ID | No |
| `VITE_AUTH0_AUDIENCE` | Auth0 API audience | No |
| `AUTH0_MGMT_CLIENT_ID` | Auth0 M2M client (GitHub push) | No |
| `AUTH0_MGMT_CLIENT_SECRET` | Auth0 M2M secret (GitHub push) | No |
| `MONGODB_URI` | MongoDB Atlas (marketplace) | No |
| `ANTHROPIC_MODEL` | Model override (default: `anthropic/claude-sonnet-4.5`) | No |

## Repo Layout

```
.
├── config/              Default runtime configuration
├── remotion/            Remotion composition for MP4 export
├── server/              Express backend
│   └── src/
│       ├── agents/      AI agents (scene, animation, critique, intent, orchestrator)
│       ├── ai/          Client setup, skill loader, code extraction
│       ├── auth/        Auth0 JWT middleware
│       ├── routes/      API routes (generate, animate, export, github, marketplace)
│       └── utils/       Logging, tracing
├── shared/              Types, validation, templates, tunables parser
├── skills/              AI skill definitions (system prompts)
│   ├── img2threejs/     Image-to-3D reconstruction
│   ├── threejs-modelling/   Text-to-3D modelling
│   ├── threejs-animation/   Animation generation
│   └── procedural-patterns/ Geometry & material recipes
├── web/                 Vite + React frontend
│   └── src/
│       ├── components/  UI (ChatPanel, ModelsList, screens, timeline)
│       ├── editor/      CodeMirror scene editor
│       ├── landing/     Marketing landing page
│       ├── state/       useSceneProject (all editor state)
│       └── viewport/    Three.js WebGL runtime & exporters
└── .env.example         Environment template
```

## Team

Derek Lau, Sihao Wu, Ethan Yang, Ian Yeh

## License

MIT. Built for Hack the 6ix 2026.
