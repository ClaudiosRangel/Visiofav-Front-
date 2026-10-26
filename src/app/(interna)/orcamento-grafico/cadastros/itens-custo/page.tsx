'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Title, Stack, Table, Group, Badge, Text, Loader, Center, TextInput, Select,
  Paper, ScrollArea,
} from '@mantine/core'
import { IconSearch } from '@tabler/icons-react'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'

// Visão unificada "Itens de Custo" por Origem (paridade Itc do Calcgraf).
// Deriva dos cadastros existentes (papel/tinta/máquina/acabamento) — somente
// leitura+navegação; a edição acontece no cadastro de origem.
// Spec configurador-grafico-calcgraf (Req 2).

interface ItemCusto {
  fonteTipo: string
  fonteId: string
  origem: string
  grupo: 'MD' | 'CT' | 'SE'
  codigo: string | null
  descricao: string
  valor: number | null
}

const ORIGENS = [
  { value: 'SUPORTE', label: 'Suporte (papel)' },
  { value: 'TINTA', label: 'Tinta' },
  { value: 'MAT.ACABAMENTO', label: 'Material de Acabamento' },
  { value: 'MATRIZ IMPRESSAO', label: 'Matriz de Impressão' },
  { value: 'CENTRO DE CUSTO', label: 'Centro de Custo (máquina)' },
  { value: 'SERVICO EXTERNO', label: 'Serviço Externo' },
]

const GRUPO_COR: Record<string, string> = { MD: 'blue', CT: 'orange', SE: 'grape' }
const GRUPO_LABEL: Record<string, string> = { MD: 'Material Direto', CT: 'Transformação', SE: 'Serviço Externo' }

const moeda = (v: number | null) =>
  v == null ? '—' : `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`

// Rota de origem para "editar no cadastro" conforme a fonte.
const HREF_FONTE: Record<string, string> = {
  PAPEL: '/orcamento-grafico/cadastros/precos-materiais',
  TINTA: '/orcamento-grafico/cadastros/precos-materiais',
  CENTRO: '/pcp/cadastros/centros',
  ACABAMENTO: '/orcamento-grafico/cadastros/acabamentos',
  SERVICO: '/orcamento-grafico/cadastros/acabamentos',
}

export default function ItensCustoPage() {
  useEffect(() => { document.title = 'Orçamento Gráfico - Itens de Custo' }, [])

  const [itens, setItens] = useState<ItemCusto[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [origem, setOrigem] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (origem) params.origem = origem
      if (busca.trim()) params.busca = busca.trim()
      const { data } = await api.get('/configurador-grafico/itens-custo', { params })
      setItens(data.itens || [])
    } catch (err: any) {
      notifications.show({
        title: 'Erro',
        message: err?.response?.data?.message || 'Falha ao carregar itens de custo.',
        color: 'red',
      })
    } finally {
      setLoading(false)
    }
  }, [origem, busca])

  useEffect(() => { carregar() }, [carregar])

  return (
    <Stack gap="md">
      <div>
        <Title order={3}>Itens de Custo</Title>
        <Text size="sm" c="dimmed">
          Visão unificada dos itens de custo por Origem (paridade Calcgraf). A edição
          é feita no cadastro de origem (papel, máquina, acabamento).
        </Text>
      </div>

      <Paper p="sm" withBorder>
        <Group gap="sm" align="flex-end" wrap="wrap">
          <TextInput
            placeholder="Buscar por descrição ou código..."
            leftSection={<IconSearch size={16} />}
            value={busca}
            onChange={(e) => setBusca(e.currentTarget.value)}
            style={{ flex: 1, minWidth: 220 }}
          />
          <Select
            placeholder="Origem"
            data={ORIGENS}
            value={origem}
            onChange={setOrigem}
            clearable
            w={240}
          />
        </Group>
      </Paper>

      {loading ? (
        <Center py="xl"><Loader /></Center>
      ) : (
        <ScrollArea>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Descrição</Table.Th>
                <Table.Th>Código</Table.Th>
                <Table.Th>Origem</Table.Th>
                <Table.Th>Grupo</Table.Th>
                <Table.Th ta="right">Valor</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {itens.map((i) => (
                <Table.Tr
                  key={`${i.fonteTipo}:${i.fonteId}`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => { const h = HREF_FONTE[i.fonteTipo]; if (h) window.location.href = h }}
                >
                  <Table.Td>{i.descricao}</Table.Td>
                  <Table.Td><Text size="xs" c="dimmed">{i.codigo || '—'}</Text></Table.Td>
                  <Table.Td><Text size="xs" c="dimmed">{i.origem}</Text></Table.Td>
                  <Table.Td>
                    <Badge size="sm" color={GRUPO_COR[i.grupo] ?? 'gray'} variant="light">
                      {GRUPO_LABEL[i.grupo] ?? i.grupo}
                    </Badge>
                  </Table.Td>
                  <Table.Td ta="right">{moeda(i.valor)}</Table.Td>
                </Table.Tr>
              ))}
              {itens.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={5}>
                    <Text ta="center" c="dimmed" py="md">Nenhum item de custo encontrado</Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      )}
    </Stack>
  )
}
