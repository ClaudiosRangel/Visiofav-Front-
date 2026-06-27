'use client'

import { useEffect, useState } from 'react'
import { Title, Text, Card, Table, Badge, Stack, Group, Checkbox, Button, Tabs } from '@mantine/core'
import { IconShieldCheck, IconUsers } from '@tabler/icons-react'

const PERFIS = [
  { id: 'SUPER_ADMIN', label: 'Super Admin', desc: 'Acesso total ao sistema', color: 'red' },
  { id: 'ADMIN', label: 'Administrador', desc: 'Gerencia usuários e configurações', color: 'orange' },
  { id: 'GERENTE', label: 'Gerente', desc: 'Acesso gerencial aos módulos', color: 'blue' },
  { id: 'OPERADOR', label: 'Operador', desc: 'Executa operações diárias', color: 'green' },
  { id: 'VISUALIZADOR', label: 'Visualizador', desc: 'Apenas consulta', color: 'gray' },
]

const MODULOS = ['WMS', 'PCP', 'Vendas', 'Compras', 'Financeiro', 'Fiscal']
const ACOES = ['Ler', 'Criar', 'Editar', 'Excluir', 'Aprovar', 'Exportar']

export default function PermissoesPage() {
  useEffect(() => { document.title = 'Vizor - Permissões' }, [])

  const [perfilSelecionado, setPerfilSelecionado] = useState('ADMIN')
  const isSuperAdmin = perfilSelecionado === 'SUPER_ADMIN'

  return (
    <div className="max-w-[1200px] mx-auto">
      <div className="mb-8">
        <Title order={2} fw={700}>Permissões</Title>
        <Text size="sm" c="dimmed">Gerencie o acesso por perfil, módulo e ação</Text>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Lista de Perfis */}
        <div>
          <Text size="xs" fw={600} c="dimmed" tt="uppercase" mb="sm">Perfis de Acesso</Text>
          <Stack gap="xs">
            {PERFIS.map(perfil => (
              <Card
                key={perfil.id}
                shadow="xs"
                radius="md"
                p="sm"
                className={`cursor-pointer transition-all ${perfilSelecionado === perfil.id ? 'ring-2 ring-green-500' : 'hover:shadow-md'}`}
                onClick={() => setPerfilSelecionado(perfil.id)}
              >
                <Group gap="sm">
                  <Badge color={perfil.color} variant="light" size="xs">{perfil.label}</Badge>
                </Group>
                <Text size="xs" c="dimmed" mt={4}>{perfil.desc}</Text>
              </Card>
            ))}
          </Stack>
        </div>

        {/* Matriz de Permissões */}
        <div className="lg:col-span-3">
          <Card shadow="xs" radius="md" p="lg">
            <Group justify="space-between" mb="md">
              <Text size="sm" fw={600}>
                Permissões: {PERFIS.find(p => p.id === perfilSelecionado)?.label}
              </Text>
              {!isSuperAdmin && (
                <Button size="xs" variant="light">Salvar Alterações</Button>
              )}
            </Group>

            {isSuperAdmin && (
              <Badge color="red" variant="light" mb="md">
                Perfil não editável — acesso total
              </Badge>
            )}

            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Módulo</Table.Th>
                  {ACOES.map(acao => (
                    <Table.Th key={acao} ta="center">{acao}</Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {MODULOS.map(modulo => (
                  <Table.Tr key={modulo}>
                    <Table.Td fw={500}>{modulo}</Table.Td>
                    {ACOES.map(acao => (
                      <Table.Td key={acao} ta="center">
                        <Checkbox
                          size="xs"
                          defaultChecked={isSuperAdmin || acao === 'Ler'}
                          disabled={isSuperAdmin}
                        />
                      </Table.Td>
                    ))}
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Card>
        </div>
      </div>
    </div>
  )
}
