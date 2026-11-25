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
import { ActionIcon, Anchor, Divider, Grid, Group, Select, Stack, TagsInput, Text, TextInput, Tooltip } from '@mantine/core'
import { IconEraser, IconSearch } from '@tabler/icons-react'
import { api } from '@/lib/api'

import SeletorProdutoGrafico, { type ProdutoEscolhido } from '../../../editor/catalogo/SeletorProdutoGrafico'
import type { UseCatalogoItemResultado } from '../../../editor/catalogo/useCatalogoItem'
import { useTiposProduto } from '../../../_hooks/useOpcoesBlocoComum'
import PesquisaAcabadosModal, { type AcabadoEscolhido } from './PesquisaAcabadosModal'
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
  const tipos = useTiposProduto()

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

  const [pesquisaAberta, setPesquisaAberta] = useState(false)
  /** Acabado escolhido: a sigla recebe o código; a Descrição vazia recebe o nome. */
  const escolherAcabado = (a: AcabadoEscolhido) =>
    onChange({
      siglaAcabado: a.codigo.slice(0, MAX_SIGLA_ACABADO),
      ...(value.descricao.trim() ? {} : { descricao: a.nome.slice(0, MAX_DESCRICAO) }),
    })
  // Tributações cadastradas (nome); o valor gravado continua na lista mesmo se não estiver cadastrado.
  const [tributacoes, setTributacoes] = useState<string[]>([])
  useEffect(() => {
    let cancelado = false
    api
      .get('/configurador-grafico/tributacao')
      .then(({ data }) => {
        const lista: Array<{ nome?: string; ativo?: boolean }> = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : []
        if (!cancelado) setTributacoes(lista.filter((t) => t?.ativo !== false && t?.nome).map((t) => String(t.nome)))
      })
      .catch(() => { if (!cancelado) setTributacoes([]) })
    return () => { cancelado = true }
  }, [])
  const opcoesTributacao = useMemo(() => {
    const nomes = [...new Set(tributacoes)]
    if (value.tributacao && !nomes.includes(value.tributacao)) nomes.unshift(value.tributacao)
    return nomes
  }, [tributacoes, value.tributacao])

  const tagsTiragem = useMemo(
    () => value.tiragem.split(/[;,]/).map((s) => s.trim()).filter((s) => s.length > 0),
    [value.tiragem],
  )

  return (
    <Stack gap="md" data-testid="bloco-comum">
      <Grid gutter="md">
        <Grid.Col span={{ base: 12, sm: 6, lg: 4 }}>
          {trocaProduto ? (
            <SeletorProdutoGrafico
              compacto
              value={trocaProduto.produtoGraficoId}
              linhaProdutoId={trocaProduto.linhaProdutoId}
              catalogo={trocaProduto.catalogo}
              disabled={disabled}
              onChange={trocaProduto.onChange}
            />
          ) : (
            <TextInput label="Produto" value={produtoNome?.trim() || ''} readOnly data-testid="bloco-comum-titulo" />
          )}
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, lg: 4 }}>
          <Select
            label="Tipo"
            aria-label="Tipo de Produto"
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
          <Select
            label="Tributação"
            placeholder="Selecione"
            searchable
            data={opcoesTributacao}
            value={value.tributacao || null}
            onChange={(v) => onChange({ tributacao: (v ?? '').slice(0, MAX_TRIBUTACAO) })}
            error={erros.tributacao}
            disabled={disabled}
            nothingFoundMessage="Nenhuma tributação cadastrada"
            comboboxProps={{ withinPortal: true }}
          />
        </Grid.Col>
      </Grid>

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
          <Group gap={6} align="flex-end" wrap="nowrap">
            <TextInput
              label="Sigla Acabado"
              placeholder="Código / Sigla"
              maxLength={MAX_SIGLA_ACABADO}
              value={value.siglaAcabado}
              onChange={(e) => onChange({ siglaAcabado: e.currentTarget.value })}
              onKeyDown={(e) => {
                if (e.key === 'F2' || (e.key === 'Enter' && e.ctrlKey)) {
                  e.preventDefault()
                  setPesquisaAberta(true)
                }
              }}
              title="Lupa ou F2: pesquisar acabados"
              error={erros.siglaAcabado}
              disabled={disabled}
              style={{ flex: 1, minWidth: 0 }}
            />
            <Tooltip label="Pesquisar acabados">
              <ActionIcon
                variant="default"
                size={36}
                aria-label="Pesquisar Sigla Acabado"
                disabled={disabled}
                onClick={() => setPesquisaAberta(true)}
              >
                <IconSearch size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Limpar Sigla Acabado">
              <ActionIcon
                variant="default"
                size={36}
                aria-label="Limpar Sigla Acabado"
                disabled={disabled || !value.siglaAcabado}
                onClick={() => onChange({ siglaAcabado: '' })}
              >
                <IconEraser size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
          <PesquisaAcabadosModal
            opened={pesquisaAberta}
            onClose={() => setPesquisaAberta(false)}
            onEscolher={escolherAcabado}
            codigoInicial={value.siglaAcabado}
          />
        </Grid.Col>
      </Grid>

      <Divider />

      <Grid gutter="md" align="flex-start">
        <Grid.Col span={{ base: 12, md: 8, lg: dimensoes ? 4 : 9 }}>
          <TagsInput
            label={
              <Group justify="space-between" wrap="nowrap" gap="xs" component="span" w="100%">
                <span>Tiragens</span>
                <Text span size="xs" c="dimmed" fw={400}>
                  Pressione Enter ou vírgula para adicionar
                </Text>
              </Group>
            }
            aria-label="Tiragens"
            labelProps={{ style: { width: '100%' } }}
            title="Valem para todos os planos (até 20)"
            placeholder="Ex: 10000"
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
            title="De 1 a 999"
            error={erros.modelos}
            disabled={disabled}
            styles={{ input: { textAlign: 'center', fontWeight: 600 } }}
          />
        </Grid.Col>
        {dimensoes && <Grid.Col span={{ base: 12, lg: 6 }}>{dimensoes}</Grid.Col>}
      </Grid>

      {tipos.erro && (
        <Group gap="xs">
          <Text size="xs" c="red">
            {tipos.erro}
          </Text>
          <Anchor size="xs" component="button" type="button" onClick={() => tipos.tentarNovamente()}>
            Tentar novamente
          </Anchor>
        </Group>
      )}
    </Stack>
  )
}
