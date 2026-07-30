'use client'

import { useEffect } from 'react'
import { Card, SimpleGrid, Text, Title, ThemeIcon, UnstyledButton, Stack } from '@mantine/core'
import {
  IconBuildingFactory,
  IconTool,
  IconClock,
  IconSitemap,
  IconRoute,
  IconPalette,
  IconCategory,
} from '@tabler/icons-react'
import { useRouter } from 'next/navigation'

const CADASTROS = [
  { label: 'Centros de Produção', icon: IconBuildingFactory, href: '/pcp/cadastros/centros', color: 'violet', desc: 'Máquinas, setores e linhas' },
  { label: 'Tipo de Processo', icon: IconCategory, href: '/pcp/cadastros/tipos-processo', color: 'teal', desc: 'Cortadeira, Impressão, Acabamento... — define as abas da Programação' },
  { label: 'Recursos', icon: IconTool, href: '/pcp/cadastros/recursos', color: 'blue', desc: 'Operadores, ferramentas, facas' },
  { label: 'Turnos', icon: IconClock, href: '/pcp/cadastros/turnos', color: 'cyan', desc: 'Horários de trabalho' },
  { label: 'Estruturas (BOM)', icon: IconSitemap, href: '/pcp/cadastros/estruturas', color: 'green', desc: 'Árvore de materiais' },
  { label: 'Roteiros', icon: IconRoute, href: '/pcp/cadastros/roteiros', color: 'orange', desc: 'Sequência de operações' },
  { label: 'Atributos Gráficos', icon: IconPalette, href: '/pcp/cadastros/atributos-graficos', color: 'pink', desc: 'Cartão, cor, formato, gramatura' },
]

export default function CadastrosPcpPage() {
  useEffect(() => { document.title = 'PCP - Cadastros' }, [])
  const router = useRouter()

  return (
    <Stack gap="md">
      <Title order={3}>Cadastros PCP</Title>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
        {CADASTROS.map((item) => (
          <UnstyledButton key={item.label} onClick={() => router.push(item.href)}>
            <Card withBorder style={{ cursor: 'pointer' }} className="hover:shadow-md transition-shadow" h="100%">
              <Stack align="center" gap="xs" py="md">
                <ThemeIcon color={item.color} variant="light" size={48} radius="md">
                  <item.icon size={24} />
                </ThemeIcon>
                <Text fw={600} size="md" ta="center">{item.label}</Text>
                <Text size="xs" c="dimmed" ta="center">{item.desc}</Text>
              </Stack>
            </Card>
          </UnstyledButton>
        ))}
      </SimpleGrid>
    </Stack>
  )
}
