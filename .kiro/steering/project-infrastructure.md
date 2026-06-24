# Infraestrutura e Deploy — VisioFab Frontend

## Produção

| Recurso | Provedor | URL |
|---------|----------|-----|
| **Frontend Web** | Vercel | https://visiofav-front-wofr.vercel.app |
| **API Backend** | Render | https://visiofav.onrender.com/api |
| **Deploy** | Automático após push | ~1-2 minutos |

## Desenvolvimento Local

| Recurso | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:3333 |

## Comandos

| Ação | Comando |
|------|---------|
| Dev server | `npm run dev` (porta 3000) |
| Build | `npm run build` (next build) |
| Lint | `npm run lint` |
| Testes unitários | `npm run test` (vitest) |
| Testes E2E | `npm run test:e2e` (playwright) |

## Stack

- **Framework**: Next.js 15 (App Router)
- **UI**: Mantine 7
- **State/Cache**: @tanstack/react-query
- **HTTP**: Axios
- **DnD**: @dnd-kit
- **Linguagem**: TypeScript 100%
- **Testes**: Vitest + Playwright + fast-check

## Deploy

- Push para branch `main` → deploy automático na Vercel
- Env vars configuradas no dashboard Vercel (NEXT_PUBLIC_API_URL)
- Build command: `next build`

## Env Vars de Produção (Vercel)

| Variável | Valor |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | https://visiofav.onrender.com/api |

## Projetos Relacionados

- Backend: `VisioFab.Wms.Back` (Render)
- App Mobile: `VisioFab.App` (Expo/EAS Build, aponta para mesma API)
