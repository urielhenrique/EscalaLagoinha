# Correção Tailwind CSS 4 + Vite

## Diagnóstico

Causa encontrada: plugin `@tailwindcss/vite` instalado (`^4.2.4` no `package.json`) mas não registrado no `vite.config.ts`. O Vite processava os arquivos CSS sem o plugin, gerando avisos `Unknown at rule: @theme`, `@tailwind`, `@apply`.

## Alteração

Arquivo: `vite.config.ts`

Adicionado import e plugin:

```diff
/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
+import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
-  plugins: [react()],
+  plugins: [react(), tailwindcss()],
```

## Build

```
> tsc -b && vite build

vite v8.0.10 building client environment for production...
✓ 1869 modules transformed.
dist/index.html                    2.22 kB │ gzip:   0.89 kB
dist/assets/index--8RR43ti.css   103.86 kB │ gzip:  14.80 kB
dist/assets/index-BXOUUQP2.js    311.03 kB │ gzip: 100.47 kB
✓ built in 2.88s
```

Exit 0. Sem erros.

## Testes

```
 Test Files  4 passed (4)
      Tests  65 passed (65)
   Duration  17.16s
```

4 suites, 65 testes, todos passando.

## Lint

19 erros `@typescript-eslint/no-explicit-any` em arquivos `.spec.ts` do backend (pré-existentes).
6 warnings `react-hooks/exhaustive-deps` (pré-existentes).
Nenhum erro novo introduzido pela alteração.

## Avisos lightningcss

Os avisos `Unknown at rule: @theme`, `@tailwind`, `@apply` **desapareceram**. Build limpo.

## Arquivos alterados

- `vite.config.ts` — adicionado import de `@tailwindcss/vite` e registro do plugin

## Status

PASS
