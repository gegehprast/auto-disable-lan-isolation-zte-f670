import { defineConfig } from 'tsdown'

export default defineConfig({
    entry: 'src/main.ts',
    outDir: 'build',
    format: ['esm'],
    sourcemap: true,
    unbundle: true,
})
