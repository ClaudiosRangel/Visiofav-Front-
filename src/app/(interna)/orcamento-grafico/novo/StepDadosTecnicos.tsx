'use client'

/**
 * StepDadosTecnicos — Task 4 (spec orcamento-grafico-op-relatorio-paridade).
 *
 * Captura os "Dados Técnicos" da peça, divididos em três blocos:
 *  - Dados do Produto (paridade): campos informativos do Calcgraf (sigla
 *    acabado, tributação, processo de impressão, cobertura de tinta,
 *    fabricante, microondulado, fornecido, qtd. modelos, ARTE, observações).
 *    Só são persistidos/exibidos — NÃO afetam o custo (Req 1 e 3).
 *  - Geometria e Formatos: dimensões, abas, fibra, montagem (linhas × colunas),
 *    formatos de suporte/corte e ajuste de corte micro. Montagem e formatos
 *    afetam o cálculo de folhas/consumo no backend (Req 2).
 *  - Acondicionamento: lista editável de atividades de embalagem (máx. 20) +
 *    conteúdo por volume (Req 3).
 *
 * Todos os campos são opcionais. Ligados a `formData`/`updateForm`.
 */

import {
  Stack, Text, Group, Paper, Divider, SimpleGrid, TextInput, Textarea,
  NumberInput, Switch, Button, ActionIcon, Table,
} from '@mantine/core'
import { IconPlus, IconTrash, IconSettings2 } from '@tabler/icons-react'
import type { WizardFormData } from './page'

interface Props {
  formData: WizardFormData
  updateForm: (partial: Partial<WizardFormData>) => void
}

const MAX_ACONDICIONAMENTO = 20

type ItemAcond = { descricao: string }

export default function StepDadosTecnicos({ formData, updateForm }: Props) {
  const acondicionamento: ItemAcond[] = formData.acondicionamento ?? []

  // Helpers de número para NumberInput (value aceita '' quando vazio)
  const numVal = (v?: number | null): number | '' => (typeof v === 'number' ? v : '')
  const onNum = (field: keyof WizardFormData) => (v: number | string) =>
    updateForm({ [field]: typeof v === 'number' ? v : null } as Partial<WizardFormData>)

  // ---- Acondicionamento (tabela editável, padrão do StepItensDiversos) ----
  const addAcond = () =>
    updateForm({ acondicionamento: [...acondicionamento, { descricao: '' }] })
  const updateAcond = (i: number, value: string) => {
    const novo = [...acondicionamento]
    novo[i] = { descricao: value }
    updateForm({ acondicionamento: novo })
  }
  const removeAcond = (i: number) =>
    updateForm({ acondicionamento: acondicionamento.filter((_, idx) => idx !== i) })

  return (
    <Stack gap="lg">
      <Group gap="xs">
        <IconSettings2 size={18} />
        <div>
          <Text fw={600} size="lg">Dados Técnicos</Text>
          <Text size="sm" c="dimmed">
            Dados do produto, geometria/formatos e acondicionamento. Campos
            opcionais — a geometria e a montagem afetam o cálculo de consumo.
          </Text>
        </div>
      </Group>

      {/* ================= Bloco 1 — Dados do Produto (paridade) ================= */}
      <Paper p="md" withBorder>
        <Text fw={600} mb="xs">Dados do Produto (paridade)</Text>
        <Text size="xs" c="dimmed" mb="sm">
          Informações do pré-cálculo do Calcgraf — repassadas ao relatório e à
          OP, sem efeito sobre o custo.
        </Text>

        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="sm">
          <TextInput
            label="Sigla acabado"
            placeholder="Ex.: CTC"
            maxLength={60}
            value={formData.siglaAcabado ?? ''}
            onChange={(e) => updateForm({ siglaAcabado: e.currentTarget.value })}
          />
          <TextInput
            label="Tributação"
            placeholder="Ex.: ICMS + IPI"
            maxLength={60}
            value={formData.tributacao ?? ''}
            onChange={(e) => updateForm({ tributacao: e.currentTarget.value })}
          />
          <TextInput
            label="Processo de impressão"
            placeholder="Ex.: Offset Plana"
            maxLength={60}
            value={formData.processoImpressao ?? ''}
            onChange={(e) => updateForm({ processoImpressao: e.currentTarget.value })}
          />
          <TextInput
            label="Cobertura de tinta"
            placeholder="Ex.: Definição Manual"
            maxLength={60}
            value={formData.coberturaTintaTexto ?? ''}
            onChange={(e) => updateForm({ coberturaTintaTexto: e.currentTarget.value })}
          />
          <TextInput
            label="Fabricante"
            placeholder="Fabricante"
            maxLength={120}
            value={formData.fabricante ?? ''}
            onChange={(e) => updateForm({ fabricante: e.currentTarget.value })}
          />
          <NumberInput
            label="Qtd. modelos"
            placeholder="0"
            min={0}
            allowDecimal={false}
            value={numVal(formData.qtdModelos)}
            onChange={onNum('qtdModelos')}
          />
          <TextInput
            label="ARTE"
            placeholder="Ex.: NOVA"
            maxLength={60}
            value={formData.arte ?? ''}
            onChange={(e) => updateForm({ arte: e.currentTarget.value })}
          />
          <Switch
            label="Microondulado"
            mt="xl"
            checked={!!formData.microondulado}
            onChange={(e) => updateForm({ microondulado: e.currentTarget.checked })}
          />
          <Switch
            label="Fornecido"
            mt="xl"
            checked={!!formData.fornecido}
            onChange={(e) => updateForm({ fornecido: e.currentTarget.checked })}
          />
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm" mt="sm">
          <Textarea
            label="Observação"
            placeholder="Observações gerais do cálculo"
            autosize
            minRows={2}
            maxRows={5}
            maxLength={1000}
            value={formData.observacao ?? ''}
            onChange={(e) => updateForm({ observacao: e.currentTarget.value })}
          />
          <Textarea
            label="Observação de áreas de OP"
            placeholder="Instruções para as áreas de produção"
            autosize
            minRows={2}
            maxRows={5}
            maxLength={1000}
            value={formData.observacaoAreasOp ?? ''}
            onChange={(e) => updateForm({ observacaoAreasOp: e.currentTarget.value })}
          />
        </SimpleGrid>
      </Paper>

      <Divider />

      {/* ================= Bloco 2 — Geometria e Formatos ================= */}
      <Paper p="md" withBorder>
        <Text fw={600} mb="xs">Geometria e Formatos</Text>
        <Text size="xs" c="dimmed" mb="sm">
          A montagem (linhas × colunas) define as peças por folha e os formatos
          de suporte/corte afetam o consumo de material no cálculo.
        </Text>

        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="sm">
          <NumberInput
            label="Comprimento (mm)"
            min={0}
            value={numVal(formData.comprimentoMm)}
            onChange={onNum('comprimentoMm')}
          />
          <NumberInput
            label="Largura (mm)"
            min={0}
            value={numVal(formData.larguraMm)}
            onChange={onNum('larguraMm')}
          />
          <NumberInput
            label="Altura (mm)"
            min={0}
            value={numVal(formData.alturaMm)}
            onChange={onNum('alturaMm')}
          />
          <NumberInput
            label="Aba cola (mm)"
            min={0}
            value={numVal(formData.abaColaMm)}
            onChange={onNum('abaColaMm')}
          />
          <NumberInput
            label="Aba fechamento (mm)"
            min={0}
            value={numVal(formData.abaFechamentoMm)}
            onChange={onNum('abaFechamentoMm')}
          />
          <Switch
            label="Fibra"
            mt="xl"
            checked={!!formData.fibra}
            onChange={(e) => updateForm({ fibra: e.currentTarget.checked })}
          />
          <NumberInput
            label="Montagem — linhas"
            min={1}
            allowDecimal={false}
            value={numVal(formData.montagemLinhas)}
            onChange={onNum('montagemLinhas')}
          />
          <NumberInput
            label="Montagem — colunas"
            min={1}
            allowDecimal={false}
            value={numVal(formData.montagemColunas)}
            onChange={onNum('montagemColunas')}
          />
          <NumberInput
            label="Ajuste corte micro (mm)"
            min={0}
            value={numVal(formData.ajusteCorteMicroMm)}
            onChange={onNum('ajusteCorteMicroMm')}
          />
          <NumberInput
            label="Formato suporte — largura (mm)"
            min={0}
            value={numVal(formData.formatoSupLarguraMm)}
            onChange={onNum('formatoSupLarguraMm')}
          />
          <NumberInput
            label="Formato suporte — altura (mm)"
            min={0}
            value={numVal(formData.formatoSupAlturaMm)}
            onChange={onNum('formatoSupAlturaMm')}
          />
          <NumberInput
            label="Formato de corte — largura (mm)"
            min={0}
            value={numVal(formData.formatoCorteLarguraMm)}
            onChange={onNum('formatoCorteLarguraMm')}
          />
          <NumberInput
            label="Formato de corte — altura (mm)"
            min={0}
            value={numVal(formData.formatoCorteAlturaMm)}
            onChange={onNum('formatoCorteAlturaMm')}
          />
        </SimpleGrid>
      </Paper>

      <Divider />

      {/* ================= Bloco 3 — Acondicionamento ================= */}
      <Paper p="md" withBorder>
        <Group justify="space-between" align="center" mb="xs">
          <Text fw={600}>Acondicionamento</Text>
          <Button
            variant="light"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={addAcond}
            disabled={acondicionamento.length >= MAX_ACONDICIONAMENTO}
          >
            Adicionar
          </Button>
        </Group>
        <Text size="xs" c="dimmed" mb="sm">
          Atividades de embalagem final (ex.: Caixa Padrão, Embalar). Máx. {MAX_ACONDICIONAMENTO}.
        </Text>

        {acondicionamento.length > 0 ? (
          <Table withTableBorder withColumnBorders verticalSpacing="xs" mb="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Descrição</Table.Th>
                <Table.Th w={50} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {acondicionamento.map((item, i) => (
                <Table.Tr key={i}>
                  <Table.Td>
                    <TextInput
                      placeholder="Descrição"
                      value={item.descricao}
                      maxLength={100}
                      onChange={(e) => updateAcond(i, e.currentTarget.value)}
                      size="xs"
                    />
                  </Table.Td>
                  <Table.Td>
                    <ActionIcon variant="subtle" color="red" size="sm" onClick={() => removeAcond(i)}>
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        ) : (
          <Text c="dimmed" size="sm" ta="center" py="sm">Nenhuma atividade de acondicionamento.</Text>
        )}

        <NumberInput
          label="Conteúdo por volume"
          description="Peças por volume (ex.: 900)"
          placeholder="Ex.: 900"
          min={1}
          allowDecimal={false}
          w={{ base: '100%', sm: 240 }}
          value={numVal(formData.conteudoVolume)}
          onChange={onNum('conteudoVolume')}
        />
      </Paper>
    </Stack>
  )
}
