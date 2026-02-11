// Router
const routes = [
  // Rota raiz - guard redireciona baseado no perfil
  { path: '/', name: 'home', redirect: '/perfil' },

  // Admin
  { path: '/admin', redirect: '/admin/dashboard' },
  { path: '/admin/dashboard', name: 'admin-dashboard', component: AdminDashboard },
  { path: '/admin/cidades', name: 'admin-cidades', component: AdminCidades },
  { path: '/admin/servidores', name: 'admin-servidores', component: AdminServidores },
  { path: '/admin/processamento', name: 'admin-processamento', component: AdminProcessamento },

  // Usuário
  { path: '/perfil', name: 'usuario-perfil', component: UsuarioPerfil },
  { path: '/intencao', name: 'usuario-intencao', component: UsuarioIntencao },

  // Catch-all - redireciona para perfil (guard cuida do redirecionamento por perfil)
  { path: '/:pathMatch(.*)*', redirect: '/perfil' }
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

  // Admin tentando acessar rotas de usuário → redireciona para dashboard
  if (usuario?.perfil === 'admin' && !to.path.startsWith('/admin')) {
    return { name: 'admin-dashboard' };
  }

  // Usuário tentando acessar rotas de admin → redireciona para perfil
  if (usuario?.perfil === 'usuario' && to.path.startsWith('/admin')) {
    return { name: 'usuario-perfil' };
  }

  return true;
});
