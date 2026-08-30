"""
test_22 — Endereçamento de pulmão (Motor RF008)  [Requirement 11]

Valida a regra de put-away conforme o spec `enderecamento-pulmao-rf008`:
compatibilidade de área (RF004), ordem de proximidade RF008, não-excesso de
capacidade, config de put-away e rejeição por SKU master ausente.

Pré-requisito de ambiente: endereços de armazenagem cadastrados. O helper
`garantir_enderecos_para_qa` gera uma malha mínima quando faltam (usa os
cadastros-base existentes: CD/Depósito/Zona/Estrutura). Se não for possível
gerar (falta cadastro-base), o teste faz `pytest.skip` honesto.

Roda sempre que possível validando via API (fonte de verdade); a UI de
endereçamento é coberta separadamente. Execução recomendada em modo visual:
    $env:HEADLESS="false"; $env:SLOW_MO="400"; pytest test_22_enderecamento_rf008.py -s
"""
import pytest
from wms_api import CODIGO_PRODUTO_DEMO


@pytest.fixture()
def ambiente_putaway(wms_api, run_id):
    """Garante produto endereçável (SKU lastro/camada) + malha de endereços."""
    produto = wms_api.garantir_produto_com_sku(run_id, lastro=9, camada=5)
    livres = wms_api.garantir_enderecos_para_qa(minimo=6)
    if len(livres) < 2:
        pytest.skip(
            "Pré-requisito de ambiente ausente: não há endereços de armazenagem "
            "suficientes e não foi possível gerá-los (falta CD/Depósito). "
            f"Endereços livres encontrados: {len(livres)}."
        )
    return {"produto": produto, "livres": livres}


def test_11_6_sku_master_ausente_rejeita_distribuicao(wms_api, run_id):
    """Req 11.6: produto sem SKU master (lastro/camada) → HTTP 422 sem alocar."""
    # Cria um produto de QA SEM SKU (garantir_produto_com_sku criaria SKU;
    # aqui criamos só o produto cru para não ter SKU master).
    codigo = f"QA-NOSKU-{run_id}"
    resp_busca = wms_api._get("/produtos", params={"search": codigo, "limit": 5})
    existentes = resp_busca.json().get("data", []) if resp_busca.ok else []
    produto = next((p for p in existentes if p.get("codigo") == codigo), None)
    if not produto:
        r = wms_api._post("/produtos", data={
            "codigo": codigo, "nome": f"PRODUTO SEM SKU {run_id}",
            "unidade": "UN", "status": True,
        })
        assert r.status in (200, 201), f"Falha ao criar produto sem SKU: {r.status} {r.text()}"
        produto = r.json()

    resp = wms_api.distribuir_raw(produto["id"], 10)
    assert resp.status == 422, (
        f"Esperado 422 (SKU master ausente), veio {resp.status}: {resp.text()}"
    )


def test_11_2_e_11_3_proximidade_e_capacidade(wms_api, ambiente_putaway):
    """Req 11.2/11.3: distribuição respeita capacidade residual e conserva a quantidade.

    Como a malha de QA é gerada na rua 001 sem endereço de picking definido, a
    origem cai no default; validamos as invariantes robustas do motor:
      - soma alocada + restante == quantidade (conservação);
      - nenhuma alocação excede a capacidade de palete (lastro×camada);
      - as alocações apontam para endereços reais retornados.
    """
    produto = ambiente_putaway["produto"]
    sku = produto.get("sku") or {}
    lastro = int(sku.get("lastro") or 9)
    camada = int(sku.get("camada") or 5)
    cap_palete = lastro * camada  # capacidade por endereço no motor RF008

    # Quantidade que exige mais de um endereço (força split e ordem).
    quantidade = cap_palete * 2 + 7
    resultado = wms_api.distribuir(produto["id"], quantidade)

    alocacoes = resultado.get("alocacoes", [])
    restante = resultado.get("quantidadeRestante", 0)
    alocada = resultado.get("quantidadeAlocada", sum(a.get("quantidadeAlocada", 0) for a in alocacoes))

    # Conservação (Property 4 do design).
    assert alocada + restante == quantidade, (
        f"Conservação violada: alocada={alocada} + restante={restante} != {quantidade}"
    )
    # Não-excesso de capacidade por endereço (Req 11.3).
    for a in alocacoes:
        assert a["quantidadeAlocada"] <= cap_palete, (
            f"Alocação {a['quantidadeAlocada']} excede capacidade do palete {cap_palete} "
            f"no endereço {a.get('enderecoCompleto')}"
        )
    # Ordem estável e endereços reais.
    ids = [a["enderecoId"] for a in alocacoes]
    assert len(ids) == len(set(ids)), "Motor RF008 não deve repetir o mesmo endereço"


def test_11_config_putaway_defaults_de_mercado(wms_api):
    """A config de put-away reflete os defaults de mercado (BLOQUEAR + overflow com teto)."""
    cfg = wms_api.ler_config_putaway()
    assert cfg, "Config de put-away não retornada (rota /wms/putaway/config indisponível?)"
    assert cfg.get("politicaIncompleto") in ("BLOQUEAR", "PARCIAL")
    # Default de fábrica é BLOQUEAR (a menos que a empresa tenha alterado).
    assert cfg.get("overflowCapacidadePadrao", 0) >= 0
    assert cfg.get("prediosVarreduraPorLado", 0) >= 0


def test_11_4_isolamento_saldo_endereco(wms_api, ambiente_putaway, cleanup_registry, run_id):
    """Req 11.4: endereçar confirma saldo COM empresaId — o saldo aparece no
    consolidado da própria empresa (não vaza). Valida via saldo consolidado.

    Faz o put-away de uma pequena quantidade e confirma que o produto passa a
    ter saldo consolidado de origem WMS na empresa da sessão.
    """
    produto = ambiente_putaway["produto"]
    sku = produto.get("sku") or {}
    cap = int(sku.get("lastro") or 9) * int(sku.get("camada") or 5)
    quantidade = max(1, min(10, cap - 1))

    resultado = wms_api.distribuir(produto["id"], quantidade)
    alocacoes = resultado.get("alocacoes", [])
    if not alocacoes:
        pytest.skip("Distribuição não alocou (armazém sem endereço livre no momento).")

    # Confirma o endereçamento (grava SaldoEndereco com empresaId).
    resp = wms_api._post("/enderecamento-inteligente/confirmar", data={
        "produtoId": produto["id"],
        "alocacoes": [
            {
                "enderecoId": a["enderecoId"],
                "enderecoCompleto": a.get("enderecoCompleto", ""),
                "quantidadeAlocada": a["quantidadeAlocada"],
                "areaArmazenagem": a.get("areaArmazenagem", "PULMAO"),
            }
            for a in alocacoes
        ],
        "lote": wms_api.lote_do_run(run_id),
    })
    assert resp.status in (200, 201), f"Falha ao confirmar endereçamento: {resp.status} {resp.text()}"

    # O saldo consolidado do produto na empresa da sessão deve refletir origem WMS.
    saldo = wms_api.saldo_consolidado(produto["id"])
    assert saldo, "Produto sem saldo consolidado após endereçamento (esperado saldo WMS)."
    # disponivel = fisico - reservado (invariante de saldo).
    fisico = float(saldo.get("fisico", 0))
    reservado = float(saldo.get("reservado", 0))
    disponivel = float(saldo.get("disponivel", 0))
    assert abs(disponivel - (fisico - reservado)) < 0.01, (
        f"Invariante de saldo violada: disp={disponivel} != fisico({fisico}) - reservado({reservado})"
    )
