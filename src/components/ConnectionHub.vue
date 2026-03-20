<template>
  <div class="connection-hub">
    <section class="hub-workbench">
      <aside class="hub-sidebar" aria-label="连接目录">
        <section class="hub-sidebar__section">
          <div class="hub-sidebar__title-row">
            <h2>分组</h2>
            <div class="hub-sidebar__title-tools">
              <span>{{ groups.length }}</span>
              <button
                type="button"
                class="hub-icon-action"
                aria-label="新增分组"
                title="新增分组"
                @click="emit('createGroup')"
              >
                <PlusOutlined aria-hidden="true" />
              </button>
            </div>
          </div>

          <div class="hub-sidebar__menu">
            <button
              v-for="group in groupItems"
              :key="group.value"
              type="button"
              class="hub-nav-item"
              :class="{ 'is-active': selectedGroup === group.value }"
              @click="selectedGroup = group.value"
            >
              <span class="hub-nav-item__label">{{ group.label }}</span>
              <span class="hub-nav-item__count">{{ group.count }}</span>
              <span v-if="group.value !== '__all__'" class="hub-nav-item__actions">
                <button
                  type="button"
                  class="hub-icon-action"
                  aria-label="编辑分组"
                  title="编辑分组"
                  @click.stop="emit('renameGroup', group.value)"
                >
                  <EditOutlined aria-hidden="true" />
                </button>
                <button
                  type="button"
                  class="hub-icon-action hub-icon-action--danger"
                  aria-label="删除分组"
                  title="删除分组"
                  @click.stop="emit('deleteGroup', group.value)"
                >
                  <DeleteOutlined aria-hidden="true" />
                </button>
              </span>
            </button>
          </div>
        </section>

        <section class="hub-sidebar__section">
          <div class="hub-sidebar__title-row">
            <h2>标签</h2>
            <div class="hub-sidebar__title-tools">
              <span>{{ tagItems.length - 1 }}</span>
            </div>
          </div>

          <div class="hub-sidebar__menu">
            <button
              v-for="tag in tagItems"
              :key="tag.value"
              type="button"
              class="hub-nav-item"
              :class="{ 'is-active': selectedTag === tag.value }"
              @click="selectedTag = tag.value"
            >
              <span class="hub-nav-item__label hub-nav-item__label--tag">
                <span
                  v-if="tag.dotColor"
                  class="hub-nav-item__dot"
                  :style="{ backgroundColor: tag.dotColor }"
                ></span>
                <span>{{ tag.label }}</span>
              </span>
              <span class="hub-nav-item__count">{{ tag.count }}</span>
            </button>
          </div>
        </section>

      </aside>

      <section class="hub-main">
        <div class="hub-main__bar">
          <label class="hub-search" :for="searchInputId">
            <SearchOutlined class="hub-search__icon" aria-hidden="true" />
            <a-input
              :id="searchInputId"
              v-model:value="searchText"
              aria-label="搜索连接"
              autocomplete="off"
              name="connection-search"
              placeholder="搜索主机 / 用户 / 分组 / 标签…"
              :spellcheck="false"
              allow-clear
            />
          </label>

          <div class="hub-toolbar__actions">
            <a-button type="primary" class="hub-action" @click="$emit('newSsh')">新增连接</a-button>
          </div>

          <div class="hub-main__summary">
            <span class="hub-badge">{{ filteredProfiles.length }} 项结果</span>
          </div>
        </div>

        <div class="hub-content" aria-labelledby="connection-library-title">
          <div class="hub-content__head">
            <div>
              <h2 id="connection-library-title">连接列表</h2>
            </div>
          </div>

          <template v-if="filteredProfiles.length">
            <div v-if="props.viewMode === 'list'" class="hub-list" role="table" aria-label="连接列表">
              <div class="hub-list__head" role="row">
                <span role="columnheader">目标</span>
                <span role="columnheader">地址</span>
                <span role="columnheader">认证</span>
                <span role="columnheader">标签</span>
                <span role="columnheader">状态</span>
                <span role="columnheader">操作</span>
              </div>

              <div
                v-for="profile in filteredProfiles"
                :key="profile.id"
                class="hub-row"
                :class="{ 'is-active': activeProfileId === profile.id }"
                role="button"
                tabindex="0"
                :aria-pressed="activeProfileId === profile.id"
                @click="emit('launchProfile', profile)"
                @keydown.enter.prevent="emit('launchProfile', profile)"
                @keydown.space.prevent="emit('launchProfile', profile)"
              >
                <div class="hub-row__cell hub-row__cell--target">
                  <span class="hub-row__avatar">{{ getProfileMonogram(profile) }}</span>
                  <div class="hub-row__identity">
                    <span class="hub-row__name">{{ getProfileDisplayName(profile) }}</span>
                    <span class="hub-row__sub">{{ profile.group || '未分组' }}</span>
                  </div>
                </div>

                <div class="hub-row__cell hub-row__cell--address">
                  <span class="hub-row__address">{{ profile.username }}@{{ profile.host }}</span>
                  <span class="hub-row__port">:{{ profile.port }}</span>
                </div>

                <div class="hub-row__cell hub-row__cell--meta">
                  <span class="hub-chip hub-chip--accent">{{ getAuthLabel(profile) }}</span>
                </div>

                <div class="hub-row__cell hub-row__cell--tags">
                  <span
                    v-for="tag in getVisibleTags(profile)"
                    :key="tag"
                    class="hub-chip hub-chip--tag"
                    :style="getTagStyle(tag)"
                  >
                    {{ tag }}
                  </span>
                  <span v-if="getHiddenTagCount(profile) > 0" class="hub-chip">+{{ getHiddenTagCount(profile) }}</span>
                  <span v-if="!profile.tags?.length" class="hub-row__placeholder">无标签</span>
                </div>

                <div class="hub-row__cell hub-row__cell--status">
                  <span class="hub-state" :class="{ 'is-active': activeProfileId === profile.id }">
                    {{ activeProfileId === profile.id ? '已连接' : '就绪' }}
                  </span>
                </div>

                <div class="hub-row__cell hub-row__cell--actions">
                  <button
                    type="button"
                    class="hub-icon-action"
                    aria-label="编辑连接"
                    title="编辑连接"
                    @click.stop="emit('editProfile', profile)"
                  >
                    <EditOutlined aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    class="hub-icon-action hub-icon-action--danger"
                    aria-label="删除连接"
                    title="删除连接"
                    @click.stop="emit('deleteProfile', profile)"
                  >
                    <DeleteOutlined aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>

            <div v-else class="hub-grid" role="list">
              <div
                v-for="profile in filteredProfiles"
                :key="profile.id"
                class="hub-card"
                :class="{ 'is-active': activeProfileId === profile.id }"
                role="button"
                tabindex="0"
                :aria-pressed="activeProfileId === profile.id"
                @click="emit('launchProfile', profile)"
                @keydown.enter.prevent="emit('launchProfile', profile)"
                @keydown.space.prevent="emit('launchProfile', profile)"
              >
                <div class="hub-card__top">
                  <div class="hub-card__lead">
                    <span class="hub-card__avatar">{{ getProfileMonogram(profile) }}</span>
                    <div class="hub-card__identity">
                      <span class="hub-card__name">{{ getProfileDisplayName(profile) }}</span>
                      <span class="hub-card__endpoint">{{ profile.username }}@{{ profile.host }}:{{ profile.port }}</span>
                    </div>
                  </div>

                  <div class="hub-card__actions">
                    <button
                      type="button"
                      class="hub-icon-action"
                      aria-label="编辑连接"
                      title="编辑连接"
                      @click.stop="emit('editProfile', profile)"
                    >
                      <EditOutlined aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      class="hub-icon-action hub-icon-action--danger"
                      aria-label="删除连接"
                      title="删除连接"
                      @click.stop="emit('deleteProfile', profile)"
                    >
                      <DeleteOutlined aria-hidden="true" />
                    </button>
                  </div>
                </div>

                <div class="hub-card__meta">
                  <span v-if="profile.group" class="hub-chip">{{ profile.group }}</span>
                  <span class="hub-chip hub-chip--accent">{{ getAuthLabel(profile) }}</span>
                  <span v-if="activeProfileId === profile.id" class="hub-state is-active">已连接</span>
                </div>
              </div>
            </div>
          </template>

          <div v-else class="hub-empty">
            <div class="hub-empty__icon">
              <SearchOutlined aria-hidden="true" />
            </div>
            <h3>{{ profiles.length ? '没有匹配结果' : '还没有连接配置' }}</h3>
            <p>{{ profiles.length ? '换个关键词或筛选条件再试一次。' : '创建第一个 SSH 目标后，这里会成为你的连接工作台。' }}</p>
            <a-button type="primary" @click="$emit('newSsh')">创建连接</a-button>
          </div>
        </div>
      </section>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { DeleteOutlined, EditOutlined, PlusOutlined, SearchOutlined } from '@antdv-next/icons'
import type { ConnectionHubViewMode, SshProfile, ThemeName } from '../types/app'
import { PROFILE_TAG_PRESETS, getProfileTagPreset } from '../constants/profileTags'

const props = withDefaults(defineProps<{
  profiles?: SshProfile[]
  groups?: string[]
  activeProfileId?: string
  viewMode?: ConnectionHubViewMode
  theme?: ThemeName
}>(), {
  profiles: () => [],
  groups: () => [],
  activeProfileId: '',
  viewMode: 'list',
  theme: 'light'
})

const emit = defineEmits([
  'launchProfile',
  'newSsh',
  'editProfile',
  'deleteProfile',
  'createGroup',
  'renameGroup',
  'deleteGroup'
])

const searchInputId = 'connection-hub-search'
const searchText = ref('')
const selectedGroup = ref('__all__')
const selectedTag = ref('__all__')

const groups = computed(() => (
  [...props.groups].sort((left, right) => left.localeCompare(right, 'zh-CN'))
))

const groupItems = computed(() => ([
  { label: '全部', value: '__all__', count: props.profiles.length },
  ...groups.value.map((group) => ({
    label: group,
    value: group,
    count: props.profiles.filter((profile) => profile.group === group).length
  }))
]))

const tagItems = computed(() => {
  const tagCounts = new Map<string, number>()
  props.profiles.forEach((profile) => {
    profile.tags?.forEach((tag) => {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
    })
  })

  const knownItems = PROFILE_TAG_PRESETS
    .map((preset) => ({
      value: preset.value,
      label: preset.label,
      count: tagCounts.get(preset.value) ?? 0,
      dotColor: preset.color
    }))

  const customItems = Array.from(tagCounts.entries())
    .filter(([tag]) => !PROFILE_TAG_PRESETS.some((preset) => preset.value === tag))
    .sort(([left], [right]) => left.localeCompare(right, 'zh-CN'))
    .map(([tag, count]) => ({
      value: tag,
      label: tag,
      count,
      dotColor: ''
    }))

  return [
    { value: '__all__', label: '全部', count: Array.from(tagCounts.values()).reduce((sum, count) => sum + count, 0), dotColor: '' },
    ...knownItems,
    ...customItems
  ]
})

const filteredProfiles = computed(() => {
  const keyword = searchText.value.trim().toLowerCase()

  return props.profiles.filter((profile) => {
    const matchesGroup = selectedGroup.value === '__all__' || profile.group === selectedGroup.value
    if (!matchesGroup) {
      return false
    }

    const matchesTag = selectedTag.value === '__all__' || profile.tags?.includes(selectedTag.value)
    if (!matchesTag) {
      return false
    }

    if (!keyword) {
      return true
    }

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

function getProfileDisplayName(profile: SshProfile) {
  return profile.name || `${profile.username}@${profile.host}`
}

function getProfileMonogram(profile: SshProfile) {
  const seed = (profile.name || profile.host || profile.username)
    .replace(/[\s._-]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)

  if (seed.length >= 2) {
    return `${seed[0][0]}${seed[1][0]}`.toUpperCase()
  }

  return seed[0]?.slice(0, 2).toUpperCase() || profile.username.slice(0, 2).toUpperCase()
}

function getAuthLabel(profile: SshProfile) {
  if (profile.private_key) {
    return '密钥认证'
  }

  if (profile.save_password) {
    return '已存密码'
  }

  return '手动认证'
}

function getVisibleTags(profile: SshProfile) {
  return profile.tags?.slice(0, 2) ?? []
}

function getHiddenTagCount(profile: SshProfile) {
  return Math.max((profile.tags?.length ?? 0) - 2, 0)
}

function getTagStyle(tag: string) {
  const preset = getProfileTagPreset(tag)
  if (!preset) {
    return {}
  }

  const isDark = props.theme === 'dark'

  return {
    backgroundColor: isDark ? preset.darkBackground : preset.background,
    borderColor: isDark ? preset.darkBorder : preset.border,
    color: isDark ? preset.darkText : preset.text,
  }
}

watch(groups, (nextGroups) => {
  if (selectedGroup.value !== '__all__' && !nextGroups.includes(selectedGroup.value)) {
    selectedGroup.value = '__all__'
  }
})

watch(tagItems, (nextTags) => {
  if (selectedTag.value !== '__all__' && !nextTags.some((tag) => tag.value === selectedTag.value)) {
    selectedTag.value = '__all__'
  }
})
</script>

<style scoped>
.connection-hub {
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;
  min-height: 0;
  padding: 8px 10px 10px;
  overflow: auto;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--surface-1) 18%, transparent), transparent),
    linear-gradient(90deg, color-mix(in srgb, var(--primary-color) 6%, transparent) 1px, transparent 1px);
  background-size: auto, 20px 20px;
}

.hub-sidebar__section,
.hub-main__bar,
.hub-content,
.hub-card,
.hub-row {
  border: 1px solid var(--border-color);
  background: var(--surface-1);
}

.hub-toolbar__eyebrow,
.hub-sidebar__title-row h2,
.hub-side-meta__label,
.hub-content__meta,
.hub-list__head {
  color: var(--muted-color);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.hub-toolbar__count,
.hub-badge {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 9px;
  border: 1px solid var(--border-color);
  border-radius: 999px;
  color: var(--muted-color);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}

.hub-search {
  display: flex;
  align-items: center;
  gap: 9px;
  flex: 1 1 340px;
  min-width: 0;
  min-height: 38px;
  padding: 0 12px;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: var(--surface-1);
}

.hub-search__icon {
  color: var(--muted-color);
  font-size: 14px;
}

.hub-search :deep(.ant-input-affix-wrapper) {
  padding: 0 !important;
  border: none !important;
  background: transparent !important;
  box-shadow: none !important;
}

.hub-search :deep(.ant-input) {
  font-size: 13px;
  font-weight: 500;
}

.hub-search:focus-within,
.hub-card:focus-visible,
.hub-row:focus-visible,
.hub-nav-item:focus-visible,
.hub-icon-action:focus-visible {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 4px var(--primary-soft);
}

.hub-toolbar__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.hub-toolbar__actions :deep(.ant-btn) {
  height: 36px;
  padding-inline: 16px;
  border-radius: 10px !important;
  font-weight: 700;
}

.hub-toolbar__actions :deep(.ant-btn-primary) {
  background: linear-gradient(135deg, var(--primary-color), #6aa7ff) !important;
  border-color: transparent !important;
  box-shadow: 0 10px 24px rgba(47, 124, 255, 0.22) !important;
}

.hub-workbench {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 8px;
  flex: 1;
  min-height: 0;
  align-items: start;
}

.hub-sidebar,
.hub-main {
  display: grid;
  gap: 8px;
  min-height: 0;
  align-content: start;
  grid-auto-rows: max-content;
}

.hub-sidebar__section,
.hub-main__bar,
.hub-content {
  border-radius: 12px;
}

.hub-sidebar__section {
  display: grid;
  gap: 8px;
  padding: 10px;
}

.hub-sidebar__title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.hub-sidebar__title-tools {
  display: flex;
  align-items: center;
  gap: 6px;
}

.hub-sidebar__title-row h2 {
  margin: 0;
}

.hub-sidebar__title-row span {
  color: var(--muted-color);
  font-size: 11px;
  font-weight: 700;
}

.hub-sidebar__menu {
  display: grid;
  gap: 4px;
}

.hub-nav-item {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  min-height: 34px;
  padding: 0 10px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  color: var(--muted-color);
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    background-color 0.18s ease,
    color 0.18s ease;
}

.hub-nav-item:hover {
  background: var(--hover-bg);
}

.hub-nav-item.is-active {
  border-color: var(--strong-border);
  background: var(--surface-2);
  color: var(--text-color);
}

.hub-nav-item__label,
.hub-nav-item__count {
  font-size: 12px;
  font-weight: 700;
}

.hub-nav-item__label--tag {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.hub-nav-item__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.hub-nav-item__count {
  margin-left: auto;
  font-variant-numeric: tabular-nums;
}

.hub-nav-item__actions {
  display: flex;
  align-items: center;
  gap: 2px;
  opacity: 0.4;
  transition: opacity 0.18s ease;
}

.hub-nav-item:hover .hub-nav-item__actions,
.hub-nav-item.is-active .hub-nav-item__actions {
  opacity: 1;
}

.hub-main__bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 10px;
}

.hub-main__summary {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-left: auto;
}

.hub-content {
  display: grid;
  gap: 8px;
  min-height: 0;
  padding: 8px;
  align-content: start;
  grid-auto-rows: max-content;
}

.hub-content__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.hub-content__head h2 {
  margin: 0;
  color: var(--text-color);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.hub-list {
  display: grid;
}

.hub-list__head,
.hub-row {
  display: grid;
  grid-template-columns: minmax(220px, 1.35fr) minmax(200px, 1fr) minmax(120px, 0.68fr) minmax(150px, 0.7fr) 88px 72px;
  gap: 12px;
  align-items: center;
}

.hub-list__head {
  padding: 0 8px 4px;
}

.hub-row {
  width: 100%;
  padding: 8px;
  border-radius: 10px;
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    background-color 0.18s ease,
    transform 0.18s ease;
}

.hub-row:hover,
.hub-card:hover {
  transform: translateY(-1px);
  border-color: var(--strong-border);
}

.hub-row.is-active,
.hub-card.is-active {
  border-color: var(--strong-border);
  background: var(--surface-2);
}

.hub-row__cell {
  min-width: 0;
}

.hub-row__cell--actions {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 4px;
  opacity: 0.56;
  transition: opacity 0.18s ease;
}

.hub-row__cell--target {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 10px;
  align-items: center;
}

.hub-row__avatar,
.hub-card__avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 11px;
  background: linear-gradient(180deg, rgba(82, 143, 255, 0.96), rgba(47, 124, 255, 0.88));
  color: #f6faff;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.hub-row__identity,
.hub-card__identity {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.hub-row__name,
.hub-row__sub,
.hub-row__address,
.hub-row__port,
.hub-card__name,
.hub-card__endpoint {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hub-row__name,
.hub-card__name {
  color: var(--text-color);
  font-size: 14px;
  font-weight: 700;
}

.hub-row__sub,
.hub-row__address,
.hub-row__port,
.hub-card__endpoint,
.hub-row__placeholder {
  color: var(--muted-color);
  font-size: 12px;
  font-weight: 600;
}

.hub-row__cell--address {
  display: flex;
  align-items: center;
  gap: 4px;
}

.hub-chip,
.hub-state {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 24px;
  padding: 0 8px;
  border: 1px solid var(--border-color);
  border-radius: 999px;
  background: var(--surface-1);
  color: var(--muted-color);
  font-size: 11px;
  font-weight: 700;
}

.hub-chip--accent {
  color: var(--primary-color);
  background: var(--primary-soft);
  border-color: var(--primary-ring);
}

.hub-state.is-active {
  color: var(--success-color);
  background: color-mix(in srgb, var(--success-color) 14%, transparent);
  border-color: color-mix(in srgb, var(--success-color) 22%, transparent);
}

.hub-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 8px;
}

.hub-card {
  display: grid;
  gap: 8px;
  width: 100%;
  padding: 10px;
  border-radius: 10px;
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    background-color 0.18s ease,
    transform 0.18s ease;
}

.hub-card__top {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: start;
}

.hub-card__lead {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 10px;
  align-items: center;
}

.hub-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.hub-card__actions {
  display: flex;
  align-items: center;
  gap: 4px;
  opacity: 0.4;
  transition: opacity 0.18s ease;
}

.hub-row:hover .hub-row__cell--actions,
.hub-row.is-active .hub-row__cell--actions,
.hub-card:hover .hub-card__actions,
.hub-card.is-active .hub-card__actions {
  opacity: 1;
}

.hub-icon-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--muted-color);
  cursor: pointer;
  transition:
    background-color 0.18s ease,
    border-color 0.18s ease,
    color 0.18s ease;
}

.hub-icon-action:hover {
  border-color: var(--border-color);
  background: var(--surface-1);
  color: var(--text-color);
}

.hub-icon-action--danger:hover {
  border-color: rgba(234, 95, 97, 0.22);
  background: rgba(234, 95, 97, 0.08);
  color: var(--error-color);
}

.hub-empty {
  display: flex;
  flex: 1;
  min-height: 220px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  text-align: center;
}

.hub-empty__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border: 1px solid rgba(191, 205, 226, 0.76);
  border-radius: 16px;
  color: var(--primary-color);
  font-size: 21px;
}

.hub-empty h3 {
  margin: 0;
  color: var(--text-color);
  font-size: 18px;
  font-weight: 700;
}

.hub-empty p {
  max-width: 320px;
  color: var(--muted-color);
  font-size: 13px;
  line-height: 1.55;
}

@media (max-width: 1120px) {
  .hub-workbench {
    grid-template-columns: 1fr;
  }

  .hub-toolbar__actions {
    justify-content: flex-start;
    flex-wrap: wrap;
  }

  .hub-sidebar {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .hub-list__head,
  .hub-row {
    grid-template-columns: minmax(220px, 1.3fr) minmax(190px, 1fr) minmax(100px, 0.7fr) 72px;
  }

  .hub-row__cell--tags,
  .hub-row__cell--status,
  .hub-list__head span:nth-child(4),
  .hub-list__head span:nth-child(5) {
    display: none;
  }
}

@media (max-width: 760px) {
  .connection-hub {
    padding: 6px;
  }

  .hub-toolbar,
  .hub-sidebar__section,
  .hub-main__bar,
  .hub-content {
    padding: 8px;
  }

  .hub-sidebar {
    grid-template-columns: 1fr;
  }

  .hub-search,
  .hub-toolbar__actions,
  .hub-action {
    width: 100%;
  }

  .hub-main__summary {
    margin-left: 0;
  }

  .hub-toolbar__actions :deep(.ant-btn) {
    flex: 1;
  }

  .hub-list__head {
    display: none;
  }

  .hub-row,
  .hub-grid {
    grid-template-columns: 1fr;
  }

  .hub-row__cell--meta {
    justify-content: flex-start;
  }

  .hub-row__cell--actions,
  .hub-card__actions {
    justify-content: flex-start;
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .hub-row,
  .hub-card,
  .hub-nav-item,
  .hub-nav-item__actions,
  .hub-row__cell--actions,
  .hub-card__actions,
  .hub-icon-action {
    transition: none;
  }
}

:global(body[data-theme="dark"] .connection-hub) {
  background:
    linear-gradient(180deg, rgba(10, 17, 30, 0.18), rgba(8, 14, 24, 0.08)),
    linear-gradient(90deg, rgba(85, 123, 186, 0.05) 1px, transparent 1px);
  background-size: auto, 20px 20px;
}

:global(body[data-theme="dark"] .hub-sidebar__section),
:global(body[data-theme="dark"] .hub-main__bar),
:global(body[data-theme="dark"] .hub-content),
:global(body[data-theme="dark"] .hub-card),
:global(body[data-theme="dark"] .hub-row),
:global(body[data-theme="dark"] .hub-search),
:global(body[data-theme="dark"] .hub-empty__icon),
:global(body[data-theme="dark"] .hub-toolbar__count),
:global(body[data-theme="dark"] .hub-badge),
:global(body[data-theme="dark"] .hub-chip),
:global(body[data-theme="dark"] .hub-state) {
  border-color: var(--border-color);
  background: var(--surface-1);
}

:global(body[data-theme="dark"] .hub-nav-item:hover) {
  background: rgba(19, 29, 46, 0.94);
}

:global(body[data-theme="dark"] .hub-nav-item.is-active),
:global(body[data-theme="dark"] .hub-row.is-active),
:global(body[data-theme="dark"] .hub-card.is-active) {
  background: var(--surface-2);
}

:global(body[data-theme="dark"] .hub-row__avatar),
:global(body[data-theme="dark"] .hub-card__avatar) {
  background: linear-gradient(180deg, rgba(111, 167, 255, 0.22), rgba(74, 112, 175, 0.34)) !important;
  border-color: rgba(101, 146, 219, 0.4) !important;
}

:global(body[data-theme="dark"] .hub-toolbar__actions .ant-btn-primary) {
  background: linear-gradient(135deg, #4d8dff, #7eb1ff) !important;
  border-color: transparent !important;
  box-shadow: 0 10px 24px rgba(77, 141, 255, 0.26) !important;
}

:global(body[data-theme="dark"] .hub-chip--accent) {
  background: var(--primary-soft);
  border-color: var(--primary-ring);
}

:global(body[data-theme="dark"] .hub-state.is-active) {
  background: rgba(85, 194, 122, 0.12);
  border-color: rgba(85, 194, 122, 0.2);
}

:global(body[data-theme="dark"] .hub-icon-action:hover) {
  border-color: rgba(52, 71, 100, 0.92);
  background: rgba(19, 29, 46, 0.94);
}

:global(body[data-theme="dark"] .hub-icon-action--danger:hover) {
  border-color: rgba(255, 123, 125, 0.22);
  background: rgba(255, 123, 125, 0.08);
  color: var(--error-color);
}
</style>
