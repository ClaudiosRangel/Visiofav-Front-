'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  Stack, Text, NumberInput, Group, Paper, SimpleGrid, Table, Loader,
  Center, Alert, Badge, Divider, Progress, Select, Button,
} from '@mantine/core'
import { IconCalculator, IconAlertCircle, IconChartPie, IconDownload } from '@tabler/icons-react'
import { api } from '@/lib/api'
import type { WizardFormData } from './page'
import EncaixeVisual, { type EncaixeLayout } from './EncaixeVisual'
import { gerarPlanificacao, type GabaritoId } from './planificacao-gabaritos'

/**
 * Gera uma string SVG do encaixe (imposição das peças na folha) a partir do
 * layout calculado pelo motor, para download client-side como documentação de
 * consulta — espelha o desenho do `EncaixeVisual`, mas sem depender de item
 * persistido (no wizard o orçamento ainda não tem id salvo).
 */
function encaixeParaSvgString(layout: EncaixeLayout, legenda?: string): string {
  const W = 300
  const escala = W / layout.folhaLarguraMm
  const H = Math.round(layout.folhaAlturaMm * escala)
  const pincaH = layout.pincaMm * escala
  const pw = layout.pecaLarguraMm * escala
  const ph = layout.pecaAlturaMm * escala
  const offsetX = pincaH

  const pecas: string[] = []
  for (let c = 0; c < layout.colunas; c++) {
    for (let l = 0; l < layout.linhas; l++) {
      const x = (offsetX + c * pw + 0.5).toFixed(2)
      const y = (l * ph + 0.5).toFixed(2)
      const w = Math.max(0, pw - 1).toFixed(2)
      const h = Math.max(0, ph - 1).toFixed(2)
      pecas.push(
        `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#4dabf7" opacity="0.75" stroke="#1971c2" stroke-width="0.4"/>`,
      )
    }
  }

  const total = layout.colunas * layout.linhas
  const rodape =
    legenda ??
    `Folha ${layout.folhaLarguraMm} x ${layout.folhaAlturaMm} mm · peca ${layout.pecaLarguraMm} x ${layout.pecaAlturaMm} mm · ${total} pecas/folha`

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H + 20}" viewBox="0 0 ${W} ${H + 20}">`,
    `<rect x="0" y="0" width="${W}" height="${H}" fill="#f8f9fa" stroke="#adb5bd" stroke-width="0.8"/>`,
    pincaH > 0
      ? `<rect x="0" y="0" width="${pincaH.toFixed(2)}" height="${H}" fill="#dee2e6" opacity="0.6"/>`
      : '',
    pecas.join(''),
    `<text x="2" y="${H + 14}" font-family="sans-serif" font-size="9" fill="#495057">${rodape}</text>`,
    `</svg>`,
  ].join('')
}

function baixarSvgEncaixe(layout: EncaixeLayout, nomeArquivo: string, legenda?: string) {
  const svg = encaixeParaSvgString(layout, legenda)
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

interface Props {
  formData: WizardFormData
  updateForm: (partial: Partial<WizardFormData>) => void
}

interface Resultado {
  encaixe?: {
    aproveitamento?: number
    percentAproveitamentoFolha?: number
    orientacao?: 'NORMAL' | 'ROTACIONADA'
    layout?: EncaixeLayout
  }
  papel?: { pesoKg: number; custo: number }
  tinta?: { custoTotal: number; detalhePorCor?: Array<{ cor: string; consumoKg: number; custo: number }> }
  maquinas?: { custoTotal: number; detalhePorEtapa?: Array<{ etapa: string; tempoMin: number; custo: number }> }
  acabamentos?: { custoTotal: number; detalhePorAcabamento?: Array<{ tipo: string; custo: number }> }
  // Paridade Calcgraf: cadeia de centros de acabamento (CT) + materiais (MD).
  acabamentosCentros?: { custoTotal: number; detalhePorEtapa?: Array<{ etapa: string; setupMin: number; operacaoMin: number; custo: number }> }
  matAcabamento?: { custoTotal: number; itens?: Array<{ nome: string; natureza: string; subtotal: number }> }
  custoTotal?: number
  precoVenda?: number
  precoUnitario?: number
  margemReal?: number
  breakdown?: { papel: number; tinta: number; maquina: number; acabamento: number; overhead: number }
  // Paridade Calcgraf (decomposição estilo memória de cálculo)
  materialDireto?: number
  custoTransformacao?: number
  servicoExterno?: number
  custoProducao?: number
  cevPerc?: number
  cevValor?: number
  contribuicaoMarginalValor?: number
  contribuicaoMarginalPerc?: number
}

interface Simulacao {
  quantidade: number
  precoUnitario: number
  precoTotal: number
  custoTotal: number
}

interface Conferencia {
  numeroCalcgraf: number | null
  // Fonte da conferência: CALCULO_STC = decomposição real por componente
  // (bate item a item com o Calcgraf); MOTOR = recálculo cru do motor Vizor.
  fonte?: 'CALCULO_STC' | 'MOTOR'
  foto: { custoProducao: number; valorTotal: number }
  vizor: { custoProducao: number | null; valorTotal: number | null } | null
  desvio: { custoPercent: number | null; valorPercent: number | null; totalPercent: number | null }
  confere: boolean
  alerta: string | null
}

export default function StepRevisao({ formData, updateForm }: Props) {
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [simulacoes, setSimulacoes] = useState<Simulacao[]>([])
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  // Conferência foto × recálculo (spec orcamento-repeticao-engenharia-completa).
  const [conferencia, setConferencia] = useState<Conferencia | null>(null)
  // Máquinas de impressão (paridade Calcgraf: o acerto-por-cor é por máquina).
  const [maquinas, setMaquinas] = useState<{ value: string; label: string }[]>([])

  useEffect(() => {
    api.get('/centros-producao', { params: { limit: 100 } })
      .then(({ data }) => {
        const items = (data.data || data || [])
          .filter((c: any) => c?.tipoProcesso?.codigo === 'IMPRESSAO' || /impress/i.test(c?.tipoProcesso?.descricao || ''))
          .map((c: any) => ({ value: c.id, label: `${c.codigo} - ${c.descricao}` }))
        setMaquinas(items)
      })
      .catch(() => setMaquinas([]))
  }, [])

  // Conferência foto × recálculo: só quando o item veio de um cálculo da
  // biblioteca (edição de repetição). Compara o valor original do Calcgraf com o
  // recálculo do Vizor; a FOTO nunca é alterada.
  const orcId = formData._conferenciaOrcamentoId
  const itemId = formData._conferenciaItemId
  useEffect(() => {
    if (!orcId || !itemId) { setConferencia(null); return }
    api.get(`/orcamento-grafico/${orcId}/itens/${itemId}/conferencia`)
      .then(({ data }) => setConferencia(data))
      .catch(() => setConferencia(null))
  }, [orcId, itemId])

  // Planificação esquemática (contorno da caixa aberta) do gabarito do tipo de
  // embalagem selecionado. Null quando o tipo não tem gabarito (→ retângulo).
  const planificacao = useMemo(() => {
    const tipo = formData.tipoEmbalagem as { gabaritoPlanificacao?: string | null } | null
    const gab = (tipo?.gabaritoPlanificacao || '').toUpperCase()
    if (!gab || gab === 'RETANGULO') return null
    const m = (formData.medidas || {}) as Record<string, number>
    // As chaves de `medidas` vêm do cadastro do tipo (param.nome), que pode usar
    // L/A/P OU nomes por extenso (largura/altura/profundidade/comprimento).
    // Buscamos por aliases comuns (case-insensitive) para não depender da convenção.
    const pick = (...aliases: string[]): number => {
      for (const a of aliases) {
        for (const k of Object.keys(m)) {
          if (k.toLowerCase() === a.toLowerCase() && Number(m[k]) > 0) return Number(m[k])
        }
      }
      return 0
    }
    const L = pick('L', 'largura', 'comprimento', 'c')
    const A = pick('A', 'altura', 'h')
    const P = pick('P', 'profundidade', 'prof', 'espessura', 'e')
    if (L <= 0 || A <= 0) return null
    return gerarPlanificacao({
      gabarito: gab as GabaritoId,
      L, A, P,
      abaMm: Number(formData.tipoEmbalagem?.abaColagemMm) || undefined,
      sangriaMm: Number(formData.tipoEmbalagem?.sangriaMm) || undefined,
    })
  }, [formData.tipoEmbalagem, formData.medidas])

  const calcular = useCallback(async () => {
    if (formData.quantidade <= 0) return

    setLoading(true)
    setErro(null)
    try {
      const acabamentosAtivos = formData.acabamentos
        .filter(a => a.ativo)
        .map(a => ({ tipo: a.tipo, custoHora: a.custoHora, velocidade: a.velocidade, custoMaterialM2: a.custoMaterialM2 }))

      const payload = {
        tipoEmbalagemId: formData.tipoEmbalagemId,
        medidas: formData.medidas,
        suporteId: formData.suporteId || undefined,
        papelId: formData.papelId || undefined,
        gramatura: formData.gramatura,
        precoKg: formData.precoKg,
        cores: formData.cores.map(c => ({
          nome: c.nome,
          tipo: c.tipo,
          coberturaPercent: c.coberturaPercent,
          precoKg: c.precoKg,
          rendimentoM2Kg: c.rendimentoM2Kg,
        })),
        acabamentos: acabamentosAtivos,
        acabamentosRicos: formData.acabamentosRicos?.length ? formData.acabamentosRicos : undefined,
        quantidade: formData.quantidade,
        tabelaMargemId: formData.tabelaMargemId || undefined,
        maquinaId: formData.maquinaId || undefined,
        aproveitamentoManual: formData.aproveitamentoManual || undefined,
        // Formato de corte (folha real do Calcgraf) — para a prévia bater com o
        // orçamento salvo. O preço do papel é resolvido no backend pelo papelId.
        formatoCorteLarguraMm: formData.formatoCorteLarguraMm || undefined,
        formatoCorteAlturaMm: formData.formatoCorteAlturaMm || undefined,
      }

      // Item de repetição (puxado de um cálculo): usa a rota do ITEM, que ANCORA
      // o custo no valor real do Calcgraf (diferença zero). A rota /calcular
      // genérica (sem itemId) recalcularia pelo motor e divergiria ~5%.
      let data: Resultado
      if (orcId && itemId) {
        const resp = await api.post(`/orcamento-grafico/${orcId}/itens/${itemId}/calcular`, payload)
        data = (resp.data?.resultado ?? resp.data) as Resultado
      } else {
        const resp = await api.post('/orcamento-grafico/calcular', payload)
        data = resp.data as Resultado
      }
      setResultado(data)
    } catch (err: any) {
      // O backend já compõe `message` com os campos que falharam. Como reforço,
      // se vier o array `issues` (erro de validação), montamos "campo: motivo"
      // para o operador saber exatamente o que corrigir (em vez do genérico).
      const resp = err?.response?.data
      const issues = Array.isArray(resp?.issues) ? resp.issues : []
      const detalhe = issues.length
        ? issues
            .map((i: { campo?: string; mensagem?: string }) =>
              i.campo ? `${i.campo}: ${i.mensagem}` : i.mensagem,
            )
            .filter(Boolean)
            .join('\n')
        : ''
      setErro(detalhe || resp?.message || 'Erro ao calcular orçamento.')
      setResultado(null)
    } finally {
      setLoading(false)
    }
  }, [formData])

  const simularTiragens = useCallback(async () => {
    try {
      const acabamentosAtivos = formData.acabamentos
        .filter(a => a.ativo)
        .map(a => ({ tipo: a.tipo, custoHora: a.custoHora, velocidade: a.velocidade, custoMaterialM2: a.custoMaterialM2 }))

      const quantidades = [
        Math.max(1000, Math.round(formData.quantidade * 0.5)),
        formData.quantidade,
        Math.round(formData.quantidade * 2),
        Math.round(formData.quantidade * 5),
        Math.round(formData.quantidade * 10),
      ]

      const payload = {
        tipoEmbalagemId: formData.tipoEmbalagemId,
        medidas: formData.medidas,
        suporteId: formData.suporteId || undefined,
        papelId: formData.papelId || undefined,
        gramatura: formData.gramatura,
        precoKg: formData.precoKg,
        cores: formData.cores.map(c => ({
          nome: c.nome,
          tipo: c.tipo,
          coberturaPercent: c.coberturaPercent,
          precoKg: c.precoKg,
          rendimentoM2Kg: c.rendimentoM2Kg,
        })),
        acabamentos: acabamentosAtivos,
        acabamentosRicos: formData.acabamentosRicos?.length ? formData.acabamentosRicos : undefined,
        quantidades,
        tabelaMargemId: formData.tabelaMargemId || undefined,
        maquinaId: formData.maquinaId || undefined,
        aproveitamentoManual: formData.aproveitamentoManual || undefined,
      }

      const { data } = await api.post('/orcamento-grafico/simular-tiragens', payload)
      setSimulacoes(Array.isArray(data) ? data : data.simulacoes || [])
    } catch {
      setSimulacoes([])
    }
  }, [formData])

  // Calcular ao carregar e quando quantidade / máquina / imposição mudam
  useEffect(() => {
    calcular()
    simularTiragens()
  }, [formData.quantidade, formData.maquinaId, formData.aproveitamentoManual]) // eslint-disable-line react-hooks/exhaustive-deps

  const formatCurrency = (val: number | undefined) =>
    val != null ? `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'

  const formatPercent = (val: number | undefined) =>
    val != null ? `${val.toFixed(1)}%` : '—'

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <div>
          <Text fw={600} size="lg">Revisão e Preço</Text>
          <Text size="sm" c="dimmed">
            Confira o breakdown de custos e ajuste a tiragem.
          </Text>
        </div>
        <Group align="flex-end" gap="sm">
          <Select
            label="Máquina de impressão"
            placeholder="Padrão (1ª de impressão)"
            data={maquinas}
            value={formData.maquinaId || null}
            onChange={(v) => updateForm({ maquinaId: v })}
            clearable
            searchable
            w={240}
          />
          <NumberInput
            label="Peças/folha"
            description="Imposição real (opcional)"
            placeholder="auto"
            value={formData.aproveitamentoManual || ''}
            onChange={(val) => updateForm({ aproveitamentoManual: typeof val === 'number' ? val : null })}
            min={1}
            w={130}
          />
          <NumberInput
            label="Tiragem"
            value={formData.quantidade}
            onChange={(val) => updateForm({ quantidade: typeof val === 'number' ? val : 0 })}
            min={1}
            w={160}
            thousandSeparator="."
            decimalSeparator=","
          />
        </Group>
      </Group>

      {loading && (
        <Center py="xl"><Loader size="lg" /></Center>
      )}

      {erro && (
        <Alert icon={<IconAlertCircle size={16} />} color="red" title="Corrija os dados do item">
          <Text size="sm" style={{ whiteSpace: 'pre-line' }}>{erro}</Text>
        </Alert>
      )}

      {formData.produtoId && (
        <Alert color="blue" variant="light" title="Repetição de produto">
          Este orçamento é uma repetição do produto <strong>{formData.produtoNome}</strong>.
          A OP usará a estrutura (BOM) e o roteiro cadastrados dele.
        </Alert>
      )}

      {/* Conferência FOTO (Calcgraf) × RECÁLCULO (Vizor) — anti-vergonha.
          spec orcamento-repeticao-engenharia-completa (Req 6). */}
      {conferencia && (
        <Alert
          color={conferencia.confere ? 'green' : 'orange'}
          variant="light"
          title={
            conferencia.confere
              ? `Confere com o Calcgraf${conferencia.numeroCalcgraf ? ` (cálculo ${conferencia.numeroCalcgraf})` : ''}`
              : 'Atenção: divergência com o Calcgraf'
          }
        >
          <Stack gap={4}>
            <Group gap="xl">
              <Text size="sm">
                <strong>Calcgraf (foto):</strong> {formatCurrency(conferencia.foto.valorTotal)}
                {' · C.Prod '}{formatCurrency(conferencia.foto.custoProducao)}
              </Text>
              {conferencia.vizor && (
                <Text size="sm">
                  <strong>{conferencia.fonte === 'CALCULO_STC' ? 'Vizor (decomposição):' : 'Vizor (recálculo):'}</strong>{' '}
                  {formatCurrency(conferencia.vizor.valorTotal ?? undefined)}
                  {' · C.Prod '}{formatCurrency(conferencia.vizor.custoProducao ?? undefined)}
                </Text>
              )}
              {conferencia.desvio.totalPercent != null && (
                <Badge color={conferencia.confere ? 'green' : 'orange'}>
                  Desvio {conferencia.desvio.totalPercent.toFixed(2)}%
                </Badge>
              )}
            </Group>
            {conferencia.alerta && <Text size="xs" c="dimmed">{conferencia.alerta}</Text>}
            {conferencia.confere ? (
              <Text size="xs" c="dimmed">
                {conferencia.fonte === 'CALCULO_STC'
                  ? 'Decomposição por componente (CalculoSTC) bate com o Calcgraf item a item.'
                  : 'O recálculo do Vizor confere com a foto do Calcgraf.'}
              </Text>
            ) : (
              <Text size="xs" c="dimmed">
                A foto do Calcgraf é preservada. Use-a na proposta quando houver divergência não resolvida.
              </Text>
            )}
          </Stack>
        </Alert>
      )}

      {resultado && !loading && (
        <>
          {/* Resumo principal */}
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
            <Paper p="md" withBorder ta="center">
              <Text size="xs" c="dimmed" tt="uppercase">Custo Total</Text>
              <Text fw={700} size="lg" c="red">{formatCurrency(resultado.custoTotal)}</Text>
            </Paper>
            <Paper p="md" withBorder ta="center">
              <Text size="xs" c="dimmed" tt="uppercase">Preço Venda</Text>
              <Text fw={700} size="lg" c="green">{formatCurrency(resultado.precoVenda)}</Text>
            </Paper>
            <Paper p="md" withBorder ta="center">
              <Text size="xs" c="dimmed" tt="uppercase">Preço Unitário</Text>
              <Text fw={700} size="lg">{formatCurrency(resultado.precoUnitario)}</Text>
            </Paper>
            <Paper p="md" withBorder ta="center">
              <Text size="xs" c="dimmed" tt="uppercase">Margem</Text>
              <Text fw={700} size="lg" c="blue">{formatPercent(resultado.margemReal)}</Text>
            </Paper>
          </SimpleGrid>

          {/* Decomposição estilo Calcgraf (paridade) */}
          {resultado.custoProducao != null && (
            <Paper p="md" withBorder>
              <Text fw={500} size="sm" mb="sm">Decomposição do Custo (paridade Calcgraf)</Text>
              <Table>
                <Table.Tbody>
                  <Table.Tr>
                    <Table.Td>Material Direto (MD)</Table.Td>
                    <Table.Td ta="right">{formatCurrency(resultado.materialDireto)}</Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td>Custo de Transformação (CT)</Table.Td>
                    <Table.Td ta="right">{formatCurrency(resultado.custoTransformacao)}</Table.Td>
                  </Table.Tr>
                  {(resultado.servicoExterno ?? 0) > 0 && (
                    <Table.Tr>
                      <Table.Td>Serviço Externo (SE)</Table.Td>
                      <Table.Td ta="right">{formatCurrency(resultado.servicoExterno)}</Table.Td>
                    </Table.Tr>
                  )}
                  <Table.Tr>
                    <Table.Td fw={600}>Custo de Produção (MD + CT + SE)</Table.Td>
                    <Table.Td ta="right" fw={600}>{formatCurrency(resultado.custoProducao)}</Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td>CEV (custos de venda)</Table.Td>
                    <Table.Td ta="right">{formatPercent(resultado.cevPerc)} = {formatCurrency(resultado.cevValor)}</Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td fw={600} c="teal">Contribuição Marginal</Table.Td>
                    <Table.Td ta="right" fw={600} c="teal">
                      {formatPercent(resultado.contribuicaoMarginalPerc)} = {formatCurrency(resultado.contribuicaoMarginalValor)}
                    </Table.Td>
                  </Table.Tr>
                </Table.Tbody>
              </Table>
            </Paper>
          )}

          {/* Encaixe gráfico (imposição das peças na folha) */}
          {resultado.encaixe?.layout && (
            <Stack gap="xs">
              <EncaixeVisual
                layout={resultado.encaixe.layout}
                aproveitamento={resultado.encaixe.aproveitamento}
                percentAproveitamentoFolha={resultado.encaixe.percentAproveitamentoFolha}
                orientacao={resultado.encaixe.orientacao}
                plan={planificacao}
              />
              <Group justify="flex-end">
                <Button
                  size="xs"
                  variant="light"
                  leftSection={<IconDownload size={14} />}
                  onClick={() => {
                    const layout = resultado.encaixe!.layout!
                    const base = formData.produtoNome || formData.clienteNome || 'orcamento'
                    const nome = `encaixe-${base.replace(/[^a-z0-9]+/gi, '-').slice(0, 40)}.svg`
                    baixarSvgEncaixe(layout, nome)
                  }}
                >
                  Baixar encaixe (SVG)
                </Button>
              </Group>
            </Stack>
          )}

          {/* Breakdown visual */}
          {resultado.breakdown && (
            <Paper p="md" withBorder>
              <Group gap="xs" mb="sm">
                <IconChartPie size={18} />
                <Text fw={500} size="sm">Composição do Custo</Text>
              </Group>
              <BreakdownBar breakdown={resultado.breakdown} />
            </Paper>
          )}

          {/* Detalhamento */}
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <Paper p="md" withBorder>
              <Text fw={500} size="sm" mb="xs">Papel</Text>
              <Text size="sm">Peso: {resultado.papel?.pesoKg?.toFixed(2) || '—'} kg</Text>
              <Text size="sm" c="dimmed">Custo: {formatCurrency(resultado.papel?.custo)}</Text>
            </Paper>
            <Paper p="md" withBorder>
              <Text fw={500} size="sm" mb="xs">Tinta</Text>
              <Text size="sm" c="dimmed">Custo: {formatCurrency(resultado.tinta?.custoTotal)}</Text>
              {resultado.tinta?.detalhePorCor?.map((c, i) => (
                <Text key={i} size="xs" c="dimmed">{c.cor}: {c.consumoKg?.toFixed(3)} kg = {formatCurrency(c.custo)}</Text>
              ))}
            </Paper>
            <Paper p="md" withBorder>
              <Text fw={500} size="sm" mb="xs">Máquinas</Text>
              <Text size="sm" c="dimmed">Custo: {formatCurrency(resultado.maquinas?.custoTotal)}</Text>
              {resultado.maquinas?.detalhePorEtapa?.map((e, i) => (
                <Text key={i} size="xs" c="dimmed">{e.etapa}: {e.tempoMin?.toFixed(0)} min = {formatCurrency(e.custo)}</Text>
              ))}
            </Paper>
            <Paper p="md" withBorder>
              <Text fw={500} size="sm" mb="xs">Acabamentos (centros)</Text>
              <Text size="sm" c="dimmed">
                Custo: {formatCurrency((resultado.acabamentos?.custoTotal || 0) + (resultado.acabamentosCentros?.custoTotal || 0))}
              </Text>
              {/* Cadeia de centros ricos (paridade Calcgraf) — entram no CT */}
              {resultado.acabamentosCentros?.detalhePorEtapa?.map((e, i) => (
                <Text key={`c${i}`} size="xs" c="dimmed">{e.etapa}: {formatCurrency(e.custo)}</Text>
              ))}
              {resultado.acabamentos?.detalhePorAcabamento?.map((a, i) => (
                <Text key={i} size="xs" c="dimmed">{a.tipo}: {formatCurrency(a.custo)}</Text>
              ))}
            </Paper>
            {/* Mat. Acabamento (materiais ricos que entram no Material Direto) */}
            {resultado.matAcabamento && (resultado.matAcabamento.itens?.length ?? 0) > 0 && (
              <Paper p="md" withBorder>
                <Text fw={500} size="sm" mb="xs">Mat. Acabamento</Text>
                <Text size="sm" c="dimmed">Custo: {formatCurrency(resultado.matAcabamento.custoTotal)}</Text>
                {resultado.matAcabamento.itens?.map((m, i) => (
                  <Text key={i} size="xs" c="dimmed">{m.nome}: {formatCurrency(m.subtotal)}</Text>
                ))}
              </Paper>
            )}
          </SimpleGrid>

          {/* Simulação de tiragens */}
          {simulacoes.length > 0 && (
            <>
              <Divider my="sm" />
              <Text fw={500} size="sm">Comparativo por Tiragem</Text>
              <Table striped highlightOnHover withTableBorder withColumnBorders>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Quantidade</Table.Th>
                    <Table.Th>Custo Total</Table.Th>
                    <Table.Th>Preço Unitário</Table.Th>
                    <Table.Th>Preço Total</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {simulacoes.map((sim, i) => (
                    <Table.Tr
                      key={i}
                      bg={sim.quantidade === formData.quantidade ? 'var(--mantine-color-blue-light)' : undefined}
                    >
                      <Table.Td>
                        <Group gap={4}>
                          {sim.quantidade.toLocaleString('pt-BR')}
                          {sim.quantidade === formData.quantidade && (
                            <Badge size="xs" color="blue">atual</Badge>
                          )}
                        </Group>
                      </Table.Td>
                      <Table.Td>{formatCurrency(sim.custoTotal)}</Table.Td>
                      <Table.Td>{formatCurrency(sim.precoUnitario)}</Table.Td>
                      <Table.Td fw={500}>{formatCurrency(sim.precoTotal)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </>
          )}
        </>
      )}
    </Stack>
  )
}

// ============================================================================
// Breakdown visual (barra de proporção)
// ============================================================================

function BreakdownBar({ breakdown }: { breakdown: { papel: number; tinta: number; maquina: number; acabamento: number; overhead: number } }) {
  const total = breakdown.papel + breakdown.tinta + breakdown.maquina + breakdown.acabamento + breakdown.overhead
  if (total === 0) return null

  const items = [
    { label: 'Papel', value: breakdown.papel, color: 'blue' },
    { label: 'Tinta', value: breakdown.tinta, color: 'grape' },
    { label: 'Máquina', value: breakdown.maquina, color: 'orange' },
    { label: 'Acabamento', value: breakdown.acabamento, color: 'teal' },
    { label: 'Overhead', value: breakdown.overhead, color: 'gray' },
  ]

  const sections = items
    .filter(i => i.value > 0)
    .map(i => ({
      value: (i.value / total) * 100,
      color: i.color,
      tooltip: `${i.label}: ${((i.value / total) * 100).toFixed(1)}%`,
    }))

  return (
    <Stack gap="xs">
      <Progress.Root size={24}>
        {sections.map((s, i) => (
          <Progress.Section key={i} value={s.value} color={s.color}>
            <Progress.Label>{s.tooltip}</Progress.Label>
          </Progress.Section>
        ))}
      </Progress.Root>
      <Group gap="md">
        {items.filter(i => i.value > 0).map((item) => (
          <Group key={item.label} gap={4}>
            <div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: `var(--mantine-color-${item.color}-5)` }} />
            <Text size="xs">{item.label}: {((item.value / total) * 100).toFixed(1)}%</Text>
          </Group>
        ))}
      </Group>
    </Stack>
  )
}
