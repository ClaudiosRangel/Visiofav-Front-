'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Paper,
  Title,
  Text,
  Group,
  Button,
  Stack,
  Badge,
  Table,
  Loader,
  Alert,
  ActionIcon,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconUpload, IconCheck, IconAlertCircle, IconTrash, IconPlus } from '@tabler/icons-react'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { api } from '@/lib/api'

interface DadosExtraidos {
  chaveAcesso: string
  numero: number
  serie: number
  remetente: { razaoSocial: string; cnpj: string; municipio: string; uf: string }
  destinatario: { razaoSocial: string; cnpj: string; municipio: string; uf: string }
  valorCarga: number
  pesoBruto: number
  produtos: string
  origemMun: string
  origemUf: string
  destinoMun: string
  destinoUf: string
  veiculosNovos: any[]
}

interface DadosImportados {
  sucesso: boolean
  avisoNfeDuplicada?: string | null
  dadosExtraidos: DadosExtraidos
  cadastros: {
    remetenteCadastrado: boolean
    destinatarioCadastrado: boolean
  }
  ctePrePreenchido: any
}

interface NFeImportada {
  nomeArquivo: string
  dados: DadosImportados
}

export default function ImportarNfePage() {
  useModuloGuard('FISCAL')
  useEffect(() => { document.title = 'Vizor - Importar NF-e para CT-e' }, [])

  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [nfesImportadas, setNfesImportadas] = useState<NFeImportada[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  // Origem/Destino de referência (definida pela primeira NF-e importada)
  const origemRef = nfesImportadas.length > 0
    ? { mun: nfesImportadas[0].dados.dadosExtraidos.origemMun, uf: nfesImportadas[0].dados.dadosExtraidos.origemUf }
    : null
  const destinoRef = nfesImportadas.length > 0
    ? { mun: nfesImportadas[0].dados.dadosExtraidos.destinoMun, uf: nfesImportadas[0].dados.dadosExtraidos.destinoUf }
    : null

  async function processarArquivo(file: File) {
    setLoading(true)
    setErro(null)

    try {
      let resultado: DadosImportados

      if (file.name.endsWith('.xml') || file.type.includes('xml')) {
        const texto = await file.text()
        if (!texto.includes('<NFe') && !texto.includes('<nfeProc')) {
          setErro('O arquivo XML não parece ser uma NF-e válida.')
          setLoading(false)
          return
        }
        const { data } = await api.post('/fiscal/cte/importar-nfe', { xml: texto })
        resultado = data
      } else if (file.name.endsWith('.pdf') || file.type === 'application/pdf') {
        const arrayBuffer = await file.arrayBuffer()
        const base64 = btoa(
          new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
        )
        const { data } = await api.post('/fiscal/cte/importar-danfe-pdf', { pdfBase64: base64 })
        resultado = data
      } else {
        setErro('Formato não suportado. Envie um arquivo .xml ou .pdf')
        setLoading(false)
        return
      }

      // Verificar duplicata (mesma chave de acesso nesta sessão)
      const chaveNova = resultado.dadosExtraidos.chaveAcesso
      if (nfesImportadas.some(n => n.dados.dadosExtraidos.chaveAcesso === chaveNova)) {
        setErro(`NF-e com chave ${chaveNova.substring(0, 20)}... já foi adicionada.`)
        setLoading(false)
        return
      }

      // Avisar se a NF-e já está vinculada a outro CT-e no banco (não bloqueia, só avisa)
      if (resultado.avisoNfeDuplicada) {
        notifications.show({
          title: '⚠️ NF-e já utilizada em outro CT-e',
          message: resultado.avisoNfeDuplicada,
          color: 'yellow',
          autoClose: 10000,
        })
      }

      // Validar mesma origem/destino (se já houver NF-e importada)
      if (nfesImportadas.length > 0) {
        const origemNova = `${resultado.dadosExtraidos.origemMun}/${resultado.dadosExtraidos.origemUf}`
        const destinoNovo = `${resultado.dadosExtraidos.destinoMun}/${resultado.dadosExtraidos.destinoUf}`
        const origemExistente = `${origemRef!.mun}/${origemRef!.uf}`
        const destinoExistente = `${destinoRef!.mun}/${destinoRef!.uf}`

        if (origemNova !== origemExistente || destinoNovo !== destinoExistente) {
          setErro(
            `Origem/Destino incompatíveis. ` +
            `CT-e atual: ${origemExistente} → ${destinoExistente}. ` +
            `Arquivo "${file.name}": ${origemNova} → ${destinoNovo}. ` +
            `Todas as NF-e devem ter a mesma origem e destino para entrar no mesmo CT-e.`
          )
          setLoading(false)
          return
        }
      }

      setNfesImportadas(prev => [...prev, { nomeArquivo: file.name, dados: resultado }])
      notifications.show({ title: 'Arquivo adicionado', message: `NF-e ${resultado.dadosExtraidos.numero} extraída com sucesso`, color: 'green' })
    } catch (err: any) {
      setErro(err?.response?.data?.message || 'Erro ao processar o arquivo')
    }
    setLoading(false)
  }

  async function processarMultiplos(files: FileList) {
    for (const file of Array.from(files)) {
      await processarArquivo(file)
    }
  }

  function removerNfe(index: number) {
    setNfesImportadas(prev => prev.filter((_, i) => i !== index))
  }

  function irParaEmissao() {
    if (nfesImportadas.length === 0) return

    // Consolidar dados: usar primeiro como base, somar valores/pesos, juntar NF-es
    const base = { ...nfesImportadas[0].dados.ctePrePreenchido }

    // Somar valores e pesos de todas as NF-es
    let valorTotal = 0
    let pesoTotal = 0
    const todasChaves: string[] = []
    const todosVeiculos: any[] = []
    const todosProdutos: string[] = []

    for (const nfe of nfesImportadas) {
      valorTotal += nfe.dados.dadosExtraidos.valorCarga || 0
      pesoTotal += nfe.dados.dadosExtraidos.pesoBruto || 0
      if (nfe.dados.dadosExtraidos.chaveAcesso) {
        todasChaves.push(nfe.dados.dadosExtraidos.chaveAcesso)
      }
      if (nfe.dados.dadosExtraidos.veiculosNovos?.length > 0) {
        todosVeiculos.push(...nfe.dados.dadosExtraidos.veiculosNovos)
      }
      if (nfe.dados.dadosExtraidos.produtos) {
        todosProdutos.push(nfe.dados.dadosExtraidos.produtos)
      }
    }

    // Montar payload consolidado
    base.valorCarga = valorTotal
    base.pesoBruto = pesoTotal
    base.nfesVinculadas = todasChaves.map(ch => ({ chave: ch }))
    base.veiculosNovos = todosVeiculos
    // Produto predominante: juntar os nomes distintos
    const produtosUnicos = [...new Set(todosProdutos.filter(Boolean))]
    base.proPred = produtosUnicos.length > 0 ? produtosUnicos.join('; ').substring(0, 100) : base.proPred

    sessionStorage.setItem('cte_importado', JSON.stringify(base))
    router.push('/fiscal/cte/nova?importado=true')
  }

  // Totalizadores
  const totalValor = nfesImportadas.reduce((sum, n) => sum + (n.dados.dadosExtraidos.valorCarga || 0), 0)
  const totalPeso = nfesImportadas.reduce((sum, n) => sum + (n.dados.dadosExtraidos.pesoBruto || 0), 0)

  return (
    <Paper p="md">
      <Title order={3} mb="xs">Gerar CT-e a partir de NF-e</Title>
      <Text size="sm" c="dimmed" mb="lg">
        Início / Fiscal / CT-e / Importar NF-e
      </Text>

      <Text size="sm" mb="md">
        Arraste um ou mais XMLs/PDFs (DANFE) de NF-e. Todas devem ter a <strong>mesma origem e destino</strong> para
        entrar no mesmo CT-e. Valores e pesos serão somados automaticamente.
      </Text>

      {/* Área de upload */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          if (e.dataTransfer.files.length > 0) processarMultiplos(e.dataTransfer.files)
        }}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? '#228be6' : '#555'}`,
          borderRadius: 8,
          padding: 40,
          textAlign: 'center',
          cursor: 'pointer',
          backgroundColor: dragOver ? 'rgba(34,139,230,0.05)' : 'transparent',
          marginBottom: 16,
          transition: 'all 0.2s',
        }}
      >
        <IconUpload size={40} stroke={1.5} style={{ marginBottom: 8 }} />
        <Text size="lg">Arraste os arquivos XML ou PDF das NF-e aqui</Text>
        <Text size="sm" c="dimmed" mt={4}>
          Ou clique para selecionar (pode selecionar múltiplos arquivos)
        </Text>
        {loading && <Loader size="sm" mt="md" />}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xml,.pdf"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) processarMultiplos(e.target.files)
          e.target.value = ''
        }}
      />

      {/* Erro */}
      {erro && (
        <Alert color="red" icon={<IconAlertCircle />} mb="md" title="Atenção" withCloseButton onClose={() => setErro(null)}>
          {erro}
        </Alert>
      )}

      {/* Lista de NF-es importadas */}
      {nfesImportadas.length > 0 && (
        <Paper p="md" withBorder>
          <Group justify="space-between" mb="md">
            <Title order={4}>NF-e vinculadas ao CT-e ({nfesImportadas.length})</Title>
            <Button color="green" leftSection={<IconCheck size={16} />} onClick={irParaEmissao}>
              Emitir CT-e com {nfesImportadas.length} NF-e(s)
            </Button>
          </Group>

          {/* Info de rota */}
          {origemRef && destinoRef && (
            <Alert color="blue" variant="light" mb="md">
              <Text size="sm">
                <strong>Rota do CT-e:</strong> {origemRef.mun}/{origemRef.uf} → {destinoRef.mun}/{destinoRef.uf}
              </Text>
              <Text size="sm">
                <strong>Valor total da carga:</strong> R$ {totalValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} •
                <strong> Peso bruto total:</strong> {totalPeso.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kg
              </Text>
            </Alert>
          )}

          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Arquivo</Table.Th>
                <Table.Th>NF-e</Table.Th>
                <Table.Th>Remetente</Table.Th>
                <Table.Th>Destinatário</Table.Th>
                <Table.Th>Valor</Table.Th>
                <Table.Th>Peso</Table.Th>
                <Table.Th w={50}></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {nfesImportadas.map((nfe, idx) => (
                <Table.Tr key={nfe.dados.dadosExtraidos.chaveAcesso}>
                  <Table.Td><Text size="xs">{nfe.nomeArquivo}</Text></Table.Td>
                  <Table.Td><Text size="sm">{nfe.dados.dadosExtraidos.numero}/{nfe.dados.dadosExtraidos.serie}</Text></Table.Td>
                  <Table.Td><Text size="xs" lineClamp={1}>{nfe.dados.dadosExtraidos.remetente.razaoSocial}</Text></Table.Td>
                  <Table.Td><Text size="xs" lineClamp={1}>{nfe.dados.dadosExtraidos.destinatario.razaoSocial}</Text></Table.Td>
                  <Table.Td><Text size="sm">R$ {nfe.dados.dadosExtraidos.valorCarga.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</Text></Table.Td>
                  <Table.Td><Text size="sm">{nfe.dados.dadosExtraidos.pesoBruto} kg</Text></Table.Td>
                  <Table.Td>
                    <ActionIcon variant="subtle" color="red" size="sm" onClick={() => removerNfe(idx)}>
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>

          <Group justify="space-between" mt="md">
            <Button variant="light" leftSection={<IconPlus size={14} />} onClick={() => fileInputRef.current?.click()}>
              Adicionar mais NF-e
            </Button>
            <Text size="xs" c="dimmed">
              CFOP sugerido: {nfesImportadas[0]?.dados.ctePrePreenchido?.cfop || '—'} •
              Remetente: {nfesImportadas[0]?.dados.dadosExtraidos.remetente.razaoSocial.substring(0, 30) || '—'}
            </Text>
          </Group>
        </Paper>
      )}
    </Paper>
  )
}
