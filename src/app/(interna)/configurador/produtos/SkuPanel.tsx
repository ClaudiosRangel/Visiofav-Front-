'use client'

import { useState } from 'react'
import {
  Card, Group, Text, Table, Badge, Button, ActionIcon, Tooltip,
  Modal, TextInput, NumberInput, SimpleGrid, LoadingOverlay, Alert, Select,
} from '@mantine/core'
import { IconPlus, IconEdit, IconTrash, IconBarcode, IconPackage, IconCheck, IconWand } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useSkus, useCriarSku, useAtualizarSku, useExcluirSku, Sku } from '@/data/hooks/useSku'

interface SkuPanelProps {
  produtoId: string
  produtoNome: string
}

// Unidades de embalagem — mesma legenda usada no cadastro de Produto, para o
// operador escolher em vez de digitar (evita valores inconsistentes). O Select
// aceita digitação livre (`searchable`) para casos fora da lista.
const UNIDADES = [
  { value: 'UN', label: 'UN - Unidade' }, { value: 'CX', label: 'CX - Caixa' },
  { value: 'FD', label: 'FD - Fardo' }, { value: 'PT', label: 'PT - Pacote' },
  { value: 'PL', label: 'PL - Palete' }, { value: 'DP', label: 'DP - Display' },
  { value: 'PC', label: 'PC - Peça' }, { value: 'KG', label: 'KG - Quilograma' },
  { value: 'LT', label: 'LT - Litro' }, { value: 'MT', label: 'MT - Metro' },
]

// Tipos de palete — legenda para o campo (padrões usados no chão de fábrica).
const TIPOS_PALETE = [
  { value: 'PBR', label: 'PBR - Palete Padrão Brasil (1,00 × 1,20 m)' },
  { value: 'CHEP', label: 'CHEP - Palete azul locado (CHEP)' },
  { value: 'PER', label: 'PER - Palete retornável' },
  { value: 'FER', label: 'FER - Palete de madeira (fixo)' },
  { value: 'DESCARTAVEL', label: 'DESCARTAVEL - Palete descartável' },
]

/**
 * Calcula o dígito verificador de um GTIN (EAN-13 / DUN-14) pelo algoritmo
 * padrão GS1 (pesos 3/1 alternados, da direita para a esquerda sobre o corpo
 * sem o DV).
 */
function digitoVerificadorGtin(corpo: string): number {
  let soma = 0
  // Percorre da direita para a esquerda; o dígito mais à direita do corpo tem peso 3.
  const reverso = corpo.split('').reverse()
  for (let i = 0; i < reverso.length; i++) {
    const n = parseInt(reverso[i], 10)
    soma += n * (i % 2 === 0 ? 3 : 1)
  }
  return (10 - (soma % 10)) % 10
}

/**
 * Gera o DUN-14 (EAN-14 da caixa/embalagem) a partir de um EAN-13 do item e um
 * dígito logístico (1-8, indica o nível de embalagem). Padrão GS1:
 * DUN-14 = digitoLogistico + 12 primeiros dígitos do EAN-13 (sem o DV do EAN-13)
 *          + novo dígito verificador calculado sobre os 13 primeiros.
 * Retorna null se o EAN-13 for inválido (não tem 13 dígitos numéricos).
 */
function gerarEan14(ean13: string, digitoLogistico = 1): string | null {
  const limpo = (ean13 || '').replace(/\D/g, '')
  if (limpo.length !== 13) return null
  const base = String(digitoLogistico) + limpo.slice(0, 12) // 13 dígitos
  const dv = digitoVerificadorGtin(base)
  return base + String(dv)
}

const emptyForm = {
  sequencia: 1,
  descricao: '',
  codigoBarra: '',
  codigoBarraDun: '',
  unidade: 'UN',
  qtdEmbalagem: 1,
  largura: undefined as number | undefined,
  altura: undefined as number | undefined,
  comprimento: undefined as number | undefined,
  volume: undefined as number | undefined,
  pesoLiquido: undefined as number | undefined,
  pesoBruto: undefined as number | undefined,
  pesoPalete: undefined as number | undefined,
  lastro: undefined as number | undefined,
  camada: undefined as number | undefined,
  tipoPalete: '',
}

export default function SkuPanel({ produtoId, produtoNome }: SkuPanelProps) {
  const { data: skusResp, isLoading } = useSkus(produtoId)
  const criarSku = useCriarSku()
  const atualizarSku = useAtualizarSku()
  const excluirSku = useExcluirSku()

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)

  const skus = skusResp?.data || []

  function openNew() {
    setEditingId(null)
    setForm({ ...emptyForm, sequencia: skus.length + 1 })
    setModalOpen(true)
  }

  function openEdit(sku: Sku) {
    setEditingId(sku.id)
    setForm({
      sequencia: sku.sequencia,
      descricao: sku.descricao || '',
      codigoBarra: sku.codigoBarra || '',
      codigoBarraDun: sku.codigoBarraDun || '',
      unidade: sku.unidade,
      qtdEmbalagem: sku.qtdEmbalagem,
      largura: sku.largura != null ? Number(sku.largura) : undefined,
      altura: sku.altura != null ? Number(sku.altura) : undefined,
      comprimento: sku.comprimento != null ? Number(sku.comprimento) : undefined,
      volume: sku.volume != null ? Number(sku.volume) : undefined,
      pesoLiquido: sku.pesoLiquido != null ? Number(sku.pesoLiquido) : undefined,
      pesoBruto: sku.pesoBruto != null ? Number(sku.pesoBruto) : undefined,
      pesoPalete: sku.pesoPalete != null ? Number(sku.pesoPalete) : undefined,
      lastro: sku.lastro != null ? Number(sku.lastro) : undefined,
      camada: sku.camada != null ? Number(sku.camada) : undefined,
      tipoPalete: sku.tipoPalete || '',
    })
    setModalOpen(true)
  }

  async function handleSave() {
    try {
      // Ao EDITAR, campos vazios devem ser enviados como `null` (não undefined)
      // para o backend LIMPAR o valor já gravado. Undefined seria ignorado pelo
      // Prisma (bug reportado pelo QA). Ao CRIAR, campos vazios podem ir como
      // undefined normalmente.
      const vazio = editingId ? null : undefined
      const numOuVazio = (v: number | undefined) => (v != null ? Number(v) : vazio)
      const strOuVazio = (v: string) => (v && v.trim() ? v.trim() : vazio)

      // Volume: calcula automaticamente das dimensões se o usuário não informou.
      let volume = form.volume != null ? Number(form.volume) : undefined
      if (!volume && form.largura && form.altura && form.comprimento) {
        volume = (form.largura * form.altura * form.comprimento) / 1000000
      }

      // Peso Palete: se não informado, calcula da cubagem do palete
      // (peso bruto da embalagem × total de embalagens no palete = lastro × camada).
      let pesoPalete = form.pesoPalete != null ? Number(form.pesoPalete) : undefined
      if (!pesoPalete && form.pesoBruto && form.lastro && form.camada) {
        pesoPalete = Number((form.pesoBruto * form.lastro * form.camada).toFixed(3))
      }

      const payload: any = {
        produtoId,
        sequencia: Number(form.sequencia),
        unidade: form.unidade,
        qtdEmbalagem: Number(form.qtdEmbalagem),
        largura: numOuVazio(form.largura),
        altura: numOuVazio(form.altura),
        comprimento: numOuVazio(form.comprimento),
        volume: volume != null ? volume : vazio,
        pesoLiquido: numOuVazio(form.pesoLiquido),
        pesoBruto: numOuVazio(form.pesoBruto),
        pesoPalete: pesoPalete != null ? pesoPalete : vazio,
        lastro: numOuVazio(form.lastro),
        camada: numOuVazio(form.camada),
        descricao: strOuVazio(form.descricao),
        codigoBarra: strOuVazio(form.codigoBarra),
        codigoBarraDun: strOuVazio(form.codigoBarraDun),
        tipoPalete: strOuVazio(form.tipoPalete),
      }

      if (editingId) {
        await atualizarSku.mutateAsync({ id: editingId, ...payload })
        notifications.show({ title: 'Sucesso', message: 'SKU atualizado', color: 'green' })
      } else {
        await criarSku.mutateAsync(payload)
        notifications.show({ title: 'Sucesso', message: 'SKU criado', color: 'green' })
      }
      setModalOpen(false)
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || err.message, color: 'red' })
    }
  }

  // Gera o EAN-14 (DUN) a partir do EAN-13 informado e preenche o campo.
  function handleGerarEan14() {
    const ean14 = gerarEan14(form.codigoBarra)
    if (!ean14) {
      notifications.show({
        title: 'EAN-13 inválido',
        message: 'Informe um Código de Barras (EAN-13) com 13 dígitos para gerar o EAN-14.',
        color: 'orange',
      })
      return
    }
    updateForm('codigoBarraDun', ean14)
    notifications.show({ title: 'EAN-14 gerado', message: ean14, color: 'green' })
  }

  async function handleDelete(sku: Sku) {
    if (!confirm(`Excluir SKU "${sku.descricao || sku.unidade}"?`)) return
    try {
      await excluirSku.mutateAsync({ id: sku.id, produtoId })
      notifications.show({ title: 'Sucesso', message: 'SKU excluído', color: 'green' })
    } catch {
      notifications.show({ title: 'Erro', message: 'Falha ao excluir', color: 'red' })
    }
  }

  function updateForm(field: string, value: any) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const volumeCalculado = form.largura && form.altura && form.comprimento
    ? ((form.largura * form.altura * form.comprimento) / 1000000).toFixed(6)
    : null

  // Peso palete sugerido: peso bruto da embalagem × total de embalagens no
  // palete (lastro × camada). Exibido como placeholder "Auto: X" e usado no
  // save se o campo ficar vazio.
  const pesoPaleteCalculado = form.pesoBruto && form.lastro && form.camada
    ? (form.pesoBruto * form.lastro * form.camada).toFixed(3)
    : null

  return (
    <div>
      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />
        <Group justify="space-between" mb="md">
          <div>
            <Text fw={600}>SKUs do Produto</Text>
            <Text size="sm" c="dimmed">{produtoNome}</Text>
          </div>
          <Button leftSection={<IconPlus size={16} />} onClick={openNew}>Novo SKU</Button>
        </Group>

        {skus.length === 0 && !isLoading && (
          <Alert icon={<IconPackage size={16} />} color="blue" variant="light">
            Nenhum SKU cadastrado para este produto. Adicione SKUs para definir embalagens, dimensões e pesos.
          </Alert>
        )}

        {skus.length > 0 && (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Seq</Table.Th>
                <Table.Th>Descrição</Table.Th>
                <Table.Th>Cód. Barras</Table.Th>
                <Table.Th>Unidade</Table.Th>
                <Table.Th>Qtd Emb.</Table.Th>
                <Table.Th>Dimensões (cm)</Table.Th>
                <Table.Th>Peso (kg)</Table.Th>
                <Table.Th>Palete</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th className="w-24">Ações</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {skus.map((sku: Sku) => (
                <Table.Tr key={sku.id}>
                  <Table.Td fw={600}>{sku.sequencia}</Table.Td>
                  <Table.Td>{sku.descricao || '—'}</Table.Td>
                  <Table.Td>
                    {sku.codigoBarra ? (
                      <Group gap={4}><IconBarcode size={14} className="text-zinc-400" /><Text size="sm" className="font-mono">{sku.codigoBarra}</Text></Group>
                    ) : '—'}
                    {sku.codigoBarraDun ? <Text size="xs" c="dimmed" className="font-mono">DUN: {sku.codigoBarraDun}</Text> : null}
                  </Table.Td>
                  <Table.Td>{sku.unidade}</Table.Td>
                  <Table.Td>{sku.qtdEmbalagem}</Table.Td>
                  <Table.Td className="text-sm">
                    {sku.largura || sku.altura || sku.comprimento
                      ? `${sku.largura || 0} × ${sku.altura || 0} × ${sku.comprimento || 0}`
                      : '—'}
                    {sku.volume ? <Text size="xs" c="dimmed">{Number(sku.volume).toFixed(4)} m³</Text> : null}
                  </Table.Td>
                  <Table.Td className="text-sm">
                    {sku.pesoLiquido ? `L: ${sku.pesoLiquido}` : ''}
                    {sku.pesoBruto ? ` B: ${sku.pesoBruto}` : ''}
                    {!sku.pesoLiquido && !sku.pesoBruto && '—'}
                  </Table.Td>
                  <Table.Td className="text-sm">
                    {sku.lastro || sku.camada
                      ? `${sku.lastro || 0}×${sku.camada || 0}`
                      : '—'}
                    {sku.tipoPalete ? <Text size="xs" c="dimmed">{sku.tipoPalete}</Text> : null}
                  </Table.Td>
                  <Table.Td>
                    <Badge color={sku.status ? 'green' : 'gray'} variant="light" size="sm">
                      {sku.status ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      <Tooltip label="Editar">
                        <ActionIcon variant="subtle" color="gray" onClick={() => openEdit(sku)}>
                          <IconEdit size={18} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Excluir">
                        <ActionIcon variant="subtle" color="red" onClick={() => handleDelete(sku)}>
                          <IconTrash size={18} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>

      {/* Modal Criar/Editar SKU */}
      <Modal opened={modalOpen} onClose={() => setModalOpen(false)}
        title={editingId ? 'Editar SKU' : 'Novo SKU'} size="xl" centered closeOnClickOutside={false}>

        <SimpleGrid cols={{ base: 1, sm: 3 }} mb="md">
          <NumberInput label="Sequência *" min={1} value={form.sequencia}
            onChange={(v) => updateForm('sequencia', typeof v === 'number' ? v : 1)} />
          <Select label="Unidade *" placeholder="Selecione ou digite" data={UNIDADES}
            value={form.unidade} searchable allowDeselect={false}
            onChange={(v) => updateForm('unidade', v || 'UN')} />
          <NumberInput label="Qtd por Embalagem *" min={1} value={form.qtdEmbalagem}
            onChange={(v) => updateForm('qtdEmbalagem', typeof v === 'number' ? v : 1)} />
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, sm: 2 }} mb="md">
          <TextInput label="Descrição" placeholder="Ex: Caixa com 12 unidades" value={form.descricao}
            onChange={(e) => updateForm('descricao', e.currentTarget.value)} />
          <TextInput label="Código de Barras (EAN-13)" placeholder="7891234567890" value={form.codigoBarra}
            onChange={(e) => updateForm('codigoBarra', e.currentTarget.value)} className="font-mono" />
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, sm: 2 }} mb="md">
          <TextInput
            label="EAN-14 / DUN (caixa)"
            placeholder="Gerado a partir do EAN-13"
            value={form.codigoBarraDun}
            onChange={(e) => updateForm('codigoBarraDun', e.currentTarget.value)}
            className="font-mono"
            rightSectionWidth={40}
            rightSection={
              <Tooltip label="Gerar EAN-14 a partir do EAN-13">
                <ActionIcon variant="light" onClick={handleGerarEan14} aria-label="Gerar EAN-14">
                  <IconWand size={16} />
                </ActionIcon>
              </Tooltip>
            }
          />
        </SimpleGrid>

        <Text fw={600} size="sm" mb="xs" mt="md">Dimensões</Text>
        <SimpleGrid cols={{ base: 2, sm: 4 }} mb="md">
          <NumberInput label="Largura (cm)" min={0} decimalScale={1} value={form.largura}
            onChange={(v) => updateForm('largura', typeof v === 'number' ? v : undefined)} />
          <NumberInput label="Altura (cm)" min={0} decimalScale={1} value={form.altura}
            onChange={(v) => updateForm('altura', typeof v === 'number' ? v : undefined)} />
          <NumberInput label="Comprimento (cm)" min={0} decimalScale={1} value={form.comprimento}
            onChange={(v) => updateForm('comprimento', typeof v === 'number' ? v : undefined)} />
          <NumberInput label="Volume (m³)" min={0} decimalScale={6}
            value={form.volume ?? (volumeCalculado ? Number(volumeCalculado) : undefined)}
            onChange={(v) => updateForm('volume', typeof v === 'number' ? v : undefined)}
            placeholder={volumeCalculado ? `Auto: ${volumeCalculado}` : ''} />
        </SimpleGrid>

        <Text fw={600} size="sm" mb="xs">Pesos</Text>
        <SimpleGrid cols={{ base: 1, sm: 3 }} mb="md">
          <NumberInput label="Peso Líquido (kg)" min={0} decimalScale={3} value={form.pesoLiquido}
            onChange={(v) => updateForm('pesoLiquido', typeof v === 'number' ? v : undefined)} />
          <NumberInput label="Peso Bruto (kg)" min={0} decimalScale={3} value={form.pesoBruto}
            onChange={(v) => updateForm('pesoBruto', typeof v === 'number' ? v : undefined)} />
          <NumberInput label="Peso Palete (kg)" min={0} decimalScale={3}
            value={form.pesoPalete ?? (pesoPaleteCalculado ? Number(pesoPaleteCalculado) : undefined)}
            onChange={(v) => updateForm('pesoPalete', typeof v === 'number' ? v : undefined)}
            placeholder={pesoPaleteCalculado ? `Auto: ${pesoPaleteCalculado}` : ''}
            description={pesoPaleteCalculado ? 'Peso bruto × lastro × camadas' : undefined} />
        </SimpleGrid>

        <Text fw={600} size="sm" mb="xs">Paletização</Text>
        <SimpleGrid cols={{ base: 1, sm: 3 }} mb="md">
          <NumberInput label="Lastro (caixas/camada)" min={0} value={form.lastro}
            onChange={(v) => updateForm('lastro', typeof v === 'number' ? v : undefined)} />
          <NumberInput label="Camadas" min={0} value={form.camada}
            onChange={(v) => updateForm('camada', typeof v === 'number' ? v : undefined)} />
          <Select label="Tipo Palete" placeholder="Selecione ou digite" data={TIPOS_PALETE}
            value={form.tipoPalete || null} searchable clearable
            onChange={(v) => updateForm('tipoPalete', v || '')} />
        </SimpleGrid>

        {form.lastro && form.camada && (
          <Alert icon={<IconPackage size={16} />} color="blue" variant="light" mb="md">
            Total por palete: <strong>{form.lastro * form.camada * form.qtdEmbalagem}</strong> unidades
            ({form.lastro} lastro × {form.camada} camadas × {form.qtdEmbalagem} un/emb)
          </Alert>
        )}

        <Group justify="flex-end">
          <Button variant="default" onClick={() => setModalOpen(false)}>Cancelar</Button>
          <Button leftSection={<IconCheck size={16} />} onClick={handleSave}
            loading={criarSku.isPending || atualizarSku.isPending}
            disabled={!form.unidade || !form.sequencia}>
            {editingId ? 'Salvar' : 'Criar SKU'}
          </Button>
        </Group>
      </Modal>
    </div>
  )
}
