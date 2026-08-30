"""
test_24 — Dados Logísticos (armazenagem, picking, expedição)  [Requirement 2]

Valida criando dados de verdade (sem skip):
  - armazenagem sem tipoNorma → default FEFO;
  - tipoNorma inválido → rejeitado (400);
  - os três sub-cadastros (armazenagem/picking/expedição) são consultáveis por
    produtoId de forma independente.

Modo visual:
    $env:HEADLESS="false"; $env:SLOW_MO="400"; pytest test_24_dados_logisticos.py -s
"""
import pytest


@pytest.fixture()
def produto(wms_api, run_id):
    return wms_api.garantir_produto_configurado(run_id, sufixo="DLOG-", com_sku=True)


def test_2_1_armazenagem_default_fefo(wms_api, produto):
    """Req 2.1: dados de armazenagem sem tipoNorma → persistido FEFO."""
    r = wms_api._post("/dados-logisticos/armazenagem", data={
        "produtoId": produto["id"], "skuSeq": 1, "sequencia": 1,
    })
    assert r.status in (200, 201), f"Falha ao criar dados de armazenagem: {r.status} — {r.text()}"
    item = r.json()
    assert item.get("tipoNorma") == "FEFO", f"Esperado FEFO por default, veio {item.get('tipoNorma')}"


def test_2_2_tiponorma_invalido_rejeitado(wms_api, produto):
    """Req 2.2: tipoNorma fora do enum (FEFO|FIFO|LIFO) é rejeitado (400)."""
    r = wms_api._post("/dados-logisticos/armazenagem", data={
        "produtoId": produto["id"], "skuSeq": 1, "sequencia": 2, "tipoNorma": "ALEATORIO",
    })
    assert r.status == 400, f"Esperado 400 para tipoNorma inválido, veio {r.status}: {r.text()}"


def test_2_4_tres_subcadastros_independentes(wms_api, produto):
    """Req 2.4: armazenagem, picking e expedição consultáveis por produtoId."""
    pid = produto["id"]

    # Armazenagem
    ra = wms_api._post("/dados-logisticos/armazenagem", data={
        "produtoId": pid, "skuSeq": 1, "sequencia": 10, "tipoNorma": "FIFO",
    })
    assert ra.status in (200, 201), f"armazenagem: {ra.status} — {ra.text()}"

    # Picking
    rp = wms_api._post("/dados-logisticos/picking", data={
        "produtoId": pid, "skuSeq": 1, "sequencia": 1, "tipoPicking": "NORMAL", "capacidade": 50,
    })
    assert rp.status in (200, 201), f"picking: {rp.status} — {rp.text()}"

    # Expedição
    re = wms_api._post("/dados-logisticos/expedicao", data={
        "produtoId": pid, "skuSeq": 1, "fracionado": True,
    })
    assert re.status in (200, 201), f"expedicao: {re.status} — {re.text()}"

    # Consulta independente
    ga = wms_api._get("/dados-logisticos/armazenagem", params={"produtoId": pid})
    gp = wms_api._get("/dados-logisticos/picking", params={"produtoId": pid})
    ge = wms_api._get("/dados-logisticos/expedicao", params={"produtoId": pid})
    assert ga.ok and gp.ok and ge.ok, "Falha ao consultar sub-cadastros"
    assert len(ga.json().get("data", [])) >= 1, "armazenagem não retornou dados"
    assert len(gp.json().get("data", [])) >= 1, "picking não retornou dados"
    assert len(ge.json().get("data", [])) >= 1, "expedicao não retornou dados"
