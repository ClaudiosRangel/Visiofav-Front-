---
inclusion: auto
---

# Padrões de Deploy e Teste — VisioFab WMS Frontend

## Deploy para Produção

O deploy é automático via push para `main`:

```bash
git add -A
git commit -m "feat/fix: descrição"
git push origin main
```

- **Hosting**: Vercel (https://visiofav-front-wofr.vercel.app)
- **Build**: `next build` (automático no Vercel)
- **Tempo de deploy**: ~1-2 minutos após push

## Stack

- Next.js 15 (App Router)
- React 19
- Mantine 7 (UI)
- TanStack Query 5 (server state)
- react-hook-form + zod (formulários)
- Tailwind CSS (layout)

## Padrões de Código

- Hooks de dados em `src/data/hooks/`
- CRUD genérico via `useCrudGenerico`
- Formulários com `Controller` + schema zod
- Notificações via `@mantine/notifications`
- Componentes reutilizáveis em `src/components/`

## Checklist Pré-Deploy

1. ✅ Verificar que a página não crasha (sem erros de runtime)
2. ✅ Testar fluxo completo no browser local (`npm run dev`)
3. ✅ Garantir que hooks invalidam queries corretas no `onSuccess`
4. ✅ Verificar que schemas Zod do frontend correspondem ao backend
