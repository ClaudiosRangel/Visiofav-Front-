'use client'

/**
 * Aviso de bloqueio financeiro para o usuário de uma empresa CLIENTE do Vizor
 * (fora do painel do SUPER_ADMIN). Reage ao `Status_Financeiro` da empresa da
 * sessão. (Req 6)
 *
 * Comportamento (Req 6.1, 6.2, 6.5):
 *  - `SOMENTE_LEITURA` → banner (Alert) de somente-visualização por pendência
 *    financeira; a aplicação continua acessível, mas só para leitura.
 *  - `INATIVADO` → tela/aviso de acesso impedido (bloqueia o conteúdo abaixo).
 *  - `ATIVO` (ou status indefinido) → não renderiza nada.
 *
 * FONTE DO STATUS
 * ---------------
 * O frontend hoje NÃO expõe o `statusFinanceiro` da empresa da sessão de forma
 * consolidada (o JWT carrega `perfil`/`empresaId`, e `useEmpresaAtual` só lê
 * `usaWms`). Portanto, o componente aceita o status por DUAS vias, nesta
 * prioridade:
 *   1. prop `status` — via de uso principal e testável; quem monta o componente
 *      injeta o status já conhecido da sessão.
 *   2. fallback opcional: quando `status` não é passado e `buscarDaSessao` é
 *      `true`, consulta `GET /empresas/minha` (rota da empresa da sessão) e usa
 *      o campo `statusFinanceiro` SE presente. Se o campo ainda não existir na
 *      resposta do backend, o componente se comporta como `ATIVO` (não exibe
 *      nada) — degradação segura, sem quebrar telas existentes.
 *
 * As mensagens são amigáveis e nunca expõem códigos técnicos (Req 6.3, 6.4). Ao
 * receber um HTTP 403 do backend numa operação, use `traduzirErroApi` para
 * exibir a mensagem da API — este componente cobre a sinalização de estado
 * persistente (banner/tela); o 403 pontual é tratado nas mutations via
 * `traduzirErroApi`.
 */

import { useQuery } from '@tanstack/react-query'
import { Alert, Center, Paper, Stack, Text, ThemeIcon, Title } from '@mantine/core'
import { IconEye, IconLock } from '@tabler/icons-react'
import { api } from '@/lib/api'
import type { StatusFinanceiro } from '@/lib/financeiro-vizor/types'

interface BloqueioFinanceiroAvisoProps {
  /**
   * Status financeiro da empresa da sessão. Quando informado, é a fonte de
   * verdade (via de uso principal). Se ausente e `buscarDaSessao` for `true`,
   * o componente tenta descobrir o status via `GET /empresas/minha`.
   */
  status?: StatusFinanceiro
  /**
   * Quando `true` (default) e `status` não é passado, busca o status da empresa
   * da sessão em `GET /empresas/minha`. Passe `false` para desativar a busca
   * (ex.: em testes ou quando o status é sempre injetado por prop).
   */
  buscarDaSessao?: boolean
}

/** Forma parcial da resposta de `GET /empresas/minha` que nos interessa. */
interface EmpresaMinhaComStatus {
  statusFinanceiro?: StatusFinanceiro
}

/**
 * Resolve o status efetivo a partir da prop e/ou da sessão.
 * A prop tem prioridade; o resultado da query só é usado quando a prop é
 * `undefined`. Retorna `undefined` enquanto não há informação (não renderiza).
 */
export function resolverStatusBloqueio(
  statusProp: StatusFinanceiro | undefined,
  statusSessao: StatusFinanceiro | undefined,
): StatusFinanceiro | undefined {
  return statusProp ?? statusSessao
}

export function BloqueioFinanceiroAviso({
  status,
  buscarDaSessao = true,
}: BloqueioFinanceiroAvisoProps) {
  // Só busca da sessão quando o status não foi injetado por prop e a busca está
  // habilitada — evita requisição desnecessária quem já conhece o status.
  const habilitarQuery = status === undefined && buscarDaSessao

  const { data } = useQuery<EmpresaMinhaComStatus>({
    queryKey: ['empresa-minha-status-financeiro'],
    queryFn: async () => {
      const resp = await api.get<EmpresaMinhaComStatus>('/empresas/minha')
      return resp.data ?? {}
    },
    enabled: habilitarQuery,
    staleTime: 1000 * 60 * 5,
  })

  const statusEfetivo = resolverStatusBloqueio(status, data?.statusFinanceiro)

  // ATIVO ou desconhecido → nada a exibir (Req 6.5 + degradação segura).
  if (statusEfetivo === 'SOMENTE_LEITURA') {
    // Req 6.1 — banner de somente-visualização (a aplicação segue acessível).
    return (
      <Alert
        variant="light"
        color="yellow"
        icon={<IconEye size={18} />}
        title="Modo somente visualização"
        radius="md"
      >
        Sua empresa está em modo somente visualização por uma pendência
        financeira. Você pode consultar as informações, mas alterações estão
        temporariamente indisponíveis. Regularize a pendência para voltar a
        operar normalmente.
      </Alert>
    )
  }

  if (statusEfetivo === 'INATIVADO') {
    // Req 6.2 — tela de acesso impedido.
    return (
      <Center mih="60vh" p="md">
        <Paper withBorder radius="md" p="xl" maw={520} w="100%">
          <Stack align="center" gap="md">
            <ThemeIcon size={64} radius="xl" variant="light" color="red">
              <IconLock size={36} />
            </ThemeIcon>
            <Title order={3} ta="center">
              Acesso temporariamente indisponível
            </Title>
            <Text c="dimmed" ta="center">
              Sua empresa está inativada e o acesso aos módulos está impedido no
              momento. Para reativar o acesso, entre em contato para regularizar
              a situação financeira da sua empresa.
            </Text>
          </Stack>
        </Paper>
      </Center>
    )
  }

  return null
}

export default BloqueioFinanceiroAviso
