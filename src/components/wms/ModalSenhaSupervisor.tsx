'use client'

import { useState } from 'react'
import { Modal, TextInput, PasswordInput, Button, Alert, Stack } from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'

interface ModalSenhaSupervisorProps {
  opened: boolean
  onClose: () => void
  onConfirm: (credenciais: { usuario: string; senha: string }) => Promise<void>
}

export default function ModalSenhaSupervisor({ opened, onClose, onConfirm }: ModalSenhaSupervisorProps) {
  const [usuario, setUsuario] = useState('')
  const [senha, setSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setLoading(true)

    try {
      await onConfirm({ usuario, senha })
      setUsuario('')
      setSenha('')
      onClose()
    } catch (err: any) {
      setErro(err?.response?.data?.message || 'Credenciais inválidas')
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    setUsuario('')
    setSenha('')
    setErro(null)
    onClose()
  }

  return (
    <Modal opened={opened} onClose={handleClose} title="Autorização do Supervisor" centered>
      <form onSubmit={handleSubmit} autoComplete="off">
        <Stack>
          {erro && (
            <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />}>
              {erro}
            </Alert>
          )}

          {/*
            Autorização de supervisor exige digitação explícita a cada uso —
            nunca deve vir pré-preenchida pelo autocomplete/gerenciador de
            senhas do navegador, mesmo que o usuário logado tenha salvo suas
            próprias credenciais antes. name/autoComplete "falsos" e
            readOnly+onFocus são o padrão para desencorajar o autofill do
            Chrome de forma consistente entre navegadores.
          */}
          <TextInput
            label="Usuário"
            placeholder="Login do supervisor"
            name="supervisor-usuario-nao-autocompletar"
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            value={usuario}
            onChange={(e) => setUsuario(e.currentTarget.value)}
            required
            disabled={loading}
          />

          <PasswordInput
            label="Senha"
            placeholder="Senha do supervisor"
            name="supervisor-senha-nao-autocompletar"
            autoComplete="new-password"
            data-1p-ignore
            data-lpignore="true"
            value={senha}
            onChange={(e) => setSenha(e.currentTarget.value)}
            required
            disabled={loading}
          />

          <Button type="submit" loading={loading} fullWidth>
            Autorizar
          </Button>
        </Stack>
      </form>
    </Modal>
  )
}
