<template>
  <v-app>
    <!-- App Layout (quando autenticado) -->
    <template v-if="authStore.isLoggedIn">
      <app-layout></app-layout>
    </template>

    <!-- Login (quando não autenticado) -->
    <template v-else>
      <login-page></login-page>
    </template>
  </v-app>
</template>

<script setup>
import { onMounted } from 'vue';
import { useAuthStore } from './stores/auth';
import { useRouter } from 'vue-router';
import AppLayout from './components/AppLayout.vue';
import LoginPage from './views/Login.vue';

const authStore = useAuthStore();
const router = useRouter();

onMounted(async () => {
  await authStore.fetchCsrfToken();
  if (authStore.token) {
    try {
      const res = await fetch('/api/auth/me', {
        headers: authStore.authHeaders()
      });
      if (!res.ok) {
        authStore.logout();
      } else {
        const data = await res.json();
        authStore.usuario = data;
        localStorage.setItem('usuario', JSON.stringify(data));
        
        if (window.location.pathname === '/' || window.location.pathname === '') {
          const rota = data.perfil === 'admin' ? '/admin/dashboard' : '/perfil';
          router.push(rota);
        }
      }
    } catch {
      authStore.logout();
    }
  }
});
</script>
