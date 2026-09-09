# Contributing to 3D Neon Snake Arcade 🐍

Thank you for your interest in contributing to **3D Neon Snake Arcade**! We welcome all contributions — from bug fixes and game mechanics to 3D visual polish, sound design, and documentation.

---

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Architecture Overview](#architecture-overview)
- [Local Development Setup](#local-development-setup)
- [Running Tests & Quality Checks](#running-tests--quality-checks)
- [Docker Containerization](#docker-containerization)
- [Git Workflow & Branching](#git-workflow--branching)
- [Commit Message Guidelines](#commit-message-guidelines)
- [Submitting a Pull Request](#submitting-a-pull-request)

---

## 🤝 Code of Conduct

This project adheres to the [Contributor Covenant (v2.1)](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code of conduct.

---

## 🏛 Architecture Overview

Before making changes, understand our architectural decoupling:
1. **`engine.js` (Pure Physics & Deterministic Math)**:
   - Contains zero DOM, Canvas, or Three.js dependencies.
   - Runs headlessly in Node.js for ultra-fast unit testing (`node:test`).
   - Handles grid boundaries, snake segments, reversal-prevention buffer, and food spawning state machine.
2. **`game.js` (Three.js 3D Presentation & Input)**:
   - Consumes `engine.js` as its state machine.
   - Sets up the Three.js WebGL scene, lighting, shadows, 3D meshes, procedural Web Audio synthesis, and particle bursts.
   - Dispatches user inputs (Keyboard, D-Pad, HUD buttons) to the engine.
3. **`style.css` (Glassmorphism & 3D Tactile Styling)**:
   - Contains neon effects, CRT scanlines, and responsive touch controls.

---

## 💻 Local Development Setup

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **Python 3**: For running the lightweight static development server
- **Docker**: (Optional) for containerized testing

### 1. Fork and Clone the Repository
```bash
git clone https://github.com/<your-username>/snake-game.git
cd snake-game
```

### 2. Start the Local Server
```bash
npm run dev
# Starts local server at http://localhost:8000
```
Open **[http://localhost:8000](http://localhost:8000)** in Google Chrome or any WebGL-capable browser.

---

## 🧪 Running Tests & Quality Checks

We maintain 100% automated test coverage combining headless unit tests and real headless Chrome E2E browser tests.

### Run All Tests
```bash
npm test
```

### Run Unit Tests Only (Fast)
```bash
npm run test:unit
```

### Run Headless Chrome E2E Tests Only
```bash
npm run test:e2e
```

### Validate JavaScript Syntax
```bash
npm run check
```

### Run Pre-Push Verification Script
```bash
bash scripts/pre-push.sh
```

---

## 🐳 Docker Containerization

To test the application inside a production-like container:

```bash
# Build the Docker image
npm run docker:build

# Launch the container in the background
npm run docker:up

# Open http://localhost:8080 in your browser

# Stop the container
npm run docker:down
```

---

## 🌿 Git Workflow & Branching

1. Ensure your local `main` branch is up to date:
   ```bash
   git checkout main
   git pull origin main
   ```
2. Create a feature branch following our naming convention:
   - `feat/<feature-name>` (e.g., `feat/laser-powerup`)
   - `fix/<bug-name>` (e.g., `fix/audio-mute-toggle`)
   - `docs/<doc-name>` (e.g., `docs/update-readme`)
   - `perf/<perf-name>` (e.g., `perf/particle-instancing`)

---

## 💬 Commit Message Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` A new game feature or visual enhancement
- `fix:` A bug fix
- `docs:` Documentation updates
- `perf:` A code change that improves performance
- `test:` Adding or refactoring tests
- `refactor:` Code change that neither fixes a bug nor adds a feature

**Example:**
```bash
git commit -m "feat(audio): add retro 8-bit sound effect for freeze powerup"
```

---

## 🚀 Submitting a Pull Request

1. Push your branch to your GitHub fork:
   ```bash
   git push origin feat/your-feature
   ```
2. Open a Pull Request against the `main` branch of `adarshkshitij/snake-game`.
3. Complete the [Pull Request Template](PULL_REQUEST_TEMPLATE.md):
   - Describe the changes made.
   - Verify that all 16 automated tests pass (`npm test`).
   - Confirm zero uncaught console errors in browser DevTools.
4. Our multi-agent review pipeline and **CodeRabbit AI** will automatically review your PR!
