'use client'

import { Checkbox, Group, Paper, SimpleGrid, TextInput } from '@mantine/core'

/** Limites de tamanho dos filtros de busca de cálculo (Req. 4.1). */
export const LIMITES_FILTRO_CALCULO = {
  clienteCodigo: 20,
  clienteNome: 200,
  linhaProduto: 120,
  produto: 200,
  descricao: 200,
  siglaAcabado: 60,
  numero: 9,
} as const

export interface FiltrosCalculoValores {
  clienteCodigo: string
  clienteNome: string
  semCliente: boolean
  linhaProduto: string
  produto: string
  descricao: string
  siglaAcabado: string
  numero: string
  cancelado: boolean
}

export function filtrosCalculoVazios(linhaInicial?: string | null): FiltrosCalculoValores {
  return {
    clienteCodigo: '',
    clienteNome: '',
    semCliente: false,
    linhaProduto: linhaInicial ?? '',
    produto: '',
    descricao: '',
    siglaAcabado: '',
    numero: '',
    cancelado: false,
  }
}

/** Valida o Nº do cálculo: só dígitos, 1 a 9 dígitos, maior que zero. Vazio é válido. */
export function validarNumeroCalculo(numero: string): string | null {
  if (numero === '') return null
  if (!/^\d{1,9}$/.test(numero)) return 'Informe de 1 a 9 dígitos, apenas números.'
  if (Number(numero) <= 0) return 'O número do cálculo deve ser maior que zero.'
  return null
}

/** Monta os parâmetros de GET /calculo-grafico; envia só o que foi preenchido. */
export function montarParamsBuscaCalculo(f: FiltrosCalculoValores): Record<string, string | number | boolean> {
  const p: Record<string, string | number | boolean> = {}
  if (f.semCliente) {
    p.semCliente = true
  } else {
    if (f.clienteCodigo.trim()) p.clienteCodigo = f.clienteCodigo.trim()
    if (f.clienteNome.trim()) p.clienteNome = f.clienteNome.trim()
  }
  if (f.linhaProduto.trim()) p.linhaProduto = f.linhaProduto.trim()
  if (f.produto.trim()) p.produto = f.produto.trim()
  if (f.descricao.trim()) p.descricao = f.descricao.trim()
  if (f.siglaAcabado.trim()) p.siglaAcabado = f.siglaAcabado.trim()
  if (f.numero !== '') p.numero = Number(f.numero)
  if (f.cancelado) p.cancelado = true
  return p
}

interface FiltrosCalculoProps {
  valores: FiltrosCalculoValores
  onChange: (proximo: FiltrosCalculoValores) => void
  /** Chamado ao pressionar Enter em algum campo. */
  onEnter?: () => void
  disabled?: boolean
}

export default function FiltrosCalculo({ valores, onChange, onEnter, disabled }: FiltrosCalculoProps) {
  const set = <K extends keyof FiltrosCalculoValores>(k: K, v: FiltrosCalculoValores[K]) =>
    onChange({ ...valores, [k]: v })

  const aoTeclar = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') onEnter?.()
  }

  const erroNumero = validarNumeroCalculo(valores.numero)

  return (
    <Paper p="sm" withBorder>
      <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="sm">
        <TextInput
          label="Código do cliente"
          value={valores.clienteCodigo}
          maxLength={LIMITES_FILTRO_CALCULO.clienteCodigo}
          disabled={disabled || valores.semCliente}
          onChange={(e) => set('clienteCodigo', e.currentTarget.value)}
          onKeyDown={aoTeclar}
        />
        <TextInput
          label="Nome do cliente"
          value={valores.clienteNome}
          maxLength={LIMITES_FILTRO_CALCULO.clienteNome}
          disabled={disabled || valores.semCliente}
          onChange={(e) => set('clienteNome', e.currentTarget.value)}
          onKeyDown={aoTeclar}
        />
        <TextInput
          label="Linha de Produto"
          value={valores.linhaProduto}
          maxLength={LIMITES_FILTRO_CALCULO.linhaProduto}
          disabled={disabled}
          onChange={(e) => set('linhaProduto', e.currentTarget.value)}
          onKeyDown={aoTeclar}
        />
        <TextInput
          label="Produto"
          value={valores.produto}
          maxLength={LIMITES_FILTRO_CALCULO.produto}
          disabled={disabled}
          onChange={(e) => set('produto', e.currentTarget.value)}
          onKeyDown={aoTeclar}
        />
        <TextInput
          label="Descrição"
          value={valores.descricao}
          maxLength={LIMITES_FILTRO_CALCULO.descricao}
          disabled={disabled}
          onChange={(e) => set('descricao', e.currentTarget.value)}
          onKeyDown={aoTeclar}
        />
        <TextInput
          label="Sigla Acabado"
          value={valores.siglaAcabado}
          maxLength={LIMITES_FILTRO_CALCULO.siglaAcabado}
          disabled={disabled}
          onChange={(e) => set('siglaAcabado', e.currentTarget.value)}
          onKeyDown={aoTeclar}
        />
        <TextInput
          label="Nº cálculo"
          value={valores.numero}
          maxLength={LIMITES_FILTRO_CALCULO.numero}
          inputMode="numeric"
          disabled={disabled}
          error={erroNumero}
          onChange={(e) => set('numero', e.currentTarget.value.replace(/\D/g, ''))}
          onKeyDown={aoTeclar}
        />
      </SimpleGrid>
      <Group mt="sm" gap="lg">
        <Checkbox
          label="Sem cliente definido"
          checked={valores.semCliente}
          disabled={disabled}
          onChange={(e) =>
            onChange({
              ...valores,
              semCliente: e.currentTarget.checked,
              clienteCodigo: e.currentTarget.checked ? '' : valores.clienteCodigo,
              clienteNome: e.currentTarget.checked ? '' : valores.clienteNome,
            })
          }
        />
        <Checkbox
          label="Cálculo cancelado"
          checked={valores.cancelado}
          disabled={disabled}
          onChange={(e) => set('cancelado', e.currentTarget.checked)}
        />
      </Group>
    </Paper>
  )
}
