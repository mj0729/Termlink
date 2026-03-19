<template>
  <div class="top-menu">
    <div class="top-menu__nav">
      <div class="nav-cluster">
        <a-button class="nav-item nav-item--active" type="text">会话</a-button>
        <a-button class="nav-item" type="text">视图</a-button>
        <a-button class="nav-item nav-item--ghost" type="text" @click="$emit('showSettings')">
          <EllipsisOutlined />
        </a-button>
      </div>
    </div>

    <div class="top-menu__connections">
      <a-button type="text" class="connection-add" @click="$emit('openConnectionCenter')">
        <PlusOutlined />
      </a-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { EllipsisOutlined, PlusOutlined } from '@antdv-next/icons'

defineProps({
  tabCount: {
    type: Number,
    default: 0
  },
})

defineEmits(['showSettings', 'openConnectionCenter'])
</script>

<style scoped>
.top-menu {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 14px;
  padding: 12px 14px 10px;
  background: var(--topbar-bg);
}

.top-menu__nav,
.top-menu__connections {
  display: flex;
  align-items: center;
}

.top-menu__nav {
  gap: 10px;
  min-width: 0;
}

.top-menu__connections {
  gap: 10px;
  min-width: 0;
  justify-content: flex-end;
}

.nav-cluster {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.34);
  backdrop-filter: blur(12px);
}

.connection-add {
  width: 34px;
  height: 34px;
  min-width: 34px;
  flex-shrink: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.74);
  color: var(--primary-color);
  cursor: pointer;
  box-shadow: 0 10px 22px rgba(45, 125, 255, 0.14);
}

.nav-item {
  height: 34px;
  min-width: 34px;
  padding: 0 13px;
  border-radius: 999px;
  background: transparent;
  color: var(--muted-color);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.52);
  color: var(--text-color);
}

.nav-item--active {
  background: rgba(255, 255, 255, 0.74);
  color: var(--primary-color);
  box-shadow:
    0 10px 24px rgba(45, 125, 255, 0.12),
    inset 0 0 0 1px rgba(255, 255, 255, 0.38);
}

.nav-item--ghost {
  width: 34px;
  padding: 0;
}

.nav-item:deep(.ant-btn),
.connection-add:deep(.ant-btn) {
  height: 100%;
  min-width: inherit;
  padding: inherit;
  border-radius: inherit;
}

@media (max-width: 1240px) {
  .top-menu {
    grid-template-columns: auto minmax(0, 1fr);
  }
}

@media (max-width: 860px) {
  .top-menu {
    grid-template-columns: 1fr;
  }

  .top-menu__nav,
  .top-menu__connections {
    justify-content: space-between;
  }

  .top-menu__nav,
  .top-menu__connections {
    width: 100%;
  }

  .top-menu__connections {
    flex-wrap: wrap;
  }
}
</style>
