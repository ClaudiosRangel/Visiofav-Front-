'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Card, Group, Text, Table, Select, LoadingOverlay, Alert, ThemeIcon, Button,
} from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { IconAlertCircle, IconWallet } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { useEmpresaAtual, deveRedirecionarKardex } from '@/hooks/useEmpresaAtual'
import {
  useKardexProduto,
  useSaldoProduto,
  traduzirTipoMovimentacao,
  deveExibirEstadoVazioKardex,
  deveExibirEstadoFalhaKardex,
} from '@/data/hooks/useKardex'

const AVISO_DISPENSADO_KEY = 'visiofab-wms-kardex-aviso-dispensado'

export default function KardexPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'Vizor - Estoque - Kardex' }, [])

  const router = useRouter()
  const { usaWms, isLoading: loadingEmpresa } = useEmpresaAtual()

  // Requirements 9.3, 9.4 — preferência de dispensa do aviso, persistida localmente.
  const [avisoDispensado, setAvisoDispensado] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    setAvisoDispensado(localStorage.getItem(AVISO_DISPENSADO_KEY) === 'true')
  }, [])

  useEffect(() => {
    if (loadingEmpresa) return
    if (deveRedirecionarKardex(usaWms, avisoDispensado)) {
      notifications.show({
        title: 'Funcionalidade não disponível',
        message: 'O Kardex é destinado a empresas que não utilizam o WMS completo',
        color: 'orange',
      })
      router.replace('/estoque')
    }
  }, [loadingEmpresa, usaWms, avisoDispensado, router])

  function dispensarAvisoPermanentemente() {
    if (typeof window !== 'undefined') {
      localStorage.setItem(AVISO_DISPENSADO_KEY, 'true')
    }
    setAvisoDispensado(true)
  }

  const [produtoId, setProdutoId] = useState<string | null>(null)
  const [searchProd, setSearchProd] = useState('')
  const [dataInicio, setDataInicio] = useState<Date | null>(null)
  const [dataFim, setDataFim] = useState<Date | null>(null)

  const { data: produtosResp } = useQuery<any>({
    queryKey: ['kardex-produtos', searchProd],
    queryFn: async () => {
      const { data } = await api.get('/produtos', { params: { limit: 50, search: searchProd || undefined } })
      return data
    },
  })

  const {
    data: movimentacoes,
    isLoading: loadingHist,
    isError: erroHist,
    error: erroHistDetalhe,
  } = useKardexProduto(produtoId, { dataInicio, dataFim })

  const {
    data: saldo,
    isError: erroSaldo,
    isFetching: fetchingSaldo,
  } = useSaldoProduto(produtoId)

  // Requirement 7.6 — notificação de erro com a mensagem da API, além da mensagem de falha na tabela.
  useEffect(() => {
    if (!erroHist) return
    notifications.show({
      title: 'Erro',
      message: (erroHistDetalhe as any)?.response?.data?.message || 'Falha ao carregar histórico de movimentações',
      color: 'red',
    })
  }, [erroHist, erroHistDetalhe])

  // Requirement 8.3 — notificação de erro de saldo, com fallback de console.error, sem afetar o histórico.
  useEffect(() => {
    if (!erroSaldo) return
    try {
      notifications.show({
        title: 'Erro',
        message: 'Falha ao carregar saldo atual do produto',
        color: 'red',
      })
    } catch (e) {
      console.error('Falha ao exibir notificação de erro de saldo:', e)
    }
  }, [erroSaldo])

  // Enquanto o redirecionamento por Requirements 9.3/9.4 está pendente, não renderizar o conteúdo da página.
  if (!loadingEmpresa && deveRedirecionarKardex(usaWms, avisoDispensado)) {
    return null
  }

  const lista = movimentacoes ?? []
  const exibirEstadoVazio = deveExibirEstadoVazioKardex(lista, erroHist)
  const exibirEstadoFalha = deveExibirEstadoFalhaKardex(erroHist)

  const produtos = (produtosResp?.data || []).map((p: any) => ({ value: p.id, label: `${p.codigo} — ${p.nome}` }))

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Estoque / Kardex</Text>
      <Text size="xl" fw={600} mb="lg">Kardex de Estoque</Text>

      {usaWms && (
        <Alert color="blue" variant="light" mb="md">
          Esta funcionalidade é destinada a empresas que não utilizam o WMS completo.{' '}
          <Button variant="subtle" size="xs" onClick={dispensarAvisoPermanentemente}>
            Não mostrar este aviso novamente
          </Button>
        </Alert>
      )}

      <Card mb="md">
        <Select
          label="Produto"
          data={produtos}
          value={produtoId}
          onChange={setProdutoId}
          searchable
          onSearchChange={setSearchProd}
          placeholder="Buscar produto..."
        />
      </Card>

      {produtoId && (
        <>
          <Card mb="md" pos="relative">
            <LoadingOverlay visible={fetchingSaldo} />
            <Group justify="space-between">
              <div>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Saldo Atual</Text>
                <Text size="xl" fw={700}>{erroSaldo ? '—' : (saldo?.quantidade ?? '—')}</Text>
                <Text size="xs" c="dimmed">Reservado: {erroSaldo ? '—' : (saldo?.reservado ?? '—')}</Text>
              </div>
              <ThemeIcon color="blue" variant="light" size={48} radius="md">
                <IconWallet size={24} />
              </ThemeIcon>
            </Group>
          </Card>

          <Card mb="md">
            <Group>
              <DateInput
                label="Data Início"
                value={dataInicio}
                onChange={setDataInicio}
                valueFormat="DD/MM/YYYY"
                clearable
                className="w-40"
              />
              <DateInput
                label="Data Fim"
                value={dataFim}
                onChange={setDataFim}
                valueFormat="DD/MM/YYYY"
                clearable
                className="w-40"
              />
            </Group>
          </Card>

          <Card pos="relative">
            <LoadingOverlay visible={loadingHist} />
            <Text fw={600} mb="md">Histórico de Movimentações</Text>

            {exibirEstadoFalha && (
              <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
                Falha ao carregar histórico de movimentações.
              </Alert>
            )}

            {exibirEstadoVazio && (
              <Text c="dimmed" ta="center" py="xl">
                Nenhuma movimentação encontrada para o produto e período selecionados.
              </Text>
            )}

            {!exibirEstadoFalha && !exibirEstadoVazio && (
              <div className="overflow-x-auto">
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Data/Hora</Table.Th>
                      <Table.Th>Tipo</Table.Th>
                      <Table.Th>Quantidade</Table.Th>
                      <Table.Th>Saldo Anterior</Table.Th>
                      <Table.Th>Saldo Posterior</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {lista.map((m) => (
                      <Table.Tr key={m.id}>
                        <Table.Td className="text-sm">{new Date(m.criadoEm).toLocaleString('pt-BR')}</Table.Td>
                        <Table.Td>{traduzirTipoMovimentacao(m.tipo)}</Table.Td>
                        <Table.Td>
                          <Text fw={600} c={m.quantidade >= 0 ? 'green' : 'red'}>
                            {m.quantidade > 0 ? `+${m.quantidade}` : m.quantidade}
                          </Text>
                        </Table.Td>
                        <Table.Td className="text-sm">{m.saldoAnterior}</Table.Td>
                        <Table.Td className="text-sm" fw={500}>{m.saldoPosterior}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
