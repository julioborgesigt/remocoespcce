const fs = require('fs');
const compiler = require('vue/compiler-sfc');

try {
    const content = fs.readFileSync('src/frontend/views/admin/Servidores.vue', 'utf-8');
    const parsed = compiler.parse(content);

    // Try to compile script
    if (parsed.descriptor.scriptSetup || parsed.descriptor.script) {
        const compiledScript = compiler.compileScript(parsed.descriptor, { id: '123' });
        console.log("Script compiles fine!");
    }
} catch (e) {
    console.error("Script Crash:", e);
}
