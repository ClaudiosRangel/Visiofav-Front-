'use client'

import { useSyncExternalStore } from 'react'

/**
 * Guarda de navegação global — permite que uma página com trabalho em
 * andamento (ex.: uma conferência de entrada iniciada, ainda não aprovada
 * nem rejeitada) sinalize que uma navegação para fora dela precisa de
 * confirmação explícita do usuário.
 *
 * Motivação: sem isso, o operador podia clicar em qualquer item do menu
 * lateral no meio de uma conferência (após a 1ª conferência, aguardando
 * segunda conferência ou decisão de aprovar/rejeitar) e abandonar a tela
 * sem nenhum aviso — o estado em memória (itens conferidos, divergências
 * levantadas) se perdia silenciosamente.
 *
 * Implementado como store externo (padrão useSyncExternalStore, mesmo usado
 * em `moduleSidebarStore.ts`) para ser lido de forma síncrona e imperativa
 * pelo `ModuleSidebar`/`Header` no momento do clique de navegação, sem
 * precisar que esses componentes conheçam a página específica que ativou
 * a guarda.
 */

interface EstadoGuarda {
  ativo: boolean
  mensagem: string
}

const MENSAGEM_PADRAO = 'Há uma operação em andamento nesta tela. Deseja realmente sair sem concluir?'

let estado: EstadoGuarda = { ativo: false, mensagem: MENSAGEM_PADRAO }
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((l) => l())
}

function subscribe(callback: () => void) {
  listeners.add(callback)
  return () => listeners.delete(callback)
}

function getSnapshot() {
  return estado
}

function getServerSnapshot() {
  return estado
}

/**
 * Ativa a guarda de navegação com uma mensagem de confirmação específica da
 * tela atual. Deve ser chamado por um `useEffect` que reage ao estado de
 * "operação em andamento" da página (ex.: `etapa !== 'lista'` na Conferência
 * de Entrada), e desativado (via `desativarGuardaNavegacao()`) quando essa
 * condição deixa de ser verdadeira.
 */
export function ativarGuardaNavegacao(mensagem: string = MENSAGEM_PADRAO) {
  estado = { ativo: true, mensagem }
  emit()
}

export function desativarGuardaNavegacao() {
  if (!estado.ativo) return
  estado = { ativo: false, mensagem: MENSAGEM_PADRAO }
  emit()
}

/**
 * Chamado no momento do clique em qualquer link de navegação (menu lateral,
 * botão "Módulos", etc.). Se a guarda estiver ativa, pede confirmação via
 * `window.confirm` (mesmo padrão já usado no restante do app — ver
 * "Rejeitar / Recontar" na Conferência de Entrada) antes de permitir a
 * navegação. Retorna `true` se a navegação deve prosseguir.
 */
export function confirmarNavegacaoOuBloquear(): boolean {
  if (!estado.ativo) return true
  const prosseguir = window.confirm(estado.mensagem)
  if (prosseguir) {
    // Navegação confirmada — a página de destino vai desmontar a tela atual,
    // então a guarda não deve continuar ativa para a próxima navegação.
    desativarGuardaNavegacao()
  }
  return prosseguir
}

export function useGuardaNavegacaoAtiva(): boolean {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  return snap.ativo
}
