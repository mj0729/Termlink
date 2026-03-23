<template>
  <a-modal
    :open="open"
    title="修改所有者"
    wrap-class-name="chown-modal-shell"
    :classes="modalClasses"
    :styles="modalStyles"
    :close-icon="closeIconNode"
    :confirm-loading="loading"
    @cancel="handleCancel"
  >
    <div class="chown-modal">
      <div class="chown-modal__path">{{ path }}</div>

      <a-form layout="vertical" :label-col="{ span: 24 }">
        <a-form-item label="用户">
          <a-input v-model:value="user" placeholder="用户名" />
        </a-form-item>
        <a-form-item label="用户组">
          <a-input v-model:value="group" placeholder="用户组名" />
        </a-form-item>
        <a-form-item>
          <a-checkbox v-model:checked="recursive">递归应用到子目录和文件</a-checkbox>
        </a-form-item>
      </a-form>
    </div>
    <template #footer>
      <div class="chown-modal__footer">
        <a-button class="chown-modal__action chown-modal__action--ghost" @click="handleCancel">
          取消
        </a-button>
        <a-button
          type="primary"
          class="chown-modal__action chown-modal__action--primary"
          :loading="loading"
          @click="handleApply"
        >
          确定
        </a-button>
      </div>
    </template>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, h, ref, watch } from 'vue'
import { CloseOutlined } from '@antdv-next/icons'

const props = defineProps<{
  open: boolean
  loading: boolean
  path: string
  currentOwner: string
  currentGroup: string
}>()

const emit = defineEmits<{
  'update:open': [open: boolean]
  apply: [user: string, group: string, recursive: boolean]
}>()

const closeIconNode = computed(() => h(CloseOutlined, { class: 'modal-close-icon' }))
const modalClasses = {
  container: 'chown-modal__container',
}
const CHOWN_MODAL_FIXED_HEIGHT = 'min(420px, calc(100vh - 24px))'
const modalStyles = {
  mask: {
    background: 'var(--overlay-mask-bg)',
    backdropFilter: 'blur(12px)',
  },
  container: {
    background: 'var(--overlay-panel-solid)',
    border: '1px solid var(--border-color)',
    boxShadow: 'none',
    height: CHOWN_MODAL_FIXED_HEIGHT,
    minHeight: CHOWN_MODAL_FIXED_HEIGHT,
    maxHeight: CHOWN_MODAL_FIXED_HEIGHT,
    display: 'flex',
    flexDirection: 'column',
    padding: '0',
    overflow: 'hidden',
    borderRadius: '14px',
  },
  header: {
    background: 'var(--overlay-panel-solid)',
    borderBottom: '1px solid var(--overlay-divider-color)',
    marginBottom: '0',
    padding: '18px 20px 14px',
  },
  body: {
    background: 'var(--overlay-panel-solid)',
    color: 'var(--text-color)',
    flex: '1 1 auto',
    minHeight: '0',
    overflowY: 'auto',
    padding: '16px 20px 12px',
  },
  footer: {
    background: 'var(--overlay-panel-solid)',
    borderTop: '1px solid var(--overlay-divider-color)',
    flex: 'none',
    padding: '12px 20px 18px',
  },
}

const user = ref('')
const group = ref('')
const recursive = ref(false)

watch(() => props.open, (isOpen) => {
  if (!isOpen) return
  user.value = props.currentOwner
  group.value = props.currentGroup
  recursive.value = false
})

function handleApply() {
  if (!user.value.trim()) return
  emit('apply', user.value.trim(), group.value.trim(), recursive.value)
}

function handleCancel() {
  emit('update:open', false)
}
</script>

<style scoped>
:deep(.chown-modal-shell .ant-modal-content) {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  display: flex;
  flex-direction: column;
  padding: 0 !important;
  overflow: hidden !important;
  border-radius: 14px !important;
}

:deep(.chown-modal__container) {
  background: var(--overlay-panel-solid) !important;
  border-radius: 14px !important;
}

:deep(.chown-modal-shell .ant-modal-close) {
  color: var(--text-color) !important;
}

:deep(.chown-modal-shell .ant-modal-close:hover) {
  background: var(--hover-bg) !important;
}

:deep(.chown-modal-shell .modal-close-icon),
:deep(.chown-modal-shell .modal-close-icon svg) {
  color: var(--text-color) !important;
}

.chown-modal__path {
  font-size: 12px;
  color: var(--muted-color, #999);
  margin-bottom: 12px;
  word-break: break-all;
}

.chown-modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

:deep(.chown-modal__action) {
  min-width: 78px;
  border-radius: 10px !important;
  font-weight: 700;
  box-shadow: none !important;
}

:deep(.chown-modal__action--ghost) {
  background: var(--surface-2) !important;
  border-color: var(--border-color) !important;
  color: var(--text-color) !important;
}

:deep(.chown-modal__action--ghost:hover) {
  background: var(--hover-bg) !important;
  border-color: var(--strong-border) !important;
}

:deep(.chown-modal__action--primary) {
  background: var(--text-color) !important;
  border-color: var(--text-color) !important;
  color: var(--bg-color) !important;
}

:deep(.chown-modal__action--primary:hover) {
  background: var(--strong-border) !important;
  border-color: var(--strong-border) !important;
  color: var(--bg-color) !important;
}
</style>
