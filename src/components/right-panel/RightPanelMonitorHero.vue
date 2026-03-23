<template>
  <a-card :bordered="false" class="dashboard-hero-card" :class="{ 'dashboard-hero-card--embedded': isEmbedded }">
    <div class="dashboard-hero">
      <div class="dashboard-hero__copy">
        <div class="dashboard-hero__title-row">
          <h3>{{ hostTitle }}</h3>
          <span v-if="!isEmbedded" class="dashboard-health-pill" :class="`is-${healthTone}`">
            {{ healthLabel }}
          </span>
        </div>
        <p>{{ summaryText }}</p>
      </div>

      <div class="dashboard-hero__toolbar">
        <div class="dashboard-hero__toolbar-actions">
          <a-button
            type="text"
            size="small"
            class="collapse-btn"
            title="收起系统监控"
            @click="emit('toggle')"
          >
            <LeftOutlined v-if="placement === 'left'" />
            <RightOutlined v-else />
          </a-button>
          <a-button type="primary" size="small" class="hero-refresh-btn" title="手动刷新" :disabled="!canRefresh" @click="emit('refresh')">
            <span class="hero-refresh-btn__glyph" aria-hidden="true">↻</span>
          </a-button>
        </div>
        <div class="dashboard-hero__toolbar-meta">
          <span class="dashboard-hero__timestamp">{{ lastUpdateText }}</span>
        </div>
      </div>
    </div>

    <div class="dashboard-kpi-grid">
      <div
        v-for="item in statistics"
        :key="item.key"
        class="dashboard-kpi"
        :class="`dashboard-kpi--${item.key}`"
      >
        <span class="dashboard-kpi__label">{{ item.label }}</span>
        <a-statistic
          :value="item.value"
          :precision="item.precision"
          :suffix="item.suffix"
          :value-style="item.valueStyle"
        />
        <span v-if="!isEmbedded" class="dashboard-kpi__meta">{{ item.meta }}</span>
      </div>
    </div>

    <div class="hero-summary-memory">
      <div class="hero-summary-memory__head">
        <span>内存构成</span>
        <strong>{{ formatSize(memoryInfo.used) }} / {{ formatSize(memoryInfo.total) }}</strong>
      </div>
      <a-tooltip v-if="isEmbedded" placement="topLeft" overlay-class-name="memory-composition-tooltip">
        <template #title>
          <div class="memory-composition__tooltip">
            <div v-for="segment in memorySegments" :key="`${segment.label}-tooltip`" class="memory-composition__tooltip-item">
              <span class="memory-legend-item__dot" :style="{ background: segment.color }"></span>
              <span>{{ segment.label }}</span>
              <strong>{{ segment.value }}</strong>
            </div>
          </div>
        </template>
        <div class="memory-composition__bar memory-composition__bar--interactive">
          <span
            v-for="segment in memorySegments"
            :key="segment.label"
            class="memory-composition__segment"
            :style="{ width: `${segment.percent}%`, background: segment.color }"
          ></span>
        </div>
      </a-tooltip>
      <div v-else class="memory-composition__bar">
        <span
          v-for="segment in memorySegments"
          :key="segment.label"
          class="memory-composition__segment"
          :style="{ width: `${segment.percent}%`, background: segment.color }"
        ></span>
      </div>
      <div v-if="!isEmbedded" class="hero-summary-memory__legend">
        <div
          v-for="segment in memorySegments"
          :key="segment.label"
          class="hero-summary-memory__legend-item"
          :style="{ '--memory-segment-color': segment.color }"
        >
          <span class="memory-legend-item__dot" :style="{ background: segment.color }"></span>
          <span>{{ segment.label }}</span>
          <strong>{{ segment.value }}</strong>
        </div>
      </div>
    </div>

    <div v-if="alerts.length" class="hero-alert-strip">
      <div class="hero-alert-strip__header">
        <strong>告警</strong>
        <span>{{ alerts.length }} 条</span>
      </div>
      <div class="hero-alert-strip__list">
        <div
          v-for="alert in alerts"
          :key="alert.key"
          class="hero-alert-strip__item"
          :class="`is-${alert.type}`"
        >
          <span class="hero-alert-strip__message">{{ alert.message }}</span>
          <span class="hero-alert-strip__description">{{ alert.description }}</span>
        </div>
      </div>
    </div>
  </a-card>
</template>

<script setup lang="ts">
import { LeftOutlined, RightOutlined } from '@antdv-next/icons'
import type { PropType } from 'vue'
import type { MemoryInfo } from '../../types/app'
import type {
  MonitorAlertItem,
  MonitorHeroStatistic,
  MonitorMemorySegment,
  MonitorSizeFormatter,
} from './monitorViewTypes'

const props = defineProps({
  placement: {
    type: String as PropType<'right' | 'left'>,
    required: true,
  },
  isEmbedded: {
    type: Boolean,
    required: true,
  },
  canRefresh: {
    type: Boolean,
    required: true,
  },
  hostTitle: {
    type: String,
    required: true,
  },
  healthTone: {
    type: String,
    required: true,
  },
  healthLabel: {
    type: String,
    required: true,
  },
  summaryText: {
    type: String,
    required: true,
  },
  lastUpdateText: {
    type: String,
    required: true,
  },
  statistics: {
    type: Array as PropType<MonitorHeroStatistic[]>,
    required: true,
  },
  memoryInfo: {
    type: Object as PropType<MemoryInfo>,
    required: true,
  },
  memorySegments: {
    type: Array as PropType<MonitorMemorySegment[]>,
    required: true,
  },
  alerts: {
    type: Array as PropType<MonitorAlertItem[]>,
    required: true,
  },
  formatSize: {
    type: Function as PropType<MonitorSizeFormatter>,
    required: true,
  },
})

const emit = defineEmits(['toggle', 'refresh'])
</script>

<style scoped>

.dashboard-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.dashboard-hero__copy {
  min-width: 0;
}

.dashboard-hero__title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.dashboard-hero__copy p,
.dashboard-hero__timestamp,
.dashboard-kpi__label,
.dashboard-kpi__meta,
.hero-summary-memory__head span,
.hero-summary-memory__legend-item span,
.hero-alert-strip__description,
.hero-alert-strip__header span {
  color: var(--muted-color);
}

.dashboard-hero__copy p {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.45;
}

.dashboard-hero__toolbar {
  display: grid;
  justify-items: end;
  gap: 6px;
  flex-shrink: 0;
}

.dashboard-hero__toolbar-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.dashboard-health-pill {
  display: inline-flex;
  align-items: center;
  min-height: 20px;
  padding: 0 8px;
  font-size: 11px;
  font-weight: 600;
}

.collapse-btn {
  width: 28px !important;
  height: 28px !important;
  border-radius: 8px;
  color: var(--text-color);
  background: transparent !important;
  border: 1px solid var(--border-color) !important;
}

.collapse-btn:hover {
  background: var(--surface-2) !important;
  border-color: var(--strong-border) !important;
}

.hero-refresh-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.hero-refresh-btn__glyph {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  line-height: 1;
}

.dashboard-kpi-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0;
  margin-top: 10px;
  border-top: 1px solid var(--border-subtle);
}

.dashboard-kpi {
  display: grid;
  gap: 4px;
  padding: 10px 0;
}

.dashboard-kpi + .dashboard-kpi {
  border-top: 1px solid var(--border-subtle);
}

.dashboard-kpi :deep(.ant-statistic-content) {
  font-size: 18px;
  color: inherit;
}

.hero-summary-memory,
.hero-alert-strip {
  padding: 10px 0;
  border-top: 1px solid var(--border-subtle);
}

.hero-summary-memory {
  display: grid;
  gap: 8px;
  margin-top: 2px;
}

.hero-summary-memory__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.hero-summary-memory__head strong,
.hero-summary-memory__legend-item strong,
.memory-composition__tooltip-item strong,
.hero-alert-strip__header strong,
.hero-alert-strip__message {
  color: var(--text-color);
  font-family: "SFMono-Regular", "JetBrains Mono", Consolas, monospace;
  font-size: 12px;
  font-weight: 600;
}

.hero-summary-memory__legend {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 12px;
}

.hero-summary-memory__legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.memory-composition__bar {
  position: relative;
  display: flex;
  width: 100%;
  height: 10px;
  overflow: hidden;
  border-radius: 999px;
  background: color-mix(in srgb, var(--muted-color) 12%, transparent);
}

.memory-composition__segment {
  min-width: 2%;
}

.memory-composition__bar--interactive {
  cursor: help;
}

.memory-composition__tooltip {
  display: grid;
  gap: 6px;
  min-width: 160px;
}

.memory-composition__tooltip-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 6px;
  color: rgba(255, 255, 255, 0.92);
  font-size: 12px;
}

.memory-legend-item__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.hero-alert-strip {
  display: grid;
  gap: 8px;
  border-color: color-mix(in srgb, var(--error-color) 22%, var(--border-color));
  background: color-mix(in srgb, var(--error-color) 6%, var(--surface-2));
}

.hero-alert-strip__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.hero-alert-strip__list {
  display: grid;
  gap: 8px;
}

.hero-alert-strip__item {
  display: grid;
  gap: 3px;
  padding-top: 8px;
  border-top: 1px solid var(--border-subtle);
}

.hero-alert-strip__item:first-child {
  padding-top: 0;
  border-top: none;
}

.dashboard-hero-card--embedded .dashboard-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-areas:
    "copy actions"
    "meta actions";
  gap: 4px 8px;
}

.dashboard-hero-card--embedded .dashboard-hero__copy {
  grid-area: copy;
  display: grid;
  gap: 2px;
}

.dashboard-hero-card--embedded .dashboard-hero__toolbar {
  display: contents;
}

.dashboard-hero-card--embedded .dashboard-hero__toolbar-actions {
  grid-area: actions;
  display: grid;
  justify-items: end;
  gap: 6px;
}

.dashboard-hero-card--embedded .dashboard-hero__toolbar-meta {
  grid-area: meta;
  justify-content: flex-start;
}

.dashboard-hero-card--embedded .dashboard-hero__title-row {
  gap: 4px 6px;
  align-items: flex-start;
}

.dashboard-hero-card--embedded .dashboard-hero__title-row h3 {
  display: -webkit-box;
  font-size: 12px;
  line-height: 1.15;
  word-break: break-word;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

.dashboard-hero-card--embedded .dashboard-hero__copy p,
.dashboard-hero-card--embedded .dashboard-hero__timestamp,
.dashboard-hero-card--embedded .dashboard-kpi__label,
.dashboard-hero-card--embedded .dashboard-kpi__meta,
.dashboard-hero-card--embedded .hero-summary-memory__head span,
.dashboard-hero-card--embedded .hero-summary-memory__legend-item span,
.dashboard-hero-card--embedded .hero-alert-strip__description,
.dashboard-hero-card--embedded .hero-alert-strip__header span {
  font-size: 9px;
}

.dashboard-hero-card--embedded .dashboard-hero__copy p {
  margin-top: 0;
  line-height: 1.2;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

.dashboard-hero-card--embedded .dashboard-health-pill {
  min-height: 18px;
  padding: 0 6px;
  font-size: 9px;
}

.dashboard-hero-card--embedded .hero-refresh-btn {
  width: 28px;
  min-width: 28px;
  height: 28px;
  padding-inline: 0;
}

.dashboard-hero-card--embedded .dashboard-kpi-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4px;
  margin-top: 6px;
  border-top: none;
}

.dashboard-hero-card--embedded .dashboard-kpi {
  gap: 4px;
  padding: 5px 4px;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  background: var(--surface-2);
  min-width: 0;
  overflow: hidden;
}

.dashboard-hero-card--embedded .dashboard-kpi + .dashboard-kpi {
  border-top: 1px solid var(--border-subtle);
}

.dashboard-hero-card--embedded .dashboard-kpi :deep(.ant-statistic-content) {
  font-size: 11px;
  line-height: 1.05 !important;
  white-space: nowrap !important;
  letter-spacing: -0.04em;
}

.dashboard-hero-card--embedded .dashboard-kpi :deep(.ant-statistic),
.dashboard-hero-card--embedded .dashboard-kpi :deep(.ant-statistic-content-value),
.dashboard-hero-card--embedded .dashboard-kpi :deep(.ant-statistic-content-value-int),
.dashboard-hero-card--embedded .dashboard-kpi :deep(.ant-statistic-content-value-decimal),
.dashboard-hero-card--embedded .dashboard-kpi :deep(.ant-statistic-content-suffix) {
  min-width: 0;
  overflow: hidden;
  text-overflow: clip;
}

.dashboard-hero-card--embedded .hero-summary-memory,
.dashboard-hero-card--embedded .hero-alert-strip {
  padding: 8px 0;
}

.dashboard-hero-card--embedded .hero-summary-memory {
  gap: 4px;
}

.dashboard-hero-card--embedded .hero-summary-memory__head {
  gap: 8px;
}

.dashboard-hero-card--embedded .hero-summary-memory__head strong,
.dashboard-hero-card--embedded .hero-summary-memory__legend-item strong,
.dashboard-hero-card--embedded .hero-alert-strip__header strong,
.dashboard-hero-card--embedded .hero-alert-strip__message {
  font-size: 10px;
}

.dashboard-hero-card--embedded .hero-summary-memory__head strong {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--surface-1);
  box-shadow: inset 0 0 0 1px var(--border-subtle);
}

.dashboard-hero-card--embedded .hero-summary-memory__legend {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4px;
}

.dashboard-hero-card--embedded .hero-summary-memory__legend-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 3px;
  min-width: 0;
  padding: 3px 5px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--memory-segment-color) 10%, var(--surface-1));
}

.dashboard-hero-card--embedded .memory-composition__bar {
  height: 16px;
}

.dashboard-hero-card--embedded .memory-composition__segment {
  min-width: 3%;
}

.dashboard-hero-card--embedded .hero-alert-strip {
  gap: 4px;
}

.dashboard-hero-card--embedded .hero-alert-strip__item {
  gap: 2px;
  padding-top: 5px;
}

:global(body[data-theme="dark"] .right-panel-monitor .hero-summary-memory__head strong),
:global(body[data-theme="dark"] .right-panel-monitor .hero-summary-memory__legend-item strong),
:global(body[data-theme="dark"] .right-panel-monitor .hero-alert-strip__header strong),
:global(body[data-theme="dark"] .right-panel-monitor .hero-alert-strip__message) {
  color: #f5f5f5 !important;
}

:global(body[data-theme="dark"] .right-panel-monitor .dashboard-kpi__label),
:global(body[data-theme="dark"] .right-panel-monitor .dashboard-kpi__meta),
:global(body[data-theme="dark"] .right-panel-monitor .hero-summary-memory__head span),
:global(body[data-theme="dark"] .right-panel-monitor .hero-summary-memory__legend-item span),
:global(body[data-theme="dark"] .right-panel-monitor .hero-alert-strip__description),
:global(body[data-theme="dark"] .right-panel-monitor .hero-alert-strip__header span) {
  color: #a3a3a3 !important;
}

:global(body[data-theme="dark"] .right-panel-monitor .hero-alert-strip) {
  background: color-mix(in srgb, var(--error-color) 10%, #1f1f1f) !important;
  border-color: color-mix(in srgb, var(--error-color) 26%, #303030) !important;
}

:global(body[data-theme="dark"] .right-panel-monitor .hero-alert-strip__item) {
  border-top-color: #303030 !important;
}

@media (max-width: 768px) {
  .dashboard-hero {
    flex-direction: column;
    align-items: flex-start;
  }

  .dashboard-hero__toolbar {
    width: 100%;
    justify-items: stretch;
  }

  .dashboard-hero__toolbar-actions {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
