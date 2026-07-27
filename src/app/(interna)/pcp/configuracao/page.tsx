'use client'

import { useEffect, useState } from 'react'
import { Title, Stack, Card, Group, Button, Text, Switch, Loader, Center, Alert, Divider } from '@mantine/core'
import { IconArrowLeft, IconSettings, IconLock } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'

interface ConfiguracaoPcp {
  usaControleBobina: boolean
  usaLoteCorrespondencia: boolean
  usaEstoqueTerceiro: boolean
  usaPaletizacaoDinamica: boolean
  usaControleApara: boolean
  usaControleUmidade: boolean
  usaZonaSegregada: boolean
  usaCoresStatusProgramacao: boolean
}

/** Descrição de cada flag, exibida abaixo do switch — mesmo texto explicativo
 * de todas, exceto a de cores que tem nota adicional sobre o avulso. */
const DESCRICOES: Record<keyof ConfiguracaoPcp, string> = {
  usaControleBobina: 'Habilita o controle de bobinas de material em processo rotativo (geração de bobina filha ao consumir parcialmente).',
  usaLoteCorrespondencia: 'Habilita o controle de correspondência de lote entre materiais e produção.',
  usaEstoqueTerceiro: 'Habilita a consulta de estoque de terceiros (material de clientes armazenado no CD).',
  usaPaletizacaoDinamica: 'Habilita o cálculo dinâmico de distribuição de itens em paletes.',
  usaControleApara: 'Habilita o controle de apara (sobra de material) na produção.',
  usaControleUmidade: 'Habilita o controle de umidade de materiais sensíveis.',
  usaZonaSegregada: 'Habilita zonas segregadas de armazenagem para materiais específicos.',
  usaCoresStatusProgramacao: 'Habilita as cores de status (pendente, em andamento, pausada, concluída, atrasada) na fila do painel de Programação, nos dois layouts (Grid e Detalhado). A cor de OP Avulsa (rosa) é fixa e não é afetada por esta opção.',
}

const LABELS: Record<keyof ConfiguracaoPcp, string> = {
  usaControleBobina: 'Controle de Bobina',
  usaLoteCorrespondencia: 'Lote de Correspondência',
  usaEstoqueTerceiro: 'Estoque de Terceiros',
  usaPaletizacaoDinamica: 'Paletização Dinâmica',
  usaControleApara: 'Controle de Apara',
  usaControleUmidade: 'Controle de Umidade',
  usaZonaSegregada: 'Zona Segregada',
  usaCoresStatusProgramacao: 'Cores de Status no Painel de Programação',
}

export default function ConfiguracaoPcpPage() {
  useEffect(() => { document.title = 'PCP - Configuração' }, [])
  const router = useRouter()

  const [config, setConfig] = useState<ConfiguracaoPcp | null>(null)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState<string | null>(null)
  const [semPermissao, setSemPermissao] = useState(false)

  async function carregar() {
    setLoading(true)
    try {
      const res = await api.get('/pcp/configuracao')
      setConfig(res.data.configuracao)
    } catch {
      notifications.show({ title: 'Erro', message: 'Erro ao carregar configuração', color: 'red' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { carregar() }, [])

  async function alterar(campo: keyof ConfiguracaoPcp, valor: boolean) {
    if (!config) return
    // Atualização otimista, com rollback em erro.
    const valorAnterior = config[campo]
    setConfig({ ...config, [campo]: valor })
    setSalvando(campo)
    try {
      await api.patch('/pcp/configuracao', { [campo]: valor })
      notifications.show({ title: 'Configuração atualizada', message: `${LABELS[campo]} ${valor ? 'habilitado' : 'desabilitado'}`, color: 'green' })
    } catch (err: any) {
      setConfig({ ...config, [campo]: valorAnterior })
      if (err?.response?.status === 403) {
        setSemPermissao(true)
        notifications.show({ title: 'Sem permissão', message: 'Apenas administradores podem alterar configurações PCP', color: 'red' })
      } else {
        notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Erro ao salvar configuração', color: 'red' })
      }
    } finally {
      setSalvando(null)
    }
  }

  if (loading) return <Center py="xl"><Loader /></Center>

  const camposDeCores: Array<keyof ConfiguracaoPcp> = ['usaCoresStatusProgramacao']
  const outrosCampos: Array<keyof ConfiguracaoPcp> = [
    'usaControleBobina', 'usaLoteCorrespondencia', 'usaEstoqueTerceiro',
    'usaPaletizacaoDinamica', 'usaControleApara', 'usaControleUmidade', 'usaZonaSegregada',
  ]

  return (
    <Stack gap="md">
      <Group>
        <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={() => router.push('/pcp')}>Voltar</Button>
        <Title order={3}>Configuração PCP</Title>
      </Group>

      {semPermissao && (
        <Alert color="orange" icon={<IconLock size={16} />}>
          Apenas administradores podem alterar estas configurações. As alterações acima não foram salvas.
        </Alert>
      )}

      <Card shadow="sm" padding="lg">
        <Group gap="sm" mb="md">
          <IconSettings size={20} />
          <Text fw={600}>Painel de Programação</Text>
        </Group>

        {config && camposDeCores.map((campo) => (
          <Stack key={campo} gap={4} mb="md">
            <Switch
              label={LABELS[campo]}
              checked={config[campo]}
              onChange={(e) => alterar(campo, e.currentTarget.checked)}
              disabled={salvando === campo}
              size="md"
            />
            <Text size="xs" c="dimmed" ml={44}>{DESCRICOES[campo]}</Text>
          </Stack>
        ))}
      </Card>

      <Card shadow="sm" padding="lg">
        <Group gap="sm" mb="md">
          <IconSettings size={20} />
          <Text fw={600}>Outros Recursos</Text>
        </Group>
        <Text size="xs" c="dimmed" mb="md">
          Recursos avançados do módulo PCP, habilitados conforme a necessidade da operação.
        </Text>

        <Stack gap="md">
          {config && outrosCampos.map((campo, idx) => (
            <div key={campo}>
              {idx > 0 && <Divider mb="md" />}
              <Stack gap={4}>
                <Switch
                  label={LABELS[campo]}
                  checked={config[campo]}
                  onChange={(e) => alterar(campo, e.currentTarget.checked)}
                  disabled={salvando === campo}
                  size="md"
                />
                <Text size="xs" c="dimmed" ml={44}>{DESCRICOES[campo]}</Text>
              </Stack>
            </div>
          ))}
        </Stack>
      </Card>
    </Stack>
  )
}
