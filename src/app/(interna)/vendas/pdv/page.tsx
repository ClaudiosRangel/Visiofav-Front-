'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Button, Text, TextInput, Group, Stack, Modal, NumberInput,
  Textarea, ActionIcon, Tooltip, Badge, Divider, Paper, ScrollArea,
} from '@mantine/core'
import {
  IconCash, IconCreditCard, IconQrcode, IconTrash,
  IconPlayerStop, IconReceipt, IconPlus, IconLogout,
  IconArrowDown, IconArrowUp, IconSearch,
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import {
  useCaixaAtual, useAbrirCaixa, useFecharCaixa,
  useIniciarVenda, useAdicionarItem, useRemoverItem,
  useFinalizarVenda, useCancelarVenda, useDetalheVenda,
  useMovimentacaoCaixa,
} from '@/data/hooks/vendas/usePdv'

// === Types ===
interface VendaItem {
  id: string
  sequencia: number
  produto?: { nome: string; sku: string }
  quantidade: number
  valorUnitario: number
  valorTotal: number
  desconto?: number
}

interface Pagamento {
  forma: 'DINHEIRO' | 'CARTAO_CREDITO' | 'CARTAO_DEBITO' | 'PIX'
  valor: number
}

// === Helpers ===
function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const FORMA_LABELS: Record<string, string> = {
  DINHEIRO: '💰 Dinheiro',
  CARTAO_CREDITO: '💳 Crédito',
  CARTAO_DEBITO: '💳 Débito',
  PIX: '📱 PIX',
}

// === Main Component ===
export default function PdvPage() {
  // --- Dark theme effect (only this page) ---
  useEffect(() => {
    const original = document.body.style.backgroundColor
    document.body.style.backgroundColor = '#1a1b1e'
    return () => { document.body.style.backgroundColor = original }
  }, [])

  useEffect(() => { document.title = 'Vizor - PDV' }, [])

  // --- State ---
  const [vendaId, setVendaId] = useState<string | null>(null)
  const [codigoInput, setCodigoInput] = useState('')
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([])
  const [showFinalizarModal, setShowFinalizarModal] = useState(false)
  const [showAbrirCaixaModal, setShowAbrirCaixaModal] = useState(false)
  const [showFecharCaixaModal, setShowFecharCaixaModal] = useState(false)
  const [showMovimentacaoModal, setShowMovimentacaoModal] = useState(false)
  const [showBuscarProdutoModal, setShowBuscarProdutoModal] = useState(false)
  const [buscaProduto, setBuscaProduto] = useState('')
  const [valorAbertura, setValorAbertura] = useState<number>(0)
  const [numeroCaixa, setNumeroCaixa] = useState<number>(1)
  const [valorFechamento, setValorFechamento] = useState<number>(0)
  const [obsFechamento, setObsFechamento] = useState('')
  const [tipoMovimentacao, setTipoMovimentacao] = useState<'SANGRIA' | 'SUPRIMENTO'>('SANGRIA')
  const [valorMovimentacao, setValorMovimentacao] = useState<number>(0)
  const [motivoMovimentacao, setMotivoMovimentacao] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // --- Hooks ---
  const { data: caixa, isLoading: loadingCaixa, isError: errorCaixa } = useCaixaAtual()
  const abrirCaixa = useAbrirCaixa()
  const fecharCaixa = useFecharCaixa()
  const iniciarVenda = useIniciarVenda()
  const adicionarItem = useAdicionarItem()
  const removerItem = useRemoverItem()
  const finalizarVenda = useFinalizarVenda()
  const cancelarVenda = useCancelarVenda()
  const movimentacao = useMovimentacaoCaixa()
  const { data: vendaDetalhe } = useDetalheVenda(vendaId || '')

  // Product search
  const { data: produtosData } = useQuery<any>({
    queryKey: ['produtos-pdv-busca', buscaProduto],
    queryFn: async () => {
      const { data } = await api.get('/produtos', { params: { limit: 50, status: 'true', busca: buscaProduto || undefined } })
      return data
    },
    enabled: showBuscarProdutoModal,
    staleTime: 1000 * 30,
  })
  const produtosFiltrados = (produtosData?.data || []).filter((p: any) => {
    if (!buscaProduto.trim()) return true
    const termo = buscaProduto.toLowerCase()
    return p.nome?.toLowerCase().includes(termo) || p.codigo?.toLowerCase().includes(termo) || p.cEAN?.includes(termo)
  })

  const itens: VendaItem[] = vendaDetalhe?.itens || []
  const subtotal = itens.reduce((acc: number, i: VendaItem) => acc + i.valorTotal, 0)
  const totalPago = pagamentos.reduce((acc, p) => acc + p.valor, 0)
  const troco = totalPago - subtotal

  // --- Actions ---
  const handleNovaVenda = useCallback(() => {
    iniciarVenda.mutate(undefined, {
      onSuccess: (data) => {
        setVendaId(data.id)
        setPagamentos([])
        notifications.show({ title: 'Nova venda', message: `Venda #${data.numero} iniciada`, color: 'green' })
        setTimeout(() => inputRef.current?.focus(), 100)
      },
      onError: (err: any) => {
        notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Erro ao iniciar venda', color: 'red' })
      },
    })
  }, [iniciarVenda])

  const handleAdicionarItem = useCallback(() => {
    if (!vendaId || !codigoInput.trim()) return
    adicionarItem.mutate(
      { vendaId, codigoBarras: codigoInput.trim(), quantidade: 1 },
      {
        onSuccess: () => {
          setCodigoInput('')
          inputRef.current?.focus()
        },
        onError: (err: any) => {
          notifications.show({ title: 'Produto não encontrado', message: err?.response?.data?.message || 'Verifique o código', color: 'red' })
          inputRef.current?.select()
        },
      }
    )
  }, [vendaId, codigoInput, adicionarItem])

  const handleRemoverItem = useCallback((itemId: string) => {
    if (!vendaId) return
    removerItem.mutate({ vendaId, itemId }, {
      onError: (err: any) => {
        notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Erro ao remover', color: 'red' })
      },
    })
  }, [vendaId, removerItem])

  const handleCancelarVenda = useCallback(() => {
    if (!vendaId) return
    if (!confirm('Cancelar esta venda?')) return
    cancelarVenda.mutate(vendaId, {
      onSuccess: () => {
        setVendaId(null)
        setPagamentos([])
        notifications.show({ title: 'Venda cancelada', message: 'Venda foi cancelada', color: 'orange' })
      },
      onError: (err: any) => {
        notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Erro ao cancelar', color: 'red' })
      },
    })
  }, [vendaId, cancelarVenda])

  const handleFinalizar = useCallback(() => {
    if (!vendaId || pagamentos.length === 0) return
    if (totalPago < subtotal) {
      notifications.show({ title: 'Pagamento insuficiente', message: 'O valor pago é menor que o total', color: 'red' })
      return
    }
    finalizarVenda.mutate(
      { vendaId, pagamentos: pagamentos.map(p => ({ forma: p.forma, valor: p.valor })) },
      {
        onSuccess: () => {
          notifications.show({ title: '✅ Venda finalizada!', message: troco > 0 ? `Troco: ${formatCurrency(troco)}` : 'Venda concluída com sucesso', color: 'green' })
          setVendaId(null)
          setPagamentos([])
          setShowFinalizarModal(false)
        },
        onError: (err: any) => {
          notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Erro ao finalizar', color: 'red' })
        },
      }
    )
  }, [vendaId, pagamentos, totalPago, subtotal, troco, finalizarVenda])

  const addPagamento = (forma: Pagamento['forma']) => {
    const restante = subtotal - totalPago
    if (restante <= 0) return
    setPagamentos(prev => [...prev, { forma, valor: restante }])
  }

  const removePagamento = (index: number) => {
    setPagamentos(prev => prev.filter((_, i) => i !== index))
  }

  const handleAbrirCaixa = () => {
    abrirCaixa.mutate({ numero: numeroCaixa, valorAbertura }, {
      onSuccess: () => {
        setShowAbrirCaixaModal(false)
        notifications.show({ title: 'Caixa aberto', message: `Caixa #${numeroCaixa} aberto com sucesso`, color: 'green' })
      },
      onError: (err: any) => {
        notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Erro ao abrir caixa', color: 'red' })
      },
    })
  }

  const handleFecharCaixa = () => {
    fecharCaixa.mutate({ valorFechamento, observacao: obsFechamento || undefined }, {
      onSuccess: () => {
        setShowFecharCaixaModal(false)
        setVendaId(null)
        setPagamentos([])
        notifications.show({ title: 'Caixa fechado', message: 'Caixa fechado com sucesso', color: 'blue' })
      },
      onError: (err: any) => {
        notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Erro ao fechar caixa', color: 'red' })
      },
    })
  }

  const handleMovimentacao = () => {
    movimentacao.mutate({ tipo: tipoMovimentacao, valor: valorMovimentacao, motivo: motivoMovimentacao }, {
      onSuccess: () => {
        setShowMovimentacaoModal(false)
        setValorMovimentacao(0)
        setMotivoMovimentacao('')
        notifications.show({ title: 'Movimentação registrada', message: `${tipoMovimentacao} de ${formatCurrency(valorMovimentacao)}`, color: 'green' })
      },
      onError: (err: any) => {
        notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Erro na movimentação', color: 'red' })
      },
    })
  }

  // --- Keyboard Shortcuts ---
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F1') { e.preventDefault(); handleNovaVenda() }
      if (e.key === 'F2') { e.preventDefault(); if (vendaId && itens.length > 0) setShowFinalizarModal(true) }
      if (e.key === 'F3') { e.preventDefault(); if (vendaId) setShowBuscarProdutoModal(true) }
      if (e.key === 'F4') { e.preventDefault(); handleCancelarVenda() }
      if (e.key === 'F8') { e.preventDefault(); setShowMovimentacaoModal(true) }
      if (e.key === 'Escape') { setShowFinalizarModal(false); setShowMovimentacaoModal(false); setShowBuscarProdutoModal(false) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleNovaVenda, handleCancelarVenda, vendaId, itens.length])

  // --- Auto show "Abrir Caixa" when no caixa ---
  useEffect(() => {
    if (!loadingCaixa && (errorCaixa || !caixa)) {
      setShowAbrirCaixaModal(true)
    }
  }, [loadingCaixa, errorCaixa, caixa])

  // --- Recover existing sale if caixa has one in progress ---
  useEffect(() => {
    if (!caixa?.id || vendaId) return
    // Check if there's an active sale in this caixa
    api.get(`/pdv/caixa/${caixa.id}/vendas`).then(({ data: vendas }) => {
      const vendaAberta = (vendas || []).find((v: any) => v.status === 'EM_ANDAMENTO')
      if (vendaAberta) {
        setVendaId(vendaAberta.id)
        notifications.show({
          title: 'Venda recuperada',
          message: `Venda #${vendaAberta.numero} em andamento foi recuperada`,
          color: 'blue',
        })
      }
    }).catch(() => { /* ignore */ })
  }, [caixa?.id, vendaId])

  // --- Styles ---
  const styles = {
    page: {
      minHeight: '100vh',
      backgroundColor: '#1a1b1e',
      color: '#c1c2c5',
      padding: '0',
      margin: '-16px',
      fontFamily: 'inherit',
    } as React.CSSProperties,
    header: {
      backgroundColor: '#25262b',
      padding: '12px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottom: '1px solid #373a40',
    } as React.CSSProperties,
    main: {
      display: 'grid',
      gridTemplateColumns: '1fr 400px',
      height: 'calc(100vh - 110px)',
      gap: '0',
    } as React.CSSProperties,
    itemsPanel: {
      padding: '16px 24px',
      overflowY: 'auto' as const,
    } as React.CSSProperties,
    sidePanel: {
      backgroundColor: '#25262b',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column' as const,
      borderLeft: '1px solid #373a40',
      overflowY: 'auto' as const,
    } as React.CSSProperties,
    footer: {
      backgroundColor: '#25262b',
      padding: '8px 24px',
      borderTop: '1px solid #373a40',
      display: 'flex',
      gap: '24px',
      alignItems: 'center',
    } as React.CSSProperties,
    itemRow: {
      display: 'grid',
      gridTemplateColumns: '40px 1fr 80px 120px 40px',
      alignItems: 'center',
      padding: '12px 16px',
      borderRadius: '8px',
      marginBottom: '4px',
      backgroundColor: '#2c2e33',
      gap: '12px',
    } as React.CSSProperties,
  }

  // --- No Caixa → Show modal ---
  if (!loadingCaixa && (errorCaixa || !caixa)) {
    return (
      <div style={styles.page}>
        <Modal
          opened={showAbrirCaixaModal}
          onClose={() => {}}
          title="Abrir Caixa"
          centered
          withCloseButton={false}
          styles={{ content: { backgroundColor: '#25262b' }, header: { backgroundColor: '#25262b', color: '#fff' } }}
        >
          <Stack gap="md">
            <NumberInput
              label="Número do Caixa"
              value={numeroCaixa}
              onChange={(v) => setNumeroCaixa(Number(v) || 1)}
              min={1}
              styles={{ label: { color: '#c1c2c5' } }}
            />
            <NumberInput
              label="Valor de Abertura (R$)"
              value={valorAbertura}
              onChange={(v) => setValorAbertura(Number(v) || 0)}
              min={0}
              decimalScale={2}
              prefix="R$ "
              styles={{ label: { color: '#c1c2c5' } }}
            />
            <Button
              fullWidth
              size="lg"
              color="green"
              onClick={handleAbrirCaixa}
              loading={abrirCaixa.isPending}
            >
              Abrir Caixa
            </Button>
          </Stack>
        </Modal>
        <div style={{ ...styles.header, justifyContent: 'center' }}>
          <Text size="xl" fw={700} c="white">PDV — Nenhum caixa aberto</Text>
        </div>
      </div>
    )
  }

  // --- Main POS UI ---
  return (
    <div style={styles.page}>
      {/* HEADER */}
      <div style={styles.header}>
        <Group gap="lg">
          <Text size="xl" fw={700} c="white">⚡ PDV</Text>
          <Badge size="lg" variant="filled" color="blue">
            Caixa #{caixa?.numero || '—'}
          </Badge>
          <Text size="sm" c="dimmed">{caixa?.operador?.nome || 'Operador'}</Text>
        </Group>
        <Group gap="sm">
          <Button
            variant="subtle"
            color="yellow"
            size="xs"
            leftSection={<IconArrowDown size={14} />}
            onClick={() => { setTipoMovimentacao('SANGRIA'); setShowMovimentacaoModal(true) }}
          >
            Sangria
          </Button>
          <Button
            variant="subtle"
            color="cyan"
            size="xs"
            leftSection={<IconArrowUp size={14} />}
            onClick={() => { setTipoMovimentacao('SUPRIMENTO'); setShowMovimentacaoModal(true) }}
          >
            Suprimento
          </Button>
          <Button
            variant="subtle"
            color="red"
            size="xs"
            leftSection={<IconLogout size={14} />}
            onClick={() => setShowFecharCaixaModal(true)}
          >
            Fechar Caixa
          </Button>
        </Group>
      </div>

      {/* MAIN CONTENT */}
      <div style={styles.main}>
        {/* LEFT: Items List */}
        <div style={styles.itemsPanel}>
          {vendaId ? (
            <>
              <Group justify="space-between" mb="sm">
                <Text size="lg" fw={600} c="white">
                  Venda #{vendaDetalhe?.numero || '—'}
                </Text>
                <Badge size="md" color="green">{itens.length} {itens.length === 1 ? 'item' : 'itens'}</Badge>
              </Group>

              {/* Items header */}
              <div style={{ ...styles.itemRow, backgroundColor: 'transparent', marginBottom: '8px' }}>
                <Text size="xs" c="dimmed" fw={600}>#</Text>
                <Text size="xs" c="dimmed" fw={600}>Produto</Text>
                <Text size="xs" c="dimmed" fw={600} ta="center">Qtd</Text>
                <Text size="xs" c="dimmed" fw={600} ta="right">Valor</Text>
                <div />
              </div>

              <ScrollArea h="calc(100vh - 240px)" offsetScrollbars>
                {itens.map((item, idx) => (
                  <div key={item.id} style={styles.itemRow}>
                    <Text size="sm" c="dimmed">{idx + 1}</Text>
                    <div>
                      <Text size="md" c="white" fw={500} lineClamp={1}>
                        {item.produto?.nome || 'Produto'}
                      </Text>
                      <Text size="xs" c="dimmed">{item.produto?.sku || ''}</Text>
                    </div>
                    <Text size="md" c="white" ta="center" fw={500}>{item.quantidade}</Text>
                    <Text size="md" c="white" ta="right" fw={600}>
                      {formatCurrency(item.valorTotal)}
                    </Text>
                    <Tooltip label="Remover">
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        size="sm"
                        onClick={() => handleRemoverItem(item.id)}
                      >
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Tooltip>
                  </div>
                ))}

                {itens.length === 0 && (
                  <Text ta="center" c="dimmed" mt="xl" size="lg">
                    Nenhum item — digite o código e pressione Enter
                  </Text>
                )}
              </ScrollArea>
            </>
          ) : (
            <Stack align="center" justify="center" h="100%" gap="lg">
              <Text size="xl" c="dimmed">Nenhuma venda em andamento</Text>
              <Button size="xl" color="green" leftSection={<IconPlus size={20} />} onClick={handleNovaVenda}>
                Nova Venda (F1)
              </Button>
            </Stack>
          )}
        </div>

        {/* RIGHT: Action Panel */}
        <div style={styles.sidePanel}>
          {/* Input + Search button */}
          <Group gap="xs" mb="sm">
            <TextInput
              ref={inputRef}
              placeholder="Código de barras / SKU"
              size="lg"
              value={codigoInput}
              onChange={(e) => setCodigoInput(e.currentTarget.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdicionarItem() }}
              disabled={!vendaId}
              styles={{
                input: { backgroundColor: '#1a1b1e', color: '#fff', border: '1px solid #373a40', fontSize: '18px' },
                root: { flex: 1 },
              }}
            />
            <Tooltip label="Buscar produto por nome (F3)">
              <Button
                size="lg"
                variant="light"
                color="yellow"
                onClick={() => setShowBuscarProdutoModal(true)}
                disabled={!vendaId}
                style={{ padding: '0 14px' }}
              >
                <IconSearch size={22} />
              </Button>
            </Tooltip>
          </Group>
          <Button
            fullWidth
            size="md"
            color="blue"
            onClick={handleAdicionarItem}
            disabled={!vendaId || !codigoInput.trim()}
            loading={adicionarItem.isPending}
            mb="lg"
          >
            Adicionar Item (Enter)
          </Button>

          {/* Totals */}
          <Paper p="md" radius="md" style={{ backgroundColor: '#1a1b1e', border: '1px solid #373a40' }}>
            <Group justify="space-between" mb="xs">
              <Text size="sm" c="dimmed">Subtotal:</Text>
              <Text size="lg" c="white" fw={500}>{formatCurrency(subtotal)}</Text>
            </Group>
            <Divider color="dark.4" my="sm" />
            <Group justify="space-between">
              <Text size="md" c="dimmed" fw={600}>TOTAL:</Text>
              <Text size="xl" fw={700} style={{ fontSize: '32px', color: '#51cf66' }}>
                {formatCurrency(subtotal)}
              </Text>
            </Group>
          </Paper>

          {/* Payment buttons */}
          <Stack gap="xs" mt="lg">
            <Text size="sm" c="dimmed" fw={600}>Formas de Pagamento:</Text>
            <Group grow>
              <Button
                variant="outline"
                color="green"
                leftSection={<IconCash size={18} />}
                onClick={() => addPagamento('DINHEIRO')}
                disabled={!vendaId || subtotal <= 0}
                size="md"
              >
                Dinheiro
              </Button>
              <Button
                variant="outline"
                color="blue"
                leftSection={<IconCreditCard size={18} />}
                onClick={() => addPagamento('CARTAO_CREDITO')}
                disabled={!vendaId || subtotal <= 0}
                size="md"
              >
                Crédito
              </Button>
            </Group>
            <Group grow>
              <Button
                variant="outline"
                color="cyan"
                leftSection={<IconCreditCard size={18} />}
                onClick={() => addPagamento('CARTAO_DEBITO')}
                disabled={!vendaId || subtotal <= 0}
                size="md"
              >
                Débito
              </Button>
              <Button
                variant="outline"
                color="violet"
                leftSection={<IconQrcode size={18} />}
                onClick={() => addPagamento('PIX')}
                disabled={!vendaId || subtotal <= 0}
                size="md"
              >
                PIX
              </Button>
            </Group>
          </Stack>

          {/* Payment list */}
          {pagamentos.length > 0 && (
            <Stack gap="xs" mt="md">
              {pagamentos.map((p, idx) => (
                <Group key={idx} justify="space-between" style={{ backgroundColor: '#2c2e33', padding: '8px 12px', borderRadius: '6px' }}>
                  <Text size="sm" c="white">{FORMA_LABELS[p.forma]}</Text>
                  <Group gap="xs">
                    <Text size="sm" c="white" fw={500}>{formatCurrency(p.valor)}</Text>
                    <ActionIcon size="xs" color="red" variant="subtle" onClick={() => removePagamento(idx)}>
                      <IconTrash size={12} />
                    </ActionIcon>
                  </Group>
                </Group>
              ))}
              {troco > 0 && (
                <Text ta="center" size="lg" fw={700} style={{ color: '#51cf66' }}>
                  TROCO: {formatCurrency(troco)}
                </Text>
              )}
            </Stack>
          )}

          {/* Action buttons */}
          <Stack gap="sm" mt="auto" pt="lg">
            <Button
              fullWidth
              size="lg"
              color="green"
              leftSection={<IconReceipt size={20} />}
              onClick={() => setShowFinalizarModal(true)}
              disabled={!vendaId || itens.length === 0 || pagamentos.length === 0 || totalPago < subtotal}
              style={{ fontSize: '18px', fontWeight: 700 }}
            >
              FINALIZAR (F2)
            </Button>
            <Group grow>
              <Button
                size="md"
                color="blue"
                variant="light"
                leftSection={<IconPlus size={16} />}
                onClick={handleNovaVenda}
                disabled={!!vendaId}
              >
                Nova (F1)
              </Button>
              <Button
                size="md"
                color="red"
                variant="light"
                leftSection={<IconPlayerStop size={16} />}
                onClick={handleCancelarVenda}
                disabled={!vendaId}
              >
                Cancelar (F4)
              </Button>
            </Group>
          </Stack>
        </div>
      </div>

      {/* FOOTER */}
      <div style={styles.footer}>
        <Text size="xs" c="dimmed">F1 = Nova Venda</Text>
        <Text size="xs" c="dimmed">F2 = Finalizar</Text>
        <Text size="xs" c="dimmed">F3 = Buscar Produto</Text>
        <Text size="xs" c="dimmed">F4 = Cancelar</Text>
        <Text size="xs" c="dimmed">F8 = Sangria/Suprimento</Text>
        <Text size="xs" c="dimmed">Enter = Adicionar Item</Text>
      </div>

      {/* === MODALS === */}

      {/* Finalizar Modal */}
      <Modal
        opened={showFinalizarModal}
        onClose={() => setShowFinalizarModal(false)}
        title="Confirmar Finalização"
        centered
        size="md"
        styles={{ content: { backgroundColor: '#25262b' }, header: { backgroundColor: '#25262b', color: '#fff' } }}
      >
        <Stack gap="md">
          <Paper p="md" style={{ backgroundColor: '#1a1b1e', borderRadius: '8px' }}>
            <Group justify="space-between">
              <Text c="dimmed">Total da venda:</Text>
              <Text size="xl" fw={700} style={{ color: '#51cf66' }}>{formatCurrency(subtotal)}</Text>
            </Group>
            <Divider color="dark.4" my="sm" />
            <Group justify="space-between">
              <Text c="dimmed">Total pago:</Text>
              <Text size="lg" fw={600} c="white">{formatCurrency(totalPago)}</Text>
            </Group>
            {troco > 0 && (
              <>
                <Divider color="dark.4" my="sm" />
                <Group justify="space-between">
                  <Text c="dimmed">Troco:</Text>
                  <Text size="lg" fw={700} style={{ color: '#51cf66' }}>{formatCurrency(troco)}</Text>
                </Group>
              </>
            )}
          </Paper>
          <Text size="sm" c="dimmed">Pagamentos:</Text>
          {pagamentos.map((p, idx) => (
            <Group key={idx} justify="space-between">
              <Text size="sm" c="white">{FORMA_LABELS[p.forma]}</Text>
              <Text size="sm" c="white" fw={500}>{formatCurrency(p.valor)}</Text>
            </Group>
          ))}
          <Button
            fullWidth
            size="lg"
            color="green"
            onClick={handleFinalizar}
            loading={finalizarVenda.isPending}
          >
            ✅ Confirmar Finalização
          </Button>
        </Stack>
      </Modal>

      {/* Fechar Caixa Modal */}
      <Modal
        opened={showFecharCaixaModal}
        onClose={() => setShowFecharCaixaModal(false)}
        title="Fechar Caixa"
        centered
        styles={{ content: { backgroundColor: '#25262b' }, header: { backgroundColor: '#25262b', color: '#fff' } }}
      >
        <Stack gap="md">
          <NumberInput
            label="Valor de Fechamento (R$)"
            value={valorFechamento}
            onChange={(v) => setValorFechamento(Number(v) || 0)}
            min={0}
            decimalScale={2}
            prefix="R$ "
            styles={{ label: { color: '#c1c2c5' } }}
          />
          <Textarea
            label="Observação (opcional)"
            value={obsFechamento}
            onChange={(e) => setObsFechamento(e.currentTarget.value)}
            styles={{ label: { color: '#c1c2c5' } }}
          />
          <Button
            fullWidth
            size="lg"
            color="red"
            onClick={handleFecharCaixa}
            loading={fecharCaixa.isPending}
          >
            Confirmar Fechamento
          </Button>
        </Stack>
      </Modal>

      {/* Movimentação (Sangria/Suprimento) Modal */}
      <Modal
        opened={showMovimentacaoModal}
        onClose={() => setShowMovimentacaoModal(false)}
        title={tipoMovimentacao === 'SANGRIA' ? '💸 Sangria' : '💰 Suprimento'}
        centered
        styles={{ content: { backgroundColor: '#25262b' }, header: { backgroundColor: '#25262b', color: '#fff' } }}
      >
        <Stack gap="md">
          <NumberInput
            label="Valor (R$)"
            value={valorMovimentacao}
            onChange={(v) => setValorMovimentacao(Number(v) || 0)}
            min={0.01}
            decimalScale={2}
            prefix="R$ "
            styles={{ label: { color: '#c1c2c5' } }}
          />
          <TextInput
            label="Motivo"
            value={motivoMovimentacao}
            onChange={(e) => setMotivoMovimentacao(e.currentTarget.value)}
            placeholder="Informe o motivo"
            styles={{ label: { color: '#c1c2c5' } }}
          />
          <Button
            fullWidth
            size="lg"
            color={tipoMovimentacao === 'SANGRIA' ? 'yellow' : 'cyan'}
            onClick={handleMovimentacao}
            loading={movimentacao.isPending}
            disabled={valorMovimentacao <= 0 || !motivoMovimentacao.trim()}
          >
            Registrar {tipoMovimentacao === 'SANGRIA' ? 'Sangria' : 'Suprimento'}
          </Button>
        </Stack>
      </Modal>

      {/* Buscar Produto Modal */}
      <Modal
        opened={showBuscarProdutoModal}
        onClose={() => { setShowBuscarProdutoModal(false); setBuscaProduto(''); inputRef.current?.focus() }}
        title="🔍 Buscar Produto"
        size="lg"
        centered
        styles={{ content: { backgroundColor: '#25262b' }, header: { backgroundColor: '#25262b', color: '#fff' } }}
      >
        <Stack gap="md">
          <TextInput
            placeholder="Digite o nome, código ou EAN do produto..."
            size="md"
            value={buscaProduto}
            onChange={(e) => setBuscaProduto(e.currentTarget.value)}
            autoFocus
            styles={{ input: { backgroundColor: '#1a1b1e', color: '#fff', border: '1px solid #373a40' } }}
          />
          <ScrollArea h={350}>
            <Stack gap={4}>
              {produtosFiltrados.slice(0, 30).map((p: any) => (
                <Paper
                  key={p.id}
                  p="sm"
                  radius="sm"
                  style={{
                    backgroundColor: '#2c2e33',
                    cursor: 'pointer',
                    border: '1px solid transparent',
                  }}
                  onClick={() => {
                    if (!vendaId) return
                    adicionarItem.mutate(
                      { vendaId, produtoId: p.id, quantidade: 1 },
                      {
                        onSuccess: () => {
                          setShowBuscarProdutoModal(false)
                          setBuscaProduto('')
                          notifications.show({ title: 'Item adicionado', message: p.nome, color: 'green' })
                          inputRef.current?.focus()
                        },
                        onError: (err: any) => {
                          notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Erro', color: 'red' })
                        },
                      }
                    )
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#51cf66' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'transparent' }}
                >
                  <Group justify="space-between">
                    <div>
                      <Text size="sm" c="white" fw={500}>{p.nome}</Text>
                      <Text size="xs" c="dimmed">Cód: {p.codigo}{p.cEAN ? ` | EAN: ${p.cEAN}` : ''}</Text>
                    </div>
                    <Text size="md" c="green" fw={600}>
                      {Number(p.precoBase).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </Text>
                  </Group>
                </Paper>
              ))}
              {produtosFiltrados.length === 0 && (
                <Text ta="center" c="dimmed" mt="lg">Nenhum produto encontrado</Text>
              )}
            </Stack>
          </ScrollArea>
        </Stack>
      </Modal>
    </div>
  )
}
