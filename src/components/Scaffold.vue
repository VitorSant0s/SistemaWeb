<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useSlots, watch } from 'vue'
import { useRouter } from 'vue-router'

const props = withDefaults(
  defineProps<{
    title?: string
    showBack?: boolean
    fabIcon?: string
  }>(),
  {
    title: '',
    showBack: false,
    fabIcon: '',
  },
)

const emit = defineEmits<{
  (event: 'fabClick'): void
}>()

const router = useRouter()
const slots = useSlots()
const drawerOpen = ref(false)
const menuButton = ref<HTMLButtonElement | null>(null)

const hasBottomNav = computed(() => Boolean(slots['bottom-nav']))
const hasFab = computed(() => props.fabIcon.trim().length > 0)

function openDrawer() {
  drawerOpen.value = true
}

function closeDrawer() {
  const wasOpen = drawerOpen.value
  drawerOpen.value = false
  if (wasOpen) requestAnimationFrame(() => menuButton.value?.focus())
}

function goBack() {
  router.back()
}

function handleFabClick() {
  emit('fabClick')
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') closeDrawer()
}

watch(drawerOpen, (isOpen) => {
  document.body.classList.toggle('scaffold-lock', isOpen)
})

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
  document.body.classList.remove('scaffold-lock')
})
</script>

<template>
  <div class="scaffold" :class="{ 'drawer-open': drawerOpen }">
    <button
      v-if="drawerOpen"
      class="scaffold-overlay"
      type="button"
      aria-label="Fechar menu"
      @click="closeDrawer"
    />

    <aside
      id="scaffold-drawer"
      class="scaffold-drawer"
      :class="{ open: drawerOpen }"
      aria-label="Menu lateral"
      :aria-hidden="!drawerOpen"
      :inert="!drawerOpen"
    >
      <div class="scaffold-drawer-header">
        <slot name="drawer-header" />
      </div>

      <nav class="scaffold-drawer-nav" aria-label="Navegacao do menu" @click="closeDrawer">
        <slot name="drawer" />
      </nav>

      <div class="scaffold-drawer-footer">
        <slot name="drawer-footer" />
      </div>
    </aside>

    <div class="scaffold-main" :class="{ 'scaffold-main-with-bottom': hasBottomNav }">
      <header class="scaffold-appbar">
        <div class="scaffold-appbar-left">
          <button v-if="props.showBack" class="scaffold-back-btn" type="button" aria-label="Voltar" @click="goBack">
            <span aria-hidden="true">&lt;</span>
          </button>

          <button
            ref="menuButton"
            class="scaffold-menu-btn"
            type="button"
            aria-label="Abrir menu"
            aria-controls="scaffold-drawer"
            :aria-expanded="drawerOpen"
            @click="openDrawer"
          >
            <span class="scaffold-menu-bars" aria-hidden="true"></span>
          </button>

          <slot name="appbar-title">
            <h1 class="scaffold-title">{{ props.title }}</h1>
          </slot>
        </div>

        <div class="scaffold-appbar-right">
          <slot name="appbar-actions" />
        </div>
      </header>

      <main id="main-content" class="scaffold-body">
        <slot />
      </main>

      <nav v-if="hasBottomNav" class="scaffold-bottom-nav" aria-label="Navegacao principal">
        <slot name="bottom-nav" />
      </nav>

      <button v-if="hasFab" class="scaffold-fab" type="button" aria-label="Acao principal" @click="handleFabClick">
        {{ props.fabIcon }}
      </button>
    </div>
  </div>
</template>
