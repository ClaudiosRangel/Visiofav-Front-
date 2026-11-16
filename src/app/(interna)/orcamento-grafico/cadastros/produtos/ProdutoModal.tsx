'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Modal, Tabs, Stack, Group, Button, TextInput, NumberInput, Select, Switch, SimpleGrid, Text, Loader,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { api } from '@/lib/api'
import { produtosApi, mensagemErroApi } from '../_shared/cadastros-graficos.api'
import type { ModoFormato, ProdutoGrafico, ProdutoGraficoInput } from '../_shared/cadastros-graficos.types'
import AbaDefaultsPlano from './AbaDefaultsPlano'
import AbaRelacoesProduto from './AbaRelacoesProduto'

const MODOS_FORMATO: { value: ModoFormato; label: string }[] = [
  { value: 'TRES_DIMENSOES', label: 'Três dimensões' },
  { value: 'DUAS_DIMENSOES', label: 'Duas dimensões' },
  { value: 'ABERTO_FECHADO', label: 'Aberto / fechado' },
  { value: 'SANFONA_ABAS', label: 'Sanfona / abas' },
  { value: 'PAGINA', label: 'Página' },
]

type NumCampo = number | ''

interface FormState {
  codigo: string
  nome: string
  status: boolean
  baseUnidadePreco: string
  prazoProducaoDias: NumCampo
  tipoCartucho: string
  modoFormato: ModoFormato
  formatoPadraoLargura: NumCampo
  formatoPadraoAltura: NumCampo
  faturamentoMinimo: boolean
  valorFaturamentoMinimo: NumCampo
  semImpressao: boolean
  exibeRestricoes: boolean
  exibeInformacoesComplementares: boolean
  tributacao2026: string
  tributacao2027: string
  classificacaoFiscal: string
  tipoEmbalagemId: string | null
}

interface TipoEmbalagemOpcao {
  id: string
  codigo: string
  descricao: string
  status: boolean
}

const TAMANHO_PAGINA = 100

/** Busca todas as páginas de /tipos-embalagem para o status informado. */
async function buscarTiposEmbalagem(ativos: boolean): Promise<TipoEmbalagemOpcao[]> {
  const todos: TipoEmbalagemOpcao[] = []
  let pagina = 1
  let totalPaginas = 1
  do {
    const { data } = await api.get('/orcamento-grafico/tipos-embalagem', {
      params: { status: ativos ? 'true' : 'false', page: pagina, limit: TAMANHO_PAGINA },
    })
    const lista: Array<{ id: string; codigo: string; descricao: string }> = Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data) ? data : []
    for (const t of lista) todos.push({ id: t.id, codigo: t.codigo, descricao: t.descricao, status: ativos })
    totalPaginas = Number(data?.totalPages) || 1
    pagina += 1
  } while (pagina <= totalPaginas)
  return todos
}

const FORM_INICIAL: FormState = {
  codigo: '',
  nome: '',
  status: true,
  baseUnidadePreco: 'UN',
  prazoProducaoDias: 0,
  tipoCartucho: '',
  modoFormato: 'TRES_DIMENSOES',
  formatoPadraoLargura: '',
  formatoPadraoAltura: '',
  faturamentoMinimo: false,
  valorFaturamentoMinimo: '',
  semImpressao: false,
  exibeRestricoes: false,
  exibeInformacoesComplementares: false,
  tributacao2026: '',
  tributacao2027: '',
  classificacaoFiscal: '',
  tipoEmbalagemId: null,
}

function paraNum(v: unknown): NumCampo {
  if (v === null || v === undefined || v === '') return ''
  const n = Number(v)
  return Number.isFinite(n) ? n : ''
}

function numOuNull(v: NumCampo): number | null {
  return v === '' ? null : v
}

function doProduto(p: ProdutoGrafico): FormState {
  return {
    codigo: p.codigo,
    nome: p.nome,
    status: p.status,
    baseUnidadePreco: p.baseUnidadePreco || 'UN',
    prazoProducaoDias: p.prazoProducaoDias ?? 0,
    tipoCartucho: p.tipoCartucho ?? '',
    modoFormato: p.modoFormato,
    formatoPadraoLargura: paraNum(p.formatoPadraoLargura),
    formatoPadraoAltura: paraNum(p.formatoPadraoAltura),
    faturamentoMinimo: p.faturamentoMinimo,
    valorFaturamentoMinimo: paraNum(p.valorFaturamentoMinimo),
    semImpressao: p.semImpressao,
    exibeRestricoes: p.exibeRestricoes,
    exibeInformacoesComplementares: p.exibeInformacoesComplementares,
    tributacao2026: p.tributacao2026 ?? '',
    tributacao2027: p.tributacao2027 ?? '',
    classificacaoFiscal: p.classificacaoFiscal ?? '',
    tipoEmbalagemId: p.tipoEmbalagemId ?? null,
  }
}

interface ProdutoModalProps {
  produto: ProdutoGrafico | null
  onClose: () => void
  onSalvo: () => void
}

export default function ProdutoModal({ produto, onClose, onSalvo }: ProdutoModalProps) {
  // Após criar, o modal continua aberto já em modo de edição (libera as demais abas).
  const [atual, setAtual] = useState<ProdutoGrafico | null>(produto)
  const [form, setForm] = useState<FormState>(produto ? doProduto(produto) : FORM_INICIAL)
  const [aba, setAba] = useState<string | null>('dados')
  const [salvando, setSalvando] = useState(false)
  // Muda quando as relações de PLANO são salvas, para a aba Defaults recarregar.
  const [versaoRelacoes, setVersaoRelacoes] = useState(0)

  const salvo = atual !== null

  // Tipos de embalagem ativos (+ o tipo inativo já vinculado, se houver).
  const [tiposAtivos, setTiposAtivos] = useState<TipoEmbalagemOpcao[]>([])
  const [tipoInativoVinculado, setTipoInativoVinculado] = useState<TipoEmbalagemOpcao | null>(null)
  const [carregandoTipos, setCarregandoTipos] = useState(true)
  const [erroTipos, setErroTipos] = useState<string | null>(null)
  const [tentativaTipos, setTentativaTipos] = useState(0)
  const vinculoGravado = atual?.tipoEmbalagemId ?? null

  const carregarTipos = useCallback(async (vinculo: string | null, ativo: { valor: boolean }) => {
    setCarregandoTipos(true)
    setErroTipos(null)
    try {
      const ativos = await buscarTiposEmbalagem(true)
      let inativo: TipoEmbalagemOpcao | null = null
      if (vinculo && !ativos.some((t) => t.id === vinculo)) {
        const inativos = await buscarTiposEmbalagem(false)
        inativo = inativos.find((t) => t.id === vinculo) ?? null
      }
      if (!ativo.valor) return
      setTiposAtivos(ativos)
      setTipoInativoVinculado(inativo)
    } catch (err) {
      if (!ativo.valor) return
      setErroTipos(mensagemErroApi(err, 'Não foi possível carregar os tipos de embalagem'))
    } finally {
      if (ativo.valor) setCarregandoTipos(false)
    }
  }, [])

  useEffect(() => {
    const ativo = { valor: true }
    carregarTipos(produto?.tipoEmbalagemId ?? null, ativo)
    return () => { ativo.valor = false }
    // Recarrega apenas na abertura e na nova tentativa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tentativaTipos, carregarTipos])

  const opcoesTipo = useMemo(() => {
    const itens = tiposAtivos.map((t) => ({ value: t.id, label: t.descricao }))
    if (tipoInativoVinculado) {
      itens.push({ value: tipoInativoVinculado.id, label: `${tipoInativoVinculado.descricao} (inativo)` })
    }
    return itens.sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
  }, [tiposAtivos, tipoInativoVinculado])

  async function salvar() {
    if (!form.codigo.trim() || !form.nome.trim()) {
      notifications.show({ title: 'Atenção', message: 'Informe código e nome', color: 'red' })
      setAba('dados')
      return
    }
    const payload: ProdutoGraficoInput = {
      codigo: form.codigo.trim(),
      nome: form.nome.trim(),
      status: form.status,
      baseUnidadePreco: form.baseUnidadePreco.trim() || 'UN',
      prazoProducaoDias: form.prazoProducaoDias === '' ? 0 : form.prazoProducaoDias,
      tipoCartucho: form.tipoCartucho.trim() || null,
      modoFormato: form.modoFormato,
      formatoPadraoLargura: numOuNull(form.formatoPadraoLargura),
      formatoPadraoAltura: numOuNull(form.formatoPadraoAltura),
      faturamentoMinimo: form.faturamentoMinimo,
      valorFaturamentoMinimo: form.faturamentoMinimo ? numOuNull(form.valorFaturamentoMinimo) : null,
      semImpressao: form.semImpressao,
      exibeRestricoes: form.exibeRestricoes,
      exibeInformacoesComplementares: form.exibeInformacoesComplementares,
      tributacao2026: form.tributacao2026.trim() || null,
      tributacao2027: form.tributacao2027.trim() || null,
      classificacaoFiscal: form.classificacaoFiscal.trim() || null,
    }
    // Só envia o vínculo quando mudou (ou na criação com valor); limpar envia null.
    if (form.tipoEmbalagemId !== vinculoGravado) payload.tipoEmbalagemId = form.tipoEmbalagemId
    setSalvando(true)
    try {
      const gravado = atual
        ? await produtosApi.atualizar(atual.id, payload)
        : await produtosApi.criar(payload)
      setAtual({ ...gravado, tipoEmbalagemId: gravado.tipoEmbalagemId ?? form.tipoEmbalagemId })
      notifications.show({
        title: 'Salvo',
        message: `Produto ${atual ? 'atualizado' : 'criado'} com sucesso`,
        color: 'green',
      })
      onSalvo()
      if (!atual) {
        notifications.show({
          title: 'Próximo passo',
          message: 'Agora é possível definir as relações e os padrões por plano.',
          color: 'blue',
        })
      }
    } catch (err) {
      notifications.show({ title: 'Erro ao salvar', message: mensagemErroApi(err, 'Falha ao salvar'), color: 'red' })
    } finally {
      setSalvando(false)
    }
  }

  function setNum(campo: keyof FormState) {
    return (v: string | number) => setForm((f) => ({ ...f, [campo]: v === '' ? '' : Number(v) }))
  }

  const abaFormulario = aba === 'dados' || aba === 'tributacao'

  return (
    <Modal
      opened
      onClose={onClose}
      title={salvo ? `Produto — ${atual!.nome}` : 'Novo Produto'}
      size="xl"
      centered
    >
      <Tabs value={aba} onChange={setAba}>
        <Tabs.List mb="md">
          <Tabs.Tab value="dados">Dados</Tabs.Tab>
          <Tabs.Tab value="tributacao">Tributação</Tabs.Tab>
          <Tabs.Tab value="defaults" disabled={!salvo}>Defaults por plano</Tabs.Tab>
          <Tabs.Tab value="relacoes" disabled={!salvo}>Relações</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="dados">
          <Stack gap="md">
            <Group grow align="flex-start">
              <TextInput
                label="Código"
                required
                maxLength={60}
                value={form.codigo}
                onChange={(e) => setForm({ ...form, codigo: e.currentTarget.value })}
              />
              <TextInput
                label="Nome"
                required
                maxLength={200}
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.currentTarget.value })}
              />
            </Group>

            <SimpleGrid cols={{ base: 1, sm: 3 }}>
              <TextInput
                label="Base de unidade de preço"
                maxLength={20}
                value={form.baseUnidadePreco}
                onChange={(e) => setForm({ ...form, baseUnidadePreco: e.currentTarget.value })}
              />
              <NumberInput
                label="Prazo de produção (dias)"
                min={0}
                allowDecimal={false}
                value={form.prazoProducaoDias}
                onChange={setNum('prazoProducaoDias')}
              />
              <TextInput
                label="Tipo de cartucho"
                maxLength={60}
                value={form.tipoCartucho}
                onChange={(e) => setForm({ ...form, tipoCartucho: e.currentTarget.value })}
              />
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, sm: 3 }}>
              <Select
                label="Modo de formato"
                allowDeselect={false}
                data={MODOS_FORMATO}
                value={form.modoFormato}
                onChange={(v) => setForm({ ...form, modoFormato: (v as ModoFormato) || 'TRES_DIMENSOES' })}
              />
              <NumberInput
                label="Largura padrão (mm)"
                min={0}
                decimalScale={2}
                value={form.formatoPadraoLargura}
                onChange={setNum('formatoPadraoLargura')}
              />
              <NumberInput
                label="Altura padrão (mm)"
                min={0}
                decimalScale={2}
                value={form.formatoPadraoAltura}
                onChange={setNum('formatoPadraoAltura')}
              />
            </SimpleGrid>

            <Stack gap={4}>
              <Select
                label="Tipo de Embalagem"
                placeholder={carregandoTipos ? 'Carregando...' : 'Selecione o tipo de embalagem'}
                data={opcoesTipo}
                value={form.tipoEmbalagemId}
                onChange={(v) => setForm({ ...form, tipoEmbalagemId: v })}
                clearable
                searchable
                disabled={carregandoTipos && !erroTipos}
                nothingFoundMessage="Nenhum tipo de embalagem encontrado"
                rightSection={carregandoTipos ? <Loader size="xs" /> : undefined}
              />
              {erroTipos && (
                <Group gap="xs">
                  <Text size="xs" c="red">{erroTipos}</Text>
                  <Button size="compact-xs" variant="light" onClick={() => setTentativaTipos((n) => n + 1)}>
                    Tentar novamente
                  </Button>
                </Group>
              )}
              {!carregandoTipos && !erroTipos && opcoesTipo.length === 0 && (
                <Text size="xs" c="dimmed">
                  Nenhum tipo de embalagem ativo cadastrado. Cadastre em Tipos de Embalagem.
                </Text>
              )}
            </Stack>

            <Group align="flex-end">
              <Switch
                label="Faturamento mínimo"
                checked={form.faturamentoMinimo}
                onChange={(e) => setForm({ ...form, faturamentoMinimo: e.currentTarget.checked })}
              />
              {form.faturamentoMinimo && (
                <NumberInput
                  label="Valor do faturamento mínimo (R$)"
                  min={0}
                  decimalScale={2}
                  value={form.valorFaturamentoMinimo}
                  onChange={setNum('valorFaturamentoMinimo')}
                />
              )}
            </Group>

            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <Switch label="Sem impressão" checked={form.semImpressao}
                onChange={(e) => setForm({ ...form, semImpressao: e.currentTarget.checked })} />
              <Switch label="Exibe restrições" checked={form.exibeRestricoes}
                onChange={(e) => setForm({ ...form, exibeRestricoes: e.currentTarget.checked })} />
              <Switch label="Exibe informações complementares" checked={form.exibeInformacoesComplementares}
                onChange={(e) => setForm({ ...form, exibeInformacoesComplementares: e.currentTarget.checked })} />
              <Switch label="Ativo" checked={form.status}
                onChange={(e) => setForm({ ...form, status: e.currentTarget.checked })} />
            </SimpleGrid>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="tributacao">
          <Stack gap="md">
            <Text size="sm" c="dimmed">Códigos de tributação do produto e classificação fiscal.</Text>
            <SimpleGrid cols={{ base: 1, sm: 3 }}>
              <TextInput
                label="Tributação 2026"
                maxLength={60}
                value={form.tributacao2026}
                onChange={(e) => setForm({ ...form, tributacao2026: e.currentTarget.value })}
              />
              <TextInput
                label="Tributação 2027"
                maxLength={60}
                value={form.tributacao2027}
                onChange={(e) => setForm({ ...form, tributacao2027: e.currentTarget.value })}
              />
              <TextInput
                label="Classificação fiscal"
                maxLength={60}
                value={form.classificacaoFiscal}
                onChange={(e) => setForm({ ...form, classificacaoFiscal: e.currentTarget.value })}
              />
            </SimpleGrid>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="defaults">
          {atual && <AbaDefaultsPlano produtoId={atual.id} versaoRelacoes={versaoRelacoes} />}
        </Tabs.Panel>

        <Tabs.Panel value="relacoes">
          {atual && (
            <AbaRelacoesProduto
              produtoId={atual.id}
              onPlanosAlterados={() => setVersaoRelacoes((v) => v + 1)}
            />
          )}
        </Tabs.Panel>
      </Tabs>

      {abaFormulario && (
        <Group justify="flex-end" mt="lg">
          <Button variant="default" onClick={onClose}>Fechar</Button>
          <Button onClick={salvar} loading={salvando}>
            {salvo ? 'Salvar Alterações' : 'Criar Produto'}
          </Button>
        </Group>
      )}
      {!abaFormulario && (
        <Group justify="flex-end" mt="lg">
          <Button variant="default" onClick={onClose}>Fechar</Button>
        </Group>
      )}
    </Modal>
  )
}
