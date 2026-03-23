<template>
  <a-card :bordered="false" class="dashboard-card" :class="{ 'dashboard-card--embedded': isEmbedded }">
    <div class="dashboard-section-head">
      <div>
        <h4>关键资源</h4>
      </div>
    </div>

    <div class="resource-highlight-list">
      <div
        v-for="metric in resourceHighlights"
        :key="metric.key"
        class="resource-highlight-row"
        :class="`resource-highlight-row--${metric.key}`"
      >
        <div class="resource-highlight-row__main">
          <div class="resource-highlight-row__label">
            <span class="resource-highlight-row__name">
              <component :is="metric.icon" class="resource-highlight-row__icon" />
              {{ metric.label }}
            </span>
            <template v-if="!isEmbedded">
              <span class="resource-highlight-row__tone" :class="`is-${metric.tone}`">
                {{ metric.state }}
              </span>
              <span class="resource-highlight-row__meta">{{ metric.meta }}</span>
            </template>
          </div>

          <div v-if="!isEmbedded" class="resource-highlight-row__value">
            <a-statistic
              :value="metric.value"
              :precision="metric.precision"
              :suffix="metric.suffix"
              :value-style="{ color: metric.color, fontSize: '20px', fontWeight: 700 }"
            />
          </div>
        </div>

        <div class="resource-highlight-row__footer" :class="{ 'resource-highlight-row__footer--compact': isEmbedded }">
          <template v-if="isEmbedded">
            <div class="resource-highlight-row__inline-progress">
              <a-progress
                class="resource-highlight-row__progress resource-highlight-row__progress--compact"
                :percent="metric.percent"
                :show-info="false"
                :stroke-color="metric.color"
                :stroke-width="14"
              />
              <div class="resource-highlight-row__inline-meta">
                <span class="resource-highlight-row__inline-percent">{{ formatPercent(metric.value) }}</span>
                <span class="resource-highlight-row__inline-detail">{{ formatInlineText(metric.meta) }}</span>
              </div>
            </div>
          </template>
          <a-progress
            v-else
            class="resource-highlight-row__progress"
            :percent="metric.percent"
            :show-info="false"
            :stroke-color="metric.color"
            :stroke-width="8"
          />
        </div>
      </div>
    </div>
  </a-card>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import type {
  MonitorNumberFormatter,
  MonitorResourceHighlight,
  MonitorTextFormatter,
} from './monitorViewTypes'

defineProps({
  isEmbedded: {
    type: Boolean,
    required: true,
  },
  resourceHighlights: {
    type: Array as PropType<MonitorResourceHighlight[]>,
    required: true,
  },
  formatPercent: {
    type: Function as PropType<MonitorNumberFormatter>,
    required: true,
  },
  formatInlineText: {
    type: Function as PropType<MonitorTextFormatter>,
    required: true,
  },
})
</script>

<style scoped>
.resource-highlight-row__name {
  color: var(--text-color);
}

.resource-highlight-list {
  display: grid;
  gap: 0;
}

.resource-highlight-row {
  display: grid;
  gap: 6px;
  padding: 10px 0;
}

.resource-highlight-row + .resource-highlight-row {
  border-top: 1px solid var(--border-subtle);
}

.resource-highlight-row__main {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.resource-highlight-row__label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.resource-highlight-row__name {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
}

.resource-highlight-row__icon {
  color: var(--muted-color);
  font-size: 13px;
}

.resource-highlight-row__meta {
  color: var(--muted-color);
}

.resource-highlight-row__tone {
  padding: 0 6px;
  border: 1px solid var(--border-color);
  border-radius: 999px;
  background: var(--surface-2);
  color: var(--muted-color);
  font-size: 10px;
  font-weight: 600;
}

.resource-highlight-row__value {
  flex-shrink: 0;
}

.resource-highlight-row__footer {
  margin-top: 2px;
}

.resource-highlight-row__progress :deep(.ant-progress),
.resource-highlight-row__inline-progress :deep(.ant-progress) {
  margin: 0;
}

.resource-highlight-row__progress :deep(.ant-progress-inner) {
  background: color-mix(in srgb, var(--muted-color) 12%, transparent) !important;
}

.resource-highlight-row__inline-progress {
  position: relative;
}

.resource-highlight-row__inline-meta {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 8px;
  pointer-events: none;
}

.resource-highlight-row__inline-percent,
.resource-highlight-row__inline-detail {
  color: var(--text-color);
  font-family: "SFMono-Regular", "JetBrains Mono", Consolas, monospace;
  font-size: 10px;
  font-weight: 600;
  line-height: 1;
}

.resource-highlight-row__inline-detail {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: right;
}

:global(body[data-theme="dark"] .right-panel-monitor .resource-highlight-row__name) {
  color: #f5f5f5 !important;
}

:global(body[data-theme="dark"] .right-panel-monitor .resource-highlight-row__meta) {
  color: #a3a3a3 !important;
}

:global(body[data-theme="dark"] .right-panel-monitor .resource-highlight-row__tone) {
  background: #1f1f1f !important;
  border-color: #303030 !important;
  color: #f5f5f5 !important;
}

:global(body[data-theme="dark"] .right-panel-monitor .resource-highlight-row__inline-percent),
:global(body[data-theme="dark"] .right-panel-monitor .resource-highlight-row__inline-detail) {
  color: #f5f5f5 !important;
}

:global(body[data-theme="dark"] .right-panel-monitor .resource-highlight-row__progress .ant-progress-inner) {
  background: rgba(148, 164, 187, 0.16) !important;
}

@media (max-width: 768px) {
  .resource-highlight-row__main {
    flex-direction: column;
    align-items: flex-start;
  }
}

.dashboard-card--embedded .dashboard-section-head h4,
.dashboard-card--embedded .resource-highlight-row__name {
  font-size: 11px;
}

.dashboard-card--embedded .resource-highlight-row {
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 4px 8px;
  padding: 8px 0;
}

.dashboard-card--embedded .resource-highlight-row__main {
  align-items: center;
  min-width: 0;
}

.dashboard-card--embedded .resource-highlight-row__label {
  width: auto;
}

.dashboard-card--embedded .resource-highlight-row__icon {
  font-size: 12px;
}

.dashboard-card--embedded .resource-highlight-row__footer {
  min-width: 0;
}

.dashboard-card--embedded .resource-highlight-row__progress--compact :deep(.ant-progress-inner) {
  border-radius: 4px;
  background: rgba(222, 230, 240, 0.72);
}

.dashboard-card--embedded .resource-highlight-row__progress--compact :deep(.ant-progress-bg) {
  border-radius: 4px;
}

.dashboard-card--embedded .resource-highlight-row__inline-meta {
  padding: 0 6px;
  gap: 6px;
}

.dashboard-card--embedded .resource-highlight-row__inline-percent,
.dashboard-card--embedded .resource-highlight-row__inline-detail,
.dashboard-card--embedded .resource-highlight-row__meta {
  font-size: 8px;
}
</style>
