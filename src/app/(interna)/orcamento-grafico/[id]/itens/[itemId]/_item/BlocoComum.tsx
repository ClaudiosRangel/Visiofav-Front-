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
 * `SeletorProdutoGrafico` existente e só aparece quando o pai informa `trocaProduto`.
 */

import { useMemo, useState } from 'react'
import { Anchor, Autocomplete, Button, Collapse, Group, Paper, Select, SimpleGrid, Stack, Text, TextInput, ThemeIcon, Title } from '@mantine/core'
import { IconChevronDown, IconChevronUp, IconPackage, IconSearch } from '@tabler/icons-react'

import SeletorProdutoGrafico, { type ProdutoEscolhido } from '../../../editor/catalogo/SeletorProdutoGrafico'
import type { UseCatalogoItemResultado } from '../../../editor/catalogo/useCatalogoItem'
import { useSiglasAcabado, useTiposProduto } from '../../../_hooks/useOpcoesBlocoComum'
import { MAX_DESCRICAO, MAX_SIGLA_ACABADO, MAX_TRIBUTACAO, MODELOS_PADRAO, validarComum, type ValorComum } from './comum-item'

export interface TrocaProduto {
  /** Produto Gráfico atual do item. */
  produtoGraficoId: string | null | undefined
  /** Linha de Produto do orçamento (filtra o seletor). */
  linhaProdutoId?: string | null
  /** Estado do catálogo (mensagens de carga/erro abaixo do seletor). */
  catalogo?: UseCatalogoItemResultado
  /** Escolha/limpeza do produto; o pai reaplica o layout e os padrões. */
  onChange: (produto: ProdutoEscolhido | null) => void
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
}

function Rotulo({ children }: { children: string }) {
  return (
    <Text size="xs" fw={600} tt="uppercase" c="dimmed" style={{ letterSpacing: '0.04em' }}>
      {children}
    </Text>
  )
}

export default function BlocoComum({ value, onChange, produtoNome, trocaProduto, validarVazios, disabled }: BlocoComumProps) {
  const [trocaAberta, setTrocaAberta] = useState(false)
  const tipos = useTiposProduto()
  const siglas = useSiglasAcabado()

  const { erros } = useMemo(() => validarComum(value, { validarVazios }), [value, validarVazios])
  const opcoesTipo = useMemo(() => tipos.tipos.map((t) => ({ value: t.id, label: t.descricao })), [tipos.tipos])

  return (
    <Paper withBorder radius="md" p="lg" shadow="xs" data-testid="bloco-comum">
      <Stack gap="md">
        <Group justify="space-between" align="center" wrap="nowrap">
          <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
            <ThemeIcon variant="light" color="blue" size={44} radius="md">
              <IconPackage size={26} stroke={1.5} />
            </ThemeIcon>
            <div style={{ minWidth: 0 }}>
              <Rotulo>Produto</Rotulo>
              <Title order={3} lineClamp={1} data-testid="bloco-comum-titulo">
                {produtoNome?.trim() || 'Produto não definido'}
              </Title>
            </div>
          </Group>
          {trocaProduto && (
            <Button
              variant="subtle"
              size="xs"
              disabled={disabled}
              rightSection={trocaAberta ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
              onClick={() => setTrocaAberta((v) => !v)}
            >
              Trocar produto
            </Button>
          )}
        </Group>

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

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
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
          <TextInput
            label="Descrição"
            placeholder="Descrição do item"
            maxLength={MAX_DESCRICAO}
            value={value.descricao}
            onChange={(e) => onChange({ descricao: e.currentTarget.value })}
            description={`${value.descricao.length}/${MAX_DESCRICAO}`}
            error={erros.descricao}
            disabled={disabled}
          />
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
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
          <TextInput
            label="Tributação"
            placeholder="Ex.: ICMS + IPI"
            maxLength={MAX_TRIBUTACAO}
            value={value.tributacao}
            onChange={(e) => onChange({ tributacao: e.currentTarget.value })}
            error={erros.tributacao}
            disabled={disabled}
          />
          <TextInput
            label="Tiragem"
            placeholder="Ex.: 4.000"
            inputMode="numeric"
            value={value.tiragem}
            onChange={(e) => onChange({ tiragem: e.currentTarget.value })}
            error={erros.tiragem}
            disabled={disabled}
          />
          <TextInput
            label="Modelos"
            placeholder={MODELOS_PADRAO}
            inputMode="numeric"
            value={value.modelos}
            onChange={(e) => onChange({ modelos: e.currentTarget.value })}
            description="De 1 a 999 (padrão 1)"
            error={erros.modelos}
            disabled={disabled}
          />
        </SimpleGrid>

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
    </Paper>
  )
}
