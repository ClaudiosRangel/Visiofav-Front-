/**
 * Memória da sessão de edição do item (só no cliente, em memória do módulo):
 *  - a pilha de Desfazer do Grid de Planos, por item;
 *  - se o usuário já confirmou o aviso de custo de cálculo anterior, por item.
 *
 * Fica fora do componente para sobreviver à ida e volta entre a Tela_Item e a Tela_Plano (a
 * navegação do Next desmonta a tela do item). Recarregar a página zera a memória, que é o fim da
 * sessão de edição. Nada vai para o armazenamento do navegador.
 */

import { PILHA_VAZIA, reducerPilha, type AcaoPilha, type PilhaDesfazer } from './pilha-desfazer'

type Ouvinte = () => void

const pilhas = new Map<string, PilhaDesfazer>()
const avisosConfirmados = new Set<string>()
const ouvintes = new Map<string, Set<Ouvinte>>()

export function lerPilha(itemId: string): PilhaDesfazer {
  return pilhas.get(itemId) ?? PILHA_VAZIA
}

export function despacharPilha(itemId: string, acao: AcaoPilha): PilhaDesfazer {
  const nova = reducerPilha(lerPilha(itemId), acao)
  pilhas.set(itemId, nova)
  ouvintes.get(itemId)?.forEach((f) => f())
  return nova
}

export function ouvirPilha(itemId: string, f: Ouvinte): () => void {
  const lista = ouvintes.get(itemId) ?? new Set<Ouvinte>()
  lista.add(f)
  ouvintes.set(itemId, lista)
  return () => {
    lista.delete(f)
  }
}

export function avisoAncoragemConfirmado(itemId: string): boolean {
  return avisosConfirmados.has(itemId)
}

export function confirmarAvisoAncoragem(itemId: string): void {
  avisosConfirmados.add(itemId)
}

/** Só para testes. */
export function limparMemoriaPlanos(): void {
  pilhas.clear()
  avisosConfirmados.clear()
  ouvintes.clear()
}
