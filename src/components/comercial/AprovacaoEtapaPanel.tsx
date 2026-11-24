'use client'

/**
 * Workflow de aprovação de um estágio da Pré-Impressão (Mockup ou Arte).
 * Reunião 24/11/2026. Reutilizado na Pré-Impressão (cards) e em Pedido/Proposta.
 *
 *  - Link de aprovação do cliente (separado para Mockup e para Arte).
 *  - Arquivos do estágio (imagem/PDF) com upload e visualização.
 *  - Status: Aguardando cliente | Aprovado | Alteração solicitada | Cancelado.
 *  - Alteração: mostra a descrição e as imagens enviadas pelo cliente.
 *  - mode="PEDIDO": permite registrar manualmente Aprovado/Alteração/Cancelado.
 */
import { useCallback, useEffect, useState } from 'react'
import {
  Stack, Group, Text, Badge, Button, FileButton, Image, Modal, Select, Textarea, TextInput, ActionIcon, Loader,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  IconLink, IconCopy, IconUpload, IconTrash, IconFileTypePdf, IconClipboardCheck, IconRefresh,
} from '@tabler/icons-react'
import { api } from '@/lib/api'
import { getAuthToken } from '@/lib/authStorage'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333/api'

type Etapa = 'MOCKUP' | 'ARTE'
type StatusAprov = 'AGUARDANDO' | 'APROVADA' | 'ALTERACAO' | 'CANCELADA'

interface AprovEtapa {
  etapa: Etapa
  status: StatusAprov | null
  forma: string | null
  por: string | null
  em: string | null
  motivo: string | null
}
interface LinkItem {
  id: string
  etapa: Etapa
  estado: string
  status: string
  expiraEm: string
  url: string
  motivoAjuste: string | null
}
interface AnexoItem { id: string; nome: string; tipo: string; categoria: string; linkId: string | null }

const STATUS_CFG: Record<StatusAprov, { color: string; label: string }> = {
  AGUARDANDO: { color: 'blue', label: 'Aguardando cliente' },
  APROVADA: { color: 'teal', label: 'Aprovado' },
  ALTERACAO: { color: 'orange', label: 'Alteração solicitada' },
  CANCELADA: { color: 'red', label: 'Cancelado' },
}
const FORMA_LABEL: Record<string, string> = {
  CLIENTE_LINK: 'pelo link do cliente',
  REPRESENTANTE: 'manual (representante)',
  EMAIL: 'manual (e-mail)',
  PRESENCIAL: 'manual (presencial)',
}
const LIMITE_ARQUIVOS = 5

function fmtData(iso: string | null): string {
  if (!iso) return ''
  try { return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) } catch { return '' }
}

export default function AprovacaoEtapaPanel({
  pedidoId, etapa, mode = 'PRE_IMPRESSAO', onChanged,
}: {
  pedidoId: string
  etapa: Etapa
  mode?: 'PRE_IMPRESSAO' | 'PEDIDO'
  onChanged?: () => void
}) {
  const nomeEtapa = etapa === 'MOCKUP' ? 'Mockup' : 'Arte'
  const base = `/orcamento-grafico/pedidos-proposta/${pedidoId}`
  const [aprov, setAprov] = useState<AprovEtapa | null>(null)
  const [links, setLinks] = useState<LinkItem[]>([])
  const [anexos, setAnexos] = useState<AnexoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [modalManual, setModalManual] = useState(false)
  const [mStatus, setMStatus] = useState<'APROVADA' | 'ALTERACAO' | 'CANCELADA'>('APROVADA')
  const [mForma, setMForma] = useState<'REPRESENTANTE' | 'EMAIL' | 'PRESENCIAL'>('REPRESENTANTE')
  const [mNome, setMNome] = useState('')
  const [mMotivo, setMMotivo] = useState('')

  const urlAnexo = (id: string) => `${API_BASE}${base}/anexos/${id}?token=${getAuthToken() ?? ''}`

  const carregar = useCallback(async () => {
    try {
      const [a, x] = await Promise.all([
        api.get(`${base}/aprovacoes`),
        api.get(`${base}/anexos`),
      ])
      setAprov((a.data?.etapas ?? []).find((e: AprovEtapa) => e.etapa === etapa) ?? null)
      setLinks((a.data?.links ?? []).filter((l: LinkItem) => l.etapa === etapa))
      setAnexos(Array.isArray(x.data) ? x.data : [])
    } catch {
      /* painel complementar: não bloqueia a tela */
    } finally {
      setLoading(false)
    }
  }, [base, etapa])

  useEffect(() => { setLoading(true); carregar() }, [carregar])

  // Arquivos do estágio (Arte inclui os anexos legados "GERAL").
  const arquivos = anexos.filter((a) =>
    etapa === 'MOCKUP' ? a.categoria === 'MOCKUP' : (a.categoria === 'ARTE' || a.categoria === 'GERAL'))
  const linkPendente = links.find((l) => l.estado === 'PENDENTE') ?? null
  const ultimoAjuste = links.find((l) => l.status === 'AJUSTE_SOLICITADO') ?? null
  const imagensCliente = anexos.filter((a) =>
    a.categoria === 'ALTERACAO_CLIENTE' && (!ultimoAjuste || a.linkId === ultimoAjuste.id))

  async function gerarLink(novo: boolean) {
    setBusy(true)
    try {
      const { data } = await api.post(`${base}/link-aprovacao`, {}, { params: { etapa, ...(novo ? { novo: 1 } : {}) } })
      try { await navigator.clipboard.writeText(data.url) } catch { /* sem permissão de clipboard */ }
      notifications.show({ title: `Link de ${nomeEtapa}`, message: 'Link gerado e copiado.', color: 'green' })
      await carregar(); onChanged?.()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao gerar o link.', color: 'red' })
    } finally { setBusy(false) }
  }

  async function copiar(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      notifications.show({ message: 'Link copiado.', color: 'green' })
    } catch {
      window.prompt('Copie o link:', url)
    }
  }

  async function enviarArquivo(file: File | null) {
    if (!file) return
    if (arquivos.length >= LIMITE_ARQUIVOS) {
      notifications.show({ message: `Limite de ${LIMITE_ARQUIVOS} arquivos atingido.`, color: 'orange' })
      return
    }
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      await api.post(`${base}/anexos`, fd, { params: { categoria: etapa } })
      await carregar()
    } catch (err: any) {
      const code = err?.response?.data?.code
      const msg = code === 'LIMITE_ANEXOS' ? `Limite de ${LIMITE_ARQUIVOS} arquivos.`
        : code === 'MIME_INVALIDO' ? 'Envie imagem ou PDF.'
        : code === 'ARQUIVO_GRANDE' ? 'Arquivo acima de 10MB.'
        : err?.response?.data?.message || 'Falha ao enviar o arquivo.'
      notifications.show({ title: nomeEtapa, message: msg, color: 'red' })
    } finally { setBusy(false) }
  }

  async function removerArquivo(id: string) {
    try {
      await api.delete(`${base}/anexos/${id}`)
      setAnexos((a) => a.filter((x) => x.id !== id))
    } catch {
      notifications.show({ title: nomeEtapa, message: 'Falha ao remover.', color: 'red' })
    }
  }

  async function registrarManual() {
    if (mStatus !== 'APROVADA' && !mMotivo.trim()) {
      notifications.show({ message: mStatus === 'ALTERACAO' ? 'Descreva a alteração.' : 'Informe o motivo do cancelamento.', color: 'red' })
      return
    }
    setBusy(true)
    try {
      await api.post(`${base}/etapas/${etapa}/aprovacao`, {
        status: mStatus, forma: mForma,
        ...(mMotivo.trim() ? { motivo: mMotivo.trim() } : {}),
        ...(mNome.trim() ? { nome: mNome.trim() } : {}),
      })
      notifications.show({ title: nomeEtapa, message: 'Registro salvo.', color: 'green' })
      setModalManual(false); setMMotivo(''); setMNome('')
      await carregar(); onChanged?.()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao registrar.', color: 'red' })
    } finally { setBusy(false) }
  }

  if (loading) return <Loader size="xs" />

  const cfg = aprov?.status ? STATUS_CFG[aprov.status] : null

  return (
    <Stack gap={6} mt={6} pt={6} style={{ borderTop: '1px dashed var(--mantine-color-default-border)' }}>
      <Group justify="space-between" gap={4} wrap="nowrap">
        <Text size="xs" fw={600}>Aprovação do {nomeEtapa}</Text>
        <ActionIcon size="xs" variant="subtle" onClick={() => { setLoading(true); carregar() }} aria-label="Atualizar">
          <IconRefresh size={12} />
        </ActionIcon>
      </Group>

      {cfg ? <Badge color={cfg.color} variant="light">{cfg.label}</Badge>
        : <Badge color="gray" variant="outline">Aprovação não iniciada</Badge>}

      {aprov?.status && aprov.status !== 'AGUARDANDO' && (
        <Text size="xs" c="dimmed">
          {aprov.forma ? FORMA_LABEL[aprov.forma] ?? aprov.forma : ''}
          {aprov.por ? ` · ${aprov.por}` : ''}{aprov.em ? ` · ${fmtData(aprov.em)}` : ''}
        </Text>
      )}
      {(aprov?.status === 'ALTERACAO' || aprov?.status === 'CANCELADA') && aprov.motivo && (
        <Text size="xs" fs="italic">“{aprov.motivo}”</Text>
      )}

      {aprov?.status === 'ALTERACAO' && imagensCliente.length > 0 && (
        <div>
          <Text size="xs" c="dimmed" mb={2}>Imagens enviadas pelo cliente:</Text>
          <Group gap={4}>
            {imagensCliente.map((a) => (
              <Image key={a.id} src={urlAnexo(a.id)} alt={a.nome} h={56} w={56} fit="cover" radius="sm"
                style={{ cursor: 'zoom-in', border: '1px solid var(--mantine-color-default-border)' }}
                onClick={() => setPreview(urlAnexo(a.id))} />
            ))}
          </Group>
        </div>
      )}

      {/* Link do cliente */}
      <Group gap={4}>
        {linkPendente ? (
          <>
            <Button size="compact-xs" variant="light" leftSection={<IconCopy size={12} />} onClick={() => copiar(linkPendente.url)}>
              Copiar link
            </Button>
            <Button size="compact-xs" variant="subtle" color="gray" loading={busy} onClick={() => gerarLink(true)}>
              Novo link
            </Button>
          </>
        ) : (
          <Button size="compact-xs" variant="light" leftSection={<IconLink size={12} />} loading={busy} onClick={() => gerarLink(false)}>
            Gerar link do cliente
          </Button>
        )}
      </Group>
      {linkPendente && <Text size="xs" c="dimmed">Expira em {fmtData(linkPendente.expiraEm)}</Text>}

      {/* Arquivos do estágio */}
      <Group justify="space-between" gap={4}>
        <Text size="xs" fw={500}>Arquivos ({arquivos.length}/{LIMITE_ARQUIVOS})</Text>
        {arquivos.length < LIMITE_ARQUIVOS && (
          <FileButton accept="image/*,application/pdf" onChange={enviarArquivo}>
            {(props) => (
              <Button {...props} size="compact-xs" variant="light" leftSection={<IconUpload size={12} />} loading={busy}>
                Anexar
              </Button>
            )}
          </FileButton>
        )}
      </Group>
      {arquivos.length > 0 && (
        <Group gap={6}>
          {arquivos.map((a) => (
            <div key={a.id} style={{ position: 'relative' }}>
              {a.tipo === 'application/pdf' ? (
                <a href={urlAnexo(a.id)} target="_blank" rel="noreferrer"
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    width: 56, height: 56, border: '1px solid var(--mantine-color-default-border)', borderRadius: 4, textDecoration: 'none' }}>
                  <IconFileTypePdf size={22} color="var(--mantine-color-red-6)" />
                  <Text size="10px" lineClamp={1} maw={50}>{a.nome}</Text>
                </a>
              ) : (
                <Image src={urlAnexo(a.id)} alt={a.nome} h={56} w={56} fit="cover" radius="sm"
                  style={{ cursor: 'zoom-in', border: '1px solid var(--mantine-color-default-border)' }}
                  onClick={() => setPreview(urlAnexo(a.id))} />
              )}
              <ActionIcon size="xs" color="red" variant="filled" style={{ position: 'absolute', top: -4, right: -4 }}
                onClick={() => removerArquivo(a.id)} aria-label="Remover arquivo">
                <IconTrash size={10} />
              </ActionIcon>
            </div>
          ))}
        </Group>
      )}

      {mode === 'PEDIDO' && (
        <Button size="compact-xs" variant="default" leftSection={<IconClipboardCheck size={12} />} onClick={() => setModalManual(true)}>
          Registrar manualmente
        </Button>
      )}

      <Modal opened={!!preview} onClose={() => setPreview(null)} size="xl" centered title={nomeEtapa}>
        {preview && <Image src={preview} alt="Visualização" fit="contain" mah="75vh" />}
      </Modal>

      <Modal opened={modalManual} onClose={() => setModalManual(false)} centered title={`Registrar ${nomeEtapa} manualmente`}>
        <Stack gap="sm">
          <Select label="Resultado" allowDeselect={false} value={mStatus}
            onChange={(v) => v && setMStatus(v as typeof mStatus)}
            data={[
              { value: 'APROVADA', label: 'Aprovado' },
              { value: 'ALTERACAO', label: 'Alteração' },
              { value: 'CANCELADA', label: 'Cancelado' },
            ]} />
          <Select label="Como foi informado" allowDeselect={false} value={mForma}
            onChange={(v) => v && setMForma(v as typeof mForma)}
            data={[
              { value: 'REPRESENTANTE', label: 'Representante' },
              { value: 'EMAIL', label: 'E-mail' },
              { value: 'PRESENCIAL', label: 'Presencial' },
            ]} />
          <TextInput label="Quem informou (opcional)" value={mNome} onChange={(e) => setMNome(e.currentTarget.value)} />
          {mStatus !== 'APROVADA' && (
            <Textarea label={mStatus === 'ALTERACAO' ? 'O que alterar' : 'Motivo do cancelamento'} withAsterisk
              autosize minRows={3} maxLength={500} value={mMotivo} onChange={(e) => setMMotivo(e.currentTarget.value)} />
          )}
          <Text size="xs" c="dimmed">
            O link pendente deste estágio será encerrado. {mStatus === 'ALTERACAO' && 'O estágio volta para "Em andamento".'}
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setModalManual(false)}>Cancelar</Button>
            <Button loading={busy} onClick={registrarManual}>Salvar</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}
