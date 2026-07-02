'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import {
  Button, Card, Group, Text, LoadingOverlay, Tabs, Divider, Paper,
  SimpleGrid, Badge,
} from '@mantine/core'
import { IconArrowLeft, IconTruck, IconCash, IconNotes, IconPackage } from '@tabler/icons-react'
import { FormProvider, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { notifications } from '@mantine/notifications'
import { useRouter, useSearchParams } from 'next/navigation'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { pedidoVendaSchema, type PedidoVendaFormValues } from '@/lib/schemas/pedidoVendaSchema'
import { usePedidoVenda, useCriarPedido, useEditarPedido } from '@/data/hooks/vendas/usePedidoVenda'
import { isFieldDisabled, calcularTotalItem } from '@/components/vendas/utils'
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

  const { handleSubmit, reset, watch, formState: { errors } } = methods

  // Tab state
  const [activeTab, setActiveTab] = useState<string | null>('itens')

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

  // === Totalizadores (estilo ERP) ===
  const itens = watch('itens')
  const tipoDesconto = watch('tipoDesconto')
  const descontoGeral = watch('descontoGeral')
  const acrescimoGeral = watch('acrescimoGeral')

  const totais = useMemo(() => {
    const subtotal = (itens || []).reduce((acc, item) => {
      return acc + calcularTotalItem({
        precoUnitario: item.precoUnitario || 0,
        desconto: item.desconto || 0,
        descontoValor: item.descontoValor || 0,
        quantidade: item.quantidade || 0,
        frete: item.frete || 0,
        seguro: item.seguro || 0,
        outrasDespesas: item.outrasDespesas || 0,
      })
    }, 0)

    let descontoAbsoluto = 0
    if (tipoDesconto === 'PERCENTUAL' && descontoGeral) {
      descontoAbsoluto = subtotal * (descontoGeral / 100)
    } else if (tipoDesconto === 'VALOR_FIXO' && descontoGeral) {
      descontoAbsoluto = descontoGeral
    }

    const acrescimo = acrescimoGeral || 0
    const total = subtotal - descontoAbsoluto + acrescimo

    return {
      qtdItens: (itens || []).length,
      subtotal,
      descontoAbsoluto,
      acrescimo,
      total,
    }
  }, [itens, tipoDesconto, descontoGeral, acrescimoGeral])

  // Navigate to tab with first error
  function onInvalid(formErrors: typeof errors) {
    const errorFields = Object.keys(formErrors)
    if (errorFields.includes('itens') || errorFields.some(f => f.startsWith('itens'))) {
      setActiveTab('itens')
    } else if (['dataEntrega', 'transportadoraId', 'modalidadeFrete', 'enderecoEntrega'].some(f => errorFields.includes(f))) {
      setActiveTab('entrega')
    } else if (['tipoDesconto', 'descontoGeral', 'tipoAcrescimo', 'acrescimoGeral'].some(f => errorFields.includes(f))) {
      setActiveTab('financeiro')
    } else if (['observacao', 'observacaoNota'].some(f => errorFields.includes(f))) {
      setActiveTab('observacoes')
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
      <Group justify="space-between" mb="md">
        <Group>
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
          {isEditing && (
            <Badge color={status === 'RASCUNHO' ? 'gray' : 'blue'} size="lg" variant="light">
              {status}
            </Badge>
          )}
        </Group>
        <Group>
          <Button
            variant="default"
            onClick={() => router.push(isEditing ? `/vendas/pedidos/${editId}` : '/vendas/pedidos')}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form="pedido-form"
            loading={isSubmitting}
          >
            {isEditing ? 'Salvar Alterações' : 'Criar Pedido'}
          </Button>
        </Group>
      </Group>

      {/* Banner de status para pedidos confirmados */}
      {isEditing && pedidoExistente && (
        <BannerStatus status={status} temFaturamentoParcial={temFaturamentoParcial} />
      )}

      {/* Form */}
      <FormProvider {...methods}>
        <form id="pedido-form" onSubmit={handleSubmit(onSubmit, onInvalid)}>

          {/* ═══ CABEÇALHO COMPACTO — Dados essenciais sempre visíveis ═══ */}
          <Card withBorder mb="md" p="md">
            <SecaoDadosGerais disabled={dadosGeraisDisabled} />
          </Card>

          {/* ═══ CORPO PRINCIPAL — Tabs estilo ERP (Itens + Detalhes) ═══ */}
          <Card withBorder mb="md" p={0}>
            <Tabs value={activeTab} onChange={setActiveTab}>
              <Tabs.List>
                <Tabs.Tab value="itens" leftSection={<IconPackage size={16} />}>
                  Itens ({totais.qtdItens})
                </Tabs.Tab>
                <Tabs.Tab value="entrega" leftSection={<IconTruck size={16} />}>
                  Entrega / Transporte
                </Tabs.Tab>
                <Tabs.Tab value="financeiro" leftSection={<IconCash size={16} />}>
                  Financeiro
                </Tabs.Tab>
                <Tabs.Tab value="observacoes" leftSection={<IconNotes size={16} />}>
                  Observações
                </Tabs.Tab>
              </Tabs.List>

              <div style={{ padding: '16px' }}>
                <Tabs.Panel value="itens">
                  <SecaoItensPedido disabled={itensDisabled} status={status} />
                </Tabs.Panel>

                <Tabs.Panel value="entrega">
                  <SecaoEntregaTransporte disabled={entregaDisabled} />
                </Tabs.Panel>

                <Tabs.Panel value="financeiro">
                  <SecaoFinanceiro disabled={financeiroDisabled} />
                </Tabs.Panel>

                <Tabs.Panel value="observacoes">
                  <SecaoObservacoes disabled={observacoesDisabled} />
                </Tabs.Panel>
              </div>
            </Tabs>
          </Card>

          {/* ═══ RODAPÉ TOTALIZADOR — Sempre visível (estilo Sankhya/TOTVS) ═══ */}
          <Paper withBorder p="md" radius="md" style={{ position: 'sticky', bottom: 0, zIndex: 10, background: 'var(--mantine-color-body)' }}>
            <SimpleGrid cols={{ base: 2, sm: 5 }}>
              <div>
                <Text size="xs" c="dimmed">Itens</Text>
                <Text fw={600}>{totais.qtdItens}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Subtotal</Text>
                <Text fw={600}>
                  {totais.subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Desconto</Text>
                <Text fw={600} c="red">
                  {totais.descontoAbsoluto > 0
                    ? `- ${totais.descontoAbsoluto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
                    : '—'}
                </Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Acréscimo</Text>
                <Text fw={600} c="teal">
                  {totais.acrescimo > 0
                    ? `+ ${totais.acrescimo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
                    : '—'}
                </Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Total do Pedido</Text>
                <Text fw={700} size="xl" c="blue">
                  {totais.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </Text>
              </div>
            </SimpleGrid>
          </Paper>

        </form>
      </FormProvider>
    </div>
  )
}
