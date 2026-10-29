'use client'

/**
 * Cadastro de Templates de Proposta comercial (spec comercial-templates-proposta,
 * bloco B1). Lista os templates da empresa, cria/edita (nome, toggles de
 * cabeçalho e blocos, textos fixos), define o default e exclui. Só apresentação
 * do PDF — não afeta valores do orçamento.
 * Backend: /orcamento-grafico/templates-proposta (CRUD + PATCH /:id/default).
 */
import { useEffect, useState } from 'react'
import {
  Title, Stack, Table, Group, Button, Text, Loader, Center, Modal, TextInput,
  Textarea, Switch, ActionIcon, Badge, Divider, SimpleGrid, Tooltip, Select,
} from '@mantine/core'
import { IconPlus, IconEdit, IconTrash, IconStar, IconStarFilled } from '@tabler/icons-react'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'

interface TemplateConfig {
  estilo: 'PADRAO' | 'WEGA'
  cabecalho: {
    mostrarLogo: boolean
    mostrarRazaoSocial: boolean
    mostrarCnpj: boolean
    mostrarTelefone: boolean
    mostrarEmail: boolean
  }
  textos: { introducao?: string; condicoes?: string; rodape?: string; cidadeData?: string }
  blocos: {
    engenharia: boolean
    decomposicaoCustos: boolean
    variacoesTiragem: boolean
    validade: boolean
    observacoes: boolean
  }
}

interface Template {
  id: string
  nome: string
  isDefault: boolean
  config: TemplateConfig
}

const CONFIG_INICIAL: TemplateConfig = {
  estilo: 'PADRAO',
  cabecalho: { mostrarLogo: true, mostrarRazaoSocial: true, mostrarCnpj: true, mostrarTelefone: true, mostrarEmail: true },
  textos: {},
  blocos: { engenharia: true, decomposicaoCustos: true, variacoesTiragem: true, validade: true, observacoes: true },
}

export default function TemplatesPropostaPage() {
  useEffect(() => { document.title = 'Comercial - Templates de Proposta' }, [])

  const [data, setData] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<Template | null>(null)
  const [nome, setNome] = useState('')
  const [config, setConfig] = useState<TemplateConfig>(CONFIG_INICIAL)
  const [salvando, setSalvando] = useState(false)

  async function carregar() {
    setLoading(true)
    try {
      const { data } = await api.get('/orcamento-grafico/templates-proposta')
      setData(Array.isArray(data) ? data : [])
    } catch (err: any) {
      notifications.show({ title: 'Erro ao carregar', message: err?.response?.data?.message || 'Falha', color: 'red' })
    } finally { setLoading(false) }
  }

  useEffect(() => { carregar() }, [])

  function abrirNovo() {
    setEditando(null)
    setNome('')
    setConfig(CONFIG_INICIAL)
    setModalAberto(true)
  }

  function abrirEdicao(t: Template) {
    setEditando(t)
    setNome(t.nome)
    // mescla com inicial para tolerar config parcial
    setConfig({
      estilo: t.config?.estilo === 'WEGA' ? 'WEGA' : 'PADRAO',
      cabecalho: { ...CONFIG_INICIAL.cabecalho, ...(t.config?.cabecalho ?? {}) },
      textos: { ...(t.config?.textos ?? {}) },
      blocos: { ...CONFIG_INICIAL.blocos, ...(t.config?.blocos ?? {}) },
    })
    setModalAberto(true)
  }

  async function salvar() {
    if (!nome.trim()) {
      notifications.show({ message: 'Informe o nome do template', color: 'red' })
      return
    }
    setSalvando(true)
    try {
      if (editando) {
        await api.put(`/orcamento-grafico/templates-proposta/${editando.id}`, { nome, config })
      } else {
        await api.post('/orcamento-grafico/templates-proposta', { nome, config })
      }
      notifications.show({ title: 'Salvo', message: 'Template salvo com sucesso', color: 'green' })
      setModalAberto(false)
      carregar()
    } catch (err: any) {
      notifications.show({ title: 'Erro ao salvar', message: err?.response?.data?.message || 'Falha', color: 'red' })
    } finally { setSalvando(false) }
  }

  async function definirDefault(t: Template) {
    try {
      await api.patch(`/orcamento-grafico/templates-proposta/${t.id}/default`, {})
      notifications.show({ message: `"${t.nome}" é o template padrão.`, color: 'green' })
      carregar()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' })
    }
  }

  async function excluir(t: Template) {
    if (!confirm(`Excluir o template "${t.nome}"?`)) return
    try {
      await api.delete(`/orcamento-grafico/templates-proposta/${t.id}`)
      notifications.show({ message: 'Template removido', color: 'yellow' })
      carregar()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' })
    }
  }

  const setCab = (k: keyof TemplateConfig['cabecalho'], v: boolean) =>
    setConfig((c) => ({ ...c, cabecalho: { ...c.cabecalho, [k]: v } }))
  const setBloco = (k: keyof TemplateConfig['blocos'], v: boolean) =>
    setConfig((c) => ({ ...c, blocos: { ...c.blocos, [k]: v } }))
  const setTexto = (k: keyof TemplateConfig['textos'], v: string) =>
    setConfig((c) => ({ ...c, textos: { ...c.textos, [k]: v } }))

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={3}>Templates de Proposta</Title>
          <Text size="sm" c="dimmed">
            Modelos de proposta em PDF (cabeçalho, textos e blocos exibidos). Um template é o padrão da empresa.
          </Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} onClick={abrirNovo}>Novo Template</Button>
      </Group>

      {loading ? <Center py="xl"><Loader /></Center> : (
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Nome</Table.Th>
              <Table.Th>Padrão</Table.Th>
              <Table.Th>Blocos ativos</Table.Th>
              <Table.Th></Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data.map((t) => {
              const blocosAtivos = Object.entries(t.config?.blocos ?? {}).filter(([, v]) => v).length
              return (
                <Table.Tr key={t.id}>
                  <Table.Td fw={500}>{t.nome}</Table.Td>
                  <Table.Td>
                    {t.isDefault
                      ? <Badge color="green" leftSection={<IconStarFilled size={12} />}>Padrão</Badge>
                      : (
                        <Tooltip label="Definir como padrão">
                          <ActionIcon variant="subtle" onClick={() => definirDefault(t)}>
                            <IconStar size={16} />
                          </ActionIcon>
                        </Tooltip>
                      )}
                  </Table.Td>
                  <Table.Td><Text size="sm" c="dimmed">{blocosAtivos} de 5</Text></Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      <ActionIcon variant="subtle" onClick={() => abrirEdicao(t)}><IconEdit size={16} /></ActionIcon>
                      <Tooltip label={t.isDefault ? 'Não é possível excluir o padrão' : 'Excluir'}>
                        <ActionIcon variant="subtle" color="red" disabled={t.isDefault} onClick={() => excluir(t)}>
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              )
            })}
            {data.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={4}>
                  <Text ta="center" c="dimmed" py="md">
                    Nenhum template cadastrado. A proposta usa o layout padrão embutido até você criar um.
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      )}

      <Modal
        opened={modalAberto}
        onClose={() => setModalAberto(false)}
        title={editando ? 'Editar Template' : 'Novo Template de Proposta'}
        size="lg"
        centered
      >
        <Stack gap="md">
          <TextInput label="Nome do template" placeholder="Ex.: Padrão Carton Wega" value={nome}
            onChange={(e) => setNome(e.currentTarget.value)} required />

          <Select
            label="Estilo de layout"
            description="Padrão = layout genérico; Carton Wega = modelo de proposta ao cliente"
            data={[
              { value: 'PADRAO', label: 'Padrão (genérico)' },
              { value: 'WEGA', label: 'Carton Wega (proposta ao cliente)' },
            ]}
            value={config.estilo}
            onChange={(v) => setConfig((c) => ({ ...c, estilo: v === 'WEGA' ? 'WEGA' : 'PADRAO' }))}
            allowDeselect={false}
          />
          {config.estilo === 'WEGA' && (
            <TextInput
              label="Linha de cidade (cabeçalho)"
              placeholder="Ex.: Comendador Levy Gasp"
              value={config.textos.cidadeData ?? ''}
              onChange={(e) => setTexto('cidadeData', e.currentTarget.value)}
            />
          )}

          <Divider label="Cabeçalho" labelPosition="left" />
          <SimpleGrid cols={2} spacing="xs">
            <Switch label="Mostrar logo" checked={config.cabecalho.mostrarLogo} onChange={(e) => setCab('mostrarLogo', e.currentTarget.checked)} />
            <Switch label="Razão social" checked={config.cabecalho.mostrarRazaoSocial} onChange={(e) => setCab('mostrarRazaoSocial', e.currentTarget.checked)} />
            <Switch label="CNPJ" checked={config.cabecalho.mostrarCnpj} onChange={(e) => setCab('mostrarCnpj', e.currentTarget.checked)} />
            <Switch label="Telefone" checked={config.cabecalho.mostrarTelefone} onChange={(e) => setCab('mostrarTelefone', e.currentTarget.checked)} />
            <Switch label="E-mail" checked={config.cabecalho.mostrarEmail} onChange={(e) => setCab('mostrarEmail', e.currentTarget.checked)} />
          </SimpleGrid>

          <Divider label="Blocos exibidos" labelPosition="left" />
          <SimpleGrid cols={2} spacing="xs">
            <Switch label="Engenharia (papel/cores/acabamentos)" checked={config.blocos.engenharia} onChange={(e) => setBloco('engenharia', e.currentTarget.checked)} />
            <Switch label="Decomposição de custos" checked={config.blocos.decomposicaoCustos} onChange={(e) => setBloco('decomposicaoCustos', e.currentTarget.checked)} />
            <Switch label="Variações de tiragem" checked={config.blocos.variacoesTiragem} onChange={(e) => setBloco('variacoesTiragem', e.currentTarget.checked)} />
            <Switch label="Validade" checked={config.blocos.validade} onChange={(e) => setBloco('validade', e.currentTarget.checked)} />
            <Switch label="Observações" checked={config.blocos.observacoes} onChange={(e) => setBloco('observacoes', e.currentTarget.checked)} />
          </SimpleGrid>

          <Divider label="Textos fixos (opcionais)" labelPosition="left" />
          <Textarea label="Introdução" placeholder="Parágrafo de abertura da proposta" autosize minRows={2}
            value={config.textos.introducao ?? ''} onChange={(e) => setTexto('introducao', e.currentTarget.value)} />
          <Textarea label="Condições comerciais" placeholder="Substitui os termos padrão (frete, pagamento, prazo...)" autosize minRows={2}
            value={config.textos.condicoes ?? ''} onChange={(e) => setTexto('condicoes', e.currentTarget.value)} />
          <Textarea label="Rodapé" placeholder="Texto do rodapé (substitui razão social/contato)" autosize minRows={1}
            value={config.textos.rodape ?? ''} onChange={(e) => setTexto('rodape', e.currentTarget.value)} />

          <Button onClick={salvar} fullWidth loading={salvando}>
            {editando ? 'Salvar Alterações' : 'Criar Template'}
          </Button>
        </Stack>
      </Modal>
    </Stack>
  )
}
