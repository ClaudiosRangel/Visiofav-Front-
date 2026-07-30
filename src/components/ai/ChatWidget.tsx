'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Paper,
  Text,
  ActionIcon,
  TextInput,
  ScrollArea,
  Badge,
  Transition,
  Loader,
} from '@mantine/core'
import { IconSend, IconX, IconSparkles, IconPaperclip, IconGripVertical } from '@tabler/icons-react'
import ReactMarkdown from 'react-markdown'
import { useVizorChat, useVizorUpload, type ChatMessage, type AIResponse } from '@/data/hooks/ai/useVizorAI'

const MAX_MESSAGES = 50

// Posição do widget (botão + painel) persistida entre sessões, para o
// usuário não precisar reposicionar toda vez que recarregar a página.
const POSICAO_STORAGE_KEY = 'vizor-ai-widget-posicao'
const MARGEM_TELA = 16

function clampPosicao(pos: { x: number; y: number }, largura: number, altura: number) {
  if (typeof window === 'undefined') return pos
  const maxX = Math.max(MARGEM_TELA, window.innerWidth - largura - MARGEM_TELA)
  const maxY = Math.max(MARGEM_TELA, window.innerHeight - altura - MARGEM_TELA)
  return {
    x: Math.min(Math.max(MARGEM_TELA, pos.x), maxX),
    y: Math.min(Math.max(MARGEM_TELA, pos.y), maxY),
  }
}

/**
 * Posicionamento arrastável do widget Vizor AI (botão flutuante + painel de
 * chat). Antes o widget ficava fixo no canto inferior direito — em telas
 * com muita informação (ex: painel de Programação do PCP) ele cobria
 * botões e dados, sem forma de tirá-lo do caminho. Agora: posição inicial
 * no lado esquerdo da tela, arrastável (mouse/touch) para qualquer lugar,
 * com a posição escolhida persistida em localStorage.
 *
 * `draggingRef` é a fonte de verdade da lógica (lido/escrito de forma
 * síncrona dentro dos handlers de pointer, sem depender de re-render).
 * `arrastandoUI` é só para refletir visualmente (opacidade) durante o
 * arrasto — não deve ser lido dentro dos handlers, só usado no JSX.
 */
function usePosicaoArrastavel(largura: number, altura: number) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const [arrastandoUI, setArrastandoUI] = useState(false)
  const draggingRef = useRef(false)
  const movedRef = useRef(false)
  const offsetRef = useRef({ x: 0, y: 0 })
  const startRef = useRef({ x: 0, y: 0 })

  // Inicializa a posição (lado esquerdo, próximo ao rodapé) — só no client,
  // após montar, para não quebrar SSR (window indisponível no server).
  useEffect(() => {
    try {
      const salva = localStorage.getItem(POSICAO_STORAGE_KEY)
      if (salva) {
        setPos(clampPosicao(JSON.parse(salva), largura, altura))
        return
      }
    } catch {
      // localStorage indisponível (modo privado, etc.) — segue com o padrão
    }
    setPos({ x: MARGEM_TELA, y: window.innerHeight - altura - MARGEM_TELA })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Quando o tamanho muda (botão fechado <-> painel aberto), reajusta a
  // posição para continuar dentro da tela com o novo tamanho.
  useEffect(() => {
    setPos((atual) => (atual ? clampPosicao(atual, largura, altura) : atual))
  }, [largura, altura])

  // Reclampa também ao redimensionar a janela do navegador.
  useEffect(() => {
    function aoRedimensionar() {
      setPos((atual) => (atual ? clampPosicao(atual, largura, altura) : atual))
    }
    window.addEventListener('resize', aoRedimensionar)
    return () => window.removeEventListener('resize', aoRedimensionar)
  }, [largura, altura])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    setPos((posAtual) => {
      if (posAtual) offsetRef.current = { x: e.clientX - posAtual.x, y: e.clientY - posAtual.y }
      return posAtual
    })
    draggingRef.current = true
    movedRef.current = false
    startRef.current = { x: e.clientX, y: e.clientY }
    setArrastandoUI(true)
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current) return
    const dx = e.clientX - startRef.current.x
    const dy = e.clientY - startRef.current.y
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) movedRef.current = true
    setPos(clampPosicao({ x: e.clientX - offsetRef.current.x, y: e.clientY - offsetRef.current.y }, largura, altura))
  }, [largura, altura])

  const onPointerUp = useCallback(() => {
    if (!draggingRef.current) return
    draggingRef.current = false
    setArrastandoUI(false)
    setPos((atual) => {
      if (atual) {
        try { localStorage.setItem(POSICAO_STORAGE_KEY, JSON.stringify(atual)) } catch {}
      }
      return atual
    })
  }, [])

  return { pos, arrastandoUI, onPointerDown, onPointerMove, onPointerUp, houveArrasto: () => movedRef.current }
}

// Componente de renderização Markdown com estilo dark-mode compacto para o chat
function MarkdownMessage({ content }: { content: string }) {
  return (
    <div style={{ fontSize: 13, lineHeight: 1.5 }}>
      <ReactMarkdown
        components={{
          h1: ({ children }) => <div style={{ fontSize: 15, fontWeight: 700, marginTop: 6, marginBottom: 6 }}>{children}</div>,
          h2: ({ children }) => <div style={{ fontSize: 14, fontWeight: 700, marginTop: 8, marginBottom: 4 }}>{children}</div>,
          h3: ({ children }) => <div style={{ fontSize: 13, fontWeight: 600, marginTop: 6, marginBottom: 4 }}>{children}</div>,
          p: ({ children }) => <p style={{ margin: '4px 0' }}>{children}</p>,
          strong: ({ children }) => <strong style={{ fontWeight: 700, color: '#ffffff' }}>{children}</strong>,
          em: ({ children }) => <em>{children}</em>,
          ul: ({ children }) => <ul style={{ margin: '4px 0', paddingLeft: 18 }}>{children}</ul>,
          ol: ({ children }) => <ol style={{ margin: '4px 0', paddingLeft: 18 }}>{children}</ol>,
          li: ({ children }) => <li style={{ marginBottom: 3 }}>{children}</li>,
          code: ({ children }) => <code style={{ background: 'rgba(255,255,255,0.1)', padding: '1px 5px', borderRadius: 4, fontSize: 12 }}>{children}</code>,
          hr: () => <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.15)', margin: '8px 0' }} />,
          table: ({ children }) => <table style={{ borderCollapse: 'collapse', width: '100%', margin: '6px 0', fontSize: 12 }}>{children}</table>,
          th: ({ children }) => <th style={{ border: '1px solid rgba(255,255,255,0.2)', padding: '4px 6px', textAlign: 'left', background: 'rgba(255,255,255,0.05)' }}>{children}</th>,
          td: ({ children }) => <td style={{ border: '1px solid rgba(255,255,255,0.15)', padding: '4px 6px' }}>{children}</td>,
          a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: '#4ade80', textDecoration: 'underline' }}>{children}</a>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

const LARGURA_BOTAO = 56
const ALTURA_BOTAO = 56
const LARGURA_PAINEL = 440
const ALTURA_PAINEL = 600

export default function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sugestoes, setSugestoes] = useState<string[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const chat = useVizorChat()
  const upload = useVizorUpload()

  // Posição arrastável — dimensões diferentes para botão fechado vs painel
  // aberto, para o clamp de tela considerar o tamanho certo em cada estado.
  const { pos, arrastandoUI, onPointerDown, onPointerMove, onPointerUp, houveArrasto } = usePosicaoArrastavel(
    open ? LARGURA_PAINEL : LARGURA_BOTAO,
    open ? ALTURA_PAINEL : ALTURA_BOTAO,
  )

  // Keyboard shortcut: Ctrl+K / Cmd+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(prev => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    }
  }, [messages, chat.isPending])

  // Focus input when panel opens + welcome message (local, sem LLM)
  const [onboardingChecked, setOnboardingChecked] = useState(false)
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
      // First time: show welcome message locally (no API call to avoid timeout)
      if (!onboardingChecked && messages.length === 0) {
        setOnboardingChecked(true)
        setMessages([{ role: 'assistant', content: 'Olá! 👋 Sou o **Vizor AI**. Posso te ajudar a navegar, criar pedidos, consultar estoque, importar XML e muito mais. O que precisa?' }])
        setSugestoes(['Quanto vendemos esse mês?', 'Consultar estoque', 'Abrir relatórios', 'Importar XML'])
      }
    }
  }, [open])

  const handleSend = useCallback(async (text?: string) => {
    const mensagem = (text || input).trim()
    if (!mensagem) return

    const userMsg: ChatMessage = { role: 'user', content: mensagem }
    const newMessages = [...messages, userMsg].slice(-MAX_MESSAGES)
    setMessages(newMessages)
    setInput('')
    setSugestoes([])

    try {
      const response: AIResponse = await chat.mutateAsync({
        mensagem,
        historico: newMessages.slice(-10),
      })

      const assistantMsg: ChatMessage = { role: 'assistant', content: response.resposta }
      setMessages(prev => [...prev, assistantMsg].slice(-MAX_MESSAGES))

      if (response.sugestoes?.length) {
        setSugestoes(response.sugestoes)
      }

      // Handle navigation action
      if (response.acao?.tipo === 'NAVEGAR' && response.acao.rota) {
        setOpen(false)
        router.push(response.acao.rota)
      }
    } catch {
      const errorMsg: ChatMessage = {
        role: 'assistant',
        content: 'Erro ao processar, tente novamente.',
      }
      setMessages(prev => [...prev, errorMsg].slice(-MAX_MESSAGES))
    }
  }, [input, messages, chat, router])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Show file as user message
    const userMsg: ChatMessage = { role: 'user', content: `📎 ${file.name}` }
    setMessages(prev => [...prev, userMsg].slice(-MAX_MESSAGES))
    setSugestoes([])

    try {
      const response: AIResponse = await upload.mutateAsync(file)

      const assistantMsg: ChatMessage = { role: 'assistant', content: response.resposta }
      setMessages(prev => [...prev, assistantMsg].slice(-MAX_MESSAGES))

      if (response.sugestoes?.length) {
        setSugestoes(response.sugestoes)
      }

      if (response.acao?.tipo === 'NAVEGAR' && response.acao.rota) {
        // Don't auto-navigate on upload, just suggest
      }
    } catch {
      const errorMsg: ChatMessage = {
        role: 'assistant',
        content: 'Erro ao processar arquivo, tente novamente.',
      }
      setMessages(prev => [...prev, errorMsg].slice(-MAX_MESSAGES))
    }

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [upload])

  // Enquanto a posição inicial não foi calculada (primeiro render, antes do
  // useEffect rodar no client), não renderiza nada — evita "pulo" visual.
  if (!pos) return null

  return (
    <>
      {/* Floating button — translúcido (opacidade reduzida, sobe para 1 no
          hover/arrasto) para não obstruir permanentemente dados/botões por
          baixo, e arrastável para qualquer posição da tela. */}
      <Transition mounted={!open} transition="pop" duration={200}>
        {(styles) => (
          <button
            style={{
              ...styles,
              position: 'fixed',
              left: pos.x,
              top: pos.y,
              width: LARGURA_BOTAO,
              height: ALTURA_BOTAO,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #2d9d5a, #1a9d8f)',
              border: 'none',
              cursor: arrastandoUI ? 'grabbing' : 'grab',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 20px rgba(45, 157, 90, 0.4)',
              zIndex: 9999,
              opacity: arrastandoUI ? 1 : 0.55,
              transition: arrastandoUI ? 'none' : 'opacity 0.2s, transform 0.2s',
              touchAction: 'none',
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onClick={() => {
              // Só abre o chat se o clique não foi o fim de um arrasto —
              // sem essa checagem, soltar o botão após arrastar também
              // dispararia a abertura do painel.
              if (!houveArrasto()) setOpen(true)
            }}
            aria-label="Abrir Vizor AI (arraste para mover)"
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1.1)' }}
            onMouseLeave={(e) => { if (!arrastandoUI) { e.currentTarget.style.opacity = '0.55'; e.currentTarget.style.transform = 'scale(1)' } }}
          >
            <IconSparkles size={28} color="white" />
          </button>
        )}
      </Transition>

      {/* Chat Panel — também translúcido e arrastável pelo header. */}
      <Transition mounted={open} transition="slide-up" duration={250}>
        {(styles) => (
          <Paper
            style={{
              ...styles,
              position: 'fixed',
              left: pos.x,
              top: pos.y,
              width: LARGURA_PAINEL,
              height: ALTURA_PAINEL,
              maxHeight: 'calc(100vh - 32px)',
              zIndex: 9999,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              background: 'rgba(30, 30, 46, 0.92)',
              backdropFilter: 'blur(6px)',
              border: '1px solid #333',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              opacity: arrastandoUI ? 0.75 : 1,
            }}
            radius="md"
          >
            {/* Header — arrastar por aqui move o painel inteiro */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderBottom: '1px solid #333',
                background: '#1a1a2e',
                cursor: arrastandoUI ? 'grabbing' : 'grab',
                touchAction: 'none',
              }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
            >
              <Text size="sm" fw={600} style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: 6, userSelect: 'none' }}>
                <IconGripVertical size={14} style={{ opacity: 0.5 }} />
                🤖 Vizor AI
              </Text>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                onClick={() => setOpen(false)}
                onPointerDown={(e) => e.stopPropagation()}
                aria-label="Fechar chat"
              >
                <IconX size={16} />
              </ActionIcon>
            </div>

            {/* Messages */}
            <ScrollArea
              style={{ flex: 1, padding: '12px 16px' }}
              viewportRef={scrollRef}
            >
              {messages.length === 0 && (
                <Text size="xs" c="dimmed" ta="center" mt="xl">
                  Olá! Sou o Vizor AI. Como posso ajudar?
                </Text>
              )}

              {messages.map((msg, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    marginBottom: 8,
                  }}
                >
                  <div
                    style={{
                      maxWidth: msg.role === 'user' ? '80%' : '92%',
                      padding: msg.role === 'user' ? '8px 12px' : '10px 14px',
                      borderRadius: 12,
                      background: msg.role === 'user' ? '#2d9d5a' : '#2a2a3a',
                      color: '#fff',
                      fontSize: 13,
                      lineHeight: 1.4,
                      wordBreak: 'break-word',
                    }}
                  >
                    {msg.role === 'assistant' ? <MarkdownMessage content={msg.content} /> : msg.content}
                  </div>
                </div>
              ))}

              {/* Typing indicator */}
              {(chat.isPending || upload.isPending) && (
                <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 8 }}>
                  <div
                    style={{
                      padding: '8px 12px',
                      borderRadius: 12,
                      background: '#2a2a3a',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <Loader size="xs" color="teal" type="dots" />
                    <Text size="xs" c="dimmed">Pensando...</Text>
                  </div>
                </div>
              )}

              {/* Suggestion chips */}
              {sugestoes.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                  {sugestoes.map((s, i) => (
                    <Badge
                      key={i}
                      variant="outline"
                      color="teal"
                      size="sm"
                      style={{ cursor: 'pointer' }}
                      onClick={() => handleSend(s)}
                    >
                      {s}
                    </Badge>
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Input area */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 12px',
                background: '#25253a',
                borderTop: '1px solid #333',
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xml"
                style={{ display: 'none' }}
                onChange={handleFileUpload}
              />
              <ActionIcon
                variant="subtle"
                color="gray"
                size="lg"
                onClick={() => fileInputRef.current?.click()}
                disabled={chat.isPending || upload.isPending}
                aria-label="Enviar arquivo XML"
              >
                <IconPaperclip size={18} />
              </ActionIcon>
              <TextInput
                ref={inputRef}
                placeholder="Digite sua pergunta..."
                value={input}
                onChange={(e) => setInput(e.currentTarget.value)}
                onKeyDown={handleKeyDown}
                disabled={chat.isPending || upload.isPending}
                size="sm"
                style={{ flex: 1 }}
                styles={{
                  input: {
                    background: '#1e1e2e',
                    border: '1px solid #444',
                    color: '#fff',
                  },
                }}
              />
              <ActionIcon
                variant="filled"
                color="teal"
                size="lg"
                onClick={() => handleSend()}
                disabled={chat.isPending || upload.isPending || !input.trim()}
                aria-label="Enviar mensagem"
              >
                <IconSend size={18} />
              </ActionIcon>
            </div>
          </Paper>
        )}
      </Transition>
    </>
  )
}
