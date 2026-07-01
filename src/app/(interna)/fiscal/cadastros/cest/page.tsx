'use client'

import { useState, useEffect } from 'react'
import {
  Button,
  Group,
  Modal,
  TextInput,
  ActionIcon,
  Tooltip,
  SimpleGrid,
} from '@mantine/core'
import { IconEdit, IconTrash, IconPlus } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { ListagemFiscal, type ColumnDef } from '@/components/fiscal/ListagemFiscal'
import { cestCrud, type Cest } from '@/data/hooks/fiscal/useCadastrosFiscais'

export default function CestPage() {
  useModuloGuard('FISCAL')
  useEffect(() => { document.title = 'Vizor - Fiscal - CEST' }, [])

  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<Cest | null>(null)

  // Form state
  const [codigo, setCodigo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [segmento, setSegmento] = useState('')

  const criar = cestCrud.useCriar()
  const atualizar = cestCrud.useAtualizar()
  const excluir = cestCrud.useExcluir()

  function resetForm() {
    setCodigo('')
    setDescricao('')
    setSegmento('')
  }

  function abrirNovo() {
    setEditando(null)
    resetForm()
    setModalOpen(true)
  }

  function abrirEditar(cest: Cest) {
    setEditando(cest)
    setCodigo(cest.codigo || '')
    setDescricao(cest.descricao || '')
    setSegmento(cest.segmento || '')
    setModalOpen(true)
  }

  function fecharModal() {
    setModalOpen(false)
    setEditando(null)
  }

  function handleSalvar() {
    const payload: any = {
      codigo,
      descricao,
      segmento: segmento || null,
    }

    if (editando) {
      atualizar.mutate(
        { id: editando.id, ...payload },
        {
          onSuccess: () => {
            notifications.show({ title: 'Sucesso', message: 'CEST atualizado', color: 'green' })
            fecharModal()
          },
          onError: (err: any) => {
            notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao atualizar CEST', color: 'red' })
          },
        },
      )
    } else {
      criar.mutate(payload, {
        onSuccess: () => {
          notifications.show({ title: 'Sucesso', message: 'CEST criado', color: 'green' })
          fecharModal()
        },
        onError: (err: any) => {
          notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao criar CEST', color: 'red' })
        },
      })
    }
  }

  function handleExcluir(cest: Cest) {
    if (!confirm(`Excluir CEST ${cest.codigo} - ${cest.descricao}?`)) return
    excluir.mutate(cest.id, {
      onSuccess: () => {
        notifications.show({ title: 'Sucesso', message: 'CEST excluído', color: 'green' })
      },
      onError: (err: any) => {
        notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao excluir CEST', color: 'red' })
      },
    })
  }

  const columns: ColumnDef<Cest>[] = [
    { key: 'codigo', label: 'Código' },
    { key: 'descricao', label: 'Descrição' },
    {
      key: 'segmento',
      label: 'NCMs vinculados',
      render: (value: string | null) => value || '—',
    },
  ]

  const isFormValid = codigo.trim().length > 0 && descricao.trim().length > 0

  return (
    <div>
      <Group justify="flex-end" mb="sm">
        <Button leftSection={<IconPlus size={16} />} onClick={abrirNovo}>
          Novo CEST
        </Button>
      </Group>

      <ListagemFiscal<Cest>
        queryKey={['fiscal-cest']}
        endpoint="/fiscal/cadastros/cest"
        columns={columns}
        title="Cadastro de CEST"
        breadcrumb="Início / Fiscal / Cadastros / CEST"
        actions={(item) => (
          <Group gap={4}>
            <Tooltip label="Editar">
              <ActionIcon variant="light" color="blue" onClick={() => abrirEditar(item)}>
                <IconEdit size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Excluir">
              <ActionIcon variant="light" color="red" onClick={() => handleExcluir(item)}>
                <IconTrash size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        )}
      />

      {/* Modal Criar/Editar CEST */}
      <Modal
        opened={modalOpen}
        onClose={fecharModal}
        title={editando ? 'Editar CEST' : 'Novo CEST'}
        size="md"
        centered
      >
        <SimpleGrid cols={1} spacing="sm" mb="sm">
          <TextInput
            label="Código CEST *"
            placeholder="Ex: 0100100"
            value={codigo}
            onChange={(e) => setCodigo(e.currentTarget.value)}
          />
          <TextInput
            label="Descrição *"
            placeholder="Descrição do CEST"
            value={descricao}
            onChange={(e) => setDescricao(e.currentTarget.value)}
          />
          <TextInput
            label="Segmento / NCMs vinculados"
            placeholder="Segmento ou NCMs vinculados (opcional)"
            value={segmento}
            onChange={(e) => setSegmento(e.currentTarget.value)}
          />
        </SimpleGrid>

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={fecharModal}>Cancelar</Button>
          <Button
            onClick={handleSalvar}
            loading={criar.isPending || atualizar.isPending}
            disabled={!isFormValid}
          >
            {editando ? 'Salvar' : 'Criar'}
          </Button>
        </Group>
      </Modal>
    </div>
  )
}
