const fs = require('fs');
const path = require('path');

const viewsDirOld = path.join(__dirname, 'public/js/views');
const storesDirOld = path.join(__dirname, 'public/js/stores');
const utilsDirOld = path.join(__dirname, 'public/js/utils');

const viewsDirNew = path.join(__dirname, 'src/frontend/views');
const storesDirNew = path.join(__dirname, 'src/frontend/stores');
const utilsDirNew = path.join(__dirname, 'src/frontend/utils');

// Helpers functions
function ensureDirSync(dirpath) {
    if (!fs.existsSync(dirpath)) fs.mkdirSync(dirpath, { recursive: true });
}

ensureDirSync(viewsDirNew);
ensureDirSync(path.join(viewsDirNew, 'admin'));
ensureDirSync(path.join(viewsDirNew, 'usuario'));
ensureDirSync(storesDirNew);
ensureDirSync(utilsDirNew);

function getPathLevel(filepath) {
    const parts = filepath.split('/');
    return parts.length - 1;
}

function processStore(filepath, relativeToOldRoot) {
    const content = fs.readFileSync(filepath, 'utf8');
    const level = relativeToOldRoot.split('/').length - 1;
    const storeRel = '../'.repeat(level) + 'stores/auth';

    // Transform "const useNameStore = Pinia.defineStore('name', {"
    // To "import { defineStore } from 'pinia';\nimport { useAuthStore } from '"+storeRel+"';\n\nexport const useNameStore = defineStore('name', {"

    let newContent = content;
    newContent = newContent.replace(/const (\w+) = Pinia\.defineStore/g, 'export const $1 = defineStore');

    const imports = ["import { defineStore } from 'pinia';"];
    // If uses auth store
    if (content.includes('useAuthStore')) {
        imports.push(`import { useAuthStore } from '${level === 0 ? './auth' : '../stores/auth'}';`);
    }
    if (content.includes('useConfigStore')) {
        imports.push(`import { useConfigStore } from '${level === 0 ? './config' : '../stores/config'}';`);
    }

    newContent = imports.join('\n') + '\n\n' + newContent;

    const targetPath = path.join(storesDirNew, relativeToOldRoot);
    fs.writeFileSync(targetPath, newContent);
    console.log(`Transformed store: ${relativeToOldRoot}`);
}

function processView(filepath, relativeToOldRoot) {
    const content = fs.readFileSync(filepath, 'utf8');

    // Extract template
    const templateMatch = content.match(/template:\s*`([\s\S]*?)`/);
    if (!templateMatch) return; // Not a view object
    const templateRaw = templateMatch[1];

    // Extract setup
    const setupMatch = content.match(/setup\([^)]*\)\s*{([\s\S]*?)}\s*(?:};?|,$)/);
    let setupRaw = setupMatch ? setupMatch[1] : '';

    // Find returned variables
    const returnMatch = setupRaw.match(/return\s*{([\s\S]*?)}/);
    if (returnMatch) {
        // Remove return statement block for script setup
        setupRaw = setupRaw.replace(returnMatch[0], '');
    }

    // Format setup code
    // Replace Vue.ref -> ref, Vue.reactive -> reactive, Vue.onMounted -> onMounted, Vue.computed -> computed, Vue.inject -> inject
    setupRaw = setupRaw.replace(/Vue\.ref/g, 'ref');
    setupRaw = setupRaw.replace(/Vue\.reactive/g, 'reactive');
    setupRaw = setupRaw.replace(/Vue\.onMounted/g, 'onMounted');
    setupRaw = setupRaw.replace(/Vue\.computed/g, 'computed');
    setupRaw = setupRaw.replace(/Vue\.inject/g, 'inject');
    setupRaw = setupRaw.replace(/Vue\.watch/g, 'watch');

    const vueImports = [];
    if (setupRaw.includes('ref(')) vueImports.push('ref');
    if (setupRaw.includes('reactive(')) vueImports.push('reactive');
    if (setupRaw.includes('onMounted(')) vueImports.push('onMounted');
    if (setupRaw.includes('computed(')) vueImports.push('computed');
    if (setupRaw.includes('inject(')) vueImports.push('inject');
    if (setupRaw.includes('watch(')) vueImports.push('watch');

    const level = relativeToOldRoot.split('/').length - 1;
    const storesPrefix = '../'.repeat(level) + '../stores';
    const utilsPrefix = '../'.repeat(level) + '../utils';

    const scriptImports = [];
    if (vueImports.length > 0) {
        scriptImports.push(`import { ${vueImports.join(', ')} } from 'vue';`);
    }

    // Add stores used
    if (setupRaw.includes('useAuthStore')) scriptImports.push(`import { useAuthStore } from '${storesPrefix}/auth';`);
    if (setupRaw.includes('useCidadesStore')) scriptImports.push(`import { useCidadesStore } from '${storesPrefix}/cidades';`);
    if (setupRaw.includes('useServidoresStore')) scriptImports.push(`import { useServidoresStore } from '${storesPrefix}/servidores';`);
    if (setupRaw.includes('useConfigStore')) scriptImports.push(`import { useConfigStore } from '${storesPrefix}/config';`);
    if (setupRaw.includes('useProcessamentoStore')) scriptImports.push(`import { useProcessamentoStore } from '${storesPrefix}/processamento';`);
    if (setupRaw.includes('exportToExcel') || setupRaw.includes('exportToPDF')) scriptImports.push(`import { exportToExcel, exportToPDF } from '${utilsPrefix}/exporter';`);

    // Add router if needed
    if (setupRaw.includes('router.push')) {
        scriptImports.push(`import { useRouter } from 'vue-router';`);
        setupRaw = `const router = useRouter();\n` + setupRaw;
    }

    const componentContent = `<template>
${templateRaw}
</template>

<script setup>
${scriptImports.join('\n')}

${setupRaw.trim()}
</script>
`;

    // Write new file
    const outName = relativeToOldRoot.replace('.js', '.vue');
    const targetPath = path.join(viewsDirNew, outName);
    fs.writeFileSync(targetPath, componentContent);
    console.log(`Transformed view: ${outName}`);
}

function processUtils(filepath, relativeToOldRoot) {
    let content = fs.readFileSync(filepath, 'utf8');
    // Replace global objects with imports if needed
    content = content.replace(/window\.jspdf\.jsPDF/g, 'jsPDF');
    content = `import * as XLSX from 'xlsx';\nimport { jsPDF } from 'jspdf';\nimport 'jspdf-autotable';\n\n` + content;
    const targetPath = path.join(utilsDirNew, relativeToOldRoot);
    fs.writeFileSync(targetPath, content);
    console.log(`Transformed util: ${relativeToOldRoot}`);
}

// Convert all stores
fs.readdirSync(storesDirOld).forEach(f => {
    if (f !== 'auth.js') processStore(path.join(storesDirOld, f), f);
});

// Convert all utils
fs.readdirSync(utilsDirOld).forEach(f => {
    processUtils(path.join(utilsDirOld, f), f);
});

// Convert all admin views
fs.readdirSync(path.join(viewsDirOld, 'admin')).forEach(f => {
    if (f !== 'Dashboard.js') { // I already created a placeholder for Dashboard, let's overwrite it anyway? Yes.
        processView(path.join(viewsDirOld, 'admin', f), 'admin/' + f);
    } else {
        processView(path.join(viewsDirOld, 'admin', f), 'admin/' + f);
    }
});

// Convert all usuario views
fs.readdirSync(path.join(viewsDirOld, 'usuario')).forEach(f => {
    if (f !== 'Perfil.js') {
        processView(path.join(viewsDirOld, 'usuario', f), 'usuario/' + f);
    } else {
        processView(path.join(viewsDirOld, 'usuario', f), 'usuario/' + f);
    }
});
