'use client'

/**
 * DetalheLegadoOrcamento — detalhe do item único de orçamentos antigos, cujos dados de cálculo
 * vivem no cabeçalho (sem itens). Movido de `[id]/page.tsx` por compatibilidade; só aparece
 * quando o orçamento NÃO tem itens. Somente leitura.
 */

import { Badge, Divider, Group, Paper, SimpleGrid, Stack, Table, Text } from '@mantine/core'

type Num = number | string | null | undefined

interface CorDetalhe { nome: string; tipo: string; coberturaPercent: number }
interface AcabamentoDetalhe { tipo: string }

interface ResultadoLegado {
  papel?: { pesoKg: number; custo: number }
  tinta?: { custoTotal: number; detalhePorCor?: Array<{ cor: string; consumoKg: number; custo: number }> }
  maquinas?: { custoTotal: number; detalhePorEtapa?: Array<{ etapa: string; tempoMin: number; custo: number }> }
  acabamentos?: { custoTotal: number; detalhePorAcabamento?: Array<{ tipo: string; custo: number }> }
  custoTotal?: number
  precoVenda?: number
  precoUnitario?: number
  margemReal?: number
  materialDireto?: number
  custoTransformacao?: number
  servicoExterno?: number
  custoProducao?: number
  cevPerc?: number
  cevValor?: number
  contribuicaoMarginalValor?: number
  contribuicaoMarginalPerc?: number
}

export interface OrcamentoLegado {
  tipoEmbalagem?: { descricao: string } | null
  produtoNome?: string | null
  quantidade: number
  papelDescricao?: string | null
  gramatura?: number | null
  numCores: number
  medidas?: Record<string, number>
  cores?: CorDetalhe[] | null
  acabamentos?: AcabamentoDetalhe[] | null
  resultadoCalculo?: ResultadoLegado | null
  custoTotal?: Num
  precoVenda?: Num
  precoUnitario?: Num
  margemReal?: Num
  variacoes?: Array<{ quantidade: number; precoUnitario: number; precoTotal: number }> | null
}

function moeda(val: Num): string {
  if (val == null) return '—'
  const num = typeof val === 'string' ? parseFloat(val) : val
  if (isNaN(num)) return '—'
  return `R$ ${num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function percentual(val: Num): string {
  if (val == null) return '—'
  const num = typeof val === 'string' ? parseFloat(val) : val
  if (isNaN(num)) return '—'
  return `${num.toFixed(1)}%`
}

export default function DetalheLegadoOrcamento({ orcamento }: { orcamento: OrcamentoLegado }) {
  const resultado = orcamento.resultadoCalculo

  return (
    <Stack gap="md">
      <Divider label="Detalhe do Item (compatibilidade)" labelPosition="left" />

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        <Paper p="md" withBorder>
          <Text fw={600} size="sm" mb="xs">Produto</Text>
          <Stack gap={4}>
            <Text size="sm"><strong>Tipo de Embalagem:</strong> {orcamento.tipoEmbalagem?.descricao || '—'}</Text>
            {orcamento.produtoNome && (
              <Text size="sm"><strong>Produto (repetição):</strong> {orcamento.produtoNome}</Text>
            )}
            <Text size="sm"><strong>Quantidade:</strong> {orcamento.quantidade?.toLocaleString('pt-BR')}</Text>
          </Stack>
        </Paper>

        <Paper p="md" withBorder>
          <Text fw={600} size="sm" mb="xs">Material / Papel</Text>
          <Stack gap={4}>
            <Text size="sm"><strong>Papel:</strong> {orcamento.papelDescricao || '—'}</Text>
            <Text size="sm"><strong>Gramatura:</strong> {orcamento.gramatura ? `${orcamento.gramatura} g/m²` : '—'}</Text>
            <Text size="sm"><strong>Nº Cores:</strong> {orcamento.numCores}</Text>
          </Stack>
        </Paper>
      </SimpleGrid>

      {orcamento.medidas && typeof orcamento.medidas === 'object' && Object.keys(orcamento.medidas).length > 0 && (
        <Paper p="md" withBorder>
          <Text fw={600} size="sm" mb="xs">Medidas</Text>
          <Group gap="lg">
            {Object.entries(orcamento.medidas).map(([key, val]) => (
              <Text key={key} size="sm">
                <strong>{key}:</strong> {val != null && typeof val !== 'object' ? String(val) : '—'} mm
              </Text>
            ))}
          </Group>
        </Paper>
      )}

      {Array.isArray(orcamento.cores) && orcamento.cores.length > 0 && (
        <Paper p="md" withBorder>
          <Text fw={600} size="sm" mb="xs">Cores</Text>
          <Group gap="xs">
            {orcamento.cores.map((cor, i) => (
              <Badge key={i} variant="light" color={cor?.tipo === 'CMYK' ? 'blue' : 'grape'}>
                {cor?.nome ?? '—'} ({cor?.coberturaPercent ?? 0}%)
              </Badge>
            ))}
          </Group>
        </Paper>
      )}

      {Array.isArray(orcamento.acabamentos) && orcamento.acabamentos.length > 0 && (
        <Paper p="md" withBorder>
          <Text fw={600} size="sm" mb="xs">Acabamentos</Text>
          <Group gap="xs">
            {orcamento.acabamentos.map((acab, i) => (
              <Badge key={i} variant="light" color="teal">{acab?.tipo ?? '—'}</Badge>
            ))}
          </Group>
        </Paper>
      )}

      {resultado && (
        <>
          <Divider label="Resultado do Cálculo" labelPosition="left" />

          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
            <Paper p="md" withBorder ta="center">
              <Text size="xs" c="dimmed" tt="uppercase">Custo Total</Text>
              <Text fw={700} size="lg" c="red">{moeda(resultado.custoTotal ?? orcamento.custoTotal)}</Text>
            </Paper>
            <Paper p="md" withBorder ta="center">
              <Text size="xs" c="dimmed" tt="uppercase">Preço Venda</Text>
              <Text fw={700} size="lg" c="green">{moeda(resultado.precoVenda ?? orcamento.precoVenda)}</Text>
            </Paper>
            <Paper p="md" withBorder ta="center">
              <Text size="xs" c="dimmed" tt="uppercase">Preço Unitário</Text>
              <Text fw={700} size="lg">{moeda(resultado.precoUnitario ?? orcamento.precoUnitario)}</Text>
            </Paper>
            <Paper p="md" withBorder ta="center">
              <Text size="xs" c="dimmed" tt="uppercase">Margem</Text>
              <Text fw={700} size="lg" c="blue">{percentual(resultado.margemReal ?? orcamento.margemReal)}</Text>
            </Paper>
          </SimpleGrid>

          {resultado.custoProducao != null && (
            <Paper p="md" withBorder>
              <Text fw={500} size="sm" mb="sm">Decomposição do Custo</Text>
              <Table>
                <Table.Tbody>
                  <Table.Tr>
                    <Table.Td>Material Direto (MD)</Table.Td>
                    <Table.Td ta="right">{moeda(resultado.materialDireto)}</Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td>Custo de Transformação (CT)</Table.Td>
                    <Table.Td ta="right">{moeda(resultado.custoTransformacao)}</Table.Td>
                  </Table.Tr>
                  {(resultado.servicoExterno ?? 0) > 0 && (
                    <Table.Tr>
                      <Table.Td>Serviço Externo (SE)</Table.Td>
                      <Table.Td ta="right">{moeda(resultado.servicoExterno)}</Table.Td>
                    </Table.Tr>
                  )}
                  <Table.Tr>
                    <Table.Td fw={600}>Custo de Produção (MD + CT + SE)</Table.Td>
                    <Table.Td ta="right" fw={600}>{moeda(resultado.custoProducao)}</Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td>CEV (custos de venda)</Table.Td>
                    <Table.Td ta="right">{percentual(resultado.cevPerc)} = {moeda(resultado.cevValor)}</Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td fw={600} c="teal">Contribuição Marginal</Table.Td>
                    <Table.Td ta="right" fw={600} c="teal">
                      {percentual(resultado.contribuicaoMarginalPerc)} = {moeda(resultado.contribuicaoMarginalValor)}
                    </Table.Td>
                  </Table.Tr>
                </Table.Tbody>
              </Table>
            </Paper>
          )}

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <Paper p="md" withBorder>
              <Text fw={500} size="sm" mb="xs">Papel</Text>
              <Text size="sm">Peso: {resultado.papel?.pesoKg?.toFixed(2) || '—'} kg</Text>
              <Text size="sm" c="dimmed">Custo: {moeda(resultado.papel?.custo)}</Text>
            </Paper>
            <Paper p="md" withBorder>
              <Text fw={500} size="sm" mb="xs">Tinta</Text>
              <Text size="sm" c="dimmed">Custo: {moeda(resultado.tinta?.custoTotal)}</Text>
              {(Array.isArray(resultado.tinta?.detalhePorCor) ? resultado.tinta!.detalhePorCor : []).map((c, i) => (
                <Text key={i} size="xs" c="dimmed">{c?.cor ?? '—'}: {c?.consumoKg?.toFixed(3) ?? '—'} kg = {moeda(c?.custo)}</Text>
              ))}
            </Paper>
            <Paper p="md" withBorder>
              <Text fw={500} size="sm" mb="xs">Máquinas</Text>
              <Text size="sm" c="dimmed">Custo: {moeda(resultado.maquinas?.custoTotal)}</Text>
              {(Array.isArray(resultado.maquinas?.detalhePorEtapa) ? resultado.maquinas!.detalhePorEtapa : []).map((e, i) => (
                <Text key={i} size="xs" c="dimmed">{e?.etapa ?? '—'}: {e?.tempoMin?.toFixed(0) ?? '—'} min = {moeda(e?.custo)}</Text>
              ))}
            </Paper>
            <Paper p="md" withBorder>
              <Text fw={500} size="sm" mb="xs">Acabamentos</Text>
              <Text size="sm" c="dimmed">Custo: {moeda(resultado.acabamentos?.custoTotal)}</Text>
              {(Array.isArray(resultado.acabamentos?.detalhePorAcabamento) ? resultado.acabamentos!.detalhePorAcabamento : []).map((a, i) => (
                <Text key={i} size="xs" c="dimmed">{a?.tipo ?? '—'}: {moeda(a?.custo)}</Text>
              ))}
            </Paper>
          </SimpleGrid>
        </>
      )}

      {!resultado && (orcamento.custoTotal || orcamento.precoVenda) && (
        <>
          <Divider label="Valores" labelPosition="left" />
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
            <Paper p="md" withBorder ta="center">
              <Text size="xs" c="dimmed" tt="uppercase">Custo Total</Text>
              <Text fw={700} size="lg" c="red">{moeda(orcamento.custoTotal)}</Text>
            </Paper>
            <Paper p="md" withBorder ta="center">
              <Text size="xs" c="dimmed" tt="uppercase">Preço Venda</Text>
              <Text fw={700} size="lg" c="green">{moeda(orcamento.precoVenda)}</Text>
            </Paper>
            <Paper p="md" withBorder ta="center">
              <Text size="xs" c="dimmed" tt="uppercase">Preço Unitário</Text>
              <Text fw={700} size="lg">{moeda(orcamento.precoUnitario)}</Text>
            </Paper>
            <Paper p="md" withBorder ta="center">
              <Text size="xs" c="dimmed" tt="uppercase">Margem</Text>
              <Text fw={700} size="lg" c="blue">{percentual(orcamento.margemReal)}</Text>
            </Paper>
          </SimpleGrid>
        </>
      )}

      {Array.isArray(orcamento.variacoes) && orcamento.variacoes.length > 0 && (
        <>
          <Divider label="Variações de Tiragem" labelPosition="left" />
          <Table striped highlightOnHover withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Quantidade</Table.Th>
                <Table.Th ta="right">Preço Unitário</Table.Th>
                <Table.Th ta="right">Preço Total</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {orcamento.variacoes.map((v, i) => (
                <Table.Tr key={i}>
                  <Table.Td>{v.quantidade?.toLocaleString('pt-BR')}</Table.Td>
                  <Table.Td ta="right">{moeda(v.precoUnitario)}</Table.Td>
                  <Table.Td ta="right">{moeda(v.precoTotal)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </>
      )}
    </Stack>
  )
}
