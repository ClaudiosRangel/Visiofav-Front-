'use client'

import { useState, useEffect } from 'react'
import {
  Card, Group, Text, Table, Badge, Button, Modal, TextInput,
  Select, NumberInput, MultiSelect, LoadingOverlay, Pagination,
  Stack,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import {
  IconPlus, IconEdit, IconPlayerPause, IconPlayerPlay,
} from '@tabler/icons-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notifications } from '@mantine/notifications'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'

const ENTIDADE_OPTIONS = [
  { value: 'PEDIDO', label: 'Pedido' },
  { value: 'CONFERENCIA', label: 'Conferência' },
  { value: 'RECEBIMENTO', label: 'Recebimento' },
  { value: 'OCUPACAO', label: 'Ocupação' },
  { value: 'SEPARACAO', label: 'Separação' },
]

const CONDICAO_OPTIONS = [
  { value: 'TEMPO_EXCEDIDO', label: 'Tempo Excedido' },
  { value: 'PERCENTUAL_ACIMA', label: 'Percentual Acima' },
  { value: 'PERCENTUAL_ABAIXO', label: 'Percentual Abaixo' },
  { value: 'QUANTIDADE_ACIMA', label: 'Quantidade Acima' },
  { value: 'QUANTIDADE_ABAIXO', label: 'Quantidade Abaixo' },
]

const UNIDADE_OPTIONS = [
  { value: 'MINUTOS', label: 'Minutos' },
  { value: 'PERCENTUAL', label: 'Percentual' },
  { value: 'UNIDADES', label: 'Unidades' },
]

const SEVERIDADE_OPTIONS = [
  { value: 'INFO', label: 'Info' },
  { value: 'WARNING', label: 'Warning' },
  { value: 'CRITICAL', label: 'Critical' },
]

const ACOES_OPTIONS = [
  { value: 'NOTIFICACAO_APP', label: 'Notificação App' },
  { value: 'EMAIL', label: 'E-mail' },
  { value: 'WEBHOOK', label: 'Webhook' },
  { value: 'ESCALAR_GESTOR', label: 'Escalar Gestor' },
]

const SEVERIDADE_COLORS: Record<string, string> = {
  INFO: 'blue',
  WARNING: 'yellow',
  CRITICAL: 'red',
}

interface RegraForm {
  id?: string
  nome: string
  entidade: string
  condicao: string
  threshold: number | ''
  unidade: string
  severidade: string
  acoes: string[]
  cooldownMinutos: number | ''
}

const INITIAL_FORM: RegraForm = {
  nome: '',
  entidade: '',
  condicao: '',
  threshold: '',
  unidade: '',
  severidade: 'WARNING',
  acoes: [],
  cooldownMinutos: 30,
}

export default function RegrasKpiPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'Vizor - WMS - Regras KPI' }, [])

  const queryClient = useQueryClient()
  const [opened, { open, close }] = useDisclosure(false)
  const [form, setForm] = useState<RegraForm>(INITIAL_FORM)
  const [page, setPage] = useState(1)
  const limit = 20

  const { data: resp, isLoading } = useQuery<any>({
    queryKey: ['kpi-regras', page],
    queryFn: async () => {
      const { data } = await api.get('/kpi/regras', { params: { page, limit } })
      return data
    },
  })

  const salvarMutation = useMutation({
    mutationFn: async (payload: RegraForm) => {
      const body = {
        nome: payload.nome,
        entidade: payload.entidade,
        condicao: payload.condicao,
        threshold: Number(payload.threshold),
        unidade: payload.unidade,
        severidade: payload.severidade,
        acoes: payload.acoes,
        cooldownMinutos: Number(payload.cooldownMinutos) || 30,
      }
      if (payload.id) {
        await api.put(`/kpi/regras/${payload.id}`, body)
      } else {
        await api.post('/kpi/regras', body)
      }
    },
    onSuccess: () => {
      notifications.show({
        title: 'Sucesso',
        message: form.id ? 'Regra atualizada' : 'Regra criada com sucesso',
        color: 'green',
      })
      queryClient.invalidateQueries({ queryKey: ['kpi-regras'] })
      close()
      setForm(INITIAL_FORM)
    },
    onError: () => {
      notifications.show({
        title: 'Erro',
        message: 'Falha ao salvar regra',
        color: 'red',
      })
    },
  })

  const toggleMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      if (!ativo) {
        await api.delete(`/kpi/regras/${id}`)
      } else {
        await api.put(`/kpi/regras/${id}`, { ativo: true })
      }
    },
    onSuccess: () => {
      notifications.show({
        title: 'Sucesso',
        message: 'Status da regra alterado',
        color: 'green',
      })
      queryClient.invalidateQueries({ queryKey: ['kpi-regras'] })
    },
    onError: () => {
      notifications.show({
        title: 'Erro',
        message: 'Falha ao alterar status da regra',
        color: 'red',
      })
    },
  })

  const regras = resp?.data || []
  const total = resp?.total || 0
  const totalPages = Math.ceil(total / limit)

  function handleEdit(regra: any) {
    setForm({
      id: regra.id,
      nome: regra.nome,
      entidade: regra.entidade,
      condicao: regra.condicao,
      threshold: regra.threshold,
      unidade: regra.unidade,
      severidade: regra.severidade,
      acoes: regra.acoes || [],
      cooldownMinutos: regra.cooldownMinutos || 30,
    })
    open()
  }

  function handleNova() {
    setForm(INITIAL_FORM)
    open()
  }

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Gestão / KPI / Regras</Text>

      <Group justify="space-between" mb="lg">
        <Text size="xl" fw={600}>Regras KPI</Text>
        <Button leftSection={<IconPlus size={16} />} onClick={handleNova}>
          Nova Regra
        </Button>
      </Group>

      {/* Table */}
      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Nome</Table.Th>
              <Table.Th>Entidade</Table.Th>
              <Table.Th>Condição</Table.Th>
              <Table.Th>Threshold</Table.Th>
              <Table.Th>Severidade</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {regras.map((regra: any) => (
              <Table.Tr key={regra.id}>
                <Table.Td fw={500}>{regra.nome}</Table.Td>
                <Table.Td>{regra.entidade}</Table.Td>
                <Table.Td>{regra.condicao}</Table.Td>
                <Table.Td>
                  {regra.threshold} {regra.unidade === 'PERCENTUAL' ? '%' : regra.unidade === 'MINUTOS' ? 'min' : 'un'}
                </Table.Td>
                <Table.Td>
                  <Badge
                    variant="light"
                    color={SEVERIDADE_COLORS[regra.severidade] || 'gray'}
                  >
                    {regra.severidade}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Badge variant="light" color={regra.ativo ? 'green' : 'gray'}>
                    {regra.ativo ? 'Ativo' : 'Inativo'}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <Button
                      variant="subtle"
                      size="xs"
                      leftSection={<IconEdit size={14} />}
                      onClick={() => handleEdit(regra)}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="subtle"
                      size="xs"
                      color={regra.ativo ? 'orange' : 'green'}
                      leftSection={regra.ativo ? <IconPlayerPause size={14} /> : <IconPlayerPlay size={14} />}
                      onClick={() => toggleMutation.mutate({ id: regra.id, ativo: !regra.ativo })}
                    >
                      {regra.ativo ? 'Desativar' : 'Ativar'}
                    </Button>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
            {regras.length === 0 && !isLoading && (
              <Table.Tr>
                <Table.Td colSpan={7} className="text-center py-8 text-zinc-500">
                  Nenhuma regra configurada
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>

        {totalPages > 1 && (
          <Group justify="center" mt="md">
            <Pagination value={page} onChange={setPage} total={totalPages} />
          </Group>
        )}
      </Card>

      {/* Modal Nova/Editar Regra */}
      <Modal
        opened={opened}
        onClose={close}
        title={form.id ? 'Editar Regra' : 'Nova Regra'}
        size="lg"
      >
        <Stack gap="sm">
          <TextInput
            label="Nome"
            placeholder="Nome da regra"
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.currentTarget.value })}
            required
          />
          <Group grow>
            <Select
              label="Entidade"
              placeholder="Selecione"
              data={ENTIDADE_OPTIONS}
              value={form.entidade}
              onChange={(val) => setForm({ ...form, entidade: val || '' })}
              required
            />
            <Select
              label="Condição"
              placeholder="Selecione"
              data={CONDICAO_OPTIONS}
              value={form.condicao}
              onChange={(val) => setForm({ ...form, condicao: val || '' })}
              required
            />
          </Group>
          <Group grow>
            <NumberInput
              label="Threshold"
              placeholder="Valor limite"
              value={form.threshold}
              onChange={(val) => setForm({ ...form, threshold: val as number })}
              min={0}
              required
            />
            <Select
              label="Unidade"
              placeholder="Selecione"
              data={UNIDADE_OPTIONS}
              value={form.unidade}
              onChange={(val) => setForm({ ...form, unidade: val || '' })}
              required
            />
          </Group>
          <Group grow>
            <Select
              label="Severidade"
              placeholder="Selecione"
              data={SEVERIDADE_OPTIONS}
              value={form.severidade}
              onChange={(val) => setForm({ ...form, severidade: val || 'WARNING' })}
              required
            />
            <NumberInput
              label="Cooldown (minutos)"
              placeholder="30"
              value={form.cooldownMinutos}
              onChange={(val) => setForm({ ...form, cooldownMinutos: val as number })}
              min={1}
            />
          </Group>
          <MultiSelect
            label="Ações"
            placeholder="Selecione as ações"
            data={ACOES_OPTIONS}
            value={form.acoes}
            onChange={(val) => setForm({ ...form, acoes: val })}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={close}>Cancelar</Button>
            <Button
              onClick={() => salvarMutation.mutate(form)}
              loading={salvarMutation.isPending}
            >
              {form.id ? 'Salvar' : 'Criar Regra'}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </div>
  )
}
