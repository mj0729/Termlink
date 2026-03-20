<template>
  <a-modal
    :open="open"
    title="修改文件权限"
    ok-text="确定"
    cancel-text="取消"
    :confirm-loading="loading"
    @ok="handleApply"
    @cancel="$emit('update:open', false)"
  >
    <div class="chmod-modal">
      <div class="chmod-modal__target">{{ name }}</div>
      <div class="chmod-modal__path">{{ path }}</div>

      <div class="chmod-modal__matrix">
        <div />
        <div class="chmod-modal__head">读取</div>
        <div class="chmod-modal__head">写入</div>
        <div class="chmod-modal__head">执行</div>

        <div class="chmod-modal__label">所有者</div>
        <a-checkbox v-model:checked="bits.ownerRead" />
        <a-checkbox v-model:checked="bits.ownerWrite" />
        <a-checkbox v-model:checked="bits.ownerExec" />

        <div class="chmod-modal__label">组</div>
        <a-checkbox v-model:checked="bits.groupRead" />
        <a-checkbox v-model:checked="bits.groupWrite" />
        <a-checkbox v-model:checked="bits.groupExec" />

        <div class="chmod-modal__label">其他</div>
        <a-checkbox v-model:checked="bits.otherRead" />
        <a-checkbox v-model:checked="bits.otherWrite" />
        <a-checkbox v-model:checked="bits.otherExec" />
      </div>

      <div class="chmod-modal__preview">
        八进制: <code>{{ octalMode }}</code>
      </div>

      <div v-if="isDirectory" class="chmod-modal__recursive">
        <a-checkbox v-model:checked="recursive">递归应用</a-checkbox>
        <a-radio-group v-if="recursive" v-model:value="applyScope" size="small">
          <a-radio value="all">全部</a-radio>
          <a-radio value="files">仅文件</a-radio>
          <a-radio value="dirs">仅目录</a-radio>
        </a-radio-group>
      </div>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'

const props = defineProps<{
  open: boolean
  loading: boolean
  path: string
  name: string
  isDirectory: boolean
  initialMode: string
}>()

const emit = defineEmits<{
  'update:open': [open: boolean]
  apply: [mode: number, recursive: boolean, scope: string]
}>()

const recursive = ref(false)
const applyScope = ref('all')

const bits = reactive({
  ownerRead: false, ownerWrite: false, ownerExec: false,
  groupRead: false, groupWrite: false, groupExec: false,
  otherRead: false, otherWrite: false, otherExec: false,
})

function digitToBits(d: number) {
  return { r: !!(d & 4), w: !!(d & 2), x: !!(d & 1) }
}

function bitsToDigit(r: boolean, w: boolean, x: boolean) {
  return (r ? 4 : 0) + (w ? 2 : 0) + (x ? 1 : 0)
}

const octalMode = computed(() => {
  const o = bitsToDigit(bits.ownerRead, bits.ownerWrite, bits.ownerExec)
  const g = bitsToDigit(bits.groupRead, bits.groupWrite, bits.groupExec)
  const t = bitsToDigit(bits.otherRead, bits.otherWrite, bits.otherExec)
  return `${o}${g}${t}`
})

watch(() => props.open, (isOpen) => {
  if (!isOpen) return
  recursive.value = false
  applyScope.value = 'all'

  const mode = props.initialMode.replace(/\D/g, '').slice(-3) || '644'
  const [o, g, t] = mode.split('').map(Number)
  const ob = digitToBits(o), gb = digitToBits(g), tb = digitToBits(t)
  bits.ownerRead = ob.r; bits.ownerWrite = ob.w; bits.ownerExec = ob.x
  bits.groupRead = gb.r; bits.groupWrite = gb.w; bits.groupExec = gb.x
  bits.otherRead = tb.r; bits.otherWrite = tb.w; bits.otherExec = tb.x
})

function handleApply() {
  const mode = parseInt(octalMode.value, 8)
  emit('apply', mode, recursive.value, applyScope.value)
}
</script>

<style scoped>
.chmod-modal__target {
  font-weight: 600;
  font-size: 14px;
}

.chmod-modal__path {
  font-size: 12px;
  color: var(--muted-color, #999);
  margin-bottom: 12px;
  word-break: break-all;
}

.chmod-modal__matrix {
  display: grid;
  grid-template-columns: auto repeat(3, 1fr);
  gap: 8px;
  align-items: center;
  margin-bottom: 12px;
}

.chmod-modal__head {
  font-size: 12px;
  font-weight: 500;
  text-align: center;
}

.chmod-modal__label {
  font-size: 12px;
}

.chmod-modal__matrix :deep(.ant-checkbox-wrapper) {
  justify-content: center;
}

.chmod-modal__preview {
  font-size: 13px;
  margin-bottom: 12px;
}

.chmod-modal__preview code {
  font-weight: 600;
  font-size: 14px;
  color: var(--primary-color, #1677ff);
}

.chmod-modal__recursive {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
</style>
