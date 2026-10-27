'use client'

/**
 * Upload + visualização do arquivo de ENCAIXE/IMPOSIÇÃO gerado por aplicativo
 * externo específico (R11 — spec orcamento-grafico-handoff-comercial). O
 * encaixe real NÃO é desenhado pelo Vizor: o operador sobe o arquivo (PNG/JPG/
 * SVG/PDF) produzido pelo software de imposição e ele fica visível aqui como
 * documentação de consulta. Backend:
 *   POST   /orcamento-grafico/:id/itens/:itemId/encaixe-arquivo (multipart)
 *   GET    /orcamento-grafico/:id/itens/:itemId/encaixe-arquivo[/info]
 *   DELETE /orcamento-grafico/:id/itens/:itemId/encaixe-arquivo
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Modal, Stack, Group, Text, Button, FileButton, Loader, Center, Image, Alert, Badge,
} from '@mantine/core'
import { IconUpload, IconTrash, IconFileText, IconExternalLink, IconAlertCircle } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { api } from '@/lib/api'
import { getAuthToken } from '@/lib/authStorage'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333/api'

interface Info {
  temArquivo: boolean
  mime: string | null
  nome: string | null
  enviadoEm: string | null
}

interface Props {
  opened: boolean
  onClose: () => void
  orcamentoId: string
  itemId: string | null
  itemDescricao?: string | null
}

export default function EncaixeArquivoModal({ opened, onClose, orcamentoId, itemId, itemDescricao }: Props) {
  const [info, setInfo] = useState<Info | null>(null)
  const [loading, setLoading] = useState(false)
  const [enviando, setEnviando] = useState(false)
  // cache-buster para forçar o preview a recarregar após upload
  const [versao, setVersao] = useState(0)
  const resetRef = useRef<() => void>(null)

  const carregar = useCallback(async () => {
    if (!itemId) return
    setLoading(true)
    try {
      const { data } = await api.get(`/orcamento-grafico/${orcamentoId}/itens/${itemId}/encaixe-arquivo/info`)
      setInfo(data)
    } catch {
      setInfo({ temArquivo: false, mime: null, nome: null, enviadoEm: null })
    } finally {
      setLoading(false)
    }
  }, [orcamentoId, itemId])

  useEffect(() => { if (opened) carregar() }, [opened, carregar])

  async function enviar(file: File | null) {
    if (!file || !itemId) return
    setEnviando(true)
    try {
      const form = new FormData()
      form.append('file', file)
      await api.post(`/orcamento-grafico/${orcamentoId}/itens/${itemId}/encaixe-arquivo`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      notifications.show({ title: 'Encaixe enviado', message: 'Arquivo disponível para visualização.', color: 'green' })
      setVersao((v) => v + 1)
      await carregar()
    } catch (err: any) {
      notifications.show({ title: 'Erro no envio', message: err?.response?.data?.message || 'Falha ao enviar', color: 'red' })
    } finally {
      setEnviando(false)
      resetRef.current?.()
    }
  }

  async function remover() {
    if (!itemId) return
    try {
      await api.delete(`/orcamento-grafico/${orcamentoId}/itens/${itemId}/encaixe-arquivo`)
      notifications.show({ title: 'Removido', message: 'Arquivo de encaixe removido.', color: 'blue' })
      setInfo({ temArquivo: false, mime: null, nome: null, enviadoEm: null })
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao remover', color: 'red' })
    }
  }

  const token = getAuthToken() || ''
  const urlArquivo = itemId
    ? `${API_BASE}/orcamento-grafico/${orcamentoId}/itens/${itemId}/encaixe-arquivo?token=${token}&v=${versao}`
    : ''
  const isPdf = info?.mime === 'application/pdf'
  const isImagem = info?.mime?.startsWith('image/')

  return (
    <Modal opened={opened} onClose={onClose} title="Encaixe / Imposição" size="lg" centered>
      <Stack gap="md">
        <Alert icon={<IconAlertCircle size={16} />} color="gray" variant="light">
          O encaixe é gerado por aplicativo externo de imposição. Suba aqui o arquivo
          (PNG, JPG, SVG ou PDF) para deixá-lo disponível como documentação de consulta.
        </Alert>

        {itemDescricao && <Text size="sm" c="dimmed">Item: {itemDescricao}</Text>}

        <Group>
          <FileButton
            resetRef={resetRef}
            onChange={enviar}
            accept="image/png,image/jpeg,image/svg+xml,application/pdf"
          >
            {(props) => (
              <Button {...props} leftSection={<IconUpload size={16} />} loading={enviando}>
                {info?.temArquivo ? 'Substituir arquivo' : 'Enviar encaixe'}
              </Button>
            )}
          </FileButton>
          {info?.temArquivo && (
            <>
              <Button
                variant="light"
                leftSection={<IconExternalLink size={16} />}
                onClick={() => window.open(urlArquivo, '_blank')}
              >
                Abrir em nova aba
              </Button>
              <Button variant="subtle" color="red" leftSection={<IconTrash size={16} />} onClick={remover}>
                Remover
              </Button>
            </>
          )}
        </Group>

        {loading ? (
          <Center py="xl"><Loader /></Center>
        ) : info?.temArquivo ? (
          <Stack gap="xs">
            <Group gap="xs">
              <Badge variant="light">{info.nome}</Badge>
              {info.enviadoEm && (
                <Text size="xs" c="dimmed">enviado em {new Date(info.enviadoEm).toLocaleString('pt-BR')}</Text>
              )}
            </Group>
            {isImagem && (
              <Image
                src={urlArquivo}
                alt="Encaixe enviado"
                fit="contain"
                mah={480}
                style={{ border: '1px solid var(--mantine-color-gray-4)', background: 'var(--mantine-color-body)' }}
              />
            )}
            {isPdf && (
              <iframe
                title="Encaixe (PDF)"
                src={urlArquivo}
                style={{ width: '100%', height: 480, border: '1px solid var(--mantine-color-gray-4)' }}
              />
            )}
            {!isImagem && !isPdf && (
              <Group gap="xs"><IconFileText size={16} /><Text size="sm">Arquivo disponível (abra em nova aba).</Text></Group>
            )}
          </Stack>
        ) : (
          <Center py="xl">
            <Text c="dimmed" size="sm">Nenhum arquivo de encaixe enviado ainda.</Text>
          </Center>
        )}
      </Stack>
    </Modal>
  )
}
