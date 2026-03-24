export type TerminalSuggestionScope = {
  terminalType: 'local' | 'ssh'
  host: string
  user: string
  cwd: string
}

export type TerminalSuggestionMatch = {
  command: string
  suffix: string
}

type TerminalSuggestionEntry = {
  terminalType: 'local' | 'ssh'
  host: string
  user: string
  cwd: string
  command: string
  usedAt: number
  hitCount: number
}

const STORAGE_KEY = 'termlink_terminal_suggestions_v1'
const MAX_ENTRIES = 400

// C1: 禁止从外部历史（SSH pre-warm）种入高危命令
const DANGEROUS_SEED_PATTERNS: RegExp[] = [
  /^rm\s+-[^\s]*f/i,             // rm -rf / rm -f
  /^sudo\s+rm\s+-[^\s]*f/i,      // sudo rm -rf
  /^:\(\)\s*\{/,                  // fork bomb
  /^dd\s+if=/i,                   // dd 覆盖设备
  /^mkfs\b/i,                     // 格式化文件系统
  /^shred\b/i,                    // 销毁文件
  />\s*\/dev\/(sd|hd|nvme|disk)/i, // 写裸设备
  /^(sudo\s+)?halt\b/i,           // 关机
  /^(sudo\s+)?poweroff\b/i,
  /^(sudo\s+)?reboot\b/i,
]
const FALLBACK_COMMANDS = [
  'cd ',
  'clear',
  'cat ',
  'curl ',
  'chmod ',
  'chown ',
  'cp ',
  'git status',
  'git pull',
  'git push',
  'git checkout ',
  'git switch ',
  'git commit -m ""',
  'ls',
  'ls -la',
  'pwd',
  'mkdir ',
  'mv ',
  'rm ',
  'touch ',
  'vim ',
  'vi ',
  'sudo ',
  'systemctl status ',
  'systemctl restart ',
  'journalctl -u ',
  'docker ps',
  'docker logs ',
  'pnpm dev',
  'pnpm build',
  'npm run dev',
  'npm run build',
]

// P1: 以 "type|host|user|cwd|command" 为键构建 Map，upsert 从 O(n) 降至 O(1)
function makeKey(e: Pick<TerminalSuggestionEntry, 'terminalType' | 'host' | 'user' | 'cwd' | 'command'>): string {
  return `${e.terminalType}|${e.host}|${e.user}|${e.cwd}|${e.command}`
}

class TerminalSuggestionService {
  private cache: TerminalSuggestionEntry[] | null = null
  // P1: entries 对应的快速索引，与 cache 同步
  private index: Map<string, number> | null = null
  // P2: persist 防抖 timer，2s 内多次 save 只写一次 localStorage
  private persistTimer: ReturnType<typeof setTimeout> | null = null

  save(scope: TerminalSuggestionScope, command: string) {
    const normalizedCommand = command.trim()
    if (normalizedCommand.length < 2) return

    const entries = this.load()
    const usedAt = Date.now()
    this.upsert(entries, scope, normalizedCommand, usedAt)
    if (scope.cwd) {
      this.upsert(entries, { ...scope, cwd: '' }, normalizedCommand, usedAt)
    }
    this.schedulePersist(this.finalize(entries))
  }

  seed(scope: TerminalSuggestionScope, commands: string[]) {
    if (!commands.length) return

    const entries = this.load()
    const now = Date.now()

    commands.forEach((command, index) => {
      const normalizedCommand = command.trim()
      if (normalizedCommand.length < 2) return
      // C1: 过滤来自外部历史的高危命令，防止 SSH 服务器注入危险补全
      if (DANGEROUS_SEED_PATTERNS.some((re) => re.test(normalizedCommand))) return
      this.upsert(entries, scope, normalizedCommand, now - index)
    })

    this.schedulePersist(this.finalize(entries))
  }

  query(scope: TerminalSuggestionScope, prefix: string): TerminalSuggestionMatch | null {
    const normalizedPrefix = prefix.replace(/^\s+/, '')
    if (!normalizedPrefix) return null

    const entries = this.load()
      .filter((entry) => (
        entry.terminalType === scope.terminalType
        && entry.host === scope.host
        && entry.user === scope.user
        && entry.command.startsWith(normalizedPrefix)
        && entry.command !== normalizedPrefix
      ))

    const matched = this.pickBestMatch(entries, scope, normalizedPrefix)

    if (!matched) {
      const fallback = FALLBACK_COMMANDS.find((command) => (
        command.startsWith(normalizedPrefix) && command !== normalizedPrefix
      ))

      return fallback ? {
        command: fallback,
        suffix: fallback.slice(normalizedPrefix.length),
      } : null
    }

    return {
      command: matched.command,
      suffix: matched.command.slice(normalizedPrefix.length),
    }
  }

  private pickBestMatch(
    entries: TerminalSuggestionEntry[],
    scope: TerminalSuggestionScope,
    prefix: string,
  ): TerminalSuggestionEntry | null {
    const exactMatches = entries.filter((entry) => entry.cwd === scope.cwd)
    if (exactMatches.length) {
      return exactMatches.sort((left, right) => this.score(right, scope, prefix) - this.score(left, scope, prefix))[0]
    }

    const ancestorMatches = entries.filter((entry) => (
      Boolean(entry.cwd)
      && Boolean(scope.cwd)
      && scope.cwd.startsWith(`${entry.cwd}/`)
    ))
    if (ancestorMatches.length) {
      return ancestorMatches.sort((left, right) => this.score(right, scope, prefix) - this.score(left, scope, prefix))[0]
    }

    const globalMatches = entries.filter((entry) => !entry.cwd)
    if (globalMatches.length) {
      return globalMatches.sort((left, right) => this.score(right, scope, prefix) - this.score(left, scope, prefix))[0]
    }

    return entries.sort((left, right) => this.score(right, scope, prefix) - this.score(left, scope, prefix))[0] || null
  }

  private load() {
    if (this.cache) return this.cache

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (!raw) {
        this.cache = []
        this.index = new Map()
        return this.cache
      }

      const parsed = JSON.parse(raw)
      this.cache = Array.isArray(parsed) ? parsed : []
    } catch {
      this.cache = []
    }

    // P1: 首次加载时建立索引
    this.index = new Map(this.cache.map((entry, i) => [makeKey(entry), i]))
    return this.cache
  }

  // P2: 防抖写入，2s 内多次调用只触发一次 localStorage.setItem
  private schedulePersist(entries: TerminalSuggestionEntry[]) {
    this.cache = entries
    // 重建索引（finalize 后顺序已变，需重置）
    this.index = new Map(entries.map((entry, i) => [makeKey(entry), i]))

    if (this.persistTimer !== null) {
      clearTimeout(this.persistTimer)
    }
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null
      this.flushPersist(entries)
    }, 2000)
  }

  private flushPersist(entries: TerminalSuggestionEntry[]) {
    // M1: 处理 localStorage 配额溢出，缩减条目后重试
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
    } catch (error) {
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        const trimmed = entries.slice(0, Math.floor(entries.length / 2))
        this.cache = trimmed
        this.index = new Map(trimmed.map((entry, i) => [makeKey(entry), i]))
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
        } catch {
          // 存储完全不可用，仅保留内存缓存
        }
      }
    }
  }

  private upsert(
    entries: TerminalSuggestionEntry[],
    scope: TerminalSuggestionScope,
    command: string,
    usedAt: number,
  ) {
    // P1: O(1) Map 查找替代 O(n) findIndex
    const key = makeKey({ ...scope, command })
    const idx = this.index?.get(key)

    if (idx !== undefined) {
      const existing = entries[idx]
      entries[idx] = {
        ...existing,
        usedAt: Math.max(existing.usedAt, usedAt),
        hitCount: existing.hitCount + 1,
      }
      return
    }

    const newIdx = entries.length
    entries.push({
      terminalType: scope.terminalType,
      host: scope.host,
      user: scope.user,
      cwd: scope.cwd,
      command,
      usedAt,
      hitCount: 1,
    })
    this.index?.set(key, newIdx)
  }

  private finalize(entries: TerminalSuggestionEntry[]) {
    return entries
      .sort((left, right) => right.usedAt - left.usedAt)
      .slice(0, MAX_ENTRIES)
  }

  private score(entry: TerminalSuggestionEntry, scope: TerminalSuggestionScope, prefix: string): number {
    let s = entry.usedAt / 1000 + entry.hitCount * 10
    if (entry.cwd === scope.cwd) s += 500
    if (entry.command.length - prefix.length < 10) s += 50
    return s
  }
}

export default new TerminalSuggestionService()
