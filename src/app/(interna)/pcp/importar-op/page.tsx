'use client'

import { useEffect, useState } from 'react'
import {
  Title, Stack, Card, Group, Button, Text, Badge, Alert, Table,
  Accordion, SimpleGrid, Loader, Center, FileInput, Stepper,
  TextInput, Select, Checkbox, Divider,
} from '@mantine/core'
import {
  IconFileTypePdf, IconUpload, IconCheck, IconAlertTriangle,
  IconPackage, IconListDetails, IconNote, IconArrowLeft,
  IconUser, IconBox, IconSettings2, IconClipboardCheck,
} from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface ImportacaoPreview {
  importacaoId: string
  sistemaOrigem: string
  confianca: number
  avisos: string[]
  opDuplicada: { id: string; numero: number; status: string } | null
  dadosExtraidos: {
    cabecalho: Record<string, any>
    materiais: Array<Record<string, any>>
    etapas: Array<Record<string, any>>
    cortadeira: Record<string, any> | null
    montagem: Record<string, any> | null
    observacoes: Record<string, any>
    embalagem: Record<string, any> | null
  }
  sugestoes: {
    cliente: any | null
    produto: any | null
    materiais: Array<{ indice: number; sugestao: any | null }>
    centros: Array<{ indice: number; sugestao: any | null }>
  }
}

interface MaterialParaCriar {
  indice: number
  descricao: string
  quantidade: number
  unidade: string
  tipo: string
  criar: boolean
  codigo: string
  classificacao: string
  produtoIdVinculado: string | null
}

interface CentroParaCriar {
  indice: number
  descricao: string
  maquina: string
  maquinaOriginal: string
  criar: boolean
  codigo: string
  tipo: string
  centroIdVinculado: string | null
  tipoMaquina: string | null
}

// ─── Página Principal ────────────────────────────────────────────────────────

export default function ImportarOpPdfPage() {
  useEffect(() => { document.title = 'PCP - Importar OP via PDF' }, [])
  const router = useRouter()

  const [etapaGlobal, setEtapaGlobal] = useState<'upload' | 'preview' | 'wizard' | 'sucesso'>('upload')
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<ImportacaoPreview | null>(null)
  const [nomeArquivo, setNomeArquivo] = useState('')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [opCriada, setOpCriada] = useState<{ id: string; numero: number } | null>(null)

  // Wizard state
  const [wizardStep, setWizardStep] = useState(0)
  const [clienteId, setClienteId] = useState<string | null>(null)
  const [clienteAcao, setClienteAcao] = useState<'existente' | 'criar' | 'pular'>('pular')
  const [clienteForm, setClienteForm] = useState({ razaoSocial: '', cpfCnpj: '', telefone: '' })
  const [produtoId, setProdutoId] = useState<string | null>(null)
  const [produtoAcao, setProdutoAcao] = useState<'existente' | 'criar' | 'pular'>('pular')
  const [produtoForm, setProdutoForm] = useState({ codigo: '', nome: '', unidade: 'UN' })
  const [materiais, setMateriais] = useState<MaterialParaCriar[]>([])
  const [centros, setCentros] = useState<CentroParaCriar[]>([])
  const [centrosDisponiveis, setCentrosDisponiveis] = useState<Array<{ id: string; codigo: string; descricao: string; tipoMaquina: string | null }>>([])

  // Carregar centros disponíveis para o combobox
  useEffect(() => {
    api.get('/centros-producao', { params: { limit: 100 } })
      .then(res => setCentrosDisponiveis(res.data?.data || []))
      .catch(() => {})
  }, [])

  // ─── Upload ──────────────────────────────────────────────────────────────

  async function handleEnviar() {
    if (!arquivo) return
    setLoading(true)
    setNomeArquivo(arquivo.name)
    try {
      const formData = new FormData()
      formData.append('file', arquivo)
      const res = await api.post('/pcp/importar-op-pdf', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      setPreview(res.data)
      await inicializarWizard(res.data)
      setEtapaGlobal('preview')
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Erro ao processar PDF', color: 'red' })
    } finally { setLoading(false) }
  }

  async function inicializarWizard(data: ImportacaoPreview) {
    // Cliente
    if (data.sugestoes.cliente) {
      setClienteId(data.sugestoes.cliente.id)
      setClienteAcao('existente')
    } else {
      setClienteForm({ razaoSocial: data.dadosExtraidos.cabecalho.cliente || '', cpfCnpj: '', telefone: '' })
      setClienteAcao('criar')
    }
    // Produto
    if (data.sugestoes.produto) {
      setProdutoId(data.sugestoes.produto.id)
      setProdutoAcao('existente')
    } else {
      setProdutoForm({ codigo: data.dadosExtraidos.cabecalho.codigoAcabado || '', nome: data.dadosExtraidos.cabecalho.descricao || data.dadosExtraidos.cabecalho.produto || '', unidade: 'UN' })
      setProdutoAcao('criar')
    }
    // Materiais
    const mats: MaterialParaCriar[] = data.dadosExtraidos.materiais.map((mat, i) => {
      const sug = data.sugestoes.materiais.find(s => s.indice === i)
      const prefixo = mat.tipo === 'PAPEL' ? 'PAP-' : mat.tipo === 'TINTA' ? 'TINTA-' : mat.tipo === 'VERNIZ' ? 'VERN-' : mat.tipo === 'COLA' ? 'COLA-' : 'INS-'
      return {
        indice: i, descricao: mat.descricao, quantidade: mat.quantidade, unidade: mat.unidade, tipo: mat.tipo,
        criar: !sug?.sugestao, codigo: sug?.sugestao?.codigo || `${prefixo}${mat.descricao.substring(0, 10).toUpperCase().replace(/\s/g, '-')}`,
        classificacao: mat.tipo === 'PAPEL' ? 'MATERIA_PRIMA' : 'INSUMO',
        produtoIdVinculado: sug?.sugestao?.id || null,
      }
    })
    setMateriais(mats)
    // Centros
    // Buscar próximo código sequencial disponível
    let proximoCodigo = 1
    try {
      const centrosExistentes = await api.get('/centros-producao', { params: { limit: 100 } })
      if (centrosExistentes.data?.data?.length > 0) {
        const codigosNumericos = centrosExistentes.data.data
          .map((c: any) => parseInt(c.codigo))
          .filter((n: number) => !isNaN(n))
        if (codigosNumericos.length > 0) {
          proximoCodigo = Math.max(...codigosNumericos) + 1
        }
      }
    } catch {}

    const ctrs: CentroParaCriar[] = data.dadosExtraidos.etapas.map((et, i) => {
      const sug = data.sugestoes.centros.find(c => c.indice === i)
      if (sug?.sugestao) {
        // De/Para encontrou: preencher com dados do centro existente
        return {
          indice: i, descricao: et.descricao, maquina: sug.sugestao.descricao,
          maquinaOriginal: et.maquina || et.descricao,
          criar: false, codigo: sug.sugestao.codigo,
          tipo: 'MAQUINA', centroIdVinculado: sug.sugestao.id,
          tipoMaquina: sug.sugestao.tipoMaquina || null,
        }
      } else {
        // Sem de/para: campo Máquina em BRANCO, código sequencial
        const codigo = String(proximoCodigo++)
        return {
          indice: i, descricao: et.descricao, maquina: '',
          maquinaOriginal: et.maquina || et.descricao,
          criar: true, codigo,
          tipo: 'MAQUINA', centroIdVinculado: null,
          tipoMaquina: null,
        }
      }
    })
    setCentros(ctrs)
  }

  function irParaWizard() { setEtapaGlobal('wizard'); setWizardStep(0) }

  // ─── Criação Final ───────────────────────────────────────────────────────

  async function executarCriacao() {
    setLoading(true)
    try {
      let finalClienteId = clienteId
      let finalProdutoId = produtoId

      // 1. Criar cliente se necessário
      if (clienteAcao === 'criar' && clienteForm.razaoSocial) {
        try {
          const res = await api.post('/clientes', { razaoSocial: clienteForm.razaoSocial, cpfCnpj: clienteForm.cpfCnpj || '00000000000', telefone: clienteForm.telefone || undefined })
          finalClienteId = res.data.id
          notifications.show({ title: 'Cliente criado', message: clienteForm.razaoSocial, color: 'green' })
        } catch (err: any) {
          // Se já existe (duplicata), buscar pelo CNPJ
          if (err?.response?.status === 500 || err?.response?.status === 409) {
            try {
              const busca = await api.get('/clientes', { params: { limit: 1, busca: clienteForm.cpfCnpj } })
              if (busca.data?.data?.[0]) finalClienteId = busca.data.data[0].id
            } catch {}
          }
        }
      }

      // 2. Criar produto se necessário
      if (produtoAcao === 'criar' && produtoForm.codigo && produtoForm.nome) {
        try {
          const res = await api.post('/produtos', { codigo: produtoForm.codigo, nome: produtoForm.nome, unidade: produtoForm.unidade, classificacaoPcp: 'PRODUTO_ACABADO' })
          finalProdutoId = res.data.id
          notifications.show({ title: 'Produto criado', message: produtoForm.nome, color: 'green' })
        } catch (err: any) {
          // Se já existe, buscar pelo código
          if (err?.response?.status === 500 || err?.response?.status === 409) {
            try {
              const busca = await api.get('/produtos', { params: { limit: 1, busca: produtoForm.codigo } })
              if (busca.data?.data?.[0]) finalProdutoId = busca.data.data[0].id
            } catch {}
          }
        }
      }

      // 3. Criar materiais marcados
      const materiaisVinculados: Array<{ indice: number; produtoId: string | null }> = []
      for (const mat of materiais) {
        if (mat.produtoIdVinculado) {
          materiaisVinculados.push({ indice: mat.indice, produtoId: mat.produtoIdVinculado })
        } else if (mat.criar) {
          try {
            const res = await api.post('/produtos', { codigo: mat.codigo, nome: mat.descricao, unidade: mat.unidade, classificacaoPcp: mat.classificacao })
            materiaisVinculados.push({ indice: mat.indice, produtoId: res.data.id })
          } catch { /* ignora erro individual */ }
        }
      }

      // 4. Criar centros marcados
      const centrosVinculados: Array<{ indice: number; centroProducaoId: string | null; nomeEditado: string; tipoMaquina?: string }> = []
      for (const ctr of centros) {
        if (ctr.centroIdVinculado) {
          centrosVinculados.push({ indice: ctr.indice, centroProducaoId: ctr.centroIdVinculado, nomeEditado: ctr.maquina, tipoMaquina: ctr.tipoMaquina || undefined })
        } else if (ctr.criar) {
          try {
            const res = await api.post('/centros-producao', { codigo: ctr.codigo.substring(0, 20), descricao: ctr.maquina, tipo: ctr.tipo, tipoMaquina: ctr.tipoMaquina || undefined })
            centrosVinculados.push({ indice: ctr.indice, centroProducaoId: res.data.id, nomeEditado: ctr.maquina, tipoMaquina: ctr.tipoMaquina || undefined })
          } catch (err: any) {
            // Se código já existe (409), buscar o centro existente e usar
            if (err?.response?.status === 409) {
              try {
                const busca = await api.get('/centros-producao', { params: { busca: ctr.codigo.substring(0, 20), limit: 1 } })
                if (busca.data?.data?.[0]) {
                  centrosVinculados.push({ indice: ctr.indice, centroProducaoId: busca.data.data[0].id, nomeEditado: ctr.maquina, tipoMaquina: ctr.tipoMaquina || undefined })
                } else {
                  // Fallback: enviar nomeEditado para o backend criar via confirmação
                  centrosVinculados.push({ indice: ctr.indice, centroProducaoId: null, nomeEditado: ctr.maquina, tipoMaquina: ctr.tipoMaquina || undefined })
                }
              } catch {
                centrosVinculados.push({ indice: ctr.indice, centroProducaoId: null, nomeEditado: ctr.maquina, tipoMaquina: ctr.tipoMaquina || undefined })
              }
            } else {
              // Outro erro: enviar nomeEditado para o backend criar via confirmação
              centrosVinculados.push({ indice: ctr.indice, centroProducaoId: null, nomeEditado: ctr.maquina, tipoMaquina: ctr.tipoMaquina || undefined })
            }
          }
        } else {
          // Item desmarcado: não enviar nomeEditado para que o backend não crie centro/etapa
          centrosVinculados.push({ indice: ctr.indice, centroProducaoId: null, nomeEditado: '', tipoMaquina: undefined })
        }
      }

      // 5. Confirmar OP
      let confirmaRes
      try {
        confirmaRes = await api.post('/pcp/importar-op-pdf/confirmar', {
          importacaoId: preview!.importacaoId,
          clienteId: finalClienteId,
          produtoId: finalProdutoId,
          quantidade: preview!.dadosExtraidos.cabecalho.quantidade,
          prioridade: 'NORMAL',
          materiaisVinculados,
          centrosVinculados,
          salvarDePara: true,
        })
      } catch (errConfirm: any) {
        // Se cache expirou (410), re-uplodar PDF e tentar novamente
        if (errConfirm?.response?.status === 410 && arquivo) {
          const formData = new FormData()
          formData.append('file', arquivo)
          const reUpload = await api.post('/pcp/importar-op-pdf', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
          // Tenta confirmar com novo importacaoId
          confirmaRes = await api.post('/pcp/importar-op-pdf/confirmar', {
            importacaoId: reUpload.data.importacaoId,
            clienteId: finalClienteId,
            produtoId: finalProdutoId,
            quantidade: preview!.dadosExtraidos.cabecalho.quantidade,
            prioridade: 'NORMAL',
            materiaisVinculados,
            centrosVinculados,
            salvarDePara: true,
          })
        } else {
          throw errConfirm
        }
      }

      setOpCriada(confirmaRes.data.ordemProducao)
      setEtapaGlobal('sucesso')
      notifications.show({ title: 'OP importada!', message: `OP #${confirmaRes.data.ordemProducao.referenciaExterna || confirmaRes.data.ordemProducao.numero} criada`, color: 'green' })
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Erro ao criar OP', color: 'red' })
    } finally { setLoading(false) }
  }

  function resetar() {
    setEtapaGlobal('upload'); setPreview(null); setNomeArquivo(''); setArquivo(null); setOpCriada(null); setWizardStep(0)
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <Stack gap="md">
      <Group>
        <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={() => router.push('/pcp/ordens-producao')}>Voltar</Button>
        <Title order={3}>Importar OP via PDF</Title>
      </Group>

      {/* UPLOAD */}
      {etapaGlobal === 'upload' && (
        <Card shadow="sm" padding="lg">
          <Text size="sm" c="dimmed" mb="md">Envie um PDF de OP gerado pelo GPrint/Calcograf.</Text>
          <FileInput label="Selecione o PDF" accept="application/pdf" leftSection={<IconFileTypePdf size={18} />} value={arquivo} onChange={setArquivo} size="md" mb="md" />
          <Button leftSection={<IconUpload size={16} />} onClick={handleEnviar} loading={loading} disabled={!arquivo} fullWidth size="md">Processar PDF</Button>
        </Card>
      )}

      {/* PREVIEW */}
      {etapaGlobal === 'preview' && preview && (
        <Card shadow="sm" padding="lg">
          <Group justify="space-between" mb="md">
            <Group gap="sm">
              <Text fw={600}>{nomeArquivo}</Text>
              <Badge color="blue">{preview.sistemaOrigem}</Badge>
              <Badge color={preview.confianca >= 80 ? 'green' : 'yellow'}>Confiança: {preview.confianca}%</Badge>
            </Group>
            <Button variant="subtle" size="sm" onClick={resetar}>Outro arquivo</Button>
          </Group>

          <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} mb="md">
            <Card withBorder p="xs"><Text size="xs" c="dimmed">OP</Text><Text fw={600}>{preview.dadosExtraidos.cabecalho.numeroOp || '—'}</Text></Card>
            <Card withBorder p="xs"><Text size="xs" c="dimmed">Cliente</Text><Text fw={600}>{preview.dadosExtraidos.cabecalho.cliente || '—'}</Text>{preview.sugestoes.cliente && <Badge size="xs" color="green">✓ Encontrado</Badge>}</Card>
            <Card withBorder p="xs"><Text size="xs" c="dimmed">Quantidade</Text><Text fw={600}>{preview.dadosExtraidos.cabecalho.quantidade?.toLocaleString('pt-BR') || '—'}</Text></Card>
            <Card withBorder p="xs"><Text size="xs" c="dimmed">Materiais / Etapas</Text><Text fw={600}>{preview.dadosExtraidos.materiais.length} / {preview.dadosExtraidos.etapas.length}</Text></Card>
          </SimpleGrid>

          <Alert color="blue" mb="md">
            <Text size="sm">O sistema irá guiá-lo para cadastrar entidades que não existem ainda (cliente, produto, materiais, máquinas).</Text>
          </Alert>

          <Button fullWidth size="md" onClick={irParaWizard} leftSection={<IconCheck size={16} />}>Continuar para Cadastro</Button>
        </Card>
      )}

      {/* WIZARD */}
      {etapaGlobal === 'wizard' && preview && (
        <Card shadow="sm" padding="lg">
          <Stepper active={wizardStep} onStepClick={setWizardStep} mb="xl" size="sm">
            <Stepper.Step label="Cliente" icon={<IconUser size={16} />} />
            <Stepper.Step label="Produto" icon={<IconBox size={16} />} />
            <Stepper.Step label="Materiais" icon={<IconPackage size={16} />} />
            <Stepper.Step label="Máquinas" icon={<IconSettings2 size={16} />} />
            <Stepper.Step label="Confirmar" icon={<IconClipboardCheck size={16} />} />
          </Stepper>

          {/* PASSO 1: Cliente */}
          {wizardStep === 0 && (
            <Stack gap="md">
              <Title order={5}>Passo 1 — Cliente</Title>
              <Text size="sm" c="dimmed">Cliente extraído do PDF: <strong>{preview.dadosExtraidos.cabecalho.cliente || 'Não identificado'}</strong></Text>

              {preview.sugestoes.cliente ? (
                <Alert color="green"><Text size="sm">✓ Cliente encontrado: <strong>{preview.sugestoes.cliente.razaoSocial || preview.sugestoes.cliente.nomeFantasia}</strong></Text></Alert>
              ) : (
                <Stack gap="sm">
                  <Select label="Ação" data={[{ value: 'criar', label: 'Cadastrar novo cliente' }, { value: 'pular', label: 'Pular (sem vínculo)' }]} value={clienteAcao} onChange={(v) => setClienteAcao(v as any)} />
                  {clienteAcao === 'criar' && (
                    <>
                      <TextInput label="Razão Social *" value={clienteForm.razaoSocial} onChange={(e) => setClienteForm({ ...clienteForm, razaoSocial: e.target.value })} />
                      <Group grow>
                        <TextInput label="CPF/CNPJ" value={clienteForm.cpfCnpj} onChange={(e) => setClienteForm({ ...clienteForm, cpfCnpj: e.target.value })} placeholder="00.000.000/0000-00" />
                        <TextInput label="Telefone" value={clienteForm.telefone} onChange={(e) => setClienteForm({ ...clienteForm, telefone: e.target.value })} />
                      </Group>
                    </>
                  )}
                </Stack>
              )}
            </Stack>
          )}

          {/* PASSO 2: Produto */}
          {wizardStep === 1 && (
            <Stack gap="md">
              <Title order={5}>Passo 2 — Produto Acabado</Title>
              <Text size="sm" c="dimmed">Produto: <strong>{preview.dadosExtraidos.cabecalho.descricao || preview.dadosExtraidos.cabecalho.produto || 'Não identificado'}</strong> (Cód: {preview.dadosExtraidos.cabecalho.codigoAcabado})</Text>

              {preview.sugestoes.produto ? (
                <Alert color="green"><Text size="sm">✓ Produto encontrado: <strong>{preview.sugestoes.produto.codigo} - {preview.sugestoes.produto.nome}</strong></Text></Alert>
              ) : (
                <Stack gap="sm">
                  <Select label="Ação" data={[{ value: 'criar', label: 'Cadastrar novo produto' }, { value: 'pular', label: 'Pular (sem vínculo)' }]} value={produtoAcao} onChange={(v) => setProdutoAcao(v as any)} />
                  {produtoAcao === 'criar' && (
                    <Group grow>
                      <TextInput label="Código *" value={produtoForm.codigo} onChange={(e) => setProdutoForm({ ...produtoForm, codigo: e.target.value })} />
                      <TextInput label="Nome *" value={produtoForm.nome} onChange={(e) => setProdutoForm({ ...produtoForm, nome: e.target.value })} />
                      <Select label="Unidade" data={['UN', 'KG', 'M2', 'ML', 'CX', 'PC', 'MIL']} value={produtoForm.unidade} onChange={(v) => setProdutoForm({ ...produtoForm, unidade: v || 'UN' })} />
                    </Group>
                  )}
                </Stack>
              )}
            </Stack>
          )}

          {/* PASSO 3: Materiais */}
          {wizardStep === 2 && (
            <Stack gap="md">
              <Group justify="space-between">
                <Title order={5}>Passo 3 — Materiais ({materiais.length})</Title>
                <Button size="xs" variant="light" onClick={() => setMateriais(materiais.map(m => ({ ...m, criar: !m.produtoIdVinculado })))}>Marcar todos para criar</Button>
              </Group>
              <Table striped highlightOnHover>
                <Table.Thead><Table.Tr><Table.Th>Criar</Table.Th><Table.Th>Tipo</Table.Th><Table.Th>Descrição</Table.Th><Table.Th>Qtd.</Table.Th><Table.Th>Unid.</Table.Th><Table.Th>Código</Table.Th><Table.Th>Classif.</Table.Th><Table.Th>Status</Table.Th></Table.Tr></Table.Thead>
                <Table.Tbody>
                  {materiais.map((mat, i) => (
                    <Table.Tr key={i}>
                      <Table.Td>{mat.produtoIdVinculado ? '—' : <Checkbox checked={mat.criar} onChange={(e) => { const novo = [...materiais]; novo[i].criar = e.target.checked; setMateriais(novo) }} />}</Table.Td>
                      <Table.Td><Badge size="xs" color={corTipo(mat.tipo)}>{mat.tipo}</Badge></Table.Td>
                      <Table.Td>{mat.descricao}</Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>{mat.quantidade?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</Table.Td>
                      <Table.Td>{mat.unidade}</Table.Td>
                      <Table.Td>{mat.produtoIdVinculado ? '—' : <TextInput size="xs" value={mat.codigo} onChange={(e) => { const novo = [...materiais]; novo[i].codigo = e.target.value; setMateriais(novo) }} style={{ width: 120 }} />}</Table.Td>
                      <Table.Td>{mat.produtoIdVinculado ? '—' : <Select size="xs" data={['MATERIA_PRIMA', 'INSUMO', 'EMBALAGEM']} value={mat.classificacao} onChange={(v) => { const novo = [...materiais]; novo[i].classificacao = v || 'INSUMO'; setMateriais(novo) }} style={{ width: 130 }} />}</Table.Td>
                      <Table.Td>{mat.produtoIdVinculado ? <Badge color="green" size="sm">✓ Vinculado</Badge> : mat.criar ? <Badge color="blue" size="sm">Será criado</Badge> : <Badge color="gray" size="sm">Pular</Badge>}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Stack>
          )}

          {/* PASSO 4: Centros */}
          {wizardStep === 3 && (
            <Stack gap="md">
              <Group justify="space-between">
                <Title order={5}>Passo 4 — Centros / Máquinas ({centros.length})</Title>
                <Button size="xs" variant="light" onClick={() => setCentros(centros.map(c => ({ ...c, criar: !c.centroIdVinculado })))}>Marcar todos para criar</Button>
              </Group>
              <Text size="xs" c="dimmed">Você pode editar o nome da máquina. O sistema salvará o de-para para importações futuras.</Text>
              <Table striped highlightOnHover>
                <Table.Thead><Table.Tr><Table.Th>Criar</Table.Th><Table.Th>Etapa</Table.Th><Table.Th>Máquina</Table.Th><Table.Th>Vincular existente</Table.Th><Table.Th>Código</Table.Th><Table.Th>Tipo Máquina</Table.Th><Table.Th>Status</Table.Th></Table.Tr></Table.Thead>
                <Table.Tbody>
                  {centros.map((ctr, i) => (
                    <Table.Tr key={i}>
                      <Table.Td>{ctr.centroIdVinculado ? '—' : <Checkbox checked={ctr.criar} onChange={(e) => { const novo = [...centros]; novo[i].criar = e.target.checked; setCentros(novo) }} />}</Table.Td>
                      <Table.Td>{ctr.descricao}</Table.Td>
                      <Table.Td><TextInput size="xs" value={ctr.maquina} placeholder="Descrição da máquina" onChange={(e) => { const novo = [...centros]; novo[i].maquina = e.target.value; setCentros(novo) }} style={{ width: 220 }} /></Table.Td>
                      <Table.Td>
                        {!ctr.centroIdVinculado && centrosDisponiveis.length > 0 && (
                          <Select
                            size="xs"
                            placeholder="Ou vincular..."
                            clearable
                            data={centrosDisponiveis.map(c => ({ value: c.id, label: `${c.codigo} - ${c.descricao}` }))}
                            value={null}
                            onChange={(v) => {
                              if (v) {
                                const centroSel = centrosDisponiveis.find(c => c.id === v)
                                if (centroSel) {
                                  const novo = [...centros]
                                  novo[i].centroIdVinculado = centroSel.id
                                  novo[i].maquina = centroSel.descricao
                                  novo[i].codigo = centroSel.codigo
                                  novo[i].tipoMaquina = centroSel.tipoMaquina
                                  novo[i].criar = false
                                  setCentros(novo)
                                }
                              }
                            }}
                            style={{ width: 180 }}
                          />
                        )}
                        {ctr.centroIdVinculado && (
                          <Button size="xs" variant="subtle" color="red" onClick={() => {
                            const novo = [...centros]
                            novo[i].centroIdVinculado = null
                            novo[i].maquina = ''
                            novo[i].criar = true
                            setCentros(novo)
                          }}>Desvincular</Button>
                        )}
                      </Table.Td>
                      <Table.Td>{ctr.centroIdVinculado ? <Text size="xs" c="dimmed">{ctr.codigo}</Text> : <TextInput size="xs" value={ctr.codigo} onChange={(e) => { const novo = [...centros]; novo[i].codigo = e.target.value; setCentros(novo) }} style={{ width: 80 }} />}</Table.Td>
                      <Table.Td>
                        <Select
                          size="xs"
                          placeholder="Selecione"
                          data={[
                            { value: 'IMPRESSAO', label: 'Impressão' },
                            { value: 'ACABAMENTO', label: 'Acabamento' },
                            { value: 'CORTADEIRA', label: 'Cortadeira' },
                            { value: 'COLAGEM', label: 'Colagem' },
                            { value: 'VERNIZ', label: 'Verniz' },
                          ]}
                          value={ctr.tipoMaquina}
                          onChange={(v) => { const novo = [...centros]; novo[i].tipoMaquina = v || null; setCentros(novo) }}
                          error={ctr.criar && !ctr.centroIdVinculado && !ctr.tipoMaquina ? 'Obrigatório' : undefined}
                          style={{ width: 140 }}
                        />
                      </Table.Td>
                      <Table.Td>{ctr.centroIdVinculado ? <Badge color="green" size="sm">✓ Vinculado</Badge> : ctr.criar ? <Badge color="blue" size="sm">Será criado</Badge> : <Badge color="gray" size="sm">Pular</Badge>}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Stack>
          )}

          {/* PASSO 5: Resumo */}
          {wizardStep === 4 && (
            <Stack gap="md">
              <Title order={5}>Passo 5 — Resumo</Title>
              <Divider />
              <SimpleGrid cols={2}>
                <Card withBorder p="sm">
                  <Text size="xs" c="dimmed">Cliente</Text>
                  <Text fw={600}>{clienteAcao === 'existente' ? `✓ ${preview.sugestoes.cliente?.razaoSocial || 'Existente'}` : clienteAcao === 'criar' ? `+ ${clienteForm.razaoSocial}` : '— Sem vínculo'}</Text>
                </Card>
                <Card withBorder p="sm">
                  <Text size="xs" c="dimmed">Produto Acabado</Text>
                  <Text fw={600}>{produtoAcao === 'existente' ? `✓ ${preview.sugestoes.produto?.nome || 'Existente'}` : produtoAcao === 'criar' ? `+ ${produtoForm.nome}` : '— Sem vínculo'}</Text>
                </Card>
                <Card withBorder p="sm">
                  <Text size="xs" c="dimmed">Materiais</Text>
                  <Text fw={600}>{materiais.filter(m => m.produtoIdVinculado).length} vinculados, {materiais.filter(m => m.criar && !m.produtoIdVinculado).length} a criar, {materiais.filter(m => !m.criar && !m.produtoIdVinculado).length} sem vínculo</Text>
                </Card>
                <Card withBorder p="sm">
                  <Text size="xs" c="dimmed">Centros/Máquinas</Text>
                  <Text fw={600}>{centros.filter(c => c.centroIdVinculado).length} vinculados, {centros.filter(c => c.criar && !c.centroIdVinculado).length} a criar, {centros.filter(c => !c.criar && !c.centroIdVinculado).length} sem vínculo</Text>
                </Card>
              </SimpleGrid>
              <Alert color="blue"><Text size="sm">Ao confirmar, o sistema criará as entidades marcadas e a OP com todos os vínculos. Os mapeamentos serão salvos para importações futuras (De/Para).</Text></Alert>
            </Stack>
          )}

          {/* Navegação do Wizard */}
          <Group justify="space-between" mt="xl">
            <Button variant="outline" onClick={() => wizardStep > 0 ? setWizardStep(wizardStep - 1) : setEtapaGlobal('preview')} disabled={loading}>
              {wizardStep === 0 ? 'Voltar ao Preview' : 'Anterior'}
            </Button>
            {wizardStep < 4 ? (
              <Button onClick={() => {
                // Validar Step 4 (centros): tipoMaquina obrigatório quando criar = true
                if (wizardStep === 3) {
                  const centrosSemTipo = centros.filter(c => c.criar && !c.centroIdVinculado && !c.tipoMaquina)
                  if (centrosSemTipo.length > 0) {
                    notifications.show({ title: 'Atenção', message: 'Selecione o Tipo de Máquina para todos os centros que serão criados.', color: 'yellow' })
                    return
                  }
                }
                setWizardStep(wizardStep + 1)
              }}>Próximo</Button>
            ) : (
              <Button color="green" leftSection={<IconCheck size={16} />} onClick={executarCriacao} loading={loading}>
                Criar OP
              </Button>
            )}
          </Group>
        </Card>
      )}

      {/* SUCESSO */}
      {etapaGlobal === 'sucesso' && opCriada && (
        <Card shadow="sm" padding="lg">
          <Stack align="center" gap="md" py="xl">
            <IconCheck size={64} color="var(--mantine-color-green-6)" />
            <Title order={3}>OP #{opCriada.referenciaExterna || opCriada.numero} criada!</Title>
            <Text c="dimmed">Todos os cadastros e vínculos foram realizados.</Text>
            <Group>
              <Button variant="outline" onClick={resetar}>Importar outra</Button>
              <Button onClick={() => router.push(`/pcp/ordens-producao/${opCriada.id}`)}>Ver OP</Button>
            </Group>
          </Stack>
        </Card>
      )}
    </Stack>
  )
}

function corTipo(tipo: string) {
  const m: Record<string, string> = { PAPEL: 'blue', TINTA: 'violet', VERNIZ: 'cyan', COLA: 'yellow', FACA: 'gray' }
  return m[tipo] || 'gray'
}
