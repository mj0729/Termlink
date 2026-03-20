<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="remote-context-menu__backdrop"
      @click="$emit('close')"
      @contextmenu.prevent="$emit('close')"
    />
    <div
      v-if="open"
      class="remote-context-menu"
      :style="menuStyle"
      @click.stop
      @contextmenu.prevent
    >
      <div
        v-for="item in items"
        :key="item.key"
        class="remote-context-menu__item"
        :class="{ 'is-danger': item.danger, 'is-disabled': item.disabled }"
        @click="handleClick(item)"
      >
        {{ item.label }}
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface MenuItem {
  key: string
  label: string
  danger?: boolean
  disabled?: boolean
}

const props = defineProps<{
  open: boolean
  x: number
  y: number
  items: MenuItem[]
}>()

const emit = defineEmits<{
  click: [key: string]
  close: []
}>()

const menuStyle = computed(() => {
  const menuWidth = 180
  const menuHeight = props.items.length * 32 + 8
  const vw = window.innerWidth
  const vh = window.innerHeight
  const margin = 4

  return {
    left: `${Math.min(Math.max(props.x, margin), vw - menuWidth - margin)}px`,
    top: `${Math.min(Math.max(props.y, margin), vh - menuHeight - margin)}px`,
  }
})

function handleClick(item: MenuItem) {
  if (item.disabled) return
  emit('click', item.key)
  emit('close')
}
</script>

<style scoped>
.remote-context-menu__backdrop {
  position: fixed;
  inset: 0;
  z-index: 999;
}

.remote-context-menu {
  position: fixed;
  z-index: 1000;
  min-width: 160px;
  padding: 4px 0;
  background: var(--surface-0, #fff);
  border: 1px solid var(--border-color, #e8e8e8);
  border-radius: 8px;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
}

.remote-context-menu__item {
  padding: 6px 16px;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s;
}

.remote-context-menu__item:hover {
  background: var(--surface-1, #f5f5f5);
}

.remote-context-menu__item.is-danger {
  color: var(--error-color, #ff4d4f);
}

.remote-context-menu__item.is-disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
