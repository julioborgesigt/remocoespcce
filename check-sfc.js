const fs = require('fs');
const compiler = require('vue/compiler-sfc');

try {
    const content = fs.readFileSync('src/frontend/views/admin/Servidores.vue', 'utf-8');
    const parsed = compiler.parse(content);
    if (parsed.errors.length) {
        console.error("Errors found:", parsed.errors);
    } else {
        // try to compile template
        if (parsed.descriptor.template) {
            const compiled = compiler.compileTemplate({
                source: parsed.descriptor.template.content,
                filename: 'Servidores.vue',
                id: '123'
            });
            if (compiled.errors.length) {
                console.error("Template compilation errors:", compiled.errors);
            } else {
                console.log("Template compiles fine!");
            }
        }
    }
} catch (e) {
    console.error("Crash:", e);
}
