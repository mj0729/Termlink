<template>
  <div v-if="logs.length" class="remote-audit-log">
    <div class="remote-audit-log__toggle" @click="expanded = !expanded">
      <span class="remote-audit-log__label">
        {{ expanded ? '收起' : '展开' }}操作记录 ({{ logs.length }})
      </span>
    </div>
    <div v-if="expanded" class="remote-audit-log__body">
      <div
        v-for="(log, index) in reversedLogs"
        :key="index"
        class="remote-audit-log__entry"
        :class="{ 'is-error': log.status === 'error' }"
      >
        <span class="remote-audit-log__time">{{ log.timestamp }}</span>
        <code class="remote-audit-log__cmd">$ {{ log.command }}</code>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

interface AuditLog {
  timestamp: string
  command: string
  status?: string
}

const props = defineProps<{
  logs: AuditLog[]
}>()

const expanded = ref(false)
const reversedLogs = computed(() => [...props.logs].reverse().slice(0, 50))
</script>

<style scoped>
.remote-audit-log {
  border-top: 1px solid var(--remote-footer-border, var(--border-color, #e8e8e8));
  background: var(--remote-footer-bg, transparent);
}

.remote-audit-log__toggle {
  padding: 3px 10px;
  font-size: 11px;
  color: var(--remote-audit-text, var(--muted-color, #999));
  cursor: pointer;
  user-select: none;
  background: var(--remote-footer-bg, transparent);
}

.remote-audit-log__toggle:hover {
  color: var(--primary-color, #1677ff);
}

.remote-audit-log__body {
  max-height: 120px;
  overflow-y: auto;
  padding: 4px 10px;
  background: var(--remote-audit-bg, var(--surface-1, #f5f5f5));
}

.remote-audit-log__entry {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 11px;
  line-height: 1.6;
}

.remote-audit-log__entry.is-error {
  color: var(--error-color, #ff4d4f);
}

.remote-audit-log__time {
  flex-shrink: 0;
  opacity: 0.5;
  font-size: 10px;
}

.remote-audit-log__cmd {
  font-family: var(--font-mono, 'Menlo', monospace);
  font-size: 11px;
  color: inherit;
  word-break: break-all;
}
</style>
