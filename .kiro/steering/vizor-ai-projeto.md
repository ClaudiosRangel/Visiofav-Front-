---
inclusion: auto
---

# Vizor AI — Projeto de IA Integrada ao ERP (Frontend)

## Visão Geral

O Vizor AI é um assistente de inteligência artificial integrado ao VisioFab ERP. No frontend, ele aparece como um **chat widget flutuante** no canto inferior direito, disponível em todas as páginas.

## Componentes Frontend

### 1. ChatWidget (componente global)
- Localização: `src/components/ai/ChatWidget.tsx`
- Renderizado no layout principal (todas as páginas)
- Botão flutuante → abre painel de chat
- Suporta: texto, upload de imagem, sugestões rápidas
- Interpreta ações de navegação da resposta da IA

### 2. Hooks
- `src/data/hooks/ai/useChat.ts` — enviar mensagem, histórico
- `src/data/hooks/ai/useOcr.ts` — upload de imagem para OCR
- `src/data/hooks/ai/useSugestoes.ts` — sugestões contextuais

### 3. Comportamento de Navegação
Quando a IA retorna `acao.tipo = 'NAVEGAR'`:
- O widget usa `router.push(acao.rota)` para navegar
- Filtros são passados via query params ou state

### 4. Comportamento de Dados Inline
Quando a IA retorna `acao.tipo = 'MOSTRAR_DADOS'`:
- Exibe tabela/card dentro do próprio chat com os dados

## Funcionalidades do Usuário

1. **Perguntar qualquer coisa** — "Como faço X?", "O que é Y?"
2. **Executar ações** — "Crie um pedido...", "Agende..."
3. **Navegar** — "Me mostra relatório de vendas", "Abre pedido 1234"
4. **Configurar** — "Configure meu regime tributário", "Ative módulo WMS"
5. **Upload imagem** — Foto de DANFE, boleto, produto

## Design do Chat Widget

```
┌─────────────────────────────────┐
│  🤖 Vizor AI              [X]  │
├─────────────────────────────────┤
│                                 │
│  IA: Olá! Como posso ajudar?   │
│                                 │
│  Você: Quanto vendemos esse mês?│
│                                 │
│  IA: Em julho vocês venderam    │
│  R$ 450.320 em 87 pedidos.     │
│  [Ver relatório completo →]     │
│                                 │
│  Sugestões:                     │
│  [Top clientes] [Curva ABC]    │
│                                 │
├─────────────────────────────────┤
│  [📎] [Digite sua mensagem...] │
└─────────────────────────────────┘
```

## Fases de Implementação (Frontend)

### Fase 1 — Chat básico + OCR
- Widget de chat com envio de texto
- Upload de imagem para OCR
- Respostas da IA exibidas no chat
- Ações de navegação interpretadas

### Fase 2 — Sugestões contextuais
- Baseadas na página atual do usuário
- Ex: na página de pedidos → sugerir "Criar pedido", "Relatório vendas"
- Botões de ação rápida no chat

### Fase 3 — Dados inline
- Exibir mini-tabelas/cards dentro do chat
- Gráficos simples (sparklines) para KPIs
- Links diretos para registros mencionados

### Fase 4 — Voz (mobile)
- Botão de microfone no app React Native
- Speech-to-text → envia como texto ao chat
- Text-to-speech na resposta (opcional)

## API Endpoints Consumidos

```
POST /api/ai/chat          — { mensagem, imagemBase64? }
GET  /api/ai/sugestoes     — Retorna sugestões baseadas no contexto
GET  /api/ai/historico     — Últimas N mensagens do usuário
```

## Referências
- Backend AI: src/modules/ai/ (VisioFab.Wms.Back)
- Spec detalhada: .kiro/steering/vizor-ai-projeto.md (backend)
