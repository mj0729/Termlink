# Repository Guidelines

## Project Structure & Module Organization
`src/` contains the Vue 3 frontend. Put UI components in `src/components/`, browser logic in `src/services/`, styles in `src/style.css`, and assets in `src/assets/`. Files served without bundling belong in `public/`. The Tauri backend lives in `src-tauri/`: Rust commands are under `src-tauri/src/`, and packaging config sits beside `Cargo.toml` and `tauri.conf.json`. This is a terminal/SSH desktop app, so keep hot paths small and cross-layer interactions explicit.

## Build, Test, and Development Commands
- `pnpm install`: install frontend dependencies.
- `pnpm run dev`: start the Vite web client for UI-only work.
- `pnpm run build`: create a production frontend bundle.
- `pnpm run tauri:dev`: build the frontend, then launch the desktop app through Tauri.
- `pnpm run tauri:build`: build the desktop application packages.
- `cargo fmt --manifest-path src-tauri/Cargo.toml`: format Rust sources before submitting backend changes.

## Coding Style & Naming Conventions
Use 2-space indentation in Vue, JavaScript, CSS, and JSON files. Follow the existing Single File Component pattern with `<script setup>` where applicable. Name Vue components in PascalCase (`SettingsModal.vue`), service modules in PascalCase or descriptive nouns (`SshService.js`), and helper functions in camelCase. Avoid unnecessary wrappers, deep event chains, hidden side effects, and “god files.” Performance comes first: prefer low-allocation, low-IPC, incremental updates. If a simpler design is fast enough, do not add another layer.

## UI Style Guide
The current UI direction is a flat, restrained desktop tool aesthetic inspired by Codex on macOS. Favor a unified single-surface layout over stacked cards, nested panels, floating chrome, or decorative gradients. Interfaces should feel integrated and quiet rather than segmented into many bordered boxes.

Use black-and-white as the primary visual language. In light theme, prefer white backgrounds, near-black text, and black primary buttons. In dark theme, keep the palette decolorized and neutral instead of drifting into saturated blues or colorful accents. Color should be reserved for semantic status only, not general decoration.

Keep spacing compact and deliberate. Terminal views, file management views, and editor surfaces should prioritize information density without looking cramped. Typography should stay consistent, with moderate font weights and no exaggerated visual hierarchy. Icons should be minimal and low-noise.

Modal dialogs, drawers, and confirm surfaces should follow the same container language as the main app: one coherent panel, subtle separators, no extra outer shell, no default Ant Design blue primary actions leaking through. Footer actions should consistently use neutral secondary buttons and black/white primary buttons.

Status colors are centralized and semantic: connected/success = green, connecting/in-progress = yellow, disconnected/error = red. These meanings must stay stable across light and dark themes, with only saturation/intensity adjusted per theme. Reuse shared theme/status tokens instead of hardcoding local variants.

Theme changes should flow from the unified theme configuration layer. Antdv tokens, CSS variables, status colors, and business-level UI states must read from the same source of truth so that light/dark mode, presets, and accent adjustments remain visually consistent across the app.

## Testing Guidelines
There is no dedicated JS test runner configured yet, so every change should include manual verification steps in the PR. At minimum, run `pnpm run build` for frontend-only work and `pnpm run tauri:build` or `cargo check --manifest-path src-tauri/Cargo.toml` for Rust changes. If you add tests, place frontend tests under `src/__tests__/` and Rust tests next to the relevant module with `#[cfg(test)]`.

## Commit & Pull Request Guidelines
Recent history uses short fix-oriented subjects such as `fix: #3` and `fix bugs`. Prefer imperative, scoped commits like `fix: reconnect SSH session` or `feat: add file preview tab`. PRs should include a summary, affected areas, linked issues, and screenshots or recordings for UI changes. Mention manual verification steps and expected performance impact. Do not merge PRs that add obvious architectural debt or regress terminal responsiveness without a justified tradeoff.

## Security & Configuration Tips
Do not commit saved credentials, private keys, or machine-specific Tauri config. Treat SSH, SFTP, terminal, and download flows as security-sensitive. For performance-sensitive code, measure before adding complexity and keep IPC, terminal rendering, and file-transfer logic lean.
