'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Card, Radio, Text, LoadingOverlay, Group, Button, Stack } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { usePerfilGuard } from '@/hooks/usePerfilGuard'
import { useConfiguracaoComissao, useAlterarConfiguracaoComissao } from '@/data/hooks/portal-representante/useConfiguracaoComissao'
import { criterioComissaoOptions, CriterioComissao } from '@/data/hooks/portal-representante/types'

export default function ConfiguracaoComissaoPage() {
  usePerfilGuard(['ADMIN', 'SUPER_ADMIN'])
  useEffect(() => { document.title = 'Portal Representante - Configuração de Comissão' }, [])

  const router = useRouter()

  const { data, isLoading } = useConfiguracaoComissao()
  const alterarComissao = useAlterarConfiguracaoComissao()

  const [criterioLocal, setCriterioLocal] = useState<CriterioComissao | ''>('')
  const criterioAnterior = useRef<CriterioComissao | undefined>(undefined)

  useEffect(() => {
    if (data?.criterio) {
      setCriterioLocal(data.criterio)
    }
  }, [data?.criterio])

  function handleAlterarCriterio(novoCriterio: CriterioComissao) {
    if (novoCriterio === criterioLocal) return

    criterioAnterior.current = criterioLocal as CriterioComissao
    setCriterioLocal(novoCriterio)

    alterarComissao.mutate({ criterio: novoCriterio }, {
      onError: (err: any) => {
        setCriterioLocal(criterioAnterior.current!) // rollback
        if (err?.response?.status === 400 && err?.response?.data?.message?.toLowerCase().includes('empresa')) {
          router.replace('/selecionar-empresa')
          return
        }
        if (err?.response?.status === 403) {
          notifications.show({ title: 'Acesso negado', message: 'Apenas administradores podem acessar esta funcionalidade', color: 'red' })
          return
        }
        notifications.show({
          title: 'Erro',
          message: err?.response?.data?.message || 'Não foi possível alterar o critério de comissão. Tente novamente.',
          color: 'red',
        })
      },
      onSuccess: () => {
        notifications.show({
          title: 'Sucesso',
          message: 'Critério de comissão atualizado',
          color: 'green',
        })
      },
    })
  }

  return (
    <Stack gap="md">
      <Text size="xs" c="dimmed">Portal Representante / Configuração de Comissão</Text>
      <Text size="xl" fw={600}>Configuração de Comissão</Text>

      <Card withBorder pos="relative">
        <LoadingOverlay visible={isLoading} />

        <Stack gap="lg">
          <Text size="sm" fw={500}>
            Critério de creditamento de comissão
          </Text>
          <Text size="sm" c="dimmed">
            Selecione o momento em que a comissão será creditada ao representante.
          </Text>

          <Radio.Group
            value={criterioLocal}
            onChange={(value) => handleAlterarCriterio(value as CriterioComissao)}
          >
            <Stack gap="md">
              {criterioComissaoOptions.map((opcao) => (
                <Radio
                  key={opcao.value}
                  value={opcao.value}
                  label={opcao.label}
                  description={opcao.description}
                  disabled={alterarComissao.isPending}
                />
              ))}
            </Stack>
          </Radio.Group>
        </Stack>
      </Card>
    </Stack>
  )
}
