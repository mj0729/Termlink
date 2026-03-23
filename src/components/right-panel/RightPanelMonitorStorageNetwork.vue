<template>
  <div class="dashboard-bottom-grid" :class="{ 'dashboard-bottom-grid--embedded': isEmbedded }">
    <a-card :bordered="false" class="dashboard-card">
      <div class="dashboard-section-head dashboard-section-head--with-action">
        <div>
          <h4>磁盘容量</h4>
        </div>
        <a-button
          v-if="hasExtraDiskInfo"
          type="text"
          size="small"
          class="section-action-btn"
          @click="emit('toggle-disks')"
        >
          {{ showAllDisks ? '收起' : `更多 ${sortedDiskInfo.length - 2}` }}
        </a-button>
      </div>

      <div class="disk-grid">
        <div
          v-for="disk in visibleDiskInfo"
          :key="`${disk.device}-${disk.mountpoint}`"
          class="disk-card"
        >
          <div v-if="isEmbedded" class="disk-card__compact">
            <div class="disk-card__compact-head">
              <strong class="disk-card__mountpoint" :title="disk.mountpoint || '-'">{{ disk.mountpoint || '-' }}</strong>
              <span class="disk-card__percent" :style="{ color: getProgressColor(disk.usage || 0) }">
                {{ formatPercent(disk.usage) }}
              </span>
            </div>
            <div class="disk-card__compact-meta">
              <span class="disk-card__device" :title="disk.device">{{ disk.device }}</span>
              <span class="disk-card__summary" :title="`已用 ${formatSize(disk.used)} · 可用 ${formatSize(disk.available)} · ${disk.filesystem || '-'}`">
                已用 {{ formatSize(disk.used) }} · 可用 {{ formatSize(disk.available) }} · {{ disk.filesystem || '-' }}
              </span>
            </div>
          </div>
          <div v-else class="disk-card__row">
            <div class="disk-card__identity">
              <strong>{{ disk.mountpoint || '-' }}</strong>
              <span>{{ disk.device }}</span>
            </div>
            <div class="disk-card__usage">
              <span class="disk-card__percent" :style="{ color: getProgressColor(disk.usage || 0) }">
                {{ formatPercent(disk.usage) }}
              </span>
              <span class="disk-card__summary">
                已用 {{ formatSize(disk.used) }} · 可用 {{ formatSize(disk.available) }} · {{ disk.filesystem || '-' }}
              </span>
            </div>
          </div>

          <a-progress
            :percent="disk.usage || 0"
            :show-info="false"
            :stroke-color="getProgressColor(disk.usage || 0)"
            :stroke-width="10"
          />
        </div>
      </div>
    </a-card>

    <a-card :bordered="false" class="dashboard-card">
      <div class="dashboard-section-head dashboard-section-head--inline-meta">
        <div>
          <h4>网络接口</h4>
        </div>
        <span class="dashboard-section-head__meta">{{ sortedNetworkInfo.length }} 个接口</span>
      </div>

      <div class="interface-grid">
        <div
          v-for="interface_ in sortedNetworkInfo"
          :key="interface_.name"
          class="interface-card"
        >
          <div class="interface-card__row">
            <div class="interface-card__identity">
              <strong>{{ interface_.name }}</strong>
              <span>{{ interface_.ip || '未分配 IP' }}</span>
            </div>
            <div class="interface-card__live">
              <span class="interface-card__metric">
                ↓ {{ formatNetworkSpeed(interface_.rx_speed || 0) }}
              </span>
              <span class="interface-card__metric">
                ↑ {{ formatNetworkSpeed(interface_.tx_speed || 0) }}
              </span>
              <span class="dense-inline-pill" :class="{ 'is-active': interface_.status === 'up' }">
                {{ interface_.status || 'unknown' }}
              </span>
            </div>
          </div>

          <div class="interface-card__totals">
            <span>↓累计 {{ formatSize(interface_.rx_bytes) }}</span>
            <span>↑累计 {{ formatSize(interface_.tx_bytes) }}</span>
          </div>
        </div>
      </div>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import type {
  DiskInfo,
  MonitorDiskColorGetter,
  MonitorNumberFormatter,
  MonitorSizeFormatter,
  MonitorSpeedFormatter,
  NetworkInfo,
} from './monitorViewTypes'

defineProps({
  isEmbedded: {
    type: Boolean,
    required: true,
  },
  showAllDisks: {
    type: Boolean,
    required: true,
  },
  hasExtraDiskInfo: {
    type: Boolean,
    required: true,
  },
  sortedDiskInfo: {
    type: Array as PropType<DiskInfo[]>,
    required: true,
  },
  visibleDiskInfo: {
    type: Array as PropType<DiskInfo[]>,
    required: true,
  },
  sortedNetworkInfo: {
    type: Array as PropType<NetworkInfo[]>,
    required: true,
  },
  getProgressColor: {
    type: Function as PropType<MonitorDiskColorGetter>,
    required: true,
  },
  formatPercent: {
    type: Function as PropType<MonitorNumberFormatter>,
    required: true,
  },
  formatSize: {
    type: Function as PropType<MonitorSizeFormatter>,
    required: true,
  },
  formatNetworkSpeed: {
    type: Function as PropType<MonitorSpeedFormatter>,
    required: true,
  },
})

const emit = defineEmits(['toggle-disks'])
</script>

<style scoped>
.dashboard-bottom-grid {
  display: grid;
  gap: 0;
}

.dashboard-card + .dashboard-card {
  border-top: 1px solid var(--border-subtle) !important;
}

.dashboard-section-head h4,
.disk-card__identity strong,
.interface-card__identity strong,
.interface-card__metric {
  color: var(--text-color);
}

.disk-card__identity span,
.interface-card__identity span,
.interface-card__totals,
.disk-card__summary {
  color: var(--muted-color);
}

.section-action-btn {
  min-height: 22px !important;
  padding-inline: 8px !important;
  font-size: 10px !important;
  font-weight: 700 !important;
}

.disk-grid,
.interface-grid {
  display: grid;
  gap: 0;
  grid-template-columns: 1fr;
}

.disk-card,
.interface-card {
  display: grid;
  gap: 8px;
  padding: 10px 0;
  border-top: 1px solid var(--border-subtle);
}

.disk-card:first-child,
.interface-card:first-child {
  border-top: none;
}

.disk-card__row,
.interface-card__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: 10px;
}

.disk-card__identity,
.interface-card__identity,
.disk-card__usage,
.disk-card__compact {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.disk-card__compact-head,
.disk-card__compact-meta {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 6px;
}

.disk-card__mountpoint,
.disk-card__device,
.disk-card__summary,
.interface-card__identity strong,
.interface-card__identity span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.disk-card__identity strong,
.interface-card__identity strong {
  font-size: 12px;
  font-weight: 600;
}

.disk-card__percent,
.disk-card__summary,
.interface-card__metric {
  font-family: "SFMono-Regular", "JetBrains Mono", Consolas, monospace;
}

.disk-card__percent {
  font-size: 12px;
  font-weight: 700;
}

.disk-card__summary {
  font-size: 11px;
  font-weight: 500;
}

.interface-card__live {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 4px 8px;
  min-width: 0;
}

.interface-card__metric {
  font-size: 12px;
  font-weight: 600;
}

.interface-card__totals {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
}

.dense-inline-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 18px;
  padding: 0 7px;
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
}

.dense-inline-pill.is-active {
  color: var(--success-color);
  background: rgba(74, 169, 107, 0.12);
  border-color: rgba(74, 169, 107, 0.16);
}

:global(body[data-theme="dark"] .right-panel-monitor .disk-card__identity strong),
:global(body[data-theme="dark"] .right-panel-monitor .interface-card__identity strong),
:global(body[data-theme="dark"] .right-panel-monitor .interface-card__metric) {
  color: #f5f5f5 !important;
}

:global(body[data-theme="dark"] .right-panel-monitor .disk-card__identity span),
:global(body[data-theme="dark"] .right-panel-monitor .interface-card__identity span),
:global(body[data-theme="dark"] .right-panel-monitor .interface-card__totals),
:global(body[data-theme="dark"] .right-panel-monitor .disk-card__summary) {
  color: #a3a3a3 !important;
}

:global(body[data-theme="dark"] .right-panel-monitor .dense-inline-pill.is-active) {
  background: #262626 !important;
  border-color: #404040 !important;
}

@media (max-width: 768px) {
  .dashboard-section-head {
    flex-direction: column;
    align-items: flex-start;
  }

  .disk-card__row,
  .interface-card__row {
    grid-template-columns: 1fr;
  }
}

.dashboard-bottom-grid--embedded .dashboard-section-head__meta {
  font-size: 9px;
}

.dashboard-bottom-grid--embedded .section-action-btn {
  min-height: 20px !important;
  padding-inline: 7px !important;
  font-size: 9px !important;
}

.dashboard-bottom-grid--embedded .disk-card,
.dashboard-bottom-grid--embedded .interface-card {
  gap: 3px;
  padding: 8px 0;
}

.dashboard-bottom-grid--embedded .interface-card__row {
  grid-template-columns: 1fr;
  gap: 4px;
}

.dashboard-bottom-grid--embedded .disk-card__compact-head,
.dashboard-bottom-grid--embedded .disk-card__compact-meta {
  gap: 4px 8px;
}

.dashboard-bottom-grid--embedded .disk-card__mountpoint,
.dashboard-bottom-grid--embedded .interface-card__identity strong {
  font-size: 11px;
}

.dashboard-bottom-grid--embedded .disk-card__device,
.dashboard-bottom-grid--embedded .disk-card__summary,
.dashboard-bottom-grid--embedded .interface-card__identity span,
.dashboard-bottom-grid--embedded .interface-card__totals {
  font-size: 8px;
}

.dashboard-bottom-grid--embedded .disk-card__summary {
  max-width: 148px;
  text-align: right;
}

.dashboard-bottom-grid--embedded .disk-card__percent,
.dashboard-bottom-grid--embedded .interface-card__metric {
  font-size: 10px;
}

.dashboard-bottom-grid--embedded .interface-card__live {
  justify-content: flex-start;
  gap: 2px 8px;
}

.dashboard-bottom-grid--embedded .dense-inline-pill {
  min-height: 16px;
  padding: 0 6px;
  font-size: 8px;
}
</style>
