<script setup lang="ts">
import { useRoute } from 'vue-router'
import { Home, Calendar, MessageSquare, User } from 'lucide-vue-next'

const route = useRoute()
const items = [
  { label: 'Inicio', icon: Home, to: '/' },
  { label: 'Agenda', icon: Calendar, to: '/agenda' },
  { label: 'Mensagens', icon: MessageSquare, to: '/mensagens' },
  { label: 'Perfil', icon: User, to: '/perfil' },
]
function isActive(to: string) {
  return route.path === to || route.path.startsWith(to + '/')
}
</script>

<template>
  <RouterLink
    v-for="item in items"
    :key="item.to"
    class="nav-item"
    :class="{ active: isActive(item.to) }"
    :to="item.to"
    :aria-current="isActive(item.to) ? 'page' : undefined"
    :aria-label="item.label"
  >
    <component :is="item.icon" :size="20" />
  </RouterLink>
</template>
