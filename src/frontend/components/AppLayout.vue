<template>
  <div>
    <!-- App Bar -->
    <v-app-bar elevation="0" border="b">
      <v-app-bar-nav-icon @click="drawer = !drawer" class="d-lg-none"></v-app-bar-nav-icon>
      <v-app-bar-title class="text-body-1 font-weight-bold">
        <v-icon icon="mdi-shield-account" color="primary" class="mr-2"></v-icon>
        Sistema de Remoção
      </v-app-bar-title>
      <template v-slot:append>
        <v-chip color="primary" variant="tonal" size="small" class="mr-3">
          <v-icon start icon="mdi-account"></v-icon>
          {{ authStore.nomeUsuario }}
        </v-chip>
        <v-btn
          :icon="temaEscuro ? 'mdi-weather-sunny' : 'mdi-weather-night'"
          variant="text"
          @click="alternarTema"
          :title="temaEscuro ? 'Modo claro' : 'Modo escuro'"
        ></v-btn>
        <v-btn icon="mdi-logout" variant="text" @click="sair" title="Sair"></v-btn>
      </template>
    </v-app-bar>

    <!-- Navigation Drawer -->
    <v-navigation-drawer v-model="drawer" class="nav-drawer" :permanent="lgAndUp" width="260">
      <div class="pa-4 pb-2">
        <p class="text-caption text-medium-emphasis text-uppercase font-weight-bold" style="letter-spacing:1.5px">
          {{ authStore.isAdmin ? 'Administração' : 'Meu Painel' }}
        </p>
      </div>

      <v-list nav density="comfortable">
        <!-- Admin Nav -->
        <template v-if="authStore.isAdmin">
          <v-list-item
            prepend-icon="mdi-view-dashboard"
            title="Dashboard"
            to="/admin/dashboard"
            rounded="lg"
            class="mb-1"
          ></v-list-item>
          <v-list-item
            prepend-icon="mdi-account-group"
            title="Pedidos"
            to="/admin/servidores"
            rounded="lg"
            class="mb-1"
          ></v-list-item>
          <v-list-item
            prepend-icon="mdi-transit-transfer"
            title="Distribuição"
            to="/admin/distribuicao"
            rounded="lg"
            class="mb-1"
          ></v-list-item>
          <v-list-item
            prepend-icon="mdi-beaker"
            title="Testes de Algoritmo"
            to="/admin/testes"
            rounded="lg"
            class="mb-1"
          ></v-list-item>
        </template>

        <!-- User Nav -->
        <template v-else>
          <v-list-item
            prepend-icon="mdi-account-circle"
            title="Meu Perfil"
            to="/perfil"
            rounded="lg"
            class="mb-1"
          ></v-list-item>
          <v-list-item
            prepend-icon="mdi-file-document-edit"
            title="Pedido de Remoção"
            to="/pedido-remocao"
            rounded="lg"
            class="mb-1"
          ></v-list-item>
        </template>
      </v-list>
    </v-navigation-drawer>

    <!-- Main Content -->
    <v-main>
      <v-container fluid class="pa-4 pa-md-6">
        <router-view></router-view>
      </v-container>
    </v-main>

    <!-- Snackbar global -->
    <v-snackbar v-model="snackbar.show" :color="snackbar.color" :timeout="3000" location="bottom right">
      {{ snackbar.text }}
    </v-snackbar>
  </div>
</template>

<script setup>
import { ref, reactive, computed, provide } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useDisplay, useTheme } from 'vuetify';

const authStore = useAuthStore();
const display = useDisplay();
const theme = useTheme();

const lgAndUp = computed(() => display.lgAndUp.value);
const drawer = ref(true);
const snackbar = reactive({ show: false, text: '', color: 'success' });
const temaEscuro = computed(() => theme.global.current.value.dark);

function alternarTema() {
  const novoTema = temaEscuro.value ? 'light' : 'dark';
  theme.global.name.value = novoTema;
  localStorage.setItem('tema', novoTema);
}

provide('showSnackbar', (text, color = 'success') => {
  snackbar.text = text;
  snackbar.color = color;
  snackbar.show = true;
});

function sair() {
  authStore.logout();
  window.location.reload();
}
</script>
