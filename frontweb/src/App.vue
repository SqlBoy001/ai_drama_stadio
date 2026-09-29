<template>
  <div class="app">
    <StudioNavigation v-if="$route.name !== 'film-canvas'" />
    <router-view />
  </div>
</template>

<script setup>
import StudioNavigation from './components/StudioNavigation.vue'
</script>

<style>
* {
  box-sizing: border-box;
}
html, body, #app, .app {
  margin: 0;
  padding: 0;
  min-height: 100vh;
  background: var(--bg-page);
  color: var(--text-primary);
  transition: background 0.25s, color 0.25s;
}
</style>
