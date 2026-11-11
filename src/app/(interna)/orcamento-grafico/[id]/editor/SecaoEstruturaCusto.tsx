'use client'

/**
 * SecaoEstruturaCusto — decomposição de custo do item (estilo tela "Estrutura"
 * do Calcgraf), em modo SOMENTE LEITURA.
 *
 * Feature: orcamento-grafico-experiencia-calcgraf (Tarefa 5.5)
 * _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
 *
 * - Lê o `resultadoCalculo` do item (shape tolerante; trata ausência).
 * - Agrupa os componentes por: Material Direto (papel, tinta por cor,
 *   material de acabamento/matriz), Custo de Transformação (máquinas/impressão
 *   + centros de acabamento) e Serviços Externos.
 * - Quando `resultadoCalculo.custosCalcgraf` está disponível (decomposição real
 *   do Calcgraf por componente STC), usa o detalhamento por componente
 *   (grupo MD|CT + descrição + valorTotal). Senão, monta a decomposição a
 *   partir dos blocos do `resultadoCalculo` (papel/tinta/máquinas/acabamentos/
 *   matAcabamento/acabamentosCentros). Se faltar tudo, exibe os totais
 *   consolidados com um aviso "Detalhamento por componente não disponível".
 * - NÃO edita o resultado (Req 6.5): é apresentação pura.
 *
 * O título da seção fica a cargo do EditorItem; aqui renderizamos apenas o
 * conteúdo da âncora "estrutura".
 */

import { Alert, Group, Paper, Stack, Table, Text } from '@mantine/core'

// ─────────────────────────────────────────────────────────────────────────────
// Tipos tolerantes (o resultado é `any` na borda; normalizamos aqui).
// ─────────────────────────────────────────────────────────────────────────────

type Grupo = 'MD' | 'CT' | 'SE'

interface LinhaComponente {
  grupo: Grupo
  descricao: string
  custo: number
}

interface Props {
  resultadoCalculo?: unknown | null
}

const GRUPO_LABEL: Record<Grupo, string> = {
  MD: 'Material Direto',
  CT: 'Custo de Transformação',
  SE: 'Serviços Externos',
}

const ORDEM_GRUPOS: Grupo[] = ['MD', 'CT', 'SE']

/** Formata um valor numérico como moeda pt-BR (R$). */
function formatarMoeda(valor: number): string {
  const n = Number.isFinite(valor) ? valor : 0
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Converte com segurança um valor desconhecido para número (0 como fallback). */
function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/** Normaliza o grupo cru ('MD'|'CT'|'SE') vindo do componente STC. */
function normalizarGrupo(g: unknown): Grupo {
  if (g === 'CT') return 'CT'
  if (g === 'SE') return 'SE'
  return 'MD'
}

// ─────────────────────────────────────────────────────────────────────────────
// Extração da decomposição — dois caminhos: custosCalcgraf (preferido) ou blocos.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lê o detalhamento por componente de `resultadoCalculo.custosCalcgraf`
 * (decomposição real do Calcgraf por linha de CalculoSTC). Retorna `null`
 * quando ausente/sem componentes.
 */
function componentesDeCustosCalcgraf(resultado: Record<string, unknown>): LinhaComponente[] | null {
  const custos = resultado.custosCalcgraf as { componentes?: unknown[] } | null | undefined
  if (!custos || !Array.isArray(custos.componentes) || custos.componentes.length === 0) return null

  const linhas: LinhaComponente[] = []
  for (const c of custos.componentes) {
    if (!c || typeof c !== 'object') continue
    const comp = c as Record<string, unknown>
    linhas.push({
      grupo: normalizarGrupo(comp.grupo),
      descricao: String(comp.descricao ?? 'Componente').trim() || 'Componente',
      custo: num(comp.valorTotal),
    })
  }
  return linhas.length ? linhas : null
}

/**
 * Monta a decomposição por componente a partir dos blocos estruturados do
 * `resultadoCalculo` (papel/tinta/máquinas/acabamentos/matAcabamento/
 * acabamentosCentros). Usado quando não há `custosCalcgraf`.
 */
function componentesDosBlocos(resultado: Record<string, unknown>): LinhaComponente[] {
  const linhas: LinhaComponente[] = []

  // ── Material Direto ──
  const papel = resultado.papel as { custo?: unknown } | null | undefined
  if (papel && num(papel.custo) > 0) {
    linhas.push({ grupo: 'MD', descricao: 'Papel / Suporte', custo: num(papel.custo) })
  }

  const tinta = resultado.tinta as
    | { custoTotal?: unknown; detalhePorCor?: unknown[] }
    | null
    | undefined
  if (tinta) {
    const detalhe = Array.isArray(tinta.detalhePorCor) ? tinta.detalhePorCor : []
    if (detalhe.length) {
      for (const d of detalhe) {
        const cor = d as Record<string, unknown>
        linhas.push({
          grupo: 'MD',
          descricao: `Tinta — ${String(cor.cor ?? 'cor').trim() || 'cor'}`,
          custo: num(cor.custo),
        })
      }
    } else if (num(tinta.custoTotal) > 0) {
      linhas.push({ grupo: 'MD', descricao: 'Tinta', custo: num(tinta.custoTotal) })
    }
  }

  // Material de acabamento (MD): bloco rico `matAcabamento` (itens[]).
  const matAcab = resultado.matAcabamento as
    | { custoTotal?: unknown; itens?: unknown[] }
    | null
    | undefined
  if (matAcab) {
    const itens = Array.isArray(matAcab.itens) ? matAcab.itens : []
    if (itens.length) {
      for (const i of itens) {
        const item = i as Record<string, unknown>
        linhas.push({
          grupo: 'MD',
          descricao: `Mat. acabamento — ${String(item.nome ?? 'item').trim() || 'item'}`,
          custo: num(item.subtotal),
        })
      }
    } else if (num(matAcab.custoTotal) > 0) {
      linhas.push({ grupo: 'MD', descricao: 'Material de acabamento', custo: num(matAcab.custoTotal) })
    }
  }

  // ── Custo de Transformação ──
  // Máquinas/impressão.
  const maquinas = resultado.maquinas as
    | { custoTotal?: unknown; detalhePorEtapa?: unknown[] }
    | null
    | undefined
  if (maquinas) {
    const etapas = Array.isArray(maquinas.detalhePorEtapa) ? maquinas.detalhePorEtapa : []
    if (etapas.length) {
      for (const e of etapas) {
        const etapa = e as Record<string, unknown>
        linhas.push({
          grupo: 'CT',
          descricao: String(etapa.etapa ?? 'Etapa').trim() || 'Etapa',
          custo: num(etapa.custo),
        })
      }
    } else if (num(maquinas.custoTotal) > 0) {
      linhas.push({ grupo: 'CT', descricao: 'Máquinas / Impressão', custo: num(maquinas.custoTotal) })
    }
  }

  // Centros de acabamento (hora-máquina) — bloco rico `acabamentosCentros`.
  const acabCentros = resultado.acabamentosCentros as
    | { custoTotal?: unknown; detalhePorEtapa?: unknown[] }
    | null
    | undefined
  if (acabCentros) {
    const etapas = Array.isArray(acabCentros.detalhePorEtapa) ? acabCentros.detalhePorEtapa : []
    if (etapas.length) {
      for (const e of etapas) {
        const etapa = e as Record<string, unknown>
        linhas.push({
          grupo: 'CT',
          descricao: String(etapa.etapa ?? 'Acabamento').trim() || 'Acabamento',
          custo: num(etapa.custo),
        })
      }
    } else if (num(acabCentros.custoTotal) > 0) {
      linhas.push({ grupo: 'CT', descricao: 'Centros de acabamento', custo: num(acabCentros.custoTotal) })
    }
  }

  // Acabamentos (bloco genérico — material de acabamento/matriz exposto como CT
  // no motor legado; mantemos no MD quando vier do STC, mas aqui sem STC o bloco
  // `acabamentos` representa acabamentos/matriz de material direto).
  const acabamentos = resultado.acabamentos as
    | { custoTotal?: unknown; detalhePorAcabamento?: unknown[] }
    | null
    | undefined
  if (acabamentos) {
    const detalhe = Array.isArray(acabamentos.detalhePorAcabamento)
      ? acabamentos.detalhePorAcabamento
      : []
    if (detalhe.length) {
      for (const d of detalhe) {
        const ac = d as Record<string, unknown>
        linhas.push({
          grupo: 'MD',
          descricao: `Acabamento — ${String(ac.tipo ?? 'item').trim() || 'item'}`,
          custo: num(ac.custo),
        })
      }
    } else if (num(acabamentos.custoTotal) > 0) {
      linhas.push({ grupo: 'MD', descricao: 'Acabamentos', custo: num(acabamentos.custoTotal) })
    }
  }

  return linhas
}

/** Totais consolidados (sempre que presentes no resultado). */
function totaisConsolidados(resultado: Record<string, unknown>): {
  md: number
  ct: number
  se: number
  custoProducao: number
} {
  const md = num(resultado.materialDireto)
  const ct = num(resultado.custoTransformacao)
  const se = num(resultado.servicoExterno)
  const cpBruto = num(resultado.custoProducao)
  const custoProducao = cpBruto > 0 ? cpBruto : md + ct + se
  return { md, ct, se, custoProducao }
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente
// ─────────────────────────────────────────────────────────────────────────────

export default function SecaoEstruturaCusto({ resultadoCalculo }: Props) {
  // Ausência total: nada a exibir (modo leitura).
  if (!resultadoCalculo || typeof resultadoCalculo !== 'object') {
    return (
      <Alert color="gray" variant="light">
        Sem resultado de cálculo para este item. Calcule o item para ver a estrutura de custo.
      </Alert>
    )
  }

  const resultado = resultadoCalculo as Record<string, unknown>
  const totais = totaisConsolidados(resultado)

  // Caminho preferido: detalhamento por componente (custosCalcgraf) ou blocos.
  const temCustosCalcgraf = componentesDeCustosCalcgraf(resultado) != null
  const componentes = componentesDeCustosCalcgraf(resultado) ?? componentesDosBlocos(resultado)

  const temDetalhe = componentes.length > 0
  const temTotais = totais.md > 0 || totais.ct > 0 || totais.se > 0 || totais.custoProducao > 0

  // Faltou tudo: nem componentes, nem totais → aviso puro.
  if (!temDetalhe && !temTotais) {
    return (
      <Alert color="yellow" variant="light">
        Detalhamento por componente não disponível para este item.
      </Alert>
    )
  }

  // Agrupa componentes por grupo, na ordem MD → CT → SE.
  const porGrupo = ORDEM_GRUPOS.map((grupo) => ({
    grupo,
    linhas: componentes.filter((c) => c.grupo === grupo),
  })).filter((g) => g.linhas.length > 0)

  // Totais por grupo (preferir o consolidado quando houver; senão, soma das linhas).
  const totalDoGrupo = (grupo: Grupo): number => {
    const consolidado = grupo === 'MD' ? totais.md : grupo === 'CT' ? totais.ct : totais.se
    if (consolidado > 0) return consolidado
    return componentes.filter((c) => c.grupo === grupo).reduce((s, c) => s + c.custo, 0)
  }

  return (
    <Stack gap="md">
      {!temDetalhe && (
        <Alert color="yellow" variant="light">
          Detalhamento por componente não disponível. Exibindo apenas os totais consolidados.
        </Alert>
      )}

      {temDetalhe &&
        porGrupo.map(({ grupo, linhas }) => (
          <Paper key={grupo} withBorder p="sm">
            <Group justify="space-between" mb="xs">
              <Text fw={700}>{GRUPO_LABEL[grupo]}</Text>
              <Text fw={700}>{formatarMoeda(totalDoGrupo(grupo))}</Text>
            </Group>

            <Table withTableBorder={false} verticalSpacing="xs" fz="sm">
              <Table.Tbody>
                {linhas.map((linha, idx) => (
                  <Table.Tr key={`${grupo}-${idx}-${linha.descricao}`}>
                    <Table.Td>{linha.descricao}</Table.Td>
                    <Table.Td ta="right" style={{ whiteSpace: 'nowrap' }}>
                      {formatarMoeda(linha.custo)}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Paper>
        ))}

      {/* Totais consolidados (MD/CT/SE + Custo de Produção). */}
      <Paper withBorder p="sm" bg="var(--mantine-color-default)">
        <Table withTableBorder={false} verticalSpacing="xs" fz="sm">
          <Table.Tbody>
            <Table.Tr>
              <Table.Td>Material Direto (MD)</Table.Td>
              <Table.Td ta="right" style={{ whiteSpace: 'nowrap' }}>
                {formatarMoeda(totalDoGrupo('MD'))}
              </Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td>Custo de Transformação (CT)</Table.Td>
              <Table.Td ta="right" style={{ whiteSpace: 'nowrap' }}>
                {formatarMoeda(totalDoGrupo('CT'))}
              </Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td>Serviços Externos (SE)</Table.Td>
              <Table.Td ta="right" style={{ whiteSpace: 'nowrap' }}>
                {formatarMoeda(totalDoGrupo('SE'))}
              </Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td>
                <Text fw={700}>Custo de Produção</Text>
              </Table.Td>
              <Table.Td ta="right" style={{ whiteSpace: 'nowrap' }}>
                <Text fw={700}>{formatarMoeda(totais.custoProducao)}</Text>
              </Table.Td>
            </Table.Tr>
          </Table.Tbody>
        </Table>
      </Paper>

      <Text size="xs" c="dimmed">
        {temCustosCalcgraf
          ? 'Decomposição por componente do cálculo de origem. Somente leitura.'
          : 'Decomposição a partir do resultado do cálculo. Somente leitura.'}
      </Text>
    </Stack>
  )
}
