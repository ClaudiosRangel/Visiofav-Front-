'use client'

import { useEffect, useState } from 'react'
import { Title, Text, Card, Stack, Group, Button, TextInput, Textarea, Select, MultiSelect, Checkbox, Alert } from '@mantine/core'
import { IconSend, IconAlertCircle } from '@tabler/icons-react'
import { useNotificacoes } from '@/data/hooks/useNotificacoes'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'

export default function AdminNotificacoesPage() {
  useEffect(() => { document.title = 'Vizor - Admin > Enviar Notificação' }, [])

  const [tipo, setTipo] = useState<string>('INFORMACAO')
  const [titulo, setTitulo] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [paraTodasEmpresas, setParaTodasEmpresas] = useState(false)
  const [empresaIds, setEmpresaIds] = useState<string[]>([])
  const [empresasDisponiveis, setEmpresasDisponiveis] = useState<{ value: string; label: string }[]>([])
  const [loadingEmpresas, setLoadingEmpresas] = useState(false)

  const { useEnviarAdmin } = useNotificacoes()
  const enviarAdmin = useEnviarAdmin()

  useEffect(() => {
    setLoadingEmpresas(true)
    api.get('/empresas').then(({ data }) => {
      const empresas = (data.data || data || []).map((e: any) => ({
        value: e.id,
        label: e.nomeFantasia || e.razaoSocial || e.cnpj,
      }))
      setEmpresasDisponiveis(empresas)
    }).catch(() => {}).finally(() => setLoadingEmpresas(false))
  }, [])

  // Verifica se é admin
  const [isAdmin, setIsAdmin] = useState(false)
  useEffect(() => {
    const user = localStorage.getItem('visiofab-wms-user')
    if (user) {
      try {
        const parsed = JSON.parse(user)
        setIsAdmin(parsed.perfil === 'SUPER_ADMIN')
      } catch {}
    }
  }, [])

  const handleEnviar = () => {
    if (!titulo.trim() || !mensagem.trim()) {
      notifications.show({ title: 'Campos obrigatórios', message: 'Preencha título e mensagem', color: 'red' })
      return
    }
    if (!paraTodasEmpresas && empresaIds.length === 0) {
      notifications.show({ title: 'Destinatários', message: 'Selecione ao menos uma empresa ou marque "Todas as empresas"', color: 'red' })
      return
    }

    enviarAdmin.mutate(
      {
        tipo: tipo as 'ALERTA' | 'INFORMACAO' | 'NOVIDADE' | 'RECADO',
        titulo,
        mensagem,
        paraTodasEmpresas,
        empresaIds: paraTodasEmpresas ? undefined : empresaIds,
      },
      {
        onSuccess: (data: any) => {
          notifications.show({
            title: 'Enviada',
            message: `Notificação enviada para ${data.totalDestinatarios} usuário(s)`,
            color: 'green',
          })
          setTitulo('')
          setMensagem('')
          setEmpresaIds([])
        },
        onError: (err: any) => {
          notifications.show({ title: 'Erro', message: err?.response?.data?.error || 'Erro ao enviar', color: 'red' })
        },
      }
    )
  }

  if (!isAdmin) {
    return (
      <div className="max-w-[800px] mx-auto">
        <Alert color="red" icon={<IconAlertCircle size={16} />} title="Acesso negado">
          Esta página é exclusiva para administradores Vizor (SUPER_ADMIN).
        </Alert>
      </div>
    )
  }

  return (
    <div className="max-w-[800px] mx-auto">
      <div className="mb-6">
        <Title order={2} fw={700}>Enviar Notificação (Admin)</Title>
        <Text size="sm" c="dimmed">Envie alertas, informações e novidades para as empresas</Text>
      </div>

      <Card shadow="xs" radius="md" p="lg">
        <Stack gap="md">
          <Select
            label="Tipo"
            data={[
              { value: 'ALERTA', label: '🔴 Alerta' },
              { value: 'INFORMACAO', label: '🔵 Informação' },
              { value: 'NOVIDADE', label: '🟢 Novidade' },
              { value: 'RECADO', label: '🟠 Recado' },
            ]}
            value={tipo}
            onChange={(v) => v && setTipo(v)}
            required
          />

          <TextInput
            label="Título"
            placeholder="Assunto da notificação"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            maxLength={200}
            required
          />

          <Textarea
            label="Mensagem"
            placeholder="Conteúdo completo da notificação"
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            minRows={5}
            required
          />

          <Checkbox
            label="Enviar para TODAS as empresas"
            checked={paraTodasEmpresas}
            onChange={(e) => setParaTodasEmpresas(e.currentTarget.checked)}
          />

          {!paraTodasEmpresas && (
            <MultiSelect
              label="Empresas"
              placeholder={loadingEmpresas ? 'Carregando...' : 'Selecione as empresas destinatárias'}
              data={empresasDisponiveis}
              value={empresaIds}
              onChange={setEmpresaIds}
              searchable
              required={!paraTodasEmpresas}
            />
          )}

          <Group justify="flex-end" mt="md">
            <Button
              leftSection={<IconSend size={16} />}
              onClick={handleEnviar}
              loading={enviarAdmin.isPending}
            >
              Enviar Notificação
            </Button>
          </Group>
        </Stack>
      </Card>
    </div>
  )
}
