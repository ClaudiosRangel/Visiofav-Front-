'use client'

import { useEffect, useState } from 'react'
import {
  Card, Group, Text, Table, Button, LoadingOverlay, Badge, Select, Tabs,
  Alert, ActionIcon, Tooltip,
} from '@mantine/core'
import { IconWand, IconAlertCircle, IconHistory, IconArrowBackUp, IconCheck } from '@tabler/icons-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notifications } from '@mantine/notifications'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'

/**
 * Migração assistida dos campos legados (familia/subFamilia) para o vínculo
 * estruturado (familiaId) — Hierarquia Mercadológica Fase 2. Compartilhada por
 * WMS e Compras via wrappers finos. Fluxo: Analisar → Revisar → Confirmar +
 * aba Execuções (reverter).
 */

interface FolhaCandidata {
  id: string
  descricao: string
  codigoHierarquico: string
}
interface ItemAnalise {
  valorOriginal: string
  textoNormalizado: string
  quantidade: number
  sugestaoFolhaId: string | null
  candidatos: FolhaCandidata[]
}
interface AnaliseResp {
  itens: ItemAnalise[]
  semClassificacao: { rotulo: string; quantidade: number }
  totalFolhasDisponiveis: number
}
type Decisao = 'VINCULAR' | 'IGNORAR'

interface DecisaoLocal {
  decisao: Decisao
  folhaId: string | null
  substituirExistente: boolean
}

interface Execucao {
  id: string
  usuarioId: string | null
  totalAfetados: number
  revertidaEm: string | null
  criadoEm: string
}

interface Props {
  breadcrumb?: string
  modulosPermitidos?: string[]
}

export default function MigracaoAssistidaView({
  breadcrumb = 'Migração Assistida da Hierarquia',
  modulosPermitidos = ['WMS', 'COMPRAS'],
}: Props) {
  useModuloGuard(modulosPermitidos)
  useEffect(() => { document.title = 'Vizor - Migração da Hierarquia' }, [])
  const queryClient = useQueryClient()

  const [decisoes, setDecisoes] = useState<Record<string, DecisaoLocal>>({})

  const { data: analise, isLoading, isError, refetch } = useQuery<AnaliseResp>({
    queryKey: ['hierarquia-migracao-analisar'],
    queryFn: async () => {
      const { data } = await api.get('/hierarquia-mercadologica/migracao/analisar')
      return data
    },
  })

  // Inicializa as decisões com a sugestão automática de cada item.
  useEffect(() => {
    if (!analise) return
    const init: Record<string, DecisaoLocal> = {}
    for (const item of analise.itens) {
      init[item.textoNormalizado] = {
        decisao: item.sugestaoFolhaId ? 'VINCULAR' : 'IGNORAR',
        folhaId: item.sugestaoFolhaId,
        substituirExistente: false,
      }
    }
    setDecisoes(init)
  }, [analise])

  const { data: execucoesResp } = useQuery<{ data: Execucao[] }>({
    queryKey: ['hierarquia-migracao-execucoes'],
    queryFn: async () => {
      const { data } = await api.get('/hierarquia-mercadologica/migracao/execucoes')
      return data
    },
  })

  const confirmar = useMutation({
    mutationFn: async () => {
      const payload = {
        decisoes: (analise?.itens || []).map((item) => {
          const d = decisoes[item.textoNormalizado]
          return {
            textoNormalizado: item.textoNormalizado,
            decisao: d?.decisao ?? 'IGNORAR',
            folhaId: d?.folhaId ?? undefined,
            substituirExistente: d?.substituirExistente ?? false,
          }
        }),
      }
      const { data } = await api.post('/hierarquia-mercadologica/migracao/confirmar', payload)
      return data
    },
    onSuccess: (res: any) => {
      notifications.show({
        title: 'Migração concluída',
        message: `${res.totalAfetados} produto(s) vinculado(s).${res.avisos?.length ? ` ${res.avisos.length} aviso(s).` : ''}`,
        color: 'green',
      })
      if (res.avisos?.length) {
        for (const a of res.avisos) notifications.show({ title: 'Aviso', message: a, color: 'yellow' })
      }
      queryClient.invalidateQueries({ queryKey: ['hierarquia-migracao-execucoes'] })
      refetch()
    },
    onError: (err: any) => notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao confirmar', color: 'red' }),
  })

  const reverter = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/hierarquia-mercadologica/migracao/execucoes/${id}/reverter`)
      return data
    },
    onSuccess: (res: any) => {
      notifications.show({
        title: 'Revertido',
        message: `${res.revertidos} produto(s) revertido(s).${res.rejeitados?.length ? ` ${res.rejeitados.length} não puderam ser revertidos (estado alterado).` : ''}`,
        color: 'green',
      })
      queryClient.invalidateQueries({ queryKey: ['hierarquia-migracao-execucoes'] })
      refetch()
    },
    onError: (err: any) => notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao reverter', color: 'red' }),
  })

  function setDecisao(chave: string, patch: Partial<DecisaoLocal>) {
    setDecisoes((prev) => ({ ...prev, [chave]: { ...prev[chave], ...patch } }))
  }

  return (
    <div className="p-4">
      <Text size="xs" c="dimmed" mb={4}>{breadcrumb}</Text>
      <Group gap={8} mb="md">
        <IconWand size={22} />
        <Text size="xl" fw={600}>Migração Assistida da Hierarquia Mercadológica</Text>
      </Group>

      <Tabs defaultValue="migrar">
        <Tabs.List mb="md">
          <Tabs.Tab value="migrar" leftSection={<IconWand size={16} />}>Migrar</Tabs.Tab>
          <Tabs.Tab value="execucoes" leftSection={<IconHistory size={16} />}>Execuções</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="migrar">
          <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light" mb="md">
            O sistema analisa os valores de <b>família / subfamília</b> dos produtos e sugere o vínculo com a árvore.
            Nada é alterado até você confirmar. Os campos legados são preservados; a operação é reversível.
          </Alert>

          {isError && (
            <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md">Falha ao analisar os dados.</Alert>
          )}

          <Card withBorder pos="relative">
            <LoadingOverlay visible={isLoading} />
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Valor legado</Table.Th>
                  <Table.Th style={{ width: 90 }} ta="right">Produtos</Table.Th>
                  <Table.Th style={{ width: 160 }}>Ação</Table.Th>
                  <Table.Th>Nível destino (folha)</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {(analise?.itens || []).map((item) => {
                  const d = decisoes[item.textoNormalizado]
                  return (
                    <Table.Tr key={item.textoNormalizado}>
                      <Table.Td>{item.valorOriginal}</Table.Td>
                      <Table.Td ta="right">{item.quantidade}</Table.Td>
                      <Table.Td>
                        <Select
                          data={[
                            { value: 'VINCULAR', label: 'Vincular' },
                            { value: 'IGNORAR', label: 'Ignorar' },
                          ]}
                          value={d?.decisao ?? 'IGNORAR'}
                          onChange={(v) => setDecisao(item.textoNormalizado, { decisao: (v as Decisao) || 'IGNORAR' })}
                        />
                      </Table.Td>
                      <Table.Td>
                        {d?.decisao === 'VINCULAR' ? (
                          <Select
                            placeholder={item.candidatos.length ? 'Selecione a folha' : 'Nenhuma folha compatível'}
                            data={item.candidatos.map((c) => ({ value: c.id, label: `${c.codigoHierarquico} — ${c.descricao}` }))}
                            value={d.folhaId}
                            searchable clearable
                            onChange={(v) => setDecisao(item.textoNormalizado, { folhaId: v })}
                          />
                        ) : (
                          <Text size="sm" c="dimmed">—</Text>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  )
                })}
                {analise && analise.itens.length === 0 && !isLoading && (
                  <Table.Tr><Table.Td colSpan={4}><Text c="dimmed" ta="center" py="md">Nenhum valor legado para migrar.</Text></Table.Td></Table.Tr>
                )}
              </Table.Tbody>
            </Table>

            {analise && analise.semClassificacao.quantidade > 0 && (
              <Text size="xs" c="dimmed" mt="sm">
                {analise.semClassificacao.quantidade} produto(s) sem classificação legada (não migrados).
              </Text>
            )}

            <Group justify="flex-end" mt="md">
              <Button
                leftSection={<IconCheck size={16} />}
                loading={confirmar.isPending}
                disabled={!analise || analise.itens.length === 0}
                onClick={() => confirmar.mutate()}
              >
                Confirmar migração
              </Button>
            </Group>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="execucoes">
          <Card withBorder>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Data</Table.Th>
                  <Table.Th ta="right">Produtos afetados</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th style={{ width: 100 }}>Ações</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {(execucoesResp?.data || []).map((ex) => (
                  <Table.Tr key={ex.id}>
                    <Table.Td>{new Date(ex.criadoEm).toLocaleString('pt-BR')}</Table.Td>
                    <Table.Td ta="right">{ex.totalAfetados}</Table.Td>
                    <Table.Td>
                      {ex.revertidaEm
                        ? <Badge color="gray" variant="light">Revertida</Badge>
                        : <Badge color="teal" variant="light">Aplicada</Badge>}
                    </Table.Td>
                    <Table.Td>
                      {!ex.revertidaEm && (
                        <Tooltip label="Reverter esta execução">
                          <ActionIcon
                            variant="subtle" color="orange"
                            loading={reverter.isPending}
                            onClick={() => { if (confirm('Reverter esta migração? Os produtos voltam ao vínculo anterior.')) reverter.mutate(ex.id) }}
                          >
                            <IconArrowBackUp size={18} />
                          </ActionIcon>
                        </Tooltip>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
                {(execucoesResp?.data || []).length === 0 && (
                  <Table.Tr><Table.Td colSpan={4}><Text c="dimmed" ta="center" py="md">Nenhuma migração executada ainda.</Text></Table.Td></Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </Card>
        </Tabs.Panel>
      </Tabs>
    </div>
  )
}
