# Design Document: ERP Vendas — Pedido Completo Frontend

## Overview

Este documento detalha a arquitetura frontend para evolução do módulo de Pedido de Venda do VisioFab ERP. A implementação segue os padrões existentes do projeto: Next.js 15 (App Router), Mantine 7, React Query (@tanstack/react-query), react-hook-form + Zod, e TypeScript. O design modulariza o formulário monolítico atual em componentes independentes organizados em Accordion, adiciona modal de faturamento parcial, badges de prioridade, lógica de desabilitação por status, e hooks padronizados para data fetching.

## Architecture

### Camadas da Aplicação

```
┌─────────────────────────────────────────────────────────┐
│  Pages (App Router)                                      │
│  /vendas/pedidos          → PedidosVendaPage            │
│  /vendas/pedidos/novo     → FormularioPedidoPage        │
│  /vendas/pedidos/[id]     → DetalhePedidoPage           │
├─────────────────────────────────────────────────────────┤
│  Components (Modular Sections)                           │
│  SecaoDadosGerais | SecaoEntregaTransporte              │
│  SecaoFinanceiro  | SecaoItensPedido                    │
│  SecaoObservacoes | ModalFaturamentoParcial             │
│  BannerStatus     | BadgePrioridade                    │
├─────────────────────────────────────────────────────────┤
│  Data Layer (Hooks)                                      │
│  usePedidosVenda | usePedidoVenda | useCriarPedido     │
│  useEditarPedido | useConfirmarPedido                  │
│  useCancelarPedido | useFaturarParcial                 │
│  useTransportadoras                                     │
├─────────────────────────────────────────────────────────┤
│  Validation (Zod Schema)                                 │
│  pedidoVendaSchema (cross-field, conditional)           │
├─────────────────────────────────────────────────────────┤
│  Infrastructure                                          │
│  api (Axios) | React Query Provider                     │
└─────────────────────────────────────────────────────────┘
```

## File Structure

```
src/
├── app/(interna)/vendas/pedidos/
│   ├── page.tsx                          # Listagem (refatorada)
│   ├── novo/page.tsx                     # Formulário criação/edição (refatorada)
│   └── [id]/page.tsx                     # Detalhe (refatorada)
├── components/vendas/
│   ├── SecaoDadosGerais.tsx              # Accordion section: dados principais
│   ├── SecaoEntregaTransporte.tsx        # Accordion section: entrega/frete
│   ├── SecaoFinanceiro.tsx               # Accordion section: desconto/acréscimo
│   ├── SecaoItensPedido.tsx              # Accordion section: itens com tabela
│   ├── SecaoObservacoes.tsx              # Accordion section: obs interna + NF
│   ├── ModalFaturamentoParcial.tsx       # Modal de faturamento parcial
│   ├── BannerStatus.tsx                  # Banner de restrição por status
│   ├── BadgePrioridade.tsx              # Badge com cores por prioridade
│   └── FiltrosPedidos.tsx               # Filtros da listagem
├── data/hooks/vendas/
│   ├── types.ts                          # Tipos TypeScript do módulo
│   ├── usePedidoVenda.ts                # Hooks de query e mutation
│   └── useTransportadoras.ts            # Hook para select de transportadoras
└── lib/
    └── schemas/
        └── pedidoVendaSchema.ts          # Schema Zod completo
```

## Data Models

### Types (`src/data/hooks/vendas/types.ts`)

```typescript
import type { PaginatedResponse } from '../fiscal/types'

// === Enums ===

export type PrioridadePedido = 'BAIXA' | 'NORMAL' | 'URGENTE'
export type OrigemPedido = 'MANUAL' | 'ECOMMERCE' | 'EDI' | 'ORCAMENTO'
export type StatusPedido = 'RASCUNHO' | 'CONFIRMADO' | 'EM_SEPARACAO' | 'EFETIVADO' | 'FATURADO' | 'CANCELADO'
export type TipoDesconto = 'PERCENTUAL' | 'VALOR_FIXO'
export type TipoAcrescimo = 'FRETE' | 'SEGURO' | 'OUTRAS_DESPESAS'
export type ModalidadeFrete = 0 | 1 | 2 | 3 | 4 | 9

// === Interfaces ===

export interface EnderecoEntrega {
  logradouro: string
  numero: string
  complemento?: string
  bairro: string
  cidade: string
  uf: string
  cep: string
}

export interface ItemPedidoVenda {
  id: string
  produtoId: string
  produto?: { id: string; codigo: string; nome: string; unidade: string }
  unidade: string
  quantidade: number
  precoUnitario: number
  desconto: number            // percentual
  descontoValor: number       // valor fixo
  frete: number
  seguro: number
  outrasDespesas: number
  precoFinal: number
  valorTotal: number
  quantidadeFaturada: number
  observacaoItem?: string
  dataEntregaItem?: string
  comissaoPercItem?: number
}

export interface VendaEfetivada {
  id: string
  dataEfetivacao: string
  valorTotal: number
  nfeId?: string
  nfeNumero?: number
}

export interface PedidoVenda {
  id: string
  numero: number
  status: StatusPedido
  clienteId: string
  cliente?: { id: string; razaoSocial: string; nomeFantasia?: string }
  vendedorId?: string
  vendedor?: { id: string; nome: string }
  tabelaPrecoId: string
  tabelaPreco?: { id: string; nome: string }
  condicaoPagId?: string
  prioridade: PrioridadePedido
  origemPedido: OrigemPedido
  numeroPedidoCliente?: string
  dataValidade?: string
  dataEntrega?: string
  transportadoraId?: string
  transportadora?: { id: string; razaoSocial: string }
  modalidadeFrete?: ModalidadeFrete
  enderecoEntrega?: EnderecoEntrega
  tipoDesconto?: TipoDesconto
  descontoGeral?: number
  tipoAcrescimo?: TipoAcrescimo
  acrescimoGeral?: number
  observacao?: string
  observacaoNota?: string
  dataLimiteAtendimento?: string
  valorTotal: number
  itens: ItemPedidoVenda[]
  vendasEfetivadas?: VendaEfetivada[]
  motivoCancelamento?: string
  createdAt: string
  updatedAt: string
}

export interface PedidosVendaFilters {
  page?: number
  limit?: number
  status?: StatusPedido
  prioridade?: PrioridadePedido
  origemPedido?: OrigemPedido
  numeroPedidoCliente?: string
  ordenarPorPrioridade?: boolean
}

export interface FaturarParcialPayload {
  itens: Array<{ itemId: string; quantidade: number }>
}

export type PedidosVendaResponse = PaginatedResponse<PedidoVenda>
```

## Zod Validation Schema

### Schema completo (`src/lib/schemas/pedidoVendaSchema.ts`)

```typescript
import { z } from 'zod'

const UFS_VALIDAS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS',
  'MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
] as const

const enderecoEntregaSchema = z.object({
  logradouro: z.string().max(200),
  numero: z.string().max(20),
  complemento: z.string().max(100).optional(),
  bairro: z.string().max(100),
  cidade: z.string().max(100),
  uf: z.enum(UFS_VALIDAS, { errorMap: () => ({ message: 'UF inválida' }) }),
  cep: z.string().regex(/^\d{8}$/, 'CEP deve conter exatamente 8 dígitos numéricos'),
})

const itemSchema = z.object({
  produtoId: z.string().min(1, 'Produto é obrigatório'),
  unidade: z.string().optional(),
  quantidade: z.number().positive('Quantidade deve ser maior que zero'),
  precoUnitario: z.number().min(0),
  desconto: z.number().min(0).max(100).default(0),
  descontoValor: z.number().min(0).default(0),
  frete: z.number().min(0).default(0),
  seguro: z.number().min(0).default(0),
  outrasDespesas: z.number().min(0).default(0),
  observacaoItem: z.string().max(1000).optional(),
  dataEntregaItem: z.string().optional(),
  comissaoPercItem: z.number().min(0).max(100).optional(),
}).refine((item) => {
  const precoFinal = (item.precoUnitario * (1 - item.desconto / 100)) - item.descontoValor
  return precoFinal >= 0
}, { message: 'Desconto total excede o preço do produto', path: ['descontoValor'] })

export const pedidoVendaSchema = z.object({
  // Dados Gerais
  clienteId: z.string().min(1, 'Cliente é obrigatório'),
  vendedorId: z.string().optional(),
  tabelaPrecoId: z.string().min(1, 'Tabela de preço é obrigatória'),
  condicaoPagId: z.string().optional(),
  prioridade: z.enum(['BAIXA', 'NORMAL', 'URGENTE']).default('NORMAL'),
  origemPedido: z.enum(['MANUAL', 'ECOMMERCE', 'EDI', 'ORCAMENTO']).default('MANUAL'),
  numeroPedidoCliente: z.string().max(60).optional(),
  orcamentoOrigemId: z.string().optional(),
  dataValidade: z.string().optional().refine((val) => {
    if (!val) return true
    return new Date(val) >= new Date(new Date().toDateString())
  }, 'Data de validade deve ser igual ou posterior a hoje'),

  // Entrega e Transporte
  dataEntrega: z.string().optional().refine((val) => {
    if (!val) return true
    return new Date(val) >= new Date(new Date().toDateString())
  }, 'Data de entrega deve ser igual ou posterior a hoje'),
  transportadoraId: z.string().optional(),
  modalidadeFrete: z.number().optional(),
  enderecoEntrega: enderecoEntregaSchema.optional(),

  // Financeiro
  tipoDesconto: z.enum(['PERCENTUAL', 'VALOR_FIXO']).optional(),
  descontoGeral: z.number().min(0).optional(),
  tipoAcrescimo: z.enum(['FRETE', 'SEGURO', 'OUTRAS_DESPESAS']).optional(),
  acrescimoGeral: z.number().min(0).optional(),

  // Itens
  itens: z.array(itemSchema).min(1, 'Pelo menos um item é obrigatório'),

  // Observações
  observacao: z.string().max(1000).optional(),
  observacaoNota: z.string().max(2000).optional(),
}).superRefine((data, ctx) => {
  // Cross-field: endereço parcial exige todos os campos
  if (data.enderecoEntrega) {
    const addr = data.enderecoEntrega
    const hasAny = addr.logradouro || addr.numero || addr.bairro || addr.cidade || addr.uf || addr.cep
    if (hasAny) {
      if (!addr.logradouro) ctx.addIssue({ code: 'custom', message: 'Logradouro obrigatório', path: ['enderecoEntrega', 'logradouro'] })
      if (!addr.numero) ctx.addIssue({ code: 'custom', message: 'Número obrigatório', path: ['enderecoEntrega', 'numero'] })
      if (!addr.bairro) ctx.addIssue({ code: 'custom', message: 'Bairro obrigatório', path: ['enderecoEntrega', 'bairro'] })
      if (!addr.cidade) ctx.addIssue({ code: 'custom', message: 'Cidade obrigatória', path: ['enderecoEntrega', 'cidade'] })
      if (!addr.uf) ctx.addIssue({ code: 'custom', message: 'UF obrigatória', path: ['enderecoEntrega', 'uf'] })
      if (!addr.cep) ctx.addIssue({ code: 'custom', message: 'CEP obrigatório', path: ['enderecoEntrega', 'cep'] })
    }
  }

  // Cross-field: desconto
  if (data.descontoGeral && data.descontoGeral > 0 && !data.tipoDesconto) {
    ctx.addIssue({ code: 'custom', message: 'Tipo de desconto é obrigatório quando desconto geral é informado', path: ['tipoDesconto'] })
  }
  if (data.tipoDesconto && (!data.descontoGeral || data.descontoGeral <= 0)) {
    ctx.addIssue({ code: 'custom', message: 'Desconto geral é obrigatório quando tipo de desconto é selecionado', path: ['descontoGeral'] })
  }
  if (data.tipoDesconto === 'PERCENTUAL' && data.descontoGeral) {
    if (data.descontoGeral < 0.01 || data.descontoGeral > 100) {
      ctx.addIssue({ code: 'custom', message: 'Desconto percentual deve ser entre 0.01 e 100.00', path: ['descontoGeral'] })
    }
  }

  // Cross-field: acréscimo
  if (data.acrescimoGeral && data.acrescimoGeral > 0 && !data.tipoAcrescimo) {
    ctx.addIssue({ code: 'custom', message: 'Tipo de acréscimo é obrigatório quando acréscimo geral é informado', path: ['tipoAcrescimo'] })
  }
  if (data.tipoAcrescimo && (!data.acrescimoGeral || data.acrescimoGeral <= 0)) {
    ctx.addIssue({ code: 'custom', message: 'Acréscimo geral é obrigatório quando tipo de acréscimo é selecionado', path: ['acrescimoGeral'] })
  }
})

export type PedidoVendaFormValues = z.infer<typeof pedidoVendaSchema>
```

## Components and Interfaces

### BadgePrioridade (`src/components/vendas/BadgePrioridade.tsx`)

```typescript
import { Badge } from '@mantine/core'
import type { PrioridadePedido } from '@/data/hooks/vendas/types'

const PRIORIDADE_COLORS: Record<PrioridadePedido, string> = {
  URGENTE: 'red',
  NORMAL: 'blue',
  BAIXA: 'gray',
}

interface BadgePrioridadeProps {
  prioridade: PrioridadePedido
}

export function BadgePrioridade({ prioridade }: BadgePrioridadeProps) {
  return (
    <Badge color={PRIORIDADE_COLORS[prioridade]} size="sm">
      {prioridade}
    </Badge>
  )
}

export { PRIORIDADE_COLORS }
```

### BannerStatus (`src/components/vendas/BannerStatus.tsx`)

```typescript
import { Alert } from '@mantine/core'
import { IconInfoCircle } from '@tabler/icons-react'
import type { StatusPedido } from '@/data/hooks/vendas/types'

interface BannerStatusProps {
  status: StatusPedido
  temFaturamentoParcial?: boolean
}

export function BannerStatus({ status, temFaturamentoParcial }: BannerStatusProps) {
  if (status === 'RASCUNHO') return null

  if (status === 'CONFIRMADO') {
    return (
      <Alert color="blue" icon={<IconInfoCircle />} mb="md">
        Pedido confirmado — apenas alguns campos podem ser editados.
        {temFaturamentoParcial && (
          <> Itens parcialmente faturados não podem ser alterados.</>
        )}
      </Alert>
    )
  }

  return null
}
```

### Status-Based Field Disabling Logic

A lógica de desabilitação é implementada via uma função utilitária que determina quais campos são editáveis com base no status do pedido:

```typescript
import type { StatusPedido, ItemPedidoVenda } from '@/data/hooks/vendas/types'

// Campos permitidos para edição no status CONFIRMADO
const CAMPOS_EDITAVEIS_CONFIRMADO = [
  'observacao', 'observacaoNota', 'prioridade',
  'dataEntrega', 'transportadoraId', 'modalidadeFrete', 'enderecoEntrega',
] as const

export function isFieldDisabled(fieldName: string, status: StatusPedido): boolean {
  if (status === 'RASCUNHO') return false
  if (status === 'CONFIRMADO') {
    return !CAMPOS_EDITAVEIS_CONFIRMADO.includes(fieldName as any)
  }
  return true // EFETIVADO, CANCELADO → redirect, não chega aqui
}

export function isItemEditable(item: ItemPedidoVenda, status: StatusPedido): boolean {
  if (status === 'RASCUNHO') return true
  if (status === 'CONFIRMADO') return item.quantidadeFaturada === 0
  return false
}
```

### Accordion Layout — Formulário Page (`src/app/(interna)/vendas/pedidos/novo/page.tsx`)

```typescript
'use client'

import { useEffect, useRef } from 'react'
import { Accordion, Button, Group, Text, LoadingOverlay } from '@mantine/core'
import { FormProvider, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { pedidoVendaSchema, PedidoVendaFormValues } from '@/lib/schemas/pedidoVendaSchema'
import { SecaoDadosGerais } from '@/components/vendas/SecaoDadosGerais'
import { SecaoEntregaTransporte } from '@/components/vendas/SecaoEntregaTransporte'
import { SecaoFinanceiro } from '@/components/vendas/SecaoFinanceiro'
import { SecaoItensPedido } from '@/components/vendas/SecaoItensPedido'
import { SecaoObservacoes } from '@/components/vendas/SecaoObservacoes'
import { BannerStatus } from '@/components/vendas/BannerStatus'

// A page usa FormProvider para dar contexto aos componentes filhos.
// Cada seção usa useFormContext() internamente.
// O Accordion é configurado com multiple={true} e defaultValue=['dados-gerais'].
// Na submissão com erros, identifica qual seção contém o primeiro erro e abre-a.
```

### Seção Components Interface Pattern

Cada seção segue o mesmo padrão de interface:

```typescript
interface SecaoProps {
  disabled?: boolean  // Desabilita todos os campos da seção
}

// Exemplo: SecaoDadosGerais.tsx
export function SecaoDadosGerais({ disabled }: SecaoProps) {
  const { control, watch, formState: { errors } } = useFormContext<PedidoVendaFormValues>()
  // ... renderiza campos usando Controller do react-hook-form
  // ... aplica disabled prop em cada campo quando disabled === true
}
```

### ModalFaturamentoParcial (`src/components/vendas/ModalFaturamentoParcial.tsx`)

```typescript
import { Modal, Table, NumberInput, Button, Group, Text, Alert } from '@mantine/core'
import type { ItemPedidoVenda, FaturarParcialPayload } from '@/data/hooks/vendas/types'

interface ModalFaturamentoParcialProps {
  opened: boolean
  onClose: () => void
  itens: ItemPedidoVenda[]
  pedidoId: string
}

// Estado interno: Map<itemId, quantidadeAFaturar>
// Validação: para cada item, quantidade ≤ (item.quantidade - item.quantidadeFaturada)
// Submit: chama useFaturarParcial com payload filtrado (apenas itens com qtd > 0)
// Feedback: loading no botão, notificação sucesso/erro, invalidação de cache
```

### Item Total Calculation

A fórmula de cálculo do total do item é implementada como função pura reutilizável:

```typescript
export function calcularTotalItem(item: {
  precoUnitario: number
  desconto: number       // percentual 0-100
  descontoValor: number  // valor fixo
  quantidade: number
  frete: number
  seguro: number
  outrasDespesas: number
}): number {
  const precoComDesconto = item.precoUnitario * (1 - item.desconto / 100)
  const precoFinal = precoComDesconto - item.descontoValor
  return precoFinal * item.quantidade + item.frete + item.seguro + item.outrasDespesas
}
```

### Address Formatting

Função pura para formatar endereço de entrega:

```typescript
import type { EnderecoEntrega } from '@/data/hooks/vendas/types'

export function formatarEnderecoEntrega(endereco: EnderecoEntrega): string {
  const parts = [endereco.logradouro, endereco.numero]
  if (endereco.complemento) parts.push(`- ${endereco.complemento}`)
  parts.push(`- ${endereco.bairro}`)
  parts.push(`${endereco.cidade}/${endereco.uf}`)
  parts.push(`- CEP: ${endereco.cep}`)
  return parts.join(', ').replace(', - ', ' - ')
}
```

### Billing Progress Color

```typescript
export function getProgressColor(quantidadeFaturada: number, quantidade: number): string {
  if (quantidadeFaturada >= quantidade) return 'green'
  if (quantidadeFaturada > 0) return 'orange'
  return 'gray'
}
```

## Data Layer — Hooks

### usePedidoVenda (`src/data/hooks/vendas/usePedidoVenda.ts`)

Segue o padrão existente do `useNfe` — factory function retornando hooks:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type {
  PedidosVendaFilters, PedidosVendaResponse, PedidoVenda,
  FaturarParcialPayload, PedidoVendaFormValues,
} from './types'

const QUERY_KEY = 'pedidos-venda'

export function usePedidosVenda(params?: PedidosVendaFilters) {
  return useQuery<PedidosVendaResponse>({
    queryKey: [QUERY_KEY, params],
    queryFn: async () => {
      const { data } = await api.get('/pedidos-venda', { params })
      return data
    },
    staleTime: 1000 * 60 * 2,
  })
}

export function usePedidoVenda(id: string) {
  return useQuery<PedidoVenda>({
    queryKey: [QUERY_KEY, id],
    queryFn: async () => {
      const { data } = await api.get(`/pedidos-venda/${id}`)
      return data
    },
    enabled: !!id,
  })
}

export function useCriarPedido() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: PedidoVendaFormValues) => {
      const { data } = await api.post('/pedidos-venda', body)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  })
}

export function useEditarPedido(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: Partial<PedidoVendaFormValues>) => {
      const { data } = await api.put(`/pedidos-venda/${id}`, body)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] })
      qc.invalidateQueries({ queryKey: [QUERY_KEY, id] })
    },
  })
}

export function useConfirmarPedido() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch(`/pedidos-venda/${id}/confirmar`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  })
}

export function useCancelarPedido() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, motivo }: { id: string; motivo: string }) => {
      const { data } = await api.patch(`/pedidos-venda/${id}/cancelar`, { motivo })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  })
}

export function useFaturarParcial(pedidoId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: FaturarParcialPayload) => {
      const { data } = await api.post(`/pedidos-venda/${pedidoId}/faturar`, payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] })
      qc.invalidateQueries({ queryKey: [QUERY_KEY, pedidoId] })
    },
  })
}
```

### useTransportadoras (`src/data/hooks/vendas/useTransportadoras.ts`)

```typescript
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

interface Transportadora {
  id: string
  razaoSocial: string
  cnpj: string
}

export function useTransportadoras() {
  return useQuery<{ data: Transportadora[] }>({
    queryKey: ['transportadoras-select'],
    queryFn: async () => {
      const { data } = await api.get('/transportadoras', { params: { limit: 100, status: 'true' } })
      return data
    },
    staleTime: 1000 * 60 * 5,
  })
}
```

## Data Flow

### Formulário — Fluxo de Dados

```
┌──────────────────────────────────────────────────────────────┐
│  FormProvider (react-hook-form)                                │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ zodResolver(pedidoVendaSchema)                           │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────┐  │
│  │ SecaoDadosGerais│  │SecaoEntrega    │  │SecaoFinanceiro│  │
│  │ useFormContext()│  │useFormContext() │  │useFormContext()│  │
│  └────────────────┘  └────────────────┘  └──────────────┘  │
│                                                              │
│  ┌────────────────┐  ┌────────────────┐                     │
│  │SecaoItensPedido │  │SecaoObservacoes │                     │
│  │useFormContext() │  │useFormContext() │                     │
│  │useFieldArray()  │  └────────────────┘                     │
│  └────────────────┘                                          │
│                                                              │
│  handleSubmit → validate → useCriarPedido / useEditarPedido │
└──────────────────────────────────────────────────────────────┘
```

### Listagem — Fluxo de Dados

```
┌───────────────────────────────────────────────────┐
│  PedidosVendaPage                                  │
│                                                   │
│  State: { status, prioridade, origemPedido,       │
│           numeroPedidoCliente, ordenarPorPrioridade,│
│           page }                                  │
│                                                   │
│  FiltrosPedidos → onChange → setState + setPage(1)│
│                                                   │
│  usePedidosVenda(filters) → table data            │
│                                                   │
│  Row actions:                                     │
│  - Ver → router.push(/vendas/pedidos/{id})        │
│  - Confirmar → useConfirmarPedido                 │
│  - Cancelar → useCancelarPedido                   │
└───────────────────────────────────────────────────┘
```

## Error Handling

### Client-Side (Zod)
- Validação executada pelo `zodResolver` antes do submit
- Erros exibidos inline via `error` prop do Mantine em cada campo
- Accordion auto-expande a seção com o primeiro erro via mapeamento field → section

### Server-Side (API 400/422)
- Erros capturados no `onError` da mutation ou no `catch` do `handleSubmit`
- Mensagem do `error.response.data.message` exibida via `notifications.show({ color: 'red' })`
- Modal de faturamento: mantém aberto em caso de erro, exibe notificação

### Mapeamento campo → seção do Accordion

```typescript
const FIELD_TO_SECTION: Record<string, string> = {
  clienteId: 'dados-gerais',
  vendedorId: 'dados-gerais',
  tabelaPrecoId: 'dados-gerais',
  condicaoPagId: 'dados-gerais',
  prioridade: 'dados-gerais',
  origemPedido: 'dados-gerais',
  numeroPedidoCliente: 'dados-gerais',
  dataValidade: 'dados-gerais',
  dataEntrega: 'entrega-transporte',
  transportadoraId: 'entrega-transporte',
  modalidadeFrete: 'entrega-transporte',
  enderecoEntrega: 'entrega-transporte',
  tipoDesconto: 'financeiro',
  descontoGeral: 'financeiro',
  tipoAcrescimo: 'financeiro',
  acrescimoGeral: 'financeiro',
  itens: 'itens-pedido',
  observacao: 'observacoes',
  observacaoNota: 'observacoes',
}

function getFirstErrorSection(errors: Record<string, any>): string | null {
  for (const field of Object.keys(errors)) {
    const section = FIELD_TO_SECTION[field]
    if (section) return section
  }
  return null
}
```

## API Integration

### Endpoints consumidos

| Hook | Método | Endpoint | Descrição |
|------|--------|----------|-----------|
| `usePedidosVenda` | GET | `/pedidos-venda` | Listagem paginada com filtros |
| `usePedidoVenda` | GET | `/pedidos-venda/{id}` | Detalhe com itens e vendas efetivadas |
| `useCriarPedido` | POST | `/pedidos-venda` | Criar novo pedido |
| `useEditarPedido` | PUT | `/pedidos-venda/{id}` | Editar pedido existente |
| `useConfirmarPedido` | PATCH | `/pedidos-venda/{id}/confirmar` | Transição RASCUNHO → CONFIRMADO |
| `useCancelarPedido` | PATCH | `/pedidos-venda/{id}/cancelar` | Cancelar pedido |
| `useFaturarParcial` | POST | `/pedidos-venda/{id}/faturar` | Faturamento parcial |
| `useTransportadoras` | GET | `/transportadoras` | Select de transportadoras |

### Query Keys e Cache

```typescript
// Hierarquia de query keys para invalidação precisa
['pedidos-venda']                    // lista
['pedidos-venda', { ...filters }]    // lista filtrada
['pedidos-venda', id]                // detalhe
['transportadoras-select']           // transportadoras (stale 5min)
['clientes-select']                  // clientes (stale 5min)
['vendedores-select']                // vendedores (stale 5min)
['tabelas-preco-select']             // tabelas de preço (stale 5min)
['produtos-select']                  // produtos (stale 5min)
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property 1: Priority badge color mapping

*For any* valid `PrioridadePedido` value, the `BadgePrioridade` component SHALL render a Badge with the deterministic color: URGENTE → red, NORMAL → blue, BAIXA → gray. No other color is possible for these values.

**Validates: Requirements 2.2, 2.3, 2.4, 10.2**

### Property 2: Item total calculation correctness

*For any* item with non-negative `precoUnitario`, `desconto` in [0,100], non-negative `descontoValor`, positive `quantidade`, and non-negative `frete`, `seguro`, `outrasDespesas`, the `calcularTotalItem` function SHALL return a value equal to `((precoUnitario × (1 - desconto/100)) - descontoValor) × quantidade + frete + seguro + outrasDespesas`.

**Validates: Requirements 7.3**

### Property 3: Negative price validation

*For any* item where `(precoUnitario × (1 - desconto/100)) - descontoValor` results in a value less than zero, the Zod schema SHALL produce a validation error on that item's `descontoValor` path.

**Validates: Requirements 7.4**

### Property 4: Date validation rejects past dates

*For any* date string representing a date strictly before today, both the `dataValidade` and `dataEntrega` refinements in the Zod schema SHALL return a validation error. *For any* date string representing today or a future date, the refinement SHALL pass.

**Validates: Requirements 4.4, 5.4, 13.4**

### Property 5: Cross-field desconto/acréscimo validation

*For any* form data where `descontoGeral > 0` and `tipoDesconto` is undefined, the schema SHALL produce an error on `tipoDesconto`. Symmetrically, *for any* form data where `acrescimoGeral > 0` and `tipoAcrescimo` is undefined, the schema SHALL produce an error on `tipoAcrescimo`. Additionally, when `tipoDesconto` is `PERCENTUAL`, *for any* `descontoGeral` outside [0.01, 100.00], the schema SHALL produce an error.

**Validates: Requirements 6.3, 6.4, 6.6, 13.3**

### Property 6: Partial address triggers all-mandatory validation

*For any* `enderecoEntrega` object where at least one field (logradouro, numero, bairro, cidade, uf, or cep) is non-empty and any other mandatory field is empty, the Zod schema SHALL produce validation errors for each missing mandatory field.

**Validates: Requirements 5.3, 13.4**

### Property 7: CEP and UF format validation

*For any* string that does not match exactly 8 numeric digits (`/^\d{8}$/`), the `cep` field SHALL fail validation. *For any* string that is not one of the 27 valid Brazilian state abbreviations, the `uf` field SHALL fail validation.

**Validates: Requirements 5.5, 5.6, 13.4**

### Property 8: Status-based field disabling

*For any* field name not in the set `{observacao, observacaoNota, prioridade, dataEntrega, transportadoraId, modalidadeFrete, enderecoEntrega}`, the `isFieldDisabled` function SHALL return `true` when status is `CONFIRMADO`. *For any* field name when status is `RASCUNHO`, the function SHALL return `false`.

**Validates: Requirements 9.1, 9.2, 14.3**

### Property 9: Partially billed items non-editable

*For any* `ItemPedidoVenda` where `quantidadeFaturada > 0` and pedido status is `CONFIRMADO`, the `isItemEditable` function SHALL return `false`. *For any* item where `quantidadeFaturada === 0` and status is `CONFIRMADO`, the function SHALL return `true`.

**Validates: Requirements 9.3**

### Property 10: Address formatting determinism

*For any* valid `EnderecoEntrega` object with all mandatory fields populated, the `formatarEnderecoEntrega` function SHALL produce a string containing the logradouro, numero, bairro, cidade, uf, and cep values. When complemento is provided, it SHALL also appear in the output.

**Validates: Requirements 10.3**

### Property 11: Faturamento quantity cannot exceed available balance

*For any* item in the faturamento modal, if the user enters a `quantidadeAFaturar` greater than `(item.quantidade - item.quantidadeFaturada)`, validation SHALL produce an error for that item. *For any* `quantidadeAFaturar` in range [0, saldo], validation SHALL pass.

**Validates: Requirements 11.3**

### Property 12: Billing progress color mapping

*For any* item where `quantidadeFaturada >= quantidade`, `getProgressColor` SHALL return `'green'`. *For any* item where `0 < quantidadeFaturada < quantidade`, it SHALL return `'orange'`. *For any* item where `quantidadeFaturada === 0`, it SHALL return `'gray'`.

**Validates: Requirements 12.3**

### Property 13: Filter change always resets page to 1

*For any* current page number > 1 and any filter change (status, prioridade, origemPedido, numeroPedidoCliente, or ordenarPorPrioridade), the listing page SHALL reset the page state to 1 before fetching data.

**Validates: Requirements 1.6**

### Property 14: Required fields schema validation

*For any* form data where `clienteId` is empty, OR `tabelaPrecoId` is empty, OR `itens` array is empty, OR any item has empty `produtoId` or `quantidade ≤ 0`, the Zod schema SHALL produce at least one validation error. Conversely, *for any* form data satisfying all these constraints (with valid values for all other fields), the schema SHALL pass these specific checks.

**Validates: Requirements 13.2**

## Testing Strategy

### Property-Based Tests (fast-check + vitest)

As funções puras e o schema Zod são testáveis via property-based testing com `fast-check`:

| Property | Alvo | Tipo |
|----------|------|------|
| 1 — Priority color mapping | `PRIORIDADE_COLORS` lookup | Invariant |
| 2 — Item total calculation | `calcularTotalItem` | Metamorphic |
| 3 — Negative price validation | `itemSchema.refine` | Error condition |
| 4 — Date validation | `pedidoVendaSchema` refinements | Error condition |
| 5 — Cross-field desconto/acréscimo | `superRefine` | Error condition |
| 6 — Partial address mandatory | `superRefine` | Error condition |
| 7 — CEP/UF format | `enderecoEntregaSchema` | Error condition |
| 8 — Field disabling by status | `isFieldDisabled` | Invariant |
| 9 — Item editability | `isItemEditable` | Invariant |
| 10 — Address formatting | `formatarEnderecoEntrega` | Invariant |
| 11 — Faturamento quantity | validação do modal | Error condition |
| 12 — Billing progress color | `getProgressColor` | Invariant |
| 13 — Filter resets page | state handler | Invariant |
| 14 — Required fields | `pedidoVendaSchema` | Error condition |

### Unit Tests (vitest + testing-library)

Testes de exemplo para cenários específicos de UI:
- Renderização das colunas corretas na listagem
- Accordion abre seção "Dados Gerais" por padrão
- Conditional rendering do campo `orcamentoOrigemId` quando origem é ORCAMENTO
- Banner de status com mensagens corretas
- Modal de faturamento abre/fecha corretamente
- Breadcrumb exibe texto correto

### Configuração

- **Runner**: vitest (single execution via `npm run test`)
- **PBT Library**: fast-check (já instalado no projeto)
- **Mínimo iterações**: 100 por property test
- **Test location**: `src/components/vendas/__tests__/` e `src/lib/schemas/__tests__/`
