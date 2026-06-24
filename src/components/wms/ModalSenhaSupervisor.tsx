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
      <form onSubmit={handleSubmit}>
        <Stack>
          {erro && (
            <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />}>
              {erro}
            </Alert>
          )}

          <TextInput
            label="Usuário"
            placeholder="Login do supervisor"
            value={usuario}
            onChange={(e) => setUsuario(e.currentTarget.value)}
            required
            disabled={loading}
          />

          <PasswordInput
            label="Senha"
            placeholder="Senha do supervisor"
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
