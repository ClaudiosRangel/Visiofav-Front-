'use client'

import { useEffect, useState, useCallback } from 'react'
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
  Dropzone,
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
  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState<DadosImportados | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function processarArquivo(file: File) {
    setLoading(true)
    setErro(null)
    setResultado(null)

    try {
      const texto = await file.text()

      // Verificar se é XML
      if (!texto.includes('<NFe') && !texto.includes('<nfeProc')) {
        setErro('O arquivo não parece ser um XML de NF-e válido. Envie o arquivo .xml (não o PDF do DANFE).')
        setLoading(false)
        return
      }

      const { data } = await api.post('/fiscal/cte/importar-nfe', { xml: texto })
      setResultado(data)

      notifications.show({
        title: 'NF-e processada com sucesso',
        message: `Chave: ${data.dadosExtraidos.chaveAcesso}`,
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
        Arraste o XML da NF-e recebida (Hayasa, ou outro remetente) para preencher o CT-e automaticamente.
        O sistema extrai remetente, destinatário, origem, destino, valor, peso e vincula a chave da NF-e.
      </Text>

      {/* Dropzone */}
      <Dropzone
        onDrop={(files) => { if (files[0]) processarArquivo(files[0]) }}
        accept={{ 'text/xml': ['.xml'], 'application/xml': ['.xml'] }}
        maxSize={5 * 1024 * 1024}
        multiple={false}
        loading={loading}
        mb="lg"
      >
        <Group justify="center" gap="xl" mih={120} style={{ pointerEvents: 'none' }}>
          <IconUpload size={40} stroke={1.5} />
          <div>
            <Text size="lg" inline>Arraste o XML da NF-e aqui</Text>
            <Text size="sm" c="dimmed" inline mt={7}>
              Ou clique para selecionar o arquivo (.xml, máx 5MB)
            </Text>
          </div>
        </Group>
      </Dropzone>

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
