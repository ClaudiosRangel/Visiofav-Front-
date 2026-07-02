'use client'

import { Suspense, useEffect, useState } from 'react'
import { Accordion, Button, Group, Text, LoadingOverlay } from '@mantine/core'
import { IconArrowLeft } from '@tabler/icons-react'
import { FormProvider, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { notifications } from '@mantine/notifications'
import { useRouter, useSearchParams } from 'next/navigation'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { pedidoVendaSchema, type PedidoVendaFormValues } from '@/lib/schemas/pedidoVendaSchema'
import { usePedidoVenda, useCriarPedido, useEditarPedido } from '@/data/hooks/vendas/usePedidoVenda'
import { isFieldDisabled, getFirstErrorSection } from '@/components/vendas/utils'
import { BannerStatus } from '@/components/vendas/BannerStatus'
import { SecaoDadosGerais } from '@/components/vendas/SecaoDadosGerais'
import { SecaoEntregaTransporte } from '@/components/vendas/SecaoEntregaTransporte'
import { SecaoFinanceiro } from '@/components/vendas/SecaoFinanceiro'
import { SecaoItensPedido } from '@/components/vendas/SecaoItensPedido'
import { SecaoObservacoes } from '@/components/vendas/SecaoObservacoes'
import type { StatusPedido } from '@/data/hooks/vendas/types'

const DEFAULT_VALUES: PedidoVendaFormValues = {
  clienteId: '',
  vendedorId: '',
  tabelaPrecoId: '',
  condicaoPagId: '',
  prioridade: 'NORMAL',
  origemPedido: 'MANUAL',
  numeroPedidoCliente: '',
  itens: [
    {
      produtoId: '',
      unidade: '',
      quantidade: 1,
      precoUnitario: 0,
      desconto: 0,
      descontoValor: 0,
      frete: 0,
      seguro: 0,
      outrasDespesas: 0,
    },
  ],
}

export default function NovoPedidoVendaPage() {
  return (
    <Suspense fallback={<LoadingOverlay visible />}>
      <NovoPedidoVendaContent />
    </Suspense>
  )
}

function NovoPedidoVendaContent() {
  useModuloGuard('VENDAS')
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get('editId')
  const isEditing = !!editId

  // Fetch existing pedido for edit mode
  const { data: pedidoExistente, isLoading: isLoadingPedido } = usePedidoVenda(editId || '')

  // Mutations
  const criarPedido = useCriarPedido()
  const editarPedido = useEditarPedido(editId || '')

  // Determine status
  const status: StatusPedido = pedidoExistente?.status || 'RASCUNHO'

  // Redirect to detail page if status is EFETIVADO or CANCELADO
  useEffect(() => {
    if (pedidoExistente && (pedidoExistente.status === 'EFETIVADO' || pedidoExistente.status === 'CANCELADO')) {
      router.replace(`/vendas/pedidos/${pedidoExistente.id}`)
    }
  }, [pedidoExistente, router])

  // Form setup
  const methods = useForm<PedidoVendaFormValues>({
    resolver: zodResolver(pedidoVendaSchema),
    defaultValues: DEFAULT_VALUES,
  })

  const { handleSubmit, reset, formState: { errors } } = methods

  // Accordion state
  const [openedSections, setOpenedSections] = useState<string[]>(['dados-gerais'])

  // Populate form when editing
  useEffect(() => {
    if (pedidoExistente && isEditing) {
      reset({
        clienteId: pedidoExistente.clienteId || '',
        vendedorId: pedidoExistente.vendedorId || '',
        tabelaPrecoId: pedidoExistente.tabelaPrecoId || '',
        condicaoPagId: pedidoExistente.condicaoPagId || '',
        prioridade: pedidoExistente.prioridade || 'NORMAL',
        origemPedido: pedidoExistente.origemPedido || 'MANUAL',
        numeroPedidoCliente: pedidoExistente.numeroPedidoCliente || '',
        dataValidade: pedidoExistente.dataValidade || undefined,
        dataEntrega: pedidoExistente.dataEntrega || undefined,
        transportadoraId: pedidoExistente.transportadoraId || undefined,
        modalidadeFrete: pedidoExistente.modalidadeFrete ?? undefined,
        enderecoEntrega: pedidoExistente.enderecoEntrega
          ? { ...pedidoExistente.enderecoEntrega, uf: pedidoExistente.enderecoEntrega.uf as any }
          : undefined,
        tipoDesconto: pedidoExistente.tipoDesconto || undefined,
        descontoGeral: pedidoExistente.descontoGeral ?? undefined,
        tipoAcrescimo: pedidoExistente.tipoAcrescimo || undefined,
        acrescimoGeral: pedidoExistente.acrescimoGeral ?? undefined,
        observacao: pedidoExistente.observacao || undefined,
        observacaoNota: pedidoExistente.observacaoNota || undefined,
        orcamentoOrigemId: undefined,
        itens: (pedidoExistente.itens || []).map((item) => ({
          produtoId: item.produtoId,
          unidade: item.unidade || item.produto?.unidade || 'UN',
          quantidade: Number(item.quantidade),
          precoUnitario: Number(item.precoUnitario),
          desconto: Number(item.desconto || 0),
          descontoValor: Number(item.descontoValor || 0),
          frete: Number(item.frete || 0),
          seguro: Number(item.seguro || 0),
          outrasDespesas: Number(item.outrasDespesas || 0),
          observacaoItem: item.observacaoItem || undefined,
          dataEntregaItem: item.dataEntregaItem || undefined,
          comissaoPercItem: item.comissaoPercItem ?? undefined,
        })),
      })
    }
  }, [pedidoExistente, isEditing, reset])

  // Check if pedido has partial billings
  const temFaturamentoParcial = (pedidoExistente?.itens || []).some(
    (item) => item.quantidadeFaturada > 0
  )

  // Status-based disabling
  const dadosGeraisDisabled = isEditing && isFieldDisabled('clienteId', status)
  const entregaDisabled = isEditing && isFieldDisabled('dataEntrega', status)
  const financeiroDisabled = isEditing && isFieldDisabled('tipoDesconto', status)
  const itensDisabled = isEditing && isFieldDisabled('itens', status)
  const observacoesDisabled = isEditing && isFieldDisabled('observacao', status)

  // Auto-open section with first error on validation failure
  function onInvalid(formErrors: typeof errors) {
    const section = getFirstErrorSection(formErrors as Record<string, any>)
    if (section && !openedSections.includes(section)) {
      setOpenedSections((prev) => [...prev, section])
    }
  }

  // Submit handler
  async function onSubmit(data: PedidoVendaFormValues) {
    try {
      if (isEditing) {
        await editarPedido.mutateAsync(data)
        notifications.show({
          title: 'Sucesso',
          message: 'Pedido atualizado com sucesso',
          color: 'green',
        })
        router.push(`/vendas/pedidos/${editId}`)
      } else {
        await criarPedido.mutateAsync(data)
        notifications.show({
          title: 'Sucesso',
          message: 'Pedido de venda criado com sucesso',
          color: 'green',
        })
        router.push('/vendas/pedidos')
      }
    } catch (err: any) {
      notifications.show({
        title: 'Erro',
        message: err?.response?.data?.message || 'Falha ao salvar o pedido',
        color: 'red',
      })
    }
  }

  const isSubmitting = criarPedido.isPending || editarPedido.isPending

  // Loading state for edit mode
  if (isEditing && isLoadingPedido) {
    return <LoadingOverlay visible />
  }

  return (
    <div>
      {/* Breadcrumb */}
      <Text size="xs" c="dimmed" mb={4}>
        Início / Vendas / Pedidos / {isEditing ? `Editar #${pedidoExistente?.numero || ''}` : 'Novo'}
      </Text>

      {/* Header */}
      <Group mb="lg">
        <Button
          variant="subtle"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => router.push(isEditing ? `/vendas/pedidos/${editId}` : '/vendas/pedidos')}
        >
          Voltar
        </Button>
        <Text size="xl" fw={600}>
          {isEditing ? `Editar Pedido #${pedidoExistente?.numero || ''}` : 'Novo Pedido de Venda'}
        </Text>
      </Group>

      {/* Banner de status para pedidos confirmados */}
      {isEditing && pedidoExistente && (
        <BannerStatus status={status} temFaturamentoParcial={temFaturamentoParcial} />
      )}

      {/* Form */}
      <FormProvider {...methods}>
        <form onSubmit={handleSubmit(onSubmit, onInvalid)}>
          <Accordion
            multiple
            value={openedSections}
            onChange={setOpenedSections}
          >
            <Accordion.Item value="dados-gerais">
              <Accordion.Control>Dados Gerais</Accordion.Control>
              <Accordion.Panel>
                <SecaoDadosGerais disabled={dadosGeraisDisabled} />
              </Accordion.Panel>
            </Accordion.Item>

            <Accordion.Item value="entrega-transporte">
              <Accordion.Control>Entrega e Transporte</Accordion.Control>
              <Accordion.Panel>
                <SecaoEntregaTransporte disabled={entregaDisabled} />
              </Accordion.Panel>
            </Accordion.Item>

            <Accordion.Item value="financeiro">
              <Accordion.Control>Financeiro (Desconto/Acréscimo)</Accordion.Control>
              <Accordion.Panel>
                <SecaoFinanceiro disabled={financeiroDisabled} />
              </Accordion.Panel>
            </Accordion.Item>

            <Accordion.Item value="itens-pedido">
              <Accordion.Control>Itens do Pedido</Accordion.Control>
              <Accordion.Panel>
                <SecaoItensPedido disabled={itensDisabled} status={status} />
              </Accordion.Panel>
            </Accordion.Item>

            <Accordion.Item value="observacoes">
              <Accordion.Control>Observações</Accordion.Control>
              <Accordion.Panel>
                <SecaoObservacoes disabled={observacoesDisabled} />
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>

          {/* Actions */}
          <Group justify="flex-end" mt="lg">
            <Button
              variant="default"
              onClick={() => router.push(isEditing ? `/vendas/pedidos/${editId}` : '/vendas/pedidos')}
            >
              Cancelar
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {isEditing ? 'Salvar Alterações' : 'Criar Pedido'}
            </Button>
          </Group>
        </form>
      </FormProvider>
    </div>
  )
}
