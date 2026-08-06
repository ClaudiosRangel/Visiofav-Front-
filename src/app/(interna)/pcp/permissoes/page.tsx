'use client'

import { useState, useEffect } from 'react'
import { Card, Table, Text, Group, Badge, Stack, Loader, Center, Switch, Button, MultiSelect, Checkbox } from '@mantine/core'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'
import { usePerfilGuard } from '@/hooks/usePerfilGuard'

export default function PermissoesPcpPage() {
  usePerfilGuard(['ADMIN', 'SUPER_ADMIN'])
  useEffect(() => { document.title = 'PCP - Permissões de Programação' }, [])

  const [usuarios, setUsuarios] = useState<any[]>([])
  const [tiposProcesso, setTiposProcesso] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState<string | null>(null)
  const [formPermissoes, setFormPermissoes] = useState<any>({})
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    Promise.all([
      api.get('/pcp/permissoes'),
      api.get('/tipos-processo'),
    ]).then(([permRes, tiposRes]) => {
      setUsuarios(permRes.data)
      setTiposProcesso(tiposRes.data)
    }).catch(() => {
      notifications.show({ title: 'Erro', message: 'Falha ao carregar permissões', color: 'red' })
    }).finally(() => setLoading(false))
  }, [])

  function iniciarEdicao(usuario: any) {
    setEditando(usuario.usuarioId)
    setFormPermissoes({ ...usuario.permissoes })
  }

  async function salvar() {
    if (!editando) return
    setSalvando(true)
    try {
      await api.put(`/pcp/permissoes/${editando}`, formPermissoes)
      setUsuarios(prev => prev.map(u => u.usuarioId === editando ? { ...u, permissoes: { ...formPermissoes } } : u))
      setEditando(null)
      notifications.show({ title: 'Sucesso', message: 'Permissões atualizadas', color: 'green' })
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' })
    } finally {
      setSalvando(false)
    }
  }

  if (loading) return <Center py="xl"><Loader /></Center>

  const tiposOptions = tiposProcesso.map((tp: any) => ({ value: tp.id, label: tp.descricao || tp.codigo }))

  return (
    <Stack gap="md">
      <Text size="xs" c="dimmed">PCP / Permissões de Programação</Text>
      <Text size="xl" fw={600}>Permissões da Programação PCP</Text>
      <Text size="sm" c="dimmed">Configure quais ações cada usuário pode realizar no painel de programação, por tipo de processo.</Text>

      <Card withBorder>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Usuário</Table.Th>
              <Table.Th>Perfil</Table.Th>
              <Table.Th>Pré-Impressão</Table.Th>
              <Table.Th>Processos Visíveis</Table.Th>
              <Table.Th>Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {usuarios.filter((u: any) => u.perfil !== 'ADMIN' && u.perfil !== 'SUPER_ADMIN').map((u: any) => (
              <Table.Tr key={u.usuarioId}>
                <Table.Td>
                  <Text size="sm" fw={500}>{u.nome}</Text>
                  <Text size="xs" c="dimmed">{u.email}</Text>
                </Table.Td>
                <Table.Td><Badge size="xs">{u.perfil}</Badge></Table.Td>
                <Table.Td>{u.permissoes?.isPreImpressao ? <Badge color="green" size="xs">Sim</Badge> : <Badge color="gray" size="xs">Não</Badge>}</Table.Td>
                <Table.Td>
                  <Text size="xs">{u.permissoes?.tiposProcessoVisiveis?.length > 0
                    ? tiposProcesso.filter((tp: any) => u.permissoes.tiposProcessoVisiveis.includes(tp.id)).map((tp: any) => tp.descricao).join(', ')
                    : 'Todos'
                  }</Text>
                </Table.Td>
                <Table.Td>
                  <Button size="compact-xs" variant="light" onClick={() => iniciarEdicao(u)}>Configurar</Button>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Card>

      {/* Painel de edição */}
      {editando && (
        <Card withBorder padding="md">
          <Text fw={600} mb="md">Editando: {usuarios.find((u: any) => u.usuarioId === editando)?.nome}</Text>
          <Stack gap="sm">
            <MultiSelect
              label="Tipos de Processo visíveis (vazio = todos)"
              data={tiposOptions}
              value={formPermissoes.tiposProcessoVisiveis || []}
              onChange={(val) => setFormPermissoes((p: any) => ({ ...p, tiposProcessoVisiveis: val }))}
              clearable
              searchable
              placeholder="Todos os processos"
            />

            <Text size="sm" fw={600} mt="xs">Ações permitidas</Text>
            <Group gap="md" wrap="wrap">
              <Checkbox label="Iniciar" checked={formPermissoes.podeIniciar ?? true} onChange={(e) => setFormPermissoes((p: any) => ({ ...p, podeIniciar: e.currentTarget.checked }))} />
              <Checkbox label="Finalizar" checked={formPermissoes.podeFinalizar ?? true} onChange={(e) => setFormPermissoes((p: any) => ({ ...p, podeFinalizar: e.currentTarget.checked }))} />
              <Checkbox label="Pausar" checked={formPermissoes.podePausar ?? true} onChange={(e) => setFormPermissoes((p: any) => ({ ...p, podePausar: e.currentTarget.checked }))} />
              <Checkbox label="Apontar" checked={formPermissoes.podeApontar ?? true} onChange={(e) => setFormPermissoes((p: any) => ({ ...p, podeApontar: e.currentTarget.checked }))} />
              <Checkbox label="Mover p/ grupo" checked={formPermissoes.podeMover ?? true} onChange={(e) => setFormPermissoes((p: any) => ({ ...p, podeMover: e.currentTarget.checked }))} />
              <Checkbox label="Desmembrar" checked={formPermissoes.podeDesmembrar ?? true} onChange={(e) => setFormPermissoes((p: any) => ({ ...p, podeDesmembrar: e.currentTarget.checked }))} />
              <Checkbox label="Re-extrair PDF" checked={formPermissoes.podeReextrair ?? true} onChange={(e) => setFormPermissoes((p: any) => ({ ...p, podeReextrair: e.currentTarget.checked }))} />
              <Checkbox label="Alterar prioridade" checked={formPermissoes.podeAlterarPrioridade ?? true} onChange={(e) => setFormPermissoes((p: any) => ({ ...p, podeAlterarPrioridade: e.currentTarget.checked }))} />
              <Checkbox label="Postergar entrega" checked={formPermissoes.podePostergarEntrega ?? true} onChange={(e) => setFormPermissoes((p: any) => ({ ...p, podePostergarEntrega: e.currentTarget.checked }))} />
              <Checkbox label="Editar acompanhamento" checked={formPermissoes.podeEditarObservacao ?? true} onChange={(e) => setFormPermissoes((p: any) => ({ ...p, podeEditarObservacao: e.currentTarget.checked }))} />
            </Group>

            <Text size="sm" fw={600} mt="xs">Organização</Text>
            <Group gap="md" wrap="wrap">
              <Checkbox label="Reordenar fila (drag OPs)" checked={formPermissoes.podeReordenarFila ?? true} onChange={(e) => setFormPermissoes((p: any) => ({ ...p, podeReordenarFila: e.currentTarget.checked }))} />
              <Checkbox label="Reordenar grupos (drag centros)" checked={formPermissoes.podeReordenarGrupos ?? true} onChange={(e) => setFormPermissoes((p: any) => ({ ...p, podeReordenarGrupos: e.currentTarget.checked }))} />
              <Checkbox label="Criar novo grupo" checked={formPermissoes.podeCriarGrupo ?? true} onChange={(e) => setFormPermissoes((p: any) => ({ ...p, podeCriarGrupo: e.currentTarget.checked }))} />
            </Group>

            <Text size="sm" fw={600} mt="xs">Especial</Text>
            <Switch
              label="Funcionário de Pré-Impressão (habilita ação de pintar matriz)"
              checked={formPermissoes.isPreImpressao ?? false}
              onChange={(e) => setFormPermissoes((p: any) => ({ ...p, isPreImpressao: e.currentTarget.checked }))}
            />

            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={() => setEditando(null)}>Cancelar</Button>
              <Button loading={salvando} onClick={salvar}>Salvar Permissões</Button>
            </Group>
          </Stack>
        </Card>
      )}
    </Stack>
  )
}
