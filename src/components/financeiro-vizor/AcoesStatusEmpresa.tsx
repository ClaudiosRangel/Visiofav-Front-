'use client'

import { Button, Group, Text } from '@mantine/core'
import { modals } from '@mantine/modals'
import { IconCircleCheck, IconCircleOff } from '@tabler/icons-react'

import { useStatusMutations } from '@/hooks/financeiro-vizor/useStatusMutations'
import type { StatusFinanceiro } from '@/lib/financeiro-vizor/types'

interface AcoesStatusEmpresaProps {
  /** Empresa alvo das ações de status (usada nas mutations). */
  empresaId: string
  /**
   * Status financeiro atual da empresa (opcional). Quando informado, o botão
   * correspondente ao status já vigente é desabilitado (não faz sentido reativar
   * uma empresa já `ATIVO` nem inativar uma já `INATIVADO`).
   */
  statusAtual?: StatusFinanceiro
}

/**
 * Ações de status da empresa (Req 5): botões Reativar e Inativar.
 *
 * Cada botão abre um `modals.openConfirmModal` (@mantine/modals) de confirmação
 * antes de enviar a requisição (Req 5.1, 5.3). Ao confirmar, chama a mutation
 * correspondente de `useStatusMutations`, que no sucesso atualiza o status
 * exibido conforme a resposta e notifica (verde); em erro exibe a mensagem
 * traduzida (vermelha) preservando o status anterior (Req 5.2, 5.4, 5.7).
 *
 * O botão de confirmação do modal é desabilitado/carregando enquanto a mutation
 * está `isPending` (Req 5.6). A reativação é sempre uma ação explícita disparada
 * aqui — nenhuma outra ação (ex.: baixa de fatura) a invoca (Req 5.5).
 */
export function AcoesStatusEmpresa({
  empresaId,
  statusAtual,
}: AcoesStatusEmpresaProps) {
  const { reativar, inativar } = useStatusMutations(empresaId)

  function confirmarReativacao() {
    modals.openConfirmModal({
      title: 'Reativar empresa',
      children: (
        <Text size="sm">
          Confirma a reativação desta empresa? O status financeiro voltará para{' '}
          <strong>ATIVO</strong> e o acesso normal aos módulos será restabelecido.
        </Text>
      ),
      labels: { confirm: 'Confirmar reativação', cancel: 'Cancelar' },
      confirmProps: { color: 'green', loading: reativar.isPending },
      onConfirm: () => reativar.mutate(),
    })
  }

  function confirmarInativacao() {
    modals.openConfirmModal({
      title: 'Inativar empresa',
      children: (
        <Text size="sm">
          Confirma a inativação desta empresa? O status financeiro passará para{' '}
          <strong>INATIVADO</strong> e o acesso aos módulos será impedido até uma
          reativação manual.
        </Text>
      ),
      labels: { confirm: 'Confirmar inativação', cancel: 'Voltar' },
      confirmProps: { color: 'red', loading: inativar.isPending },
      onConfirm: () => inativar.mutate(),
    })
  }

  return (
    <Group gap="sm">
      <Button
        variant="light"
        color="green"
        leftSection={<IconCircleCheck size={16} />}
        onClick={confirmarReativacao}
        loading={reativar.isPending}
        disabled={statusAtual === 'ATIVO' || inativar.isPending}
      >
        Reativar
      </Button>
      <Button
        variant="light"
        color="red"
        leftSection={<IconCircleOff size={16} />}
        onClick={confirmarInativacao}
        loading={inativar.isPending}
        disabled={statusAtual === 'INATIVADO' || reativar.isPending}
      >
        Inativar
      </Button>
    </Group>
  )
}
