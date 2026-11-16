'use client'

/**
 * SecaoProduto — seção "Produto" do Editor de Item do Orçamento Gráfico
 * (experiência Calcgraf).
 *
 * Feature: orcamento-grafico-experiencia-calcgraf (Tarefa 5.1)
 * _Requirements: 1.1, 1.5, 1.6_
 *
 * Agrupa numa única seção os sub-forms de engenharia de PRODUTO que no wizard
 * atual (`../../novo/`) eram três telas separadas: Tipo → Medidas → Papel.
 * Replica a composição do step 0 ("Produto") do `ItemWizardModal` — os três
 * `Step*` empilhados num `Stack`, com `Divider` separando as subdivisões
 * "Medidas" e "Papel / Cartão".
 *
 * Componente de APRESENTAÇÃO: apenas compõe os sub-forms existentes e repassa
 * `formData`/`updateForm`. Sem lógica de cálculo, salvamento ou recálculo
 * implícito. O título da seção fica a cargo do `EditorItem` (não é repetido
 * aqui).
 */

import { Stack, Divider, Paper, Group, Image, ThemeIcon, Text, Badge, Tooltip } from '@mantine/core'
import { IconPackage, IconInfoCircle, IconAlertTriangle } from '@tabler/icons-react'

import type { WizardFormData } from '../../novo/page'
import StepTipo from '../../novo/StepTipo'
import StepMedidas from '../../novo/StepMedidas'
import StepPapel from '../../novo/StepPapel'
import type { CampoCondicional } from './campos-por-linha'
import SeletorProdutoGrafico, { type ProdutoEscolhido } from './catalogo/SeletorProdutoGrafico'
import type { UseCatalogoItemResultado } from './catalogo/useCatalogoItem'
import type { UseSugestoesProdutoResultado } from './useSugestoesProduto'

/** Aviso discreto (ícone + texto xs + tooltip), sem modal. */
function AvisoDiscreto({ texto, detalhe }: { texto: string; detalhe?: string }) {
  return (
    <Tooltip label={detalhe ?? texto} multiline maw={320} withArrow>
      <Group gap={4} wrap="nowrap" align="flex-start">
        <IconAlertTriangle size={14} color="var(--mantine-color-yellow-6)" style={{ flexShrink: 0, marginTop: 2 }} />
        <Text size="xs" c="dimmed">{texto}</Text>
      </Group>
    </Tooltip>
  )
}

interface Props {
  formData: WizardFormData
  updateForm: (partial: Partial<WizardFormData>) => void
  /** Linha de Produto do orçamento (filtra o seletor de Produto Gráfico). */
  linhaProdutoId?: string | null
  /** Estado do catálogo carregado pelo EditorItem (mensagens de carga/erro). */
  catalogoItem?: UseCatalogoItemResultado
  /** Escolha/limpeza do Produto Gráfico; o EditorItem aplica defaults e guarda o id. */
  onProdutoChange?: (produto: ProdutoEscolhido | null) => void
  /** Sugestões do produto (origem do tipo e avisos); ausente = nada é exibido. */
  sugestoes?: UseSugestoesProdutoResultado
  /**
   * Campos condicionais por Linha de Produto a exibir. Recebido do EditorItem
   * para consistência de assinatura; a ocultação de campos condicionais da
   * seção Produto (ex.: alça/fundo) fica para depois — os campos condicionais
   * mapeáveis hoje vivem em Dados Técnicos (ver SecaoDadosTecnicos). A seção
   * Produto segue exibindo Tipo/Medidas/Papel na íntegra.
   */
  mostrarCampo?: (campo: CampoCondicional) => boolean
}

export default function SecaoProduto({
  formData,
  updateForm,
  linhaProdutoId,
  catalogoItem,
  onProdutoChange,
  sugestoes,
}: Props) {
  const avisos = sugestoes?.avisos
  const tipoPreenchido = !!formData.tipoEmbalagemId
  const precoPreenchido = Number(formData.precoKg ?? 0) > 0
  const mensagemPreco =
    avisos?.preco === 'SEM_PAPEL'
      ? 'Preço não encontrado'
      : avisos?.preco === 'MAIS_DE_UM'
        ? 'Mais de um papel encontrado'
        : null
  // Resumo do produto/embalagem selecionado (informação do produto no topo da
  // seção — Req 4). Usa o tipo de embalagem escolhido + nome/foto do produto
  // cadastrado quando houver. Estado vazio quando nada foi selecionado ainda.
  const tipo = formData.tipoEmbalagem as { descricao?: string; codigo?: string } | null | undefined
  const nomeProduto = formData.produtoNome?.trim() || undefined
  const fotoProduto = formData._imagemProdutoUrl
  const temProduto = !!(tipo?.descricao || nomeProduto || fotoProduto)

  return (
    <Stack gap="xl">
      {/* Produto Gráfico do catálogo (opcional): só aparece quando o editor liga o seletor. */}
      {onProdutoChange && (
        <SeletorProdutoGrafico
          value={formData.produtoGraficoId}
          linhaProdutoId={linhaProdutoId}
          catalogo={catalogoItem}
          onChange={onProdutoChange}
        />
      )}

      {/* Resumo "Informação do Produto" */}
      <Paper withBorder p="md" bg="var(--mantine-color-default)">
        {temProduto ? (
          <Group gap="md" wrap="nowrap">
            {fotoProduto ? (
              <Image src={fotoProduto} alt={nomeProduto ?? 'Produto'} w={56} h={56} fit="contain" radius="sm" />
            ) : (
              <ThemeIcon variant="light" color="gray" size={56} radius="sm">
                <IconPackage size={32} stroke={1.5} />
              </ThemeIcon>
            )}
            <div style={{ flex: 1 }}>
              <Text size="xs" c="dimmed">Produto deste orçamento</Text>
              <Text fw={600}>{nomeProduto ?? tipo?.descricao ?? 'Produto'}</Text>
              {tipo?.descricao && (
                <Group gap={6} mt={4}>
                  <Badge size="sm" variant="light" color="teal">{tipo.descricao}</Badge>
                  {tipo.codigo && <Badge size="sm" variant="light" color="gray">{tipo.codigo}</Badge>}
                </Group>
              )}
            </div>
          </Group>
        ) : (
          <Group gap="md" wrap="nowrap">
            <ThemeIcon variant="light" color="gray" size={56} radius="sm">
              <IconPackage size={32} stroke={1.5} />
            </ThemeIcon>
            <div>
              <Text fw={600}>Nenhum produto selecionado</Text>
              <Text size="sm" c="dimmed">Escolha o Tipo de Embalagem abaixo para montar o produto.</Text>
            </div>
          </Group>
        )}
      </Paper>

      <Stack gap={6}>
        <StepTipo formData={formData} updateForm={updateForm} />
        {sugestoes?.origemTipoEmbalagem === 'PRODUTO' && (
          <Group gap={4} wrap="nowrap">
            <IconInfoCircle size={14} color="var(--mantine-color-blue-6)" />
            <Text size="xs" c="dimmed">sugerido pelo produto</Text>
          </Group>
        )}
        {avisos?.tipoInativo && !tipoPreenchido && (
          <AvisoDiscreto
            texto="Tipo de embalagem do produto está inativo"
            detalhe="O tipo de embalagem vinculado ao produto está inativo e não foi preenchido. Escolha o tipo manualmente."
          />
        )}
      </Stack>
      <Divider label="Medidas" labelPosition="center" />
      <StepMedidas formData={formData} updateForm={updateForm} />
      <Divider label="Papel / Cartão" labelPosition="center" />
      <StepPapel formData={formData} updateForm={updateForm} />
      {(avisos?.falhas?.length ?? 0) > 0 && (
        <Stack gap={4}>
          {avisos!.falhas.map((f) => (
            <AvisoDiscreto key={f} texto={f} />
          ))}
        </Stack>
      )}
      {mensagemPreco && !precoPreenchido && (
        <AvisoDiscreto
          texto={mensagemPreco}
          detalhe={
            avisos?.preco === 'SEM_PAPEL'
              ? 'Nenhum papel com preço foi encontrado para o suporte e a gramatura. Informe o preço por kg.'
              : 'Há mais de um papel com esse suporte e gramatura. Escolha o papel ou informe o preço por kg.'
          }
        />
      )}
    </Stack>
  )
}
