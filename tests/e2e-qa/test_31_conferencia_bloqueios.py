"""
test_31 — Conferência de entrada: bloqueios de pré-condição  [Requirement 5]

Valida de verdade os bloqueios que protegem o início/execução da conferência:
  - iniciar conferência de nota inexistente/sem itens → rejeitado;
  - nota válida sem pendências → status EM_CONFERENCIA;
  - conferência cega de lote (flag da empresa) → lote/validade ocultados na tela;
  - item com código de produto inexistente → produtoNaoEncontrado=true.

Modo visual:
    $env:HEADLESS="false"; $env:SLOW_MO="300"; pytest test_31_conferencia_bloqueios.py -s
"""
import random
import pytest


def test_5_3_iniciar_nota_valida_vai_para_em_conferencia(wms_api, run_id, cleanup_registry):
    """Req 5.3: iniciar conferência de nota PENDENTE sem pendências → EM_CONFERENCIA."""
    produto = wms_api.garantir_produto_configurado(run_id, sufixo="BLQ-", com_sku=True)
    nota = wms_api.criar_nota_entrada(run_id, produto, quantidade=25)
    cleanup_registry.registrar_nota(nota["id"])
    iniciada = wms_api.iniciar_conferencia(nota["id"])
    # iniciar_conferencia retorna a nota (com status EM_CONFERENCIA) ou o detalhe.
    status = (iniciada.get("nota") or {}).get("status") or iniciada.get("status")
    # Confirma via detalhe da nota.
    detalhe = wms_api.obter_nota(nota["id"])
    assert detalhe.get("status") == "EM_CONFERENCIA", (
        f"Nota deveria estar EM_CONFERENCIA após iniciar: {detalhe.get('status')}"
    )


def test_5_1_iniciar_nota_inexistente_rejeita(wms_api):
    """Req 5.1 (variação): iniciar conferência de nota inexistente → 404."""
    import uuid
    fake_id = str(uuid.uuid4())
    resp = wms_api._post(f"/conferencia-entrada/iniciar/{fake_id}")
    assert resp.status == 404, f"Esperava 404 para nota inexistente, veio {resp.status}: {resp.text()}"


def test_5_5_produto_nao_encontrado_sinalizado(wms_api, run_id, cleanup_registry):
    """Req 5.5: item com código de produto inexistente → produtoNaoEncontrado=true.

    Cria uma nota cujo item tem um codigoProduto que NÃO corresponde a nenhum
    Produto cadastrado; ao iniciar, o backend marca o item com a flag.
    """
    codigo_inexistente = f"NAOEXISTE-{random.randint(100000,999999)}"
    numero = random.randint(100000, 999999)
    payload = {
        "numero": numero, "serie": "1", "fornecedor": f"QA-WMS {run_id}", "tipo": "COMPRA",
        "itens": [{
            "item": 1, "descricao": f"ITEM SEM PRODUTO {run_id}",
            "codigoProduto": codigo_inexistente, "unidade": "UN", "quantidade": 10,
        }],
    }
    r = wms_api._post("/notas-entrada", data=payload)
    assert r.status in (200, 201), f"Falha ao criar nota: {r.status} — {r.text()}"
    nota = r.json()
    cleanup_registry.registrar_nota(nota["id"])
    iniciada = wms_api.iniciar_conferencia(nota["id"])
    itens = iniciada.get("itens", [])
    assert itens, f"Nota iniciada sem itens: {iniciada}"
    assert any(i.get("produtoNaoEncontrado") is True for i in itens), (
        f"Esperava produtoNaoEncontrado=true para código inexistente: {itens}"
    )


def test_5_4_conferencia_cega_oculta_lote_validade(wms_api, run_id, cleanup_registry):
    """Req 5.4: com conferenciaLoteCega ligada, a tela de iniciar não expõe lote/validade da NF-e.

    Liga a flag da empresa (via /config-empresa), cria uma nota COM lote/validade,
    inicia e verifica que os campos vêm nulos na resposta. Restaura a flag ao fim.
    """
    cfg = wms_api.ler_config_conferencia_empresa()
    valor_antes = cfg.get("conferenciaLoteCega", False)
    r = wms_api.set_config_conferencia_empresa(conferenciaLoteCega=True)
    if r.status == 403:
        pytest.fail("Usuário de QA não é admin — não foi possível ligar conferência cega.")
    assert r.status in (200, 201), f"Falha ao ligar conferência cega: {r.status} — {r.text()}"
    try:
        produto = wms_api.garantir_produto_configurado(run_id, sufixo="CEGA-", com_sku=True, exige_lote=True)
        # A nota canônica já vem com lote e validade preenchidos.
        nota = wms_api.criar_nota_entrada(run_id, produto, quantidade=15)
        cleanup_registry.registrar_nota(nota["id"])
        iniciada = wms_api.iniciar_conferencia(nota["id"])
        itens = iniciada.get("itens", [])
        assert itens, f"Nota iniciada sem itens: {iniciada}"
        # Conferência cega: lote e validade da NF-e ocultados (nulos) na tela.
        for it in itens:
            assert it.get("lote") in (None, ""), f"Lote deveria estar oculto (cega): {it}"
            assert it.get("validade") in (None, ""), f"Validade deveria estar oculta (cega): {it}"
    finally:
        wms_api.set_config_conferencia_empresa(conferenciaLoteCega=valor_antes)
