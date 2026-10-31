'use client'

/**
 * Editor Visual de Templates (Orçamento e Proposta) — página que compõe Paleta +
 * Canvas (arrastar/redimensionar) + Painel de Propriedades + Preview, com CRUD
 * via /api/orcamento-grafico/templates-visuais. Spec comercial-editor-visual-templates.
 */
import { useEffect, useMemo, useState, useCallback } from 'react'
import {
  Stack, Group, Title, Button, Paper, Select, Text, Loader, Center, TextInput,
  SegmentedControl, Badge, Grid, ScrollArea, ActionIcon, Tooltip, Modal,
} from '@mantine/core'
import {
  IconDeviceFloppy, IconPlus, IconCopy, IconStar, IconTrash, IconEye, IconRefresh,
} from '@tabler/icons-react'
import { api } from '@/lib/api'
import { getAuthToken } from '@/lib/authStorage'
import { notifications } from '@mantine/notifications'
import PaletaElementos from '@/components/comercial/template-visual/PaletaElementos'
import PainelPropriedades from '@/components/comercial/template-visual/PainelPropriedades'
import CanvasA4 from '@/components/comercial/template-visual/CanvasA4'
import {
  type Elemento, type LayoutDocumento, type TipoElemento, type TipoTemplate,
  elementoInicial, paginaA4Padrao,
} from '@/lib/comercial/template-visual/layout-tipos'
import type { ContextoGeracao } from '@/lib/comercial/template-visual/binding-resolver'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333/api'

interface TemplateResumo { id: string; nome: string; tipo: TipoTemplate; isDefault: boolean }

// Contexto de exemplo para o preview (o PDF real usa o orçamento).
const CTX_EXEMPLO: ContextoGeracao = {
  cliente: { nome: 'CLIENTE EXEMPLO LTDA', cnpj: '00.000.000/0001-00' },
  empresa: { razaoSocial: 'Minha Empresa', cnpj: '11.111.111/0001-11' },
  orcamento: {
    numero: 1234, versao: 1, quantidade: 5000, precoVenda: 12500, precoUnitario: 2.5,
    validadeAte: new Date(Date.now() + 10 * 864e5).toISOString(), criadoEm: new Date().toISOString(),
    descricao: 'Cartucho de exemplo', vendedorNome: 'Vendedor Exemplo',
  },
  itens: [
    { descricao: 'Item A', quantidade: 5000, precoUnitario: 2.5, precoTotal: 12500 },
    { descricao: 'Item B', quantidade: 10000, precoUnitario: 2.1, precoTotal: 21000 },
  ],
  variacoes: [
    { quantidade: 5000, precoUnitario: 2.5, precoTotal: 12500 },
    { quantidade: 10000, precoUnitario: 2.1, precoTotal: 21000 },
  ],
}

function layoutVazio(): LayoutDocumento {
  return { versao: 1, pagina: paginaA4Padrao(), elementos: [] }
}

export default function EditorVisualPage() {
  useEffect(() => { document.title = 'Editor de Templates' }, [])

  const [tipo, setTipo] = useState<TipoTemplate>('PROPOSTA')
  const [lista, setLista] = useState<TemplateResumo[]>([])
  const [carregandoLista, setCarregandoLista] = useState(true)
  const [atualId, setAtualId] = useState<string | null>(null)
  const [nome, setNome] = useState('')
  const [layout, setLayout] = useState<LayoutDocumento>(layoutVazio())
  const [selId, setSelId] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [seedModal, setSeedModal] = useState(false)
  let seq = useMemo(() => ({ n: 0 }), [])

  const carregarLista = useCallback(async () => {
    setCarregandoLista(true)
    try {
      const { data } = await api.get('/orcamento-grafico/templates-visuais', { params: { tipo } })
      setLista(Array.isArray(data) ? data : [])
    } catch {
      setLista([])
    } finally {
      setCarregandoLista(false)
    }
  }, [tipo])

  useEffect(() => { carregarLista() }, [carregarLista])

  async function abrir(id: string) {
    try {
      const { data } = await api.get(`/orcamento-grafico/templates-visuais/${id}`)
      setAtualId(data.id)
      setNome(data.nome)
      setLayout(data.layoutJson)
      setSelId(null)
    } catch {
      notifications.show({ title: 'Erro', message: 'Falha ao abrir o template.', color: 'red' })
    }
  }

  function novo() {
    setAtualId(null)
    setNome('Novo template')
    setLayout(layoutVazio())
    setSelId(null)
  }

  function adicionar(t: TipoElemento) {
    seq.n += 1
    const el = elementoInicial(t, `el-${Date.now()}-${seq.n}`)
    setLayout((l) => ({ ...l, elementos: [...l.elementos, el] }))
    setSelId(el.id)
  }

  function alterarElemento(el: Elemento) {
    setLayout((l) => ({ ...l, elementos: l.elementos.map((e) => (e.id === el.id ? el : e)) }))
  }

  function removerElemento(id: string) {
    setLayout((l) => ({ ...l, elementos: l.elementos.filter((e) => e.id !== id) }))
    if (selId === id) setSelId(null)
  }

  async function salvar() {
    if (!nome.trim()) { notifications.show({ message: 'Informe o nome.', color: 'red' }); return }
    setSalvando(true)
    try {
      if (atualId) {
        await api.put(`/orcamento-grafico/templates-visuais/${atualId}`, { nome, layoutJson: layout })
        notifications.show({ title: 'Salvo', message: 'Template atualizado.', color: 'green' })
      } else {
        const { data } = await api.post('/orcamento-grafico/templates-visuais', { nome, tipo, layoutJson: layout })
        setAtualId(data.id)
        notifications.show({ title: 'Criado', message: 'Template criado.', color: 'green' })
      }
      carregarLista()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao salvar.', color: 'red' })
    } finally {
      setSalvando(false)
    }
  }

  async function duplicar(id: string) {
    try {
      await api.post(`/orcamento-grafico/templates-visuais/${id}/duplicar`)
      notifications.show({ title: 'Duplicado', message: 'Cópia criada.', color: 'green' })
      carregarLista()
    } catch { notifications.show({ title: 'Erro', message: 'Falha ao duplicar.', color: 'red' }) }
  }

  async function tornarDefault(id: string) {
    try {
      await api.patch(`/orcamento-grafico/templates-visuais/${id}/default`)
      notifications.show({ title: 'Padrão', message: 'Template definido como padrão.', color: 'green' })
      carregarLista()
    } catch { notifications.show({ title: 'Erro', message: 'Falha ao definir padrão.', color: 'red' }) }
  }

  async function excluir(id: string) {
    try {
      await api.delete(`/orcamento-grafico/templates-visuais/${id}`)
      notifications.show({ title: 'Excluído', message: 'Template removido.', color: 'green' })
      if (atualId === id) novo()
      carregarLista()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao excluir.', color: 'red' })
    }
  }

  function previewPdf() {
    if (!atualId) { notifications.show({ message: 'Salve o template antes de pré-visualizar o PDF.', color: 'orange' }); return }
    const token = getAuthToken()
    // preview-pdf é POST; abrimos via fetch e blob para manter o método.
    fetch(`${API_BASE}/orcamento-grafico/templates-visuais/${atualId}/preview-pdf`, {
      method: 'POST', headers: { Authorization: `Bearer ${token ?? ''}` },
    })
      .then((r) => r.blob())
      .then((b) => window.open(URL.createObjectURL(b), '_blank'))
      .catch(() => notifications.show({ message: 'Falha ao gerar preview.', color: 'red' }))
  }

  async function semear() {
    try {
      await api.post('/orcamento-grafico/templates-visuais/seed-wega')
      notifications.show({ title: 'Templates padrão', message: 'Modelos Carton Wega criados.', color: 'green' })
      setSeedModal(false)
      carregarLista()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao semear.', color: 'red' })
    }
  }

  const elementoSel = layout.elementos.find((e) => e.id === selId) ?? null

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={3}>Editor de Templates</Title>
          <Text size="sm" c="dimmed">Monte o layout arrastando os elementos. O preview reflete o PDF final.</Text>
        </div>
        <Group gap="xs">
          <SegmentedControl
            value={tipo}
            onChange={(v) => { setTipo(v as TipoTemplate); novo() }}
            data={[{ value: 'PROPOSTA', label: 'Proposta' }, { value: 'ORCAMENTO', label: 'Orçamento' }]}
          />
          <Button variant="light" leftSection={<IconRefresh size={16} />} onClick={carregarLista}>Atualizar</Button>
          <Button variant="light" leftSection={<IconStar size={16} />} onClick={() => setSeedModal(true)}>Modelos Carton Wega</Button>
          <Button leftSection={<IconPlus size={16} />} onClick={novo}>Novo template</Button>
        </Group>
      </Group>

      <Grid gutter="md">
        {/* Coluna esquerda: lista + paleta */}
        <Grid.Col span={{ base: 12, md: 3 }}>
          <Paper withBorder p="sm" mb="sm">
            <Text fw={600} size="sm" mb="xs">Templates ({tipo === 'PROPOSTA' ? 'Proposta' : 'Orçamento'})</Text>
            {carregandoLista ? <Center py="sm"><Loader size="sm" /></Center> : (
              <Stack gap={4}>
                {lista.map((t) => (
                  <Group key={t.id} gap={4} wrap="nowrap" justify="space-between">
                    <Button variant={atualId === t.id ? 'light' : 'subtle'} size="compact-sm" justify="flex-start"
                      style={{ flex: 1 }} onClick={() => abrir(t.id)}>
                      {t.nome}{t.isDefault && <Badge ml={6} size="xs" color="teal">padrão</Badge>}
                    </Button>
                    <Tooltip label="Duplicar"><ActionIcon variant="subtle" onClick={() => duplicar(t.id)}><IconCopy size={15} /></ActionIcon></Tooltip>
                    <Tooltip label="Definir padrão"><ActionIcon variant="subtle" color="teal" onClick={() => tornarDefault(t.id)}><IconStar size={15} /></ActionIcon></Tooltip>
                    <Tooltip label="Excluir"><ActionIcon variant="subtle" color="red" onClick={() => excluir(t.id)}><IconTrash size={15} /></ActionIcon></Tooltip>
                  </Group>
                ))}
                {lista.length === 0 && <Text size="xs" c="dimmed">Nenhum template. Crie um novo ou use os modelos Carton Wega.</Text>}
              </Stack>
            )}
          </Paper>
          <Paper withBorder p="sm">
            <PaletaElementos onAdicionar={adicionar} />
          </Paper>
        </Grid.Col>

        {/* Coluna central: canvas */}
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Group mb="xs" gap="xs">
            <TextInput placeholder="Nome do template" value={nome} onChange={(e) => setNome(e.currentTarget.value)} style={{ flex: 1 }} />
            <Button leftSection={<IconDeviceFloppy size={16} />} loading={salvando} onClick={salvar}>Salvar</Button>
            <Button variant="light" leftSection={<IconEye size={16} />} onClick={previewPdf}>Preview PDF</Button>
          </Group>
          <Paper withBorder p="md" style={{ background: '#f1f3f5' }}>
            <ScrollArea h={720}>
              <CanvasA4
                layout={layout}
                contexto={CTX_EXEMPLO}
                selecionadoId={selId}
                onSelecionar={setSelId}
                onAlterarElemento={alterarElemento}
                larguraPx={560}
              />
            </ScrollArea>
          </Paper>
        </Grid.Col>

        {/* Coluna direita: propriedades */}
        <Grid.Col span={{ base: 12, md: 3 }}>
          <Paper withBorder p="sm">
            <PainelPropriedades elemento={elementoSel} pagina={layout.pagina} onChange={alterarElemento} onRemover={removerElemento} />
          </Paper>
        </Grid.Col>
      </Grid>

      <Modal opened={seedModal} onClose={() => setSeedModal(false)} title="Criar modelos padrão (Carton Wega)" centered>
        <Stack gap="md">
          <Text size="sm">Cria os templates visuais padrão (Proposta e Orçamento) reproduzindo os modelos atuais da Carton Wega. Não duplica se já existirem.</Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setSeedModal(false)}>Cancelar</Button>
            <Button onClick={semear}>Criar modelos</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}
