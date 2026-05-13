---
inclusion: auto
---

# MISSÃO PENDENTE: Integração do EnderecoAutoModal com Formatos de Endereço

## Status Atual

- ✅ Backend: CRUD de formatos, resolverFormato, AddressGenerationV2Service — tudo funcionando
- ✅ Backend: Endpoint POST /formato-endereco/gerar aceita faixas dinâmicas
- ✅ Backend: Endpoint legado /enderecos/gerar funciona normalmente (6 segmentos)
- ✅ Frontend: CRUD de formatos na aba "Formatos de Endereço"
- ✅ Frontend: FormatoEnderecoSelect integrado em DepositoModal e ZonasPage
- ✅ Frontend: useResolverFormato hook existe e funciona
- ❌ Frontend: EnderecoAutoModal NÃO adapta campos conforme formato (usa sempre legado)

## O Que Precisa Ser Feito

O `EnderecoAutoModal` (src/app/(interna)/configurador/enderecos/EnderecoAutoModal.tsx) precisa:

1. Quando o usuário seleciona um depósito, chamar `useResolverFormato(depositoId)`
2. Se o formato resolvido tem < 6 segmentos (não é 'padrao' e não é o Porta-palete 6 seg):
   - Mostrar apenas os campos de faixa dos segmentos ativos
   - No submit, usar `useGerarComFormato` (POST /formato-endereco/gerar) com payload de faixas
3. Se o formato resolvido tem 6 segmentos OU é 'padrao' OU resolver falha:
   - Mostrar todos os campos (comportamento legado)
   - No submit, usar `useGerarEnderecos` (POST /enderecos/gerar) com payload legado

## Causa Raiz dos Bugs Anteriores

1. O backend retorna `segmentos` com `campoFisico`, mas o frontend tentava acessar `componentes` com `tipo` → crash
2. O formato "Porta-palete (6 seg)" tem codigoDeposito e codigoZona como segmentos, mas o modal não enviava faixas para eles → 0 endereços
3. O schema Zod do modal exige TODOS os campos (ruaInicio, predioInicio, etc.) mesmo quando o formato não os usa → validação falha

## Solução Correta

- O schema Zod deve ser dinâmico: campos de faixa são opcionais quando o formato não os inclui
- Usar `formatoResolvido.segmentos` (não `.componentes`) para determinar campos visíveis
- Mapear `campoFisico` → campo do formulário:
  - codigoRua → ruaInicio/ruaFim
  - codigoPredio → predioInicio/predioFim
  - codigoNivel → nivelInicio/nivelFim
  - codigoApto → aptoInicio/aptoFim
  - codigoDeposito → usar valor fixo do campo codigoDeposito (não precisa de faixa)
  - codigoZona → usar valor fixo do campo codigoZona (não precisa de faixa)
- No payload do v2, incluir codigoDeposito e codigoZona como faixas fixas (inicio=fim=parseInt(valor))

## Endpoints

- GET /formato-endereco/resolver?depositoId=xxx → retorna { id, nome, segmentos: [...] }
- POST /formato-endereco/gerar → aceita { depositoId, centroDistribuicaoId, faixas: [{campoFisico, inicio, fim}], ... }
- POST /enderecos/gerar → endpoint legado (6 segmentos fixos)

## Arquivos Relevantes

- Frontend: src/app/(interna)/configurador/enderecos/EnderecoAutoModal.tsx
- Frontend: src/data/hooks/useFormatoEndereco.ts (useResolverFormato, useGerarComFormato)
- Backend: src/modules/formato-endereco/formato-endereco.routes.ts (POST /gerar)
- Backend: src/modules/formato-endereco/address-generation-v2.service.ts
