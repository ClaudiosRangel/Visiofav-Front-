'use client'

import { useState, useEffect } from 'react'
import {
  Button,
  Group,
  Modal,
  TextInput,
  Select,
  ActionIcon,
  Tooltip,
  SimpleGrid,
} from '@mantine/core'
import { IconEdit, IconTrash, IconPlus } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { ListagemFiscal, type ColumnDef } from '@/components/fiscal/ListagemFiscal'
import { cstCsosnCrud, type CstCsosn } from '@/data/hooks/fiscal/useCadastrosFiscais'

const TIPO_OPTIONS = [
  { value: 'CST', label: 'CST' },
  { value: 'CSOSN', label: 'CSOSN' },
]

export default function CstCsosnPage() {
  useModuloGuard('FISCAL')
  useEffect(() => { document.title = 'Vizor - Fiscal - CST/CSOSN' }, [])

  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<CstCsosn | null>(null)

  // Form state
  const [codigo, setCodigo] = useState('')
  const [tipo, setTipo] = useState<string | null>(null)
  const [descricao, setDescricao] = useState('')

  const criar = cstCsosnCrud.useCriar()
  const atualizar = cstCsosnCrud.useAtualizar()
  const excluir = cstCsosnCrud.useExcluir()

  function resetForm() {
    setCodigo('')
    setTipo(null)
    setDescricao('')
  }

  function abrirNovo() {
    setEditando(null)
    resetForm()
    setModalOpen(true)
  }

  function abrirEditar(item: CstCsosn) {
    setEditando(item)
    setCodigo(item.codigo || '')
    setTipo(item.tipo || null)
    setDescricao(item.descricao || '')
    setModalOpen(true)
  }

  function fecharModal() {
    setModalOpen(false)
    setEditando(null)
  }

  function handleSalvar() {
    const payload: any = {
      codigo,
      tipo,
      descricao,
    }

    if (editando) {
      atualizar.mutate(
        { id: editando.id, ...payload },
        {
          onSuccess: () => {
            notifications.show({ title: 'Sucesso', message: 'CST/CSOSN atualizado', color: 'green' })
            fecharModal()
          },
          onError: (err: any) => {
            notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao atualizar CST/CSOSN', color: 'red' })
          },
        },
      )
    } else {
      criar.mutate(payload, {
        onSuccess: () => {
          notifications.show({ title: 'Sucesso', message: 'CST/CSOSN criado', color: 'green' })
          fecharModal()
        },
        onError: (err: any) => {
          notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao criar CST/CSOSN', color: 'red' })
        },
      })
    }
  }

  function handleExcluir(item: CstCsosn) {
    if (!confirm(`Excluir ${item.tipo} ${item.codigo} - ${item.descricao}?`)) return
    excluir.mutate(item.id, {
      onSuccess: () => {
        notifications.show({ title: 'Sucesso', message: 'CST/CSOSN excluído', color: 'green' })
      },
      onError: (err: any) => {
        notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao excluir CST/CSOSN', color: 'red' })
      },
    })
  }

  const columns: ColumnDef<CstCsosn>[] = [
    { key: 'codigo', label: 'Código' },
    { key: 'tipo', label: 'Tipo (CST/CSOSN)' },
    { key: 'descricao', label: 'Descrição' },
  ]

  const isFormValid = codigo.trim().length > 0 && tipo !== null && descricao.trim().length > 0

  return (
    <div>
      <Group justify="flex-end" mb="sm">
        <Button leftSection={<IconPlus size={16} />} onClick={abrirNovo}>
          Novo CST/CSOSN
        </Button>
      </Group>

      <ListagemFiscal<CstCsosn>
        queryKey={['fiscal-cst-csosn']}
        endpoint="/fiscal/cadastros/cst-csosn"
        columns={columns}
        title="Cadastro de CST/CSOSN"
        breadcrumb="Início / Fiscal / Cadastros / CST/CSOSN"
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

      {/* Modal Criar/Editar CST/CSOSN */}
      <Modal
        opened={modalOpen}
        onClose={fecharModal}
        title={editando ? 'Editar CST/CSOSN' : 'Novo CST/CSOSN'}
        size="md"
        centered
      >
        <SimpleGrid cols={1} spacing="sm" mb="sm">
          <TextInput
            label="Código *"
            placeholder="Ex: 00, 101..."
            value={codigo}
            onChange={(e) => setCodigo(e.currentTarget.value)}
          />
          <Select
            label="Tipo *"
            placeholder="Selecione o tipo"
            data={TIPO_OPTIONS}
            value={tipo}
            onChange={setTipo}
          />
          <TextInput
            label="Descrição *"
            placeholder="Descrição do CST/CSOSN"
            value={descricao}
            onChange={(e) => setDescricao(e.currentTarget.value)}
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
