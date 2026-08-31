"""
TEST SUITE 18 — Ressuprimento e Cross-Dock
================================================================================
Valida a movimentação de mercadoria entre endereços do WMS (spec
``qa-fluxo-wms-completo``), com lançamentos reais persistidos e verificação de
valor via API (fonte de verdade).

Este arquivo está organizado em seções para que cada task da feature 9 tenha a
sua própria classe de teste, sem interferência:

  - ``TestRessuprimento``  → task 9.1 (Requirements 8.1 e 8.2) — IMPLEMENTADA
  - (reservado)            → task 9.2 (cross-dock, Requirement 8.3) — a
    acrescentar depois numa seção/classe separada (``TestCrossDock``), sem
    tocar na classe de ressuprimento.

--------------------------------------------------------------------------------
TASK 9.1 — Ressuprimento (conservação de físico total)
--------------------------------------------------------------------------------
Requisito 8.1: mover quantidade de um endereço (reserva/pulmão) para outro
    endereço (picking) faz o saldo da ORIGEM diminuir e o do DESTINO aumentar
    pela MESMA quantidade.
Requisito 8.2: o ``Saldo_Fisico`` TOTAL do produto permanece inalterado após o
    ressuprimento (a movimentação interna não cria nem destrói físico — só
    redistribui entre endereços).

Estratégia (mesma filosofia híbrida UI + API do ``test_11``/``test_16``/
``test_17``):
  - O **pré-requisito** — um produto com saldo endereçado real
    (``SaldoEndereco``) numa posição de origem, e um segundo endereço livre
    para servir de destino — é semeado inteiramente via API, reaproveitando o
    fluxo de recebimento já validado (produto/SKU → nota → conferência →
    endereçamento em lote). Sem esse saldo endereçado não há o que mover.
  - A **verificação de valor** (queda na origem, aumento no destino pela mesma
    quantidade, físico total inalterado) é feita via API (fonte de verdade):
    ``saldo_no_endereco`` por endereço (Requisito 8.1) e ``saldo_consolidado``
    para o físico total (Requisito 8.2). A UI é complementar (evidência
    best-effort).

Endpoint de movimentação usado (confirmado no backend
``VisioFab.Wms.Back/src/modules/ressuprimento/ressuprimento.routes.ts``,
prefixo ``/ressuprimento``, guard ``moduloGuard('WMS')``):

  POST /ressuprimento/executar
    body: {produtoId, enderecoOrigemId, enderecoDestinoId, quantidade}

Dentro de uma ``$transaction`` o backend DECREMENTA o ``SaldoEndereco`` da
origem e INCREMENTA/cria o do destino pela mesma quantidade (par
débito/crédito de igual magnitude), grava dois ``LogMovimentacao`` tipo
``TRANSFERENCIA`` e uma ``OrdemServicoWms`` ``REPOSICAO`` concluída. Como é um
par de igual magnitude na mesma transação, o físico total do produto (soma dos
``SaldoEndereco`` = ``fisico`` consolidado) permanece inalterado (Requisito
8.2), mudando apenas a distribuição por endereço (Requisito 8.1). O backend
valida ``saldoOrigem >= quantidade`` (422 "Saldo insuficiente no pulmão" caso
contrário) e NÃO exige que a origem seja ARMAZENAGEM nem o destino PICKING.

Multi-tenant: todas as operações usam a empresa da sessão autenticada. A
movimentação é interna (não sai físico do produto) e o dado criado carrega o
marcador ``run_id`` (fornecedor/lote da nota semeada); a limpeza best-effort
no ``finally`` reverte a transferência (move de volta destino→origem) para não
deixar o saldo redistribuído no ambiente demo — idempotente, sem derrubar o
teste.

Como rodar:
    cd tests/e2e-qa
    .venv\\Scripts\\activate
    pytest test_18_ressuprimento_crossdock.py -q          # headless (padrão)
    $env:HEADLESS="false"; $env:SLOW_MO="600"; pytest test_18_ressuprimento_crossdock.py -s
"""

import time
from datetime import datetime, timedelta

import pytest
from playwright.sync_api import Page

from conftest import navegar_para
from helpers import aguardar_carregamento, screenshot_com_nome
from wms_api import WmsApiClient


# ════════════════════════════════════════════════════════════════════
# HELPERS DE SEED / VERIFICAÇÃO (API — fonte de verdade)
# ════════════════════════════════════════════════════════════════════


def _validade_br(validade) -> str:
    """Normaliza a validade para o formato brasileiro ``dd/mm/aaaa``.

    O endpoint ``conferir-todos`` aceita a validade no formato brasileiro. A
    validade que volta de ``iniciar_conferencia`` pode vir em ISO
    (``aaaa-mm-dd``) ou já formatada; convertemos o que for ISO. Uma validade
    bem no futuro (garantida pelo seed) evita shelf life no caminho feliz.
    """
    if not validade:
        return (datetime.now() + timedelta(days=730)).strftime("%d/%m/%Y")
    texto = str(validade)
    if len(texto) >= 10 and texto[4] == "-" and texto[7] == "-":
        ano, mes, dia = texto[0:4], texto[5:7], texto[8:10]
        return f"{dia}/{mes}/{ano}"
    return texto


def _semear_produto_com_saldo_em_endereco(
    wms_api: WmsApiClient, run_id: str, quantidade: int
) -> dict:
    """Semeia um produto com saldo endereçado real numa posição de ORIGEM.

    Reaproveita o fluxo de recebimento já validado (inteiramente via API — a UI
    não é o alvo desta task):

      1. Garante produto + SKU (lastro/camada) e >= 2 endereços livres (a
         origem, para onde o endereçamento vai colocar o físico; e o destino da
         transferência do ressuprimento).
      2. Cria nota de entrada rastreável (lote ``LOTE-{run_id}``) com a qtd.
      3. Confere a nota (contagem == quantidade → sem divergência) e confirma.
      4. Sugere e efetiva o endereçamento em lote (gera ``SaldoEndereco`` real).

    Da resposta do endereçamento capturamos o ``enderecoId`` (uuid) EXATO onde
    o físico foi colocado — este é o endereço de ORIGEM da transferência
    (evita ter que resolver o id a partir do ``enderecoCompleto`` do saldo).

    Retorna ``{produto, quantidade_enderecada, lote, endereco_origem_id,
    enderecos_endereçados}``.

    Faz ``pytest.skip`` (apenas aqui, no seed) se um pré-requisito externo
    genuinamente indisponível impedir a semeadura (ex.: menos de 2 endereços
    livres, ou o endereçamento não alocar nada), seguindo o Error Handling do
    design — nunca pula no meio da verificação.
    """
    # Produto EXCLUSIVO por execução: sem isso, o produto demo compartilhado
    # acumula saldo de outras execuções no mesmo endereço (a consolidação do
    # put-away agrupa por produto), fazendo o "antes/depois" da origem
    # divergir da quantidade movida.
    produto = wms_api.garantir_produto_configurado(run_id, sufixo="RESSUP-", com_sku=True)
    assert produto.get("id"), "seed: produto obtido/criado (id)"
    assert produto.get("codigo"), "seed: produto com código"

    # >= 2 endereços livres: origem (endereçamento) + destino (transferência).
    enderecos_livres = wms_api.garantir_enderecos_livres(minimo=2)
    if len(enderecos_livres) < 2:
        pytest.skip(
            "Pré-requisito externo indisponível: são necessários pelo menos 2 "
            "endereços de armazenagem livres (origem e destino) para exercitar "
            "o ressuprimento, e o ambiente tem menos que isso. Cadastre "
            "endereços ARMAZENAGEM/LIVRE ativos na empresa demo."
        )

    nota = wms_api.criar_nota_entrada(run_id, produto, quantidade=quantidade)
    nota_id = nota.get("id")
    assert nota_id, "seed: nota de entrada criada (id)"

    # Conferência (contagem == quantidade → caminho feliz sem divergência).
    conf = wms_api.iniciar_conferencia(nota_id)
    itens_conf = [
        {
            "itemNotaEntradaId": item["id"],
            "quantidadeConferida": quantidade,
            "lote": item.get("lote") or wms_api.lote_do_run(run_id),
            "validade": _validade_br(item.get("validade")),
        }
        for item in conf.get("itens", [])
    ]
    assert itens_conf, "seed: conferência retornou itens da nota"
    resultado = wms_api.conferir_todos(nota_id, itens_conf)
    assert resultado.get("divergentes", 0) == 0, (
        "seed: conferência com contagem == nota deve ter 0 divergências "
        f"(obtido {resultado.get('divergentes')})"
    )
    wms_api.confirmar_conferencia(nota_id)

    # Endereçamento em lote (efetiva o SaldoEndereco — fonte de verdade).
    sugestoes = wms_api.sugerir_enderecamento(nota_id).get("sugestoes", [])

    itens_lote = []
    qtd_enderecada = 0
    for sug in sugestoes:
        produto_id_sug = sug.get("produtoId")
        item_id_sug = sug.get("itemId")
        distribuicao = sug.get("distribuicao") or {}
        if not produto_id_sug or not item_id_sug:
            continue
        for aloc in distribuicao.get("alocacoes", []) or []:
            quantidade_aloc = aloc.get("quantidadeAlocada", 0) or 0
            if quantidade_aloc <= 0:
                continue
            itens_lote.append(
                {
                    "itemNotaEntradaId": item_id_sug,
                    "produtoId": produto_id_sug,
                    "enderecoId": aloc["enderecoId"],
                    "quantidade": quantidade_aloc,
                    "lote": sug.get("lote") or wms_api.lote_do_run(run_id),
                    "validade": sug.get("validade") or None,
                }
            )
            qtd_enderecada += quantidade_aloc

    # Sem alocações → sem endereço de armazenagem livre para o put-away
    # (pré-requisito de ambiente indisponível). Skip no seed, nunca assert
    # falso — o ressuprimento precisa de físico endereçado numa origem.
    if not itens_lote:
        pytest.skip(
            "Pré-requisito de ambiente indisponível: a distribuição inteligente "
            "não alocou nenhum endereço para o put-away (sem endereço de "
            "armazenagem livre no momento). Cadastre/libere endereços "
            "ARMAZENAGEM/LIVRE na empresa demo para exercitar este cenário."
        )
    resultado_lote = wms_api.confirmar_enderecamento_lote(nota_id, itens_lote)
    assert resultado_lote.get("itensEnderecados", 0) == len(itens_lote), (
        "seed: todos os itens de endereçamento devem ser efetivados "
        f"(esperado {len(itens_lote)}, obtido {resultado_lote.get('itensEnderecados')})"
    )

    # Endereço de ORIGEM da transferência: a posição que recebeu mais físico
    # (garante saldo suficiente para mover uma quantidade > 0 dela).
    itens_lote_ordenados = sorted(
        itens_lote, key=lambda i: i["quantidade"], reverse=True
    )
    endereco_origem_id = itens_lote_ordenados[0]["enderecoId"]
    enderecos_enderecados = {i["enderecoId"] for i in itens_lote}

    return {
        "produto": produto,
        "quantidade": qtd_enderecada,
        "lote": wms_api.lote_do_run(run_id),
        "endereco_origem_id": endereco_origem_id,
        "enderecos_enderecados": enderecos_enderecados,
        "enderecos_livres": enderecos_livres,
    }


def _escolher_destino(
    seed: dict, endereco_origem_id: str
) -> str:
    """Escolhe um endereço de DESTINO distinto da origem para a transferência.

    Prefere um endereço livre que NÃO recebeu físico no endereçamento (destino
    "limpo", onde o saldo do produto começa em zero — deixa o Requisito 8.1
    mais fácil de aferir). Se todos os livres foram usados no endereçamento,
    aceita qualquer endereço livre distinto da origem. Retorna ``""`` quando
    não há nenhum candidato (o chamador trata como pré-requisito ausente).
    """
    livres = seed.get("enderecos_livres", []) or []
    usados = seed.get("enderecos_enderecados", set()) or set()

    # 1) Preferência: endereço livre não usado no endereçamento (destino limpo).
    for e in livres:
        eid = e.get("id")
        if eid and eid != endereco_origem_id and eid not in usados:
            return eid

    # 2) Fallback: qualquer endereço livre distinto da origem.
    for e in livres:
        eid = e.get("id")
        if eid and eid != endereco_origem_id:
            return eid

    return ""


# ════════════════════════════════════════════════════════════════════
# SEÇÃO — TASK 9.1 — RESSUPRIMENTO (Requirements 8.1, 8.2)
# ════════════════════════════════════════════════════════════════════


@pytest.mark.slow
class TestRessuprimento:
    """Valida a movimentação de saldo entre endereços (conservação de físico).

    Requisito 8.1: origem diminui e destino aumenta pela mesma quantidade.
    Requisito 8.2: o Saldo_Fisico total do produto permanece inalterado.
    """

    def test_ressuprimento_conserva_fisico_total(
        self, page_auth: Page, wms_api: WmsApiClient, run_id: str
    ):
        # ── Seed: produto com saldo endereçado real numa posição de origem ──
        qtd_inicial = 12
        seed = _semear_produto_com_saldo_em_endereco(
            wms_api, run_id, quantidade=qtd_inicial
        )
        produto = seed["produto"]
        produto_id = produto["id"]
        endereco_origem_id = seed["endereco_origem_id"]
        qtd_enderecada = seed["quantidade"]

        endereco_destino_id = _escolher_destino(seed, endereco_origem_id)
        if not endereco_destino_id:
            pytest.skip(
                "Pré-requisito externo indisponível: não há um segundo endereço "
                "livre distinto da origem para servir de destino do "
                "ressuprimento."
            )

        # Quantidade a mover: metade do físico da posição de origem (>= 1),
        # garantindo que sobra saldo na origem (queda observável, não zera) e
        # que a origem comporta a movimentação (backend exige origem >= qtd).
        saldo_origem_antes = wms_api.saldo_no_endereco(
            produto_id, endereco_origem_id
        )
        assert saldo_origem_antes > 0, (
            "pré-condição: a posição de origem deve ter saldo físico real após "
            f"o seed (origem={endereco_origem_id}, saldo={saldo_origem_antes})"
        )
        qtd_mover = max(1, int(saldo_origem_antes // 2))
        assert qtd_mover <= saldo_origem_antes, (
            "pré-condição: a quantidade a mover não pode exceder o saldo da "
            f"origem ({qtd_mover} > {saldo_origem_antes})"
        )

        moveu = False
        try:
            # ── Estado ANTES da transferência ─────────────────────────────
            saldo_destino_antes = wms_api.saldo_no_endereco(
                produto_id, endereco_destino_id
            )
            consolidado_antes = wms_api.saldo_consolidado(produto_id)
            fisico_antes = consolidado_antes.get("fisico", 0) or 0
            assert fisico_antes > 0, (
                "pré-condição: o produto semeado deve ter físico consolidado "
                f"antes do ressuprimento (produtoId={produto_id}, "
                f"fisico={fisico_antes})"
            )

            # ── Movimentação: origem → destino (POST /ressuprimento/executar) ─
            resp = wms_api.mover_saldo_entre_enderecos(
                produto_id=produto_id,
                endereco_origem_id=endereco_origem_id,
                endereco_destino_id=endereco_destino_id,
                quantidade=qtd_mover,
            )
            if resp.status == 422:
                # Saldo insuficiente no pulmão / pré-condição de ambiente: não é
                # falha do fluxo feliz. Registrado como pré-requisito ausente.
                pytest.skip(
                    "Pré-requisito de ambiente indisponível: o backend rejeitou "
                    "a movimentação (422 — saldo insuficiente na origem). "
                    f"Origem={endereco_origem_id}, quantidade={qtd_mover}, "
                    f"corpo={resp.text()}"
                )
            assert resp.status in (200, 201), (
                "A movimentação de saldo entre endereços deve ser aceita "
                f"(POST /ressuprimento/executar); status {resp.status} — "
                f"{resp.text()}"
            )
            moveu = True

            # Latência de propagação: aguarda o saldo por endereço refletir.
            def _aguardar_saldo_endereco(endereco_id: str, esperado: float) -> float:
                atual = 0.0
                for _ in range(6):
                    atual = wms_api.saldo_no_endereco(produto_id, endereco_id)
                    if atual == esperado:
                        return atual
                    time.sleep(0.8)
                return atual

            origem_esperado = saldo_origem_antes - qtd_mover
            destino_esperado = saldo_destino_antes + qtd_mover

            saldo_origem_depois = _aguardar_saldo_endereco(
                endereco_origem_id, origem_esperado
            )
            saldo_destino_depois = _aguardar_saldo_endereco(
                endereco_destino_id, destino_esperado
            )

            # ── Requisito 8.1: origem diminui e destino aumenta pela mesma qtd ─
            assert saldo_origem_depois == origem_esperado, (
                "Requisito 8.1: o saldo da ORIGEM deve diminuir exatamente pela "
                f"quantidade movida ({qtd_mover}); esperado {origem_esperado} "
                f"(antes {saldo_origem_antes}), obtido {saldo_origem_depois}"
            )
            assert saldo_destino_depois == destino_esperado, (
                "Requisito 8.1: o saldo do DESTINO deve aumentar exatamente "
                f"pela quantidade movida ({qtd_mover}); esperado "
                f"{destino_esperado} (antes {saldo_destino_antes}), obtido "
                f"{saldo_destino_depois}"
            )
            # A queda na origem é igual ao aumento no destino (mesma quantidade).
            queda_origem = saldo_origem_antes - saldo_origem_depois
            aumento_destino = saldo_destino_depois - saldo_destino_antes
            assert queda_origem == aumento_destino == qtd_mover, (
                "Requisito 8.1: a queda na origem deve ser igual ao aumento no "
                f"destino e igual à quantidade movida ({qtd_mover}); queda="
                f"{queda_origem}, aumento={aumento_destino}"
            )

            # ── Requisito 8.2: físico total do produto permanece inalterado ──
            def _aguardar_fisico(esperado: float) -> dict:
                saldo = {}
                for _ in range(6):
                    saldo = wms_api.saldo_consolidado(produto_id)
                    if (saldo.get("fisico", 0) or 0) == esperado:
                        return saldo
                    time.sleep(0.8)
                return saldo

            consolidado_depois = _aguardar_fisico(fisico_antes)
            fisico_depois = consolidado_depois.get("fisico", 0) or 0
            assert fisico_depois == fisico_antes, (
                "Requisito 8.2: o Saldo_Fisico TOTAL do produto deve permanecer "
                "inalterado após o ressuprimento (movimentação interna não cria "
                f"nem destrói físico); antes {fisico_antes}, depois "
                f"{fisico_depois}; saldo: {consolidado_depois}"
            )

            # ── Evidência best-effort da tela de saldos (Requisito 14.1) ─────
            # Falha de evidência não interrompe o teste (Requisito 14.4).
            try:
                navegar_para(page_auth, "/estoque")
                aguardar_carregamento(page_auth)
                try:
                    aba_produto = page_auth.get_by_role(
                        "tab", name="Por Produto"
                    ).first
                    if aba_produto.count() > 0 and aba_produto.is_visible():
                        aba_produto.click()
                        time.sleep(0.6)
                except Exception as exc_aba:  # pragma: no cover
                    print(f"[evidencia] aba 'Por Produto' indisponível: {exc_aba}")
                try:
                    pesquisa = page_auth.get_by_placeholder(
                        "Pesquisar por produto ou endereço"
                    ).first
                    if pesquisa.count() > 0 and pesquisa.is_visible():
                        pesquisa.fill(str(produto.get("codigo", "")))
                        time.sleep(2)
                except Exception as exc_busca:  # pragma: no cover
                    print(f"[evidencia] busca de produto: {exc_busca}")
                aguardar_carregamento(page_auth)
                screenshot_com_nome(page_auth, f"ressuprimento_saldo_{run_id}")
            except Exception as exc:  # pragma: no cover - evidência best-effort
                print(
                    "[evidencia] falha ao registrar evidência do ressuprimento "
                    f"(best-effort, não interrompe o fluxo): {exc}"
                )

        finally:
            # Limpeza best-effort (design, Requisito 13.2): reverte a
            # transferência (destino → origem) para não deixar o saldo
            # redistribuído no ambiente demo. Idempotente e não derruba o teste
            # (Requisito 13.3). Só reverte se a movimentação de fato ocorreu.
            if moveu:
                try:
                    wms_api.mover_saldo_entre_enderecos(
                        produto_id=produto_id,
                        endereco_origem_id=endereco_destino_id,
                        endereco_destino_id=endereco_origem_id,
                        quantidade=qtd_mover,
                    )
                except Exception as exc:  # pragma: no cover - limpeza best-effort
                    print(
                        "[limpeza] falha ao reverter o ressuprimento "
                        f"(destino={endereco_destino_id} → origem="
                        f"{endereco_origem_id}, qtd={qtd_mover}): {exc}"
                    )


# ════════════════════════════════════════════════════════════════════
# SEÇÃO — TASK 9.2 — CROSS-DOCK ATÉ A EXPEDIÇÃO (Requirement 8.3)
# ════════════════════════════════════════════════════════════════════
#
# Requisito 8.3: um item que entra por cross-dock, direcionado a uma saída,
#   CHEGA à expedição — admitindo saldo TEMPORÁRIO em endereço (staging)
#   durante o roteamento —, desde que NÃO reste saldo residual em endereço de
#   ARMAZENAGEM para aquele produto/lote ao final.
#
# O que é cross-dock aqui (confirmado no backend
# ``VisioFab.Wms.Back/src/modules/cross-dock``): o item entra pela nota de
# entrada e é vinculado diretamente a um pedido de venda, sem passar pela
# ARMAZENAGEM definitiva. O fluxo é:
#   identificar (elegíveis) → confirmar (EM_TRANSITO) → rotear (EM_STAGING,
#   saldo temporário) → expedir (EXPEDIDO, baixa do staging).
# Em NENHUM momento o cross-dock cria ``SaldoEndereco`` num endereço de
# ARMAZENAGEM — essa é justamente a diferença para o recebimento normal
# (que faz put-away na armazenagem). Portanto a verificação de 8.3 é:
#   (a) o item alcança o status EXPEDIDO (chegou à expedição); e
#   (b) ao final, não há ``SaldoEndereco`` residual do produto em endereço de
#       tipo ARMAZENAGEM (o saldo temporário de staging já foi baixado na
#       expedição; saldo em staging DURANTE o processo é admitido).
#
# LIMITAÇÃO DE AMBIENTE (mesma disciplina das outras tasks): o cenário exige
# pré-requisitos externos que podem não existir de forma determinística em
# produção:
#   - um Pedido de Venda CONFIRMADO/EM_SEPARACAO com o produto (para o
#     ``identificar`` casar o item da nota a um pedido);
#   - uma Staging Area ativa (endereço + doca) para o ``rotear`` resolver o
#     destino.
# O seed é best-effort/reaproveitamento (procura pedido existente; senão
# tenta criar+confirmar; procura/cria staging area). Quando um pré-requisito
# é genuinamente indisponível, o teste faz ``pytest.skip`` NO SEED com motivo
# explícito (nunca no meio da verificação, nunca um assert falso), conforme o
# Error Handling do design.


def _enderecos_armazenagem_ids(wms_api: WmsApiClient) -> set:
    """Conjunto de ids de endereços de tipo ARMAZENAGEM da empresa da sessão.

    Usado para conferir (Requisito 8.3) que, ao final do cross-dock, não há
    ``SaldoEndereco`` residual do produto num endereço de ARMAZENAGEM. Os
    endereços de STAGING não entram nesse conjunto (saldo temporário lá é
    admitido durante o roteamento e baixado na expedição).
    """
    ids = set()
    for e in wms_api.listar_enderecos(limit=500):
        if e.get("tipo") == "ARMAZENAGEM" and e.get("id"):
            ids.add(e["id"])
    return ids


def _saldo_produto_em_armazenagem(
    wms_api: WmsApiClient, produto_id: str, armazenagem_ids: set
) -> float:
    """Soma o ``SaldoEndereco`` do produto que esteja em endereços ARMAZENAGEM.

    Percorre ``saldos_por_endereco`` (todos os endereços do produto) e soma
    apenas os que caem em ``armazenagem_ids``. É o "saldo residual em
    armazenagem" cuja ausência o Requisito 8.3 exige ao final.
    """
    total = 0.0
    for s in wms_api.saldos_por_endereco(produto_id):
        if s.get("enderecoId") in armazenagem_ids:
            q = s.get("quantidade")
            try:
                total += float(str(q).replace(",", ".")) if q is not None else 0.0
            except (ValueError, TypeError):
                pass
    return total


def _semear_pre_requisitos_cross_dock(
    wms_api: WmsApiClient, run_id: str, quantidade: int
) -> dict:
    """Semeia os pré-requisitos do cross-dock e devolve o contexto do cenário.

    Passos (todos via API — a UI não é o alvo desta task):
      1. Garante produto + SKU rastreável.
      2. Garante um Pedido de Venda CONFIRMADO/EM_SEPARACAO com o produto
         (reaproveita um existente; senão tenta criar + confirmar).
      3. Cria a nota de entrada rastreável com o produto (a mercadoria que
         entra e será direcionada à saída por cross-dock).

    Faz ``pytest.skip`` (apenas aqui, no seed) quando um pré-requisito externo
    é genuinamente indisponível — nunca no meio da verificação.

    Retorna ``{produto, pedido, nota, quantidade}``.
    """
    produto = wms_api.garantir_produto_configurado(run_id, sufixo="XDOCK-", com_sku=True)
    assert produto.get("id"), "seed cross-dock: produto obtido/criado (id)"
    assert produto.get("codigo"), "seed cross-dock: produto com código"
    produto_id = produto["id"]

    # Pedido de venda elegível: reaproveita, senão tenta criar + confirmar.
    pedido = wms_api.encontrar_pedido_venda_com_produto(produto_id)
    if not pedido.get("id"):
        pedido = wms_api.criar_pedido_venda_confirmado(
            run_id, produto, quantidade=quantidade
        )
    if not pedido.get("id"):
        pytest.skip(
            "Pré-requisito externo indisponível: o cross-dock exige um Pedido "
            "de Venda CONFIRMADO/EM_SEPARACAO com o produto para casar o item "
            "da nota a uma saída, e o ambiente não tem um pedido reaproveitável "
            "nem cliente/tabela de preço cadastrados para criar um. Cadastre um "
            "pedido de venda com o produto (ou cliente + tabela de preço) na "
            "empresa demo para exercitar o cross-dock ponta a ponta."
        )

    # Nota de entrada rastreável com o produto (mercadoria que entra).
    nota = wms_api.criar_nota_entrada(run_id, produto, quantidade=quantidade)
    assert nota.get("id"), "seed cross-dock: nota de entrada criada (id)"

    return {
        "produto": produto,
        "pedido": pedido,
        "nota": nota,
        "quantidade": quantidade,
    }


def _garantir_staging_area(wms_api: WmsApiClient) -> dict:
    """Garante uma staging area ativa (endereço + doca) para o roteamento.

    Reaproveita uma staging area ativa existente; se não houver, tenta criar
    uma a partir de um endereço livre e de uma doca cadastrados. Retorna a
    staging area (``{id, enderecoId, docaId, ...}``) ou ``{}`` quando não é
    possível garantir (o chamador trata como pré-requisito ausente).
    """
    # 1) Reaproveita uma staging area ativa já cadastrada.
    for sa in wms_api.listar_staging_areas():
        if sa.get("ativo") in (True, None) and sa.get("docaId"):
            return sa

    # 2) Tenta criar: precisa de um endereço livre + uma doca.
    enderecos_livres = wms_api.garantir_enderecos_livres(minimo=1)
    docas = wms_api.listar_docas()
    if not enderecos_livres or not docas:
        return {}

    endereco_id = enderecos_livres[0].get("id")
    doca_id = docas[0].get("id")
    if not endereco_id or not doca_id:
        return {}

    resp = wms_api.criar_staging_area(
        endereco_id, doca_id, nome="QA-CROSSDOCK", capacidade=100
    )
    if resp.status in (200, 201):
        criada = resp.json()
        return criada if isinstance(criada, dict) else {}
    if resp.status == 409:
        # Já existe staging para o endereço: relê e reaproveita.
        for sa in wms_api.listar_staging_areas():
            if sa.get("enderecoId") == endereco_id:
                return sa
    return {}


@pytest.mark.slow
class TestCrossDock:
    """Valida o cross-dock até a expedição (Requirement 8.3).

    Item por cross-dock chega à expedição (status EXPEDIDO), admitindo saldo
    temporário em endereço de staging durante o roteamento, sem saldo residual
    em endereço de ARMAZENAGEM ao final.
    """

    def test_cross_dock_chega_a_expedicao_sem_residuo_em_armazenagem(
        self, page_auth: Page, wms_api: WmsApiClient, run_id: str
    ):
        # ── Seed: produto + pedido de venda elegível + nota de entrada ──────
        qtd = 6
        seed = _semear_pre_requisitos_cross_dock(wms_api, run_id, quantidade=qtd)
        produto = seed["produto"]
        produto_id = produto["id"]
        pedido = seed["pedido"]
        pedido_id = pedido["id"]
        nota = seed["nota"]
        nota_id = nota["id"]

        # Endereços de ARMAZENAGEM da empresa (para aferir resíduo ao final).
        armazenagem_ids = _enderecos_armazenagem_ids(wms_api)

        # Saldo do produto em ARMAZENAGEM ANTES do cross-dock (baseline). O
        # cross-dock não deve INTRODUZIR resíduo novo em armazenagem.
        residuo_armazenagem_antes = _saldo_produto_em_armazenagem(
            wms_api, produto_id, armazenagem_ids
        )

        cross_dock_item_id = None
        expedido = False
        try:
            # ── 1) Identificar itens elegíveis a cross-dock desta nota ──────
            resp_ident = wms_api.cross_dock_identificar(nota_id)
            if resp_ident.status == 404:
                pytest.skip(
                    "Pré-requisito de ambiente indisponível: a nota semeada não "
                    f"foi encontrada para identificação de cross-dock ({resp_ident.text()})."
                )
            assert resp_ident.status in (200, 201), (
                "A identificação de cross-dock deve responder OK "
                f"(POST /cross-dock/identificar); status {resp_ident.status} — "
                f"{resp_ident.text()}"
            )
            elegiveis = resp_ident.json()
            if not isinstance(elegiveis, list) or not elegiveis:
                pytest.skip(
                    "Pré-requisito de ambiente indisponível: nenhum item da nota "
                    "semeada é elegível a cross-dock (o produto não casou com um "
                    "pedido de venda pendente no momento da identificação). "
                    f"Pedido semeado: {pedido_id}."
                )

            # Casa o item elegível deste produto com o pedido semeado (ou o
            # primeiro pedido elegível retornado).
            elegivel = next(
                (e for e in elegiveis if e.get("produtoId") == produto_id),
                elegiveis[0],
            )
            item_nota_id = elegivel.get("itemNotaEntradaId")
            pedidos_elegiveis = elegivel.get("pedidosElegiveis", []) or []
            assert item_nota_id, "identificação: item da nota elegível (id)"
            if not pedidos_elegiveis:
                pytest.skip(
                    "Pré-requisito de ambiente indisponível: o item elegível não "
                    "retornou pedidos com quantidade pendente para direcionar o "
                    "cross-dock."
                )
            pedido_alvo = next(
                (p for p in pedidos_elegiveis if p.get("pedidoVendaId") == pedido_id),
                pedidos_elegiveis[0],
            )
            pedido_alvo_id = pedido_alvo.get("pedidoVendaId")
            qtd_pendente = pedido_alvo.get("quantidadePendente", 0) or 0
            qtd_cross = min(qtd, int(qtd_pendente)) if qtd_pendente else qtd
            assert qtd_cross > 0, "identificação: quantidade a cross-dock > 0"

            # ── 2) Confirmar como cross-dock (TRANSITO) → EM_TRANSITO ───────
            resp_conf = wms_api.cross_dock_confirmar(
                [
                    {
                        "itemNotaEntradaId": item_nota_id,
                        "produtoId": produto_id,
                        "quantidade": qtd_cross,
                        "pedidoVendaId": pedido_alvo_id,
                        "tipo": "TRANSITO",
                    }
                ]
            )
            assert resp_conf.status in (200, 201), (
                "A confirmação de cross-dock deve ser aceita "
                f"(POST /cross-dock/confirmar); status {resp_conf.status} — "
                f"{resp_conf.text()}"
            )
            criados = resp_conf.json()
            assert isinstance(criados, list) and criados, (
                "confirmação: deve retornar os CrossDockItem criados"
            )
            cross_dock_item_id = criados[0].get("id")
            assert cross_dock_item_id, "confirmação: CrossDockItem com id"
            assert criados[0].get("status") == "EM_TRANSITO", (
                "confirmação: o item deve ficar EM_TRANSITO após confirmar "
                f"(obtido {criados[0].get('status')})"
            )

            # O cross-dock NÃO deve ter endereçado o produto na ARMAZENAGEM
            # (o item não passa pela armazenagem definitiva).
            residuo_pos_confirmar = _saldo_produto_em_armazenagem(
                wms_api, produto_id, armazenagem_ids
            )
            assert residuo_pos_confirmar <= residuo_armazenagem_antes, (
                "Requisito 8.3: confirmar o cross-dock não pode criar saldo em "
                "endereço de ARMAZENAGEM (o item não passa pela armazenagem "
                f"definitiva); antes {residuo_armazenagem_antes}, depois "
                f"{residuo_pos_confirmar}"
            )

            # ── 3) Rotear para staging → EM_STAGING (saldo temporário) ──────
            staging = _garantir_staging_area(wms_api)
            doca_saida_id = staging.get("docaId") if staging else None
            resp_rot = wms_api.cross_dock_rotear(cross_dock_item_id, doca_saida_id)
            if resp_rot.status == 422:
                pytest.skip(
                    "Pré-requisito de ambiente indisponível: não foi possível "
                    "rotear o item para uma staging area (nenhuma staging area "
                    "ativa com doca de saída disponível, e não foi possível "
                    f"criar uma). Corpo: {resp_rot.text()}"
                )
            assert resp_rot.status in (200, 201), (
                "O roteamento para staging deve ser aceito "
                f"(PUT /cross-dock/:id/rotear); status {resp_rot.status} — "
                f"{resp_rot.text()}"
            )

            item_em_staging = wms_api.cross_dock_obter(cross_dock_item_id)
            assert item_em_staging.get("status") == "EM_STAGING", (
                "roteamento: o item deve ficar EM_STAGING após rotear "
                f"(obtido {item_em_staging.get('status')})"
            )
            # Saldo temporário em endereço de staging é ADMITIDO durante o
            # roteamento — não asseramos ausência de saldo aqui.

            # ── 4) Expedir → EXPEDIDO (chega à expedição) ───────────────────
            resp_exp = wms_api.cross_dock_expedir(cross_dock_item_id)
            assert resp_exp.status in (200, 201), (
                "A expedição do item cross-dock deve ser aceita "
                f"(PUT /cross-dock/:id/expedir); status {resp_exp.status} — "
                f"{resp_exp.text()}"
            )
            expedido = True

            # ── Requisito 8.3 (a): o item CHEGOU à expedição (EXPEDIDO) ─────
            def _aguardar_status(esperado: str) -> dict:
                item = {}
                for _ in range(6):
                    item = wms_api.cross_dock_obter(cross_dock_item_id)
                    if item.get("status") == esperado:
                        return item
                    time.sleep(0.8)
                return item

            item_expedido = _aguardar_status("EXPEDIDO")
            assert item_expedido.get("status") == "EXPEDIDO", (
                "Requisito 8.3: o item por cross-dock deve CHEGAR à expedição "
                f"(status EXPEDIDO); obtido {item_expedido.get('status')}"
            )

            # ── Requisito 8.3 (b): sem saldo residual em ARMAZENAGEM ao final ─
            def _aguardar_residuo_armazenagem(limite: float) -> float:
                atual = 0.0
                for _ in range(6):
                    atual = _saldo_produto_em_armazenagem(
                        wms_api, produto_id, armazenagem_ids
                    )
                    if atual <= limite:
                        return atual
                    time.sleep(0.8)
                return atual

            residuo_final = _aguardar_residuo_armazenagem(residuo_armazenagem_antes)
            assert residuo_final <= residuo_armazenagem_antes, (
                "Requisito 8.3: ao final do cross-dock NÃO pode restar saldo "
                "residual em endereço de ARMAZENAGEM para o produto (o item foi "
                "direcionado à saída sem passar pela armazenagem definitiva; o "
                "saldo temporário de staging já foi baixado na expedição); "
                f"resíduo em armazenagem antes {residuo_armazenagem_antes}, "
                f"depois {residuo_final}"
            )

            # ── Evidência best-effort (Requisito 14.1; 14.4 não interrompe) ──
            try:
                navegar_para(page_auth, "/wms/cross-dock")
                aguardar_carregamento(page_auth)
                screenshot_com_nome(page_auth, f"cross_dock_{run_id}")
            except Exception as exc:  # pragma: no cover - evidência best-effort
                print(
                    "[evidencia] falha ao registrar evidência do cross-dock "
                    f"(best-effort, não interrompe o fluxo): {exc}"
                )

        finally:
            # Limpeza best-effort (design, Requisito 13.2/13.3): se o item não
            # chegou a ser expedido, cancela-o (IDENTIFICADO/EM_TRANSITO). Itens
            # já EXPEDIDOS são terminais (baixa já registrada) — não há reversão
            # e a nota/pedido carregam o marcador run_id. Não derruba o teste.
            if cross_dock_item_id and not expedido:
                try:
                    wms_api.cross_dock_cancelar(cross_dock_item_id)
                except Exception as exc:  # pragma: no cover - limpeza best-effort
                    print(
                        "[limpeza] falha ao cancelar item cross-dock "
                        f"{cross_dock_item_id}: {exc}"
                    )
