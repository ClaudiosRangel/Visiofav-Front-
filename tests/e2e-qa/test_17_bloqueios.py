"""
TEST SUITE 17 — Bloqueios de WMS (bloqueio, impedimento de separação, liberação)
================================================================================
Valida a lógica de bloqueio de estoque do WMS (Requisitos 7.1, 7.2, 7.3 do
spec ``qa-fluxo-wms-completo``), com lançamentos reais persistidos e
verificação de valor via API (fonte de verdade).

Cenários cobertos (um único teste encadeado — o estado de um passo alimenta o
próximo, e a limpeza depende do bloqueio criado):
  - **Requisito 7.1 — bloquear reduz o disponível**: bloquear o saldo de um
    lote em endereço subtrai a quantidade bloqueada do ``disponivel`` (e do
    ``fisico``) consolidado do produto.
  - **Requisito 7.2 — separação impedida sobre saldo bloqueado**: uma
    verificação de separação/movimentação sobre a posição bloqueada é impedida
    pelo sistema (``bloqueado == True`` com motivo).
  - **Requisito 7.3 — liberar devolve ao disponível**: liberar o bloqueio
    devolve exatamente a quantidade bloqueada ao ``disponivel``/``fisico``.

Estratégia (mesma filosofia híbrida UI + API do ``test_11``/``test_16``):
  - O **pré-requisito** — um produto com saldo endereçado real
    (``SaldoEndereco``) num lote rastreável (``LOTE-{run_id}``) — é semeado
    inteiramente via API, reaproveitando o fluxo de recebimento já validado
    (produto/SKU → nota → conferência → endereçamento em lote). Sem esse saldo
    não há o que bloquear.
  - A **verificação de valor** (queda do disponível ao bloquear, impedimento
    da separação, retorno do disponível ao liberar) é feita via API, que é a
    fonte de verdade. A UI é complementar (evidência best-effort).

Como o "disponível" reflete o bloqueio (confirmado no backend
``saldo-consolidado.service.ts``): o serviço de saldo consolidado soma o
físico WMS filtrando ``bloqueado: false``. Logo, bloquear um lote REMOVE
aquela quantidade do ``fisico`` consolidado e, por consequência, do
``disponivel`` (``disponivel = fisico − reservado``). Liberar devolve a
quantidade. Por isso 7.1/7.3 são verificados comparando o ``disponivel`` do
produto antes e depois de bloquear/liberar.

NUANCE IMPORTANTE da regra de origem WMS×ERP (descoberta ao validar contra
produção e tratada pelo seed): o consolidado só usa origem WMS enquanto há
``SaldoEndereco`` (não bloqueado) > 0 para o produto; se TODAS as posições WMS
forem bloqueadas, ele cai para o ``Estoque`` global (ERP), que o endereçamento
também incrementa — e o físico consolidado NÃO refletiria a queda do bloqueio
(ficaria "preso" no valor do ERP). Para validar 7.1/7.3 de forma fiel (o
disponível cai EXATAMENTE pela quantidade bloqueada), o seed endereça uma
pequena quantidade num SEGUNDO lote (``{lote}-R``): ao bloquear apenas o
lote-alvo, esse residual mantém origem=WMS e o físico consolidado passa a ser o
residual (queda == quantidade do lote-alvo). O bloqueio é por (produto, lote),
então o residual não é afetado.

CORREÇÃO DE BACKEND ASSOCIADA (fix de raiz, commit em ``VisioFab.Wms.Back``): o
endereçamento (``enderecamento-wms.routes.ts``: ``/confirmar``, ``/coletor`` e
``/confirmar-lote``) criava ``SaldoEndereco`` sem ``empresaId`` (coluna
``empresa_id`` NULL), enquanto ``POST/DELETE /bloqueios/lote`` filtrava por
``empresaId`` estrito — então o bloqueio não casava as posições e retornava
``posicoesBloqueadas: 0`` (o disponível não caía). O fix passou a gravar
``empresaId`` no ``SaldoEndereco`` e tornou o filtro do bloqueio/liberação de
lote tolerante a linhas legadas (``OR: [{empresaId}, {empresaId: null}]``),
alinhado ao ``saldo-consolidado.service.ts``.

Endpoints do bloqueio (backend
``VisioFab.Wms.Back/src/modules/bloqueio-wms/bloqueio-wms.routes.ts``,
prefixo ``/api/bloqueio-wms`` em ``server.ts``, guard ``moduloGuard('WMS')``):
  - POST   /bloqueios/lote       bloqueia lote/produto (``SaldoEndereco.bloqueado
                                 = true`` + ``BloqueioHierarquico`` LOTE)
  - DELETE /bloqueios/lote       libera (query ``produtoId`` + ``lote``)
  - POST   /bloqueios/verificar  verifica se a posição está bloqueada
                                 (pré-check que impede a separação — 7.2)

Multi-tenant: todas as operações usam a empresa da sessão autenticada. A
limpeza best-effort no ``finally`` libera o lote bloqueado remanescente
(idempotente — não derruba o teste se já estiver liberado).

Como rodar:
    cd tests/e2e-qa
    .venv\\Scripts\\activate
    pytest test_17_bloqueios.py -s          # headless (padrão)
    $env:HEADLESS="false"; $env:SLOW_MO="600"; pytest test_17_bloqueios.py -s
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


def _saldo(wms_api: WmsApiClient, produto_id: str) -> dict:
    """Retorna o registro de saldo consolidado do produto, ou ``{}``."""
    return wms_api.saldo_consolidado(produto_id)


def _aguardar_disponivel(
    wms_api: WmsApiClient,
    produto_id: str,
    esperado: float,
    tentativas: int = 6,
) -> dict:
    """Consulta o saldo até o ``disponivel`` bater com ``esperado`` (ou esgotar).

    Tolera a latência de propagação do saldo após bloquear/liberar. Faz um
    retry curto (backoff fixo) e retorna o último saldo consultado — o
    chamador faz o ``assert`` de valor sobre o resultado.
    """
    saldo: dict = {}
    for _ in range(max(1, tentativas)):
        saldo = _saldo(wms_api, produto_id)
        if (saldo.get("disponivel", 0) or 0) == esperado:
            return saldo
        time.sleep(0.8)
    return saldo


def _semear_produto_com_saldo(
    wms_api: WmsApiClient, run_id: str, quantidade: int, sufixo: str = "BLQ17-"
) -> dict:
    """Semeia um produto com saldo endereçado real (``SaldoEndereco``).

    Reaproveita o fluxo de recebimento já validado no ``test_11``/``test_16`` —
    inteiramente via API (a UI não é o alvo desta task):

      1. Garante produto + SKU (lastro/camada) e >= 1 endereço livre.
      2. Cria nota de entrada rastreável (lote ``LOTE-{run_id}``) com a qtd.
      3. Confere a nota (contagem == quantidade → sem divergência) e confirma.
      4. Sugere e efetiva o endereçamento em lote (gera ``SaldoEndereco``).

    Retorna ``{produto, quantidade_enderecada, lote, enderecos}`` onde
    ``enderecos`` é a lista de posições WMS (do saldo consolidado) do lote
    semeado — usada para localizar o ``enderecoId`` a bloquear/verificar.

    Faz ``pytest.skip`` (apenas aqui, no seed) se um pré-requisito externo
    genuinamente indisponível impedir a semeadura (ex.: nenhum endereço livre),
    seguindo o Error Handling do design — nunca pula no meio da verificação.
    """
    # Produto EXCLUSIVO por execução (sufixo) — evita acúmulo de saldo no lote
    # compartilhado do produto demo entre execuções/testes.
    produto = wms_api.garantir_produto_configurado(run_id, sufixo=sufixo, com_sku=True)
    assert produto.get("id"), "seed: produto obtido/criado (id)"
    assert produto.get("codigo"), "seed: produto com código"

    enderecos_livres = wms_api.garantir_enderecos_livres(minimo=1)
    if len(enderecos_livres) < 1:
        pytest.skip(
            "Pré-requisito externo indisponível: nenhum endereço de "
            "armazenagem livre no ambiente para endereçar o produto a "
            "bloquear. Cadastre endereços ARMAZENAGEM/LIVRE ativos na empresa "
            "demo."
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
    # falso — o físico endereçado é condição para bloquear/verificar.
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

    # ── Saldo WMS residual num SEGUNDO lote (mantém origem=WMS após bloquear) ─
    # O consolidado (``saldo-consolidado.service.ts``) usa origem WMS somente
    # enquanto há SaldoEndereco WMS (não bloqueado) > 0 para o produto; se TODAS
    # as posições WMS forem bloqueadas, ele cai para o Estoque global (ERP), que
    # o endereçamento também incrementou — e o físico consolidado NÃO refletiria
    # a queda do bloqueio. Para validar 7.1/7.3 de forma fiel (o disponível cai
    # exatamente pela quantidade bloqueada), endereçamos uma pequena quantidade
    # num lote distinto (``{lote}-R``): ao bloquear apenas o lote-alvo, esse
    # residual mantém origem=WMS e o físico consolidado = residual (queda ==
    # quantidade do lote-alvo). O bloqueio é por (produto, lote), então o
    # residual não é afetado.
    residual_qtd = 2
    lote_run_seed = wms_api.lote_do_run(run_id)
    lote_residual = f"{lote_run_seed[:28]}-R"  # cabe em VarChar(30)
    endereco_residual = itens_lote[0]["enderecoId"]
    item_residual = itens_lote[0]["itemNotaEntradaId"]
    produto_residual = itens_lote[0]["produtoId"]
    # ``validade`` é omitida de propósito: o schema do backend
    # (``confirmarLoteSchema``) declara ``validade: z.string().optional()`` —
    # enviar ``null`` explicitamente é rejeitado (Zod ``invalid_type``, 500).
    resultado_residual = wms_api.confirmar_enderecamento_lote(
        nota_id,
        [
            {
                "itemNotaEntradaId": item_residual,
                "produtoId": produto_residual,
                "enderecoId": endereco_residual,
                "quantidade": residual_qtd,
                "lote": lote_residual,
            }
        ],
    )
    assert resultado_residual.get("itensEnderecados", 0) == 1, (
        "seed: o saldo residual (segundo lote) deve ser efetivado para manter "
        f"origem=WMS após o bloqueio; resposta: {resultado_residual}"
    )

    # Confirma que o físico consolidado refletiu o endereçamento e captura os
    # endereços WMS do lote semeado (para localizar o enderecoId a bloquear).
    # Usa o lote canônico da execução (mesma fonte de verdade do que foi
    # gravado na nota — cabe em VarChar(30)), evitando divergência de filtro.
    lote_run = wms_api.lote_do_run(run_id)
    fisico_alvo = qtd_enderecada + residual_qtd
    saldo = _saldo(wms_api, produto["id"])
    for _ in range(6):
        if (saldo.get("fisico", 0) or 0) >= fisico_alvo:
            break
        time.sleep(0.8)
        saldo = _saldo(wms_api, produto["id"])

    enderecos_lote = [
        e for e in (saldo.get("enderecos", []) or [])
        if (e.get("lote") or "") == lote_run
    ]
    assert enderecos_lote, (
        "seed: o saldo consolidado deve expor os endereços do lote semeado "
        f"(lote={lote_run}); endereços: {saldo.get('enderecos')}"
    )

    return {
        "produto": produto,
        "quantidade": qtd_enderecada,
        "lote": lote_run,
        "enderecos": enderecos_lote,
        "residual_qtd": residual_qtd,
        "lote_residual": lote_residual,
    }


def _endereco_id_do_lote(
    wms_api: WmsApiClient, produto_id: str, lote: str
) -> str:
    """Descobre o ``enderecoId`` de uma posição do lote via ``/enderecos``.

    O saldo consolidado expõe o ``enderecoCompleto`` (texto) por posição, mas
    não o ``enderecoId`` (uuid) exigido por ``/bloqueios/verificar``. Aqui
    resolvemos o id casando o ``enderecoCompleto`` do saldo com a listagem de
    endereços (``GET /enderecos``, já filtrada por empresa no backend).

    Retorna o ``enderecoId`` da primeira posição do lote encontrada, ou ``""``
    quando não for possível resolver (o teste trata como pré-requisito ausente).
    """
    saldo = _saldo(wms_api, produto_id)
    enderecos_saldo = [
        e for e in (saldo.get("enderecos", []) or [])
        if (e.get("lote") or "") == lote and (e.get("quantidade", 0) or 0) > 0
    ]
    if not enderecos_saldo:
        return ""
    completo_alvo = (enderecos_saldo[0].get("enderecoCompleto") or "").strip()
    if not completo_alvo:
        return ""

    for e in wms_api.listar_enderecos(limit=500):
        if (e.get("enderecoCompleto") or "").strip() == completo_alvo:
            return e.get("id") or ""
    return ""


# ════════════════════════════════════════════════════════════════════
# CENÁRIO — BLOQUEIOS DE WMS (Requisitos 7.1, 7.2, 7.3)
# ════════════════════════════════════════════════════════════════════


@pytest.mark.slow
class TestBloqueiosWms:
    """Valida bloqueio, impedimento de separação e liberação (valor real)."""

    def test_bloqueio_impede_separacao_e_liberacao(
        self, page_auth: Page, wms_api: WmsApiClient, run_id: str
    ):
        """Bloquear reduz o disponível; separação é impedida; liberar devolve.

        Requisito 7.1: bloquear o saldo em endereço subtrai a quantidade
        bloqueada do disponível.
        Requisito 7.2: separação sobre saldo bloqueado é impedida.
        Requisito 7.3: liberar o bloqueio devolve a quantidade ao disponível.
        """
        # ── Seed: produto com saldo endereçado real num lote rastreável ──
        qtd_inicial = 12
        seed = _semear_produto_com_saldo(wms_api, run_id, quantidade=qtd_inicial)
        produto = seed["produto"]
        produto_id = produto["id"]
        lote = seed["lote"]
        qtd_enderecada = seed["quantidade"]

        lote_bloqueado = False
        try:
            # ── Estado inicial: disponível/físico antes do bloqueio ──────
            # A quantidade que será efetivamente bloqueada é a soma das
            # posições WMS do lote semeado (o bloqueio por lote afeta TODAS as
            # posições daquele lote/produto). Como o seed acabou de endereçar,
            # essa soma == qtd_enderecada.
            saldo_antes = _saldo(wms_api, produto_id)
            assert saldo_antes, (
                "pré-condição: o produto semeado deve ter saldo consolidado "
                f"antes do bloqueio (produtoId={produto_id})"
            )
            fisico_antes = saldo_antes.get("fisico", 0) or 0
            disponivel_antes = saldo_antes.get("disponivel", 0) or 0
            reservado_antes = saldo_antes.get("reservado", 0) or 0

            qtd_bloquear = sum(
                e.get("quantidade", 0) or 0
                for e in (saldo_antes.get("enderecos", []) or [])
                if (e.get("lote") or "") == lote
            )
            assert qtd_bloquear == qtd_enderecada, (
                "pré-condição: a quantidade do lote no saldo consolidado deve "
                f"ser igual à endereçada ({qtd_enderecada}); obtido "
                f"{qtd_bloquear} (endereços: {saldo_antes.get('enderecos')})"
            )
            assert disponivel_antes >= qtd_bloquear, (
                "pré-condição: o disponível antes do bloqueio deve comportar a "
                f"quantidade a bloquear (disponível={disponivel_antes}, "
                f"bloquear={qtd_bloquear})"
            )

            # Resolve o enderecoId de uma posição do lote (para 7.2).
            endereco_id = _endereco_id_do_lote(wms_api, produto_id, lote)
            assert endereco_id, (
                "pré-requisito: não foi possível resolver o enderecoId da "
                f"posição do lote {lote} (necessário para verificar 7.2)"
            )

            # Sanidade: antes de bloquear, a posição NÃO está bloqueada.
            verif_antes = wms_api.verificar_bloqueio(
                endereco_id=endereco_id, produto_id=produto_id, lote=lote
            )
            # Interferência de estado do demo compartilhado: o motor de
            # endereçamento pode ter posicionado o produto num endereço que
            # OUTRO teste (ex.: test_16 inventário cíclico) deixou com
            # inventário ativo — que bloqueia movimentação mas NÃO é o bloqueio
            # de lote/produto que este teste valida. Isso é um pré-requisito
            # externo indisponível, não uma falha da regra testada → skip
            # honesto (nunca assert falso), seguindo o padrão da suíte.
            if verif_antes.get("bloqueado") is True:
                motivos = " ".join(verif_antes.get("motivos", []) or [])
                if "inventário" in motivos.lower() or "inventario" in motivos.lower():
                    pytest.skip(
                        "Pré-requisito externo indisponível: a posição "
                        "endereçada caiu num endereço com inventário ativo "
                        "(resíduo de outro teste no demo compartilhado) — "
                        f"movimentação já bloqueada por inventário: {motivos}. "
                        "A regra de bloqueio de lote é validada quando o "
                        "test_17 roda isolado."
                    )
            assert verif_antes.get("bloqueado") is False, (
                "pré-condição: a posição não deve estar bloqueada antes do "
                f"bloqueio; verificação: {verif_antes}"
            )

            # ── Requisito 7.1: bloquear reduz o disponível ───────────────
            resultado_bloqueio = wms_api.bloquear_lote(
                produto_id=produto_id,
                lote=lote,
                motivo=f"QA bloqueio {run_id}",
            )
            lote_bloqueado = True
            assert (resultado_bloqueio.get("posicoesBloqueadas", 0) or 0) >= 1, (
                "Requisito 7.1: o bloqueio deve marcar ao menos uma posição "
                f"como bloqueada; resposta: {resultado_bloqueio}"
            )

            # O disponível (e o físico) do produto caem exatamente pela
            # quantidade bloqueada — o saldo consolidado exclui bloqueado=true.
            disponivel_esperado = disponivel_antes - qtd_bloquear
            saldo_bloqueado = _aguardar_disponivel(
                wms_api, produto_id, esperado=disponivel_esperado
            )
            disponivel_depois = saldo_bloqueado.get("disponivel", 0) or 0
            fisico_depois = saldo_bloqueado.get("fisico", 0) or 0

            assert disponivel_depois == disponivel_esperado, (
                "Requisito 7.1: o disponível deve cair exatamente pela "
                f"quantidade bloqueada ({qtd_bloquear}); esperado "
                f"{disponivel_esperado} (antes {disponivel_antes}), obtido "
                f"{disponivel_depois}; saldo: {saldo_bloqueado}"
            )
            # O físico também cai pela mesma quantidade (a origem WMS deixa de
            # somar as posições bloqueadas).
            assert fisico_depois == fisico_antes - qtd_bloquear, (
                "Requisito 7.1 (consistência): o físico também deve cair pela "
                f"quantidade bloqueada ({qtd_bloquear}); esperado "
                f"{fisico_antes - qtd_bloquear} (antes {fisico_antes}), obtido "
                f"{fisico_depois}"
            )
            # A fórmula de consolidação continua coerente.
            assert disponivel_depois == fisico_depois - reservado_antes, (
                "Requisito 7.1 (coerência): disponível deve ser físico - "
                f"reservado ({fisico_depois} - {reservado_antes}); obtido "
                f"{disponivel_depois}; saldo: {saldo_bloqueado}"
            )

            # ── Requisito 7.2: separação impedida sobre saldo bloqueado ──
            # O pré-check de movimentação/separação (``/bloqueios/verificar``,
            # chamado pelas rotas de separação antes de mover estoque) deve
            # acusar a posição como bloqueada, impedindo a operação.
            verif_bloqueada = wms_api.verificar_bloqueio(
                endereco_id=endereco_id, produto_id=produto_id, lote=lote
            )
            assert verif_bloqueada.get("bloqueado") is True, (
                "Requisito 7.2: a separação sobre a posição bloqueada deve ser "
                f"impedida (verificação deve retornar bloqueado=True); "
                f"verificação: {verif_bloqueada}"
            )
            motivos = verif_bloqueada.get("motivos", []) or []
            assert motivos, (
                "Requisito 7.2: o impedimento deve trazer ao menos um motivo "
                f"do bloqueio; verificação: {verif_bloqueada}"
            )

            # Evidência best-effort da tela de saldos com o produto bloqueado
            # (Requisito 14.1). Falha de evidência não interrompe o teste.
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
                screenshot_com_nome(page_auth, f"bloqueio_saldo_{run_id}")
            except Exception as exc:  # pragma: no cover - evidência best-effort
                print(
                    "[evidencia] falha ao registrar evidência do bloqueio "
                    f"(best-effort, não interrompe o fluxo): {exc}"
                )

            # ── Requisito 7.3: liberar devolve a quantidade ao disponível ─
            liberou = wms_api.liberar_lote(produto_id=produto_id, lote=lote)
            assert liberou, (
                "Requisito 7.3: a liberação do lote deve ser aceita pelo "
                "sistema (DELETE /bloqueios/lote)"
            )
            lote_bloqueado = False

            # O disponível (e o físico) voltam ao valor original.
            saldo_liberado = _aguardar_disponivel(
                wms_api, produto_id, esperado=disponivel_antes
            )
            disponivel_final = saldo_liberado.get("disponivel", 0) or 0
            fisico_final = saldo_liberado.get("fisico", 0) or 0

            assert disponivel_final == disponivel_antes, (
                "Requisito 7.3: liberar o bloqueio deve devolver exatamente a "
                f"quantidade bloqueada ({qtd_bloquear}) ao disponível; "
                f"esperado {disponivel_antes}, obtido {disponivel_final}; "
                f"saldo: {saldo_liberado}"
            )
            assert fisico_final == fisico_antes, (
                "Requisito 7.3 (consistência): o físico deve retornar ao valor "
                f"original ({fisico_antes}); obtido {fisico_final}"
            )

            # Sanidade final: a posição não está mais bloqueada.
            verif_final = wms_api.verificar_bloqueio(
                endereco_id=endereco_id, produto_id=produto_id, lote=lote
            )
            assert verif_final.get("bloqueado") is False, (
                "Requisito 7.3: após a liberação, a posição não deve mais "
                f"constar como bloqueada; verificação: {verif_final}"
            )

        finally:
            # Limpeza best-effort (design, Requisito 13.2): se o lote ficou
            # bloqueado (ex.: falha antes da etapa de liberação), libera aqui
            # para não deixar saldo bloqueado remanescente no ambiente demo. A
            # operação é idempotente e não derruba o teste (Requisito 13.3).
            if lote_bloqueado:
                try:
                    wms_api.liberar_lote(produto_id=produto_id, lote=lote)
                except Exception as exc:  # pragma: no cover - limpeza best-effort
                    print(
                        "[limpeza] falha ao liberar o lote bloqueado "
                        f"remanescente {lote} do produto {produto_id}: {exc}"
                    )
