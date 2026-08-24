import { createTheme } from '@mantine/core'

export const portalRepTheme = createTheme({
  primaryColor: 'green',
  defaultRadius: 'md',
  white: '#ffffff',
  colors: {
    green: [
      '#e6f9ed',
      '#c1f0d4',
      '#8ee4ad',
      '#5ad887',
      '#33cc6a',
      '#1ab854',
      '#14a348',
      '#0f8e3c',
      '#0a7930',
      '#066424',
    ],
  },
  components: {
    Card: { defaultProps: { shadow: 'xs', withBorder: true } },
    Button: { defaultProps: { radius: 'md' } },
  },
})
