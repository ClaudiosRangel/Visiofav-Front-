'use client'

import { useMemo, useState } from 'react'
import { Card, Text, Tooltip, Group, Badge, Select, Box, Stack } from '@mantine/core'
import type { OcupacaoEndereco } from '@/data/hooks/useEnderecamentoInteligente'

// ===== Interfaces =====

export interface SugestaoEndereco {
  enderecoId: string
  quantidade: number
}

export interface MapaArmazemProps {
  enderecos: OcupacaoEndereco[]
  sugestoes?: SugestaoEndereco[]
  filtroRua?: string
  filtroPredio?: string
  filtroProduto?: string
  onEnderecoClick?: (enderecoId: string) => void
}

// ===== Color mapping =====

const STATUS_COLORS: Record<string, string> = {
  VAZIO: '#4CAF50',
  PARCIAL: '#FFC107',
  CHEIO: '#F44336',
  BLOQUEADO: '#2196F3',
  SUGERIDO: '#9C27B0',
}

const STATUS_LABELS: Record<string, string> = {
  VAZIO: 'Vazio',
  PARCIAL: 'Parcial',
  CHEIO: 'Cheio',
  BLOQUEADO: 'Bloqueado',
  SUGERIDO: 'Sugerido',
}

// ===== Helper: filter addresses =====

export function filtrarEnderecos(
  enderecos: OcupacaoEndereco[],
  filtroRua?: string | null,
  filtroPredio?: string | null,
  filtroProduto?: string | null,
): OcupacaoEndereco[] {
  return enderecos.filter((e) => {
    if (filtroRua && e.rua !== filtroRua) return false
    if (filtroPredio && e.predio !== filtroPredio) return false
    if (filtroProduto && (!e.produto || e.produto.id !== filtroProduto)) return false
    return true
  })
}

// ===== Component =====

export function MapaArmazem({
  enderecos,
  sugestoes,
  filtroRua: filtroRuaProp,
  filtroPredio: filtroPredioProp,
  filtroProduto: filtroProdutoProp,
  onEnderecoClick,
}: MapaArmazemProps) {
  // Internal filter state (used when props are not provided)
  const [filtroRuaLocal, setFiltroRuaLocal] = useState<string | null>(null)
  const [filtroPredioLocal, setFiltroPredioLocal] = useState<string | null>(null)
  const [filtroProdutoLocal, setFiltroProdutoLocal] = useState<string | null>(null)

  const filtroRua = filtroRuaProp ?? filtroRuaLocal
  const filtroPredio = filtroPredioProp ?? filtroPredioLocal
  const filtroProduto = filtroProdutoProp ?? filtroProdutoLocal

  // Build suggestion map for quick lookup
  const sugestaoMap = useMemo(() => {
    const map = new Map<string, number>()
    if (sugestoes) {
      for (const s of sugestoes) {
        map.set(s.enderecoId, s.quantidade)
      }
    }
    return map
  }, [sugestoes])

  // Filter addresses
  const enderecosFiltrados = useMemo(
    () => filtrarEnderecos(enderecos, filtroRua, filtroPredio, filtroProduto),
    [enderecos, filtroRua, filtroPredio, filtroProduto],
  )

  // Build hierarchical structure: rua → prédio → { niveis, aptos }
  const hierarquia = useMemo(() => {
    const ruaMap = new Map<string, Map<string, OcupacaoEndereco[]>>()

    for (const e of enderecosFiltrados) {
      if (!ruaMap.has(e.rua)) ruaMap.set(e.rua, new Map())
      const predioMap = ruaMap.get(e.rua)!
      if (!predioMap.has(e.predio)) predioMap.set(e.predio, [])
      predioMap.get(e.predio)!.push(e)
    }

    return ruaMap
  }, [enderecosFiltrados])

  // Extract unique values for filter options
  const ruaOptions = useMemo(
    () => [...new Set(enderecos.map((e) => e.rua))].sort().map((r) => ({ value: r, label: `Rua ${r}` })),
    [enderecos],
  )

  const predioOptions = useMemo(
    () => [...new Set(enderecos.map((e) => e.predio))].sort().map((p) => ({ value: p, label: `Prédio ${p}` })),
    [enderecos],
  )

  const produtoOptions = useMemo(() => {
    const produtos = new Map<string, string>()
    for (const e of enderecos) {
      if (e.produto) produtos.set(e.produto.id, e.produto.nome)
    }
    return [...produtos.entries()].map(([id, nome]) => ({ value: id, label: nome }))
  }, [enderecos])

  // Get color for a cell
  function getCellColor(endereco: OcupacaoEndereco): string {
    if (sugestaoMap.has(endereco.id)) return STATUS_COLORS.SUGERIDO
    return STATUS_COLORS[endereco.status] || STATUS_COLORS.VAZIO
  }

  // Get status label
  function getStatusLabel(endereco: OcupacaoEndereco): string {
    if (sugestaoMap.has(endereco.id)) return STATUS_LABELS.SUGERIDO
    return STATUS_LABELS[endereco.status] || endereco.status
  }

  return (
    <Stack gap="md">
      {/* Filters */}
      <Card padding="sm" withBorder>
        <Group gap="md">
          <Select
            label="Rua"
            placeholder="Todas"
            data={ruaOptions}
            value={filtroRua}
            onChange={setFiltroRuaLocal}
            searchable
            clearable
            size="sm"
            style={{ width: 160 }}
          />
          <Select
            label="Prédio"
            placeholder="Todos"
            data={predioOptions}
            value={filtroPredio}
            onChange={setFiltroPredioLocal}
            searchable
            clearable
            size="sm"
            style={{ width: 160 }}
          />
          <Select
            label="Produto"
            placeholder="Todos"
            data={produtoOptions}
            value={filtroProduto}
            onChange={setFiltroProdutoLocal}
            searchable
            clearable
            size="sm"
            style={{ width: 240 }}
          />
        </Group>
      </Card>

      {/* Legend */}
      <Group gap="lg">
        <Text size="sm" fw={500}>Legenda:</Text>
        {Object.entries(STATUS_COLORS).map(([key, color]) => (
          <Group key={key} gap={4}>
            <Box
              style={{
                width: 16,
                height: 16,
                borderRadius: 4,
                backgroundColor: color,
              }}
            />
            <Text size="sm">{STATUS_LABELS[key]}</Text>
          </Group>
        ))}
      </Group>

      {/* Map Grid */}
      {enderecosFiltrados.length === 0 && (
        <Text c="dimmed" ta="center" py="xl">
          Nenhum endereço encontrado com os filtros selecionados
        </Text>
      )}

      {[...hierarquia.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([rua, predioMap]) => (
        <Card key={rua} withBorder padding="md">
          <Text fw={600} size="lg" mb="sm">
            Rua {rua}
          </Text>

          <Group gap="xl" align="flex-start" style={{ overflowX: 'auto' }}>
            {[...predioMap.entries()].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true })).map(([predio, enderecosBloco]) => {
              // Get unique levels and apartments for this block
              const niveis = [...new Set(enderecosBloco.map((e) => e.nivel))].sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
              const aptos = [...new Set(enderecosBloco.map((e) => e.apartamento))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))

              // Build lookup map
              const lookup = new Map<string, OcupacaoEndereco>()
              for (const e of enderecosBloco) {
                lookup.set(`${e.nivel}-${e.apartamento}`, e)
              }

              return (
                <Box key={predio} style={{ minWidth: aptos.length * 52 + 40 }}>
                  <Text size="sm" fw={500} ta="center" mb={4}>
                    Prédio {predio}
                  </Text>

                  {/* CSS Grid: columns = apartments, rows = levels (inverted) */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: `40px repeat(${aptos.length}, 48px)`,
                      gridTemplateRows: `24px repeat(${niveis.length}, 40px)`,
                      gap: 2,
                    }}
                  >
                    {/* Header row: apartment labels */}
                    <div /> {/* empty corner */}
                    {aptos.map((apto) => (
                      <Text key={apto} size="xs" c="dimmed" ta="center" style={{ lineHeight: '24px' }}>
                        Ap {apto}
                      </Text>
                    ))}

                    {/* Data rows: level label + cells */}
                    {niveis.map((nivel) => (
                      <>
                        <Text key={`label-${nivel}`} size="xs" c="dimmed" style={{ lineHeight: '40px' }}>
                          Nv {nivel}
                        </Text>
                        {aptos.map((apto) => {
                          const endereco = lookup.get(`${nivel}-${apto}`)
                          if (!endereco) {
                            return (
                              <Box
                                key={`${nivel}-${apto}`}
                                style={{
                                  width: 48,
                                  height: 40,
                                  borderRadius: 4,
                                  backgroundColor: '#f0f0f0',
                                  border: '1px solid #ddd',
                                }}
                              />
                            )
                          }

                          const color = getCellColor(endereco)
                          const statusLabel = getStatusLabel(endereco)
                          const sugestaoQtd = sugestaoMap.get(endereco.id)

                          return (
                            <Tooltip
                              key={`${nivel}-${apto}`}
                              multiline
                              w={220}
                              label={
                                <div>
                                  <Text size="xs" fw={600}>{endereco.enderecoCompleto}</Text>
                                  <Text size="xs">Status: {statusLabel}</Text>
                                  <Text size="xs">Ocupação: {endereco.percentualOcupacao}%</Text>
                                  {endereco.produto && (
                                    <>
                                      <Text size="xs">Produto: {endereco.produto.nome}</Text>
                                      <Text size="xs">Qtd: {endereco.produto.quantidade}</Text>
                                      {endereco.produto.lote && <Text size="xs">Lote: {endereco.produto.lote}</Text>}
                                    </>
                                  )}
                                  {sugestaoQtd != null && (
                                    <Text size="xs" fw={600} c="grape">
                                      Sugestão: {sugestaoQtd} un
                                    </Text>
                                  )}
                                </div>
                              }
                            >
                              <Box
                                onClick={() => onEnderecoClick?.(endereco.id)}
                                style={{
                                  width: 48,
                                  height: 40,
                                  borderRadius: 4,
                                  backgroundColor: color,
                                  border: `2px solid ${color}`,
                                  cursor: onEnderecoClick ? 'pointer' : 'default',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'transform 0.1s ease',
                                  position: 'relative',
                                }}
                                className="hover:scale-110"
                              >
                                <Text size="xs" c="white" fw={600} style={{ fontSize: 9, lineHeight: 1.2 }}>
                                  {endereco.apartamento}
                                </Text>
                                {sugestaoQtd != null && (
                                  <Badge
                                    size="xs"
                                    color="grape"
                                    variant="filled"
                                    style={{
                                      position: 'absolute',
                                      top: -6,
                                      right: -6,
                                      fontSize: 8,
                                      padding: '0 4px',
                                      minWidth: 16,
                                      height: 14,
                                    }}
                                  >
                                    {sugestaoQtd}
                                  </Badge>
                                )}
                              </Box>
                            </Tooltip>
                          )
                        })}
                      </>
                    ))}
                  </div>
                </Box>
              )
            })}
          </Group>
        </Card>
      ))}
    </Stack>
  )
}
