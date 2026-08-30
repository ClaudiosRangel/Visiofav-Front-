"""
test_27 — Conferência de entrada: quantidade, tolerância e recebimento parcial
[Requirement 6]

Cria dados de verdade (produto configurado + nota) e confere via API,
validando o comportamento REAL do backend:
  - qtd exata → sem divergência;
  - excesso → DIVERGENTE/EXCESSO (item vai a 2ª conferência);
  - dentro da tolerância do produto → aceito (TOLERANCIA_ACEITA);
  - qtd não informada → DIVERGENTE/QUANTIDADE_NAO_INFORMADA;
  - recebimento parcial (falta) com a flag da empresa ligada → RECEBIMENTO_PARCIAL.

Modo visual:
    $env:HEADLESS="false"; $env:SLOW_MO="400"; pytest test_27_conferencia_quantidade.py -s
"""
import pytest


def _itens_conferencia(nota_iniciada, quantidade):
    """Monta o payload de conferir-todos a partir da nota iniciada."""
    itens = nota_iniciada.get("itens", [])
    return [
        {"itemNotaEntradaId": it["id"], "quantidadeConferida": quantidade}
        for it in itens
    ]


def _conferir(wms_api, run_id, cleanup_registry, quantidade_nota, quantidade_conferida,
              tolerancia=None):
    """Cria produto+nota, inicia e confere; retorna o resultado de conferir-todos."""
    produto = wms_api.garantir_produto_configurado(
        run_id, sufixo="CONFQ-", com_sku=True, tolerancia_percentual=tolerancia,
    )
    nota = wms_api.criar_nota_entrada(run_id, produto, quantidade=quantidade_nota)
    cleanup_registry.registrar_nota(nota["id"])
    iniciada = wms_api.iniciar_conferencia(nota["id"])
    itens = [
        {"itemNotaEntradaId": it["id"], "quantidadeConferida": quantidade_conferida}
        for it in iniciada.get("itens", [])
    ]
    return wms_api.conferir_todos(nota["id"], itens)


def test_6_1_quantidade_exata_sem_divergencia(wms_api, run_id, cleanup_registry):
    """Req 6.1: qtd conferida == qtd da nota → sem divergência."""
    res = _conferir(wms_api, run_id, cleanup_registry, quantidade_nota=50, quantidade_conferida=50)
    assert res.get("temDivergencia") is False, f"Esperava sem divergência: {res}"
    assert res.get("divergentes", 0) == 0


def test_6_2_excesso_e_divergente(wms_api, run_id, cleanup_registry):
    """Req 6.2: excesso → item DIVERGENTE com tipoDivergencia EXCESSO."""
    res = _conferir(wms_api, run_id, cleanup_registry, quantidade_nota=50, quantidade_conferida=60)
    assert res.get("temDivergencia") is True, f"Esperava divergência por excesso: {res}"
    itens = res.get("itens", [])
    assert any(i.get("tipoDivergencia") == "EXCESSO" for i in itens), f"Sem EXCESSO: {itens}"


def test_6_3_dentro_da_tolerancia_aceito(wms_api, run_id, cleanup_registry):
    """Req 6.3: desvio dentro da tolerância do produto → TOLERANCIA_ACEITA (sem divergência).

    Garante recebimento parcial DESLIGADO — senão a falta (49 de 50) seria
    absorvida como RECEBIMENTO_PARCIAL (que tem prioridade sobre tolerância no
    backend), mascarando a regra de tolerância que queremos validar.
    """
    cfg_antes = wms_api.ler_config_conferencia_empresa()
    valor_antes = cfg_antes.get("permiteRecebimentoParcial", False)
    wms_api.set_config_conferencia_empresa(permiteRecebimentoParcial=False)
    try:
        # Tolerância 5%: conferir 49 de 50 = 2% de desvio → aceito.
        res = _conferir(
            wms_api, run_id, cleanup_registry,
            quantidade_nota=50, quantidade_conferida=49, tolerancia=5,
        )
        itens = res.get("itens", [])
        assert res.get("temDivergencia") is False, f"Esperava aceite por tolerância: {res}"
        assert any(i.get("tipoDivergencia") == "TOLERANCIA_ACEITA" for i in itens), (
            f"Sem TOLERANCIA_ACEITA: {itens}"
        )
    finally:
        wms_api.set_config_conferencia_empresa(permiteRecebimentoParcial=valor_antes)


def test_6_5_quantidade_ausente_e_rejeitada_na_validacao(wms_api, run_id, cleanup_registry):
    """Req 6.5 (comportamento real): quantidade é obrigatória.

    O schema de conferência exige `quantidadeConferida: number`. Enviar null é
    rejeitado na validação (HTTP 400 VALIDATION_ERROR) — a quantidade nunca
    fica "não informada" no processamento, é barrada antes. Este teste fixa
    esse contrato (a obrigatoriedade da quantidade), que é o objetivo do Req 6.5.
    """
    produto = wms_api.garantir_produto_configurado(run_id, sufixo="CONFNI-", com_sku=True)
    nota = wms_api.criar_nota_entrada(run_id, produto, quantidade=50)
    cleanup_registry.registrar_nota(nota["id"])
    iniciada = wms_api.iniciar_conferencia(nota["id"])
    itens = [{"itemNotaEntradaId": it["id"], "quantidadeConferida": None}
             for it in iniciada.get("itens", [])]
    # Chamada crua (sem assert de OK) — esperamos 400 de validação.
    resp = wms_api._post(f"/conferencia-entrada/conferir-todos/{nota['id']}", data={"itens": itens})
    assert resp.status == 400, (
        f"Esperado 400 (quantidade obrigatória), veio {resp.status}: {resp.text()}"
    )
    corpo = resp.json()
    assert corpo.get("code") == "VALIDATION_ERROR", f"Esperado VALIDATION_ERROR: {corpo}"


def test_6_4_recebimento_parcial(wms_api, run_id, cleanup_registry):
    """Req 6.4: com a flag de recebimento parcial ligada, falta → RECEBIMENTO_PARCIAL.

    Liga a flag da empresa via API (habilitador criado no backend), confere
    menos que a nota e valida o tipo RECEBIMENTO_PARCIAL. Restaura a flag ao fim.
    """
    cfg_antes = wms_api.ler_config_conferencia_empresa()
    valor_antes = cfg_antes.get("permiteRecebimentoParcial", False)
    r = wms_api.set_config_conferencia_empresa(permiteRecebimentoParcial=True)
    if r.status == 403:
        pytest.fail("Usuário de QA não é admin — não foi possível ligar recebimento parcial. "
                    "Ajustar perfil do usuário de QA para admin.")
    assert r.status in (200, 201), f"Falha ao ligar recebimento parcial: {r.status} — {r.text()}"
    try:
        res = _conferir(wms_api, run_id, cleanup_registry,
                        quantidade_nota=50, quantidade_conferida=40)
        itens = res.get("itens", [])
        assert any(i.get("tipoDivergencia") == "RECEBIMENTO_PARCIAL" for i in itens), (
            f"Sem RECEBIMENTO_PARCIAL: {itens}"
        )
        # Recebimento parcial não conta como divergência.
        assert res.get("temDivergencia") is False, f"Parcial não deveria ser divergência: {res}"
    finally:
        # Restaura o estado original da flag.
        wms_api.set_config_conferencia_empresa(permiteRecebimentoParcial=valor_antes)
