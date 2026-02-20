import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

export default defineConfig({
    plugins: [vue()],
    root: 'src/frontend', // A raíz do Vite será nosso novo frontend
    build: {
        outDir: '../../public/dist', // Onde o Vite vai colocar os arquivos compilados (em relação à pasta src/frontend)
        emptyOutDir: true,
        rollupOptions: {
            input: path.resolve(__dirname, 'src/frontend/index.html') // Nosso novo entry point
        }
    },
    server: {
        // Proxy para o backend durante desenvolvimento caso precisem usar o dev server do Vite
        proxy: {
            '/api': 'http://localhost:3000'
        }
    }
});
