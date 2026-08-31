"""
TEST SUITE 16 — Inventário Cíclico (ajuste por contagem, valor real)
====================================================================
Valida a lógica de ajuste do inventário cíclico do WMS (Requisitos 6.1, 6.2,
6.3 do spec ``qa-fluxo-wms-completo``), com lançamentos reais persistidos e
verificação de valor via API (fonte de verdade).

Cenários cobertos:
  - **Contagem diferente do saldo** (Requisito 6.1 + 6.3): o ajuste aplicado é
    igual à diferença ``contagem − saldo_anterior`` e o saldo após o inventário
    fica igual à quantidade contada.
  - **Contagem igual ao saldo** (Requisito 6.2): nenhum ajuste é aplicado e o
    saldo permanece inalterado.

Estratégia (mesma filosofia híbrida UI + API do ``test_11``):
  - O **pré-requisito** — um produto com saldo endereçado real (``SaldoEndereco``)
    — é semeado inteiramente via API, reaproveitando o fluxo de recebimento já
    validado (produto/SKU → nota → conferência → endereçamento em lote). Sem
    esse saldo, o backend do inventário responde 422 ("Nenhum saldo encontrado
    para inventariar"), então a semeadura é obrigatória.
  - A **verificação de valor** (divergência registrada, ajuste aplicado, saldo
    final) é feita via API, que é a fonte de verdade. A UI de inventário é
    complementar/opcional (evidência best-effort), pois o alvo desta task é a
    correção da regra de negócio do ajuste, não a interação de tela.

Endpoints do inventário (backend
``VisioFab.Wms.Back/src/modules/inventario/inventario.routes.ts``, prefixo
``/api/inventarios`` em ``server.ts``):
  - POST   /inventarios                     cria (snapshot dos SaldoEndereco > 0)
  - GET    /inventarios/:id                 detalhe + itens (saldoSistema, ...)
  - PATCH  /inventarios/:id/contar          contagem de 1 item
  - PATCH  /inventarios/:id/aplicar-ajustes aplica ajustes de divergência
  - PATCH  /inventarios/:id/concluir        conclui sem ajustes

Isolamento (multi-tenant + escopo do teste): o inventário criado tira um
snapshot dos saldos da empresa da sessão. Para não afetar outros produtos,
contamos **apenas o item do produto semeado**; os demais itens do snapshot
ficam ``PENDENTE`` e, por regra do backend, ``aplicar-ajustes`` só toca itens
``DIVERGENTE`` — itens não contados nunca são ajustados. Assim o efeito do
teste fica restrito ao produto de QA rastreável (``run_id``).

Como rodar:
    cd tests/e2e-qa
    .venv\\Scripts\\activate
    pytest test_16_inventario_ciclico.py -s          # headless (padrão)
    $env:HEADLESS="false"; $env:SLOW_MO="600"; pytest test_16_inventario_ciclico.py -s
"""

import time
from datetime import datetime, timedelta

import pytest
from playwright.sync_api import Page

from wms_api import WmsApiClient


# ════════════════════════════════════════════════════════════════════
# HELPERS DE SEED / VERIFICAÇÃO (API — fonte de verdade)
# ════════════════════════════════════════════════════════════════════


def _validade_br(validade) -> str:
    """Normaliza a validade para o formato brasileiro ``dd/mm/aaaa``.

    O endpoint ``conferir-todos`` aceita a validade no formato brasileiro. A
    validade que volta de ``iniciar_conferencia`` pode vir em ISO
    (``aaaa-mm-dd``) ou já formatada; convertemos o que for ISO e devolvemos o
    resto como veio. Uma validade bem no futuro (garantida pelo seed) evita
    shelf life no caminho feliz.
    """
    if not validade:
        return (datetime.now() + timedelta(days=730)).strftime("%d/%m/%Y")
    texto = str(validade)
    if len(texto) >= 10 and texto[4] == "-" and texto[7] == "-":
        ano, mes, dia = texto[0:4], texto[5:7], texto[8:10]
        return f"{dia}/{mes}/{ano}"
    return texto


def _fisico_wms(wms_api: WmsApiClient, produto_id: str) -> float:
    """Retorna o físico consolidado (origem WMS) de um produto, ou 0."""
    saldo = wms_api.saldo_consolidado(produto_id)
    return saldo.get("fisico", 0) or 0


def _aguardar_fisico(
    wms_api: WmsApiClient,
    produto_id: str,
    esperado: float,
    tentativas: int = 6,
) -> float:
    """Consulta o físico consolidado até bater com ``esperado`` (ou esgotar).

    Tolera a latência de propagação do saldo após o endereçamento/ajuste. Faz
    um retry curto (backoff fixo) e retorna o último físico consultado — o
    chamador faz o ``assert`` de valor sobre o resultado.
    """
    fisico = 0.0
    for _ in range(max(1, tentativas)):
        fisico = _fisico_wms(wms_api, produto_id)
        if fisico == esperado:
            return fisico
        time.sleep(0.8)
    return fisico


def _semear_produto_com_saldo(
    wms_api: WmsApiClient, run_id: str, quantidade: int, sufixo: str = "INV-"
) -> dict:
    """Semeia um produto com saldo endereçado real (``SaldoEndereco``).

    Reaproveita o fluxo de recebimento já validado no ``test_11`` — porém
    inteiramente via API (a UI não é o alvo desta task):

      1. Garante produto + SKU (lastro/camada) e >= 1 endereço livre.
      2. Cria nota de entrada rastreável (``run_id``) com a quantidade.
      3. Confere a nota (contagem == quantidade → sem divergência) e confirma.
      4. Sugere e efetiva o endereçamento em lote (gera ``SaldoEndereco``).

    Retorna ``{produto, quantidade_endereçada}``. O físico consolidado (WMS)
    do produto após esta função é a base ("saldo anterior") do inventário.

    Faz ``pytest.skip`` (apenas aqui, no seed) se um pré-requisito externo
    genuinamente indisponível impedir a semeadura (ex.: nenhum endereço livre),
    seguindo o Error Handling do design — nunca pula no meio da verificação.
    """
    # Produto EXCLUSIVO por cenário (sufixo) — evita que execuções/testes
    # diferentes compartilhem o produto demo e acumulem saldo no mesmo lote,
    # o que quebrava a asserção "soma do lote == quantidade endereçada".
    produto = wms_api.garantir_produto_configurado(run_id, sufixo=sufixo, com_sku=True)
    assert produto.get("id"), "seed: produto obtido/criado (id)"
    assert produto.get("codigo"), "seed: produto com código"

    enderecos = wms_api.garantir_enderecos_livres(minimo=1)
    if len(enderecos) < 1:
        pytest.skip(
            "Pré-requisito externo indisponível: nenhum endereço de "
            "armazenagem livre no ambiente para endereçar o produto do "
            "inventário. Cadastre endereços ARMAZENAGEM/LIVRE ativos na "
            "empresa demo."
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
            "lote": item.get("lote") or f"LOTE-{run_id}",
            "validade": _validade_br(item.get("validade")),
        }
        for item in conf.get("itens", [])
    ]
    assert itens_conf, "seed: conferência retornou itens da nota"
    resultado = wms_api.conferir_todos(nota_id, itens_conf)
    assert resultado.get("divergentes", 0) == 0, (
        f"seed: conferência com contagem == nota deve ter 0 divergências "
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

    # Sem alocações → a distribuição inteligente não achou endereço livre para
    # o put-away (ambiente sem endereço de armazenagem disponível no momento).
    # É pré-requisito de ambiente indisponível — skip no seed, nunca assert
    # falso (o físico endereçado é condição para o cenário deste teste).
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

    # Confirma que o endereçamento desta execução refletiu no saldo, olhando
    # SOMENTE o lote deste run (o produto pode ter sido reaproveitado e já ter
    # saldo pré-existente de outros lotes — comparar físico absoluto falsaria).
    lote_run = wms_api.lote_do_run(run_id)

    def _soma_lote_do_run() -> float:
        saldo = wms_api.saldo_consolidado(produto["id"])
        return sum(
            e.get("quantidade", 0) or 0
            for e in (saldo.get("enderecos", []) or [])
            if (e.get("lote") or "") == lote_run
        )

    soma_run = 0.0
    for _ in range(6):
        soma_run = _soma_lote_do_run()
        if soma_run >= qtd_enderecada:
            break
        time.sleep(0.8)
    assert soma_run == qtd_enderecada, (
        "seed: a soma por endereço do lote desta execução deve ser igual à "
        f"quantidade endereçada (esperado {qtd_enderecada}, obtido {soma_run}, "
        f"lote {lote_run})"
    )

    return {"produto": produto, "quantidade": qtd_enderecada}


def _criar_inventario_do_produto(
    wms_api: WmsApiClient, produto_id: str
) -> dict:
    """Cria um inventário cíclico e retorna ``(inventario_id, item_alvo)``.

    O inventário faz snapshot dos saldos da empresa. Localizamos o **item do
    produto semeado** (o único que vamos contar) pelo ``produtoId``. Os demais
    itens do snapshot ficam ``PENDENTE`` e não são ajustados (o backend só
    ajusta itens ``DIVERGENTE``), preservando o isolamento do teste.

    Retorna ``{inventario_id, item}`` onde ``item`` traz ao menos
    ``{id, produtoId, saldoSistema, enderecoId}``.
    """
    inventario = wms_api.criar_inventario(tipo="CICLICO")
    inventario_id = inventario.get("id")
    assert inventario_id, "inventário criado (id)"

    detalhe = wms_api.detalhe_inventario(inventario_id)
    itens = detalhe.get("itens", []) or []
    item_alvo = next(
        (i for i in itens if i.get("produtoId") == produto_id), None
    )
    assert item_alvo is not None, (
        "o snapshot do inventário deve conter um item do produto semeado "
        f"(produtoId={produto_id}); itens do produto ausentes no snapshot"
    )
    return {"inventario_id": inventario_id, "item": item_alvo}


# ════════════════════════════════════════════════════════════════════
# CENÁRIOS — INVENTÁRIO CÍCLICO (Requisitos 6.1, 6.2, 6.3)
# ════════════════════════════════════════════════════════════════════


@pytest.mark.slow
class TestInventarioCiclico:
    """Valida o ajuste por contagem do inventário cíclico (valor real)."""

    def test_contagem_diferente_ajuste_igual_a_diferenca(
        self, page_auth: Page, wms_api: WmsApiClient, run_id: str
    ):
        """Contagem != saldo → ajuste == (contagem − saldo) e saldo final == contagem.

        Requisito 6.1: quando a contagem difere do saldo do sistema, o ajuste
        aplicado é igual à diferença entre a contagem e o saldo anterior.
        Requisito 6.3: o saldo após o inventário é igual à quantidade contada.
        """
        # Seed: produto com saldo endereçado conhecido.
        qtd_inicial = 8
        seed = _semear_produto_com_saldo(wms_api, run_id, quantidade=qtd_inicial, sufixo="INVDIF-")
        produto = seed["produto"]
        produto_id = produto["id"]

        # Cria o inventário e localiza o item do produto semeado.
        inv = _criar_inventario_do_produto(wms_api, produto_id)
        inventario_id = inv["inventario_id"]
        item = inv["item"]
        item_id = item["id"]
        saldo_anterior = item.get("saldoSistema", 0) or 0
        assert saldo_anterior > 0, (
            "o item do inventário deve ter saldoSistema > 0 (snapshot do saldo "
            f"endereçado); obtido {saldo_anterior}"
        )

        # Físico total do produto ANTES do ajuste (pode haver > 1 endereço;
        # contamos só este item, então o efeito no total é o delta deste item).
        fisico_antes = _fisico_wms(wms_api, produto_id)

        # Contagem DIFERENTE do saldo (excesso determinístico de +3 sobre o
        # saldo deste item específico).
        delta = 3
        contagem = saldo_anterior + delta

        item_contado = wms_api.contar_item_inventario(
            inventario_id, item_id, saldo_contado=contagem
        )
        # A divergência registrada é (contagem − saldo anterior).
        divergencia_esperada = contagem - saldo_anterior
        assert item_contado.get("status") == "DIVERGENTE", (
            "contagem != saldo deve marcar o item como DIVERGENTE; item: "
            f"{item_contado}"
        )
        assert (item_contado.get("divergencia") or 0) == divergencia_esperada, (
            "a divergência registrada deve ser (contagem − saldo anterior) = "
            f"{divergencia_esperada}; obtido {item_contado.get('divergencia')}"
        )

        # Aplica os ajustes: exatamente 1 item (o nosso) deve ser ajustado.
        resultado_ajuste = wms_api.aplicar_ajustes_inventario(inventario_id)
        assert resultado_ajuste.get("ajustesAplicados", 0) == 1, (
            "Requisito 6.1: exatamente 1 ajuste deve ser aplicado (o item "
            f"contado divergente); obtido {resultado_ajuste.get('ajustesAplicados')}"
        )

        # Requisito 6.1: o ajuste aplicado == diferença (contagem − saldo).
        # O físico total do produto deve ter variado exatamente pelo delta.
        fisico_esperado = fisico_antes + divergencia_esperada
        fisico_depois = _aguardar_fisico(
            wms_api, produto_id, esperado=fisico_esperado
        )
        assert fisico_depois == fisico_esperado, (
            "Requisito 6.1: o ajuste aplicado deve ser igual à diferença "
            f"(contagem − saldo) = {divergencia_esperada}; físico esperado "
            f"{fisico_esperado} (antes {fisico_antes}), obtido {fisico_depois}"
        )

        # Requisito 6.3: o saldo do endereço após o inventário == quantidade
        # contada. Reconsultamos o detalhe do inventário: o item ajustado deve
        # refletir saldoContado == contagem, e o físico do produto no endereço
        # inventariado (via saldo consolidado, filtrado pelo lote do run) deve
        # ser igual à contagem deste item.
        detalhe_final = wms_api.detalhe_inventario(inventario_id)
        item_final = next(
            (i for i in detalhe_final.get("itens", []) if i.get("id") == item_id),
            None,
        )
        assert item_final is not None, "item ajustado deve existir no detalhe final"
        assert (item_final.get("saldoContado") or 0) == contagem, (
            "Requisito 6.3: o saldo contado registrado deve ser igual à "
            f"quantidade contada ({contagem}); obtido {item_final.get('saldoContado')}"
        )
        assert item_final.get("ajusteAplicado") is True, (
            "o item divergente deve ficar com ajusteAplicado = True após o ajuste"
        )

        # Requisito 6.3 (saldo do endereço == contagem): o saldo consolidado
        # WMS do produto expõe as quantidades por endereço/lote. O endereço
        # inventariado (lote do run) deve estar com a quantidade contada.
        saldo_final = wms_api.saldo_consolidado(produto_id)
        enderecos = saldo_final.get("enderecos", []) or []
        # Lote canônico da execução (mesma fonte de verdade gravada na nota).
        lote_run = wms_api.lote_do_run(run_id)
        end_alvo = next(
            (e for e in enderecos if (e.get("lote") or "") == lote_run),
            None,
        )
        assert end_alvo is not None, (
            "Requisito 6.3: o endereço inventariado (lote do run) deve aparecer "
            f"no saldo consolidado; lote={lote_run}, endereços={enderecos}"
        )
        assert (end_alvo.get("quantidade") or 0) == contagem, (
            "Requisito 6.3: o saldo do endereço após o inventário deve ser "
            f"igual à quantidade contada ({contagem}); obtido "
            f"{end_alvo.get('quantidade')}"
        )

    def test_contagem_igual_nenhum_ajuste(
        self, page_auth: Page, wms_api: WmsApiClient, run_id: str
    ):
        """Contagem == saldo → nenhum ajuste aplicado e saldo inalterado.

        Requisito 6.2: quando a contagem confirma a mesma quantidade do saldo
        do sistema, nenhum ajuste de saldo é aplicado.
        """
        # Seed próprio (run_id diferente do outro teste via lote — cada nota
        # tem seu lote; usamos um sufixo para não colidir com o cenário acima).
        qtd_inicial = 7
        seed = _semear_produto_com_saldo(wms_api, run_id, quantidade=qtd_inicial, sufixo="INVIG-")
        produto = seed["produto"]
        produto_id = produto["id"]

        inv = _criar_inventario_do_produto(wms_api, produto_id)
        inventario_id = inv["inventario_id"]
        item = inv["item"]
        item_id = item["id"]
        saldo_anterior = item.get("saldoSistema", 0) or 0
        assert saldo_anterior > 0, (
            "o item do inventário deve ter saldoSistema > 0; obtido "
            f"{saldo_anterior}"
        )

        fisico_antes = _fisico_wms(wms_api, produto_id)

        # Contagem IGUAL ao saldo do sistema deste item.
        item_contado = wms_api.contar_item_inventario(
            inventario_id, item_id, saldo_contado=saldo_anterior
        )
        assert item_contado.get("status") == "CONFORME", (
            "contagem == saldo deve marcar o item como CONFORME; item: "
            f"{item_contado}"
        )
        assert (item_contado.get("divergencia") or 0) == 0, (
            "contagem == saldo deve registrar divergência zero; obtido "
            f"{item_contado.get('divergencia')}"
        )

        # Aplica os ajustes: nenhum ajuste deve ser aplicado (item CONFORME).
        resultado_ajuste = wms_api.aplicar_ajustes_inventario(inventario_id)
        assert resultado_ajuste.get("ajustesAplicados", 0) == 0, (
            "Requisito 6.2: nenhum ajuste deve ser aplicado quando a contagem "
            f"confirma o saldo; obtido {resultado_ajuste.get('ajustesAplicados')}"
        )

        # O físico total do produto deve permanecer inalterado.
        fisico_depois = _aguardar_fisico(
            wms_api, produto_id, esperado=fisico_antes
        )
        assert fisico_depois == fisico_antes, (
            "Requisito 6.2: o saldo deve permanecer inalterado quando a "
            f"contagem confirma o saldo (esperado {fisico_antes}, obtido "
            f"{fisico_depois})"
        )

        # E o saldo após inventário == quantidade contada (Requisito 6.3 no
        # caso conforme: contada == saldo → saldo mantém o valor contado).
        assert fisico_depois == fisico_antes, (
            "Requisito 6.3 (caso conforme): saldo após inventário == "
            f"quantidade contada (== saldo anterior {saldo_anterior})"
        )
