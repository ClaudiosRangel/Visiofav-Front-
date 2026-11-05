'use client'

/**
 * Página PÚBLICA de aprovação de arte pelo cliente (sem login).
 * Spec comercial-aprovacao-arte-cliente. Acessada por link com token que expira.
 * Consome as rotas públicas /api/aprovar-arte/:token (GET/POST) — sem Authorization.
 */
import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  Container, Paper, Stack, Group, Title, Text, Button, Image, SimpleGrid,
  Loader, Center, Alert, Textarea, TextInput, Badge, Divider,
} from '@mantine/core'
import { IconCheck, IconThumbUp, IconThumbDown, IconAlertTriangle, IconClock } from '@tabler/icons-react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333/api'

interface DadosPublicos {
  estado: 'PENDENTE' | 'EXPIRADO' | 'APROVADA' | 'AJUSTE_SOLICITADO' | 'CANCELADO'
  numero: number
  produto: string | null
  cliente: string | null
  imagens: Array<{ id: string; nome: string }>
  decididoEm: string | null
  motivoAjuste: string | null
}

export default function AprovarArtePublicaPage() {
  const params = useParams()
  const token = params?.token as string

  const [dados, setDados] = useState<DadosPublicos | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<{ code?: string; message: string } | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [concluido, setConcluido] = useState<'APROVADA' | 'AJUSTE_SOLICITADO' | null>(null)
  const [nome, setNome] = useState('')
  const [motivo, setMotivo] = useState('')
  const [modoAjuste, setModoAjuste] = useState(false)

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
  useEffect(() => { document.title = 'Aprovação de arte' }, [])

  async function decidir(decisao: 'APROVADA' | 'AJUSTE_SOLICITADO') {
    if (!nome.trim()) { setErro({ message: 'Informe seu nome.' }); return }
    if (decisao === 'AJUSTE_SOLICITADO' && motivo.trim().length < 1) { setErro({ message: 'Descreva o ajuste desejado.' }); return }
    setEnviando(true); setErro(null)
    try {
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

    // Erros de link (expirado / inválido)
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

    // Já concluído nesta sessão
    if (concluido) {
      return (
        <Alert color={concluido === 'APROVADA' ? 'teal' : 'orange'} icon={<IconCheck size={18} />}
          title={concluido === 'APROVADA' ? 'Arte aprovada!' : 'Ajuste solicitado'}>
          {concluido === 'APROVADA'
            ? 'Obrigado! Sua aprovação foi registrada e enviada à equipe.'
            : 'Recebemos seu pedido de ajuste. A equipe de pré-impressão vai providenciar.'}
        </Alert>
      )
    }

    // Já respondido antes (estado veio do servidor)
    if (dados.estado === 'APROVADA' || dados.estado === 'AJUSTE_SOLICITADO') {
      return (
        <Alert color={dados.estado === 'APROVADA' ? 'teal' : 'orange'} icon={<IconCheck size={18} />} title="Já respondido">
          {dados.estado === 'APROVADA'
            ? 'Esta arte já foi aprovada. Obrigado!'
            : `Já foi solicitado um ajuste${dados.motivoAjuste ? `: "${dados.motivoAjuste}"` : ''}.`}
        </Alert>
      )
    }
    if (dados.estado === 'EXPIRADO') {
      return <Alert color="orange" icon={<IconClock size={18} />} title="Link expirado">Este link expirou. Solicite um novo ao seu contato comercial.</Alert>
    }
    if (dados.estado === 'CANCELADO') {
      return <Alert color="gray" icon={<IconAlertTriangle size={18} />} title="Link cancelado">Este link não está mais ativo.</Alert>
    }

    // PENDENTE — pode decidir
    return (
      <Stack gap="md">
        <Group gap="xs">
          <Badge color="blue" size="lg">Pedido nº {dados.numero}</Badge>
          {dados.cliente && <Text c="dimmed">{dados.cliente}</Text>}
        </Group>
        {dados.produto && <Text fw={600}>{dados.produto}</Text>}

        {dados.imagens.length === 0 ? (
          <Alert color="gray" icon={<IconAlertTriangle size={18} />}>
            Ainda não há imagens de arte anexadas. Fale com seu contato comercial.
          </Alert>
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            {dados.imagens.map((img) => (
              <Image key={img.id} radius="md" alt={img.nome}
                src={`${API_BASE}/aprovar-arte/${token}/imagem/${img.id}`}
                fit="contain" h={300} style={{ border: '1px solid var(--mantine-color-default-border)' }} />
            ))}
          </SimpleGrid>
        )}

        <Divider label="Sua decisão" labelPosition="center" />

        <TextInput label="Seu nome" placeholder="Nome de quem está aprovando" withAsterisk
          value={nome} onChange={(e) => setNome(e.currentTarget.value)} />

        {modoAjuste && (
          <Textarea label="O que precisa ajustar?" withAsterisk minRows={3}
            placeholder="Descreva o ajuste desejado" value={motivo} onChange={(e) => setMotivo(e.currentTarget.value)} />
        )}

        {erro && <Alert color="red" icon={<IconAlertTriangle size={16} />}>{erro.message}</Alert>}

        <Group justify="center" gap="md">
          {!modoAjuste ? (
            <>
              <Button size="md" color="teal" leftSection={<IconThumbUp size={18} />} loading={enviando}
                onClick={() => decidir('APROVADA')}>
                Aprovar arte
              </Button>
              <Button size="md" variant="light" color="orange" leftSection={<IconThumbDown size={18} />}
                onClick={() => { setModoAjuste(true); setErro(null) }}>
                Pedir ajuste
              </Button>
            </>
          ) : (
            <>
              <Button size="md" color="orange" leftSection={<IconThumbDown size={18} />} loading={enviando}
                onClick={() => decidir('AJUSTE_SOLICITADO')}>
                Enviar pedido de ajuste
              </Button>
              <Button size="md" variant="subtle" color="gray" onClick={() => { setModoAjuste(false); setErro(null) }}>
                Voltar
              </Button>
            </>
          )}
        </Group>
      </Stack>
    )
  }

  return (
    <Container size="sm" py="xl">
      <Paper withBorder p="lg" radius="md">
        <Title order={3} mb="md">Aprovação de arte</Title>
        {conteudo()}
      </Paper>
      <Text ta="center" c="dimmed" size="xs" mt="md">Vizor ERP — aprovação segura por link</Text>
    </Container>
  )
}
