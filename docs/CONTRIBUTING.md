# Contributing to ZapTracker

Thanks for your interest in contributing! Whether it's a bug fix, new feature, or documentation improvement, we welcome your help.

> **First time?** Read the [Architecture Guide](../STRUCTURE.md) to understand the codebase layout.

---

## Getting Started

1. **Fork** the repository
2. **Clone** your fork
   ```bash
   git clone https://github.com/<your-username>/zap_dashboard_hackathon.git
   cd zap_dashboard_hackathon
   ```
3. **Install** dependencies
   ```bash
   npm install
   ```
4. **Create** a feature branch
   ```bash
   git checkout -b feature/your-feature-name
   ```
5. **Start** the dev server
   ```bash
   npm run dev
   ```

## Development Guidelines

- **Vue 3 Composition API** -- use `<script setup>` syntax
- **TailwindCSS** for styling -- avoid custom CSS where Tailwind utilities suffice
- **Feature-based organization** -- place components, composables, and utils alongside related features (see [STRUCTURE.md](../STRUCTURE.md))
- **nostr-core** for all Nostr protocol interactions -- do not use legacy `nostr-tools`

## Commit Messages

Write clear, concise commit messages that explain *why* the change was made:

```
Add campaign progress bar to dashboard

Shows real-time funding progress for active campaigns
directly on the main dashboard view.
```

## Pull Requests

1. Keep PRs focused -- one feature or fix per PR
2. Include a short description of what changed and why
3. Add screenshots for UI changes
4. Make sure the build passes: `npm run build`

## Reporting Issues

Use [GitHub Issues](https://github.com/DoktorShift/zap_dashboard_hackathon/issues) with:
- Steps to reproduce
- Expected vs actual behavior
- Browser and OS info
- Screenshots if applicable

## Code of Conduct

Be respectful, constructive, and collaborative. We're all here to build something great for the Bitcoin & Nostr community.

---

<p align="center">
  <a href="../README.md">Back to Home</a> &bull;
  <a href="../STRUCTURE.md">Architecture</a>
</p>
