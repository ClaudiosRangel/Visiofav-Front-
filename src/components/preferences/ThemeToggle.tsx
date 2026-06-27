'use client'

import { SegmentedControl, Group, Text } from '@mantine/core'
import { IconSun, IconMoon, IconDeviceDesktop } from '@tabler/icons-react'
import { useTheme } from '@/providers/ThemeProvider'
import { usePreferences } from '@/providers/PreferencesProvider'

export default function ThemeToggle() {
  const { mode } = useTheme()
  const { updatePreference } = usePreferences()

  return (
    <SegmentedControl
      size="xs"
      value={mode}
      onChange={(val) => updatePreference('tema', val as 'light' | 'dark' | 'auto')}
      data={[
        {
          label: (
            <Group gap={4} justify="center" wrap="nowrap">
              <IconSun size={14} />
            </Group>
          ),
          value: 'light',
        },
        {
          label: (
            <Group gap={4} justify="center" wrap="nowrap">
              <IconMoon size={14} />
            </Group>
          ),
          value: 'dark',
        },
        {
          label: (
            <Group gap={4} justify="center" wrap="nowrap">
              <IconDeviceDesktop size={14} />
            </Group>
          ),
          value: 'auto',
        },
      ]}
      aria-label="Alternar tema"
    />
  )
}
