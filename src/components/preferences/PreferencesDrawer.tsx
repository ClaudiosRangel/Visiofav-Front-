'use client'

import {
  Drawer,
  Stack,
  Text,
  SegmentedControl,
  Select,
  Switch,
  Divider,
  Button,
  Group,
  Modal,
  Badge,
} from '@mantine/core'
import {
  IconSun,
  IconMoon,
  IconDeviceDesktop,
  IconLogout,
  IconKeyboard,
  IconInfoCircle,
} from '@tabler/icons-react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePreferences } from '@/providers/PreferencesProvider'
import { useTheme } from '@/providers/ThemeProvider'
import { useEmpresa } from '@/providers/EmpresaProvider'

interface PreferencesDrawerProps {
  opened: boolean
  onClose: () => void
}

export default function PreferencesDrawer({ opened, onClose }: PreferencesDrawerProps) {
  const router = useRouter()
  const { preferences, updatePreference } = usePreferences()
  const { mode } = useTheme()
  const { modulos } = useEmpresa()
  const [logoutConfirm, setLogoutConfirm] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  function handleLogout() {
    localStorage.removeItem('visiofab-wms-token')
    localStorage.removeItem('visiofab-wms-user')
    localStorage.removeItem('visiofab-wms-empresa')
    router.push('/login')
  }

  const buildDate = (() => {
    try {
      const d = process.env.NEXT_PUBLIC_BUILD_DATE
      if (!d) return '—'
      return new Date(d).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    } catch { return '—' }
  })()

  const moduloOptions = [
    { value: 'WMS', label: 'WMS' },
    { value: 'PCP', label: 'PCP' },
    { value: 'VENDAS', label: 'Vendas' },
    { value: 'COMPRAS', label: 'Compras' },
    { value: 'FINANCEIRO', label: 'Financeiro' },
    { value: 'CTE', label: 'Fiscal' },
  ].filter(m => modulos.includes(m.value))

  return (
    <>
      <Drawer
        opened={opened}
        onClose={onClose}
        title="Preferências"
        position="right"
        size="sm"
        overlayProps={{ backgroundOpacity: 0.3 }}
      >
        <Stack gap="lg">
          {/* Tema */}
          <div>
            <Text size="sm" fw={500} mb={6}>Tema</Text>
            <SegmentedControl
              fullWidth
              value={mode}
              onChange={(val) => updatePreference('tema', val as 'light' | 'dark' | 'auto')}
              data={[
                { label: <Group gap={4} justify="center"><IconSun size={14} /><Text size="xs">Claro</Text></Group>, value: 'light' },
                { label: <Group gap={4} justify="center"><IconMoon size={14} /><Text size="xs">Escuro</Text></Group>, value: 'dark' },
                { label: <Group gap={4} justify="center"><IconDeviceDesktop size={14} /><Text size="xs">Auto</Text></Group>, value: 'auto' },
              ]}
            />
          </div>

          <Divider />

          {/* Idioma */}
          <div>
            <Text size="sm" fw={500} mb={6}>Idioma</Text>
            <Select
              value={preferences.idioma}
              onChange={(val) => val && updatePreference('idioma', val)}
              data={[
                { value: 'pt-BR', label: 'Português (BR)' },
                { value: 'en-US', label: 'English (US)', disabled: true },
                { value: 'es', label: 'Español', disabled: true },
              ]}
            />
          </div>

          {/* Densidade */}
          <div>
            <Text size="sm" fw={500} mb={6}>Densidade da Interface</Text>
            <SegmentedControl
              fullWidth
              value={preferences.densidade}
              onChange={(val) => updatePreference('densidade', val as 'compacta' | 'normal' | 'espacosa')}
              data={[
                { label: 'Compacta', value: 'compacta' },
                { label: 'Normal', value: 'normal' },
                { label: 'Espaçosa', value: 'espacosa' },
              ]}
            />
          </div>

          {/* Formato de Data */}
          <div>
            <Text size="sm" fw={500} mb={6}>Formato de Data</Text>
            <SegmentedControl
              fullWidth
              value={preferences.formatoData}
              onChange={(val) => updatePreference('formatoData', val as 'DD/MM/YYYY' | 'YYYY-MM-DD')}
              data={[
                { label: 'DD/MM/YYYY', value: 'DD/MM/YYYY' },
                { label: 'YYYY-MM-DD', value: 'YYYY-MM-DD' },
              ]}
            />
          </div>

          <Divider />

          {/* Notificações */}
          <div>
            <Text size="sm" fw={500} mb={8}>Notificações</Text>
            <Stack gap="xs">
              <Switch
                label="Sons"
                checked={preferences.notifSons}
                onChange={(e) => updatePreference('notifSons', e.currentTarget.checked)}
              />
              <Switch
                label="Push"
                checked={preferences.notifPush}
                onChange={(e) => updatePreference('notifPush', e.currentTarget.checked)}
              />
              <Switch
                label="Email"
                checked={preferences.notifEmail}
                onChange={(e) => updatePreference('notifEmail', e.currentTarget.checked)}
              />
            </Stack>
          </div>

          <Divider />

          {/* Módulo Padrão */}
          <div>
            <Text size="sm" fw={500} mb={6}>Módulo Padrão (após login)</Text>
            <Select
              placeholder="Selecione..."
              value={preferences.moduloPadrao}
              onChange={(val) => updatePreference('moduloPadrao', val)}
              data={moduloOptions}
              clearable
            />
          </div>

          {/* Tamanho da Fonte */}
          <div>
            <Text size="sm" fw={500} mb={6}>Tamanho da Fonte</Text>
            <SegmentedControl
              fullWidth
              value={preferences.tamanhoFonte}
              onChange={(val) => updatePreference('tamanhoFonte', val as 'pequeno' | 'medio' | 'grande')}
              data={[
                { label: 'Pequeno', value: 'pequeno' },
                { label: 'Médio', value: 'medio' },
                { label: 'Grande', value: 'grande' },
              ]}
            />
          </div>

          <Divider />

          {/* Atalhos de Teclado */}
          <Button
            variant="subtle"
            leftSection={<IconKeyboard size={16} />}
            onClick={() => setShortcutsOpen(true)}
            fullWidth
            justify="start"
          >
            Atalhos de Teclado
          </Button>

          {/* Sobre */}
          <div>
            <Group gap={6} mb={4}>
              <IconInfoCircle size={16} className="text-gray-400" />
              <Text size="sm" fw={500}>Sobre</Text>
            </Group>
            <Stack gap={2}>
              <Text size="xs" c="dimmed">Versão: 1.0.0</Text>
              <Text size="xs" c="dimmed">Build: {buildDate}</Text>
              <Text size="xs" c="dimmed">Suporte: suporte@vizorerp.com.br</Text>
            </Stack>
          </div>

          <Divider />

          {/* Sair */}
          <Button
            variant="light"
            color="red"
            leftSection={<IconLogout size={16} />}
            onClick={() => setLogoutConfirm(true)}
            fullWidth
          >
            Sair
          </Button>
        </Stack>
      </Drawer>

      {/* Modal de Confirmação de Logout */}
      <Modal
        opened={logoutConfirm}
        onClose={() => setLogoutConfirm(false)}
        title="Confirmar Saída"
        centered
        size="xs"
      >
        <Text size="sm" mb="md">Tem certeza que deseja sair do sistema?</Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setLogoutConfirm(false)}>Cancelar</Button>
          <Button color="red" onClick={handleLogout}>Confirmar</Button>
        </Group>
      </Modal>

      {/* Modal de Atalhos de Teclado */}
      <Modal
        opened={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
        title="Atalhos de Teclado"
        centered
        size="md"
      >
        <Stack gap="sm">
          <Text size="sm" fw={500}>Navegação</Text>
          <Group justify="space-between">
            <Text size="sm">Busca global</Text>
            <Badge variant="light" size="sm">Ctrl + K</Badge>
          </Group>
          <Group justify="space-between">
            <Text size="sm">Ir para módulos</Text>
            <Badge variant="light" size="sm">Ctrl + M</Badge>
          </Group>
          <Divider my="xs" />
          <Text size="sm" fw={500}>Ações</Text>
          <Group justify="space-between">
            <Text size="sm">Salvar</Text>
            <Badge variant="light" size="sm">Ctrl + S</Badge>
          </Group>
          <Group justify="space-between">
            <Text size="sm">Novo registro</Text>
            <Badge variant="light" size="sm">Ctrl + N</Badge>
          </Group>
          <Group justify="space-between">
            <Text size="sm">Fechar modal</Text>
            <Badge variant="light" size="sm">Esc</Badge>
          </Group>
        </Stack>
      </Modal>
    </>
  )
}
