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
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconUpload, IconFileCode, IconCheck, IconAlertCircle } from '@tabler/icons-react'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { api } from '@/lib/api'

interface DadosImportados {
  sucesso: boolean
  dadosExtraidos: {
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
  cadastros: {
    remetenteCadastrado: boolean
    destinatarioCadastrado: boolean
  }
  ctePrePreenchido: any
}

export default function ImportarNfePage() {
  useModuloGuard('FISCAL')
  useEffect(() => { document.title = 'Vizor - Importar NF-e para CT-e' }, [])

  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState<DadosImportados | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  async function processarArquivo(file: File) {
    setLoading(true)
    setErro(null)
    setResultado(null)

    try {
      if (file.name.endsWith('.xml') || file.type.includes('xml')) {
        // Processar como XML
        const texto = await file.text()
        if (!texto.includes('<NFe') && !texto.includes('<nfeProc')) {
          setErro('O arquivo XML não parece ser uma NF-e válida.')
          setLoading(false)
          return
        }
        const { data } = await api.post('/fiscal/cte/importar-nfe', { xml: texto })
        setResultado(data)
      } else if (file.name.endsWith('.pdf') || file.type === 'application/pdf') {
        // Processar como PDF (DANFE)
        const arrayBuffer = await file.arrayBuffer()
        const base64 = btoa(
          new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
        )
        const { data } = await api.post('/fiscal/cte/importar-danfe-pdf', { pdfBase64: base64 })
        setResultado(data)
      } else {
        setErro('Formato não suportado. Envie um arquivo .xml ou .pdf')
        setLoading(false)
        return
      }

      notifications.show({
        title: 'Arquivo processado com sucesso',
        message: 'Dados extraídos para emissão do CT-e',
        color: 'green',
      })
    } catch (err: any) {
      setErro(err?.response?.data?.message || 'Erro ao processar o arquivo')
    }
    setLoading(false)
  }

  function irParaEmissao() {
    if (!resultado) return
    // Salvar dados no sessionStorage para o formulário de emissão pegar
    sessionStorage.setItem('cte_importado', JSON.stringify(resultado.ctePrePreenchido))
    router.push('/fiscal/cte/nova?importado=true')
  }

  return (
    <Paper p="md">
      <Title order={3} mb="xs">Gerar CT-e a partir de NF-e</Title>
      <Text size="sm" c="dimmed" mb="lg">
        Início / Fiscal / CT-e / Importar NF-e
      </Text>

      <Text size="sm" mb="md">
        Arraste o XML ou PDF (DANFE) da NF-e recebida para preencher o CT-e automaticamente.
        O sistema extrai remetente, destinatário, origem, destino, valor, peso e vincula a chave da NF-e.
      </Text>

      {/* Área de upload */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          const file = e.dataTransfer.files[0]
          if (file) processarArquivo(file)
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
        <Text size="lg">Arraste o XML ou PDF da NF-e aqui</Text>
        <Text size="sm" c="dimmed" mt={4}>
          Ou clique para selecionar o arquivo (.xml ou .pdf do DANFE, máx 5MB)
        </Text>
        {loading && <Loader size="sm" mt="md" />}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xml,.pdf"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) processarArquivo(file)
          e.target.value = ''
        }}
      />

      {/* Erro */}
      {erro && (
        <Alert color="red" icon={<IconAlertCircle />} mb="md" title="Erro">
          {erro}
        </Alert>
      )}

      {/* Resultado */}
      {resultado && (
        <Paper p="md" withBorder>
          <Group justify="space-between" mb="md">
            <Title order={4}>Dados extraídos da NF-e</Title>
            <Button color="green" leftSection={<IconCheck size={16} />} onClick={irParaEmissao}>
              Emitir CT-e com esses dados
            </Button>
          </Group>

          <Table mb="md">
            <Table.Tbody>
              <Table.Tr>
                <Table.Td fw={600}>Chave NF-e</Table.Td>
                <Table.Td><code>{resultado.dadosExtraidos.chaveAcesso}</code></Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td fw={600}>NF-e Nº</Table.Td>
                <Table.Td>{resultado.dadosExtraidos.numero} / Série {resultado.dadosExtraidos.serie}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td fw={600}>Remetente</Table.Td>
                <Table.Td>
                  {resultado.dadosExtraidos.remetente.razaoSocial}
                  {resultado.cadastros.remetenteCadastrado && <Badge ml="xs" size="xs" color="green">Cadastrado</Badge>}
                </Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td fw={600}>Destinatário</Table.Td>
                <Table.Td>
                  {resultado.dadosExtraidos.destinatario.razaoSocial}
                  {resultado.cadastros.destinatarioCadastrado && <Badge ml="xs" size="xs" color="green">Cadastrado</Badge>}
                </Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td fw={600}>Origem</Table.Td>
                <Table.Td>{resultado.dadosExtraidos.origemMun} / {resultado.dadosExtraidos.origemUf}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td fw={600}>Destino</Table.Td>
                <Table.Td>{resultado.dadosExtraidos.destinoMun} / {resultado.dadosExtraidos.destinoUf}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td fw={600}>Valor da Carga</Table.Td>
                <Table.Td>R$ {resultado.dadosExtraidos.valorCarga.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td fw={600}>Peso Bruto</Table.Td>
                <Table.Td>{resultado.dadosExtraidos.pesoBruto} kg</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td fw={600}>Produto</Table.Td>
                <Table.Td>{resultado.dadosExtraidos.produtos}</Table.Td>
              </Table.Tr>
              {resultado.dadosExtraidos.veiculosNovos.length > 0 && (
                <Table.Tr>
                  <Table.Td fw={600}>Veículos</Table.Td>
                  <Table.Td>
                    {resultado.dadosExtraidos.veiculosNovos.map((v: any, i: number) => (
                      <Badge key={i} mr="xs" variant="outline">Chassi: {v.chassi}</Badge>
                    ))}
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>

          <Text size="xs" c="dimmed">
            CFOP sugerido: {resultado.ctePrePreenchido.cfop} •
            Modal: Rodoviário •
            Tomador: Remetente
          </Text>
        </Paper>
      )}
    </Paper>
  )
}
