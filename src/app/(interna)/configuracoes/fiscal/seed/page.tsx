'use client'

import { useEffect, useState } from 'react'
import {
  Title, Text, Card, Stack, Checkbox, Group, Button, SimpleGrid, Loader, ThemeIcon,
} from '@mantine/core'
import { IconHash } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'

import { usePerfilGuard } from '@/hooks/usePerfilGuard'
import {
  useContagemSeedFiscal,
  useDispararSeedFiscal,
  montarTabelasSeedPayload,
  botaoSeedHabilitado,
  classificarResultadoSeedPorTabela,
  deveExibirDadosParciaisSeed,
  type CadastroFiscal,
} from '@/data/hooks/fiscal/useSeedFiscal'

const CONTAGEM_ERRO_NOTIFICATION_ID = 'seed-fiscal-contagem-erro'

const CADASTROS: { chave: CadastroFiscal; label: string; campoContagem: 'ncm' | 'cfop' | 'cest' }[] = [
  { chave: 'NCM', label: 'NCM', campoContagem: 'ncm' },
  { chave: 'CFOP', label: 'CFOP', campoContagem: 'cfop' },
  { chave: 'CEST', label: 'CEST', campoContagem: 'cest' },
]

export default function SeedFiscalPage() {
  usePerfilGuard('ADMIN')

  useEffect(() => { document.title = 'Vizor - Configurações > Seed Fiscal' }, [])

  const [selecionados, setSelecionados] = useState<Set<CadastroFiscal>>(new Set())

  const { data: contagem, isLoading, isError, error, refetch } = useContagemSeedFiscal()
  const disparar = useDispararSeedFiscal()

  const statusContagem = (error as any)?.response?.status

  // Requirement 4.3 — notificação de erro de contagem disparada somente após o carregamento terminar.
  useEffect(() => {
    if (isLoading || !isError) return

    if (statusContagem === 403) {
      notifications.show({
        title: 'Acesso negado',
        message: 'Permissão insuficiente para consultar o seed fiscal',
        color: 'red',
      })
      return
    }

    notifications.show({
      id: CONTAGEM_ERRO_NOTIFICATION_ID,
      title: 'Erro',
      message: (error as any)?.response?.data?.message || 'Falha ao consultar contagem',
      color: 'red',
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isError, statusContagem])

  // Requirement 4.3, 5.7 — nunca exibir contagem parcial/obsoleta em caso de erro (inclusive 403).
  const exibirContagem = !isError

  function toggleTabela(tabela: CadastroFiscal) {
    setSelecionados((prev) => {
      const next = new Set(prev)
      if (next.has(tabela)) next.delete(tabela)
      else next.add(tabela)
      return next
    })
  }

  function handleDisparar() {
    const payload = montarTabelasSeedPayload(selecionados)

    disparar.mutate(payload, {
      onSuccess: (resultado) => {
        for (const tabela of Object.keys(resultado) as CadastroFiscal[]) {
          const classificado = classificarResultadoSeedPorTabela(resultado[tabela])
          notifications.show({
            title: tabela,
            message: classificado.mensagem,
            color: classificado.tipo === 'sucesso' ? 'green' : 'red',
          })
        }

        // Requirement 5.6 — limpa notificação de erro de contagem anterior e refaz a busca.
        notifications.hide(CONTAGEM_ERRO_NOTIFICATION_ID)
        refetch()
      },
      onError: (err: any) => {
        const status = err?.response?.status

        if (status === 403) {
          notifications.show({
            title: 'Acesso negado',
            message: 'Permissão insuficiente para disparar o seed fiscal',
            color: 'red',
          })
          return
        }

        notifications.show({
          title: 'Erro',
          message: err?.response?.data?.message || 'Falha ao disparar seed',
          color: 'red',
        })
      },
    })
  }

  const botaoDesabilitado = !botaoSeedHabilitado(selecionados) || disparar.isPending

  return (
    <div className="max-w-[800px] mx-auto">
      <div className="mb-8">
        <Title order={2} fw={700}>Seed Fiscal</Title>
        <Text size="sm" c="dimmed">
          Popule os cadastros fiscais globais (NCM, CFOP, CEST) a partir da fonte externa
        </Text>
      </div>

      <Card shadow="xs" radius="md" p="lg" mb="md">
        <Text size="sm" fw={600} mb="md">Contagem atual</Text>
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          {CADASTROS.map(({ chave, label, campoContagem }) => (
            <Card key={chave} withBorder>
              <Group justify="space-between">
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={600}>{label}</Text>
                  {isLoading ? (
                    <Loader size="sm" mt={4} />
                  ) : exibirContagem ? (
                    <Text size="xl" fw={700}>{contagem?.[campoContagem] ?? '—'}</Text>
                  ) : (
                    <Text size="xl" fw={700} c="dimmed">—</Text>
                  )}
                </div>
                <ThemeIcon color="blue" variant="light" size={40} radius="md">
                  <IconHash size={20} />
                </ThemeIcon>
              </Group>
            </Card>
          ))}
        </SimpleGrid>
      </Card>

      <Card shadow="xs" radius="md" p="lg">
        <Stack gap="md">
          <Text size="sm" fw={600}>Selecione os cadastros a popular</Text>

          <Group>
            {CADASTROS.map(({ chave, label }) => (
              <Checkbox
                key={chave}
                label={label}
                checked={selecionados.has(chave)}
                onChange={() => toggleTabela(chave)}
              />
            ))}
          </Group>

          <Group justify="space-between" align="flex-end" mt="md">
            <Text size="xs" c="dimmed" maw={400}>
              O processamento pode levar até 60 segundos por tabela selecionada.
            </Text>
            <Button
              disabled={botaoDesabilitado}
              loading={disparar.isPending}
              onClick={handleDisparar}
            >
              Disparar Seed
            </Button>
          </Group>
        </Stack>
      </Card>
    </div>
  )
}
