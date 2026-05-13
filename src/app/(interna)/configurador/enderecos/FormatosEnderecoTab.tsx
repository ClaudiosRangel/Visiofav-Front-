'use client'

import { useState } from 'react'
import {
  Button,
  Card,
  Group,
  Text,
  TextInput,
  Table,
  Badge,
  ActionIcon,
  Tooltip,
  Modal,
  LoadingOverlay,
  Select,
  NumberInput,
  Checkbox,
  Stack,
} from '@mantine/core'
import {
  IconPlus,
  IconSearch,
  IconEdit,
  IconTrash,
  IconRefresh,
  IconX,
} from '@tabler/icons-react'
import { useForm, Controller, useFieldArray } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { notifications } from '@mantine/notifications'
import { formatoEnderecoCrud } from '@/data/hooks/useFormatoEndereco'

// ===== Tipos do backend =====

const camposFisicos = [
  { value: 'codigoDeposito', label: 'Depósito' },
  { value: 'codigoZona', label: 'Zona' },
  { value: 'codigoRua', label: 'Rua' },
  { value: 'codigoPredio', label: 'Prédio' },
  { value: 'codigoNivel', label: 'Nível' },
  { value: 'codigoApto', label: 'Apartamento' },
] as const

type CampoFisico = 'codigoDeposito' | 'codigoZona' | 'codigoRua' | 'codigoPredio' | 'codigoNivel' | 'codigoApto'

// ===== Schema de validação =====

const segmentoSchema = z.object({
  nome: z.string().min(1, 'Nome do segmento é obrigatório'),
  campoFisico: z.enum([
    'codigoDeposito',
    'codigoZona',
    'codigoRua',
    'codigoPredio',
    'codigoNivel',
    'codigoApto',
  ]),
  ordem: z.number().min(1, 'Ordem deve ser maior que 0'),
  numerico: z.boolean(),
  prefixo: z.string().optional(),
})

const formatoSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  segmentos: z
    .array(segmentoSchema)
    .min(1, 'Ao menos um segmento é obrigatório'),
})

type FormValues = z.infer<typeof formatoSchema>

const defaultSegmento = {
  nome: '',
  campoFisico: 'codigoRua' as CampoFisico,
  ordem: 1,
  numerico: false,
  prefixo: '',
}

// ===== Componente =====

export default function FormatosEnderecoTab() {
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [search, setSearch] = useState('')

  const { data: response, isLoading, refetch } = formatoEnderecoCrud.useListar({
    search: search || undefined,
  })
  const criar = formatoEnderecoCrud.useCriar()
  const atualizar = formatoEnderecoCrud.useAtualizar()
  const excluir = formatoEnderecoCrud.useExcluir()

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formatoSchema),
    defaultValues: { nome: '', segmentos: [defaultSegmento] },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'segmentos',
  })

  function handleNew() {
    setEditItem(null)
    reset({ nome: '', segmentos: [{ ...defaultSegmento, ordem: 1 }] })
    setModalOpen(true)
  }

  function handleEdit(item: any) {
    setEditItem(item)
    reset({
      nome: item.nome,
      segmentos:
        item.segmentos && item.segmentos.length > 0
          ? item.segmentos.map((s: any) => ({
              nome: s.nome || '',
              campoFisico: s.campoFisico || 'codigoRua',
              ordem: s.ordem ?? 0,
              numerico: s.numerico ?? false,
              prefixo: s.prefixo || '',
            }))
          : [{ ...defaultSegmento }],
    })
    setModalOpen(true)
  }

  async function onSubmit(data: FormValues) {
    try {
      if (editItem) {
        await atualizar.mutateAsync({ id: editItem.id, ...data } as any)
      } else {
        await criar.mutateAsync(data as any)
      }
      notifications.show({
        title: 'Sucesso',
        message: editItem ? 'Formato atualizado' : 'Formato criado',
        color: 'green',
      })
      setModalOpen(false)
    } catch (err: any) {
      notifications.show({
        title: 'Erro',
        message:
          err?.response?.data?.message || 'Falha ao salvar formato',
        color: 'red',
      })
    }
  }

  async function handleDelete(id: string, nome: string) {
    if (!confirm(`Excluir formato "${nome}"?`)) return
    try {
      await excluir.mutateAsync(id)
      notifications.show({
        title: 'Sucesso',
        message: 'Formato excluído',
        color: 'green',
      })
    } catch (err: any) {
      notifications.show({
        title: 'Erro',
        message:
          err?.response?.data?.message || 'Falha ao excluir formato',
        color: 'red',
      })
    }
  }

  const items = response?.data || []

  return (
    <Card pos="relative">
      <LoadingOverlay visible={isLoading} />
      <Group justify="space-between" mb="md">
        <TextInput
          placeholder="Pesquisar formato..."
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          className="w-72"
        />
        <Group>
          <Button
            variant="default"
            leftSection={<IconRefresh size={16} />}
            onClick={() => refetch()}
          >
            Atualizar
          </Button>
          <Button leftSection={<IconPlus size={16} />} onClick={handleNew}>
            Novo
          </Button>
        </Group>
      </Group>

      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Nome</Table.Th>
            <Table.Th>Segmentos</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th className="w-24">Ações</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {items.map((item: any) => (
            <Table.Tr key={item.id}>
              <Table.Td>{item.nome}</Table.Td>
              <Table.Td>
                <Group gap={4}>
                  {(item.segmentos || []).map((seg: any, idx: number) => (
                    <Badge key={idx} variant="light" size="sm">
                      {seg.nome}
                    </Badge>
                  ))}
                </Group>
              </Table.Td>
              <Table.Td>
                <Badge color={item.status !== false ? 'green' : 'gray'}>
                  {item.status !== false ? 'Ativo' : 'Inativo'}
                </Badge>
              </Table.Td>
              <Table.Td>
                <Group gap={4}>
                  <Tooltip label="Editar">
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      onClick={() => handleEdit(item)}
                    >
                      <IconEdit size={18} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Excluir">
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      onClick={() => handleDelete(item.id, item.nome)}
                    >
                      <IconTrash size={18} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
          {!isLoading && items.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={4} className="text-center py-8 text-zinc-500">
                Nenhum formato cadastrado
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>

      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editItem ? 'Editar Formato de Endereço' : 'Novo Formato de Endereço'}
        centered
        closeOnClickOutside={false}
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)}>
          <Stack gap="md">
            <Controller
              name="nome"
              control={control}
              render={({ field }) => (
                <TextInput
                  label={
                    <>
                      Nome <span style={{ color: 'red' }}>*</span>
                    </>
                  }
                  error={errors.nome?.message}
                  {...field}
                />
              )}
            />

            <div>
              <Group justify="space-between" mb="xs">
                <Text size="sm" fw={500}>
                  Segmentos <span style={{ color: 'red' }}>*</span>
                </Text>
                <Button
                  size="xs"
                  variant="light"
                  leftSection={<IconPlus size={14} />}
                  onClick={() =>
                    append({ ...defaultSegmento, ordem: fields.length + 1 })
                  }
                >
                  Adicionar
                </Button>
              </Group>

              {errors.segmentos?.root?.message && (
                <Text size="xs" c="red" mb="xs">
                  {errors.segmentos.root.message}
                </Text>
              )}

              <Stack gap="sm">
                {fields.map((field, index) => (
                  <Card key={field.id} withBorder padding="sm">
                    <Group justify="space-between" mb="xs">
                      <Text size="xs" fw={500} c="dimmed">
                        Segmento {index + 1}
                      </Text>
                      {fields.length > 1 && (
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          color="red"
                          onClick={() => remove(index)}
                        >
                          <IconX size={14} />
                        </ActionIcon>
                      )}
                    </Group>
                    <Group grow align="flex-start">
                      <Controller
                        name={`segmentos.${index}.nome`}
                        control={control}
                        render={({ field }) => (
                          <TextInput
                            label="Nome"
                            size="xs"
                            error={errors.segmentos?.[index]?.nome?.message}
                            {...field}
                          />
                        )}
                      />
                      <Controller
                        name={`segmentos.${index}.campoFisico`}
                        control={control}
                        render={({ field }) => (
                          <Select
                            label="Campo Físico"
                            size="xs"
                            data={camposFisicos.map((c) => ({
                              value: c.value,
                              label: c.label,
                            }))}
                            error={
                              errors.segmentos?.[index]?.campoFisico?.message
                            }
                            {...field}
                          />
                        )}
                      />
                      <Controller
                        name={`segmentos.${index}.ordem`}
                        control={control}
                        render={({ field }) => (
                          <NumberInput
                            label="Ordem"
                            size="xs"
                            min={1}
                            error={errors.segmentos?.[index]?.ordem?.message}
                            value={field.value}
                            onChange={(val) => field.onChange(val || 1)}
                          />
                        )}
                      />
                    </Group>
                    <Group mt="xs" align="center">
                      <Controller
                        name={`segmentos.${index}.numerico`}
                        control={control}
                        render={({ field }) => (
                          <Checkbox
                            label="Numérico"
                            size="xs"
                            checked={field.value}
                            onChange={(e) =>
                              field.onChange(e.currentTarget.checked)
                            }
                          />
                        )}
                      />
                      <Controller
                        name={`segmentos.${index}.prefixo`}
                        control={control}
                        render={({ field }) => (
                          <TextInput
                            label="Prefixo (opcional)"
                            size="xs"
                            className="flex-1"
                            {...field}
                            value={field.value || ''}
                          />
                        )}
                      />
                    </Group>
                  </Card>
                ))}
              </Stack>
            </div>
          </Stack>

          <Group justify="flex-end" mt="lg">
            <Button variant="default" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              loading={criar.isPending || atualizar.isPending}
            >
              Salvar
            </Button>
          </Group>
        </form>
      </Modal>
    </Card>
  )
}
