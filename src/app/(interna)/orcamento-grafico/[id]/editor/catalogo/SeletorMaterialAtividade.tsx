'use client'

/**
 * SeletorMaterialAtividade — escolha do material permitido de uma atividade marcada
 * (Fase 2, tarefa 4.5). Mostra os materiais do catálogo (padrão pré-selecionado ao
 * marcar), os parâmetros do `tipoParam`, o resumo de consumo/custo e o aviso
 * "a verificar". A gravação fica com o `useSelecaoMaterial` (via `onEscolher`/`onLimpar`).
 */

import { useEffect, useMemo, useState } from 'react'
import { Alert, Group, Loader, NumberInput, Select, Stack, Text } from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'

import type {
  AtividadeCatalogoPlano,
  SelecaoMaterial,
} from '../../../cadastros/_shared/cadastros-graficos.types'
import type { SelecaoPendente } from './catalogo.types'
import AvisoAVerificar from './AvisoAVerificar'
import {
  camposParametroMaterial,
  ordenarPorCatalogo,
  paramsPadraoMaterial,
  tipoParamDoMaterial,
  type ErroSelecaoMaterial,
} from './catalogo-puro'

interface Props {
  atividade: AtividadeCatalogoPlano
  /** Seleção gravada do item (item salvo). */
  selecao?: SelecaoMaterial
  /** Escolha guardada antes do primeiro salvamento (item novo). */
  pendente?: SelecaoPendente
  erro?: ErroSelecaoMaterial | null
  itemPuxado: boolean
  ocupado: boolean
  disabled?: boolean
  /** Texto da escolha pendente (padrão: "Será gravado ao salvar o item"). O modal de plano usa o próprio. */
  rotuloPendente?: string
  onEscolher: (escolha: Omit<SelecaoPendente, 'acabamentoId'>) => void
  onLimpar: () => void
}

const moeda = (v: number | null | undefined) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const numero = (v: number | null | undefined) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { maximumFractionDigits: 3 })

export default function SeletorMaterialAtividade({
  atividade,
  selecao,
  pendente,
  erro,
  itemPuxado,
  ocupado,
  disabled,
  rotuloPendente,
  onEscolher,
  onLimpar,
}: Props) {
  const materiais = useMemo(() => ordenarPorCatalogo(atividade.materiais ?? []), [atividade.materiais])
  const atual = selecao ?? pendente

  const [materialId, setMaterialId] = useState<string | null>(atual?.materialId ?? null)
  const [param1, setParam1] = useState<number | string>(atual?.param1 ?? '')
  const [param2, setParam2] = useState<number | string>(atual?.param2 ?? '')
  const [gramatura, setGramatura] = useState<number | string>(pendente?.gramaturaKgM2 ?? '')
  const [pecas, setPecas] = useState<number | string>(pendente?.pecasPorCaixa ?? '')

  useEffect(() => {
    setMaterialId(atual?.materialId ?? null)
    setParam1(atual?.param1 ?? '')
    setParam2(atual?.param2 ?? '')
    // Erro (ex.: 422) volta o campo para a seleção anterior, que não foi alterada.
  }, [atual?.materialId, atual?.param1, atual?.param2, erro])

  const material = materiais.find((m) => m.id === materialId) ?? null
  const tipoParam = material ? tipoParamDoMaterial(material) : 2
  const campos = camposParametroMaterial(tipoParam, material?.unidadeCusto)
  const num = (v: number | string) => (typeof v === 'number' ? v : null)

  const gravar = (id: string, extra?: Partial<{ p1: number | null; p2: number | null; g: number | null; pc: number | null }>) => {
    const m = materiais.find((x) => x.id === id)
    if (!m) return
    const tp = tipoParamDoMaterial(m)
    onEscolher({
      materialId: id,
      tipoParam: tp,
      param1: extra?.p1 !== undefined ? extra.p1 : num(param1),
      param2: extra?.p2 !== undefined ? extra.p2 : num(param2),
      gramaturaKgM2: extra?.g !== undefined ? extra.g : num(gramatura),
      pecasPorCaixa: extra?.pc !== undefined ? extra.pc : num(pecas),
    })
  }

  const trocarMaterial = (id: string | null) => {
    if (!id) {
      setMaterialId(null)
      onLimpar()
      return
    }
    const m = materiais.find((x) => x.id === id)
    const padroes = paramsPadraoMaterial(tipoParamDoMaterial(m))
    setMaterialId(id)
    setParam1(padroes.param1 ?? '')
    setParam2(padroes.param2 ?? '')
    gravar(id, { p1: padroes.param1, p2: padroes.param2 })
  }

  const confirmarParametros = () => {
    if (materialId) gravar(materialId)
  }

  if (materiais.length === 0) return null

  return (
    <Stack gap={6} style={{ gridColumn: '1 / -1' }}>
      <Group gap="xs" align="flex-end" wrap="wrap">
        <Select
          label="Material"
          description={pendente && !selecao ? (rotuloPendente ?? 'Será gravado ao salvar o item') : undefined}
          placeholder="Selecione o material..."
          size="xs"
          clearable
          disabled={disabled || ocupado}
          data={materiais.map((m) => ({ value: m.id, label: m.nome }))}
          value={materialId}
          onChange={trocarMaterial}
          style={{ minWidth: 240, flex: 1 }}
          comboboxProps={{ withinPortal: true }}
        />
        {campos.param1 && (
          <NumberInput
            label={campos.param1}
            size="xs"
            w={120}
            min={0}
            decimalScale={2}
            hideControls
            disabled={disabled || ocupado}
            value={param1}
            onChange={setParam1}
            onBlur={confirmarParametros}
          />
        )}
        {campos.param2 && (
          <NumberInput
            label={campos.param2}
            size="xs"
            w={120}
            min={0}
            decimalScale={2}
            hideControls
            disabled={disabled || ocupado}
            value={param2}
            onChange={setParam2}
            onBlur={confirmarParametros}
          />
        )}
        {campos.gramaturaKgM2 && (
          <NumberInput
            label="Gramatura (kg/m²)"
            size="xs"
            w={140}
            min={0}
            decimalScale={4}
            hideControls
            disabled={disabled || ocupado}
            value={gramatura}
            onChange={setGramatura}
            onBlur={confirmarParametros}
          />
        )}
        {campos.pecasPorCaixa && (
          <NumberInput
            label="Peças por caixa"
            size="xs"
            w={130}
            min={0}
            decimalScale={0}
            hideControls
            disabled={disabled || ocupado}
            value={pecas}
            onChange={setPecas}
            onBlur={confirmarParametros}
          />
        )}
        {ocupado && <Loader size="xs" />}
      </Group>

      {selecao && (
        <Group gap="xs" wrap="wrap">
          <Text size="xs" c="dimmed">
            Consumo: {numero(selecao.consumo)} {selecao.unidadeConsumo ?? ''}
          </Text>
          <Text size="xs" c="dimmed">Valor unitário: {moeda(selecao.valorUnitario)}</Text>
          <Text size="xs" fw={600}>Custo: {moeda(selecao.custo)}</Text>
          <AvisoAVerificar situacao={selecao.situacaoParametro} />
          {itemPuxado && <AvisoAVerificar informativo />}
        </Group>
      )}

      {erro && (
        <Alert icon={<IconAlertCircle size={14} />} color="red" p="xs">
          <Text size="xs">{erro.mensagem}</Text>
          {erro.permitidos.length > 0 && (
            <Text size="xs" mt={2}>Permitidos: {erro.permitidos.join(', ')}</Text>
          )}
        </Alert>
      )}
    </Stack>
  )
}
