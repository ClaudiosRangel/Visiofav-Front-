'use client'

import { useState } from 'react'
import {
  Card, Group, Text, Table, Badge, Button, ActionIcon, Tooltip,
  Modal, TextInput, NumberInput, SimpleGrid, LoadingOverlay, Alert, Select,
} from '@mantine/core'
import { IconPlus, IconEdit, IconTrash, IconBarcode, IconPackage, IconCheck, IconWand } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useSkus, useCriarSku, useAtualizarSku, useExcluirSku, Sku } from '@/data/hooks/useSku'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

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
  larguraUnidade: undefined as number | undefined,
  alturaUnidade: undefined as number | undefined,
  comprimentoUnidade: undefined as number | undefined,
  volumeUnidade: undefined as number | undefined,
  pesoLiquidoUnidade: undefined as number | undefined,
  pesoLiquido: undefined as number | undefined,
  pesoBruto: undefined as number | undefined,
  pesoPalete: undefined as number | undefined,
  lastro: undefined as number | undefined,
  camada: undefined as number | undefined,
  tipoPalete: '',
}

export default function SkuPanel({ produtoId, produtoNome }: SkuPanelProps) {
  const { data: skusResp, isLoading } = useSkus(produtoId)

  // Ocorrência 5 do relatório 3: o EAN-13 do SKU é espelho do EAN-13 oficial do
  // produto (Produto.cEAN) — fonte única, somente leitura (padrão Oracle/SAP de
  // herança pai→filho). Buscamos o produto para obter o cEAN e o código/nome.
  const { data: produtoDetalhe } = useQuery<any>({
    queryKey: ['produto-detalhe-sku', produtoId],
    queryFn: async () => { const { data } = await api.get(`/produtos/${produtoId}`); return data },
    enabled: !!produtoId,
    staleTime: 1000 * 60,
  })
  const produtoCEAN: string = produtoDetalhe?.cEAN || ''
  const produtoCodigo: string = produtoDetalhe?.codigo || ''
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
      larguraUnidade: sku.larguraUnidade != null ? Number(sku.larguraUnidade) : undefined,
      alturaUnidade: sku.alturaUnidade != null ? Number(sku.alturaUnidade) : undefined,
      comprimentoUnidade: sku.comprimentoUnidade != null ? Number(sku.comprimentoUnidade) : undefined,
      volumeUnidade: sku.volumeUnidade != null ? Number(sku.volumeUnidade) : undefined,
      pesoLiquidoUnidade: sku.pesoLiquidoUnidade != null ? Number(sku.pesoLiquidoUnidade) : undefined,
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

      // Volume da unidade (Req 3): se não informado nem derivável das dimensões
      // da unidade, deriva por divisão da cubagem da caixa pelo multiplicador
      // (qtdEmbalagem). A medida real, quando preenchida, tem prioridade.
      let volumeUnidade = form.volumeUnidade != null ? Number(form.volumeUnidade) : undefined
      if (!volumeUnidade && form.larguraUnidade && form.alturaUnidade && form.comprimentoUnidade) {
        volumeUnidade = (form.larguraUnidade * form.alturaUnidade * form.comprimentoUnidade) / 1000000
      }
      if (!volumeUnidade && volume && form.qtdEmbalagem && form.qtdEmbalagem > 0) {
        volumeUnidade = Number((volume / form.qtdEmbalagem).toFixed(6))
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
        larguraUnidade: numOuVazio(form.larguraUnidade),
        alturaUnidade: numOuVazio(form.alturaUnidade),
        comprimentoUnidade: numOuVazio(form.comprimentoUnidade),
        volumeUnidade: volumeUnidade != null ? volumeUnidade : vazio,
        pesoLiquidoUnidade: numOuVazio(form.pesoLiquidoUnidade),
        pesoLiquido: numOuVazio(form.pesoLiquido),
        pesoBruto: numOuVazio(form.pesoBruto),
        pesoPalete: pesoPalete != null ? pesoPalete : vazio,
        lastro: numOuVazio(form.lastro),
        camada: numOuVazio(form.camada),
        descricao: strOuVazio(form.descricao),
        // EAN-13 do SKU espelha o cEAN oficial do produto (fonte única).
        codigoBarra: produtoCEAN ? produtoCEAN.trim() : vazio,
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
    // Gera o EAN-14 a partir do EAN-13 OFICIAL do produto (cEAN), já que o
    // EAN-13 do SKU passou a ser espelho somente leitura.
    const ean14 = gerarEan14(produtoCEAN)
    if (!ean14) {
      notifications.show({
        title: 'EAN-13 inválido',
        message: 'O produto precisa ter um EAN-13 (cEAN) com 13 dígitos no cadastro principal para gerar o EAN-14.',
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

  // Volume da caixa (informado ou calculado das dimensões) usado para derivar a
  // cubagem da unidade por divisão pelo multiplicador (Req 3 / ocorrência 2).
  const volumeCaixaEfetivo = form.volume != null
    ? Number(form.volume)
    : (volumeCalculado ? Number(volumeCalculado) : null)
  const volumeUnidadeDerivado = volumeCaixaEfetivo && form.qtdEmbalagem && form.qtdEmbalagem > 0
    ? (volumeCaixaEfetivo / form.qtdEmbalagem).toFixed(6)
    : null

  // Derivar a cubagem da unidade a partir da caixa ÷ multiplicador (botão).
  function handleDerivarCubagemUnidade() {
    if (!volumeUnidadeDerivado) {
      notifications.show({
        title: 'Não foi possível derivar',
        message: 'Informe o volume (ou dimensões) da caixa e a quantidade por embalagem (> 0).',
        color: 'orange',
      })
      return
    }
    updateForm('volumeUnidade', Number(volumeUnidadeDerivado))
    notifications.show({ title: 'Cubagem da unidade derivada', message: `${volumeUnidadeDerivado} m³`, color: 'green' })
  }

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
          {/* EAN-13 é SOMENTE LEITURA, espelhando o EAN oficial do produto
              (Produto.cEAN). Fonte única evita divergência de digitação
              (Ocorrência 5). O destaque em vermelho identifica o produto dono
              do EAN-13 (pedido literal do relatório). */}
          <TextInput
            label="Código de Barras (EAN-13) — do cadastro do produto"
            value={produtoCEAN}
            readOnly
            disabled={!produtoCEAN}
            className="font-mono"
            placeholder="Preencha o EAN no cadastro principal do produto"
            description={produtoCEAN
              ? <Text size="xs" c="red" fw={600}>EAN-13 de {produtoCodigo || produtoNome}</Text>
              : <Text size="xs" c="orange">Produto sem EAN-13. Informe o EAN na tela de editar produto.</Text>}
          />
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

        <Text fw={600} size="sm" mb="xs" mt="md">Medidas da Caixa / Embalagem (EAN-14)</Text>
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

        {/* Medidas da UNIDADE contida (EAN-13), independentes da caixa (padrão
            GS1 — ocorrência 1). O volume pode ser derivado da caixa ÷
            multiplicador quando não há medida real da unidade (ocorrência 2). */}
        <Group justify="space-between" mb="xs" mt="md">
          <Text fw={600} size="sm">Medidas da Unidade (EAN-13)</Text>
          <Tooltip label="Derivar cubagem da unidade = volume da caixa ÷ qtd por embalagem">
            <Button size="xs" variant="light" leftSection={<IconWand size={14} />}
              onClick={handleDerivarCubagemUnidade} disabled={!volumeUnidadeDerivado}>
              Derivar cubagem da unidade
            </Button>
          </Tooltip>
        </Group>
        <SimpleGrid cols={{ base: 2, sm: 4 }} mb="md">
          <NumberInput label="Largura (cm)" min={0} decimalScale={1} value={form.larguraUnidade}
            onChange={(v) => updateForm('larguraUnidade', typeof v === 'number' ? v : undefined)} />
          <NumberInput label="Altura (cm)" min={0} decimalScale={1} value={form.alturaUnidade}
            onChange={(v) => updateForm('alturaUnidade', typeof v === 'number' ? v : undefined)} />
          <NumberInput label="Comprimento (cm)" min={0} decimalScale={1} value={form.comprimentoUnidade}
            onChange={(v) => updateForm('comprimentoUnidade', typeof v === 'number' ? v : undefined)} />
          <NumberInput label="Volume (m³)" min={0} decimalScale={6}
            value={form.volumeUnidade ?? (volumeUnidadeDerivado ? Number(volumeUnidadeDerivado) : undefined)}
            onChange={(v) => updateForm('volumeUnidade', typeof v === 'number' ? v : undefined)}
            placeholder={volumeUnidadeDerivado ? `Auto: ${volumeUnidadeDerivado}` : ''}
            description={volumeUnidadeDerivado ? 'Caixa ÷ qtd por embalagem' : undefined} />
        </SimpleGrid>
        <SimpleGrid cols={{ base: 2, sm: 4 }} mb="md">
          <NumberInput label="Peso Líquido Unidade (kg)" min={0} decimalScale={3} value={form.pesoLiquidoUnidade}
            onChange={(v) => updateForm('pesoLiquidoUnidade', typeof v === 'number' ? v : undefined)} />
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
