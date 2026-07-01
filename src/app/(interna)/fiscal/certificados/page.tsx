'use client'

import { useState, useEffect } from 'react'
import {
  Stack,
  Text,
  Title,
  Button,
  Group,
  Modal,
  Table,
  Badge,
  ActionIcon,
  Tooltip,
  LoadingOverlay,
  FileInput,
  PasswordInput,
} from '@mantine/core'
import { IconPlus, IconTrash, IconCertificate, IconUpload } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { useCertificados } from '@/data/hooks/fiscal/useCertificados'
import { certificadosCrud, type CertificadoDigital } from '@/data/hooks/fiscal/useCadastrosFiscais'

function getStatusBadge(cert: CertificadoDigital) {
  switch (cert.statusVencimento) {
    case 'VALIDO':
      return <Badge color="green">Válido</Badge>
    case 'PROXIMO_VENCIMENTO':
      return <Badge color="orange">Próximo do Vencimento</Badge>
    case 'EXPIRADO':
      return <Badge color="red">Expirado</Badge>
    default:
      return <Badge color="gray">{cert.statusVencimento}</Badge>
  }
}

export default function CertificadosPage() {
  useModuloGuard('FISCAL')
  useEffect(() => { document.title = 'Vizor - Fiscal - Certificados' }, [])

  const { data: certificados, isLoading } = certificadosCrud.useListar()
  const excluir = certificadosCrud.useExcluir()

  const { useUpload } = useCertificados()
  const uploadMutation = useUpload()

  const [modalOpen, setModalOpen] = useState(false)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [senha, setSenha] = useState('')

  function abrirModal() {
    setArquivo(null)
    setSenha('')
    setModalOpen(true)
  }

  function fecharModal() {
    setModalOpen(false)
    setArquivo(null)
    setSenha('')
  }

  function handleUpload() {
    if (!arquivo || !senha) {
      notifications.show({
        title: 'Campos obrigatórios',
        message: 'Selecione o arquivo .pfx e informe a senha do certificado.',
        color: 'orange',
      })
      return
    }

    uploadMutation.mutate(
      { file: arquivo, senha },
      {
        onSuccess: () => {
          notifications.show({
            title: 'Sucesso',
            message: 'Certificado digital enviado com sucesso.',
            color: 'green',
          })
          fecharModal()
        },
        onError: (err: any) => {
          notifications.show({
            title: 'Erro ao enviar certificado',
            message: err?.response?.data?.message || 'Não foi possível enviar o certificado.',
            color: 'red',
          })
        },
      },
    )
  }

  function handleExcluir(cert: CertificadoDigital) {
    if (!confirm(`Excluir certificado de ${cert.titular} (${cert.cnpj})?`)) return
    excluir.mutate(cert.id, {
      onSuccess: () => {
        notifications.show({ title: 'Sucesso', message: 'Certificado excluído.', color: 'green' })
      },
      onError: (err: any) => {
        notifications.show({
          title: 'Erro',
          message: err?.response?.data?.message || 'Falha ao excluir certificado.',
          color: 'red',
        })
      },
    })
  }

  const rows = (certificados?.data ?? []).map((cert) => (
    <Table.Tr key={cert.id}>
      <Table.Td>{cert.titular}</Table.Td>
      <Table.Td>{cert.cnpj}</Table.Td>
      <Table.Td>
        {new Date(cert.validoAte).toLocaleDateString('pt-BR')}
      </Table.Td>
      <Table.Td>{getStatusBadge(cert)}</Table.Td>
      <Table.Td>
        <Group gap={4}>
          <Tooltip label="Excluir">
            <ActionIcon variant="light" color="red" onClick={() => handleExcluir(cert)}>
              <IconTrash size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Table.Td>
    </Table.Tr>
  ))

  const isFormValid = arquivo !== null && senha.trim().length > 0

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">Início / Fiscal / Certificados</Text>
      <Group justify="space-between" align="center">
        <Title order={3}>Certificados Digitais</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={abrirModal}>
          Novo Certificado
        </Button>
      </Group>

      <div style={{ position: 'relative', minHeight: 120 }}>
        <LoadingOverlay visible={isLoading} />

        {!isLoading && (!certificados?.data || certificados.data.length === 0) ? (
          <Text ta="center" c="dimmed" py="xl">
            Nenhum certificado digital cadastrado.
          </Text>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Razão Social</Table.Th>
                <Table.Th>CNPJ</Table.Th>
                <Table.Th>Validade</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Ações</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>{rows}</Table.Tbody>
          </Table>
        )}
      </div>

      {/* Modal Upload de Certificado */}
      <Modal
        opened={modalOpen}
        onClose={fecharModal}
        title="Novo Certificado Digital"
        size="md"
        centered
      >
        <Stack gap="sm">
          <FileInput
            label="Arquivo do Certificado (.pfx)"
            placeholder="Selecione o arquivo .pfx"
            accept=".pfx"
            value={arquivo}
            onChange={setArquivo}
            leftSection={<IconCertificate size={16} />}
          />
          <PasswordInput
            label="Senha do Certificado"
            placeholder="Digite a senha do certificado"
            value={senha}
            onChange={(e) => setSenha(e.currentTarget.value)}
          />
        </Stack>

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={fecharModal}>Cancelar</Button>
          <Button
            leftSection={<IconUpload size={16} />}
            onClick={handleUpload}
            loading={uploadMutation.isPending}
            disabled={!isFormValid}
          >
            Enviar
          </Button>
        </Group>
      </Modal>
    </Stack>
  )
}
