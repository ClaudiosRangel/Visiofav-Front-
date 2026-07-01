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
import { cfopCrud, type Cfop } from '@/data/hooks/fiscal/useCadastrosFiscais'

export default function CfopPage() {
  useModuloGuard('FISCAL')
  useEffect(() => { document.title = 'Vizor - Fiscal - CFOP' }, [])

  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<Cfop | null>(null)

  // Form state
  const [codigo, setCodigo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [tipo, setTipo] = useState<'ENTRADA' | 'SAIDA' | ''>('')

  // Validation
  const [codigoError, setCodigoError] = useState('')

  const criar = cfopCrud.useCriar()
  const atualizar = cfopCrud.useAtualizar()
  const excluir = cfopCrud.useExcluir()

  function resetForm() {
    setCodigo('')
    setDescricao('')
    setTipo('')
    setCodigoError('')
  }

  function abrirNovo() {
    setEditando(null)
    resetForm()
    setModalOpen(true)
  }

  function abrirEditar(cfop: Cfop) {
    setEditando(cfop)
    setCodigo(cfop.codigo || '')
    setDescricao(cfop.descricao || '')
    setTipo(cfop.tipo || '')
    setCodigoError('')
    setModalOpen(true)
  }

  function fecharModal() {
    setModalOpen(false)
    setEditando(null)
  }

  function validarCodigo(value: string): boolean {
    if (!/^\d{4}$/.test(value)) {
      setCodigoError('Código CFOP deve ter exatamente 4 dígitos numéricos')
      return false
    }
    setCodigoError('')
    return true
  }

  function handleSalvar() {
    if (!validarCodigo(codigo)) return

    const payload: any = {
      codigo,
      descricao,
      tipo,
    }

    if (editando) {
      atualizar.mutate(
        { id: editando.id, ...payload },
        {
          onSuccess: () => {
            notifications.show({ title: 'Sucesso', message: 'CFOP atualizado', color: 'green' })
            fecharModal()
          },
          onError: (err: any) => {
            notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao atualizar CFOP', color: 'red' })
          },
        },
      )
    } else {
      criar.mutate(payload, {
        onSuccess: () => {
          notifications.show({ title: 'Sucesso', message: 'CFOP criado', color: 'green' })
          fecharModal()
        },
        onError: (err: any) => {
          notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao criar CFOP', color: 'red' })
        },
      })
    }
  }

  function handleExcluir(cfop: Cfop) {
    if (!confirm(`Excluir CFOP ${cfop.codigo} - ${cfop.descricao}?`)) return
    excluir.mutate(cfop.id, {
      onSuccess: () => {
        notifications.show({ title: 'Sucesso', message: 'CFOP excluído', color: 'green' })
      },
      onError: (err: any) => {
        notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao excluir CFOP', color: 'red' })
      },
    })
  }

  const columns: ColumnDef<Cfop>[] = [
    { key: 'codigo', label: 'Código' },
    { key: 'descricao', label: 'Descrição' },
    {
      key: 'tipo',
      label: 'Tipo',
      render: (value: string) => value === 'ENTRADA' ? 'Entrada' : value === 'SAIDA' ? 'Saída' : '—',
    },
  ]

  const isFormValid =
    codigo.length === 4 &&
    /^\d{4}$/.test(codigo) &&
    descricao.trim().length > 0 &&
    (tipo === 'ENTRADA' || tipo === 'SAIDA')

  return (
    <div>
      <Group justify="flex-end" mb="sm">
        <Button leftSection={<IconPlus size={16} />} onClick={abrirNovo}>
          Novo CFOP
        </Button>
      </Group>

      <ListagemFiscal<Cfop>
        queryKey={['fiscal-cfop']}
        endpoint="/fiscal/cadastros/cfop"
        columns={columns}
        title="Cadastro de CFOP"
        breadcrumb="Início / Fiscal / Cadastros / CFOP"
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

      {/* Modal Criar/Editar CFOP */}
      <Modal
        opened={modalOpen}
        onClose={fecharModal}
        title={editando ? 'Editar CFOP' : 'Novo CFOP'}
        size="md"
        centered
      >
        <SimpleGrid cols={1} spacing="sm" mb="sm">
          <TextInput
            label="Código CFOP *"
            placeholder="0000 (4 dígitos)"
            value={codigo}
            onChange={(e) => {
              const val = e.currentTarget.value.replace(/\D/g, '').slice(0, 4)
              setCodigo(val)
              if (codigoError) validarCodigo(val)
            }}
            maxLength={4}
            error={codigoError}
          />
          <TextInput
            label="Descrição *"
            placeholder="Descrição do CFOP"
            value={descricao}
            onChange={(e) => setDescricao(e.currentTarget.value)}
          />
          <Select
            label="Tipo *"
            placeholder="Selecione o tipo"
            value={tipo}
            onChange={(value) => setTipo((value as 'ENTRADA' | 'SAIDA') || '')}
            data={[
              { value: 'ENTRADA', label: 'Entrada' },
              { value: 'SAIDA', label: 'Saída' },
            ]}
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
