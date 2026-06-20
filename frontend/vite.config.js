import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'


export default defineConfig({
  plugins: [react({
    include: "**/*.{js,jsx,ts,tsx}"
  }),
  tailwindcss()],
  server: {
    host: true,
    port: 3030,
    strictPort: true,
  }
})
