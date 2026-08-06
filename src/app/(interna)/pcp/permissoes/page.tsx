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
      api.get('/pcp/permissoes').catch((err) => { console.error('Erro /pcp/permissoes:', err?.response?.status, err?.response?.data); return { data: [] } }),
      api.get('/tipos-processo', { params: { status: 'true' } }).catch((err) => { console.error('Erro /tipos-processo:', err?.response?.status, err?.response?.data); return { data: { data: [] } } }),
    ]).then(([permRes, tiposRes]) => {
      const dados = permRes.data
      console.log('Permissoes response:', dados)
      setUsuarios(Array.isArray(dados) ? dados : [])
      const tiposData = tiposRes.data?.data || tiposRes.data || []
      setTiposProcesso(Array.isArray(tiposData) ? tiposData : [])
      if (!Array.isArray(dados) || dados.length === 0) {
        notifications.show({ title: 'Aviso', message: `Resposta da API: ${JSON.stringify(dados).substring(0, 200)}`, color: 'yellow' })
      }
    }).catch((err) => {
      notifications.show({ title: 'Erro', message: `Falha: ${err?.message || 'desconhecido'}`, color: 'red' })
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
            {usuarios.map((u: any) => (
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
            {usuarios.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={5}>
                  <Text ta="center" c="dimmed" py="md">Nenhum usuário encontrado. Verifique se há usuários cadastrados em Configurador → Usuários vinculados a esta empresa.</Text>
                </Table.Td>
              </Table.Tr>
            )}
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

            <Text size="sm" fw={600} mt="md">Ações permitidas por Tipo de Processo</Text>
            <Text size="xs" c="dimmed">Configure quais ações o usuário pode executar em cada tipo de processo</Text>

            {tiposProcesso.map((tp: any) => {
              const tpKey = tp.id
              const permsProcesso = formPermissoes.permissoesPorProcesso?.[tpKey] || {}
              const getVal = (campo: string) => permsProcesso[campo] ?? true

              function setVal(campo: string, valor: boolean) {
                setFormPermissoes((p: any) => ({
                  ...p,
                  permissoesPorProcesso: {
                    ...(p.permissoesPorProcesso || {}),
                    [tpKey]: { ...(p.permissoesPorProcesso?.[tpKey] || {}), [campo]: valor },
                  },
                }))
              }

              return (
                <Card key={tp.id} withBorder padding="xs" mb="xs">
                  <Text size="sm" fw={600} mb={4}>{tp.descricao || tp.codigo}</Text>
                  <Group gap="sm" wrap="wrap">
                    <Checkbox size="xs" label="Iniciar" checked={getVal('podeIniciar')} onChange={(e) => setVal('podeIniciar', e.currentTarget.checked)} />
                    <Checkbox size="xs" label="Finalizar" checked={getVal('podeFinalizar')} onChange={(e) => setVal('podeFinalizar', e.currentTarget.checked)} />
                    <Checkbox size="xs" label="Pausar" checked={getVal('podePausar')} onChange={(e) => setVal('podePausar', e.currentTarget.checked)} />
                    <Checkbox size="xs" label="Apontar" checked={getVal('podeApontar')} onChange={(e) => setVal('podeApontar', e.currentTarget.checked)} />
                    <Checkbox size="xs" label="Mover" checked={getVal('podeMover')} onChange={(e) => setVal('podeMover', e.currentTarget.checked)} />
                    <Checkbox size="xs" label="Desmembrar" checked={getVal('podeDesmembrar')} onChange={(e) => setVal('podeDesmembrar', e.currentTarget.checked)} />
                    <Checkbox size="xs" label="Re-extrair" checked={getVal('podeReextrair')} onChange={(e) => setVal('podeReextrair', e.currentTarget.checked)} />
                    <Checkbox size="xs" label="Prioridade" checked={getVal('podeAlterarPrioridade')} onChange={(e) => setVal('podeAlterarPrioridade', e.currentTarget.checked)} />
                    <Checkbox size="xs" label="Postergar" checked={getVal('podePostergarEntrega')} onChange={(e) => setVal('podePostergarEntrega', e.currentTarget.checked)} />
                    <Checkbox size="xs" label="Acomp." checked={getVal('podeEditarObservacao')} onChange={(e) => setVal('podeEditarObservacao', e.currentTarget.checked)} />
                  </Group>
                </Card>
              )
            })}

            <Text size="sm" fw={600} mt="xs">Organização (global)</Text>
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
