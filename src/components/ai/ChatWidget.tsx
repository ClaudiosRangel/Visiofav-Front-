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
import { IconSend, IconX, IconSparkles, IconPaperclip } from '@tabler/icons-react'
import { useVizorChat, useVizorUpload, type ChatMessage, type AIResponse } from '@/data/hooks/ai/useVizorAI'

const MAX_MESSAGES = 50

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

  // Focus input when panel opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
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

  return (
    <>
      {/* Floating button */}
      <Transition mounted={!open} transition="pop" duration={200}>
        {(styles) => (
          <button
            style={{
              ...styles,
              position: 'fixed',
              bottom: 24,
              right: 24,
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #2d9d5a, #1a9d8f)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 20px rgba(45, 157, 90, 0.4)',
              zIndex: 9999,
              transition: 'transform 0.2s',
            }}
            onClick={() => setOpen(true)}
            aria-label="Abrir Vizor AI"
            onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.1)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
            <IconSparkles size={28} color="white" />
          </button>
        )}
      </Transition>

      {/* Chat Panel */}
      <Transition mounted={open} transition="slide-up" duration={250}>
        {(styles) => (
          <Paper
            style={{
              ...styles,
              position: 'fixed',
              bottom: 24,
              right: 24,
              width: 400,
              height: 500,
              zIndex: 9999,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              background: '#1e1e2e',
              border: '1px solid #333',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            }}
            radius="md"
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderBottom: '1px solid #333',
                background: '#1a1a2e',
              }}
            >
              <Text size="sm" fw={600} style={{ color: '#fff' }}>
                🤖 Vizor AI
              </Text>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                onClick={() => setOpen(false)}
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
                      maxWidth: '80%',
                      padding: '8px 12px',
                      borderRadius: 12,
                      background: msg.role === 'user' ? '#2d9d5a' : '#2a2a3a',
                      color: '#fff',
                      fontSize: 13,
                      lineHeight: 1.4,
                      wordBreak: 'break-word',
                    }}
                  >
                    {msg.content}
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
