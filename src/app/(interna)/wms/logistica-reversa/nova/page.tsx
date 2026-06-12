'use client'

import { useState, useEffect } from 'react'
import {
  Card, Group, Text, Button, Select, TextInput, Textarea, Table,
  NumberInput, Checkbox, LoadingOverlay, Stack,
} from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { IconSearch, IconArrowLeft } from '@tabler/icons-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { notifications } from '@mantine/notifications'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface NfeItem {
  produtoId: string
  produtoNome: string
  quantidade: number
  selecionado: boolean
  quantidadeRA: number
}

export default function NovaRAPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'Vizor - WMS - Nova RA' }, [])

  const router = useRouter()

  const [nfeNumero, setNfeNumero] = useState('')
  const [nfeId, setNfeId] = useState<string | null>(null)
  const [clienteId, setClienteId] = useState('')
  const [clienteNome, setClienteNome] = useState('')
  const [motivo, setMotivo] = useState<string | null>(null)
  const [dataLimite, setDataLimite] = useState<Date | null>(null)
  const [observacao, setObservacao] = useState('')
  const [itensNfe, setItensNfe] = useState<NfeItem[]>([])
  const [buscandoNfe, setBuscandoNfe] = useState(false)

  // Fetch motivos
  const { data: motivosResp } = useQuery<any>({
    queryKey: ['logistica-reversa-motivos'],
    queryFn: async () => {
      const { data } = await api.get('/logistica-reversa/motivos')
      return data
    },
  })

  const motivos = (motivosResp?.data || motivosResp || []).map((m: any) => ({
    value: m.id || m.nome || m,
    label: m.nome || m.descricao || m,
  }))

  // Search NF-e
  const buscarNfe = async () => {
    if (!nfeNumero.trim()) return
    setBuscandoNfe(true)
    try {
      const { data } = await api.get('/logistica-reversa/nfe-busca', {
        params: { numero: nfeNumero.trim() },
      })
      const nfe = data.data || data
      setNfeId(nfe.id)
      setClienteId(nfe.clienteId || '')
      setClienteNome(nfe.clienteNome || nfe.clienteId || '')
      setItensNfe(
        (nfe.itens || []).map((item: any) => ({
          produtoId: item.produtoId,
          produtoNome: item.produtoNome || item.produtoId,
          quantidade: Number(item.quantidade),
          selecionado: false,
          quantidadeRA: Number(item.quantidade),
        })),
      )
    } catch (err: any) {
      notifications.show({
        title: 'Erro',
        message: err?.response?.data?.message || 'NF-e não encontrada',
        color: 'red',
      })
      setNfeId(null)
      setItensNfe([])
    } finally {
      setBuscandoNfe(false)
    }
  }

  // Toggle item selection
  const toggleItem = (idx: number) => {
    setItensNfe((prev) =>
      prev.map((item, i) =>
        i === idx ? { ...item, selecionado: !item.selecionado } : item,
      ),
    )
  }

  // Update item quantity
  const updateQuantidade = (idx: number, val: number) => {
    setItensNfe((prev) =>
      prev.map((item, i) =>
        i === idx ? { ...item, quantidadeRA: val } : item,
      ),
    )
  }

  // Submit
  const criarRA = useMutation({
    mutationFn: async () => {
      const itensSelecionados = itensNfe
        .filter((i) => i.selecionado)
        .map((i) => ({
          produtoId: i.produtoId,
          quantidade: i.quantidadeRA,
        }))

      if (itensSelecionados.length === 0) {
        throw new Error('Selecione pelo menos um item')
      }

      const payload: any = {
        nfeOrigemId: nfeId,
        clienteId,
        motivo,
        itens: itensSelecionados,
      }
      if (dataLimite) payload.dataLimite = dataLimite.toISOString()
      if (observacao) payload.observacao = observacao

      const { data } = await api.post('/logistica-reversa/ra', payload)
      return data
    },
    onSuccess: () => {
      notifications.show({
        title: 'Sucesso',
        message: 'Autorização de Retorno criada com sucesso',
        color: 'green',
      })
      router.push('/wms/logistica-reversa')
    },
    onError: (err: any) => {
      notifications.show({
        title: 'Erro ao criar RA',
        message: err?.response?.data?.message || err?.message || 'Erro desconhecido',
        color: 'red',
      })
    },
  })

  const itensSelecionados = itensNfe.filter((i) => i.selecionado)

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Gestão / Logística Reversa / Nova</Text>

      <Group mb="lg">
        <Button
          component={Link}
          href="/wms/logistica-reversa"
          variant="subtle"
          leftSection={<IconArrowLeft size={16} />}
        >
          Voltar
        </Button>
        <Text size="xl" fw={600}>Nova Autorização de Retorno</Text>
      </Group>

      {/* Step 1 - Search NF-e */}
      <Card mb="md" withBorder>
        <Text fw={500} mb="sm">1. Buscar NF-e de origem</Text>
        <Group gap="md" align="end">
          <TextInput
            label="Número da NF-e"
            placeholder="Digite o número da NF-e"
            value={nfeNumero}
            onChange={(e) => setNfeNumero(e.currentTarget.value)}
            onKeyDown={(e) => e.key === 'Enter' && buscarNfe()}
            className="w-64"
          />
          <Button
            onClick={buscarNfe}
            loading={buscandoNfe}
            leftSection={<IconSearch size={16} />}
          >
            Buscar
          </Button>
        </Group>
        {clienteNome && (
          <Text size="sm" mt="sm" c="dimmed">
            Cliente: <strong>{clienteNome}</strong>
          </Text>
        )}
      </Card>

      {/* Step 2 - Select items */}
      {itensNfe.length > 0 && (
        <Card mb="md" withBorder pos="relative">
          <LoadingOverlay visible={buscandoNfe} />
          <Text fw={500} mb="sm">2. Selecionar itens para devolução</Text>
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={40}></Table.Th>
                <Table.Th>Produto</Table.Th>
                <Table.Th>Qtd NF-e</Table.Th>
                <Table.Th>Qtd Devolução</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {itensNfe.map((item, idx) => (
                <Table.Tr key={item.produtoId}>
                  <Table.Td>
                    <Checkbox
                      checked={item.selecionado}
                      onChange={() => toggleItem(idx)}
                    />
                  </Table.Td>
                  <Table.Td>{item.produtoNome}</Table.Td>
                  <Table.Td>{item.quantidade}</Table.Td>
                  <Table.Td>
                    <NumberInput
                      value={item.quantidadeRA}
                      onChange={(val) => updateQuantidade(idx, Number(val) || 0)}
                      min={1}
                      max={item.quantidade}
                      disabled={!item.selecionado}
                      w={100}
                    />
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Card>
      )}

      {/* Step 3 - Additional details */}
      {nfeId && (
        <Card mb="md" withBorder>
          <Text fw={500} mb="sm">3. Detalhes da RA</Text>
          <Stack gap="md">
            <Select
              label="Motivo"
              placeholder="Selecione o motivo"
              data={motivos}
              value={motivo}
              onChange={setMotivo}
              required
            />
            <DateInput
              label="Data Limite (opcional)"
              placeholder="Prazo para devolução"
              value={dataLimite}
              onChange={setDataLimite}
              clearable
              valueFormat="DD/MM/YYYY"
            />
            <Textarea
              label="Observação"
              placeholder="Observações adicionais..."
              value={observacao}
              onChange={(e) => setObservacao(e.currentTarget.value)}
              rows={3}
            />
          </Stack>
        </Card>
      )}

      {/* Submit */}
      {nfeId && (
        <Group justify="flex-end">
          <Button
            variant="default"
            component={Link}
            href="/wms/logistica-reversa"
          >
            Cancelar
          </Button>
          <Button
            onClick={() => criarRA.mutate()}
            loading={criarRA.isPending}
            disabled={itensSelecionados.length === 0 || !motivo}
          >
            Criar Autorização de Retorno
          </Button>
        </Group>
      )}
    </div>
  )
}
