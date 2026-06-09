'use client'

import { useState, useEffect } from 'react'
import {
  Card, Group, Text, Table, Badge, Button, Modal, TextInput, Select, Switch,
  NumberInput, Textarea, LoadingOverlay, ActionIcon, Tooltip, Code,
} from '@mantine/core'
import { IconPlus, IconEdit, IconTrash, IconArrowUp, IconArrowDown } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'

const tipoColors: Record<string, string> = {
  REGIAO: 'blue', ROTA: 'green', CLIENTE: 'orange', TRANSPORTADORA: 'grape',
  PRIORIDADE: 'red', VOLUME: 'cyan', HORARIO: 'yellow',
}

export default function WaveRegrasPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'VisioFab - WMS - Wave Regras' }, [])
  const queryClient = useQueryClient()

  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<any>(null)

  // Form state
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState<string | null>(null)
  const [prioridade, setPrioridade] = useState<number | undefined>(1)
  const [parametros, setParametros] = useState('')
  const [ativo, setAtivo] = useState(true)

  const { data: response, isLoading } = useQuery<any>({
    queryKey: ['wave-regras'],
    queryFn: async () => { const { data } = await api.get('/wave/regras'); return data },
  })

  const salvar = useMutation({
    mutationFn: async () => {
      let parsedParams = {}
      try { parsedParams = parametros ? JSON.parse(parametros) : {} } catch { throw new Error('JSON inválido nos parâmetros') }

      const payload = { nome, tipo, prioridade, parametros: parsedParams, ativo }
      if (editando) {
        const { data } = await api.put(`/wave/regras/${editando.id}`, payload)
        return data
      }
      const { data } = await api.post('/wave/regras', payload)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wave-regras'] })
      fecharModal()
      notifications.show({ title: 'Sucesso', message: editando ? 'Regra atualizada' : 'Regra criada', color: 'green' })
    },
    onError: (err: any) => {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || err.message, color: 'red' })
    },
  })

  const excluir = useMutation({
    mutationFn: async (id: string) => { const { data } = await api.delete(`/wave/regras/${id}`); return data },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wave-regras'] })
      notifications.show({ title: 'Removida', message: 'Regra excluída', color: 'green' })
    },
    onError: (err: any) => {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' })
    },
  })

  const reordenar = useMutation({
    mutationFn: async ({ id, direcao }: { id: string; direcao: 'up' | 'down' }) => {
      const { data } = await api.post(`/wave/regras/${id}/reordenar`, { direcao })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wave-regras'] })
    },
  })

  const toggleAtivo = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { data } = await api.patch(`/wave/regras/${id}`, { ativo })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wave-regras'] })
    },
  })

  function abrirNovo() {
    setEditando(null)
    setNome(''); setTipo(null); setPrioridade(1); setParametros(''); setAtivo(true)
    setModalOpen(true)
  }

  function abrirEditar(regra: any) {
    setEditando(regra)
    setNome(regra.nome || '')
    setTipo(regra.tipo || null)
    setPrioridade(regra.prioridade || 1)
    setParametros(regra.parametros ? JSON.stringify(regra.parametros, null, 2) : '')
    setAtivo(regra.ativo ?? true)
    setModalOpen(true)
  }

  function fecharModal() {
    setModalOpen(false)
    setEditando(null)
  }

  const regras = response?.data || []

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Wave Planning / Regras</Text>
      <Text size="xl" fw={600} mb="lg">Regras de Agrupamento</Text>

      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />

        <Group justify="flex-end" mb="md">
          <Button leftSection={<IconPlus size={16} />} onClick={abrirNovo}>Nova Regra</Button>
        </Group>

        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Prioridade</Table.Th>
              <Table.Th>Nome</Table.Th>
              <Table.Th>Tipo</Table.Th>
              <Table.Th>Parâmetros</Table.Th>
              <Table.Th>Ativo</Table.Th>
              <Table.Th>Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {regras.map((r: any, index: number) => (
              <Table.Tr key={r.id}>
                <Table.Td fw={600}>{r.prioridade || index + 1}</Table.Td>
                <Table.Td fw={500}>{r.nome}</Table.Td>
                <Table.Td>
                  <Badge color={tipoColors[r.tipo] || 'gray'} variant="light">{r.tipo}</Badge>
                </Table.Td>
                <Table.Td>
                  <Code className="text-xs max-w-[200px] truncate block">
                    {r.parametros ? JSON.stringify(r.parametros) : '{}'}
                  </Code>
                </Table.Td>
                <Table.Td>
                  <Switch
                    checked={r.ativo}
                    onChange={(e) => toggleAtivo.mutate({ id: r.id, ativo: e.currentTarget.checked })}
                    size="sm"
                  />
                </Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    <Tooltip label="Subir">
                      <ActionIcon variant="subtle" size="sm" disabled={index === 0}
                        onClick={() => reordenar.mutate({ id: r.id, direcao: 'up' })}>
                        <IconArrowUp size={14} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Descer">
                      <ActionIcon variant="subtle" size="sm" disabled={index === regras.length - 1}
                        onClick={() => reordenar.mutate({ id: r.id, direcao: 'down' })}>
                        <IconArrowDown size={14} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Editar">
                      <ActionIcon variant="light" color="blue" onClick={() => abrirEditar(r)}>
                        <IconEdit size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Excluir">
                      <ActionIcon variant="light" color="red" onClick={() => {
                        if (confirm(`Excluir regra "${r.nome}"?`)) excluir.mutate(r.id)
                      }}>
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
            {regras.length === 0 && (
              <Table.Tr><Table.Td colSpan={6} className="text-center py-8 text-zinc-500">Nenhuma regra cadastrada</Table.Td></Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>

      {/* Modal Criar/Editar */}
      <Modal opened={modalOpen} onClose={fecharModal} title={editando ? 'Editar Regra' : 'Nova Regra'} centered size="lg">
        <TextInput label="Nome *" value={nome} onChange={(e) => setNome(e.currentTarget.value)} mb="sm" />
        <Select
          label="Tipo *"
          data={[
            { value: 'REGIAO', label: 'Região' },
            { value: 'ROTA', label: 'Rota' },
            { value: 'CLIENTE', label: 'Cliente' },
            { value: 'TRANSPORTADORA', label: 'Transportadora' },
            { value: 'PRIORIDADE', label: 'Prioridade' },
            { value: 'VOLUME', label: 'Volume' },
            { value: 'HORARIO', label: 'Horário' },
          ]}
          value={tipo}
          onChange={setTipo}
          mb="sm"
        />
        <NumberInput label="Prioridade" min={1} max={99} value={prioridade}
          onChange={(v) => setPrioridade(typeof v === 'number' ? v : undefined)} mb="sm" />
        <Textarea
          label="Parâmetros (JSON)"
          placeholder='{"regioes": ["SP", "RJ"]}'
          value={parametros}
          onChange={(e) => setParametros(e.currentTarget.value)}
          minRows={4}
          mb="sm"
          styles={{ input: { fontFamily: 'monospace' } }}
        />
        <Switch label="Ativo" checked={ativo} onChange={(e) => setAtivo(e.currentTarget.checked)} mb="md" />
        <Group justify="flex-end">
          <Button variant="default" onClick={fecharModal}>Cancelar</Button>
          <Button onClick={() => salvar.mutate()} loading={salvar.isPending} disabled={!nome || !tipo}>
            {editando ? 'Salvar' : 'Criar'}
          </Button>
        </Group>
      </Modal>
    </div>
  )
}
