'use client'

import { useEffect, useState } from 'react'
import {
  Card, Group, Text, TextInput, Textarea, Table, Badge, LoadingOverlay, Pagination,
  Button, Modal, Select, ActionIcon, Tabs, Tooltip, Stack, TagsInput, Alert, Menu,
} from '@mantine/core'
import {
  IconSearch, IconPlus, IconTrash, IconEdit, IconRadar2, IconRefresh,
  IconUserPlus, IconInfoCircle, IconDotsVertical,
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { usePerfilGuard } from '@/hooks/usePerfilGuard'
import {
  useConfiguracoesProspeccao, useCriarConfiguracao, useAtualizarConfiguracao, useExcluirConfiguracao,
  useDispararBusca, useProspects, useAtualizarProspect, useExcluirProspect, useEnriquecerProspect,
  useConverterProspect, ConfiguracaoProspeccao, Prospect, StatusFunil,
} from '@/data/hooks/vendas/useProspeccao'

const STATUS_OPCOES: { value: StatusFunil; label: string; color: string }[] = [
  { value: 'NOVO', label: 'Novo', color: 'blue' },
  { value: 'EM_CONTATO', label: 'Em contato', color: 'yellow' },
  { value: 'QUALIFICADO', label: 'Qualificado', color: 'teal' },
  { value: 'DESCARTADO', label: 'Descartado', color: 'gray' },
  { value: 'CONVERTIDO', label: 'Convertido', color: 'green' },
]

const statusInfo = (s: string) => STATUS_OPCOES.find((o) => o.value === s) || STATUS_OPCOES[0]

export default function ProspeccaoPage() {
  useModuloGuard('VENDAS')
  usePerfilGuard(['ADMIN', 'SUPER_ADMIN'])
  useEffect(() => { document.title = 'Vizor - Prospectar Clientes' }, [])

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Vendas / Prospectar Clientes</Text>
      <Text size="xl" fw={600} mb="lg">Prospectar Clientes</Text>

      <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light" mb="md">
        Configure o perfil de empresa que você quer prospectar (CNAEs + UF/cidade) e dispare a busca
        na base oficial de CNPJ. Os leads encontrados podem ser qualificados e convertidos em clientes.
      </Alert>

      <Tabs defaultValue="prospects">
        <Tabs.List mb="md">
          <Tabs.Tab value="prospects" leftSection={<IconRadar2 size={16} />}>Leads (Prospects)</Tabs.Tab>
          <Tabs.Tab value="configuracoes" leftSection={<IconEdit size={16} />}>Configurações de Busca</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="prospects"><ProspectsTab /></Tabs.Panel>
        <Tabs.Panel value="configuracoes"><ConfiguracoesTab /></Tabs.Panel>
      </Tabs>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// ABA CONFIGURAÇÕES
// ═══════════════════════════════════════════════════════════════════════════
function ConfiguracoesTab() {
  const { data, isLoading } = useConfiguracoesProspeccao()
  const criar = useCriarConfiguracao()
  const atualizar = useAtualizarConfiguracao()
  const excluir = useExcluirConfiguracao()
  const buscar = useDispararBusca()

  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<ConfiguracaoProspeccao | null>(null)
  const [form, setForm] = useState<{ nome: string; descricao: string; cnaes: string[]; uf: string; cidade: string; situacao: string }>(
    { nome: '', descricao: '', cnaes: [], uf: '', cidade: '', situacao: 'ATIVA' },
  )

  const abrirNovo = () => {
    setEditando(null)
    setForm({ nome: '', descricao: '', cnaes: [], uf: '', cidade: '', situacao: 'ATIVA' })
    setModalOpen(true)
  }

  const abrirEdicao = (c: ConfiguracaoProspeccao) => {
    setEditando(c)
    setForm({
      nome: c.nome, descricao: c.descricao || '',
      cnaes: (c.cnaes || '').split(',').filter(Boolean),
      uf: c.uf || '', cidade: c.cidade || '', situacao: c.situacao || 'ATIVA',
    })
    setModalOpen(true)
  }

  const salvar = async () => {
    if (!form.nome.trim()) { notifications.show({ message: 'Informe o nome', color: 'red' }); return }
    if (form.cnaes.length === 0) { notifications.show({ message: 'Informe ao menos um CNAE', color: 'red' }); return }
    const payload = {
      nome: form.nome, descricao: form.descricao || null, cnaes: form.cnaes,
      uf: form.uf || null, cidade: form.cidade || null, situacao: form.situacao,
    }
    try {
      if (editando) await atualizar.mutateAsync({ id: editando.id, ...payload })
      else await criar.mutateAsync(payload)
      notifications.show({ message: 'Configuração salva', color: 'green' })
      setModalOpen(false)
    } catch (e: any) {
      notifications.show({ message: e?.response?.data?.message || 'Erro ao salvar', color: 'red' })
    }
  }

  const dispararBusca = async (c: ConfiguracaoProspeccao) => {
    try {
      const res = await buscar.mutateAsync(c.id)
      const msg = `${res.totalNovo} novo(s) de ${res.totalEncontrado} encontrado(s).`
      notifications.show({ title: 'Busca concluída', message: msg, color: 'green' })
      if (res.avisos?.length) {
        res.avisos.forEach((a) => notifications.show({ message: a, color: 'yellow', autoClose: 8000 }))
      }
    } catch (e: any) {
      notifications.show({ message: e?.response?.data?.message || 'Erro na busca', color: 'red' })
    }
  }

  const remover = async (c: ConfiguracaoProspeccao) => {
    if (!confirm(`Excluir a configuração "${c.nome}"?`)) return
    await excluir.mutateAsync(c.id)
    notifications.show({ message: 'Configuração excluída', color: 'green' })
  }

  const items = data?.data || []

  return (
    <Card pos="relative">
      <LoadingOverlay visible={isLoading} />
      <Group justify="space-between" mb="md">
        <Text fw={500}>Perfis de busca cadastrados</Text>
        <Button leftSection={<IconPlus size={16} />} onClick={abrirNovo}>Nova configuração</Button>
      </Group>

      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Nome</Table.Th><Table.Th>CNAEs</Table.Th><Table.Th>UF / Cidade</Table.Th>
            <Table.Th>Situação</Table.Th><Table.Th>Leads</Table.Th><Table.Th ta="right">Ações</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {items.map((c) => (
            <Table.Tr key={c.id}>
              <Table.Td fw={500}>{c.nome}</Table.Td>
              <Table.Td className="font-mono text-xs">{c.cnaes}</Table.Td>
              <Table.Td>{[c.uf, c.cidade].filter(Boolean).join(' / ') || '—'}</Table.Td>
              <Table.Td>{c.situacao}</Table.Td>
              <Table.Td>{c._count?.prospects ?? 0}</Table.Td>
              <Table.Td>
                <Group gap="xs" justify="flex-end">
                  <Tooltip label="Disparar busca">
                    <ActionIcon variant="light" color="teal" loading={buscar.isPending} onClick={() => dispararBusca(c)}>
                      <IconRadar2 size={16} />
                    </ActionIcon>
                  </Tooltip>
                  <ActionIcon variant="light" onClick={() => abrirEdicao(c)}><IconEdit size={16} /></ActionIcon>
                  <ActionIcon variant="light" color="red" onClick={() => remover(c)}><IconTrash size={16} /></ActionIcon>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
          {!isLoading && items.length === 0 && (
            <Table.Tr><Table.Td colSpan={6} className="text-center py-8 text-zinc-500">Nenhuma configuração. Crie a primeira para começar a prospectar.</Table.Td></Table.Tr>
          )}
        </Table.Tbody>
      </Table>

      <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title={editando ? 'Editar configuração' : 'Nova configuração'} size="lg">
        <Stack>
          <TextInput label="Nome" placeholder="Ex.: Indústrias de cosméticos SP" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.currentTarget.value })} required />
          <Textarea label="Descrição" placeholder="Opcional" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.currentTarget.value })} autosize minRows={2} />
          <TagsInput
            label="CNAEs alvo"
            description="Códigos CNAE (só números). Enter para adicionar cada um. Ex.: 2063100"
            placeholder="Digite um CNAE e Enter"
            value={form.cnaes}
            onChange={(v) => setForm({ ...form, cnaes: v })}
          />
          <Group grow>
            <TextInput label="UF" placeholder="SP" maxLength={2} value={form.uf} onChange={(e) => setForm({ ...form, uf: e.currentTarget.value.toUpperCase() })} />
            <TextInput label="Cidade" placeholder="Opcional" value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.currentTarget.value })} />
          </Group>
          <Select
            label="Situação cadastral"
            data={[{ value: 'ATIVA', label: 'Ativa' }, { value: 'BAIXADA', label: 'Baixada' }, { value: 'SUSPENSA', label: 'Suspensa' }, { value: 'INAPTA', label: 'Inapta' }]}
            value={form.situacao} onChange={(v) => setForm({ ...form, situacao: v || 'ATIVA' })}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={salvar} loading={criar.isPending || atualizar.isPending}>Salvar</Button>
          </Group>
        </Stack>
      </Modal>
    </Card>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// ABA PROSPECTS (LEADS)
// ═══════════════════════════════════════════════════════════════════════════
function ProspectsTab() {
  const [search, setSearch] = useState('')
  const [statusFiltro, setStatusFiltro] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const limit = 20

  const { data, isLoading } = useProspects({
    busca: search || undefined,
    statusFunil: statusFiltro || undefined,
    page, limit,
  })
  const atualizar = useAtualizarProspect()
  const excluir = useExcluirProspect()
  const enriquecer = useEnriquecerProspect()
  const converter = useConverterProspect()

  const items = data?.data || []
  const total = data?.total || 0
  const totalPages = Math.ceil(total / limit)

  const mudarStatus = async (p: Prospect, status: StatusFunil) => {
    await atualizar.mutateAsync({ id: p.id, statusFunil: status })
  }

  const converterCliente = async (p: Prospect) => {
    try {
      const res = await converter.mutateAsync(p.id)
      notifications.show({
        title: 'Convertido em cliente',
        message: res?.reaproveitado ? 'Cliente já existia e foi vinculado.' : 'Cliente criado com sucesso.',
        color: 'green',
      })
    } catch (e: any) {
      notifications.show({ message: e?.response?.data?.message || 'Erro ao converter', color: 'red' })
    }
  }

  const enriquecerLead = async (p: Prospect) => {
    try {
      await enriquecer.mutateAsync(p.id)
      notifications.show({ message: 'Dados atualizados da base pública', color: 'green' })
    } catch (e: any) {
      notifications.show({ message: e?.response?.data?.message || 'Não foi possível enriquecer', color: 'yellow' })
    }
  }

  const remover = async (p: Prospect) => {
    if (!confirm(`Excluir o lead "${p.razaoSocial}"?`)) return
    await excluir.mutateAsync(p.id)
  }

  const formatCnpj = (c: string) => c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')

  return (
    <Card pos="relative">
      <LoadingOverlay visible={isLoading} />
      <Group mb="md">
        <TextInput placeholder="Buscar por razão social, fantasia ou CNPJ..." leftSection={<IconSearch size={16} />} value={search} onChange={(e) => { setSearch(e.currentTarget.value); setPage(1) }} className="w-96" />
        <Select
          placeholder="Todos os status" clearable
          data={STATUS_OPCOES.map((o) => ({ value: o.value, label: o.label }))}
          value={statusFiltro} onChange={(v) => { setStatusFiltro(v); setPage(1) }}
          w={200}
        />
      </Group>

      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Razão Social</Table.Th><Table.Th>CNPJ</Table.Th><Table.Th>CNAE</Table.Th>
            <Table.Th>Cidade/UF</Table.Th><Table.Th>Contato</Table.Th><Table.Th>Status</Table.Th><Table.Th ta="right">Ações</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {items.map((p) => {
            const si = statusInfo(p.statusFunil)
            const convertido = p.statusFunil === 'CONVERTIDO'
            return (
              <Table.Tr key={p.id}>
                <Table.Td>
                  <Text fw={500} size="sm">{p.razaoSocial}</Text>
                  {p.nomeFantasia && <Text size="xs" c="dimmed">{p.nomeFantasia}</Text>}
                </Table.Td>
                <Table.Td className="font-mono text-xs">{formatCnpj(p.cnpj)}</Table.Td>
                <Table.Td>
                  <Text size="xs">{p.cnaePrincipal || '—'}</Text>
                  {p.cnaeDescricao && <Text size="xs" c="dimmed" lineClamp={1}>{p.cnaeDescricao}</Text>}
                </Table.Td>
                <Table.Td>{p.cidade ? `${p.cidade}/${p.uf || ''}` : '—'}</Table.Td>
                <Table.Td>
                  <Text size="xs">{p.telefone || '—'}</Text>
                  {p.email && <Text size="xs" c="dimmed" lineClamp={1}>{p.email}</Text>}
                </Table.Td>
                <Table.Td>
                  <Select
                    variant="unstyled" size="xs" w={130} allowDeselect={false}
                    data={STATUS_OPCOES.map((o) => ({ value: o.value, label: o.label }))}
                    value={p.statusFunil}
                    onChange={(v) => v && mudarStatus(p, v as StatusFunil)}
                    disabled={convertido}
                    leftSection={<Badge size="xs" color={si.color} variant="dot" />}
                  />
                </Table.Td>
                <Table.Td>
                  <Group gap="xs" justify="flex-end">
                    {!convertido && (
                      <Tooltip label="Converter em cliente">
                        <ActionIcon variant="light" color="green" loading={converter.isPending} onClick={() => converterCliente(p)}>
                          <IconUserPlus size={16} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                    <Menu shadow="md" position="bottom-end">
                      <Menu.Target><ActionIcon variant="subtle"><IconDotsVertical size={16} /></ActionIcon></Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item leftSection={<IconRefresh size={14} />} onClick={() => enriquecerLead(p)}>Atualizar dados (base pública)</Menu.Item>
                        <Menu.Item color="red" leftSection={<IconTrash size={14} />} onClick={() => remover(p)}>Excluir lead</Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  </Group>
                </Table.Td>
              </Table.Tr>
            )
          })}
          {!isLoading && items.length === 0 && (
            <Table.Tr><Table.Td colSpan={7} className="text-center py-8 text-zinc-500">Nenhum lead ainda. Vá em "Configurações de Busca", crie um perfil e dispare a busca.</Table.Td></Table.Tr>
          )}
        </Table.Tbody>
      </Table>

      {totalPages > 1 && <Group justify="center" mt="md"><Pagination total={totalPages} value={page} onChange={setPage} /></Group>}
    </Card>
  )
}
