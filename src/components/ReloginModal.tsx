'use client'

/**
 * ReloginModal — "Sua sessão expirou": pede e-mail e senha POR CIMA da tela atual, renova o token
 * (login + seleção da mesma empresa) e devolve o token ao interceptor do `api`, que refaz a
 * requisição que falhou. Nada do que o usuário digitou na tela é perdido.
 *
 * Exige o MESMO usuário da sessão (evita trocar de pessoa no meio de um trabalho em andamento).
 * "Sair" desiste: o interceptor segue o fluxo antigo (limpa a sessão e vai para o login).
 */

import { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { Alert, Button, Group, Modal, PasswordInput, Stack, Text, TextInput } from '@mantine/core'
import { IconLock } from '@tabler/icons-react'

import { registrarRelogin } from '@/lib/relogin'
import { getEmpresaRaw, getUserRaw, setAuthToken, setRefreshToken, setUserRaw } from '@/lib/authStorage'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333/api'

function lerJson(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null
  try {
    const v = JSON.parse(raw)
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : null
  } catch {
    return null
  }
}

export default function ReloginModal() {
  const [aberto, setAberto] = useState(false)
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [entrando, setEntrando] = useState(false)
  const promessa = useRef<{ resolve: (t: string) => void; reject: (e: Error) => void } | null>(null)

  useEffect(
    () =>
      registrarRelogin(
        () =>
          new Promise<string>((resolve, reject) => {
            promessa.current = { resolve, reject }
            const usuario = lerJson(getUserRaw())
            if (typeof usuario?.email === 'string') setEmail(usuario.email)
            setSenha('')
            setErro(null)
            setAberto(true)
          }),
      ),
    [],
  )

  const entrar = async () => {
    if (!email.trim() || !senha) {
      setErro('Informe e-mail e senha.')
      return
    }
    setEntrando(true)
    setErro(null)
    try {
      const anterior = lerJson(getUserRaw())
      const { data } = await axios.post(`${API}/auth/login`, { email: email.trim(), senha })
      if (anterior?.id && data?.usuario?.id && anterior.id !== data.usuario.id) {
        setErro('Entre com o mesmo usuário que estava usando nesta tela.')
        return
      }
      let token: string = data.token
      let refresh: string | undefined = data.refreshToken
      // Volta para a mesma empresa da tela (o login sozinho não seleciona empresa).
      const empresa = lerJson(getEmpresaRaw())
      if (typeof empresa?.id === 'string') {
        const sel = await axios.post(
          `${API}/empresas/${empresa.id}/selecionar`,
          {},
          { headers: { Authorization: `Bearer ${token}` } },
        )
        if (sel.data?.token) token = sel.data.token
        if (sel.data?.refreshToken) refresh = sel.data.refreshToken
      }
      setAuthToken(token)
      if (refresh) setRefreshToken(refresh)
      if (data?.usuario) setUserRaw(JSON.stringify({ ...(anterior ?? {}), ...data.usuario, email: email.trim() }))
      setAberto(false)
      setSenha('')
      promessa.current?.resolve(token)
      promessa.current = null
    } catch {
      setErro('E-mail ou senha inválidos.')
    } finally {
      setEntrando(false)
    }
  }

  const sair = () => {
    setAberto(false)
    promessa.current?.reject(new Error('Sessão expirada'))
    promessa.current = null
  }

  return (
    <Modal
      opened={aberto}
      onClose={() => undefined}
      withCloseButton={false}
      closeOnClickOutside={false}
      closeOnEscape={false}
      centered
      zIndex={10000}
      title={
        <Group gap="xs">
          <IconLock size={18} />
          <Text fw={600}>Sua sessão expirou</Text>
        </Group>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void entrar()
        }}
      >
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            Entre de novo para continuar. O que você digitou nesta tela não será perdido.
          </Text>
          {erro && (
            <Alert color="red" variant="light">
              {erro}
            </Alert>
          )}
          <TextInput label="E-mail" value={email} onChange={(e) => setEmail(e.currentTarget.value)} autoComplete="username" />
          <PasswordInput
            label="Senha"
            value={senha}
            onChange={(e) => setSenha(e.currentTarget.value)}
            autoComplete="current-password"
            data-autofocus
          />
          <Group justify="space-between" mt="xs">
            <Button variant="subtle" color="gray" onClick={sair} disabled={entrando}>
              Sair do sistema
            </Button>
            <Button type="submit" loading={entrando}>
              Entrar e continuar
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}
