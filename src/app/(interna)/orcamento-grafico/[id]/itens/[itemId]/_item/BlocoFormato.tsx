'use client'

/**
 * BlocoFormato — campos de formato do Item, dirigidos pelo cadastro do Produto Gráfico.
 *
 * Renderiza exatamente `layout.formato.campos`:
 *  - 3 dimensões: Comprimento, Largura, Altura, Aba Cola, Aba Fechamento (+ Alt Tampa se o produto tem);
 *  - 2 dimensões: Formato Final (Largura x Altura);
 *  - aberto/fechado: Formato Fechado e Formato Aberto (Largura x Altura);
 *  - sanfona e abas: Comprimento, Largura, Nº de sanfonas, Aba;
 *  - página: Formato Fechado e Nº de páginas.
 * Cada campo valida na hora (dimensões: > 0 e até 99.999,99 mm, 2 casas) e mostra o erro no
 * próprio campo. Modo de formato ausente ou desconhecido: nenhum campo, aviso de cadastro
 * incompleto (a gravação deve ser bloqueada por quem usa `validarFormato`).
 *
 * Componente CONTROLADO (`value`/`onChange`), sem gravação e sem chamada de rede.
 */

import { useEffect, useMemo, type ReactNode } from 'react'
import CampoDimensoes from './CampoDimensoes'
import { Alert, Anchor, Button, Group, Input, Paper, SimpleGrid, Skeleton, Stack, Text, TextInput, ThemeIcon, Title } from '@mantine/core'
import { IconAlertTriangle, IconRuler2, IconWand } from '@tabler/icons-react'

import type { CampoFormato, LayoutItem } from '../../../_layout/resolver-layout-item'
import {
  CHAVES_COMPOSTAS,
  ROTULOS_FORMATO,
  aplicarFormatoPadrao,
  chaveErro,
  ehComposto,
  numeroParaTexto,
  validarFormato,
  type ChaveComposta,
  type ChaveEscalar,
  type ValorFormato,
} from './formato-item'

export interface BlocoFormatoProps {
  /** Layout do produto; `null` enquanto carrega, sem produto ou em erro. */
  layout: LayoutItem | null
  value: ValorFormato
  onChange: (parcial: Partial<ValorFormato>) => void
  /** Exige os campos obrigatórios (ligue após uma tentativa de salvar). */
  validarVazios?: boolean
  disabled?: boolean
  /** O layout ainda está sendo carregado. */
  carregando?: boolean
  /** Falha ao carregar o cadastro do produto. */
  erroLayout?: string | null
  onTentarNovamente?: () => void
  /**
   * Preenche o formato padrão do produto assim que o layout muda e o formato está vazio
   * (nunca sobrescreve valor digitado). Padrão: desligado; o botão "Usar formato padrão" cobre o
   * caso manual.
   */
  aplicarPadraoAutomatico?: boolean
  /**
   * Dentro do cartão "Dados Gerais & Dimensões": caixa compacta, e Comprimento x Largura x Altura
   * num campo só ("220 x 150 x 80").
   */
  embutido?: boolean
}

/** "220 x 150 x 80" → ['220','150','80']. Aceita x, X, × e *. Puro. */
export function separarTresDimensoes(texto: string): [string, string, string] {
  const partes = texto.split(/\s*[xX×*]\s*/)
  return [partes[0]?.trim() ?? '', partes[1]?.trim() ?? '', partes.slice(2).join('').trim()]
}

const MENSAGEM_CADASTRO_INCOMPLETO: Record<NonNullable<LayoutItem['motivoIncompleto']>, string> = {
  MODO_FORMATO_AUSENTE: 'O produto selecionado não tem o modo de formato definido.',
  MODO_FORMATO_DESCONHECIDO: 'O produto selecionado tem um modo de formato que o sistema não reconhece.',
}

function ordemCanonica(campos: readonly CampoFormato[]): CampoFormato[] {
  return [...campos]
}

export default function BlocoFormato({
  layout,
  value,
  onChange,
  validarVazios,
  disabled,
  carregando,
  erroLayout,
  onTentarNovamente,
  aplicarPadraoAutomatico = false,
  embutido = false,
}: BlocoFormatoProps) {
  const validacao = useMemo(
    () => (layout ? validarFormato(value, layout, { validarVazios }) : null),
    [layout, value, validarVazios],
  )

  // Formato padrão: só no campo composto vazio (nunca sobrescreve o que foi digitado).
  const comPadrao = useMemo(() => (layout ? aplicarFormatoPadrao(value, layout) : value), [layout, value])
  const alvoPadrao: ChaveComposta | null = useMemo(
    () => CHAVES_COMPOSTAS.find((k) => comPadrao[k] !== value[k]) ?? null,
    [comPadrao, value],
  )

  useEffect(() => {
    if (!aplicarPadraoAutomatico || !layout) return
    const novo = aplicarFormatoPadrao(value, layout)
    const alvo = CHAVES_COMPOSTAS.find((k) => novo[k] !== value[k])
    if (alvo) onChange({ [alvo]: novo[alvo] } as Partial<ValorFormato>)
    // Só reage à troca de layout (produto): não reaplica a cada digitação.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, aplicarPadraoAutomatico])

  const cabecalho = embutido ? null : (
    <Group gap="sm" wrap="nowrap">
      <ThemeIcon variant="light" color="teal" size={32} radius="md">
        <IconRuler2 size={18} stroke={1.5} />
      </ThemeIcon>
      <Title order={5}>Formato</Title>
    </Group>
  )

  const parcial = (campo: keyof ValorFormato, valor: unknown) => onChange({ [campo]: valor } as Partial<ValorFormato>)

  const envolver = (conteudo: ReactNode) =>
    embutido ? (
      <Paper withBorder radius="md" p="sm" bg="var(--mantine-color-default-hover)" data-testid="bloco-formato">
        <Stack gap="xs">
          {cabecalho}
          {conteudo}
        </Stack>
      </Paper>
    ) : (
      <Paper withBorder radius="md" p="lg" shadow="xs" data-testid="bloco-formato">
        <Stack gap="md">
          {cabecalho}
          {conteudo}
        </Stack>
      </Paper>
    )

  if (carregando) {
    return envolver(
      <Stack gap="xs" data-testid="bloco-formato-carregando">
        <Skeleton height={36} radius="sm" />
        <Skeleton height={36} radius="sm" />
      </Stack>,
    )
  }

  if (erroLayout) {
    return envolver(
      <Alert color="red" variant="light" icon={<IconAlertTriangle size={18} />} title="Não foi possível carregar o formato">
        <Group gap="xs">
          <Text size="sm">{erroLayout}</Text>
          {onTentarNovamente && (
            <Anchor size="sm" component="button" type="button" onClick={onTentarNovamente}>
              Tentar novamente
            </Anchor>
          )}
        </Group>
      </Alert>,
    )
  }

  if (!layout) {
    return envolver(
      <Text size="sm" c="dimmed">
        Escolha o produto para informar o formato.
      </Text>,
    )
  }

  if (!layout.cadastroCompleto) {
    const motivo = layout.motivoIncompleto ? MENSAGEM_CADASTRO_INCOMPLETO[layout.motivoIncompleto] : ''
    return envolver(
      <Alert
        color="yellow"
        variant="light"
        icon={<IconAlertTriangle size={18} />}
        title="Cadastro do produto incompleto"
        data-testid="bloco-formato-incompleto"
      >
        {motivo} Complete o cadastro do produto para informar o formato. Enquanto isso, o item não pode ser gravado.
      </Alert>,
    )
  }

  const campos = ordemCanonica(layout.formato.campos)
  const escalares = campos.filter((c): c is ChaveEscalar => !ehComposto(c))
  const compostos = campos.filter((c): c is ChaveComposta => ehComposto(c))
  const erros = validacao?.erros ?? {}
  const TRES: ChaveEscalar[] = ['comprimento', 'largura', 'altura']
  const tresJuntos = embutido && TRES.every((c) => escalares.includes(c))
  const escalaresVisiveis = tresJuntos ? escalares.filter((c) => !TRES.includes(c)) : escalares

  return envolver(
    <>
      {campos.length === 0 && (
        <Text size="sm" c="dimmed">
          Este produto não tem campos de formato.
        </Text>
      )}

      {escalares.length > 0 && (
        <SimpleGrid cols={embutido ? { base: 1, xs: 2, sm: 4 } : { base: 1, xs: 2, md: 3, lg: 5 }} spacing={embutido ? 'xs' : 'md'}>
          {tresJuntos && (
            <CampoDimensoes
              label="Comp x Larg x Alt"
              ajuda="Dimensões internas em milímetros (ex.: 220 x 150 x 80)"
              placeholder="220 x 150 x 80"
              valores={[value.comprimento, value.largura, value.altura]}
              onChange={([comprimento, largura, altura]) => onChange({ comprimento, largura, altura })}
              data-testid="formato-comp-larg-alt"
              error={
                [
                  erros[chaveErro('comprimento')] && `Comp.: ${erros[chaveErro('comprimento')]}`,
                  erros[chaveErro('largura')] && `Larg.: ${erros[chaveErro('largura')]}`,
                  erros[chaveErro('altura')] && `Alt.: ${erros[chaveErro('altura')]}`,
                ]
                  .filter(Boolean)
                  .join(' ') || undefined
              }
              disabled={disabled}
            />
          )}
          {escalaresVisiveis.map((campo) => (
            <TextInput
              key={campo}
              label={embutido ? ROTULOS_FORMATO[campo].replace(' (mm)', '').replace('Aba Fechamento', 'Aba Fec') : ROTULOS_FORMATO[campo]}
              aria-label={ROTULOS_FORMATO[campo]}
              inputMode="decimal"
              rightSection={embutido && !['numeroSanfonas', 'numeroPaginas'].includes(campo) ? <Text size="xs" c="dimmed">mm</Text> : undefined}
              value={value[campo]}
              onChange={(e) => parcial(campo, e.currentTarget.value)}
              error={erros[chaveErro(campo)]}
              disabled={disabled}
              data-testid={`formato-${campo}`}
            />
          ))}
        </SimpleGrid>
      )}

      {compostos.length > 0 && (
        <SimpleGrid cols={{ base: 1, md: compostos.length > 1 ? 2 : 1 }} spacing="md">
          {compostos.map((campo) => {
            const eL = erros[chaveErro(campo, 'largura')]
            const eA = erros[chaveErro(campo, 'altura')]
            const mensagem = [eL && `Largura: ${eL}`, eA && `Altura: ${eA}`].filter(Boolean).join(' ')
            return (
              <Input.Wrapper
                key={campo}
                label={`${ROTULOS_FORMATO[campo]} (Largura x Altura, mm)`}
                error={mensagem || undefined}
                data-testid={`formato-${campo}`}
              >
                <Group gap="xs" wrap="nowrap" mt={4}>
                  <TextInput
                    aria-label={`${ROTULOS_FORMATO[campo]} — Largura`}
                    placeholder="Largura"
                    inputMode="decimal"
                    value={value[campo].largura}
                    onChange={(e) => parcial(campo, { ...value[campo], largura: e.currentTarget.value })}
                    error={!!eL}
                    disabled={disabled}
                    style={{ flex: 1 }}
                  />
                  <Text c="dimmed" aria-hidden>
                    ×
                  </Text>
                  <TextInput
                    aria-label={`${ROTULOS_FORMATO[campo]} — Altura`}
                    placeholder="Altura"
                    inputMode="decimal"
                    value={value[campo].altura}
                    onChange={(e) => parcial(campo, { ...value[campo], altura: e.currentTarget.value })}
                    error={!!eA}
                    disabled={disabled}
                    style={{ flex: 1 }}
                  />
                </Group>
              </Input.Wrapper>
            )
          })}
        </SimpleGrid>
      )}

      {alvoPadrao && layout.formato.padrao && (
        <Group>
          <Button
            variant="light"
            size="xs"
            leftSection={<IconWand size={14} />}
            disabled={disabled}
            onClick={() => parcial(alvoPadrao, comPadrao[alvoPadrao])}
          >
            {`Usar formato padrão (${numeroParaTexto(layout.formato.padrao.largura)} x ${numeroParaTexto(layout.formato.padrao.altura)})`}
          </Button>
        </Group>
      )}
    </>,
  )
}
