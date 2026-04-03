import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { sveltekit } from '@sveltejs/kit/vite'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
	cacheDir: join(tmpdir(), 'upstage-vite-cache'),
	plugins: [tailwindcss(), sveltekit()],
	server: {
		host: true,
		allowedHosts: ['.ts.net'],
		port: 1201,
	},
})
