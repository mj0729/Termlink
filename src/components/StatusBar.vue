<template>
  <div class="status-bar flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-subtle)] bg-[var(--status-strip-bg)] px-[18px] py-3">
    <div class="status-cluster flex min-w-0 items-center gap-2.5">
      <span class="status-label rounded-full border border-[var(--border-color)] bg-[var(--surface-2)] px-3 py-2">当前会话</span>
      <span class="status-connection" v-if="activeConnection">
        {{ activeConnection }}
      </span>
      <span v-else class="status-disconnected">
        等待连接
      </span>
    </div>
    
    <div class="status-cluster status-cluster--compact flex items-center gap-2">
      <span class="status-info rounded-full border border-[var(--border-color)] bg-[var(--surface-2)] px-3 py-2">标签 {{ tabCount }}</span>
      <span class="status-info rounded-full border border-[var(--border-color)] bg-[var(--surface-2)] px-3 py-2">主题 {{ theme === 'dark' ? '深色' : '浅色' }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps({
  activeConnection: {
    type: String,
    default: ''
  },
  tabCount: {
    type: Number,
    default: 0
  },
  theme: {
    type: String,
    default: 'dark'
  }
})
</script>

<style scoped>
.status-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 10px 18px 12px;
  background: var(--status-strip-bg);
  border-top: 1px solid var(--border-subtle);
  color: var(--muted-color);
}

.status-cluster {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.status-cluster--compact {
  gap: 8px;
}

.status-label,
.status-info {
  padding: 7px 10px;
  border-radius: 999px;
  background: var(--surface-2);
  border: 1px solid var(--border-color);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.status-connection {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-color);
  font-size: 12px;
  font-weight: 700;
}

.status-disconnected {
  color: var(--muted-color);
}

@media (max-width: 768px) {
  .status-bar {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
