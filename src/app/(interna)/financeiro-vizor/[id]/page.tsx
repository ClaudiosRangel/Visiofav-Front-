'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Title,
  Text,
  Card,
  Group,
  Stack,
  Center,
  Loader,
  Button,
  SimpleGrid,
  Paper,
} from '@mantine/core'
import { IconArrowLeft } from '@tabler/icons-react'

import { useSuperAdminGuard } from '@/hooks/financeiro-vizor/useSuperAdminGuard'
import { useDetalheEmpresa } from '@/hooks/financeiro-vizor/useDetalheEmpresa'
import { useEmpresasFinanceiro } from '@/hooks/financeiro-vizor/useEmpresasFinanceiro'
import { StatusFinanceiroBadge } from '@/components/financeiro-vizor/StatusFinanceiroBadge'
import { ContratoForm } from '@/components/financeiro-vizor/ContratoForm'
import { FaturasTable } from '@/components/financeiro-vizor/FaturasTable'
import { AcoesStatusEmpresa } from '@/components/financeiro-vizor/AcoesStatusEmpresa'
import { formatarBRL } from '@/lib/financeiro-vizor/format'

/** Cartão de indicador do cabeçalho (rótulo + valor destacado). */
function Indicador({
  rotulo,
  valor,
  cor,
}: {
  rotulo: string
  valor: string
  cor?: string
}) {
  return (
    <Paper withBorder p="md" radius="md">
      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
        {rotulo}
      </Text>
      <Text size="xl" fw={700} c={cor} mt={4}>
        {valor}
      </Text>
    </Paper>
  )
}

/**
 * Página de detalhe de cobrança de uma empresa no painel Financeiro Vizor
 * (Req 3, 4, 5).
 *
 * Exclusiva do SUPER_ADMIN via `useSuperAdminGuard`: enquanto verifica exibe um
 * loader; se negado, não renderiza dados de cobrança (o guard já notifica e/ou
 * redireciona).
 *
 * O `id` da empresa vem do parâmetro de rota (`useParams`, Next 15 App Router).
 * `useDetalheEmpresa(id)` busca `GET /financeiro-vizor/empresas/:id` — enquanto
 * carrega exibe um `Loader` (Req 4.5).
 *
 * IMPORTANTE: o `DetalheCobranca` do backend NÃO inclui `nome` nem
 * `statusFinanceiro`. Esses dois campos são obtidos da listagem
 * (`useEmpresasFinanceiro`), encontrando a empresa por `empresaId`. Se a
 * listagem ainda não estiver em cache, a tela degrada com elegância (título
 * genérico e badge exibido apenas quando o status estiver disponível).
 *
 * Compõe `ContratoForm` (Req 3), `FaturasTable` com as faturas do detalhe
 * (Req 4) e `AcoesStatusEmpresa` passando o status atual (Req 5).
 */
export default function FinanceiroVizorDetalhePage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const guarda = useSuperAdminGuard()

  useEffect(() => {
    document.title = 'Vizor - Financeiro Vizor - Detalhe'
  }, [])

  const { data: detalhe, isLoading } = useDetalheEmpresa(id)

  // Nome e status financeiro NÃO vêm no DetalheCobranca — obtê-los da listagem.
  // Se a listagem não estiver em cache, `empresa` fica indefinido e a tela
  // degrada com elegância (título genérico, badge oculto). (Req 4.1)
  const { data: empresas } = useEmpresasFinanceiro()
  const empresa = empresas?.find((e) => e.empresaId === id)

  // Verificação de acesso em andamento: loader neutro. (Req 1)
  if (guarda === 'verificando') {
    return (
      <Center h="60vh">
        <Loader />
      </Center>
    )
  }

  // Acesso negado: o guard já exibiu notificação e/ou redirecionou; não
  // renderiza dados de cobrança. (Req 1.3, 1.5)
  if (guarda !== 'permitido') {
    return (
      <Center h="60vh">
        <Text c="dimmed">Acesso restrito.</Text>
      </Center>
    )
  }

  const diasEmAtraso = detalhe?.diasEmAtraso

  return (
    <div className="max-w-[1300px] mx-auto">
      <Group mb="md">
        <Button
          variant="subtle"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => router.push('/financeiro-vizor')}
        >
          Voltar
        </Button>
      </Group>

      {/* Cabeçalho: nome, badge de status, indicadores. (Req 4.1) */}
      <Card shadow="xs" radius="md" p="lg" mb="lg">
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <div>
            <Group gap="sm" align="center">
              <Title order={2} fw={700}>
                {empresa?.nome ?? 'Detalhe da empresa'}
              </Title>
              {empresa && (
                <StatusFinanceiroBadge status={empresa.statusFinanceiro} />
              )}
            </Group>
            <Text size="sm" c="dimmed">
              Cobrança recorrente do Vizor
            </Text>
          </div>

          {/* Ações de status da empresa (reativar/inativar). (Req 5) */}
          <AcoesStatusEmpresa
            empresaId={id}
            statusAtual={empresa?.statusFinanceiro}
          />
        </Group>

        {isLoading ? (
          <Center py="xl">
            <Loader />
          </Center>
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md" mt="lg">
            <Indicador
              rotulo="Total Mensal"
              valor={formatarBRL(detalhe?.totalMensal ?? 0)}
            />
            <Indicador
              rotulo="Total Vencido"
              valor={formatarBRL(detalhe?.totalVencidoEmAberto ?? 0)}
              cor={
                (detalhe?.totalVencidoEmAberto ?? 0) > 0 ? 'red' : undefined
              }
            />
            <Indicador
              rotulo="Dias em atraso"
              valor={
                diasEmAtraso != null && diasEmAtraso > 0
                  ? `${diasEmAtraso} ${diasEmAtraso === 1 ? 'dia' : 'dias'}`
                  : '—'
              }
              cor={diasEmAtraso != null && diasEmAtraso > 0 ? 'red' : undefined}
            />
          </SimpleGrid>
        )}
      </Card>

      {/* Detalhe: só renderiza os blocos que dependem do detalhe quando ele
          estiver carregado (Loader enquanto carrega). (Req 4.5) */}
      {isLoading ? (
        <Center py="xl">
          <Loader />
        </Center>
      ) : detalhe ? (
        <Stack gap="lg">
          {/* Contrato e preços por módulo. (Req 3) */}
          <ContratoForm empresaId={id} detalhe={detalhe} />

          {/* Faturas + geração de vencimentos. (Req 4) */}
          <FaturasTable empresaId={id} faturas={detalhe.faturas} />
        </Stack>
      ) : (
        <Center py="xl">
          <Text c="dimmed">Não foi possível carregar o detalhe da empresa.</Text>
        </Center>
      )}
    </div>
  )
}
