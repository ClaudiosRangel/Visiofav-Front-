'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { notifications } from '@mantine/notifications'
import { IconFileText, IconLink, IconTruck } from '@tabler/icons-react'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { FormularioEmissao, type StepConfig } from '@/components/fiscal/FormularioEmissao'
import { useMdfe } from '@/data/hooks/fiscal/useMdfe'

const UF_OPTIONS = [
  { value: 'AC', label: 'AC' },
  { value: 'AL', label: 'AL' },
  { value: 'AM', label: 'AM' },
  { value: 'AP', label: 'AP' },
  { value: 'BA', label: 'BA' },
  { value: 'CE', label: 'CE' },
  { value: 'DF', label: 'DF' },
  { value: 'ES', label: 'ES' },
  { value: 'GO', label: 'GO' },
  { value: 'MA', label: 'MA' },
  { value: 'MG', label: 'MG' },
  { value: 'MS', label: 'MS' },
  { value: 'MT', label: 'MT' },
  { value: 'PA', label: 'PA' },
  { value: 'PB', label: 'PB' },
  { value: 'PE', label: 'PE' },
  { value: 'PI', label: 'PI' },
  { value: 'PR', label: 'PR' },
  { value: 'RJ', label: 'RJ' },
  { value: 'RN', label: 'RN' },
  { value: 'RO', label: 'RO' },
  { value: 'RR', label: 'RR' },
  { value: 'RS', label: 'RS' },
  { value: 'SC', label: 'SC' },
  { value: 'SE', label: 'SE' },
  { value: 'SP', label: 'SP' },
  { value: 'TO', label: 'TO' },
]

const MODAL_TRANSPORTE_OPTIONS = [
  { value: '1', label: '1 - Rodoviário' },
  { value: '2', label: '2 - Aéreo' },
  { value: '3', label: '3 - Aquaviário' },
  { value: '4', label: '4 - Ferroviário' },
]

const steps: StepConfig[] = [
  {
    label: 'Dados Gerais',
    icon: IconFileText,
    fields: [
      {
        name: 'ufCarregamento',
        label: 'UF Carregamento',
        type: 'select',
        required: true,
        span: 4,
        options: UF_OPTIONS,
      },
      {
        name: 'ufDescarregamento',
        label: 'UF Descarregamento',
        type: 'select',
        required: true,
        span: 4,
        options: UF_OPTIONS,
      },
      {
        name: 'modalTransporte',
        label: 'Modal de Transporte',
        type: 'select',
        required: true,
        span: 4,
        options: MODAL_TRANSPORTE_OPTIONS,
      },
    ],
  },
  {
    label: 'Documentos Vinculados',
    icon: IconLink,
    fields: [
      {
        name: 'chavesNfe',
        label: 'Chaves NF-e (44 dígitos, uma por linha)',
        type: 'textarea',
        required: true,
        span: 12,
      },
    ],
  },
  {
    label: 'Veículo',
    icon: IconTruck,
    fields: [
      {
        name: 'placa',
        label: 'Placa do Veículo',
        type: 'text',
        required: true,
        span: 4,
      },
      {
        name: 'tara',
        label: 'Tara (kg)',
        type: 'number',
        required: true,
        span: 4,
      },
      {
        name: 'ufVeiculo',
        label: 'UF do Veículo',
        type: 'select',
        required: true,
        span: 4,
        options: UF_OPTIONS,
      },
    ],
  },
]

export default function MdfeNovaPage() {
  useModuloGuard('FISCAL')
  useEffect(() => { document.title = 'Vizor - Fiscal - Novo MDF-e' }, [])

  const router = useRouter()
  const { useEmitir } = useMdfe()
  const emitirMutation = useEmitir()

  async function handleSubmit(dados: Record<string, any>) {
    const chavesNfe = dados.chavesNfe
      ? (dados.chavesNfe as string)
          .split('\n')
          .map((c: string) => c.trim())
          .filter((c: string) => c.length > 0)
      : []

    const payload = {
      ufCarregamento: dados.ufCarregamento || '',
      ufDescarregamento: dados.ufDescarregamento || '',
      modalTransporte: Number(dados.modalTransporte) || 1,
      chavesNfe,
      veiculo: {
        placa: dados.placa || '',
        tara: Number(dados.tara) || 0,
        uf: dados.ufVeiculo || '',
      },
    }

    return new Promise<void>((resolve, reject) => {
      emitirMutation.mutate(payload, {
        onSuccess: (response: any) => {
          const status = response?.status || response?.documento?.status

          if (status === 'AUTORIZADA') {
            notifications.show({
              title: 'MDF-e Autorizado',
              message: `Protocolo: ${response?.protocolo || response?.documento?.protocolo || 'N/A'}`,
              color: 'green',
            })
            router.push('/fiscal/mdfe')
          } else if (status === 'REJEITADA') {
            notifications.show({
              title: 'MDF-e Rejeitado',
              message: response?.motivo || response?.erros?.[0] || 'Documento rejeitado pela SEFAZ',
              color: 'red',
            })
          } else {
            notifications.show({
              title: 'Sucesso',
              message: 'MDF-e enviado para processamento',
              color: 'green',
            })
            router.push('/fiscal/mdfe')
          }

          resolve()
        },
        onError: (err: any) => {
          notifications.show({
            title: 'Erro na Emissão',
            message: err?.response?.data?.message || 'Erro ao emitir MDF-e',
            color: 'red',
          })
          reject(err)
        },
      })
    })
  }

  return (
    <FormularioEmissao
      tipo="MDFE"
      steps={steps}
      onSubmit={handleSubmit}
      title="Emissão de MDF-e"
      breadcrumb="Início / Fiscal / MDF-e / Nova"
    />
  )
}
