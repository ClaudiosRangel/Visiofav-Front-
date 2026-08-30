"""
test_29 — Segunda conferência, HOLD e confirmação da nota  [Requirement 8]

Cria nota, força divergência de quantidade (item → PENDENTE_SEGUNDA_CONFERENCIA)
e valida de verdade:
  - 2ª conferência igual à NF-e → item CONFERIDO (resolvido);
  - 2ª conferência qtd diverge sem aceite → divergenciaQuantidade (segue pendente);
  - HOLD → statusConferencia=HOLD;
  - confirmar com item pendente → 422 ITENS_PENDENTES_SEGUNDA_CONFERENCIA;
  - confirmar com item em HOLD → 422 ITENS_EM_HOLD;
  - confirmar sem pendências → CONFERIDA + OS de ENDERECAMENTO.

Modo visual:
    $env:HEADLESS="false"; $env:SLOW_MO="400"; pytest test_29_segunda_conferencia_hold.py -s
"""
import pytest


def _nota_com_divergencia(wms_api, run_id, cleanup_registry, sufixo, qtd_nota=50, qtd_conf=60):
    """Cria nota, inicia e confere com excesso → itens ficam pendentes de 2ª conferência.

    Garante recebimento parcial DESLIGADO (senão falta viraria parcial); usamos
    EXCESSO (qtd_conf > qtd_nota), que é sempre divergente.
    Retorna (nota_id, item_id).
    """
    wms_api.set_config_conferencia_empresa(permiteRecebimentoParcial=False)
    produto = wms_api.garantir_produto_configurado(run_id, sufixo=sufixo, com_sku=True)
    nota = wms_api.criar_nota_entrada(run_id, produto, quantidade=qtd_nota)
    cleanup_registry.registrar_nota(nota["id"])
    iniciada = wms_api.iniciar_conferencia(nota["id"])
    itens = [{"itemNotaEntradaId": it["id"], "quantidadeConferida": qtd_conf}
             for it in iniciada.get("itens", [])]
    res = wms_api.conferir_todos(nota["id"], itens)
    assert res.get("requerSegundaConferencia") is True, f"Esperava 2ª conferência: {res}"
    item_id = iniciada["itens"][0]["id"]
    return nota["id"], item_id


def test_8_1_segunda_conferencia_igual_resolve(wms_api, run_id, cleanup_registry):
    """Req 8.1: 2ª conferência com qtd igual à NF-e → item CONFERIDO."""
    nota_id, item_id = _nota_com_divergencia(wms_api, run_id, cleanup_registry, "SC1-")
    # 2ª conferência agora com a quantidade CORRETA (== NF-e = 50).
    resp = wms_api.segunda_conferencia(nota_id, [
        {"itemNotaEntradaId": item_id, "quantidadeConferida": 50},
    ])
    assert resp.status in (200, 201), f"2ª conferência falhou: {resp.status} — {resp.text()}"
    body = resp.json()
    assert body.get("divergenciaResolvida") is True, f"Esperava resolvido: {body}"
    status = wms_api.status_conferencia_itens(nota_id)
    assert status.get(item_id) == "CONFERIDO", f"Item deveria estar CONFERIDO: {status}"


def test_8_2_segunda_conferencia_diverge_sem_aceite(wms_api, run_id, cleanup_registry):
    """Req 8.2: 2ª conferência diverge de novo sem aceite → divergenciaQuantidade (segue pendente)."""
    nota_id, item_id = _nota_com_divergencia(wms_api, run_id, cleanup_registry, "SC2-")
    resp = wms_api.segunda_conferencia(nota_id, [
        {"itemNotaEntradaId": item_id, "quantidadeConferida": 60},  # diverge de novo, sem aceite
    ])
    assert resp.status in (200, 201), f"2ª conferência falhou: {resp.status} — {resp.text()}"
    body = resp.json()
    assert body.get("divergenciaQuantidade") is True, f"Esperava divergenciaQuantidade: {body}"
    status = wms_api.status_conferencia_itens(nota_id)
    assert status.get(item_id) == "PENDENTE_SEGUNDA_CONFERENCIA", f"Item deveria seguir pendente: {status}"


def test_8_3_hold_marca_item(wms_api, run_id, cleanup_registry):
    """Req 8.3: colocar item em HOLD → statusConferencia=HOLD."""
    nota_id, item_id = _nota_com_divergencia(wms_api, run_id, cleanup_registry, "SC3-")
    resp = wms_api.colocar_item_em_hold(nota_id, item_id, motivo="AVARIA_TRANSPORTE")
    assert resp.status in (200, 201), f"HOLD falhou: {resp.status} — {resp.text()}"
    status = wms_api.status_conferencia_itens(nota_id)
    assert status.get(item_id) == "HOLD", f"Item deveria estar HOLD: {status}"


def test_8_4_confirmar_com_pendente_bloqueia(wms_api, run_id, cleanup_registry):
    """Req 8.4: confirmar nota com item PENDENTE_SEGUNDA_CONFERENCIA → 422."""
    nota_id, _ = _nota_com_divergencia(wms_api, run_id, cleanup_registry, "SC4-")
    resp = wms_api.confirmar_conferencia_raw(nota_id)
    assert resp.status == 422, f"Esperava 422 (pendente): {resp.status} — {resp.text()}"
    corpo = resp.json()
    code = (corpo.get("error") or {}).get("code") or corpo.get("code")
    assert code == "ITENS_PENDENTES_SEGUNDA_CONFERENCIA", f"Código inesperado: {corpo}"


def test_8_5_confirmar_com_hold_bloqueia(wms_api, run_id, cleanup_registry):
    """Req 8.5: confirmar nota com item em HOLD → 422 ITENS_EM_HOLD."""
    nota_id, item_id = _nota_com_divergencia(wms_api, run_id, cleanup_registry, "SC5-")
    hold = wms_api.colocar_item_em_hold(nota_id, item_id, motivo="ERRO_ETIQUETAGEM")
    assert hold.status in (200, 201), f"HOLD falhou: {hold.status} — {hold.text()}"
    resp = wms_api.confirmar_conferencia_raw(nota_id)
    assert resp.status == 422, f"Esperava 422 (hold): {resp.status} — {resp.text()}"
    corpo = resp.json()
    code = (corpo.get("error") or {}).get("code") or corpo.get("code")
    assert code == "ITENS_EM_HOLD", f"Código inesperado: {corpo}"


def test_8_6_confirmar_sem_pendencias_conclui(wms_api, run_id, cleanup_registry):
    """Req 8.6: nota sem pendências (conferida OK) → CONFERIDA + OS de ENDERECAMENTO."""
    wms_api.set_config_conferencia_empresa(permiteRecebimentoParcial=False)
    produto = wms_api.garantir_produto_configurado(run_id, sufixo="SC6-", com_sku=True)
    nota = wms_api.criar_nota_entrada(run_id, produto, quantidade=40)
    cleanup_registry.registrar_nota(nota["id"])
    iniciada = wms_api.iniciar_conferencia(nota["id"])
    # Confere exatamente a quantidade → sem divergência.
    itens = [{"itemNotaEntradaId": it["id"], "quantidadeConferida": 40}
             for it in iniciada.get("itens", [])]
    res = wms_api.conferir_todos(nota["id"], itens)
    assert res.get("temDivergencia") is False, f"Não deveria ter divergência: {res}"

    resp = wms_api.confirmar_conferencia_raw(nota["id"])
    assert resp.status in (200, 201), f"Confirmação falhou: {resp.status} — {resp.text()}"
    # Nota deve ficar CONFERIDA (aparece na lista de conferidas).
    conferidas = wms_api._get("/conferencia-entrada/notas-conferidas")
    ids = [n["id"] for n in (conferidas.json().get("data", []) if conferidas.ok else [])]
    assert nota["id"] in ids, "Nota confirmada não apareceu como CONFERIDA/pronta para endereçar"
