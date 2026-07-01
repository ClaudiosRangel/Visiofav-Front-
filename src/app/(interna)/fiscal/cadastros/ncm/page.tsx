'use client'

import { useState, useEffect } from 'react'
import {
  Button,
  Group,
  Modal,
  TextInput,
  NumberInput,
  ActionIcon,
  Tooltip,
  SimpleGrid,
} from '@mantine/core'
import { IconEdit, IconTrash, IconPlus } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { ListagemFiscal, type ColumnDef } from '@/components/fiscal/ListagemFiscal'
import { ncmCrud, type Ncm } from '@/data/hooks/fiscal/useCadastrosFiscais'

export default function NcmPage() {
  useModuloGuard('FISCAL')
  useEffect(() => { document.title = 'Vizor - Fiscal - NCM' }, [])

  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<Ncm | null>(null)

  // Form state
  const [codigo, setCodigo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [aliqIPI, setAliqIPI] = useState<number | string>(0)
  const [exTipi, setExTipi] = useState('')

  // Validation
  const [codigoError, setCodigoError] = useState('')

  const criar = ncmCrud.useCriar()
  const atualizar = ncmCrud.useAtualizar()
  const excluir = ncmCrud.useExcluir()

  function resetForm() {
    setCodigo('')
    setDescricao('')
    setAliqIPI(0)
    setExTipi('')
    setCodigoError('')
  }

  function abrirNovo() {
    setEditando(null)
    resetForm()
    setModalOpen(true)
  }

  function abrirEditar(ncm: Ncm) {
    setEditando(ncm)
    setCodigo(ncm.codigo || '')
    setDescricao(ncm.descricao || '')
    setAliqIPI(ncm.aliqIPI ?? 0)
    setExTipi(ncm.exTipi || '')
    setCodigoError('')
    setModalOpen(true)
  }

  function fecharModal() {
    setModalOpen(false)
    setEditando(null)
  }

  function validarCodigo(value: string): boolean {
    if (!/^\d{8}$/.test(value)) {
      setCodigoError('Código NCM deve ter exatamente 8 dígitos numéricos')
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
      aliqIPI: Number(aliqIPI) || null,
      exTipi: exTipi || null,
    }

    if (editando) {
      atualizar.mutate(
        { id: editando.id, ...payload },
        {
          onSuccess: () => {
            notifications.show({ title: 'Sucesso', message: 'NCM atualizado', color: 'green' })
            fecharModal()
          },
          onError: (err: any) => {
            notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao atualizar NCM', color: 'red' })
          },
        },
      )
    } else {
      criar.mutate(payload, {
        onSuccess: () => {
          notifications.show({ title: 'Sucesso', message: 'NCM criado', color: 'green' })
          fecharModal()
        },
        onError: (err: any) => {
          notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao criar NCM', color: 'red' })
        },
      })
    }
  }

  function handleExcluir(ncm: Ncm) {
    if (!confirm(`Excluir NCM ${ncm.codigo} - ${ncm.descricao}?`)) return
    excluir.mutate(ncm.id, {
      onSuccess: () => {
        notifications.show({ title: 'Sucesso', message: 'NCM excluído', color: 'green' })
      },
      onError: (err: any) => {
        notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao excluir NCM', color: 'red' })
      },
    })
  }

  const columns: ColumnDef<Ncm>[] = [
    { key: 'codigo', label: 'Código' },
    { key: 'descricao', label: 'Descrição' },
    {
      key: 'aliqIPI',
      label: 'Alíquota IPI',
      render: (value: number | null) => value != null ? `${value}%` : '—',
    },
    {
      key: 'exTipi',
      label: 'Ex TIPI',
      render: (value: string | null) => value || '—',
    },
  ]

  const isFormValid = codigo.length === 8 && /^\d{8}$/.test(codigo) && descricao.trim().length > 0

  return (
    <div>
      <Group justify="flex-end" mb="sm">
        <Button leftSection={<IconPlus size={16} />} onClick={abrirNovo}>
          Novo NCM
        </Button>
      </Group>

      <ListagemFiscal<Ncm>
        queryKey={['fiscal-ncm']}
        endpoint="/fiscal/cadastros/ncm"
        columns={columns}
        title="Cadastro de NCM"
        breadcrumb="Início / Fiscal / Cadastros / NCM"
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

      {/* Modal Criar/Editar NCM */}
      <Modal
        opened={modalOpen}
        onClose={fecharModal}
        title={editando ? 'Editar NCM' : 'Novo NCM'}
        size="md"
        centered
      >
        <SimpleGrid cols={1} spacing="sm" mb="sm">
          <TextInput
            label="Código NCM *"
            placeholder="00000000 (8 dígitos)"
            value={codigo}
            onChange={(e) => {
              const val = e.currentTarget.value.replace(/\D/g, '').slice(0, 8)
              setCodigo(val)
              if (codigoError) validarCodigo(val)
            }}
            maxLength={8}
            error={codigoError}
          />
          <TextInput
            label="Descrição *"
            placeholder="Descrição do NCM"
            value={descricao}
            onChange={(e) => setDescricao(e.currentTarget.value)}
          />
          <NumberInput
            label="Alíquota IPI (%)"
            value={aliqIPI}
            onChange={setAliqIPI}
            min={0}
            max={100}
            decimalScale={2}
          />
          <TextInput
            label="Ex TIPI"
            placeholder="Exceção TIPI (opcional)"
            value={exTipi}
            onChange={(e) => setExTipi(e.currentTarget.value)}
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
