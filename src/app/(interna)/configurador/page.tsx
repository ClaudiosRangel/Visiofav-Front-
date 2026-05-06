'use client'

import { useEffect, useMemo } from 'react'
import { Card, Text, SimpleGrid, UnstyledButton, Group, Divider } from '@mantine/core'
import {
  IconAdjustments,
  IconBuildingWarehouse,
  IconMapPin,
  IconColumns,
  IconListCheck,
  IconPackage,
  IconTags,
  IconUsers,
  IconTruck,
  IconCategory,
  IconBarcode,
  IconMap,
} from '@tabler/icons-react'
import Link from 'next/link'
import { getUserPerfil } from '@/hooks/usePerfilGuard'

const atalhos = [
  { icon: IconAdjustments, label: 'Fluxo de processos', href: '/configurador/fluxo' },
  { icon: IconBuildingWarehouse, label: 'Depósito', href: '/configurador/depositos' },
  { icon: IconMapPin, label: 'Endereços', href: '/configurador/enderecos' },
  { icon: IconColumns, label: 'Estrutura física', href: '/configurador/estruturas' },
  { icon: IconListCheck, label: 'Convocação Ativa', href: '/configurador/convocacao' },
]

const cadastros = [
  { label: 'Produto/SKU', href: '/configurador/produtos' },
  { label: 'Atributos de estoque', href: '/configurador/atributos-estoque' },
  { label: 'Grupo de Endereço', href: '/configurador/grupo-endereco' },
  { label: 'Tipo de estoque', href: '/configurador/tipo-estoque' },
  { label: 'Fornecedor', href: '/configurador/fornecedores' },
  { label: 'Mapeamento de endereço', href: '/configurador/mapeamento-endereco' },
  { label: 'Características de estoque', href: '/configurador/caracteristicas-estoque' },
  { label: 'Transportadora', href: '/configurador/transportadoras' },
  { label: 'Categoria de produto', href: '/configurador/categorias' },
  { label: 'Cliente', href: '/configurador/clientes' },
  { label: 'Centro de Distribuição', href: '/configurador/centros-distribuicao' },
  { label: 'Zonas / Bairros', href: '/configurador/zonas' },
  { label: 'Docas', href: '/configurador/docas' },
  { label: 'Funcionários', href: '/configurador/funcionarios' },
  { label: 'Funções', href: '/configurador/funcoes' },
  { label: 'Equipamentos', href: '/configurador/equipamentos' },
  { label: 'Veículos', href: '/configurador/veiculos' },
  { label: 'Tipo Carroceria', href: '/configurador/tipo-carroceria' },
  { label: 'Tipo Carga', href: '/configurador/tipo-carga' },
  { label: 'Forma Armazenagem', href: '/configurador/forma-armazenagem' },
  { label: 'Ambiente Armazenagem', href: '/configurador/ambiente-armazenagem' },
  { label: 'Parâmetros', href: '/configurador/parametros' },
  { label: 'Usuários', href: '/configurador/usuarios' },
]

export default function ConfiguradorPage() {
  useEffect(() => { document.title = 'VisioFab - Configurador' }, [])

  const filteredCadastros = useMemo(() => {
    const perfil = getUserPerfil()
    if (perfil === 'ADMIN' || perfil === 'SUPER_ADMIN') return cadastros
    return cadastros.filter((item) => item.href !== '/configurador/usuarios')
  }, [])
  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>
        Início / Configurador
      </Text>
      <Text size="xl" fw={600} mb="lg">
        Configurador WMS
      </Text>

      {/* Cards de atalho - inspirado na imagem */}
      <SimpleGrid cols={{ base: 2, sm: 3, lg: 5 }} mb="xl">
        {atalhos.map((item) => (
          <UnstyledButton key={item.href} component={Link} href={item.href}>
            <Card className="text-center hover:shadow-md transition-shadow cursor-pointer border border-gray-100">
              <div className="flex flex-col items-center gap-3 py-2">
                <item.icon size={36} className="text-teal-600" stroke={1.2} />
                <Text size="sm" fw={500}>
                  {item.label}
                </Text>
              </div>
            </Card>
          </UnstyledButton>
        ))}
      </SimpleGrid>

      {/* Lista de cadastros - inspirado na imagem */}
      <Card>
        <Text fw={600} mb={4}>
          Cadastros ({filteredCadastros.length})
        </Text>
        <Text size="xs" c="dimmed" mb="md">
          Selecione a rotina de Cadastros na lista abaixo:
        </Text>
        <Divider mb="md" />

        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
          {filteredCadastros.map((item) => (
            <UnstyledButton
              key={item.href}
              component={Link}
              href={item.href}
              className="py-2 px-3 rounded-md hover:bg-gray-50 transition-colors"
            >
              <Text size="sm" c="primary" className="hover:underline">
                {item.label}
              </Text>
            </UnstyledButton>
          ))}
        </SimpleGrid>
      </Card>
    </div>
  )
}
