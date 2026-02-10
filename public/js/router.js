// Router
const routes = [
  // Admin
  { path: '/admin', redirect: '/admin/dashboard' },
  { path: '/admin/dashboard', name: 'admin-dashboard', component: AdminDashboard },
  { path: '/admin/cidades', name: 'admin-cidades', component: AdminCidades },
  { path: '/admin/servidores', name: 'admin-servidores', component: AdminServidores },
  { path: '/admin/processamento', name: 'admin-processamento', component: AdminProcessamento },

  // Usuário
  { path: '/perfil', name: 'usuario-perfil', component: UsuarioPerfil },
  { path: '/intencao', name: 'usuario-intencao', component: UsuarioIntencao },

  // Catch-all
  { path: '/:pathMatch(.*)*', redirect: '/' }
];

const router = VueRouter.createRouter({
  history: VueRouter.createWebHistory(),
  routes
});

// Guard de navegação
router.beforeEach((to) => {
  const token = localStorage.getItem('token');
  const usuario = JSON.parse(localStorage.getItem('usuario') || 'null');

  if (!token) return true; // Login page handles this

  // Admin tentando acessar rotas de usuário
  if (usuario?.perfil === 'admin' && !to.path.startsWith('/admin')) {
    return { name: 'admin-dashboard' };
  }

  // Usuário tentando acessar rotas de admin
  if (usuario?.perfil === 'usuario' && to.path.startsWith('/admin')) {
    return { name: 'usuario-perfil' };
  }

  // Rota raiz → redirecionar baseado no perfil
  if (to.path === '/') {
    return usuario?.perfil === 'admin'
      ? { name: 'admin-dashboard' }
      : { name: 'usuario-perfil' };
  }

  return true;
});
