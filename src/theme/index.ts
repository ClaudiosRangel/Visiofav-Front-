import { createTheme, MantineColorsTuple } from '@mantine/core'

// Paleta teal/ciano inspirada na imagem do TOTVS WMS
const primary: MantineColorsTuple = [
  '#e6fcf5',
  '#c3fae8',
  '#96f2d7',
  '#63e6be',
  '#38d9a9',
  '#20c997',
  '#12b886',
  '#0ca678',
  '#099268',
  '#087f5b',
]

const secondary: MantineColorsTuple = [
  '#f1f3f5',
  '#e9ecef',
  '#dee2e6',
  '#ced4da',
  '#adb5bd',
  '#868e96',
  '#495057',
  '#343a40',
  '#212529',
  '#0b0d0f',
]

export const theme = createTheme({
  primaryColor: 'primary',
  primaryShade: 7,
  colors: {
    primary,
    secondary,
  },
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
  headings: {
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
  },
  defaultRadius: 'md',
  components: {
    Button: {
      defaultProps: {
        size: 'sm',
      },
    },
    TextInput: {
      defaultProps: {
        size: 'sm',
      },
    },
    Select: {
      defaultProps: {
        size: 'sm',
      },
    },
    Badge: {
      defaultProps: {
        variant: 'light',
        size: 'md',
      },
    },
    Card: {
      defaultProps: {
        shadow: 'sm',
        padding: 'lg',
        radius: 'md',
      },
    },
    Modal: {
      defaultProps: {
        centered: true,
        closeOnClickOutside: false,
      },
    },
  },
})
