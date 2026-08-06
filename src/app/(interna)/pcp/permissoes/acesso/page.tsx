'use client'

import { useState, useEffect } from 'react'
import { Card, Table, Text, Group, Badge, Stack, Loader, Center, Checkbox, Button, Select } from '@mantine/core'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'
import { usePerfilGuard } from '@/hooks/usePerfilGuard'

// Menus do PCP disponíveis para controle de acesso
const MENUS_PCP = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'ordens-producao', label: 'Ordens de Produção' },
  { id: 'importar-op', label: 'Importar OP (PDF)' },
  { id: 'de-para', label: 'De/Para (Vínculos)' },
  { id: 'kanban', label: 'Kanban' },
  { id: 'programacao', label: 'Programação' },
  { id: 'quadro-producao', label: 'Quadro de Produção' },
  { id: 'apontamentos', label: 'Apontamentos' },
  { id: 'liberacoes', label: 'Liberação de Materiais' },
  { id: 'conversao', label: 'Conversão de Unidades' },
  { id: 'cadastros', label: 'Cadastros' },
  { id: 'configuracao', label: 'Configuração PCP' },
  { id: 'permissoes', label: 'Permissões' },
  { id: 'logs', label: 'Logs de Auditoria' },
]

// Ações possíveis por menu
const ACOES_POR_MENU: Record<string, string[]> = {
  'ordens-producao': ['visualizar', 'criar', 'editar', 'excluir', 'alterar-status', 'cancelar'],
  'importar-op': ['visualizar', 'importar', 'confirmar'],
  'programacao': ['visualizar', 'iniciar', 'finalizar', 'pausar', 'apontar', 'mover', 'desmembrar'],
  'liberacoes': ['visualizar', 'criar', 'separar', 'entregar'],
  'cadastros': ['visualizar', 'criar', 'editar', 'excluir'],
  'configuracao': ['visualizar', 'editar'],
}

const ACOES_LABELS: Record<string, string> = {
  visualizar: 'Visualizar',
  criar: 'Criar',
  editar: 'Editar',
  excluir: 'Excluir',
  'alterar-status': 'Alterar Status',
  cancelar: 'Cancelar',
  importar: 'Importar',
  confirmar: 'Confirmar',
  iniciar: 'Iniciar',
  finalizar: 'Finalizar',
  pausar: 'Pausar',
  apontar: 'Apontar',
  mover: 'Mover',
  desmembrar: 'Desmembrar',
  separar: 'Separar',
  entregar: 'Entregar',
}

export default function AcessoMenusPage() {
  usePerfilGuard(['ADMIN', 'SUPER_ADMIN'])
  useEffect(() => { document.title = 'PCP - Permissões de Acesso' }, [])

  const [usuarios, setUsuarios] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState<string | null>(null)
  const [formAcesso, setFormAcesso] = useState<Record<string, { habilitado: boolean; acoes: string[] }>>({})
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    api.get('/pcp/permissoes').then((res) => {
      setUsuarios(Array.isArray(res.data) ? res.data : [])
    }).catch(() => {
      notifications.show({ title: 'Erro', message: 'Falha ao carregar usuários', color: 'red' })
    }).finally(() => setLoading(false))
  }, [])

  function iniciarEdicao(usuario: any) {
    setEditando(usuario.usuarioId)
    // Carregar acesso existente do usuário
    const acesso = usuario.permissoes?.acessoMenus || {}
    const form: Record<string, { habilitado: boolean; acoes: string[] }> = {}
    for (const menu of MENUS_PCP) {
      const menuConfig = acesso[menu.id]
      form[menu.id] = {
        habilitado: menuConfig?.habilitado ?? true,
        acoes: menuConfig?.acoes ?? (ACOES_POR_MENU[menu.id] || ['visualizar']),
      }
    }
    setFormAcesso(form)
  }

  function toggleMenu(menuId: string) {
    setFormAcesso(prev => ({
      ...prev,
      [menuId]: { ...prev[menuId], habilitado: !prev[menuId]?.habilitado },
    }))
  }

  function toggleAcao(menuId: string, acao: string) {
    setFormAcesso(prev => {
      const atual = prev[menuId]?.acoes || []
      const novas = atual.includes(acao) ? atual.filter(a => a !== acao) : [...atual, acao]
      return { ...prev, [menuId]: { ...prev[menuId], acoes: novas } }
    })
  }

  async function salvar() {
    if (!editando) return
    setSalvando(true)
    try {
      await api.put(`/pcp/permissoes/${editando}`, { acessoMenus: formAcesso })
      setUsuarios(prev => prev.map(u => u.usuarioId === editando
        ? { ...u, permissoes: { ...u.permissoes, acessoMenus: formAcesso } }
        : u
      ))
      setEditando(null)
      notifications.show({ title: 'Sucesso', message: 'Acesso atualizado', color: 'green' })
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao salvar', color: 'red' })
    } finally {
      setSalvando(false)
    }
  }

  if (loading) return <Center py="xl"><Loader /></Center>

  return (
    <Stack gap="md">
      <Text size="xs" c="dimmed">PCP / Permissões / Acesso</Text>
      <Text size="xl" fw={600}>Controle de Acesso — Menus do PCP</Text>
      <Text size="sm" c="dimmed">Configure quais menus e ações cada usuário pode acessar no módulo PCP.</Text>

      <Card withBorder>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Usuário</Table.Th>
              <Table.Th>Perfil</Table.Th>
              <Table.Th>Menus Habilitados</Table.Th>
              <Table.Th>Ação</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {usuarios.map((u: any) => {
              const acessoMenus = u.permissoes?.acessoMenus || {}
              const menusHabilitados = MENUS_PCP.filter(m => acessoMenus[m.id]?.habilitado !== false).length
              return (
                <Table.Tr key={u.usuarioId}>
                  <Table.Td>
                    <Text size="sm" fw={500}>{u.nome}</Text>
                    <Text size="xs" c="dimmed">{u.email}</Text>
                  </Table.Td>
                  <Table.Td><Badge size="xs">{u.perfil}</Badge></Table.Td>
                  <Table.Td><Text size="xs">{menusHabilitados}/{MENUS_PCP.length} menus</Text></Table.Td>
                  <Table.Td>
                    <Button size="compact-xs" variant="light" onClick={() => iniciarEdicao(u)}>Configurar</Button>
                  </Table.Td>
                </Table.Tr>
              )
            })}
            {usuarios.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={4}>
                  <Text ta="center" c="dimmed" py="md">Nenhum usuário encontrado.</Text>
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
          <Stack gap="xs">
            {MENUS_PCP.map((menu) => {
              const config = formAcesso[menu.id] || { habilitado: true, acoes: [] }
              const acoesDisponiveis = ACOES_POR_MENU[menu.id]
              return (
                <Card key={menu.id} withBorder padding="xs">
                  <Group justify="space-between" mb={acoesDisponiveis && config.habilitado ? 4 : 0}>
                    <Checkbox
                      label={<Text size="sm" fw={500}>{menu.label}</Text>}
                      checked={config.habilitado}
                      onChange={() => toggleMenu(menu.id)}
                    />
                  </Group>
                  {config.habilitado && acoesDisponiveis && (
                    <Group gap="sm" ml="xl" wrap="wrap">
                      {acoesDisponiveis.map((acao) => (
                        <Checkbox
                          key={acao}
                          size="xs"
                          label={ACOES_LABELS[acao] || acao}
                          checked={config.acoes?.includes(acao) ?? true}
                          onChange={() => toggleAcao(menu.id, acao)}
                        />
                      ))}
                    </Group>
                  )}
                </Card>
              )
            })}

            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={() => setEditando(null)}>Cancelar</Button>
              <Button loading={salvando} onClick={salvar}>Salvar Acesso</Button>
            </Group>
          </Stack>
        </Card>
      )}
    </Stack>
  )
}
