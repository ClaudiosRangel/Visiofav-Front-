'use client'

/**
 * Página PÚBLICA de aprovação pelo cliente (sem login) - Mockup ou Arte.
 * Spec comercial-aprovacao-arte-cliente + workflow Mockup/Arte (reunião 24/11/2026).
 * O cliente pode: Aprovar, Solicitar alteração (descrição + até 5 imagens) ou Cancelar (motivo).
 * Consome as rotas públicas /api/aprovar-arte/:token - sem Authorization.
 */
import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  Container, Paper, Stack, Group, Title, Text, Button, Image, SimpleGrid,
  Loader, Center, Alert, Textarea, TextInput, Badge, Divider, FileButton, ActionIcon,
} from '@mantine/core'
import {
  IconCheck, IconThumbUp, IconPencil, IconAlertTriangle, IconClock, IconBan, IconUpload,
  IconTrash, IconFileTypePdf,
} from '@tabler/icons-react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333/api'

type Decisao = 'APROVADA' | 'AJUSTE_SOLICITADO' | 'CANCELADA_CLIENTE'

interface DadosPublicos {
  estado: 'PENDENTE' | 'EXPIRADO' | 'APROVADA' | 'AJUSTE_SOLICITADO' | 'CANCELADA_CLIENTE' | 'CANCELADO'
  etapa?: 'MOCKUP' | 'ARTE'
  numero: number
  produto: string | null
  cliente: string | null
  imagens: Array<{ id: string; nome: string; tipo?: string; imagem?: boolean }>
  imagensAlteracao?: number
  decididoEm: string | null
  motivoAjuste: string | null
}

type Modo = 'DECIDIR' | 'ALTERACAO' | 'CANCELAR'

export default function AprovarArtePublicaPage() {
  const params = useParams()
  const token = params?.token as string

  const [dados, setDados] = useState<DadosPublicos | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<{ code?: string; message: string } | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [concluido, setConcluido] = useState<Decisao | null>(null)
  const [nome, setNome] = useState('')
  const [motivo, setMotivo] = useState('')
  const [modo, setModo] = useState<Modo>('DECIDIR')
  const [fotos, setFotos] = useState<File[]>([])

  const carregar = useCallback(async () => {
    setLoading(true); setErro(null)
    try {
      const r = await fetch(`${API_BASE}/aprovar-arte/${token}`)
      const body = await r.json().catch(() => ({}))
      if (!r.ok) { setErro({ code: body?.code, message: body?.message || 'Link inválido.' }); setDados(null) }
      else setDados(body)
    } catch {
      setErro({ message: 'Não foi possível carregar. Verifique sua conexão.' })
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { carregar() }, [carregar])

  const etapa = dados?.etapa ?? 'ARTE'
  const nomeEtapa = etapa === 'MOCKUP' ? 'mockup' : 'arte'
  const tituloEtapa = etapa === 'MOCKUP' ? 'Aprovação de mockup' : 'Aprovação de arte'
  useEffect(() => { document.title = tituloEtapa }, [tituloEtapa])

  function adicionarFotos(lista: File[]) {
    const validas = lista.filter((f) => f.type.startsWith('image/') && f.size <= 10 * 1024 * 1024)
    if (validas.length < lista.length) setErro({ message: 'Use somente imagens de até 10 MB.' })
    setFotos((atual) => [...atual, ...validas].slice(0, 5))
  }

  async function decidir(decisao: Decisao) {
    if (!nome.trim()) { setErro({ message: 'Informe seu nome.' }); return }
    if (decisao === 'AJUSTE_SOLICITADO' && motivo.trim().length < 1) { setErro({ message: 'Descreva o que precisa ser alterado.' }); return }
    if (decisao === 'CANCELADA_CLIENTE' && motivo.trim().length < 1) { setErro({ message: 'Informe o motivo do cancelamento.' }); return }
    setEnviando(true); setErro(null)
    try {
      // Imagens da alteração: enviadas antes da decisão (o link ainda está pendente).
      if (decisao === 'AJUSTE_SOLICITADO') {
        for (const f of fotos) {
          const fd = new FormData()
          fd.append('file', f)
          const up = await fetch(`${API_BASE}/aprovar-arte/${token}/alteracao-imagem`, { method: 'POST', body: fd })
          if (!up.ok) {
            const b = await up.json().catch(() => ({}))
            setErro({ code: b?.code, message: b?.message || `Não foi possível enviar a imagem "${f.name}".` })
            return
          }
        }
      }
      const r = await fetch(`${API_BASE}/aprovar-arte/${token}/decidir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decisao, nome: nome.trim(), motivo: motivo.trim() || undefined }),
      })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) { setErro({ code: body?.code, message: body?.message || 'Não foi possível registrar sua resposta.' }); return }
      setConcluido(decisao)
    } catch {
      setErro({ message: 'Falha de conexão ao enviar sua resposta.' })
    } finally {
      setEnviando(false)
    }
  }

  function conteudo() {
    if (loading) return <Center py="xl"><Loader /></Center>

    if (erro && !dados) {
      const expirado = erro.code === 'LINK_EXPIRADO'
      return (
        <Alert color={expirado ? 'orange' : 'red'} icon={expirado ? <IconClock size={18} /> : <IconAlertTriangle size={18} />}
          title={expirado ? 'Link expirado' : 'Link indisponível'}>
          {expirado ? 'Este link de aprovação expirou. Solicite um novo ao seu contato comercial.' : (erro.message || 'Link inválido.')}
        </Alert>
      )
    }
    if (!dados) return null

    if (concluido) {
      const cfg = {
        APROVADA: { cor: 'teal', titulo: `${etapa === 'MOCKUP' ? 'Mockup' : 'Arte'} aprovado!`, msg: 'Obrigado! Sua aprovação foi registrada e enviada à equipe.' },
        AJUSTE_SOLICITADO: { cor: 'orange', titulo: 'Alteração solicitada', msg: 'Recebemos sua solicitação. A equipe de pré-impressão vai providenciar e enviará um novo link.' },
        CANCELADA_CLIENTE: { cor: 'gray', titulo: 'Cancelamento registrado', msg: 'Registramos o cancelamento. Seu contato comercial falará com você.' },
      }[concluido]
      return <Alert color={cfg.cor} icon={<IconCheck size={18} />} title={cfg.titulo}>{cfg.msg}</Alert>
    }

    if (dados.estado === 'APROVADA' || dados.estado === 'AJUSTE_SOLICITADO' || dados.estado === 'CANCELADA_CLIENTE') {
      const txt = dados.estado === 'APROVADA'
        ? `Este ${nomeEtapa} já foi aprovado. Obrigado!`
        : dados.estado === 'AJUSTE_SOLICITADO'
          ? `Já foi solicitada uma alteração${dados.motivoAjuste ? `: "${dados.motivoAjuste}"` : ''}.`
          : `Este link foi cancelado${dados.motivoAjuste ? `: "${dados.motivoAjuste}"` : ''}.`
      return <Alert color={dados.estado === 'APROVADA' ? 'teal' : dados.estado === 'CANCELADA_CLIENTE' ? 'gray' : 'orange'} icon={<IconCheck size={18} />} title="Já respondido">{txt}</Alert>
    }
    if (dados.estado === 'EXPIRADO') {
      return <Alert color="orange" icon={<IconClock size={18} />} title="Link expirado">Este link expirou. Solicite um novo ao seu contato comercial.</Alert>
    }
    if (dados.estado === 'CANCELADO') {
      return <Alert color="gray" icon={<IconAlertTriangle size={18} />} title="Link cancelado">Este link não está mais ativo.</Alert>
    }

    // PENDENTE - pode decidir
    return (
      <Stack gap="md">
        <Group gap="xs">
          <Badge color="blue" size="lg">Pedido nº {dados.numero}</Badge>
          <Badge color={etapa === 'MOCKUP' ? 'grape' : 'cyan'} variant="light" size="lg">{etapa === 'MOCKUP' ? 'Mockup' : 'Arte'}</Badge>
          {dados.cliente && <Text c="dimmed">{dados.cliente}</Text>}
        </Group>
        {dados.produto && <Text fw={600}>{dados.produto}</Text>}

        {dados.imagens.length === 0 ? (
          <Alert color="gray" icon={<IconAlertTriangle size={18} />}>
            Ainda não há arquivos de {nomeEtapa} anexados. Fale com seu contato comercial.
          </Alert>
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            {dados.imagens.map((img) => {
              const src = `${API_BASE}/aprovar-arte/${token}/imagem/${img.id}`
              const ehImagem = img.imagem ?? !(img.tipo === 'application/pdf')
              return ehImagem ? (
                <Image key={img.id} radius="md" alt={img.nome} src={src} fit="contain" h={300}
                  style={{ border: '1px solid var(--mantine-color-default-border)' }} />
              ) : (
                <a key={img.id} href={src} target="_blank" rel="noreferrer"
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 140,
                    border: '1px solid var(--mantine-color-default-border)', borderRadius: 8, textDecoration: 'none', padding: 8 }}>
                  <IconFileTypePdf size={40} color="var(--mantine-color-red-6)" />
                  <Text size="sm" ta="center" mt={6} lineClamp={2}>{img.nome}</Text>
                  <Text size="xs" c="dimmed">Abrir PDF</Text>
                </a>
              )
            })}
          </SimpleGrid>
        )}

        <Divider label="Sua decisão" labelPosition="center" />

        <TextInput label="Seu nome" placeholder="Nome de quem está respondendo" withAsterisk
          value={nome} onChange={(e) => setNome(e.currentTarget.value)} />

        {modo === 'ALTERACAO' && (
          <>
            <Textarea label="O que precisa ser alterado?" withAsterisk minRows={3} maxLength={500}
              placeholder="Descreva as alterações desejadas" value={motivo} onChange={(e) => setMotivo(e.currentTarget.value)} />
            <div>
              <Text size="sm" fw={500} mb={4}>Imagens de referência (opcional, até 5)</Text>
              <Group gap="xs">
                {fotos.map((f, i) => (
                  <Group key={`${f.name}-${i}`} gap={4} wrap="nowrap"
                    style={{ border: '1px solid var(--mantine-color-default-border)', borderRadius: 6, padding: '2px 8px' }}>
                    <Text size="xs" maw={160} truncate="end">{f.name}</Text>
                    <ActionIcon size="xs" variant="subtle" color="red" aria-label="Remover imagem"
                      onClick={() => setFotos((a) => a.filter((_, j) => j !== i))}>
                      <IconTrash size={12} />
                    </ActionIcon>
                  </Group>
                ))}
                {fotos.length < 5 && (
                  <FileButton accept="image/*" multiple onChange={adicionarFotos}>
                    {(props) => <Button {...props} size="xs" variant="light" leftSection={<IconUpload size={14} />}>Anexar imagem</Button>}
                  </FileButton>
                )}
              </Group>
            </div>
          </>
        )}

        {modo === 'CANCELAR' && (
          <Textarea label="Motivo do cancelamento" withAsterisk minRows={3} maxLength={500}
            placeholder="Conte o motivo" value={motivo} onChange={(e) => setMotivo(e.currentTarget.value)} />
        )}

        {erro && <Alert color="red" icon={<IconAlertTriangle size={16} />}>{erro.message}</Alert>}

        <Group justify="center" gap="md">
          {modo === 'DECIDIR' && (
            <>
              <Button size="md" color="teal" leftSection={<IconThumbUp size={18} />} loading={enviando} onClick={() => decidir('APROVADA')}>
                Aprovar {nomeEtapa}
              </Button>
              <Button size="md" variant="light" color="orange" leftSection={<IconPencil size={18} />}
                onClick={() => { setModo('ALTERACAO'); setMotivo(''); setErro(null) }}>
                Solicitar alteração
              </Button>
              <Button size="md" variant="subtle" color="gray" leftSection={<IconBan size={18} />}
                onClick={() => { setModo('CANCELAR'); setMotivo(''); setErro(null) }}>
                Cancelar
              </Button>
            </>
          )}
          {modo === 'ALTERACAO' && (
            <>
              <Button size="md" color="orange" leftSection={<IconPencil size={18} />} loading={enviando} onClick={() => decidir('AJUSTE_SOLICITADO')}>
                Enviar solicitação de alteração
              </Button>
              <Button size="md" variant="subtle" color="gray" onClick={() => { setModo('DECIDIR'); setErro(null) }}>Voltar</Button>
            </>
          )}
          {modo === 'CANCELAR' && (
            <>
              <Button size="md" color="red" leftSection={<IconBan size={18} />} loading={enviando} onClick={() => decidir('CANCELADA_CLIENTE')}>
                Confirmar cancelamento
              </Button>
              <Button size="md" variant="subtle" color="gray" onClick={() => { setModo('DECIDIR'); setErro(null) }}>Voltar</Button>
            </>
          )}
        </Group>
      </Stack>
    )
  }

  return (
    <Container size="sm" py="xl">
      <Paper withBorder p="lg" radius="md">
        <Title order={3} mb="md">{tituloEtapa}</Title>
        {conteudo()}
      </Paper>
      <Text ta="center" c="dimmed" size="xs" mt="md">Vizor ERP - aprovação segura por link</Text>
    </Container>
  )
}
