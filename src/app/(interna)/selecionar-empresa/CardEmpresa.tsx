'use client'

import { Avatar, Button, Card, Group, Stack, Text } from '@mantine/core'
import { IconArrowRight } from '@tabler/icons-react'
import {
  EmpresaItem,
  deveExibirLinhaLocalizacao,
  deveExibirLogoNoAvatar,
  formatarCnpj,
  obterIniciaisEmpresa,
  obterLocalizacaoEmpresa,
  obterNomeExibicaoEmpresa,
} from './selecaoEmpresa.utils'

interface CardEmpresaProps {
  empresa: EmpresaItem
  onAcessar: (empresa: EmpresaItem) => void
  ocultarLocalizacao?: boolean
}

export default function CardEmpresa({ empresa, onAcessar, ocultarLocalizacao }: CardEmpresaProps) {
  const nomeExibicao = obterNomeExibicaoEmpresa(empresa)
  const exibirLogo = deveExibirLogoNoAvatar(empresa)
  const exibirLocalizacao = deveExibirLinhaLocalizacao(empresa, ocultarLocalizacao ?? false)
  const razaoSocialDiferente = empresa.razaoSocial.trim() !== nomeExibicao.trim()

  const handleAcessarClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onAcessar(empresa)
  }

  return (
    <Card
      withBorder
      style={{ cursor: 'pointer' }}
      onClick={() => onAcessar(empresa)}
    >
      <Stack gap="sm">
        <Group gap="sm" wrap="nowrap">
          <Avatar src={exibirLogo ? empresa.logo : undefined} radius="xl" size="lg" color="blue">
            {obterIniciaisEmpresa(empresa)}
          </Avatar>
          <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
            <Text fw={600} size="lg" truncate>
              {nomeExibicao}
            </Text>
            {razaoSocialDiferente && (
              <Text size="sm" c="dimmed" truncate>
                {empresa.razaoSocial}
              </Text>
            )}
          </Stack>
        </Group>

        <Text size="sm" c="dimmed">
          CNPJ: {formatarCnpj(empresa.cnpj)}
        </Text>

        {exibirLocalizacao && (
          <Text size="sm" c="dimmed">
            {obterLocalizacaoEmpresa(empresa)}
          </Text>
        )}

        <Button
          fullWidth
          variant="light"
          rightSection={<IconArrowRight size={16} />}
          onClick={handleAcessarClick}
        >
          Acessar empresa
        </Button>
      </Stack>
    </Card>
  )
}
