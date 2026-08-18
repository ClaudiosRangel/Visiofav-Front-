'use client'

import { useEffect, useState } from 'react'
import { Title, Text, Card, Stack, TextInput, Switch, Button, Group, NumberInput, PasswordInput } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

interface ConfigSmtp {
  id?: string
  host: string
  porta: number
  usuario: string
  usarTls: boolean
  emailFrom: string | null
  temSenha?: boolean
}

export default function ConfigEmailPage() {
  useEffect(() => { document.title = 'Vizor - Configurações > Email/SMTP' }, [])

  const qc = useQueryClient()
  const [host, setHost] = useState('')
  const [porta, setPorta] = useState<number>(587)
  const [usuario, setUsuario] = useState('')
  const [senha, setSenha] = useState('')
  const [usarTls, setUsarTls] = useState(true)
  const [emailFrom, setEmailFrom] = useState('')
  const [emailTeste, setEmailTeste] = useState('')

  const { data: config, isLoading } = useQuery<{ data: ConfigSmtp | null }>({
    queryKey: ['config-smtp'],
    queryFn: async () => { const { data } = await api.get('/config-smtp'); return data },
  })

  useEffect(() => {
    if (config?.data) {
      setHost(config.data.host || '')
      setPorta(config.data.porta || 587)
      setUsuario(config.data.usuario || '')
      setUsarTls(config.data.usarTls ?? true)
      setEmailFrom(config.data.emailFrom || '')
      // Não preencher senha — indicamos que já existe
    }
  }, [config])

  const salvarMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/config-smtp', {
        host,
        porta,
        usuario,
        senha,
        usarTls,
        emailFrom: emailFrom || null,
      })
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['config-smtp'] })
      notifications.show({ title: 'Sucesso', message: 'Configuração SMTP salva', color: 'green' })
    },
    onError: (err: any) => {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao salvar', color: 'red' })
    },
  })

  const testarMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/config-smtp/testar', { emailDestino: emailTeste || usuario })
      return data
    },
    onSuccess: (data: any) => {
      notifications.show({ title: 'Sucesso', message: data.message || 'Email de teste enviado', color: 'green' })
    },
    onError: (err: any) => {
      notifications.show({ title: 'Falha', message: err?.response?.data?.message || 'Erro ao enviar teste', color: 'red' })
    },
  })

  function handleSalvar() {
    if (!host || !usuario || !senha) {
      notifications.show({ title: 'Erro', message: 'Preencha Host, Usuário e Senha', color: 'red' })
      return
    }
    salvarMutation.mutate()
  }

  function handleTestar() {
    testarMutation.mutate()
  }

  return (
    <div className="max-w-[800px] mx-auto">
      <div className="mb-8">
        <Title order={2} fw={700}>Email / SMTP</Title>
        <Text size="sm" c="dimmed">Configure o servidor de e-mail para envio de documentos fiscais (CT-e, NF-e, etc.)</Text>
      </div>

      <Card shadow="xs" radius="md" p="lg">
        <Stack gap="md">
          <TextInput
            label="Host SMTP"
            placeholder="smtp.gmail.com"
            value={host}
            onChange={(e) => setHost(e.target.value)}
          />
          <NumberInput
            label="Porta"
            value={porta}
            onChange={(v) => setPorta(typeof v === 'number' ? v : 587)}
            min={1}
            max={65535}
          />
          <TextInput
            label="Usuário"
            placeholder="seu-email@dominio.com"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
          />
          <PasswordInput
            label="Senha"
            placeholder={config?.data?.temSenha ? '••••••• (já configurada)' : 'Informe a senha'}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
          <Switch
            label="Usar TLS"
            checked={usarTls}
            onChange={(e) => setUsarTls(e.currentTarget.checked)}
          />
          <TextInput
            label="E-mail Remetente (From)"
            description="Se vazio, usa o campo Usuário como remetente"
            placeholder="noreply@empresa.com.br"
            value={emailFrom}
            onChange={(e) => setEmailFrom(e.target.value)}
          />

          <Group justify="flex-end" mt="md">
            <Button onClick={handleSalvar} loading={salvarMutation.isPending}>Salvar</Button>
          </Group>

          <Text size="sm" fw={600} mt="md">Teste de Envio</Text>
          <TextInput
            label="E-mail de destino"
            description="Deixe vazio para enviar para o próprio usuário SMTP"
            placeholder="teste@empresa.com"
            value={emailTeste}
            onChange={(e) => setEmailTeste(e.target.value)}
          />
          <Group justify="flex-start">
            <Button variant="light" onClick={handleTestar} loading={testarMutation.isPending}>
              Enviar Email de Teste
            </Button>
          </Group>
        </Stack>
      </Card>
    </div>
  )
}
