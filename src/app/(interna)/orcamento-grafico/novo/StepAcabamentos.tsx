'use client'

import { useEffect, useState } from 'react'
import {
  Stack, Text, Checkbox, Paper, NumberInput, SimpleGrid, Group, Collapse, Badge,
  Loader, Center, TextInput, Alert, Select,
} from '@mantine/core'
import { IconSettings, IconAlertCircle } from '@tabler/icons-react'
import { api } from '@/lib/api'
import type { WizardFormData, AcabamentoRicoSelecionado } from './page'

interface Props {
  formData: WizardFormData
  updateForm: (partial: Partial<WizardFormData>) => void
}

interface AcabamentoCadastro {
  id: string
  codigo: string
  nome: string
  naturezaCusto: 'HORA_MAQUINA' | 'MATERIAL_KG' | 'MATERIAL_UN' | 'CUSTO_FIXO'
  precoUnitario: number | null
  custoHora: number | null
  producaoHora: number | null
  quantAcertos: number | null
  tempoPorAcertoMin: number | null
  tempoPrimeiroAcertoMin: number | null
  unidadeBase: string | null
  exigeRestricao: boolean
  // P16 — materiais informativos por atividade (lista de nomes). Só texto.
  materiais?: string[] | null
  // P16 — restrições (nomes) vindas no próprio GET do acabamento.
  restricoes?: Array<{ id: string; nome: string }> | null
}

interface Restricao {
  id: string
  nome: string
}

const naturezaBadge: Record<string, { label: string; color: string }> = {
  HORA_MAQUINA: { label: 'Hora-máquina', color: 'orange' },
  MATERIAL_KG: { label: 'Material/kg', color: 'blue' },
  MATERIAL_UN: { label: 'Material/un', color: 'blue' },
  CUSTO_FIXO: { label: 'Custo fixo', color: 'grape' },
}

export default function StepAcabamentos({ formData, updateForm }: Props) {
  const [cadastro, setCadastro] = useState<AcabamentoCadastro[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  // Restrições (sub-opções) carregadas sob demanda, por acabamento HORA_MAQUINA.
  const [restricoesPorAcab, setRestricoesPorAcab] = useState<Record<string, Restricao[]>>({})

  useEffect(() => {
    // limit máx do backend é 100 (Zod). 200 fazia o Zod rejeitar (400) e a lista
    // ficava vazia ("Nenhum acabamento cadastrado"). A Wega tem ~67 acabamentos,
    // então 100 cobre tudo numa página.
    api.get('/orcamento-grafico/acabamentos', { params: { page: 1, limit: 100 } })
      .then(({ data }) => {
        // Os campos numéricos vêm como STRING do backend (Decimal do Prisma).
        // O schema Zod do /calcular espera number — por isso convertemos aqui,
        // senão o cálculo falha com "Expected number, received string".
        const num = (v: unknown): number | null =>
          v == null || v === '' ? null : Number(v)
        const items = (data.data || data || []).map((a: any) => ({
          ...a,
          precoUnitario: num(a.precoUnitario),
          custoHora: num(a.custoHora),
          producaoHora: num(a.producaoHora),
          quantAcertos: num(a.quantAcertos),
          tempoPorAcertoMin: num(a.tempoPorAcertoMin),
          tempoPrimeiroAcertoMin: num(a.tempoPrimeiroAcertoMin),
          exigeRestricao: !!a.exigeRestricao,
          // P16 — materiais informativos (lista de nomes) e restrições (nomes).
          materiais: Array.isArray(a.materiais) ? a.materiais : [],
          restricoes: Array.isArray(a.restricoes) ? a.restricoes : [],
        }))
        setCadastro(items)
      })
      .catch(() => setCadastro([]))
      .finally(() => setLoading(false))
  }, [])

  const selecionados = formData.acabamentosRicos
  const selById = new Map(selecionados.map((s) => [s.acabamentoId, s]))
  // Fallback por NOME: acabamentos salvos sem `acabamentoId` (ex.: seed/importação
  // que gravou por nome) não casavam com o cadastro e apareciam DESMARCADOS ao
  // editar. Mapeamos também por nome normalizado para marcar o checkbox correto.
  const norm = (s: string) => s.trim().toLowerCase()
  const selByNome = new Map(
    selecionados.filter((s) => !s.acabamentoId && s.nome).map((s) => [norm(s.nome!), s]),
  )

  // Hidrata o `acabamentoId` nos selecionados que vieram só por nome, assim que
  // o cadastro carrega — para o toggle/patch funcionarem e o payload sair correto.
  useEffect(() => {
    if (cadastro.length === 0 || selByNome.size === 0) return
    let mudou = false
    const hidratados = selecionados.map((s) => {
      if (s.acabamentoId || !s.nome) return s
      const ac = cadastro.find((c) => norm(c.nome) === norm(s.nome!))
      if (ac) {
        mudou = true
        return { ...s, acabamentoId: ac.id }
      }
      return s
    })
    if (mudou) updateForm({ acabamentosRicos: hidratados })
  }, [cadastro]) // eslint-disable-line react-hooks/exhaustive-deps

  // Carrega as restrições (sub-opções) de um acabamento sob demanda. Só busca
  // uma vez por acabamento e só para HORA_MAQUINA (os demais não têm restrição).
  const carregarRestricoes = (ac: AcabamentoCadastro) => {
    if (ac.naturezaCusto !== 'HORA_MAQUINA') return
    if (restricoesPorAcab[ac.id] !== undefined) return
    api.get(`/orcamento-grafico/acabamentos/${ac.id}/restricoes`)
      .then(({ data }) => {
        const lista: Restricao[] = (data.data || data || []).map((r: any) => ({ id: r.id, nome: r.nome }))
        setRestricoesPorAcab((prev) => ({ ...prev, [ac.id]: lista }))
      })
      .catch(() => setRestricoesPorAcab((prev) => ({ ...prev, [ac.id]: [] })))
  }

  // Ao reabrir o step (edição de item) já com acabamentos selecionados, carrega
  // as restrições dos HORA_MAQUINA já marcados para popular os Selects.
  useEffect(() => {
    selecionados.forEach((s) => {
      if (s.naturezaCusto === 'HORA_MAQUINA') {
        const ac = cadastro.find((c) => c.id === s.acabamentoId)
        if (ac) carregarRestricoes(ac)
      }
    })
  }, [cadastro]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (ac: AcabamentoCadastro) => {
    const jaSelecionado = selById.has(ac.id) || selByNome.has(norm(ac.nome))
    if (jaSelecionado) {
      // Remove casando por id OU por nome (cobre itens salvos sem acabamentoId).
      updateForm({
        acabamentosRicos: selecionados.filter(
          (s) => s.acabamentoId !== ac.id && norm(s.nome ?? '') !== norm(ac.nome),
        ),
      })
    } else {
      carregarRestricoes(ac)
      // O cadastro vem com Decimals serializados como STRING (ex.: custoHora "320").
      // O backend (Zod) espera number — converter com `num()` evita o erro
      // "Expected number, received string" no /calcular.
      const num = (v: unknown): number | undefined =>
        v == null || v === '' ? undefined : Number(v)
      const novo: AcabamentoRicoSelecionado = {
        acabamentoId: ac.id,
        nome: ac.nome,
        naturezaCusto: ac.naturezaCusto,
        // defaults a partir do cadastro (modo DERIVADO — tempos vêm do Calcgraf).
        // O usuário pode ajustar; se deixar como veio, o backend usa o cadastro.
        custoHora: num(ac.custoHora),
        producaoHora: num(ac.producaoHora),
        quantAcertos: num(ac.quantAcertos),
        tempoPorAcertoMin: num(ac.tempoPorAcertoMin),
        tempoPrimeiroAcertoMin: num(ac.tempoPrimeiroAcertoMin),
        unidadeBase: (ac.unidadeBase as 'FOLHA' | 'PRODUTO') ?? 'FOLHA',
      }
      updateForm({ acabamentosRicos: [...selecionados, novo] })
    }
  }

  const patch = (id: string, campo: keyof AcabamentoRicoSelecionado, valor: any) => {
    updateForm({
      acabamentosRicos: selecionados.map((s) =>
        s.acabamentoId === id ? { ...s, [campo]: valor } : s,
      ),
    })
  }

  const filtrados = busca.trim()
    ? cadastro.filter((a) => `${a.codigo} ${a.nome}`.toLowerCase().includes(busca.toLowerCase()))
    : cadastro

  if (loading) return <Center py="xl"><Loader /></Center>

  return (
    <Stack gap="md">
      <Text fw={600} size="lg">Acabamentos</Text>
      <Text size="sm" c="dimmed">
        Selecione os acabamentos do orçamento e informe os consumos/tempos. A lista vem do cadastro de Acabamentos.
      </Text>

      {cadastro.length === 0 && (
        <Alert icon={<IconAlertCircle size={16} />} color="yellow">
          Nenhum acabamento cadastrado. Cadastre em Orçamento Gráfico → Cadastros → Acabamentos
          (ou importe do Calcgraf). Você pode seguir sem acabamentos.
        </Alert>
      )}

      {cadastro.length > 0 && (
        <TextInput
          placeholder="Buscar acabamento..."
          value={busca}
          onChange={(e) => setBusca(e.currentTarget.value)}
        />
      )}

      <Stack gap="sm">
        {filtrados.map((ac) => {
          const sel = selById.get(ac.id) ?? selByNome.get(norm(ac.nome))
          const ativo = !!sel
          const nb = naturezaBadge[ac.naturezaCusto]
          return (
            <Paper key={ac.id} p="md" withBorder>
              <Stack gap="sm">
                <Group justify="space-between">
                  <Checkbox
                    label={
                      <Group gap="xs">
                        <Text fw={500}>{ac.nome}</Text>
                        <Badge size="xs" variant="light" color={nb?.color}>{nb?.label}</Badge>
                      </Group>
                    }
                    checked={ativo}
                    onChange={() => toggle(ac)}
                  />
                  {ativo && <IconSettings size={16} color="gray" />}
                </Group>

                <Collapse in={ativo}>
                  {sel && (
                    <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm" mt="xs">
                      {sel.naturezaCusto === 'MATERIAL_KG' && (
                        <>
                          <NumberInput label="Consumo (kg)" value={sel.variavelKg ?? ''} min={0} decimalScale={3} size="xs"
                            onChange={(v) => patch(ac.id, 'variavelKg', typeof v === 'number' ? v : undefined)} />
                          <NumberInput label="Preço/kg (R$)" value={sel.precoKg ?? ''} min={0} decimalScale={4} size="xs"
                            onChange={(v) => patch(ac.id, 'precoKg', typeof v === 'number' ? v : undefined)} />
                        </>
                      )}
                      {sel.naturezaCusto === 'MATERIAL_UN' && (
                        <>
                          <NumberInput label="Consumo (un)" value={sel.variavelUn ?? ''} min={0} decimalScale={2} size="xs"
                            onChange={(v) => patch(ac.id, 'variavelUn', typeof v === 'number' ? v : undefined)} />
                          <NumberInput label="Preço/un (R$)" value={sel.precoUn ?? ''} min={0} decimalScale={4} size="xs"
                            onChange={(v) => patch(ac.id, 'precoUn', typeof v === 'number' ? v : undefined)} />
                        </>
                      )}
                      {sel.naturezaCusto === 'CUSTO_FIXO' && (
                        <NumberInput label="Valor fixo (R$)" value={sel.valorFixo ?? ''} min={0} decimalScale={2} size="xs"
                          onChange={(v) => patch(ac.id, 'valorFixo', typeof v === 'number' ? v : undefined)} />
                      )}
                      {sel.naturezaCusto === 'HORA_MAQUINA' && (
                        <>
                          <NumberInput label="Custo/hora" prefix="R$ " value={sel.custoHora ?? ''} min={0} decimalScale={2} size="xs"
                            onChange={(v) => patch(ac.id, 'custoHora', typeof v === 'number' ? v : undefined)} />
                          <NumberInput label="Produção (un/h)" description="Do cadastro" value={sel.producaoHora ?? ''} min={0} decimalScale={2} size="xs"
                            onChange={(v) => patch(ac.id, 'producaoHora', typeof v === 'number' ? v : undefined)} />
                          <NumberInput label="Qtd. acertos" value={sel.quantAcertos ?? ''} min={0} size="xs"
                            onChange={(v) => patch(ac.id, 'quantAcertos', typeof v === 'number' ? v : undefined)} />
                          <NumberInput label="Tempo/acerto (min)" value={sel.tempoPorAcertoMin ?? ''} min={0} decimalScale={2} size="xs"
                            onChange={(v) => patch(ac.id, 'tempoPorAcertoMin', typeof v === 'number' ? v : undefined)} />
                          <NumberInput label="1º acerto (min)" value={sel.tempoPrimeiroAcertoMin ?? ''} min={0} decimalScale={2} size="xs"
                            onChange={(v) => patch(ac.id, 'tempoPrimeiroAcertoMin', typeof v === 'number' ? v : undefined)} />
                          {(restricoesPorAcab[ac.id]?.length ?? 0) > 0 && (
                            <Select
                              label="Restrição (sub-opção)"
                              description="Ajusta o acerto/operação deste acabamento"
                              placeholder="Selecione..."
                              size="xs"
                              clearable
                              data={(restricoesPorAcab[ac.id] || []).map((r) => ({ value: r.id, label: r.nome }))}
                              value={sel.restricaoAcabamentoId ?? null}
                              onChange={(v) => patch(ac.id, 'restricaoAcabamentoId', v || undefined)}
                            />
                          )}
                        </>
                      )}
                    </SimpleGrid>
                  )}

                  {sel && ac.exigeRestricao && !sel.restricaoAcabamentoId && (
                    <Alert icon={<IconAlertCircle size={16} />} color="red" mt="xs" p="xs">
                      <Text size="xs" fw={500}>Restrição obrigatória não escolhida</Text>
                      <Text size="xs">Este acabamento exige a escolha de uma sub-opção (restrição).</Text>
                    </Alert>
                  )}

                  {/* P16 — Restrição/Material/Medida INFORMATIVOS (texto, sem
                      efeito no cálculo). Só aparece quando a atividade tem
                      restrições e/ou materiais cadastrados. */}
                  {sel && ((ac.restricoes?.length ?? 0) > 0 || (ac.materiais?.length ?? 0) > 0) && (
                    <Paper p="xs" withBorder mt="xs" bg="var(--mantine-color-default-hover)">
                      <Text size="xs" fw={500} mb={4}>Descrição do acabamento (informativo)</Text>
                      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
                        {(ac.restricoes?.length ?? 0) > 0 && (
                          <Select
                            label="Restrição"
                            description="Sub-opção (só descrição)"
                            placeholder="Selecione..."
                            size="xs"
                            clearable
                            data={(ac.restricoes || []).map((r) => ({ value: r.nome, label: r.nome }))}
                            value={sel.restricaoNome ?? null}
                            onChange={(v) => patch(ac.id, 'restricaoNome', v || undefined)}
                          />
                        )}
                        {(ac.materiais?.length ?? 0) > 0 && (
                          <Select
                            label="Material"
                            description="Material (só descrição)"
                            placeholder="Selecione..."
                            size="xs"
                            clearable
                            data={(ac.materiais || []).map((m) => ({ value: m, label: m }))}
                            value={sel.materialNome ?? null}
                            onChange={(v) => patch(ac.id, 'materialNome', v || undefined)}
                          />
                        )}
                        <NumberInput
                          label="Medida em mm"
                          placeholder="Opcional"
                          size="xs"
                          min={0}
                          decimalScale={2}
                          value={sel.medidaMm ?? ''}
                          onChange={(v) => patch(ac.id, 'medidaMm', typeof v === 'number' ? v : undefined)}
                        />
                      </SimpleGrid>
                    </Paper>
                  )}
                </Collapse>
              </Stack>
            </Paper>
          )
        })}
      </Stack>
    </Stack>
  )
}
