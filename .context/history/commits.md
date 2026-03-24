# Commit Decision History

> 此文件是 `commits.jsonl` 的人类可读视图，可由工具重生成。
> Canonical store: `commits.jsonl` (JSONL, append-only)

| Date | Context-Id | Commit | Summary | Decisions | Bugs | Risk |
|------|-----------|--------|---------|-----------|------|------|

## e8ca74f0 - 2026-03-24
**refactor: 消除重复 invoke 调用，统一走服务层 + 移除无意义包装函数**

- SftpService 提取 call<T>() 统一处理 invoke + 错误日志
- FileEditor.vue saveFile/loadFileContent 改走 SftpService 服务层
- system_monitor.rs 移除 execute_ssh_command 单行包装
- useTransferManager.ts 修复 2x 内存峰值（Uint8Array 直传）
