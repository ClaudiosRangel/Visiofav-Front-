'use client'

import { useEffect, useState } from 'react'
import {
  Title, Stack, Table, Group, Button, Badge, Text, Loader, Center,
  Modal, TextInput, Alert, CopyButton, ActionIcon, Tooltip, Code, Paper,
} from '@mantine/core'
import { IconPlus, IconRefresh, IconCopy, IconCheck, IconAlertTriangle, IconTrash } from '@tabler/icons-react'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'

/**
 * Chaves de API do agente Importador de OP do Calcgraf.
 * Spec: VisioFab.Wms.Back/.kiro/specs/importador-op-calcgraf (Tarefa 13 / Req 6.1).
 *
 * Lista/cria/revoga as `AgenteApiKey` da empresa. O token em claro é exibido
 * UMA ÚNICA VEZ na criação (o servidor guarda só o hash) — por isso o modal de
 * resultado destaca o token com botão copiar e aviso.
 *
 * API (base NEXT_PUBLIC_API_URL já inclui /api → paths relativos sem /api):
 *   GET   /pcp/agente-api-keys                 → [{ id, nome, status, ultimoUsoEm, criadoEm }]
 *   POST  /pcp/agente-api-keys  { nome }       → { key, token, aviso }
 *   PATCH /pcp/agente-api-keys/:id/revogar
 *
 * Restrito a ADMIN no backend; a tela é exibida normalmente (o backend barra
 * quem não for ADMIN). Padrão PCP: `api` direto + useState.
 */

interface AgenteApiKey {
  id: string
  nome: string
  status: 'ATIVO' | 'REVOGADO'
  ultimoUsoEm: string | null
  criadoEm: string
}

export default function AgenteApiKeysPage() {
  useEffect(() => {
    document.title = 'PCP - Chaves do Agente (Calcgraf)'
  }, [])

  const [data, setData] = useState<AgenteApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  // Modal de criação
  const [modalAberto, setModalAberto] = useState(false)
  const [nome, setNome] = useState('')
  const [salvando, setSalvando] = useState(false)

  // Token recém-criado (exibido uma única vez)
  const [tokenGerado, setTokenGerado] = useState<string | null>(null)
  const [nomeTokenGerado, setNomeTokenGerado] = useState<string>('')

  const [revogandoId, setRevogandoId] = useState<string | null>(null)

  async function carregar() {
    setLoading(true)
    setErro(null)
    try {
      const res = await api.get('/pcp/agente-api-keys')
      setData(Array.isArray(res.data) ? res.data : [])
    } catch (err: any) {
      setErro(err?.response?.data?.message || 'Falha ao carregar as chaves do agente.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [])

  function abrirModalCriar() {
    setNome('')
    setModalAberto(true)
  }

  async function criar() {
    if (!nome.trim()) {
      notifications.show({ title: 'Informe um nome', message: 'Dê um nome para identificar a chave.', color: 'red' })
      return
    }
    setSalvando(true)
    try {
      const res = await api.post('/pcp/agente-api-keys', { nome: nome.trim() })
      setModalAberto(false)
      setTokenGerado(res.data?.token || null)
      setNomeTokenGerado(res.data?.key?.nome || nome.trim())
      notifications.show({ title: 'Chave criada', message: `Chave "${nome.trim()}" gerada.`, color: 'green' })
      await carregar()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao criar a chave.', color: 'red' })
    } finally {
      setSalvando(false)
    }
  }

  async function revogar(k: AgenteApiKey) {
    const ok = window.confirm(
      `Revogar a chave "${k.nome}"?\n\nO agente que usa esta chave deixará de conseguir enviar OPs. Esta ação não pode ser desfeita.`,
    )
    if (!ok) return
    setRevogandoId(k.id)
    try {
      await api.patch(`/pcp/agente-api-keys/${k.id}/revogar`)
      notifications.show({ title: 'Chave revogada', message: `A chave "${k.nome}" foi revogada.`, color: 'blue' })
      await carregar()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao revogar a chave.', color: 'red' })
    } finally {
      setRevogandoId(null)
    }
  }

  const fmtData = (v: string | null) => (v ? new Date(v).toLocaleString('pt-BR') : '—')

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={3}>Chaves do Agente (Calcgraf)</Title>
          <Text size="sm" c="dimmed">
            Credenciais usadas pelo agente desktop para enviar OPs do Calcgraf ao
            Vizor. O token é exibido apenas uma vez, no momento da criação.
          </Text>
        </div>
        <Group gap="xs">
          <Button variant="light" leftSection={<IconRefresh size={16} />} onClick={carregar} loading={loading}>
            Atualizar
          </Button>
          <Button leftSection={<IconPlus size={16} />} onClick={abrirModalCriar}>
            Gerar nova chave
          </Button>
        </Group>
      </Group>

      {erro && (
        <Alert color="red" icon={<IconAlertTriangle size={16} />} title="Erro ao carregar">
          {erro}
        </Alert>
      )}

      {loading ? (
        <Center py="xl"><Loader /></Center>
      ) : data.length === 0 ? (
        <Center py="xl">
          <Text c="dimmed">Nenhuma chave cadastrada. Gere a primeira chave para o agente.</Text>
        </Center>
      ) : (
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Nome</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Último uso</Table.Th>
              <Table.Th>Criada em</Table.Th>
              <Table.Th ta="right">Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data.map((k) => (
              <Table.Tr key={k.id}>
                <Table.Td fw={600}>{k.nome}</Table.Td>
                <Table.Td>
                  <Badge color={k.status === 'ATIVO' ? 'green' : 'gray'} variant="light">
                    {k.status === 'ATIVO' ? 'Ativo' : 'Revogado'}
                  </Badge>
                </Table.Td>
                <Table.Td>{fmtData(k.ultimoUsoEm)}</Table.Td>
                <Table.Td>{fmtData(k.criadoEm)}</Table.Td>
                <Table.Td>
                  <Group gap={4} justify="flex-end" wrap="nowrap">
                    {k.status === 'ATIVO' ? (
                      <Button
                        size="xs"
                        variant="light"
                        color="red"
                        leftSection={<IconTrash size={14} />}
                        loading={revogandoId === k.id}
                        onClick={() => revogar(k)}
                      >
                        Revogar
                      </Button>
                    ) : (
                      <Text size="xs" c="dimmed">—</Text>
                    )}
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      {/* Modal: criar nova chave */}
      <Modal opened={modalAberto} onClose={() => setModalAberto(false)} title="Gerar nova chave do agente" centered>
        <Stack gap="md">
          <TextInput
            label="Nome da chave"
            placeholder="Ex.: Agente Calcgraf — Terminal PCP"
            value={nome}
            onChange={(e) => setNome(e.currentTarget.value)}
            required
            data-autofocus
          />
          <Text size="xs" c="dimmed">
            Dê um nome que ajude a identificar onde a chave será usada. O token
            gerado será exibido apenas uma vez.
          </Text>
          <Button onClick={criar} fullWidth loading={salvando}>Gerar chave</Button>
        </Stack>
      </Modal>

      {/* Modal: token recém-gerado (exibido uma única vez) */}
      <Modal
        opened={tokenGerado !== null}
        onClose={() => setTokenGerado(null)}
        title="Chave criada — copie o token agora"
        centered
        closeOnClickOutside={false}
      >
        <Stack gap="md">
          <Alert color="yellow" icon={<IconAlertTriangle size={16} />} title="Guarde este token agora">
            Este token NÃO será exibido novamente. O servidor armazena apenas o
            hash. Copie e configure-o no agente desktop antes de fechar.
          </Alert>

          <Text size="sm">Chave: <b>{nomeTokenGerado}</b></Text>

          <Paper withBorder p="sm" radius="sm">
            <Group justify="space-between" wrap="nowrap" align="flex-start">
              <Code
                block
                style={{ wordBreak: 'break-all', whiteSpace: 'pre-wrap', flex: 1 }}
              >
                {tokenGerado}
              </Code>
              <CopyButton value={tokenGerado || ''} timeout={2000}>
                {({ copied, copy }) => (
                  <Tooltip label={copied ? 'Copiado!' : 'Copiar token'} withArrow>
                    <ActionIcon color={copied ? 'teal' : 'blue'} variant="light" onClick={copy} size="lg">
                      {copied ? <IconCheck size={18} /> : <IconCopy size={18} />}
                    </ActionIcon>
                  </Tooltip>
                )}
              </CopyButton>
            </Group>
          </Paper>

          <Group justify="flex-end">
            <CopyButton value={tokenGerado || ''} timeout={2000}>
              {({ copied, copy }) => (
                <Button variant="light" color={copied ? 'teal' : 'blue'} leftSection={copied ? <IconCheck size={16} /> : <IconCopy size={16} />} onClick={copy}>
                  {copied ? 'Copiado' : 'Copiar token'}
                </Button>
              )}
            </CopyButton>
            <Button onClick={() => setTokenGerado(null)}>Fechar</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}
