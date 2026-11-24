'use client'

/**
 * BlocoComum — dados comuns do Item (valem para todos os planos).
 *
 * Produto (somente leitura, vira o título), Tipo de Produto, Descrição (até 200), Sigla Acabado
 * (até 60, com busca no cadastro; aceita texto livre), Tributação, Tiragem e Modelos (1 a 999,
 * padrão 1).
 *
 * Componente CONTROLADO: o estado vive no pai (`value`/`onChange`), não grava nada e não chama o
 * motor. A leitura das listas de apoio vem de hooks. A troca de Produto (R7.8) reaproveita o
 * `SeletorProdutoGrafico` existente e só aparece quando o pai informa `trocaProduto`; com
 * `trocaProduto.abertoInicial` (item novo) o seletor já vem aberto e habilitado.
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Anchor, Autocomplete, Button, Collapse, Divider, Grid, Group, Input, Paper, Select, Stack, TagsInput, Text, TextInput } from '@mantine/core'
import { IconChevronDown, IconChevronUp, IconPackage, IconSearch } from '@tabler/icons-react'

import SeletorProdutoGrafico, { type ProdutoEscolhido } from '../../../editor/catalogo/SeletorProdutoGrafico'
import type { UseCatalogoItemResultado } from '../../../editor/catalogo/useCatalogoItem'
import { useSiglasAcabado, useTiposProduto } from '../../../_hooks/useOpcoesBlocoComum'
import { MAX_DESCRICAO, MAX_SIGLA_ACABADO, MAX_TRIBUTACAO, MODELOS_PADRAO, tiposPermitidosDaLinha, validarComum, type ValorComum } from './comum-item'
import { produtosApi } from '../../../../cadastros/_shared/cadastros-graficos.api'

export interface TrocaProduto {
  /** Produto Gráfico atual do item. */
  produtoGraficoId: string | null | undefined
  /** Linha de Produto do orçamento (filtra o seletor). */
  linhaProdutoId?: string | null
  /** Estado do catálogo (mensagens de carga/erro abaixo do seletor). */
  catalogo?: UseCatalogoItemResultado
  /** Escolha/limpeza do produto; o pai reaplica o layout e os padrões. */
  onChange: (produto: ProdutoEscolhido | null) => void
  /** Abre o seletor de Produto já na montagem (item novo: escolher o produto é o primeiro passo). */
  abertoInicial?: boolean
}

export interface BlocoComumProps {
  value: ValorComum
  onChange: (parcial: Partial<ValorComum>) => void
  /** Nome do Produto Gráfico (título da tela). */
  produtoNome?: string | null
  trocaProduto?: TrocaProduto
  /** Exige os campos obrigatórios (ligue após uma tentativa de salvar). */
  validarVazios?: boolean
  disabled?: boolean
  /** Grupo de dimensões exibido ao lado das tiragens (bloco Formato embutido). */
  dimensoes?: ReactNode
}

export default function BlocoComum({ value, onChange, produtoNome, trocaProduto, validarVazios, disabled, dimensoes }: BlocoComumProps) {
  const [trocaAberta, setTrocaAberta] = useState(() => !!trocaProduto?.abertoInicial)
  const tipos = useTiposProduto()
  const siglas = useSiglasAcabado()

  const { erros } = useMemo(() => validarComum(value, { validarVazios }), [value, validarVazios])
  // Produtos ativos (com linha e tipo) para limitar o Tipo de Produto aos tipos da linha do produto.
  const [produtosAtivos, setProdutosAtivos] = useState<Array<{ id: string; linhaProdutoId: string | null; tipoEmbalagemId?: string | null }>>([])
  useEffect(() => {
    let cancelado = false
    produtosApi
      .listar({ situacao: 'ativo' })
      .then((lista) => { if (!cancelado) setProdutosAtivos(Array.isArray(lista) ? lista : []) })
      .catch(() => { if (!cancelado) setProdutosAtivos([]) })
    return () => { cancelado = true }
  }, [])
  const permitidos = useMemo(
    () => tiposPermitidosDaLinha(trocaProduto?.produtoGraficoId, produtosAtivos, value.tipoEmbalagemId),
    [trocaProduto?.produtoGraficoId, produtosAtivos, value.tipoEmbalagemId],
  )
  const opcoesTipo = useMemo(
    () => tipos.tipos.filter((t) => !permitidos || permitidos.has(t.id)).map((t) => ({ value: t.id, label: t.descricao })),
    [tipos.tipos, permitidos],
  )

  const tagsTiragem = useMemo(
    () => value.tiragem.split(/[;,]/).map((s) => s.trim()).filter((s) => s.length > 0),
    [value.tiragem],
  )

  return (
    <Stack gap="md" data-testid="bloco-comum">
      <Grid gutter="md">
        <Grid.Col span={{ base: 12, sm: 6, lg: 4 }}>
          <Input.Wrapper label="Produto">
            <Group
              gap="xs"
              wrap="nowrap"
              justify="space-between"
              px="sm"
              mt={4}
              style={{
                minHeight: 36,
                border: '1px solid var(--mantine-color-default-border)',
                borderRadius: 'var(--mantine-radius-sm)',
              }}
            >
              <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
                <IconPackage size={16} stroke={1.5} />
                <Text size="sm" fw={600} lineClamp={1} data-testid="bloco-comum-titulo">
                  {produtoNome?.trim() || 'Produto não definido'}
                </Text>
              </Group>
              {trocaProduto && (
                <Button
                  variant="subtle"
                  size="compact-xs"
                  disabled={disabled}
                  rightSection={trocaAberta ? <IconChevronUp size={12} /> : <IconChevronDown size={12} />}
                  onClick={() => setTrocaAberta((v) => !v)}
                >
                  Trocar produto
                </Button>
              )}
            </Group>
          </Input.Wrapper>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, lg: 4 }}>
          <Select
            label="Tipo de Produto"
            placeholder={tipos.carregando ? 'Carregando…' : 'Selecione o tipo'}
            searchable
            data={opcoesTipo}
            value={value.tipoEmbalagemId}
            onChange={(v) => onChange({ tipoEmbalagemId: v })}
            error={erros.tipoEmbalagemId}
            disabled={disabled}
            nothingFoundMessage="Nenhum tipo encontrado"
            comboboxProps={{ withinPortal: true }}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 4 }}>
          <TextInput
            label="Tributação"
            placeholder="Ex.: ICMS + IPI"
            maxLength={MAX_TRIBUTACAO}
            value={value.tributacao}
            onChange={(e) => onChange({ tributacao: e.currentTarget.value })}
            error={erros.tributacao}
            disabled={disabled}
          />
        </Grid.Col>
      </Grid>

      {trocaProduto && (
        <Collapse in={trocaAberta}>
          <Paper withBorder radius="md" p="sm" bg="var(--mantine-color-default)">
            <SeletorProdutoGrafico
              value={trocaProduto.produtoGraficoId}
              linhaProdutoId={trocaProduto.linhaProdutoId}
              catalogo={trocaProduto.catalogo}
              disabled={disabled}
              onChange={trocaProduto.onChange}
            />
          </Paper>
        </Collapse>
      )}

      <Grid gutter="md">
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <TextInput
            label="Descrição"
            placeholder="Descrição do item"
            maxLength={MAX_DESCRICAO}
            value={value.descricao}
            onChange={(e) => onChange({ descricao: e.currentTarget.value })}
            rightSection={
              <Text size="xs" c="dimmed">
                {value.descricao.length}/{MAX_DESCRICAO}
              </Text>
            }
            rightSectionWidth={64}
            error={erros.descricao}
            disabled={disabled}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Autocomplete
            label="Sigla Acabado"
            placeholder="Buscar ou digitar"
            maxLength={MAX_SIGLA_ACABADO}
            data={siglas.siglas}
            limit={20}
            leftSection={<IconSearch size={14} />}
            value={value.siglaAcabado}
            onChange={(v) => onChange({ siglaAcabado: v })}
            error={erros.siglaAcabado}
            disabled={disabled}
          />
        </Grid.Col>
      </Grid>

      <Divider />

      <Grid gutter="md" align="flex-start">
        <Grid.Col span={{ base: 12, md: 8, lg: dimensoes ? 4 : 9 }}>
          <TagsInput
            label="Tiragens"
            description="Enter ou vírgula adiciona (até 20). Valem para todos os planos."
            placeholder={tagsTiragem.length === 0 ? 'Ex.: 10000' : ''}
            value={tagsTiragem}
            onChange={(lista) => onChange({ tiragem: lista.join(', ') })}
            splitChars={[',', ';']}
            clearable
            error={erros.tiragem}
            disabled={disabled}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 4, lg: dimensoes ? 2 : 3 }}>
          <TextInput
            label="Modelos"
            placeholder={MODELOS_PADRAO}
            inputMode="numeric"
            value={value.modelos}
            onChange={(e) => onChange({ modelos: e.currentTarget.value })}
            description="1 a 999"
            error={erros.modelos}
            disabled={disabled}
          />
        </Grid.Col>
        {dimensoes && <Grid.Col span={{ base: 12, lg: 6 }}>{dimensoes}</Grid.Col>}
      </Grid>

      {(tipos.erro || siglas.erro) && (
        <Group gap="xs">
          <Text size="xs" c="red">
            {tipos.erro ?? siglas.erro}
          </Text>
          <Anchor
            size="xs"
            component="button"
            type="button"
            onClick={() => {
              if (tipos.erro) tipos.tentarNovamente()
              if (siglas.erro) siglas.tentarNovamente()
            }}
          >
            Tentar novamente
          </Anchor>
        </Group>
      )}
    </Stack>
  )
}
