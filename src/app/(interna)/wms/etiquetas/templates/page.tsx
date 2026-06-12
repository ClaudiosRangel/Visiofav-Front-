'use client'

import { useState, useEffect } from 'react'
import {
  Card, Group, Text, Table, Badge, Button, Modal, TextInput, Select,
  Textarea, NumberInput, Stack, LoadingOverlay, ActionIcon, Pagination, Code,
} from '@mantine/core'
import {
  IconPlus, IconEdit, IconEye, IconBarcode,
} from '@tabler/icons-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notifications } from '@mantine/notifications'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'

const TIPO_OPTIONS = [
  { value: 'PRODUTO', label: 'Produto' },
  { value: 'ENDERECO', label: 'Endereço' },
  { value: 'PALETE', label: 'Palete' },
  { value: 'EXPEDICAO', label: 'Expedição' },
]

export default function TemplatesEtiquetaPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'Vizor - WMS - Templates de Etiquetas ZPL' }, [])

  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [previewModal, setPreviewModal] = useState<string | null>(null)
  const [previewContent, setPreviewContent] = useState<string>('')
  const [previewLoading, setPreviewLoading] = useState(false)

  const [form, setForm] = useState({
    nome: '',
    tipo: '',
    codigoZpl: '',
    larguraMm: 100,
    alturaMm: 50,
  })

  const { data: resp, isLoading } = useQuery<any>({
    queryKey: ['etiquetas-zpl-templates', page],
    queryFn: async () => {
      const { data } = await api.get('/etiquetas-zpl/templates', { params: { page, limit: 20 } })
      return data
    },
  })

  const templates = resp?.data || resp || []
  const total = resp?.total || 0
  const totalPages = Math.ceil(total / 20)

  const salvar = useMutation({
    mutationFn: async (payload: any) => {
      if (editItem) {
        await api.put(`/etiquetas-zpl/templates/${editItem.id}`, payload)
      } else {
        await api.post('/etiquetas-zpl/templates', payload)
      }
    },
    onSuccess: () => {
      notifications.show({ title: 'Sucesso', message: editItem ? 'Template atualizado' : 'Template criado', color: 'green' })
      queryClient.invalidateQueries({ queryKey: ['etiquetas-zpl-templates'] })
      closeModal()
    },
    onError: (err: any) => {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' })
    },
  })

  function openCreate() {
    setEditItem(null)
    setForm({ nome: '', tipo: '', codigoZpl: '', larguraMm: 100, alturaMm: 50 })
    setModalOpen(true)
  }

  function openEdit(template: any) {
    setEditItem(template)
    setForm({
      nome: template.nome || '',
      tipo: template.tipo || '',
      codigoZpl: template.codigoZpl || '',
      larguraMm: template.larguraMm || 100,
      alturaMm: template.alturaMm || 50,
    })
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditItem(null)
    setForm({ nome: '', tipo: '', codigoZpl: '', larguraMm: 100, alturaMm: 50 })
  }

  function handleSave() {
    if (!form.nome || !form.tipo || !form.codigoZpl) {
      notifications.show({ title: 'Atenção', message: 'Preencha nome, tipo e código ZPL', color: 'yellow' })
      return
    }
    salvar.mutate(form)
  }

  async function handlePreview(templateId: string) {
    setPreviewModal(templateId)
    setPreviewLoading(true)
    try {
      const { data } = await api.post(`/etiquetas-zpl/templates/${templateId}/preview`)
      setPreviewContent(data?.zplRenderizado || data?.preview || data?.zpl || JSON.stringify(data, null, 2))
    } catch (err: any) {
      setPreviewContent(`Erro: ${err?.response?.data?.message || err.message}`)
    } finally {
      setPreviewLoading(false)
    }
  }

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Etiquetas ZPL / Templates</Text>

      <Group justify="space-between" mb="lg">
        <Text size="xl" fw={600}>Templates de Etiquetas ZPL</Text>
        <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
          Novo Template
        </Button>
      </Group>

      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Nome</Table.Th>
              <Table.Th>Tipo</Table.Th>
              <Table.Th>Dimensões</Table.Th>
              <Table.Th>Versão</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(Array.isArray(templates) ? templates : []).map((t: any) => (
              <Table.Tr key={t.id}>
                <Table.Td fw={500}>{t.nome}</Table.Td>
                <Table.Td>
                  <Badge variant="light" size="sm">{t.tipo}</Badge>
                </Table.Td>
                <Table.Td>{t.larguraMm}×{t.alturaMm} mm</Table.Td>
                <Table.Td>v{t.versao || 1}</Table.Td>
                <Table.Td>
                  <Badge variant="light" color={t.ativo !== false ? 'green' : 'gray'}>
                    {t.ativo !== false ? 'Ativo' : 'Inativo'}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    <ActionIcon variant="light" onClick={() => openEdit(t)} title="Editar">
                      <IconEdit size={16} />
                    </ActionIcon>
                    <ActionIcon variant="light" color="teal" onClick={() => handlePreview(t.id)} title="Preview">
                      <IconEye size={16} />
                    </ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
            {templates.length === 0 && !isLoading && (
              <Table.Tr>
                <Table.Td colSpan={6} className="text-center py-8 text-zinc-500">
                  Nenhum template cadastrado
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>

        {totalPages > 1 && (
          <Group justify="center" mt="md">
            <Pagination value={page} onChange={setPage} total={totalPages} />
          </Group>
        )}
      </Card>

      {/* Create/Edit Modal */}
      <Modal opened={modalOpen} onClose={closeModal} title={editItem ? 'Editar Template' : 'Novo Template'} size="lg">
        <Stack gap="sm">
          <TextInput
            label="Nome"
            placeholder="Nome do template"
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.currentTarget.value })}
          />
          <Select
            label="Tipo"
            placeholder="Selecione o tipo"
            data={TIPO_OPTIONS}
            value={form.tipo}
            onChange={(v) => setForm({ ...form, tipo: v || '' })}
          />
          <Group grow>
            <NumberInput
              label="Largura (mm)"
              value={form.larguraMm}
              onChange={(v) => setForm({ ...form, larguraMm: typeof v === 'number' ? v : 100 })}
              min={10}
              max={300}
            />
            <NumberInput
              label="Altura (mm)"
              value={form.alturaMm}
              onChange={(v) => setForm({ ...form, alturaMm: typeof v === 'number' ? v : 50 })}
              min={10}
              max={300}
            />
          </Group>
          <Textarea
            label="Código ZPL"
            placeholder="^XA&#10;^FO50,50^ADN,36,20^FD{{produto}}^FS&#10;^XZ"
            value={form.codigoZpl}
            onChange={(e) => setForm({ ...form, codigoZpl: e.currentTarget.value })}
            minRows={10}
            maxRows={20}
            autosize
            styles={{ input: { fontFamily: 'monospace', fontSize: 12 } }}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="light" onClick={closeModal}>Cancelar</Button>
            <Button onClick={handleSave} loading={salvar.isPending}>
              {editItem ? 'Salvar Alterações' : 'Criar Template'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Preview Modal */}
      <Modal opened={!!previewModal} onClose={() => setPreviewModal(null)} title="Preview do Template ZPL" size="lg">
        <LoadingOverlay visible={previewLoading} />
        <Code block style={{ maxHeight: 400, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
          {previewContent}
        </Code>
      </Modal>
    </div>
  )
}
