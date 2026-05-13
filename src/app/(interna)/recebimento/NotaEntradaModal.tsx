'use client'

import { Modal, TextInput, NumberInput, Button, Group, Select, Combobox, useCombobox, InputBase, Table, ActionIcon, Text } from '@mantine/core'
import { useForm, Controller, useFieldArray } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { IconPlus, IconTrash } from '@tabler/icons-react'
import { fornecedoresCrud } from '@/data/hooks/useCrudGenerico'
import { useProdutos } from '@/data/hooks/useProduto'

const nfSchema = z.object({
  numero: z.number().min(1, 'Obrigatório'),
  serie: z.string().optional(),
  fornecedor: z.string().optional(),
  fornecedorDoc: z.string().optional(),
  transportadora: z.string().optional(),
  tipo: z.string().default('COMPRA'),
  itens: z.array(z.object({
    item: z.number(),
    descricao: z.string().min(1, 'Obrigatório'),
    codigoProduto: z.string().optional(),
    unidade: z.string().min(1),
    quantidade: z.number().min(0.001, 'Obrigatório'),
    lote: z.string().optional(),
    validade: z.string().optional(),
  })).optional(),
})
type NfForm = z.infer<typeof nfSchema>

interface Props {
  opened: boolean
  onClose: () => void
  onSave: (data: NfForm) => void
  importedData?: any
  saving: boolean
}

// Componente de Select com busca e criação livre
function SearchableCreatableSelect({ data, value, onChange, label, placeholder, className }: {
  data: { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
  label?: React.ReactNode
  placeholder?: string
  className?: string
}) {
  const combobox = useCombobox({ onDropdownClose: () => combobox.resetSelectedOption() })
  const [search, setSearch] = useState('')

  const filtered = data.filter((item) =>
    item.label.toLowerCase().includes(search.toLowerCase().trim())
  )

  const options = filtered.map((item) => (
    <Combobox.Option value={item.value} key={item.value}>{item.label}</Combobox.Option>
  ))

  return (
    <Combobox
      store={combobox}
      onOptionSubmit={(val) => { onChange(val); setSearch(val); combobox.closeDropdown() }}
    >
      <Combobox.Target>
        <InputBase
          label={label}
          className={className}
          size="sm"
          rightSection={<Combobox.Chevron />}
          value={search || value}
          onChange={(event) => { combobox.openDropdown(); combobox.updateSelectedOptionIndex(); setSearch(event.currentTarget.value); onChange(event.currentTarget.value) }}
          onClick={() => combobox.openDropdown()}
          onFocus={() => combobox.openDropdown()}
          onBlur={() => { combobox.closeDropdown(); if (!search && value) setSearch(value) }}
          placeholder={placeholder}
          rightSectionPointerEvents="none"
        />
      </Combobox.Target>
      <Combobox.Dropdown>
        <Combobox.Options mah={200} style={{ overflowY: 'auto' }}>
          {options.length > 0 ? options : <Combobox.Empty>Nenhum resultado</Combobox.Empty>}
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  )
}

export default function NotaEntradaModal({ opened, onClose, onSave, importedData, saving }: Props) {
  const { data: fornecedoresResp } = fornecedoresCrud.useListar({ limit: 200 })
  const { data: produtosResp } = useProdutos({ limit: 200 })

  const fornecedores = fornecedoresResp?.data || []
  const produtos = produtosResp?.data || []

  const fornecedorOptions = fornecedores.map((f: any) => ({
    value: f.razaoSocial,
    label: `${f.razaoSocial}${f.cnpj ? ` (${f.cnpj})` : ''}`,
  }))

  const produtoOptions = produtos.map((p: any) => ({
    value: p.descricao,
    label: `${p.codigo} - ${p.descricao}`,
  }))

  const { control, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<NfForm>({
    resolver: zodResolver(nfSchema),
    defaultValues: { numero: 0, serie: '', tipo: 'COMPRA', chaveNfe: '', fornecedorId: '', dataEmissao: '', itens: [{ item: 1, descricao: '', unidade: 'UN', quantidade: 0 }] },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'itens' })

  useEffect(() => {
    if (importedData) {
      reset({
        numero: importedData.numero || 0,
        serie: importedData.serie || '',
        fornecedor: importedData.fornecedor || '',
        fornecedorDoc: importedData.fornecedorDoc || '',
        transportadora: importedData.transportadora || '',
        tipo: importedData.tipo || 'COMPRA',
        itens: (importedData.itens || []).map((i: any, idx: number) => ({
          item: idx + 1,
          descricao: i.descricao || '',
          codigoProduto: i.codigoProduto || '',
          unidade: i.unidade || 'UN',
          quantidade: i.quantidade || 0,
          lote: i.lote || '',
          validade: i.validade || '',
        })),
      })
    } else {
      reset({ numero: 0, serie: '', tipo: 'COMPRA', chaveNfe: '', fornecedorId: '', dataEmissao: '', itens: [{ item: 1, descricao: '', unidade: 'UN', quantidade: 0 }] })
    }
  }, [importedData, reset, opened])

  function handleFornecedorChange(value: string) {
    setValue('fornecedor', value, { shouldDirty: true })
    const forn = fornecedores.find((f: any) => f.razaoSocial === value)
    if (forn?.cnpj) {
      setValue('fornecedorDoc', forn.cnpj, { shouldDirty: true })
    }
  }

  function handleCnpjBlur() {
    const cnpj = watch('fornecedorDoc')
    if (cnpj && cnpj.length >= 11) {
      const forn = fornecedores.find((f: any) => f.cnpj?.replace(/\D/g, '') === cnpj.replace(/\D/g, ''))
      if (forn) {
        setValue('fornecedor', forn.razaoSocial, { shouldDirty: true })
      }
    }
  }

  function handleProdutoChange(index: number, value: string) {
    setValue(`itens.${index}.descricao`, value, { shouldDirty: true })
    const prod = produtos.find((p: any) => p.descricao === value)
    if (prod) {
      setValue(`itens.${index}.unidade`, prod.unidade, { shouldDirty: true })
      setValue(`itens.${index}.codigoProduto`, String(prod.codigo), { shouldDirty: true })
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title={importedData ? 'Nota Importada do XML' : 'Nova Nota Fiscal de Entrada'} size="xl" centered closeOnClickOutside={false}>
      <form onSubmit={handleSubmit(onSave)}>
        <div className="flex flex-col gap-4">
          <div className="flex gap-4 w-full">
            <Controller name="numero" control={control} render={({ field }) => (
              <NumberInput label={<>Nº NF <span style={{ color: 'red' }}>*</span></>} error={errors.numero?.message} className="w-3/12" {...field} />
            )} />
            <Controller name="serie" control={control} render={({ field }) => (
              <TextInput label="Série" className="w-2/12" {...field} />
            )} />
            <Controller name="tipo" control={control} render={({ field }) => (
              <Select label="Tipo" data={[
                { value: 'COMPRA', label: 'Compra' },
                { value: 'DEVOLUCAO', label: 'Devolução' },
                { value: 'TRANSFERENCIA', label: 'Transferência' },
              ]} className="w-3/12" {...field} />
            )} />
          </div>

          <div className="flex gap-4 w-full">
            <Controller name="fornecedor" control={control} render={({ field }) => (
              <SearchableCreatableSelect
                label="Fornecedor"
                data={fornecedorOptions}
                className="w-7/12"
                value={field.value || ''}
                onChange={handleFornecedorChange}
                placeholder="Selecione ou digite..."
              />
            )} />
            <Controller name="fornecedorDoc" control={control} render={({ field }) => (
              <TextInput label="CNPJ" className="w-5/12" {...field} onBlur={() => { field.onBlur(); handleCnpjBlur() }} />
            )} />
          </div>

          <Controller name="transportadora" control={control} render={({ field }) => (
            <TextInput label="Transportadora" {...field} />
          )} />

          <Group justify="space-between" mt="xs">
            <Text fw={600} size="sm">Itens da Nota ({fields.length})</Text>
            <Button size="xs" variant="light" leftSection={<IconPlus size={14} />}
              onClick={() => append({ item: fields.length + 1, descricao: '', unidade: 'UN', quantidade: 0 })}>
              Adicionar Item
            </Button>
          </Group>

          <div className="overflow-x-auto">
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th className="w-14">Item</Table.Th>
                  <Table.Th>Produto</Table.Th>
                  <Table.Th className="w-16">Cód.</Table.Th>
                  <Table.Th className="w-20">Unid.</Table.Th>
                  <Table.Th className="w-28">Qtd</Table.Th>
                  <Table.Th className="w-28">Lote</Table.Th>
                  <Table.Th className="w-28">Validade</Table.Th>
                  <Table.Th className="w-10"></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {fields.map((field, index) => (
                  <Table.Tr key={field.id}>
                    <Table.Td>
                      <Controller name={`itens.${index}.item`} control={control} render={({ field }) => (
                        <NumberInput size="xs" min={1} {...field} />
                      )} />
                    </Table.Td>
                    <Table.Td>
                      <Controller name={`itens.${index}.descricao`} control={control} render={({ field: f }) => (
                        <SearchableCreatableSelect
                          data={produtoOptions}
                          value={f.value}
                          onChange={(v) => handleProdutoChange(index, v)}
                          placeholder="Selecione ou digite..."
                        />
                      )} />
                    </Table.Td>
                    <Table.Td>
                      <Controller name={`itens.${index}.codigoProduto`} control={control} render={({ field }) => (
                        <TextInput size="xs" {...field} />
                      )} />
                    </Table.Td>
                    <Table.Td>
                      <Controller name={`itens.${index}.unidade`} control={control} render={({ field }) => (
                        <TextInput size="xs" {...field} />
                      )} />
                    </Table.Td>
                    <Table.Td>
                      <Controller name={`itens.${index}.quantidade`} control={control} render={({ field }) => (
                        <NumberInput size="xs" min={0} decimalScale={3} {...field} />
                      )} />
                    </Table.Td>
                    <Table.Td>
                      <Controller name={`itens.${index}.lote`} control={control} render={({ field }) => (
                        <TextInput size="xs" placeholder="Lote" {...field} />
                      )} />
                    </Table.Td>
                    <Table.Td>
                      <Controller name={`itens.${index}.validade`} control={control} render={({ field }) => (
                        <TextInput size="xs" placeholder="AAAA-MM-DD" {...field} />
                      )} />
                    </Table.Td>
                    <Table.Td>
                      {fields.length > 1 && (
                        <ActionIcon variant="subtle" color="red" size="sm" onClick={() => remove(index)}>
                          <IconTrash size={14} />
                        </ActionIcon>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </div>
        </div>

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={saving}>Salvar Nota</Button>
        </Group>
      </form>
    </Modal>
  )
}
