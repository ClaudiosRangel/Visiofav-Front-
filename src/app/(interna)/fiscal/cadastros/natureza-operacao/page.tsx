'use client'

import { useState, useEffect } from 'react'
import {
  Button,
  Group,
  Modal,
  TextInput,
  Select,
  Switch,
  ActionIcon,
  Tooltip,
  SimpleGrid,
} from '@mantine/core'
import { IconEdit, IconTrash, IconPlus } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { ListagemFiscal, type ColumnDef } from '@/components/fiscal/ListagemFiscal'
import { naturezaOperacaoCrud, type NaturezaOperacao } from '@/data/hooks/fiscal/useCadastrosFiscais'

// Valores alinhados a TIPOS_OPERACAO em
// src/modules/fiscal/cadastros/natureza-operacao.service.ts (backend) — o
// backend rejeita qualquer valor fora dessa lista com "Dados inválidos".
const TIPO_OPERACAO_OPTIONS = [
  { value: 'VENDA', label: 'Venda' },
  { value: 'DEVOLUCAO', label: 'Devolução' },
  { value: 'TRANSFERENCIA', label: 'Transferência' },
  { value: 'REMESSA', label: 'Remessa' },
  { value: 'BONIFICACAO', label: 'Bonificação' },
  { value: 'CONSIGNACAO', label: 'Consignação' },
  { value: 'INDUSTRIALIZACAO', label: 'Industrialização' },
  { value: 'IMPORTACAO', label: 'Importação' },
  { value: 'EXPORTACAO', label: 'Exportação' },
  { value: 'AMOSTRA_GRATIS', label: 'Amostra Grátis' },
  { value: 'DEMONSTRACAO', label: 'Demonstração' },
  { value: 'CONSERTO', label: 'Conserto' },
  { value: 'OUTRAS', label: 'Outras' },
]

export default function NaturezaOperacaoPage() {
  useModuloGuard('FISCAL')
  useEffect(() => { document.title = 'Vizor - Fiscal - Natureza de Operação' }, [])

  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<NaturezaOperacao | null>(null)

  // Form state
  const [descricao, setDescricao] = useState('')
  const [cfopEntrada, setCfopEntrada] = useState('')
  const [cfopSaida, setCfopSaida] = useState('')
  const [tipoOperacao, setTipoOperacao] = useState<string | null>(null)
  const [ativo, setAtivo] = useState(true)

  const criar = naturezaOperacaoCrud.useCriar()
  const atualizar = naturezaOperacaoCrud.useAtualizar()
  const excluir = naturezaOperacaoCrud.useExcluir()

  function resetForm() {
    setDescricao('')
    setCfopEntrada('')
    setCfopSaida('')
    setTipoOperacao(null)
    setAtivo(true)
  }

  function abrirNovo() {
    setEditando(null)
    resetForm()
    setModalOpen(true)
  }

  function abrirEditar(item: NaturezaOperacao) {
    setEditando(item)
    setDescricao(item.descricao || '')
    setCfopEntrada(item.cfopEntrada || '')
    setCfopSaida(item.cfopSaida || '')
    setTipoOperacao(item.tipoOperacao || null)
    setAtivo(item.ativo ?? true)
    setModalOpen(true)
  }

  function fecharModal() {
    setModalOpen(false)
    setEditando(null)
  }

  function handleSalvar() {
    const payload: any = {
      descricao,
      cfopEntrada: cfopEntrada || null,
      cfopSaida: cfopSaida || null,
      tipoOperacao: tipoOperacao || '',
      ativo,
    }

    if (editando) {
      atualizar.mutate(
        { id: editando.id, ...payload },
        {
          onSuccess: () => {
            notifications.show({ title: 'Sucesso', message: 'Natureza de Operação atualizada', color: 'green' })
            fecharModal()
          },
          onError: (err: any) => {
            notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao atualizar Natureza de Operação', color: 'red' })
          },
        },
      )
    } else {
      criar.mutate(payload, {
        onSuccess: () => {
          notifications.show({ title: 'Sucesso', message: 'Natureza de Operação criada', color: 'green' })
          fecharModal()
        },
        onError: (err: any) => {
          notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao criar Natureza de Operação', color: 'red' })
        },
      })
    }
  }

  function handleExcluir(item: NaturezaOperacao) {
    if (!confirm(`Excluir Natureza de Operação "${item.descricao}"?`)) return
    excluir.mutate(item.id, {
      onSuccess: () => {
        notifications.show({ title: 'Sucesso', message: 'Natureza de Operação excluída', color: 'green' })
      },
      onError: (err: any) => {
        notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao excluir Natureza de Operação', color: 'red' })
      },
    })
  }

  const columns: ColumnDef<NaturezaOperacao>[] = [
    { key: 'id', label: 'Código', render: (value: string) => value?.slice(0, 8) || '—' },
    { key: 'descricao', label: 'Descrição' },
    {
      key: 'cfopEntrada',
      label: 'CFOP padrão',
      render: (_value: string | null, item: NaturezaOperacao) => {
        const parts: string[] = []
        if (item.cfopEntrada) parts.push(`E: ${item.cfopEntrada}`)
        if (item.cfopSaida) parts.push(`S: ${item.cfopSaida}`)
        return parts.length > 0 ? parts.join(' / ') : '—'
      },
    },
    {
      key: 'tipoOperacao',
      label: 'Tipo',
      render: (value: string) => {
        const map = new Map(TIPO_OPERACAO_OPTIONS.map((o) => [o.value, o.label]))
        return map.get(value) || value || '—'
      },
    },
  ]

  const isFormValid = descricao.trim().length > 0 && tipoOperacao !== null

  return (
    <div>
      <Group justify="flex-end" mb="sm">
        <Button leftSection={<IconPlus size={16} />} onClick={abrirNovo}>
          Nova Natureza de Operação
        </Button>
      </Group>

      <ListagemFiscal<NaturezaOperacao>
        queryKey={['fiscal-natureza-operacao']}
        endpoint="/fiscal/cadastros/natureza-operacao"
        columns={columns}
        title="Cadastro de Natureza de Operação"
        breadcrumb="Início / Fiscal / Cadastros / Natureza de Operação"
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

      {/* Modal Criar/Editar Natureza de Operação */}
      <Modal
        opened={modalOpen}
        onClose={fecharModal}
        title={editando ? 'Editar Natureza de Operação' : 'Nova Natureza de Operação'}
        size="md"
        centered
      >
        <SimpleGrid cols={1} spacing="sm" mb="sm">
          <TextInput
            label="Descrição *"
            placeholder="Ex: Venda de mercadoria"
            value={descricao}
            onChange={(e) => setDescricao(e.currentTarget.value)}
          />
          <Select
            label="Tipo de Operação *"
            placeholder="Selecione o tipo"
            data={TIPO_OPERACAO_OPTIONS}
            value={tipoOperacao}
            onChange={setTipoOperacao}
          />
          <TextInput
            label="CFOP Entrada"
            placeholder="Ex: 1102 (opcional)"
            value={cfopEntrada}
            onChange={(e) => setCfopEntrada(e.currentTarget.value)}
            maxLength={4}
          />
          <TextInput
            label="CFOP Saída"
            placeholder="Ex: 5102 (opcional)"
            value={cfopSaida}
            onChange={(e) => setCfopSaida(e.currentTarget.value)}
            maxLength={4}
          />
          <Switch
            label="Ativo"
            checked={ativo}
            onChange={(e) => setAtivo(e.currentTarget.checked)}
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
