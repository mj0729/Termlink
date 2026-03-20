<template>
  <a-modal
    :open="open"
    title="修改所有者"
    ok-text="确定"
    cancel-text="取消"
    :confirm-loading="loading"
    @ok="handleApply"
    @cancel="$emit('update:open', false)"
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
  </a-modal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

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
</script>

<style scoped>
.chown-modal__path {
  font-size: 12px;
  color: var(--muted-color, #999);
  margin-bottom: 12px;
  word-break: break-all;
}
</style>
