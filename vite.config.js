import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

export default defineConfig({
    plugins: [vue()],
    root: 'src/frontend', // A raíz do Vite será nosso novo frontend
    build: {
        outDir: '../../public/dist', // Onde o Vite vai colocar os arquivos compilados (em relação à pasta src/frontend)
        emptyOutDir: true,
        chunkSizeWarningLimit: 1000,
        rollupOptions: {
            input: path.resolve(__dirname, 'src/frontend/index.html'), // Nosso novo entry point
            output: {
                manualChunks(id) {
                    if (id.includes('node_modules')) {
                        if (id.includes('vuetify') || id.includes('@mdi')) {
                            return 'vendor-vuetify';
                        }
                        if (id.includes('vue') || id.includes('pinia') || id.includes('vue-router')) {
                            return 'vendor-vue-core';
                        }
                        if (id.includes('jspdf') || id.includes('html2canvas') || id.includes('xlsx') || id.includes('dompurify')) {
                            return 'vendor-export-tools';
                        }
                        return 'vendor-others';
                    }
                }
            }
        }
    },
    server: {
        // Proxy para o backend durante desenvolvimento caso precisem usar o dev server do Vite
        proxy: {
            '/api': 'http://localhost:3000'
        }
    }
});
