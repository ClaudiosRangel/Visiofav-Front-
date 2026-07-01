'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { notifications } from '@mantine/notifications'
import {
  IconFileText,
  IconUser,
  IconSettings,
} from '@tabler/icons-react'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { FormularioEmissao, type StepConfig } from '@/components/fiscal/FormularioEmissao'
import { useNfse } from '@/data/hooks/fiscal/useNfse'

const steps: StepConfig[] = [
  {
    label: 'Dados Gerais',
    icon: IconFileText,
    fields: [
      {
        name: 'naturezaOp',
        label: 'Natureza da Operação',
        type: 'text',
        required: true,
        span: 6,
      },
      {
        name: 'regimeTributario',
        label: 'Regime Tributário',
        type: 'select',
        required: true,
        span: 6,
        options: [
          { value: '1', label: '1 - Simples Nacional' },
          { value: '2', label: '2 - Simples Nacional - Excesso' },
          { value: '3', label: '3 - Regime Normal' },
        ],
      },
    ],
  },
  {
    label: 'Tomador',
    icon: IconUser,
    fields: [
      {
        name: 'cpfCnpj',
        label: 'CPF/CNPJ',
        type: 'text',
        required: true,
        span: 6,
      },
      {
        name: 'razaoSocial',
        label: 'Razão Social',
        type: 'text',
        required: true,
        span: 6,
      },
      {
        name: 'email',
        label: 'E-mail',
        type: 'text',
        span: 12,
      },
    ],
  },
  {
    label: 'Serviço',
    icon: IconSettings,
    fields: [
      {
        name: 'descricaoServico',
        label: 'Descrição do Serviço',
        type: 'textarea',
        required: true,
        span: 12,
      },
      {
        name: 'codigoServico',
        label: 'Código do Serviço',
        type: 'text',
        required: true,
        span: 4,
      },
      {
        name: 'valorServicos',
        label: 'Valor dos Serviços',
        type: 'number',
        required: true,
        span: 4,
      },
      {
        name: 'aliquotaIss',
        label: 'Alíquota ISS (%)',
        type: 'number',
        required: true,
        span: 4,
      },
    ],
  },
]

export default function NfseNovaPage() {
  useModuloGuard('FISCAL')
  useEffect(() => { document.title = 'Vizor - Fiscal - Nova NFS-e' }, [])

  const router = useRouter()
  const { useEmitir } = useNfse()
  const emitirMutation = useEmitir()

  async function handleSubmit(dados: Record<string, any>) {
    const payload = {
      naturezaOp: dados.naturezaOp || '',
      regimeTributario: Number(dados.regimeTributario) || 3,
      tomador: {
        cpfCnpj: dados.cpfCnpj || '',
        razaoSocial: dados.razaoSocial || '',
        email: dados.email || undefined,
      },
      servico: {
        descricaoServico: dados.descricaoServico || '',
        codigoServico: dados.codigoServico || '',
        valorServicos: Number(dados.valorServicos) || 0,
        aliquotaIss: Number(dados.aliquotaIss) || 0,
      },
    }

    return new Promise<void>((resolve, reject) => {
      emitirMutation.mutate(payload, {
        onSuccess: (response: any) => {
          const status = response?.status || response?.documento?.status

          if (status === 'AUTORIZADA') {
            notifications.show({
              title: 'NFS-e Autorizada',
              message: `Nota de serviço emitida com sucesso. Número: ${response?.numero || response?.documento?.numero || 'N/A'}`,
              color: 'green',
            })
            router.push('/fiscal/nfse')
          } else if (status === 'REJEITADA') {
            notifications.show({
              title: 'NFS-e Rejeitada',
              message: response?.motivo || response?.erros?.[0] || 'Documento rejeitado pela prefeitura',
              color: 'red',
            })
          } else {
            notifications.show({
              title: 'Sucesso',
              message: 'NFS-e enviada para processamento',
              color: 'green',
            })
            router.push('/fiscal/nfse')
          }

          resolve()
        },
        onError: (err: any) => {
          notifications.show({
            title: 'Erro na Emissão',
            message: err?.response?.data?.message || 'Erro ao emitir NFS-e',
            color: 'red',
          })
          reject(err)
        },
      })
    })
  }

  return (
    <FormularioEmissao
      tipo="NFSE"
      steps={steps}
      onSubmit={handleSubmit}
      title="Emissão de NFS-e"
      breadcrumb="Início / Fiscal / NFS-e / Nova"
    />
  )
}
