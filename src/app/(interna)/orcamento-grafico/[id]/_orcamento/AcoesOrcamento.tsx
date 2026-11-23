'use client'

/**
 * AcoesOrcamento — ações do ORÇAMENTO (nível 1), movidas de `[id]/page.tsx` sem mudar chamadas
 * de API nem comportamento: relatório, ver proposta de origem, proposta PDF/e-mail, copiar
 * versão, reaproveitar cálculo, enviar, aprovar, recusar, amostras e conversão em pedido.
 *
 * Renderiza os botões (fragmento, para o slot `acoes` do `CabecalhoOrcamento`) e os modais
 * de cada ação. Depois de qualquer mudança de estado chama `onRecarregar`.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Badge, Button, Center, Checkbox, Group, Loader, Menu, Modal, NumberInput, Select, SimpleGrid, Stack, Text,
  Textarea, TextInput,
} from '@mantine/core'
import {
  IconCheck, IconChevronDown, IconCopy, IconFileText, IconFileTypePdf, IconMail, IconPhoto, IconRepeat,
  IconSend, IconShoppingCartPlus, IconX,
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'

import { api } from '@/lib/api'
import { getAuthToken } from '@/lib/authStorage'

import AmostrasModal from '../AmostrasModal'

interface PendenciaTiragem {
  itemId: string
  sequencia: number
  descricao: string | null
  tiragens: number[]
  motivo: 'FALTA_ESCOLHA' | 'TIRAGEM_INEXISTENTE'
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333/api'

export interface OrcamentoParaAcoes {
  id: string
  status: string
  clienteNome?: string | null
  quantidade: number
  exigeAmostra?: boolean | null
}

export interface AcoesOrcamentoProps {
  orcamento: OrcamentoParaAcoes
  /** Recarrega o orçamento e as leituras da tela depois de uma mudança de estado. */
  onRecarregar: () => void | Promise<void>
}

export default function AcoesOrcamento({ orcamento, onRecarregar }: AcoesOrcamentoProps) {
  const router = useRouter()
  const id = orcamento.id
  const carregar = onRecarregar

  const [actionLoading, setActionLoading] = useState(false)

  // Modal de recusa
  const [recusaModalOpen, setRecusaModalOpen] = useState(false)
  const [motivoRecusa, setMotivoRecusa] = useState('')

  // Escolha da tiragem aprovada (itens com mais de uma tiragem)
  const [escolhaTiragem, setEscolhaTiragem] = useState<PendenciaTiragem[] | null>(null)
  const [tiragensEscolhidas, setTiragensEscolhidas] = useState<Record<string, number>>({})

  // Ver proposta de origem (RFQ) — spec comercial-pedido-proposta
  const [propostaOpen, setPropostaOpen] = useState(false)
  const [proposta, setProposta] = useState<any | null>(null)
  const [propostaLoading, setPropostaLoading] = useState(false)
  const [propostaBuscada, setPropostaBuscada] = useState(false)

  // Proposta PDF + templates (B1 task 8)
  const [templates, setTemplates] = useState<Array<{ id: string; nome: string; isDefault: boolean }>>([])
  const [templateId, setTemplateId] = useState<string | null>(null)
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [emailDestino, setEmailDestino] = useState('')
  const [emailMensagem, setEmailMensagem] = useState('')
  const [enviandoEmail, setEnviandoEmail] = useState(false)

  // Modal de reaproveitar cálculo (repetição)
  const [reaproveitarOpen, setReaproveitarOpen] = useState(false)
  const [reapClienteNome, setReapClienteNome] = useState('')
  const [reapQuantidade, setReapQuantidade] = useState<number | ''>('')
  const [reapObs, setReapObs] = useState('')
  const [reaproveitando, setReaproveitando] = useState(false)

  // Hand-off comercial: amostras
  const [amostrasOpen, setAmostrasOpen] = useState(false)

  const handleCopiar = async () => {
    setActionLoading(true)
    try {
      const { data } = await api.post(`/orcamento-grafico/${id}/copiar`)
      notifications.show({ title: 'Copiado', message: `Nova versão V${data.versao} criada.`, color: 'green' })
      router.push(`/orcamento-grafico/${data.id}`)
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao copiar', color: 'red' })
    } finally {
      setActionLoading(false)
    }
  }

  // Abre o modal de reaproveitamento pré-preenchido com os dados atuais.
  const abrirReaproveitar = () => {
    setReapClienteNome(orcamento.clienteNome ?? '')
    setReapQuantidade(orcamento.quantidade ?? '')
    setReapObs('')
    setReaproveitarOpen(true)
  }

  // Reaproveita o cálculo deste orçamento num NOVO orçamento (repetição):
  // clona cabeçalho + itens (+ planos) e recalcula para a nova tiragem/cliente.
  const handleReaproveitar = async () => {
    setReaproveitando(true)
    try {
      const payload: Record<string, unknown> = {}
      if (reapClienteNome.trim() && reapClienteNome.trim() !== (orcamento.clienteNome ?? '')) {
        payload.clienteNome = reapClienteNome.trim()
        // Novo cliente por nome livre → desvincula o clienteId antigo.
        payload.clienteId = null
      }
      if (typeof reapQuantidade === 'number' && reapQuantidade > 0) {
        payload.quantidade = reapQuantidade
      }
      if (reapObs.trim()) payload.observacoes = reapObs.trim()

      const { data } = await api.post(`/orcamento-grafico/${id}/reaproveitar`, payload)
      const avisos: string[] = Array.isArray(data?.avisos) ? data.avisos : []
      notifications.show({
        title: 'Cálculo reaproveitado',
        message: `Novo orçamento #${data.numero} criado${avisos.length ? ' (com avisos)' : ''}.`,
        color: 'green',
      })
      if (avisos.length) {
        notifications.show({
          title: 'Avisos do reaproveitamento',
          message: avisos.join('\n'),
          color: 'yellow',
          autoClose: 9000,
        })
      }
      setReaproveitarOpen(false)
      router.push(`/orcamento-grafico/${data.id}`)
    } catch (err: any) {
      notifications.show({
        title: 'Erro',
        message: err?.response?.data?.message || 'Falha ao reaproveitar o cálculo.',
        color: 'red',
      })
    } finally {
      setReaproveitando(false)
    }
  }

  // Carrega os templates de proposta (para o seletor). Default pré-selecionado.
  useEffect(() => {
    api.get('/orcamento-grafico/templates-proposta')
      .then(({ data }) => {
        const lista = Array.isArray(data) ? data : []
        setTemplates(lista)
        const def = lista.find((t: { isDefault: boolean }) => t.isDefault)
        if (def) setTemplateId(def.id)
      })
      .catch(() => setTemplates([]))
  }, [])

  // Baixa a proposta comercial (PDF) com o template escolhido.
  const handleBaixarProposta = async () => {
    setActionLoading(true)
    try {
      const { data } = await api.get(`/orcamento-grafico/${id}/proposta-pdf`, {
        responseType: 'blob',
        params: templateId ? { templateId } : {},
      })
      const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }))
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao gerar proposta', color: 'red' })
    } finally {
      setActionLoading(false)
    }
  }

  // Envia a proposta por e-mail (template escolhido).
  const handleEnviarEmailProposta = async () => {
    if (!emailDestino.trim()) {
      notifications.show({ message: 'Informe o e-mail de destino.', color: 'red' })
      return
    }
    setEnviandoEmail(true)
    try {
      const { data } = await api.post(`/orcamento-grafico/${id}/enviar-email`, {
        destinatario: emailDestino.trim(),
        mensagem: emailMensagem.trim() || undefined,
        templateId: templateId || undefined,
      })
      notifications.show({ title: 'Proposta', message: data?.message || 'Proposta enviada.', color: 'green' })
      setEmailModalOpen(false)
      setEmailMensagem('')
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao enviar e-mail', color: 'red' })
    } finally {
      setEnviandoEmail(false)
    }
  }

  // Abre o painel "Ver proposta": carrega a proposta de origem (RFQ) vinculada.
  const abrirProposta = async () => {
    setPropostaOpen(true)
    if (propostaBuscada) return
    setPropostaLoading(true)
    try {
      const { data } = await api.get(`/orcamento-grafico/pedidos-proposta/por-orcamento/${id}`)
      setProposta(data?.proposta ?? null)
    } catch {
      setProposta(null)
    } finally {
      setPropostaBuscada(true)
      setPropostaLoading(false)
    }
  }

  // Abre o relatório (PDF) do orçamento em nova aba.
  const handleRelatorio = async () => {
    setActionLoading(true)
    try {
      const { data } = await api.get(`/orcamento-grafico/${id}/relatorio.pdf`, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }))
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao gerar relatório', color: 'red' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleEnviar = async () => {
    setActionLoading(true)
    try {
      await api.post(`/orcamento-grafico/${id}/enviar`)
      notifications.show({ title: 'Enviado', message: 'Proposta enviada com sucesso!', color: 'green' })
      await carregar()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao enviar', color: 'red' })
    } finally {
      setActionLoading(false)
    }
  }

  // Item com mais de uma tiragem: o back pede a tiragem aprovada (code TIRAGEM_OBRIGATORIA).
  const handleAprovar = async (tiragens?: Record<string, number>) => {
    setActionLoading(true)
    try {
      await api.post(`/orcamento-grafico/${id}/aprovar`, tiragens ? { tiragens } : {})
      notifications.show({ title: 'Aprovado', message: 'Orçamento aprovado com sucesso!', color: 'green' })
      setEscolhaTiragem(null)
      await carregar()
    } catch (err: any) {
      const data = err?.response?.data
      if (data?.code === 'TIRAGEM_OBRIGATORIA' && Array.isArray(data.itens)) {
        setEscolhaTiragem(data.itens as PendenciaTiragem[])
        setTiragensEscolhidas((atual) => ({ ...(tiragens ?? {}), ...atual }))
      } else {
        notifications.show({ title: 'Erro', message: data?.message || 'Falha ao aprovar', color: 'red' })
      }
    } finally {
      setActionLoading(false)
    }
  }

  const handleRecusar = async () => {
    if (!motivoRecusa.trim()) {
      notifications.show({ title: 'Erro', message: 'Informe o motivo da recusa.', color: 'red' })
      return
    }
    setActionLoading(true)
    try {
      await api.post(`/orcamento-grafico/${id}/recusar`, { motivoRecusa: motivoRecusa.trim() })
      notifications.show({ title: 'Recusado', message: 'Orçamento recusado.', color: 'orange' })
      setRecusaModalOpen(false)
      setMotivoRecusa('')
      await carregar()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao recusar', color: 'red' })
    } finally {
      setActionLoading(false)
    }
  }

  // Hand-off comercial: converter orçamento APROVADO em pedido completo.
  const handleConverter = async () => {
    setActionLoading(true)
    try {
      const { data } = await api.post(`/orcamento-grafico/${id}/converter`)
      notifications.show({
        title: 'Convertido em pedido',
        message: `Pedido ${data?.numeroPedido ?? ''} gerado com ${data?.itensCriados ?? 0} item(ns).`,
        color: 'green',
      })
      await carregar()
    } catch (err: any) {
      const code = err?.response?.data?.code
      const msg =
        code === 'AMOSTRA_PENDENTE' ? 'Amostra exigida e ainda não aprovada. Aprove a amostra antes de converter.'
        : code === 'MARGEM_PENDENTE' ? 'Desconto acima da alçada — aprovação necessária.'
        : code === 'JA_CONVERTIDO' ? 'Este orçamento já foi convertido em pedido.'
        : err?.response?.data?.message || 'Falha ao converter'
      notifications.show({ title: 'Não foi possível converter', message: msg, color: 'red' })
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <>
      <Button
        variant="outline"
        leftSection={<IconCopy size={16} />}
        onClick={handleCopiar}
        loading={actionLoading}
      >
        Copiar versão
      </Button>
      <Button
        variant="light"
        color="grape"
        leftSection={<IconRepeat size={16} />}
        onClick={abrirReaproveitar}
        disabled={actionLoading}
      >
        Reaproveitar cálculo
      </Button>
      <Button
        variant="outline"
        leftSection={<IconFileText size={16} />}
        onClick={handleRelatorio}
        loading={actionLoading}
      >
        Relatório
      </Button>
      <Button variant="outline" leftSection={<IconPhoto size={16} />} onClick={abrirProposta}>
        Ver proposta
      </Button>
      <Menu shadow="md" position="bottom-end">
        <Menu.Target>
          <Button variant="outline" leftSection={<IconFileTypePdf size={16} />} rightSection={<IconChevronDown size={14} />}>
            Proposta
          </Button>
        </Menu.Target>
        <Menu.Dropdown>
          {templates.length > 0 && (
            <>
              <Menu.Label>Template</Menu.Label>
              <div style={{ padding: '4px 12px' }}>
                <Select
                  size="xs"
                  data={templates.map((t) => ({ value: t.id, label: t.nome + (t.isDefault ? ' (padrão)' : '') }))}
                  value={templateId}
                  onChange={setTemplateId}
                  allowDeselect={false}
                  comboboxProps={{ withinPortal: true }}
                />
              </div>
              <Menu.Divider />
            </>
          )}
          <Menu.Item leftSection={<IconFileTypePdf size={16} />} onClick={handleBaixarProposta}>
            Baixar PDF
          </Menu.Item>
          <Menu.Item leftSection={<IconMail size={16} />} onClick={() => setEmailModalOpen(true)}>
            Enviar por e-mail
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
      {orcamento.status === 'RASCUNHO' && (
        <Button leftSection={<IconSend size={16} />} onClick={handleEnviar} loading={actionLoading}>
          Enviar Proposta
        </Button>
      )}
      {orcamento.status === 'ENVIADO' && (
        <>
          <Button color="green" leftSection={<IconCheck size={16} />} onClick={() => void handleAprovar()} loading={actionLoading}>
            Aprovar
          </Button>
          <Button
            color="red"
            variant="outline"
            leftSection={<IconX size={16} />}
            onClick={() => setRecusaModalOpen(true)}
            disabled={actionLoading}
          >
            Recusar
          </Button>
        </>
      )}
      {/* Hand-off comercial: amostras (sempre disponível) */}
      <Button variant="light" leftSection={<IconPhoto size={16} />} onClick={() => setAmostrasOpen(true)}>
        Amostras
      </Button>
      {orcamento.status === 'APROVADO' && (
        <Button
          color="teal"
          leftSection={<IconShoppingCartPlus size={16} />}
          onClick={handleConverter}
          loading={actionLoading}
        >
          Converter em pedido
        </Button>
      )}
      {orcamento.status === 'CONVERTIDO' && (
        <Badge color="teal" variant="light" size="lg">Convertido em pedido</Badge>
      )}

      {/* Modal de Recusa */}
      <Modal opened={escolhaTiragem !== null} onClose={() => setEscolhaTiragem(null)} title="Tiragem aprovada" centered>
        <Stack gap="sm">
          <Text size="sm">O pedido recebe uma tiragem por item. Escolha qual foi aprovada:</Text>
          {(escolhaTiragem ?? []).map((p) => (
            <Select
              key={p.itemId}
              label={`Item ${p.sequencia} — ${p.descricao ?? 'Sem descrição'}`}
              data={p.tiragens.map((q) => ({ value: String(q), label: q.toLocaleString('pt-BR') }))}
              value={tiragensEscolhidas[p.itemId] != null ? String(tiragensEscolhidas[p.itemId]) : null}
              onChange={(v) => setTiragensEscolhidas((a) => ({ ...a, [p.itemId]: Number(v) }))}
              error={p.motivo === 'TIRAGEM_INEXISTENTE' ? 'Tiragem não existe neste item' : undefined}
              allowDeselect={false}
            />
          ))}
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setEscolhaTiragem(null)}>Cancelar</Button>
            <Button
              color="green"
              loading={actionLoading}
              disabled={(escolhaTiragem ?? []).some((p) => tiragensEscolhidas[p.itemId] == null)}
              onClick={() => void handleAprovar(tiragensEscolhidas)}
            >
              Aprovar
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={recusaModalOpen} onClose={() => setRecusaModalOpen(false)} title="Recusar Orçamento" centered>
        <Stack gap="md">
          <Textarea
            label="Motivo da Recusa"
            placeholder="Informe o motivo da recusa..."
            value={motivoRecusa}
            onChange={(e) => setMotivoRecusa(e.currentTarget.value)}
            required
            minRows={3}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setRecusaModalOpen(false)}>
              Cancelar
            </Button>
            <Button color="red" onClick={handleRecusar} loading={actionLoading}>
              Confirmar Recusa
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal de envio de proposta por e-mail (B1 task 8) */}
      <Modal opened={emailModalOpen} onClose={() => setEmailModalOpen(false)} title="Enviar proposta por e-mail" centered>
        <Stack gap="md">
          {templates.length > 0 && (
            <Select
              label="Template"
              data={templates.map((t) => ({ value: t.id, label: t.nome + (t.isDefault ? ' (padrão)' : '') }))}
              value={templateId}
              onChange={setTemplateId}
              allowDeselect={false}
            />
          )}
          <TextInput
            label="E-mail de destino"
            placeholder="cliente@empresa.com"
            type="email"
            value={emailDestino}
            onChange={(e) => setEmailDestino(e.currentTarget.value)}
            required
          />
          <Textarea
            label="Mensagem (opcional)"
            placeholder="Mensagem que acompanha a proposta..."
            value={emailMensagem}
            onChange={(e) => setEmailMensagem(e.currentTarget.value)}
            autosize
            minRows={2}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setEmailModalOpen(false)}>Cancelar</Button>
            <Button leftSection={<IconMail size={16} />} onClick={handleEnviarEmailProposta} loading={enviandoEmail}>
              Enviar
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal — Ver proposta de origem (RFQ) — somente leitura + galeria */}
      <Modal
        opened={propostaOpen}
        onClose={() => setPropostaOpen(false)}
        title="Proposta de origem (setor Pedidos/Propostas)"
        size="lg"
        centered
      >
        {propostaLoading ? (
          <Center py="md"><Loader /></Center>
        ) : !proposta ? (
          <Text c="dimmed" py="md">Este orçamento não tem um Pedido/Proposta de origem vinculado.</Text>
        ) : (
          <Stack gap="sm">
            <Group gap="xs">
              <Badge>Nº {proposta.numero}</Badge>
              <Badge variant="light" color="teal">{proposta.origem}</Badge>
              <Badge variant="light" color="grape">{proposta.tipoPedido}</Badge>
              <Badge variant="light" color="blue">{proposta.estado}</Badge>
            </Group>
            <SimpleGrid cols={2} spacing="xs">
              {[
                ['Cliente', proposta.clienteNome], ['CNPJ', proposta.clienteCpfCnpj],
                ['Mercado', proposta.mercado], ['UF / Cidade', [proposta.ufOrigem, proposta.cidade].filter(Boolean).join(' / ')],
                ['Entrega', proposta.tipoEntrega], ['Fracionada (dias)', proposta.entregaFracionadaDias],
                ['Prazo pagamento', proposta.prazoPagamento], ['Produto', proposta.produtoNome],
                ['Tipo embalagem', proposta.tipoEmbalagem], ['Quantidade', proposta.quantidade],
                ['Cartão', proposta.cartao], ['Gramatura', proposta.gramatura],
                ['Medidas', proposta.medidasTexto], ['Variações de arte', proposta.variacoesArte],
                ['Exportação', proposta.exportacao], ['Matriz', proposta.matriz],
                ['Qtd. por volume', proposta.quantidadePorVolume], ['Validade', proposta.dataValidade],
                ['FSC', proposta.cartaoFsc ? 'Sim' : 'Não'], ['Corte interno', proposta.corteInternoVerso ? 'Sim' : 'Não'],
                ['Passtime', proposta.passtime ? 'Sim' : 'Não'], ['Acabamento manual', proposta.acabamentoManual ? 'Sim' : 'Não'],
              ].map(([rotulo, valor]) => (
                <div key={rotulo as string}>
                  <Text size="xs" c="dimmed">{rotulo as string}</Text>
                  <Text size="sm">{valor != null && valor !== '' ? String(valor) : '—'}</Text>
                </div>
              ))}
            </SimpleGrid>
            {Array.isArray(proposta.acabamentosSelecionados) && proposta.acabamentosSelecionados.filter((a: any) => a?.marcado).length > 0 && (
              <div>
                <Text size="xs" c="dimmed">Acabamentos marcados</Text>
                <Stack gap={2}>
                  {proposta.acabamentosSelecionados.filter((a: any) => a?.marcado).map((a: any, i: number) => (
                    <Text key={i} size="sm">• {a.nome}{a.detalhe ? ` — ${a.detalhe}` : ''}</Text>
                  ))}
                </Stack>
              </div>
            )}
            {proposta.acabamentos && (
              <div><Text size="xs" c="dimmed">Acabamentos (texto)</Text><Text size="sm">{proposta.acabamentos}</Text></div>
            )}
            {proposta.discriminacao && (
              <div><Text size="xs" c="dimmed">Discriminação</Text><Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{proposta.discriminacao}</Text></div>
            )}
            {proposta.observacoes && (
              <div><Text size="xs" c="dimmed">Observações</Text><Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{proposta.observacoes}</Text></div>
            )}
            {Array.isArray(proposta.anexos) && proposta.anexos.length > 0 && (
              <>
                <Text size="sm" fw={600} mt="xs">Imagens</Text>
                <SimpleGrid cols={{ base: 2, sm: 4 }}>
                  {proposta.anexos.map((a: { id: string; nome: string }) => {
                    const token = getAuthToken()
                    const src = `${API_BASE}/orcamento-grafico/pedidos-proposta/${proposta.id}/anexos/${a.id}?token=${token ?? ''}`
                    return (
                      <a key={a.id} href={src} target="_blank" rel="noreferrer">
                        <img src={src} alt={a.nome} style={{ width: '100%', height: 110, objectFit: 'cover', borderRadius: 6 }} />
                      </a>
                    )
                  })}
                </SimpleGrid>
              </>
            )}
          </Stack>
        )}
      </Modal>

      {/* Modal de Reaproveitar cálculo (repetição) */}
      <Modal opened={reaproveitarOpen} onClose={() => setReaproveitarOpen(false)} title="Reaproveitar cálculo" centered>
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Cria um orçamento NOVO (número novo) a partir deste, copiando todos os
            itens e planos e recalculando. O orçamento atual fica intacto. Ajuste
            o que muda na repetição:
          </Text>
          <TextInput
            label="Cliente"
            description="Deixe como está para manter o mesmo cliente"
            value={reapClienteNome}
            onChange={(e) => setReapClienteNome(e.currentTarget.value)}
          />
          <NumberInput
            label="Nova tiragem (quantidade)"
            description="Aplicada a todos os itens. Vazio = mantém a tiragem atual de cada item"
            value={reapQuantidade}
            onChange={(v) => setReapQuantidade(typeof v === 'number' ? v : '')}
            min={1}
            thousandSeparator="."
            decimalSeparator=","
            allowDecimal={false}
          />
          <Textarea
            label="Observações (opcional)"
            placeholder="Ex.: repetição do pedido anterior, nova tiragem..."
            value={reapObs}
            onChange={(e) => setReapObs(e.currentTarget.value)}
            minRows={2}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setReaproveitarOpen(false)} disabled={reaproveitando}>
              Cancelar
            </Button>
            <Button color="grape" leftSection={<IconRepeat size={16} />} onClick={handleReaproveitar} loading={reaproveitando}>
              Reaproveitar
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Hand-off comercial: aprovação de amostra/modelo */}
      <AmostrasModal
        opened={amostrasOpen}
        onClose={() => setAmostrasOpen(false)}
        orcamentoId={id}
        onMudou={carregar}
      />
    </>
  )
}

/**
 * Hand-off comercial: override de exigência de amostra por orçamento (PATCH /:id/exige-amostra).
 * Aparece só com o orçamento ENVIADO ou APROVADO, como antes.
 */
export function ExigeAmostraOrcamento({ orcamento, onRecarregar }: AcoesOrcamentoProps) {
  if (!['ENVIADO', 'APROVADO'].includes(orcamento.status)) return null

  const alternar = async (valor: boolean) => {
    try {
      await api.patch(`/orcamento-grafico/${orcamento.id}/exige-amostra`, { exigeAmostra: valor })
      notifications.show({ title: 'Atualizado', message: valor ? 'Amostra passou a ser exigida.' : 'Amostra não exigida.', color: 'blue' })
      await onRecarregar()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao atualizar', color: 'red' })
    }
  }

  return (
    <Checkbox
      label="Exigir aprovação de amostra antes de produzir"
      checked={orcamento.exigeAmostra === true}
      onChange={(e) => alternar(e.currentTarget.checked)}
    />
  )
}
