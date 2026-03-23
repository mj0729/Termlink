<template>
  <a-card :bordered="false" class="dashboard-card" :class="{ 'dashboard-card--embedded': isEmbedded }">
    <div class="dashboard-section-head dashboard-section-head--inline-meta">
      <div>
        <h4>Top 进程</h4>
      </div>
      <div class="process-summary-chips">
        <span class="process-summary-chip">运行 {{ processSummary.running || 0 }}</span>
        <span class="process-summary-chip">休眠 {{ processSummary.sleeping || 0 }}</span>
      </div>
    </div>

    <a-table
      class="process-table"
      :columns="processColumns"
      :data-source="processRows"
      :pagination="false"
      size="small"
    >
      <template #bodyCell="{ column, record, text }">
        <template v-if="column.key === 'rank'">
          <span class="process-rank">{{ text }}</span>
        </template>
        <template v-else-if="column.key === 'cpu'">
          <span class="process-value process-value--cpu">{{ formatPercent(record.cpuPercent) }}</span>
        </template>
        <template v-else-if="column.key === 'memory'">
          <span class="process-value">{{ formatProcessMemory(record.memoryKb) }}</span>
        </template>
        <template v-else-if="column.key === 'command'">
          <span class="process-command" :title="record.command">{{ record.command }}</span>
        </template>
      </template>
    </a-table>
  </a-card>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import type {
  MonitorNumberFormatter,
  MonitorProcessColumn,
  MonitorProcessRow,
  MonitorProcessSummary,
} from './monitorViewTypes'

defineProps({
  isEmbedded: {
    type: Boolean,
    required: true,
  },
  processSummary: {
    type: Object as PropType<MonitorProcessSummary>,
    required: true,
  },
  processColumns: {
    type: Array as PropType<MonitorProcessColumn[]>,
    required: true,
  },
  processRows: {
    type: Array as PropType<MonitorProcessRow[]>,
    required: true,
  },
  formatPercent: {
    type: Function as PropType<MonitorNumberFormatter>,
    required: true,
  },
  formatProcessMemory: {
    type: Function as PropType<MonitorNumberFormatter>,
    required: true,
  },
})
</script>

<style scoped>
.dashboard-section-head h4,
.process-command,
.process-value {
  color: var(--text-color);
}

.process-summary-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.process-summary-chip {
  padding: 0 8px;
  font-size: 11px;
  font-weight: 500;
}

.process-table :deep(.ant-table-wrapper),
.process-table :deep(.ant-table),
.process-table :deep(.ant-table-container) {
  background: transparent !important;
}

.process-table :deep(.ant-table-thead > tr > th),
.process-table :deep(.ant-table-tbody > tr > td) {
  color: var(--muted-color) !important;
}

.process-table :deep(.ant-table-thead > tr > th) {
  background: transparent !important;
  border-bottom-color: var(--border-color) !important;
}

.process-table :deep(.ant-table-tbody > tr > td) {
  background: transparent !important;
  border-bottom-color: var(--border-subtle) !important;
}

.process-rank {
  color: var(--muted-color);
  font-size: 11px;
  font-weight: 600;
}

.process-value,
.process-command {
  font-family: "SFMono-Regular", "JetBrains Mono", Consolas, monospace;
}

.process-command {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.process-value--cpu {
  color: var(--text-color);
}

.dashboard-card--embedded .process-summary-chips {
  gap: 4px;
}

.dashboard-card--embedded .process-summary-chip {
  padding: 0 6px;
  font-size: 9px;
}

.dashboard-card--embedded .process-table :deep(.ant-table-thead > tr > th),
.dashboard-card--embedded .process-table :deep(.ant-table-tbody > tr > td) {
  padding: 4px 3px !important;
  font-size: 9px;
}

.dashboard-card--embedded .process-rank,
.dashboard-card--embedded .process-command,
.dashboard-card--embedded .process-value {
  font-size: 10px;
}

:global(body[data-theme="dark"] .right-panel-monitor .process-command),
:global(body[data-theme="dark"] .right-panel-monitor .process-value) {
  color: #f5f5f5 !important;
}

:global(body[data-theme="dark"] .right-panel-monitor .process-table .ant-table-thead > tr > th),
:global(body[data-theme="dark"] .right-panel-monitor .process-table .ant-table-tbody > tr > td) {
  color: #a3a3a3 !important;
}

:global(body[data-theme="dark"] .right-panel-monitor .process-table .ant-table-thead > tr > th) {
  border-bottom-color: #303030 !important;
}

:global(body[data-theme="dark"] .right-panel-monitor .process-table .ant-table-tbody > tr > td) {
  border-bottom-color: #262626 !important;
}

@media (max-width: 768px) {
  .dashboard-section-head {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
