/**
 * Default React + Vite + Tailwind project template.
 * Used when creating a new Cirius project with empty source_files_json.
 */
export const REACT_VITE_TEMPLATE: Record<string, string> = {
  "package.json": JSON.stringify(
    {
      name: "projeto-cirius",
      private: true,
      version: "0.0.0",
      type: "module",
      scripts: { dev: "vite", build: "tsc && vite build", preview: "vite preview" },
      dependencies: { react: "^18.2.0", "react-dom": "^18.2.0" },
      devDependencies: {
        "@types/react": "^18.2.0",
        "@types/react-dom": "^18.2.0",
        "@vitejs/plugin-react": "^4.0.0",
        typescript: "^5.0.0",
        vite: "^5.0.0",
        tailwindcss: "^3.4.0",
        autoprefixer: "^10.4.0",
        postcss: "^8.4.0",
      },
    },
    null,
    2
  ),

  "index.html": `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Projeto Cirius</title>
    <script src="https://cdn.tailwindcss.com"><\/script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"><\/script>
  </body>
</html>`,

  "src/main.tsx": `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`,

  "src/App.tsx": `export default function App() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          Projeto iniciado ✨
        </h1>
        <p className="text-gray-500">
          Descreva o que deseja criar no chat.
        </p>
      </div>
    </div>
  )
}`,

  "src/index.css": `@tailwind base;
@tailwind components;
@tailwind utilities;`,

  "vite.config.ts": `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})`,

  "tailwind.config.js": `export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: { extend: {} },
  plugins: [],
}`,

  "tsconfig.json": JSON.stringify(
    {
      compilerOptions: {
        target: "ES2020",
        useDefineForClassFields: true,
        lib: ["ES2020", "DOM", "DOM.Iterable"],
        module: "ESNext",
        skipLibCheck: true,
        moduleResolution: "bundler",
        allowImportingTsExtensions: true,
        resolveJsonModule: true,
        isolatedModules: true,
        noEmit: true,
        jsx: "react-jsx",
        strict: true,
      },
      include: ["src"],
    },
    null,
    2
  ),
};
