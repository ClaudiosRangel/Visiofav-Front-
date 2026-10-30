'use client'

/**
 * Permissões do módulo Comercial (B10) — espelha o padrão do PCP.
 * Só ADMIN acessa. Lista usuários da empresa e liga/desliga cada ação do
 * Comercial por usuário. Consome /orcamento-grafico/comercial/permissoes*.
 */
import { useState, useEffect } from 'react'
import {
  Card, Table, Text, Group, Badge, Stack, Loader, Center, Switch, Button, SimpleGrid, Title,
} from '@mantine/core'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'
import { usePerfilGuard } from '@/hooks/usePerfilGuard'

interface PermissoesComercial {
  podeVerComercial?: boolean
  podeCriarOrcamento?: boolean
  podeEnviarProposta?: boolean
  podeAprovarOrcamento?: boolean
  podeConverterPedido?: boolean
  podeAplicarDesconto?: boolean
  podeLiberarPcp?: boolean
  podeGerenciarAmostras?: boolean
  podeEditarCadastros?: boolean
}
interface UsuarioPerm {
  usuarioId: string
  nome: string
  email: string
  perfil: string
  permissoes: PermissoesComercial
}

const ACOES: Array<{ chave: keyof PermissoesComercial; label: string }> = [
  { chave: 'podeVerComercial', label: 'Acessar o módulo' },
  { chave: 'podeCriarOrcamento', label: 'Criar/editar orçamento' },
  { chave: 'podeEnviarProposta', label: 'Enviar proposta' },
  { chave: 'podeAprovarOrcamento', label: 'Aprovar orçamento' },
  { chave: 'podeConverterPedido', label: 'Converter em pedido' },
  { chave: 'podeAplicarDesconto', label: 'Aplicar desconto' },
  { chave: 'podeLiberarPcp', label: 'Liberar ao PCP' },
  { chave: 'podeGerenciarAmostras', label: 'Gerenciar amostras' },
  { chave: 'podeEditarCadastros', label: 'Editar cadastros' },
]

export default function PermissoesComercialPage() {
  usePerfilGuard(['ADMIN', 'SUPER_ADMIN'])
  useEffect(() => { document.title = 'Comercial - Permissões' }, [])

  const [usuarios, setUsuarios] = useState<UsuarioPerm[]>([])
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState<string | null>(null)
  const [form, setForm] = useState<PermissoesComercial>({})
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    api.get('/orcamento-grafico/comercial/permissoes')
      .then(({ data }) => setUsuarios(Array.isArray(data) ? data : []))
      .catch((err) => notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao carregar', color: 'red' }))
      .finally(() => setLoading(false))
  }, [])

  function iniciarEdicao(u: UsuarioPerm) {
    setEditando(u.usuarioId)
    setForm({ ...u.permissoes })
  }

  async function salvar() {
    if (!editando) return
    setSalvando(true)
    try {
      await api.put(`/orcamento-grafico/comercial/permissoes/${editando}`, form)
      setUsuarios((prev) => prev.map((u) => u.usuarioId === editando ? { ...u, permissoes: { ...form } } : u))
      setEditando(null)
      notifications.show({ title: 'Sucesso', message: 'Permissões atualizadas', color: 'green' })
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' })
    } finally {
      setSalvando(false)
    }
  }

  if (loading) return <Center py="xl"><Loader /></Center>

  return (
    <Stack gap="md">
      <div>
        <Title>Permissões do Comercial</Title>
        <Text size="sm" c="dimmed">Configure o que cada usuário pode fazer no módulo Comercial. Administradores têm acesso total. Sem configuração = tudo liberado.</Text>
      </div>

      <Card withBorder>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Usuário</Table.Th>
              <Table.Th>Perfil</Table.Th>
              <Table.Th>Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {usuarios.map((u) => {
              const emEdicao = editando === u.usuarioId
              const admin = ['ADMIN', 'SUPER_ADMIN'].includes(u.perfil)
              return (
                <Table.Tr key={u.usuarioId}>
                  <Table.Td>
                    <Text fw={500}>{u.nome}</Text>
                    <Text size="xs" c="dimmed">{u.email}</Text>
                  </Table.Td>
                  <Table.Td><Badge variant="light">{u.perfil}</Badge></Table.Td>
                  <Table.Td>
                    {admin ? (
                      <Text size="sm" c="dimmed">Acesso total (admin)</Text>
                    ) : emEdicao ? (
                      <Stack gap="xs">
                        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
                          {ACOES.map((a) => (
                            <Switch
                              key={a.chave}
                              label={a.label}
                              size="sm"
                              checked={form[a.chave] ?? true}
                              onChange={(e) => setForm((f) => ({ ...f, [a.chave]: e.currentTarget.checked }))}
                            />
                          ))}
                        </SimpleGrid>
                        <Group>
                          <Button size="xs" onClick={salvar} loading={salvando}>Salvar</Button>
                          <Button size="xs" variant="default" onClick={() => setEditando(null)}>Cancelar</Button>
                        </Group>
                      </Stack>
                    ) : (
                      <Group gap="xs">
                        <Group gap={4}>
                          {ACOES.filter((a) => (u.permissoes[a.chave] ?? true) === false).length === 0 ? (
                            <Badge color="green" variant="light">Tudo liberado</Badge>
                          ) : (
                            <Badge color="orange" variant="light">
                              {ACOES.filter((a) => (u.permissoes[a.chave] ?? true)).length}/{ACOES.length} liberadas
                            </Badge>
                          )}
                        </Group>
                        <Button size="compact-xs" variant="light" onClick={() => iniciarEdicao(u)}>Editar</Button>
                      </Group>
                    )}
                  </Table.Td>
                </Table.Tr>
              )
            })}
            {usuarios.length === 0 && (
              <Table.Tr><Table.Td colSpan={3}><Text ta="center" c="dimmed" py="md">Nenhum usuário.</Text></Table.Td></Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>
    </Stack>
  )
}
