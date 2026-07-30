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
  // readOnly até o foco: o Chrome ignora autocomplete="off" na maioria dos
  // casos para credenciais de login, mas respeita `readonly` — removido no
  // primeiro foco do campo, então o usuário digita normalmente sem o
  // navegador oferecer autocompletar com uma conta salva.
  const [usuarioReadOnly, setUsuarioReadOnly] = useState(true)
  const [senhaReadOnly, setSenhaReadOnly] = useState(true)

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
    setUsuarioReadOnly(true)
    setSenhaReadOnly(true)
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
            nunca deve vir pré-preenchida nem sugerir contas salvas do
            gerenciador de senhas do navegador. autoComplete="off"/"new-password"
            sozinhos NÃO bastam: o Chrome ignora esses valores para campos que
            reconhece como login (usuário + senha na mesma tela) e mostra a
            lista de contas salvas mesmo assim. O padrão que funciona de forma
            consistente é manter os campos `readOnly` até o primeiro foco —
            sem foco anterior, o navegador não injeta o dropdown de contas;
            ao focar, removemos o readOnly e o campo se comporta normalmente.
          */}
          <TextInput
            label="Usuário"
            placeholder="Login do supervisor"
            name="supervisor-usuario-nao-autocompletar"
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            readOnly={usuarioReadOnly}
            onFocus={() => setUsuarioReadOnly(false)}
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
            readOnly={senhaReadOnly}
            onFocus={() => setSenhaReadOnly(false)}
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
