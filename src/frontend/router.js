import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from './stores/auth';

const routes = [
    {
        path: '/',
        redirect: () => {
            const auth = useAuthStore();
            if (!auth.isLoggedIn) {
                return '/login';
            }
            return auth.isAdmin ? '/admin/dashboard' : '/perfil';
        }
    },
    {
        path: '/login',
        name: 'login',
        component: { template: '<div></div>' } // App.vue handles rendering the native Login page
    },
    {
        path: '/admin/dashboard',
        name: 'admin-dashboard',
        component: () => import('./views/admin/Dashboard.vue'),
        meta: { requerAuth: true, admin: true }
    },
    {
        path: '/admin/servidores',
        name: 'admin-servidores',
        component: () => import('./views/admin/Servidores.vue'),
        meta: { requerAuth: true, admin: true }
    },
    {
        path: '/admin/distribuicao',
        name: 'admin-distribuicao',
        component: () => import('./views/admin/Distribuicao.vue'),
        meta: { requerAuth: true, admin: true }
    },
    {
        path: '/admin/testes',
        name: 'admin-testes',
        component: () => import('./views/admin/Testes.vue'),
        meta: { requerAuth: true, admin: true }
    },
    {
        path: '/perfil',
        name: 'usuario-perfil',
        component: () => import('./views/usuario/Perfil.vue'),
        meta: { requerAuth: true }
    },
    {
        path: '/pedido-remocao',
        name: 'usuario-intencao',
        component: () => import('./views/usuario/Intencao.vue'),
        meta: { requerAuth: true }
    }
];

const router = createRouter({
    history: createWebHistory(),
    routes
});

router.beforeEach((to, from, next) => {
    const auth = useAuthStore();

    if (to.path === '/login' && auth.isLoggedIn) {
        return next('/');
    }

    if (to.meta.requerAuth && !auth.isLoggedIn) {
        return next('/login');
    }

    if (to.meta.admin && !auth.isAdmin) {
        return next('/perfil');
    }

    next();
});

export default router;
