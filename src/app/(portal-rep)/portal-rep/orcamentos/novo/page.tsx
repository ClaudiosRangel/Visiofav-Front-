'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Card,
  TextInput,
  NumberInput,
  Select,
  Button,
  ActionIcon,
  Stack,
  Group,
  Title,
  Text,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconTrash, IconPlus } from '@tabler/icons-react'
import { usePortalRepClientes } from '@/data/hooks/portal-rep-app/usePortalRepClientes'
import { useCriarSolicitacao } from '@/data/hooks/portal-rep-app/usePortalRepOrcamentos'

interface ItemForm {
  produtoNome: string
  quantidade: number | ''
  especificacao: string
}

function criarItemVazio(): ItemForm {
  return { produtoNome: '', quantidade: '', especificacao: '' }
}

export default function NovaSolicitacaoPage() {
  const router = useRouter()
  const { data: clientes, isLoading: carregandoClientes } = usePortalRepClientes()
  const criarSolicitacao = useCriarSolicitacao()

  const [clienteId, setClienteId] = useState<string | null>(null)
  const [itens, setItens] = useState<ItemForm[]>([criarItemVazio()])

  const clienteOptions = (clientes ?? []).map((c) => ({
    value: c.id,
    label: c.razaoSocial + (c.nomeFantasia ? ` (${c.nomeFantasia})` : ''),
  }))

  function adicionarItem() {
    setItens((prev) => [...prev, criarItemVazio()])
  }

  function removerItem(index: number) {
    setItens((prev) => prev.filter((_, i) => i !== index))
  }

  function atualizarItem(index: number, campo: keyof ItemForm, valor: string | number | '') {
    setItens((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [campo]: valor } : item)),
    )
  }

  const itensValidos = itens.filter(
    (item) => item.produtoNome.trim().length > 0 && typeof item.quantidade === 'number' && item.quantidade > 0,
  )
  const formValido = !!clienteId && itensValidos.length > 0 && itensValidos.length === itens.length

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formValido || !clienteId) return

    criarSolicitacao.mutate(
      {
        clienteId,
        itens: itens.map((item) => ({
          produtoNome: item.produtoNome.trim(),
          quantidade: item.quantidade as number,
          especificacao: item.especificacao.trim() || undefined,
        })),
      },
      {
        onSuccess: () => {
          notifications.show({
            message: 'Solicitação de orçamento enviada com sucesso!',
            color: 'green',
          })
          router.push('/portal-rep/orcamentos')
        },
        onError: (error: Error & { response?: { data?: { message?: string } } }) => {
          const msg =
            (error as unknown as { response?: { data?: { message?: string } } })
              .response?.data?.message || 'Erro ao enviar solicitação. Tente novamente.'
          notifications.show({
            message: msg,
            color: 'red',
          })
        },
      },
    )
  }

  return (
    <Stack gap="md" p="md">
      <Title order={3}>Nova Solicitação de Orçamento</Title>

      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <Card>
            <Select
              label="Cliente"
              placeholder="Selecione o cliente"
              data={clienteOptions}
              value={clienteId}
              onChange={setClienteId}
              searchable
              nothingFoundMessage="Nenhum cliente encontrado"
              disabled={carregandoClientes}
              required
            />
          </Card>

          <Group justify="space-between" align="center">
            <Text fw={500}>Itens</Text>
            <Button
              variant="light"
              size="xs"
              leftSection={<IconPlus size={14} />}
              onClick={adicionarItem}
            >
              Adicionar item
            </Button>
          </Group>

          {itens.map((item, index) => (
            <Card key={index}>
              <Stack gap="sm">
                <Group justify="space-between" align="center">
                  <Text size="sm" fw={500} c="dimmed">
                    Item {index + 1}
                  </Text>
                  {itens.length > 1 && (
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      size="sm"
                      onClick={() => removerItem(index)}
                      aria-label={`Remover item ${index + 1}`}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  )}
                </Group>

                <TextInput
                  label="Produto"
                  placeholder="Nome ou descrição do produto"
                  value={item.produtoNome}
                  onChange={(e) => atualizarItem(index, 'produtoNome', e.currentTarget.value)}
                  required
                />

                <NumberInput
                  label="Quantidade"
                  placeholder="Qtd"
                  min={1}
                  value={item.quantidade}
                  onChange={(val) => atualizarItem(index, 'quantidade', val === '' ? '' : Number(val))}
                  required
                />

                <TextInput
                  label="Especificação técnica"
                  placeholder="Opcional — detalhes técnicos"
                  value={item.especificacao}
                  onChange={(e) => atualizarItem(index, 'especificacao', e.currentTarget.value)}
                />
              </Stack>
            </Card>
          ))}

          {itens.length === 0 && (
            <Text size="sm" c="red" ta="center">
              Adicione ao menos 1 item para enviar a solicitação.
            </Text>
          )}

          <Button
            type="submit"
            fullWidth
            loading={criarSolicitacao.isPending}
            disabled={!formValido || criarSolicitacao.isPending}
          >
            Enviar Solicitação
          </Button>
        </Stack>
      </form>
    </Stack>
  )
}
