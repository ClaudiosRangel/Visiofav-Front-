'use client'

import { useEffect, useState } from 'react'
import {
  Stack, Text, Checkbox, Paper, NumberInput, SimpleGrid, Group, Collapse, Badge,
  Loader, Center, TextInput, Alert, Select, ActionIcon, Tooltip, Box,
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
  // Layout em LINHA (densidade estilo planilha — pedido do usuário): os extras
  // (restrição/material/medida) ficam atrás da engrenagem, abertos por linha.
  const [extrasAbertos, setExtrasAbertos] = useState<Record<string, boolean>>({})
  const toggleExtras = (acabId: string) =>
    setExtrasAbertos((prev) => ({ ...prev, [acabId]: !prev[acabId] }))

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

  // Hidrata os acabamentos selecionados a partir do cadastro assim que ele
  // carrega. Faz DUAS coisas:
  //  1. Preenche o `acabamentoId` nos que vieram só por nome (ex.: cálculo puxado
  //     da biblioteca) — para o toggle/patch funcionarem e o payload sair correto.
  //  2. Completa `naturezaCusto` e os VALORES (custo/produção/tempos/preços) com
  //     os defaults do cadastro quando estão ausentes no item salvo — era por isso
  //     que, ao puxar o cálculo, o acabamento aparecia marcado mas VAZIO (só
  //     preenchia ao desmarcar/marcar, que recria o item com os defaults).
  useEffect(() => {
    if (cadastro.length === 0 || selecionados.length === 0) return
    const num = (v: unknown): number | undefined => (v == null || v === '' ? undefined : Number(v))
    let mudou = false
    const hidratados = selecionados.map((s) => {
      // Casa pelo id OU pelo nome (itens migrados podem não ter acabamentoId).
      const ac = cadastro.find((c) => c.id === s.acabamentoId) ||
        (s.nome ? cadastro.find((c) => norm(c.nome) === norm(s.nome!)) : undefined)
      if (!ac) return s

      const natureza = s.naturezaCusto ?? ac.naturezaCusto
      const prox: AcabamentoRicoSelecionado = { ...s, acabamentoId: ac.id, nome: s.nome ?? ac.nome, naturezaCusto: natureza }

      // Completa SÓ os campos ainda indefinidos (não sobrescreve o que o cálculo
      // já trouxe nem o que o usuário já ajustou).
      if (natureza === 'HORA_MAQUINA') {
        if (prox.custoHora == null) prox.custoHora = num(ac.custoHora)
        if (prox.producaoHora == null) prox.producaoHora = num(ac.producaoHora)
        if (prox.quantAcertos == null) prox.quantAcertos = num(ac.quantAcertos)
        if (prox.tempoPorAcertoMin == null) prox.tempoPorAcertoMin = num(ac.tempoPorAcertoMin)
        if (prox.tempoPrimeiroAcertoMin == null) prox.tempoPrimeiroAcertoMin = num(ac.tempoPrimeiroAcertoMin)
        if (prox.unidadeBase == null) prox.unidadeBase = (ac.unidadeBase as 'FOLHA' | 'PRODUTO') ?? 'FOLHA'
      } else if (natureza === 'MATERIAL_KG') {
        if (prox.precoKg == null) prox.precoKg = num(ac.precoUnitario)
      } else if (natureza === 'MATERIAL_UN') {
        if (prox.precoUn == null) prox.precoUn = num(ac.precoUnitario)
      } else if (natureza === 'CUSTO_FIXO') {
        if (prox.valorFixo == null) prox.valorFixo = num(ac.precoUnitario)
      }

      // Detecta se algo mudou (id, natureza ou algum valor completado).
      if (JSON.stringify(prox) !== JSON.stringify(s)) mudou = true
      return prox
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

  // Atualiza o acabamento casando por `acabamentoId` OU por NOME — itens vindos
  // de cálculo puxado podem não ter `acabamentoId` (gravados por nome), e antes
  // o patch só casava por id, então digitar nos campos não surtia efeito.
  const patch = (ac: AcabamentoCadastro, campo: keyof AcabamentoRicoSelecionado, valor: any) => {
    updateForm({
      acabamentosRicos: selecionados.map((s) =>
        s.acabamentoId === ac.id || (!s.acabamentoId && norm(s.nome ?? '') === norm(ac.nome))
          ? { ...s, acabamentoId: ac.id, [campo]: valor }
          : s,
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

      {/* Cabeçalho de colunas (densidade tipo planilha) — só na largura md+. */}
      {filtrados.length > 0 && (
        <Group gap="xs" px="xs" wrap="nowrap" visibleFrom="md" c="dimmed" style={{ fontSize: 11, fontWeight: 700 }}>
          <Box style={{ flex: 1, minWidth: 220 }}>Acabamento / Processo</Box>
          <Box w={110} ta="right">Custo/h</Box>
          <Box w={110} ta="right">Produção (un/h)</Box>
          <Box w={90} ta="right">Qtd. acertos</Box>
          <Box w={110} ta="right">Tempo/acerto</Box>
          <Box w={100} ta="right">1º acerto</Box>
          <Box w={32} />
        </Group>
      )}

      <Stack gap={4}>
        {filtrados.map((ac) => {
          const sel = selById.get(ac.id) ?? selByNome.get(norm(ac.nome))
          const ativo = !!sel
          const nb = naturezaBadge[ac.naturezaCusto]
          const temExtras =
            (restricoesPorAcab[ac.id]?.length ?? 0) > 0 ||
            (ac.restricoes?.length ?? 0) > 0 ||
            (ac.materiais?.length ?? 0) > 0 ||
            ac.exigeRestricao
          const extrasAberto = !!extrasAbertos[ac.id]
          // Campos numéricos sempre visíveis; desabilitados quando não selecionado
          // (cinza), habilitam ao marcar — pedido do usuário (sempre aberto).
          const dis = !ativo
          // Props comuns dos inputs numéricos da LINHA (compactos, sem label).
          const campo = (
            key: 'custoHora' | 'producaoHora' | 'quantAcertos' | 'tempoPorAcertoMin' | 'tempoPrimeiroAcertoMin',
            width: number,
            opts?: { prefix?: string; decimalScale?: number },
          ) => (
            <NumberInput
              w={width}
              size="xs"
              min={0}
              hideControls
              disabled={dis}
              prefix={opts?.prefix}
              decimalScale={opts?.decimalScale}
              value={sel?.[key] ?? ''}
              onChange={(v) => patch(ac, key, typeof v === 'number' ? v : undefined)}
              styles={{ input: { textAlign: 'right' } }}
            />
          )

          return (
            <Paper key={ac.id} px="xs" py={6} withBorder bg={ativo ? 'var(--mantine-color-default-hover)' : undefined}>
              {/* LINHA principal — tudo numa linha só (pedido do usuário). */}
              <Group gap="xs" wrap="nowrap" align="center">
                <Box style={{ flex: 1, minWidth: 220 }}>
                  <Checkbox
                    checked={ativo}
                    onChange={() => toggle(ac)}
                    label={
                      <Group gap={6} wrap="nowrap">
                        <Text size="sm" fw={500} lineClamp={1}>{ac.nome}</Text>
                        <Badge size="xs" variant="light" color={nb?.color}>{nb?.label}</Badge>
                      </Group>
                    }
                  />
                </Box>

                {/* HORA_MÁQUINA: os 5 campos clássicos na linha. */}
                {ac.naturezaCusto === 'HORA_MAQUINA' && (
                  <>
                    {campo('custoHora', 110, { prefix: 'R$ ', decimalScale: 2 })}
                    {campo('producaoHora', 110, { decimalScale: 2 })}
                    {campo('quantAcertos', 90)}
                    {campo('tempoPorAcertoMin', 110, { decimalScale: 2 })}
                    {campo('tempoPrimeiroAcertoMin', 100, { decimalScale: 2 })}
                  </>
                )}

                {/* MATERIAL/kg: Consumo + Preço ocupam 2 das colunas numéricas. */}
                {ac.naturezaCusto === 'MATERIAL_KG' && (
                  <>
                    <NumberInput w={110} size="xs" min={0} decimalScale={3} hideControls disabled={dis}
                      placeholder="Consumo kg" value={sel?.variavelKg ?? ''} styles={{ input: { textAlign: 'right' } }}
                      onChange={(v) => patch(ac, 'variavelKg', typeof v === 'number' ? v : undefined)} />
                    <NumberInput w={110} size="xs" min={0} decimalScale={4} hideControls disabled={dis} prefix="R$ "
                      placeholder="Preço/kg" value={sel?.precoKg ?? ''} styles={{ input: { textAlign: 'right' } }}
                      onChange={(v) => patch(ac, 'precoKg', typeof v === 'number' ? v : undefined)} />
                    <Box w={90} /><Box w={110} /><Box w={100} />
                  </>
                )}
                {ac.naturezaCusto === 'MATERIAL_UN' && (
                  <>
                    <NumberInput w={110} size="xs" min={0} decimalScale={2} hideControls disabled={dis}
                      placeholder="Consumo un" value={sel?.variavelUn ?? ''} styles={{ input: { textAlign: 'right' } }}
                      onChange={(v) => patch(ac, 'variavelUn', typeof v === 'number' ? v : undefined)} />
                    <NumberInput w={110} size="xs" min={0} decimalScale={4} hideControls disabled={dis} prefix="R$ "
                      placeholder="Preço/un" value={sel?.precoUn ?? ''} styles={{ input: { textAlign: 'right' } }}
                      onChange={(v) => patch(ac, 'precoUn', typeof v === 'number' ? v : undefined)} />
                    <Box w={90} /><Box w={110} /><Box w={100} />
                  </>
                )}
                {ac.naturezaCusto === 'CUSTO_FIXO' && (
                  <>
                    <NumberInput w={110} size="xs" min={0} decimalScale={2} hideControls disabled={dis} prefix="R$ "
                      placeholder="Valor fixo" value={sel?.valorFixo ?? ''} styles={{ input: { textAlign: 'right' } }}
                      onChange={(v) => patch(ac, 'valorFixo', typeof v === 'number' ? v : undefined)} />
                    <Box w={110} /><Box w={90} /><Box w={110} /><Box w={100} />
                  </>
                )}

                {/* Engrenagem — abre os extras (restrição/material/medida). Só
                    aparece quando a atividade tem extras; senão, espaço vazio
                    para manter o alinhamento das colunas. */}
                <Box w={32} ta="center">
                  {temExtras ? (
                    <Tooltip label="Restrição / material / medida" withinPortal>
                      <ActionIcon variant="subtle" color="gray" onClick={() => toggleExtras(ac.id)} aria-label="Mais opções">
                        <IconSettings size={16} />
                      </ActionIcon>
                    </Tooltip>
                  ) : null}
                </Box>
              </Group>

              {/* EXTRAS (restrição efetiva + descritivos informativos). Só quando
                  a engrenagem é aberta. Mantém TODO o comportamento anterior. */}
              {temExtras && (
                <Collapse in={extrasAberto}>
                  <Box mt={8} pt={8} style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
                    <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
                      {/* Restrição EFETIVA (ajusta o cálculo) — só HORA_MÁQUINA. */}
                      {ac.naturezaCusto === 'HORA_MAQUINA' && (restricoesPorAcab[ac.id]?.length ?? 0) > 0 && (
                        <Select
                          label="Restrição (sub-opção)"
                          description="Ajusta o acerto/operação"
                          placeholder="Selecione..."
                          size="xs"
                          clearable
                          disabled={dis}
                          data={(restricoesPorAcab[ac.id] || []).map((r) => ({ value: r.id, label: r.nome }))}
                          value={sel?.restricaoAcabamentoId ?? null}
                          onChange={(v) => patch(ac, 'restricaoAcabamentoId', v || undefined)}
                        />
                      )}
                      {/* Restrição/Material INFORMATIVOS (só descrição). */}
                      {(ac.restricoes?.length ?? 0) > 0 && (
                        <Select
                          label="Restrição (descrição)"
                          placeholder="Selecione..."
                          size="xs"
                          clearable
                          disabled={dis}
                          data={(ac.restricoes || []).map((r) => ({ value: r.nome, label: r.nome }))}
                          value={sel?.restricaoNome ?? null}
                          onChange={(v) => patch(ac, 'restricaoNome', v || undefined)}
                        />
                      )}
                      {(ac.materiais?.length ?? 0) > 0 && (
                        <Select
                          label="Material (descrição)"
                          placeholder="Selecione..."
                          size="xs"
                          clearable
                          disabled={dis}
                          data={(ac.materiais || []).map((m) => ({ value: m, label: m }))}
                          value={sel?.materialNome ?? null}
                          onChange={(v) => patch(ac, 'materialNome', v || undefined)}
                        />
                      )}
                      <NumberInput
                        label="Medida (mm)"
                        placeholder="Opcional"
                        size="xs"
                        min={0}
                        decimalScale={2}
                        disabled={dis}
                        value={sel?.medidaMm ?? ''}
                        onChange={(v) => patch(ac, 'medidaMm', typeof v === 'number' ? v : undefined)}
                      />
                    </SimpleGrid>

                    {sel && ac.exigeRestricao && !sel.restricaoAcabamentoId && (
                      <Alert icon={<IconAlertCircle size={16} />} color="red" mt="xs" p="xs">
                        <Text size="xs" fw={500}>Restrição obrigatória não escolhida</Text>
                        <Text size="xs">Este acabamento exige a escolha de uma sub-opção (restrição).</Text>
                      </Alert>
                    )}
                  </Box>
                </Collapse>
              )}
            </Paper>
          )
        })}
      </Stack>
    </Stack>
  )
}
