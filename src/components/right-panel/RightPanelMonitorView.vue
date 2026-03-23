<template>
  <div class="panel-content monitor-content right-panel-monitor" :class="{ 'right-panel-monitor--embedded': embedded }">
    <div class="monitor-dashboard">
      <RightPanelMonitorHero
        class="monitor-section"
        :placement="placement"
        :is-embedded="isEmbeddedMonitor"
        :can-refresh="canRefreshMonitor"
        :host-title="monitorHostTitle"
        :health-tone="monitorHealthTone"
        :health-label="monitorHealthLabel"
        :summary-text="monitorSummaryText"
        :last-update-text="lastUpdateText"
        :statistics="heroStatistics"
        :memory-info="memoryInfo"
        :memory-segments="memorySegments"
        :alerts="activeAlerts"
        :format-size="formatSize"
        @toggle="emit('toggle')"
        @refresh="refreshData"
      />

      <div class="dashboard-stack monitor-section">
        <RightPanelMonitorResources
          :is-embedded="isEmbeddedMonitor"
          :resource-highlights="resourceHighlights"
          :format-percent="formatPercent"
          :format-inline-text="formatResourceInlineText"
        />
        <RightPanelMonitorProcesses
          :is-embedded="isEmbeddedMonitor"
          :process-summary="processInfo"
          :process-columns="processColumns"
          :process-rows="topProcesses"
          :format-percent="formatPercent"
          :format-process-memory="formatProcessMemory"
        />
      </div>

      <RightPanelMonitorStorageNetwork
        class="monitor-section"
        :is-embedded="isEmbeddedMonitor"
        :show-all-disks="showAllDisks"
        :has-extra-disk-info="hasExtraDiskInfo"
        :sorted-disk-info="sortedDiskInfo"
        :visible-disk-info="visibleDiskInfo"
        :sorted-network-info="sortedNetworkInfo"
        :get-progress-color="getProgressColor"
        :format-percent="formatPercent"
        :format-size="formatSize"
        :format-network-speed="formatNetworkSpeed"
        @toggle-disks="showAllDisks = !showAllDisks"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRightPanelMonitor } from '../../composables/useRightPanelMonitor'
import type { MonitorTab, SshProfile } from '../../types/app'
import RightPanelMonitorHero from './RightPanelMonitorHero.vue'
import RightPanelMonitorProcesses from './RightPanelMonitorProcesses.vue'
import RightPanelMonitorResources from './RightPanelMonitorResources.vue'
import RightPanelMonitorStorageNetwork from './RightPanelMonitorStorageNetwork.vue'

const props = withDefaults(defineProps<{
  collapsed?: boolean
  connectionId?: string
  sshProfile?: SshProfile | null
  activeTab?: MonitorTab
  placement?: 'right' | 'left'
  embedded?: boolean
}>(), {
  collapsed: false,
  connectionId: '',
  sshProfile: null,
  activeTab: 'monitor',
  placement: 'right',
  embedded: false,
})

const emit = defineEmits(['toggle'])

const {
  processInfo,
  memoryInfo,
  showAllDisks,
  isEmbeddedMonitor,
  canRefreshMonitor,
  sortedDiskInfo,
  hasExtraDiskInfo,
  visibleDiskInfo,
  sortedNetworkInfo,
  monitorHealthTone,
  monitorHealthLabel,
  monitorHostTitle,
  monitorSummaryText,
  lastUpdateText,
  heroStatistics,
  resourceHighlights,
  topProcesses,
  processColumns,
  activeAlerts,
  memorySegments,
  refreshData,
  getProgressColor,
  formatNetworkSpeed,
  formatPercent,
  formatResourceInlineText,
  formatProcessMemory,
  formatSize,
} = useRightPanelMonitor({
  activeTab: computed(() => props.activeTab),
  collapsed: computed(() => props.collapsed),
  connectionId: computed(() => props.connectionId),
  embedded: computed(() => props.embedded),
  sshProfile: computed(() => props.sshProfile),
})
</script>

<style src="./monitorShared.css"></style>
<style scoped>
.right-panel-monitor {
  flex: 1;
  min-height: 0;
  padding: 14px 16px 18px;
  background:
    radial-gradient(circle at top left, rgba(24, 144, 255, 0.08), transparent 28%),
    linear-gradient(180deg, #f7f9fc 0%, #f0f2f5 100%);
}

.monitor-dashboard {
  display: grid;
  gap: 0;
}

.monitor-section {
  border-top: 1px solid var(--border-color);
}

.monitor-dashboard > .monitor-section:first-child {
  border-top: none;
}

.dashboard-stack {
  display: grid;
  gap: 0;
}

.right-panel-monitor--embedded {
  padding: 0;
}

:global(body[data-theme="dark"] .right-panel-monitor) {
  background:
    radial-gradient(circle at top left, rgba(255, 255, 255, 0.06), transparent 26%),
    linear-gradient(180deg, #171717 0%, #121212 100%);
}
</style>
