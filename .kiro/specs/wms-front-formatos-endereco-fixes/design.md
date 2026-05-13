# Design Document — wms-front-formatos-endereco-fixes

## Architecture Overview

Este design cobre três entregas no frontend WMS (Next.js 15 / Mantine 7):

1. **CRUD de Formatos de Endereço** — Nova página/sub-aba no Configurador > Endereços com listagem, criação, edição e exclusão de formatos; seletor de formato nos modais de depósito e zona; adaptação do EnderecoAutoModal para exibir campos condicionais.
2. **Bug: Shelf Life** — Alerta visual não-bloqueante na conferência de entrada quando shelf life está abaixo do mínimo.
3. **Bug: Endereçamento manual sem sugestões** — Integração do `useDistribuicaoInteligente` no fluxo manual de endereçamento.

A arquitetura segue os padrões existentes do projeto:
- **Hooks de dados**: `useCrudGenerico` para CRUD, hooks customizados com TanStack Query para queries/mutations específicas.
- **Formulários**: `react-hook-form` + `zod` + `Controller` do Mantine.
- **UI**: Mantine 7 components + Tailwind CSS para layout.
- **Estado**: Estado local com `useState` para UI, TanStack Query para server state.

---

## Components

### 1. Novo Hook: `useFormatoEndereco`

**Arquivo:** `src/data/hooks/useFormatoEndereco.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useCrudGenerico } from './useCrudGenerico'

// ===== Interfaces =====

export interface ComponenteFormato {
  tipo: 'RUA' | 'PREDIO' | 'NIVEL' | 'APARTAMENTO'
  ativo: boolean
  digitos: number
  separador: string
}

export interface FormatoEndereco {
  id: string
  nome: string
  componentes: ComponenteFormato[]
  status?: boolean
}

export interface FormatoResolvidoResponse {
  id: string
  nome: string
  componentes: ComponenteFormato[]
}

export interface GerarEnderecosInput {
  formatoEnderecoId?: string
  depositoId: string
  centroDistribuicaoId: string
  estruturaId?: string
  codigoDeposito: string
  codigoZona: string
  tipo: string
  nivelPicking?: number
  ruaInicio?: number
  ruaFim?: number
  predioInicio?: number
  predioFim?: number
  nivelInicio?: number
  nivelFim?: number
  aptoInicio?: number
  aptoFim?: number
}

// ===== CRUD via useCrudGenerico =====

export const formatoEnderecoCrud = useCrudGenerico<FormatoEndereco>(
  '/formato-endereco',
  'formato-endereco'
)

// ===== Hooks Específicos =====

const KEYS = {
  resolver: 'formato-endereco-resolver',
}

/** GET /formato-endereco/resolver?depositoId=&zonaId= */
export function useResolverFormato(depositoId: string | null, zonaId?: string | null) {
  return useQuery<FormatoResolvidoResponse | null>({
    queryKey: [KEYS.resolver, depositoId, zonaId],
    queryFn: async () => {
      const params: Record<string, string> = {}
      if (depositoId) params.depositoId = depositoId
      if (zonaId) params.zonaId = zonaId
      const { data } = await api.get('/formato-endereco/resolver', { params })
      return data
    },
    enabled: !!depositoId,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    retry: false,
  })
}

/** POST /formato-endereco/gerar */
export function useGerarComFormato() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: GerarEnderecosInput) => {
      const { data } = await api.post('/formato-endereco/gerar', body)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['enderecos'] })
    },
  })
}
```

### 2. Componente: `FormatosEnderecoTab`

**Arquivo:** `src/app/(interna)/configurador/enderecos/FormatosEnderecoTab.tsx`

Componente de CRUD completo para formatos de endereço, seguindo o padrão da `ZonasPage`:
- Tabela com colunas: Nome, Componentes (badges dos ativos), Status
- Botões: Novo, Atualizar, Editar, Excluir
- Modal inline com formulário de criação/edição

```typescript
// Schema de validação
const formatoSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  componentes: z.array(z.object({
    tipo: z.enum(['RUA', 'PREDIO', 'NIVEL', 'APARTAMENTO']),
    ativo: z.boolean(),
    digitos: z.number().min(1).max(10),
    separador: z.string().max(3),
  })).refine(
    (comps) => comps.some((c) => c.ativo),
    'Ao menos um componente deve estar ativo'
  ),
})
```

### 3. Componente: `FormatoEnderecoSelect`

**Arquivo:** `src/components/configurador/FormatoEnderecoSelect.tsx`

Componente reutilizável de Select para formato de endereço, usado no DepositoModal e ZonasPage:

```typescript
interface FormatoEnderecoSelectProps {
  value: string | null
  onChange: (value: string | null) => void
  error?: string
  label?: string
}

export function FormatoEnderecoSelect({
  value,
  onChange,
  error,
  label = 'Formato de Endereço',
}: FormatoEnderecoSelectProps) {
  const { data: formatosResp } = formatoEnderecoCrud.useListar({ limit: 100 })
  const options = (formatosResp?.data || []).map((f) => ({
    value: f.id,
    label: f.nome,
  }))

  return (
    <Select
      label={label}
      data={options}
      value={value}
      onChange={onChange}
      error={error}
      searchable
      clearable
      placeholder="Selecione um formato (opcional)"
    />
  )
}
```

### 4. Adaptação: `EnderecoAutoModal`

Modificações no modal existente:
- Após seleção de depósito, chamar `useResolverFormato(depositoId)`
- Renderizar condicionalmente os campos de faixa baseado nos componentes ativos
- Incluir `formatoEnderecoId` no payload de geração
- Fallback: se resolver falha ou retorna vazio, exibir todos os campos

```typescript
// Dentro do EnderecoAutoModal:
const depositoId = watch('depositoId')
const { data: formatoResolvido, isError: formatoError } = useResolverFormato(depositoId || null)

// Determinar campos visíveis
const componentesAtivos = useMemo(() => {
  if (!formatoResolvido || formatoError) {
    // Fallback: todos os campos
    return { rua: true, predio: true, nivel: true, apartamento: true }
  }
  const map: Record<string, boolean> = { rua: false, predio: false, nivel: false, apartamento: false }
  for (const comp of formatoResolvido.componentes) {
    if (comp.ativo) map[comp.tipo.toLowerCase()] = true
  }
  return map
}, [formatoResolvido, formatoError])
```

### 5. Adaptação: `DepositoModal`

Modificações:
- Adicionar `formatoEnderecoId` ao schema (opcional)
- Incluir `<FormatoEnderecoSelect>` no formulário
- Pré-selecionar formato existente no modo edição

```typescript
// Schema atualizado
const schema = z.object({
  // ... campos existentes
  formatoEnderecoId: z.string().optional().nullable(),
})

// No useEffect de reset para edição:
reset({
  ...existingFields,
  formatoEnderecoId: editData.formatoEnderecoId || null,
})
```

### 6. Adaptação: `ZonasPage`

Modificações:
- Adicionar `formatoEnderecoId` ao schema da zona (opcional)
- Incluir `<FormatoEnderecoSelect>` no modal inline
- Pré-selecionar formato existente no modo edição

### 7. Utilitário: `calcularDiasRestantes`

**Arquivo:** `src/utils/shelfLife.ts`

```typescript
/**
 * Calcula os dias restantes entre uma data de vencimento e a data de referência.
 * Retorna número inteiro de dias (floor).
 */
export function calcularDiasRestantes(
  dataVencimento: string | Date,
  dataReferencia: Date = new Date()
): number {
  const vencimento = new Date(dataVencimento)
  const diffMs = vencimento.getTime() - dataReferencia.getTime()
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

/**
 * Determina se deve exibir alerta de shelf life.
 * Retorna null se não deve alertar, ou objeto com dados do alerta.
 */
export function verificarShelfLife(
  dataVencimento: string | Date | null | undefined,
  shelfLifeMinimo: number | null | undefined,
  dataReferencia: Date = new Date()
): { diasRestantes: number; minimoExigido: number } | null {
  if (!dataVencimento || !shelfLifeMinimo || shelfLifeMinimo <= 0) return null

  const diasRestantes = calcularDiasRestantes(dataVencimento, dataReferencia)
  if (diasRestantes < shelfLifeMinimo) {
    return { diasRestantes, minimoExigido: shelfLifeMinimo }
  }
  return null
}
```

### 8. Componente: `ShelfLifeAlert`

**Arquivo:** `src/components/wms/ShelfLifeAlert.tsx`

```typescript
import { Alert } from '@mantine/core'
import { IconAlertTriangle } from '@tabler/icons-react'
import { verificarShelfLife } from '@/utils/shelfLife'

interface ShelfLifeAlertProps {
  dataVencimento: string | Date | null | undefined
  shelfLifeMinimo: number | null | undefined
}

export function ShelfLifeAlert({ dataVencimento, shelfLifeMinimo }: ShelfLifeAlertProps) {
  const resultado = verificarShelfLife(dataVencimento, shelfLifeMinimo)
  if (!resultado) return null

  return (
    <Alert
      color="yellow"
      variant="light"
      icon={<IconAlertTriangle size={16} />}
      title="Shelf Life abaixo do mínimo"
    >
      Validade com {resultado.diasRestantes} dias restantes — mínimo exigido: {resultado.minimoExigido} dias
    </Alert>
  )
}
```

### 9. Adaptação: Conferência de Entrada — Shelf Life

Na seção de contagem de itens (`etapa === 'contagem'`), ao lado do campo de validade de cada item:
- Buscar `shelf_life_minimo` do produto (já disponível via dados do item ou query adicional)
- Renderizar `<ShelfLifeAlert>` passando a data de validade informada e o mínimo do produto
- O alerta é reativo: aparece/desaparece conforme o usuário altera a data

### 10. Adaptação: Conferência de Entrada — Endereçamento Manual com Sugestões

Na seção de endereçamento manual (`endModoAtivo === 'manual'`):

```typescript
// Para cada item pendente, chamar useDistribuicaoInteligente
const distribuicao = useDistribuicaoInteligente()

// Ao entrar no modo manual com nota selecionada:
useEffect(() => {
  if (endModoAtivo === 'manual' && endNotaSelecionada && itensPendentes.length > 0) {
    for (const item of itensPendentes) {
      distribuicao.mutate({
        produtoId: item.produtoId,
        quantidade: item.quantidade,
        lote: item.lote,
        validade: item.validade,
      })
    }
  }
}, [endModoAtivo, endNotaSelecionada])

// Exibir sugestões ao lado de cada item
// Botão "Aceitar Sugestões" preenche endDestinos com os valores sugeridos
// Botão "Confirmar" chama useConfirmarDistribuicao
```

Fluxo de UI:
1. Operador seleciona nota → entra no modo manual
2. Hook dispara `useDistribuicaoInteligente` para cada item → exibe loader
3. Sugestões aparecem ao lado de cada item (endereço + % ocupação)
4. Botão "Aceitar Sugestões" preenche campos automaticamente
5. Operador pode alterar qualquer campo manualmente
6. Botão "Confirmar Endereçamento" chama `useConfirmarDistribuicao`

---

## Data Models

### FormatoEndereco

```typescript
interface FormatoEndereco {
  id: string
  nome: string
  componentes: ComponenteFormato[]
  status?: boolean
  createdAt?: string
  updatedAt?: string
}

interface ComponenteFormato {
  tipo: 'RUA' | 'PREDIO' | 'NIVEL' | 'APARTAMENTO'
  ativo: boolean
  digitos: number       // 1-10
  separador: string     // max 3 chars, e.g. ".", "-", ""
}
```

### Payload de Depósito (atualizado)

```typescript
interface DepositoPayload {
  descricao: string
  centroDistribuicaoId: string
  formatoEnderecoId?: string | null  // NOVO
  logradouro?: string
  numero?: string
  cidade?: string
  uf?: string
  cep?: string
  telefone1?: string
  telefone2?: string
}
```

### Payload de Zona (atualizado)

```typescript
interface ZonaPayload {
  descricao: string
  formatoEnderecoId?: string | null  // NOVO
}
```

### Shelf Life Alert Data

```typescript
interface ShelfLifeAlertData {
  diasRestantes: number
  minimoExigido: number
}
```

### Sugestão de Endereçamento (UI)

```typescript
interface SugestaoEnderecoUI {
  itemId: string
  produtoId: string
  produtoCodigo: string
  quantidade: number
  sugestao: {
    enderecoId: string
    enderecoCompleto: string
    percentualOcupacao: number
  } | null
  loading: boolean
  error?: string
}
```

---

## Interfaces (API Contracts)

### GET /api/formato-endereco
- **Response:** `{ data: FormatoEndereco[], total: number, page: number, limit: number, totalPages: number }`

### POST /api/formato-endereco
- **Request:** `{ nome: string, componentes: ComponenteFormato[] }`
- **Response:** `FormatoEndereco`

### PUT /api/formato-endereco/:id
- **Request:** `{ nome: string, componentes: ComponenteFormato[] }`
- **Response:** `FormatoEndereco`

### DELETE /api/formato-endereco/:id
- **Response:** `204 No Content`

### GET /api/formato-endereco/resolver?depositoId=&zonaId=
- **Response:** `FormatoResolvidoResponse | null` (404 se não encontrado)

### POST /api/formato-endereco/gerar
- **Request:** `GerarEnderecosInput`
- **Response:** `{ criados: number }`

### PATCH /api/depositos/:id
- **Request:** inclui `formatoEnderecoId?: string`

### PATCH /api/zonas/:id
- **Request:** inclui `formatoEnderecoId?: string`

### POST /api/enderecamento-inteligente/distribuir
- **Request:** `DistribuirInput`
- **Response:** `DistribuicaoResult`

### POST /api/enderecamento-inteligente/confirmar
- **Request:** `ConfirmarInput`
- **Response:** `ConfirmarResponse`

---

## Error Handling

| Cenário | Comportamento |
|---------|--------------|
| CRUD formato retorna 4xx/5xx | Notificação vermelha com `error.response.data.message` |
| Resolver formato retorna 404 ou erro | Fallback: exibir todos os campos de faixa |
| Shelf life mínimo não definido (0 ou null) | Omitir validação, não exibir alerta |
| useDistribuicaoInteligente retorna erro | Mensagem informativa, permitir preenchimento manual |
| useDistribuicaoInteligente sem sugestões | Mensagem "Nenhuma sugestão disponível", campos manuais habilitados |
| useConfirmarDistribuicao falha | Notificação de erro, manter estado atual |
| Rede indisponível durante resolver | Fallback para todos os campos (retry: false) |

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Format table renders all items with required columns

*For any* array of FormatoEndereco objects returned by the API, the CRUD table SHALL render exactly one row per format, and each row SHALL display the format's nome, a representation of its active componentes, and its status.

**Validates: Requirements 1.2**

### Property 2: Format CRUD payload correctness

*For any* valid FormatoEndereco form data (nome with ≥1 char, at least one active component), submitting the create or edit form SHALL produce a POST or PUT request whose body contains the exact nome and componentes array from the form.

**Validates: Requirements 1.4, 1.5**

### Property 3: Format validation rejects invalid submissions

*For any* form state where the nome field is empty OR no component has `ativo: true`, the form SHALL prevent submission (submit button disabled or validation error shown) and no API request SHALL be made.

**Validates: Requirements 1.8**

### Property 4: API error messages propagate to notifications

*For any* API error response (4xx or 5xx) containing a message field, the system SHALL display a notification whose content includes that exact message string.

**Validates: Requirements 1.7**

### Property 5: Format Select renders all options and pre-selects current value

*For any* array of FormatoEndereco objects and any entity (depósito or zona) with a `formatoEnderecoId`, the Select component SHALL contain one option per format AND SHALL have the entity's current formatoEnderecoId pre-selected when in edit mode.

**Validates: Requirements 2.1, 2.3, 3.1, 3.3**

### Property 6: Entity save payload includes formatoEnderecoId

*For any* selected formatoEnderecoId value (including null for "no selection"), saving a depósito, zona, or generating addresses SHALL include that formatoEnderecoId in the request payload sent to the backend.

**Validates: Requirements 2.2, 3.2, 4.5**

### Property 7: Active component field visibility matches resolved format

*For any* FormatoEndereco configuration with a subset of components marked as `ativo: true`, the EnderecoAutoModal SHALL render range fields (início/fim) only for those active components, hiding fields for inactive components.

**Validates: Requirements 4.2**

### Property 8: Shelf life warning biconditional

*For any* pair of (dataVencimento, shelfLifeMinimo) where shelfLifeMinimo > 0, the warning alert SHALL be visible if and only if `calcularDiasRestantes(dataVencimento) < shelfLifeMinimo`. When visible, the alert message SHALL contain both the computed diasRestantes and the minimoExigido values.

**Validates: Requirements 5.1, 5.2, 5.3, 5.6**

### Property 9: Smart addressing suggestions populate destination fields

*For any* set of DistribuicaoResult allocations returned by useDistribuicaoInteligente, clicking "Aceitar Sugestões" SHALL set each item's destination address field to the corresponding suggested enderecoId from the allocations.

**Validates: Requirements 6.2, 6.3**

### Property 10: Confirm distribution sends correct payload

*For any* set of manually defined or accepted destination allocations, confirming the addressing SHALL call useConfirmarDistribuicao with a payload containing each item's produtoId, enderecoId, enderecoCompleto, and quantidadeAlocada matching the UI state.

**Validates: Requirements 6.7**
