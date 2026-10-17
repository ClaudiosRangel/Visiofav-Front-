'use client'

/**
 * PlanosOverview — visualização consolidada dos planos/componentes de uma OP.
 *
 * Spec pcp-visualizacao-planos-gantt (Req 2 — ponto 2 da reunião Carton Wega:
 * "colocar uma visualização melhor dessas OPs com planos"). Consome os
 * PlanoOrdemProducao da OP (via GET /ordens-producao/:id/planos) — os planos
 * REAIS gravados pelo agente Calcgraf / importador de PDF (TAMPA/CAIXA/FACE
 * FRENTE/VERSO), diferente da aba legada "Variações".
 *
 * Nomenclatura: SEMPRE "VERSO" (nunca "COSTA") via `rotuloPlano`.
 * Somente leitura (sem edição aqui). Padrão visual inspirado em PlanosDoItem.
 */

import { Table, Text, Badge, Group, Stack, ScrollArea, Tooltip, ThemeIcon } from '@mantine/core'
import { IconAlertTriangle, IconArrowBackUp } from '@tabler/icons-react'
import { rotuloPlano } from '@/lib/plano-rotulo'

export interface PlanoOP {
  id: string
  nome: string
  tipo: 'COMPONENTE' | 'FACE' | string
  formato?: string | null
  cores?: string | null
  tiragem?: number | string | null
  montagem?: string | null
  material?: string | null
  gramatura?: number | string | null
  pesoKg?: number | string | null
  aproveitamento?: number | null
  matriz?: string | null
  faceDeId?: string | null
  sequencia?: number | null
}

interface Props {
  planos: PlanoOP[]
  loading?: boolean
}

/** Marcador de ausência (Req 2.3). */
const AUSENTE = '—'

function fmtNum(v: number | string | null | undefined): string {
  if (v == null || v === '') return AUSENTE
  const n = typeof v === 'string' ? parseFloat(v) : v
  if (!Number.isFinite(n)) return AUSENTE
  return n.toLocaleString('pt-BR')
}

function fmtTexto(v: string | null | undefined): string {
  const t = (v ?? '').trim()
  return t.length > 0 ? t : AUSENTE
}

/** Material + gramatura numa célula ("NZ 300 · 300 g/m²"). */
function fmtMaterial(p: PlanoOP): string {
  const mat = (p.material ?? '').trim()
  const g = p.gramatura != null && p.gramatura !== '' ? `${fmtNum(p.gramatura)} g/m²` : ''
  if (!mat && !g) return AUSENTE
  if (mat && g) return `${mat} · ${g}`
  return mat || g
}

export default function PlanosOverview({ planos, loading }: Props) {
  if (loading) {
    return <Text size="sm" c="dimmed" ta="center" py="md">Carregando planos…</Text>
  }

  if (!planos || planos.length === 0) {
    // Estado vazio (Req 2.8).
    return (
      <Text size="sm" c="dimmed" ta="center" py="lg">
        Esta OP não possui planos consolidados.
      </Text>
    )
  }

  // Ordena por sequência (Req 2.4).
  const ordenados = [...planos].sort((a, b) => (a.sequencia ?? 0) - (b.sequencia ?? 0))

  // Mapa id → nome (via rotuloPlano) para associar o VERSO à sua FRENTE (Req 2.5).
  const nomePorId = new Map(ordenados.map((p) => [p.id, rotuloPlano(p.nome)]))

  return (
    <Stack gap="xs">
      <ScrollArea>
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={50}>Seq.</Table.Th>
              <Table.Th>Plano / Componente</Table.Th>
              <Table.Th>Tipo</Table.Th>
              <Table.Th>Formato</Table.Th>
              <Table.Th ta="center">Cores</Table.Th>
              <Table.Th ta="right">Tiragem</Table.Th>
              <Table.Th>Cartão / Gramatura</Table.Th>
              <Table.Th>Matriz</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {ordenados.map((p) => {
              const isFace = String(p.tipo).toUpperCase() === 'FACE'
              const isVerso = !!p.faceDeId
              const nomeExib = rotuloPlano(p.nome)
              // Dado incompleto: sem formato E sem cores E sem material (Req 4.5).
              const incompleto = !p.formato && !p.cores && !p.material
              return (
                <Table.Tr key={p.id}>
                  <Table.Td fw={600}>{p.sequencia ?? AUSENTE}</Table.Td>
                  <Table.Td>
                    <Group gap={6} wrap="nowrap">
                      {incompleto && (
                        <Tooltip label="Plano com dados incompletos (vindo da importação)">
                          <ThemeIcon size="xs" color="yellow" variant="light">
                            <IconAlertTriangle size={12} />
                          </ThemeIcon>
                        </Tooltip>
                      )}
                      <Text size="sm" fw={500}>{nomeExib || AUSENTE}</Text>
                      {isVerso && (
                        <Badge
                          size="xs"
                          color="grape"
                          variant="light"
                          leftSection={<IconArrowBackUp size={11} />}
                        >
                          VERSO de {nomePorId.get(p.faceDeId as string) ?? 'FRENTE'}
                        </Badge>
                      )}
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={isFace ? 'grape' : 'cyan'} variant="light" size="sm">
                      {isFace ? 'FACE' : 'COMPONENTE'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>{fmtTexto(p.formato)}</Table.Td>
                  <Table.Td ta="center">
                    {p.cores ? <Badge variant="outline" color="blue">{p.cores}</Badge> : AUSENTE}
                  </Table.Td>
                  <Table.Td ta="right">{fmtNum(p.tiragem)}</Table.Td>
                  <Table.Td>{fmtMaterial(p)}</Table.Td>
                  <Table.Td>{fmtTexto(p.matriz)}</Table.Td>
                </Table.Tr>
              )
            })}
          </Table.Tbody>
        </Table>
      </ScrollArea>
    </Stack>
  )
}
