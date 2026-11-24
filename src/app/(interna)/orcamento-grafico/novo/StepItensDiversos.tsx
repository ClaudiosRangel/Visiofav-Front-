'use client'

/**
 * StepItensDiversos — captura os itens complementares do orçamento (Fase 4):
 *  - Itens Diversos (entram no Material Direto; "fixo" não escala com a tiragem)
 *  - Itens Fornecidos pelo cliente (material do cliente — fora do MD)
 *  - Campos Livres (metadados textuais do orçamento, ex.: ARTE, PADRÃO)
 *
 * Todos são opcionais. A validação é apenas visual/leve: o botão "Adicionar"
 * é desabilitado ao atingir o limite máximo de linhas de cada seção.
 */

import { useState } from 'react'
import {
  Stack, Text, Group, Button, Paper, NumberInput, TextInput, ActionIcon,
  Table, Switch, Divider, Autocomplete, Tooltip, Badge, Alert,
} from '@mantine/core'
import { IconPlus, IconTrash, IconListDetails, IconAsterisk, IconAlertCircle } from '@tabler/icons-react'
import type { WizardFormData } from './page'
// Fase 3 (campos livres sugeridos): só o EditorItem passa as props de sugestão; o wizard /novo não.
import {
  adicionarParCampoLivre,
  MAX_CONTEUDO_CAMPO_LIVRE,
  MAX_ROTULO_CAMPO_LIVRE,
  type OpcaoSugerida,
} from '../[id]/editor/campos-livres-puro'

interface Props {
  formData: WizardFormData
  updateForm: (partial: Partial<WizardFormData>) => void
  /**
   * Rótulos sugeridos para os campos livres. Ausente (junto com as outras duas props)
   * = comportamento atual idêntico (TextInput simples). Digitação livre sempre permitida.
   */
  sugestoesRotulos?: ReadonlyArray<string>
  /** Opções sugeridas por rótulo. A opção padrão só recebe o indicador "padrão"; nunca é selecionada. */
  opcoesPorRotulo?: Readonly<Record<string, ReadonlyArray<OpcaoSugerida>>>
  /** Rótulos obrigatórios: só um ícone com tooltip; não bloqueia o salvamento. */
  obrigatorios?: ReadonlySet<string>
  /** Mostra só uma das listas, sem o título geral (usado nas abas da tela do item). Ausente = as três. */
  secao?: 'diversos' | 'fornecidos' | 'livres'
}

const MAX_DIVERSOS = 50
const MAX_FORNECIDOS = 50
const MAX_CAMPOS_LIVRES = 20

type ItemDiverso = { descricao: string; quantidade: number; valor: number; fixo: boolean }
type ItemFornecido = { descricao: string; quantidade: number }
type CampoLivre = { rotulo: string; conteudo: string }

export default function StepItensDiversos({
  formData, updateForm, sugestoesRotulos, opcoesPorRotulo, obrigatorios, secao,
}: Props) {
  const ver = (s: 'diversos' | 'fornecidos' | 'livres') => !secao || secao === s
  // Modo com sugestões: só quando alguma das props opcionais é informada.
  const comSugestoes =
    sugestoesRotulos !== undefined || opcoesPorRotulo !== undefined || obrigatorios !== undefined
  const [avisoCampos, setAvisoCampos] = useState<string | null>(null)
  const itensDiversos: ItemDiverso[] = formData.itensDiversos ?? []
  const itensFornecidos: ItemFornecido[] = formData.itensFornecidos ?? []
  const camposLivres: CampoLivre[] = formData.camposLivres ?? []

  // ---- Itens Diversos ----
  const addDiverso = () =>
    updateForm({ itensDiversos: [...itensDiversos, { descricao: '', quantidade: 1, valor: 0.01, fixo: false }] })
  const updateDiverso = (i: number, field: keyof ItemDiverso, value: any) => {
    const novo = [...itensDiversos]
    novo[i] = { ...novo[i], [field]: value }
    updateForm({ itensDiversos: novo })
  }
  const removeDiverso = (i: number) => updateForm({ itensDiversos: itensDiversos.filter((_, idx) => idx !== i) })

  // ---- Itens Fornecidos ----
  const addFornecido = () =>
    updateForm({ itensFornecidos: [...itensFornecidos, { descricao: '', quantidade: 1 }] })
  const updateFornecido = (i: number, field: keyof ItemFornecido, value: any) => {
    const novo = [...itensFornecidos]
    novo[i] = { ...novo[i], [field]: value }
    updateForm({ itensFornecidos: novo })
  }
  const removeFornecido = (i: number) => updateForm({ itensFornecidos: itensFornecidos.filter((_, idx) => idx !== i) })

  // ---- Campos Livres ----
  const addCampoLivre = () => {
    if (!comSugestoes) {
      updateForm({ camposLivres: [...camposLivres, { rotulo: '', conteudo: '' }] })
      return
    }
    const r = adicionarParCampoLivre(camposLivres, { rotulo: '', conteudo: '' })
    if (r.ok) {
      setAvisoCampos(null)
      updateForm({ camposLivres: r.pares })
    } else {
      setAvisoCampos(r.mensagem)
    }
  }
  const updateCampoLivre = (i: number, field: keyof CampoLivre, value: any) => {
    if (comSugestoes) {
      const texto = String(value ?? '')
      const limite = field === 'rotulo' ? MAX_ROTULO_CAMPO_LIVRE : MAX_CONTEUDO_CAMPO_LIVRE
      if (texto.length > limite) {
        setAvisoCampos(
          field === 'rotulo'
            ? `O rótulo aceita no máximo ${MAX_ROTULO_CAMPO_LIVRE} caracteres.`
            : `O conteúdo aceita no máximo ${MAX_CONTEUDO_CAMPO_LIVRE} caracteres.`,
        )
        return
      }
      setAvisoCampos(null)
    }
    const novo = [...camposLivres]
    novo[i] = { ...novo[i], [field]: value }
    updateForm({ camposLivres: novo })
  }
  const removeCampoLivre = (i: number) => {
    setAvisoCampos(null)
    updateForm({ camposLivres: camposLivres.filter((_, idx) => idx !== i) })
  }

  // Opções (valores) sugeridas para o rótulo da linha; a padrão é só indicada.
  const opcoesDoRotulo = (rotulo: string): ReadonlyArray<OpcaoSugerida> =>
    opcoesPorRotulo?.[rotulo.trim()] ?? []

  return (
    <Stack gap="lg">
      {!secao && (
      <Group gap="xs">
        <IconListDetails size={18} />
        <div>
          <Text fw={600} size="lg">Itens Complementares</Text>
          <Text size="sm" c="dimmed">
            Itens diversos, materiais fornecidos pelo cliente e campos livres do orçamento (todos opcionais).
          </Text>
        </div>
      </Group>
      )}

      {/* ================= Itens Diversos ================= */}
      {ver('diversos') && (
      <Paper p="md" withBorder>
        <Group justify="space-between" align="center" mb="sm">
          <Text fw={600}>Itens Diversos</Text>
          <Button
            variant="light"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={addDiverso}
            disabled={itensDiversos.length >= MAX_DIVERSOS}
          >
            Adicionar
          </Button>
        </Group>
        <Text size="xs" c="dimmed" mb="sm">
          Entram no Material Direto. Marque &quot;Fixo&quot; quando o custo não escala com a tiragem.
        </Text>

        {itensDiversos.length > 0 ? (
          <Table withTableBorder withColumnBorders verticalSpacing="xs">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Descrição</Table.Th>
                <Table.Th w={140}>Quantidade</Table.Th>
                <Table.Th w={160}>Valor</Table.Th>
                <Table.Th w={90}>Fixo</Table.Th>
                <Table.Th w={50} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {itensDiversos.map((item, i) => (
                <Table.Tr key={i}>
                  <Table.Td>
                    <TextInput
                      placeholder="Descrição"
                      value={item.descricao}
                      maxLength={200}
                      onChange={(e) => updateDiverso(i, 'descricao', e.currentTarget.value)}
                      size="xs"
                    />
                  </Table.Td>
                  <Table.Td>
                    <NumberInput
                      value={item.quantidade}
                      onChange={(v) => updateDiverso(i, 'quantidade', typeof v === 'number' && v > 0 ? v : 1)}
                      min={0.001}
                      decimalScale={3}
                      size="xs"
                      disabled={item.fixo}
                      description={item.fixo ? 'ignorada (fixo)' : undefined}
                    />
                  </Table.Td>
                  <Table.Td>
                    <NumberInput
                      value={item.valor}
                      onChange={(v) => updateDiverso(i, 'valor', typeof v === 'number' && v > 0 ? v : 0.01)}
                      prefix="R$ "
                      min={0.01}
                      decimalScale={2}
                      size="xs"
                    />
                  </Table.Td>
                  <Table.Td>
                    <Switch
                      checked={item.fixo}
                      onChange={(e) => updateDiverso(i, 'fixo', e.currentTarget.checked)}
                      size="sm"
                    />
                  </Table.Td>
                  <Table.Td>
                    <ActionIcon variant="subtle" color="red" size="sm" onClick={() => removeDiverso(i)}>
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        ) : (
          <Text c="dimmed" size="sm" ta="center" py="sm">Nenhum item diverso.</Text>
        )}
      </Paper>
      )}

      {!secao && <Divider />}

      {/* ================= Itens Fornecidos pelo cliente ================= */}
      {ver('fornecidos') && (
      <Paper p="md" withBorder>
        <Group justify="space-between" align="center" mb="sm">
          <Text fw={600}>Itens Fornecidos pelo cliente</Text>
          <Button
            variant="light"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={addFornecido}
            disabled={itensFornecidos.length >= MAX_FORNECIDOS}
          >
            Adicionar
          </Button>
        </Group>
        <Text size="xs" c="dimmed" mb="sm">
          Material fornecido pelo cliente — não entra no Material Direto.
        </Text>

        {itensFornecidos.length > 0 ? (
          <Table withTableBorder withColumnBorders verticalSpacing="xs">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Descrição</Table.Th>
                <Table.Th w={160}>Quantidade</Table.Th>
                <Table.Th w={50} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {itensFornecidos.map((item, i) => (
                <Table.Tr key={i}>
                  <Table.Td>
                    <TextInput
                      placeholder="Descrição"
                      value={item.descricao}
                      maxLength={200}
                      onChange={(e) => updateFornecido(i, 'descricao', e.currentTarget.value)}
                      size="xs"
                    />
                  </Table.Td>
                  <Table.Td>
                    <NumberInput
                      value={item.quantidade}
                      onChange={(v) => updateFornecido(i, 'quantidade', typeof v === 'number' && v > 0 ? v : 1)}
                      min={0.001}
                      decimalScale={3}
                      size="xs"
                    />
                  </Table.Td>
                  <Table.Td>
                    <ActionIcon variant="subtle" color="red" size="sm" onClick={() => removeFornecido(i)}>
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        ) : (
          <Text c="dimmed" size="sm" ta="center" py="sm">Nenhum item fornecido.</Text>
        )}
      </Paper>
      )}

      {!secao && <Divider />}

      {/* ================= Campos Livres ================= */}
      {ver('livres') && (
      <Paper p="md" withBorder>
        <Group justify="space-between" align="center" mb="sm">
          <Text fw={600}>Campos Livres</Text>
          <Button
            variant="light"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={addCampoLivre}
            disabled={camposLivres.length >= MAX_CAMPOS_LIVRES}
          >
            Adicionar
          </Button>
        </Group>
        <Text size="xs" c="dimmed" mb="sm">
          Informações textuais do orçamento. Ex.: ARTE, PADRÃO.
        </Text>
        {comSugestoes && avisoCampos && (
          <Alert icon={<IconAlertCircle size={16} />} color="yellow" p="xs" mb="sm" withCloseButton onClose={() => setAvisoCampos(null)}>
            {avisoCampos}
          </Alert>
        )}

        {camposLivres.length > 0 ? (
          <Table withTableBorder withColumnBorders verticalSpacing="xs">
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={220}>Rótulo</Table.Th>
                <Table.Th>Conteúdo</Table.Th>
                <Table.Th w={50} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {camposLivres.map((campo, i) => (
                <Table.Tr key={i}>
                  {comSugestoes ? (
                    <>
                      <Table.Td>
                        <Autocomplete
                          placeholder="Rótulo"
                          value={campo.rotulo}
                          data={Array.from(new Set(sugestoesRotulos ?? []))}
                          onChange={(v) => updateCampoLivre(i, 'rotulo', v)}
                          size="xs"
                          comboboxProps={{ withinPortal: true }}
                          rightSection={
                            obrigatorios?.has(campo.rotulo.trim()) ? (
                              <Tooltip label="obrigatório" withArrow>
                                <IconAsterisk size={12} color="var(--mantine-color-red-filled)" aria-label="obrigatório" />
                              </Tooltip>
                            ) : undefined
                          }
                        />
                      </Table.Td>
                      <Table.Td>
                        <Autocomplete
                          placeholder="Conteúdo"
                          value={campo.conteudo}
                          data={Array.from(new Set(opcoesDoRotulo(campo.rotulo).map((o) => o.valor)))}
                          onChange={(v) => updateCampoLivre(i, 'conteudo', v)}
                          renderOption={({ option }) => (
                            <Group gap="xs" justify="space-between" wrap="nowrap" style={{ width: '100%' }}>
                              <Text size="sm">{option.value}</Text>
                              {opcoesDoRotulo(campo.rotulo).some((o) => o.valor === option.value && o.padrao) && (
                                <Badge size="xs" variant="light">padrão</Badge>
                              )}
                            </Group>
                          )}
                          size="xs"
                          comboboxProps={{ withinPortal: true }}
                        />
                      </Table.Td>
                    </>
                  ) : (
                    <>
                      <Table.Td>
                        <TextInput
                          placeholder="Rótulo"
                          value={campo.rotulo}
                          maxLength={50}
                          onChange={(e) => updateCampoLivre(i, 'rotulo', e.currentTarget.value)}
                          size="xs"
                        />
                      </Table.Td>
                      <Table.Td>
                        <TextInput
                          placeholder="Conteúdo"
                          value={campo.conteudo}
                          maxLength={500}
                          onChange={(e) => updateCampoLivre(i, 'conteudo', e.currentTarget.value)}
                          size="xs"
                        />
                      </Table.Td>
                    </>
                  )}
                  <Table.Td>
                    <ActionIcon variant="subtle" color="red" size="sm" onClick={() => removeCampoLivre(i)}>
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        ) : (
          <Text c="dimmed" size="sm" ta="center" py="sm">Nenhum campo livre.</Text>
        )}
      </Paper>
      )}
    </Stack>
  )
}
