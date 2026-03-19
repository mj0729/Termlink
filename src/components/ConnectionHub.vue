<template>
  <div class="connection-hub">
    <div class="hub-hero">
      <div class="hub-hero__copy">
        <span class="hub-hero__eyebrow">Connection Center</span>
        <div class="hub-hero__title-row">
          <h2>连接中心</h2>
          <span class="hub-hero__count">{{ filteredProfiles.length }} / {{ profiles.length }}</span>
        </div>
        <p class="hub-hero__subtitle">搜索、筛选并启动连接。把入口页改成真正适合日常 SSH 工作的高密度工作台。</p>
      </div>

      <div class="hub-hero__tools">
        <div class="hub-search">
          <SearchOutlined class="hub-search__icon" />
          <a-input
            v-model:value="searchText"
            placeholder="搜索连接、主机、分组或标签"
            allow-clear
          />
        </div>

        <div class="hub-actions">
          <a-button class="hub-action" @click="$emit('newLocal')">本地终端</a-button>
          <a-button type="primary" class="hub-action" @click="$emit('newSsh')">新建 SSH</a-button>
        </div>
      </div>
    </div>

    <div class="hub-toolbar">
      <a-segmented
        v-model:value="selectedGroup"
        class="hub-filters"
        :options="groupFilterOptions"
      />

      <div class="hub-stats">
        <div class="hub-stat">
          <span class="hub-stat__label">分组</span>
          <span class="hub-stat__value">{{ groups.length }}</span>
        </div>
        <div class="hub-stat">
          <span class="hub-stat__label">标签</span>
          <span class="hub-stat__value">{{ totalTagCount }}</span>
        </div>
        <div class="hub-stat">
          <span class="hub-stat__label">筛选</span>
          <span class="hub-stat__value">{{ selectedGroup === '__all__' ? '全部' : selectedGroup }}</span>
        </div>
      </div>
    </div>

    <div v-if="filteredProfiles.length" class="hub-grid">
      <a-card
        v-for="profile in filteredProfiles"
        :key="profile.id"
        hoverable
        class="hub-card"
        :class="{ 'is-active': activeProfileId === profile.id }"
        role="button"
        tabindex="0"
        @click="emit('launchProfile', profile)"
        @keydown.enter.prevent="emit('launchProfile', profile)"
        @keydown.space.prevent="emit('launchProfile', profile)"
      >
        <div class="hub-card__head">
          <div>
            <span class="hub-card__title">{{ profile.name || `${profile.username}@${profile.host}` }}</span>
            <span class="hub-card__host">{{ profile.host }}:{{ profile.port }}</span>
          </div>
          <span class="hub-card__status" :class="{ 'is-active': activeProfileId === profile.id }"></span>
        </div>

        <div class="hub-card__meta">
          <a-tag v-if="profile.group" class="hub-card__group" bordered="false">{{ profile.group }}</a-tag>
          <div v-if="profile.tags?.length" class="hub-card__tags">
            <a-tag v-for="tag in profile.tags" :key="tag" class="hub-card__tag" bordered="false">{{ tag }}</a-tag>
          </div>
        </div>
      </a-card>
    </div>

    <div v-else class="hub-empty">
      <div class="hub-empty__icon">
        <SearchOutlined />
      </div>
      <h3>{{ profiles.length ? '没有匹配的连接' : '还没有保存的连接' }}</h3>
      <p>
        {{ profiles.length ? '试试更换关键词或切换分组筛选。' : '新建一个 SSH 连接后，这里会成为你的连接入口页。' }}
      </p>
      <a-button type="primary" @click="$emit('newSsh')">创建连接</a-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { SearchOutlined } from '@antdv-next/icons'
import type { SshProfile } from '../types/app'

const props = withDefaults(defineProps<{
  profiles?: SshProfile[]
  activeProfileId?: string
}>(), {
  profiles: () => [],
  activeProfileId: ''
})

const emit = defineEmits(['launchProfile', 'newSsh', 'newLocal'])

const searchText = ref('')
const selectedGroup = ref('__all__')

const groups = computed(() => {
  const names = new Set<string>()
  props.profiles.forEach((profile) => {
    if (profile.group) {
      names.add(profile.group)
    }
  })
  return Array.from(names).sort()
})

const groupFilterOptions = computed(() => ([
  { label: '全部', value: '__all__' },
  ...groups.value.map((group) => ({
    label: group,
    value: group
  }))
]))

const totalTagCount = computed(() => {
  const tags = new Set<string>()
  props.profiles.forEach((profile) => {
    profile.tags?.forEach((tag) => tags.add(tag))
  })
  return tags.size
})

const filteredProfiles = computed(() => {
  const keyword = searchText.value.trim().toLowerCase()

  return props.profiles.filter((profile) => {
    const matchesGroup = selectedGroup.value === '__all__' || profile.group === selectedGroup.value
    if (!matchesGroup) return false
    if (!keyword) return true

    const haystack = [
      profile.name,
      profile.host,
      profile.username,
      profile.group,
      profile.tags?.join(' ')
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return haystack.includes(keyword)
  })
})
</script>

<style scoped>
.connection-hub {
  --hub-radius: 14px;
  --hub-border: rgba(255, 255, 255, 0.18);
  --hub-panel: rgba(255, 255, 255, 0.42);
  --hub-panel-strong: rgba(255, 255, 255, 0.72);
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;
  min-height: 0;
  padding: 10px 12px 12px;
  overflow-y: auto;
  border-radius: 0;
  background: transparent;
  border: none;
  box-shadow: none;
}

.hub-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 520px);
  gap: 10px;
  align-items: stretch;
  padding: 10px 12px;
  border-radius: 11px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(244, 248, 255, 0.03));
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.08);
}

.hub-hero__copy {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.hub-hero__eyebrow {
  color: var(--muted-color);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.hub-hero__title-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.hub-hero__title-row h2 {
  margin: 0;
  font-size: 18px;
  line-height: 1.1;
}

.hub-hero__count {
  flex-shrink: 0;
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(45, 125, 255, 0.1);
  color: var(--primary-color);
  font-size: 10px;
  font-weight: 800;
}

.hub-hero__subtitle {
  max-width: 640px;
  color: var(--muted-color);
  font-size: 11px;
  line-height: 1.55;
}

.hub-hero__tools {
  display: grid;
  gap: 10px;
}

.hub-search {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 6px 10px;
  border-radius: 10px;
  background: var(--hub-panel-strong);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.14);
}

.hub-search__icon {
  color: var(--muted-color);
  font-size: 14px;
}

.hub-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: flex-end;
}

.hub-action {
  min-width: 88px;
}

.hub-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 6px;
}

.hub-filters {
  max-width: 100%;
  padding: 3px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.28);
}

.hub-filters:deep(.ant-segmented-group) {
  flex-wrap: wrap;
}

.hub-filters:deep(.ant-segmented-item) {
  min-height: 26px;
  border-radius: 999px;
  color: var(--muted-color);
  font-size: 10px;
  font-weight: 700;
}

.hub-filters:deep(.ant-segmented-item-selected) {
  color: var(--primary-color);
  box-shadow: 0 8px 18px rgba(41, 70, 116, 0.08);
}

.hub-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.hub-stat {
  display: grid;
  gap: 2px;
  min-width: 78px;
  padding: 6px 8px;
  border-radius: 10px;
  background: var(--hub-panel);
  box-shadow: inset 0 0 0 1px var(--hub-border);
}

.hub-stat__label {
  color: var(--muted-color);
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.hub-stat__value {
  color: var(--text-color);
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}

.hub-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 8px;
  padding: 0 2px 2px;
}

.hub-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 104px;
  border: 1px solid transparent;
  border-radius: 12px;
  text-align: left;
  background:
    linear-gradient(160deg, rgba(255, 255, 255, 0.2), rgba(241, 247, 255, 0.08));
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.1);
  cursor: pointer;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    background-color 0.2s ease;
}

.hub-card:hover {
  transform: translateY(-1px);
  box-shadow:
    inset 0 0 0 1px rgba(45, 125, 255, 0.12);
}

.hub-card.is-active {
  border-color: rgba(45, 125, 255, 0.14);
  background:
    linear-gradient(160deg, rgba(228, 240, 255, 0.28), rgba(241, 247, 255, 0.12));
  box-shadow:
    inset 0 0 0 1px rgba(45, 125, 255, 0.14);
}

.hub-card:deep(.ant-card-body) {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
}

.hub-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.hub-card__title {
  display: block;
  color: var(--text-color);
  font-size: 13px;
  font-weight: 700;
  line-height: 1.25;
}

.hub-card__host {
  display: block;
  margin-top: 4px;
  color: var(--muted-color);
  font-size: 10px;
  font-weight: 600;
}

.hub-card__status {
  width: 9px;
  height: 9px;
  flex-shrink: 0;
  border-radius: 50%;
  background: rgba(128, 148, 177, 0.35);
}

.hub-card__status.is-active {
  background: var(--success-color);
  box-shadow: 0 0 0 5px rgba(74, 169, 107, 0.1);
}

.hub-card__meta {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.hub-card__group {
  width: fit-content;
  background: rgba(45, 125, 255, 0.12);
  color: var(--primary-color);
  font-size: 9px;
  font-weight: 800;
}

.hub-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.hub-card__tag {
  background: rgba(128, 148, 177, 0.12);
  color: var(--muted-color);
  font-size: 9px;
  font-weight: 700;
}

.hub-empty {
  display: flex;
  flex: 1;
  min-height: 260px;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 12px;
  text-align: center;
  color: var(--muted-color);
}

.hub-empty__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.58);
  color: var(--primary-color);
  font-size: 24px;
}

.hub-empty h3 {
  color: var(--text-color);
  font-size: 20px;
}

.hub-empty p {
  max-width: 420px;
  font-size: 13px;
  line-height: 1.65;
}

@media (max-width: 860px) {
  .connection-hub {
    padding: 6px;
  }

  .hub-hero {
    grid-template-columns: 1fr;
  }

  .hub-hero__tools,
  .hub-toolbar {
    flex-direction: column;
    align-items: flex-start;
  }

  .hub-actions,
  .hub-stats {
    width: 100%;
    justify-content: flex-start;
  }
}
</style>
