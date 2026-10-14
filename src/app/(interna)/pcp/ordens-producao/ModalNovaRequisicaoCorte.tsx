'use client'

/**
 * Modal reutilizável de criação de Requisição de Corte (RC).
 *
 * Usado tanto pela tela dedicada `requisicoes-corte/page.tsx` quanto pelo botão
 * "Nova Requisição de Corte" da tela de Ordens de Produção. A RC nasce em
 * RASCUNHO; a Cortadeira (centro onde o corte entra) é obrigatória e a
 * Guilhotina destino é opcional (default = Tigger/Trigger quando existir).
 *
 * Correção dos selects vazios: os centros são carregados ao ABRIR o modal
 * (não só no mount), com tratamento de erro visível, e o filtro de
 * cortadeira/guilhotina considera tanto o código do Tipo de Processo quanto a
 * descrição do centro (a "Guilhotina Tigger", por ex., é um centro do tipo
 * CORTADEIRA — por isso o filtro por descrição é necessário).
 */

import { useEffect, useState, useCallback } from 'react'
import { Modal, Stack, Group, Button, TextInput, Textarea, Select, Alert } from '@mantine/core'
import { IconAlertTriangle } from '@tabler/icons-react'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'

interface CentroOpt { value: string; label: string; codigo?: string }

const formInicial: Record<string, string> = {
  dataSolicitacao: new Date().toISOString().slice(0, 10),
  dataCorte: '',
  requisitante: '',
  fabricanteCartao: '',
  fornecedor: '',
  larguraBobinaCm: '',
  gramaturaG: '',
  tamanhoCorteCm: '',
  formatoCorte: '',
  qtdFolhasCortadeira: '',
  textoGuilhotina: '',
  qtdFolhasGuilhotina: '',
  nomeProduto: '',
  nomeServico: '',
  pesoKg: '',
  instrucoesRefile: '',
}

export function ModalNovaRequisicaoCorte({
  opened,
  onClose,
  onCriada,
}: {
  opened: boolean
  onClose: () => void
  /** Chamado após criar com sucesso (ex.: recarregar lista). */
  onCriada?: () => void
}) {
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState<Record<string, string>>(formInicial)
  const [cortadeiras, setCortadeiras] = useState<CentroOpt[]>([])
  const [guilhotinas, setGuilhotinas] = useState<CentroOpt[]>([])
  const [cortadeiraId, setCortadeiraId] = useState<string | null>(null)
  const [guilhotinaId, setGuilhotinaId] = useState<string | null>(null)
  const [erroCentros, setErroCentros] = useState<string | null>(null)
  const [carregandoCentros, setCarregandoCentros] = useState(false)

  const carregarCentros = useCallback(async () => {
    setCarregandoCentros(true)
    setErroCentros(null)
    try {
      const { data } = await api.get('/centros-producao', { params: { limit: 100, status: 'true' } })
      const centros = (data?.data || data || []) as any[]
      const ehCortadeira = (c: any) =>
        /cortadeira/i.test(c?.tipoProcesso?.codigo || '') || /cortadeira/i.test(c?.descricao || '')
      const ehGuilhotina = (c: any) =>
        /guilhotina/i.test(c?.tipoProcesso?.codigo || '') || /guilhotina/i.test(c?.descricao || '')
      const cort = centros
        .filter(ehCortadeira)
        .map((c) => ({ value: c.id, label: `${c.codigo} - ${c.descricao}`, codigo: c.codigo }))
      const guil = centros
        .filter(ehGuilhotina)
        .map((c) => ({ value: c.id, label: `${c.codigo} - ${c.descricao}`, codigo: c.codigo }))
      setCortadeiras(cort)
      setGuilhotinas(guil)
      if (cort.length === 0) {
        setErroCentros('Nenhuma cortadeira encontrada. Cadastre um centro do tipo Cortadeira em PCP → Cadastros → Centros de Produção.')
      }
      return guil
    } catch (err: any) {
      setCortadeiras([])
      setGuilhotinas([])
      setErroCentros(err?.response?.data?.message || 'Falha ao carregar os centros de produção.')
      return [] as CentroOpt[]
    } finally {
      setCarregandoCentros(false)
    }
  }, [])

  // Carrega os centros SEMPRE que o modal abre (corrige o problema de selects
  // vazios por timing/erro silencioso no mount).
  useEffect(() => {
    if (!opened) return
    setForm(formInicial)
    setCortadeiraId(null)
    setGuilhotinaId(null)
    carregarCentros().then((guil) => {
      const def = guil.find((g) => /tigger|trigger/i.test(g.label))?.value ?? null
      setGuilhotinaId(def)
    })
  }, [opened, carregarCentros])

  async function salvar(imprimir: boolean) {
    if (!form.requisitante.trim() || !form.fabricanteCartao.trim() || !form.nomeProduto.trim() || !form.nomeServico.trim()) {
      notifications.show({ title: 'Validação', message: 'Preencha Requisitante, Fabricante/Cartão, Nome do produto e Nome do serviço.', color: 'red' })
      return
    }
    if (!cortadeiraId) {
      notifications.show({ title: 'Validação', message: 'Selecione a Cortadeira que vai entrar.', color: 'red' })
      return
    }
    setSalvando(true)
    try {
      const dec = (v: string) => (v.trim() === '' ? undefined : Number(v.replace(/\./g, '').replace(',', '.')))
      const int = (v: string) => (v.trim() === '' ? undefined : Math.round(Number(v.replace(/\./g, '').replace(',', '.'))))
      const payload = {
        centroProducaoId: cortadeiraId,
        dataSolicitacao: form.dataSolicitacao || undefined,
        dataCorte: form.dataCorte || undefined,
        requisitante: form.requisitante,
        fabricanteCartao: form.fabricanteCartao,
        fornecedor: form.fornecedor || undefined,
        larguraBobinaCm: dec(form.larguraBobinaCm),
        gramaturaG: dec(form.gramaturaG),
        tamanhoCorteCm: dec(form.tamanhoCorteCm),
        formatoCorte: form.formatoCorte || undefined,
        qtdFolhasCortadeira: int(form.qtdFolhasCortadeira),
        textoGuilhotina: form.textoGuilhotina || undefined,
        qtdFolhasGuilhotina: int(form.qtdFolhasGuilhotina),
        nomeProduto: form.nomeProduto,
        nomeServico: form.nomeServico,
        pesoKg: dec(form.pesoKg),
        instrucoesRefile: form.instrucoesRefile || undefined,
        guilhotinaDestinoId: guilhotinaId || undefined,
        status: 'RASCUNHO',
      }
      const { data: rc } = await api.post('/pcp/requisicoes-corte', payload)
      notifications.show({ title: 'RC criada', message: `Requisição de corte Nº ${rc.numero} salva (Rascunho).`, color: 'green' })
      onClose()
      onCriada?.()
      if (imprimir) {
        try {
          const pdf = await api.get(`/pcp/requisicoes-corte/${rc.id}/pdf`, { responseType: 'blob' })
          const url = URL.createObjectURL(new Blob([pdf.data], { type: 'application/pdf' }))
          window.open(url, '_blank')
          setTimeout(() => URL.revokeObjectURL(url), 60000)
        } catch { /* ignore */ }
      }
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao salvar a requisição.', color: 'red' })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Nova Requisição de Corte" centered size="lg">
      <Stack gap="sm">
        {erroCentros && (
          <Alert color="orange" variant="light" icon={<IconAlertTriangle size={16} />}>{erroCentros}</Alert>
        )}
        <Select
          label="Cortadeira (vai entrar)"
          description="Centro de produção onde o corte será executado. A RC aparece na fila dele quando liberada."
          placeholder={carregandoCentros ? 'Carregando...' : 'Selecione a cortadeira'}
          data={cortadeiras}
          value={cortadeiraId}
          onChange={setCortadeiraId}
          searchable
          required
          disabled={carregandoCentros}
          nothingFoundMessage="Nenhuma cortadeira cadastrada"
        />
        <Group grow>
          <TextInput label="Data da solicitação" type="date" value={form.dataSolicitacao} onChange={(e) => setForm({ ...form, dataSolicitacao: e.currentTarget.value })} />
          <TextInput label="Data do corte" type="date" value={form.dataCorte} onChange={(e) => setForm({ ...form, dataCorte: e.currentTarget.value })} />
        </Group>
        <TextInput label="Requisitante" required placeholder="Ex: CAIO RANGEL" value={form.requisitante} onChange={(e) => setForm({ ...form, requisitante: e.currentTarget.value })} />
        <Group grow>
          <TextInput label="Fabricante / Cartão" required placeholder="Ex: STORA ENZO" value={form.fabricanteCartao} onChange={(e) => setForm({ ...form, fabricanteCartao: e.currentTarget.value })} />
          <TextInput label="Fornecedor" placeholder="Opcional" value={form.fornecedor} onChange={(e) => setForm({ ...form, fornecedor: e.currentTarget.value })} />
        </Group>
        <Group grow>
          <TextInput label="Largura bobina (cm)" placeholder="Ex: 116,8" value={form.larguraBobinaCm} onChange={(e) => setForm({ ...form, larguraBobinaCm: e.currentTarget.value })} />
          <TextInput label="Gramatura (g)" placeholder="Ex: 231" value={form.gramaturaG} onChange={(e) => setForm({ ...form, gramaturaG: e.currentTarget.value })} />
          <TextInput label="Tamanho do corte (cm)" placeholder="Ex: 97,0" value={form.tamanhoCorteCm} onChange={(e) => setForm({ ...form, tamanhoCorteCm: e.currentTarget.value })} />
        </Group>
        <Group grow>
          <TextInput label="Formato corte" placeholder="Ex: 116,8 x 97,0" value={form.formatoCorte} onChange={(e) => setForm({ ...form, formatoCorte: e.currentTarget.value })} />
          <TextInput label="Qtd folhas (cortadeira)" placeholder="Ex: 5834" value={form.qtdFolhasCortadeira} onChange={(e) => setForm({ ...form, qtdFolhasCortadeira: e.currentTarget.value })} />
        </Group>
        <Select
          label="Guilhotina destino"
          description="Para onde a RC segue quando o corte terminar (padrão: Guilhotina Tigger)."
          placeholder={carregandoCentros ? 'Carregando...' : 'Selecione a guilhotina'}
          data={guilhotinas}
          value={guilhotinaId}
          onChange={setGuilhotinaId}
          clearable
          searchable
          disabled={carregandoCentros}
          nothingFoundMessage="Nenhuma guilhotina cadastrada"
        />
        <Group grow>
          <TextInput label="Guilhotina (observação)" placeholder="Ex: Segue observação" value={form.textoGuilhotina} onChange={(e) => setForm({ ...form, textoGuilhotina: e.currentTarget.value })} />
          <TextInput label="Qtd folhas (guilhotina)" placeholder="Opcional" value={form.qtdFolhasGuilhotina} onChange={(e) => setForm({ ...form, qtdFolhasGuilhotina: e.currentTarget.value })} />
        </Group>
        <TextInput label="Nome do produto" required placeholder="Ex: CORTE PARA ACTUAL - STORA ENZO 231G - 116,8 CM" value={form.nomeProduto} onChange={(e) => setForm({ ...form, nomeProduto: e.currentTarget.value })} />
        <TextInput label="Nome do serviço" required placeholder="Ex: CORTE PARA ACTUAL - STORA ENZO 231G - 116,8 CM" value={form.nomeServico} onChange={(e) => setForm({ ...form, nomeServico: e.currentTarget.value })} />
        <TextInput label="Peso (kg)" placeholder="Ex: 1527,0" value={form.pesoKg} onChange={(e) => setForm({ ...form, pesoKg: e.currentTarget.value })} />
        <Textarea label="Instruções de refile" placeholder="Ex: REFILAR 5.824 FOLHAS 47,5 x 97,0 CM" minRows={2} autosize value={form.instrucoesRefile} onChange={(e) => setForm({ ...form, instrucoesRefile: e.currentTarget.value })} />
        <Group justify="flex-end" mt="sm">
          <Button variant="default" onClick={() => salvar(false)} loading={salvando}>Salvar</Button>
          <Button color="grape" onClick={() => salvar(true)} loading={salvando}>Salvar e Imprimir</Button>
        </Group>
      </Stack>
    </Modal>
  )
}
