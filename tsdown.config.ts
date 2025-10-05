import fs from 'fs'
import { defineConfig } from 'tsdown'

export default defineConfig({
    entry: 'src/main.ts',
    outDir: 'build',
    format: ['esm'],
    sourcemap: true,
    hooks: {
        'build:done': () => {
            // prepend shebang
            const mainFile = `${process.cwd()}/build/main.js`
            const content = fs.readFileSync(mainFile, 'utf-8')

            if (!content.startsWith('#!/usr/bin/env node')) {
                fs.writeFileSync(
                    mainFile,
                    `#!/usr/bin/env node\n${content}`,
                    'utf-8',
                )
                // make it executable
                fs.chmodSync(mainFile, 0o755)
            }
        },
    },
})
