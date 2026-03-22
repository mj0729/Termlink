# Coding Style Guide

> 此文件定义团队编码规范，所有 LLM 工具在修改代码时必须遵守。
> 提交到 Git，团队共享。

## General
- Prefer small, reviewable changes; avoid unrelated refactors.
- Keep functions short (<50 lines); avoid deep nesting (<=3 levels).
- Name things explicitly; no single-letter variables except loop counters.
- Handle errors explicitly; never swallow errors silently.

## Language-Specific

### TypeScript (Frontend)
- Use strict mode; prefer `interface` over `type` for object shapes.
- Vue 3 Composition API with `<script setup>` syntax.
- Ant Design Vue Next (antdv-next) as UI component library.
- Tailwind CSS 4.x for styling.

### Rust (Backend)
- Tauri commands use `#[tauri::command]` decorator.
- All commands return `Result<T, String>`.
- Use `tokio` async runtime for SSH/SFTP operations.

## Git Commits
- Conventional Commits, imperative mood.
- Atomic commits: one logical change per commit.

## Testing
- Every feat/fix MUST include corresponding tests.
- Coverage must not decrease.
- Fix flow: write failing test FIRST, then fix code.

## Security
- Never log secrets (tokens/keys/cookies/JWT).
- Validate inputs at trust boundaries.
