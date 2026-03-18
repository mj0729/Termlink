<template>
  <div class="top-menu flex flex-wrap items-center justify-between gap-4 px-5 py-4">
    <div class="top-menu__nav flex min-w-[200px] items-center gap-2.5">
      <button class="nav-item nav-item--active" type="button">会话</button>
      <button class="nav-item" type="button">视图</button>
      <button class="nav-item nav-item--ghost" type="button" @click="$emit('showSettings')">
        <EllipsisOutlined />
      </button>
    </div>

    <div class="top-menu__meta flex min-w-0 flex-1 items-center justify-center gap-3.5">
      <div class="meta-pill inline-flex max-w-[420px] items-center gap-2.5 rounded-full border border-[var(--border-color)] bg-[var(--surface-1)] px-4 py-3">
        <span class="meta-pill__dot" :class="{ 'is-live': activeConnection }"></span>
        <span class="meta-pill__label">{{ activeConnection || '尚未建立远程会话' }}</span>
      </div>
      <div class="theme-switcher inline-flex gap-1 rounded-full border border-[var(--border-color)] bg-[var(--surface-2)] p-1">
        <button
          type="button"
          class="theme-option"
          :class="{ 'is-active': theme === 'light' }"
          @click="$emit('toggleTheme', 'light')"
        >
          浅色
        </button>
        <button
          type="button"
          class="theme-option"
          :class="{ 'is-active': theme === 'dark' }"
          @click="$emit('toggleTheme', 'dark')"
        >
          深色
        </button>
      </div>
    </div>

    <div class="top-menu__actions flex min-w-[280px] items-center justify-end gap-3.5">
      <span class="session-count rounded-full border border-[var(--border-color)] bg-[var(--surface-2)] px-3 py-2">{{ tabCount }} 个标签页</span>
      <a-space :size="10">
        <a-button class="action-btn action-btn--ghost" @click="$emit('newLocal')">
          <PlusOutlined />
          本地
        </a-button>
        <a-button class="action-btn action-btn--primary" @click="$emit('newSsh')">
          <SearchOutlined />
          SSH
        </a-button>
      </a-space>
    </div>
  </div>
</template>

<script setup lang="ts">
import { 
  PlusOutlined, 
  SearchOutlined,
  EllipsisOutlined
} from '@antdv-next/icons'

defineProps({
  theme: {
    type: String,
    default: 'dark'
  },
  activeConnection: {
    type: String,
    default: ''
  },
  tabCount: {
    type: Number,
    default: 0
  }
})

defineEmits(['newLocal', 'newSsh', 'toggleTheme', 'showSettings'])
</script>

<style scoped>
.top-menu {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  min-height: 78px;
  padding: 16px 20px;
  background: var(--topbar-bg);
  border-bottom: 1px solid var(--border-subtle);
  backdrop-filter: blur(18px);
}

.top-menu__nav,
.top-menu__actions,
.top-menu__meta {
  display: flex;
  align-items: center;
}

.top-menu__nav {
  gap: 10px;
  min-width: 200px;
}

.top-menu__meta {
  gap: 14px;
  flex: 1;
  justify-content: center;
  min-width: 0;
}

.top-menu__actions {
  gap: 14px;
  justify-content: flex-end;
  min-width: 280px;
}

.nav-item {
  height: 42px;
  padding: 0 16px;
  border: none;
  border-radius: 14px;
  background: transparent;
  color: var(--muted-color);
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}

.nav-item:hover {
  background: var(--surface-2);
  color: var(--text-color);
}

.nav-item--active {
  background: var(--primary-soft);
  color: var(--primary-color);
  box-shadow: inset 0 0 0 1px var(--primary-ring);
}

.nav-item--ghost {
  width: 42px;
  padding: 0;
}

.meta-pill {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  max-width: 420px;
  padding: 11px 16px;
  border-radius: 999px;
  background: var(--surface-1);
  border: 1px solid var(--border-color);
}

.meta-pill__dot {
  width: 9px;
  height: 9px;
  flex-shrink: 0;
  border-radius: 50%;
  background: #b9c7d9;
}

.meta-pill__dot.is-live {
  background: var(--success-color);
  box-shadow: 0 0 0 6px rgba(77, 179, 111, 0.12);
}

.meta-pill__label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-color);
  font-size: 13px;
  font-weight: 600;
}

.theme-switcher {
  display: inline-flex;
  padding: 4px;
  gap: 4px;
  border-radius: 999px;
  background: var(--surface-2);
  border: 1px solid var(--border-color);
}

.theme-option {
  height: 34px;
  padding: 0 14px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--muted-color);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}

.theme-option.is-active {
  background: var(--surface-1);
  color: var(--text-color);
  box-shadow: var(--shadow-card);
}

.session-count {
  color: var(--muted-color);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.action-btn {
  height: 42px;
  border-radius: 14px;
  padding-inline: 16px;
  font-weight: 700;
  box-shadow: none;
}

.action-btn--ghost {
  background: var(--surface-1);
  border-color: var(--strong-border);
  color: var(--primary-color);
}

.action-btn--primary {
  background: linear-gradient(135deg, #2d7dff, #5aa7ff);
  border: none;
  color: #fff;
  box-shadow: 0 16px 32px rgba(45, 125, 255, 0.28);
}

@media (max-width: 1240px) {
  .top-menu {
    flex-wrap: wrap;
    justify-content: center;
  }

  .top-menu__meta {
    order: 3;
    width: 100%;
  }
}
</style>
