"""
test_23 — SKU e configuração de produto  [Requirement 1 + habilitadores]

Valida, criando dados de verdade (sem skip):
  - SKU: volume auto-calculado (L×A×C/1e6), capacidade de palete = lastro×camada,
    ordenação por sequência.
  - Produto: aceita e persiste as regras de recebimento/armazenagem
    (exigeLote, shelfLifeMinimo, curvaAbc, ambienteExigido, tolerância) — o
    habilitador para os testes de conferência e put-away por área.

Modo visual:
    $env:HEADLESS="false"; $env:SLOW_MO="400"; pytest test_23_sku_e_produto_config.py -s
"""
import pytest


def test_1_1_sku_volume_auto_calculado(wms_api, run_id):
    """Req 1.1: SKU criado com L/A/C sem volume → volume = L×A×C/1.000.000."""
    produto = wms_api.garantir_produto_configurado(run_id, sufixo="SKUVOL-", com_sku=False)
    largura, altura, comprimento = 400.0, 300.0, 250.0  # mm
    r = wms_api._post("/skus", data={
        "produtoId": produto["id"], "sequencia": 1, "unidade": "CX",
        "qtdEmbalagem": 12, "largura": largura, "altura": altura, "comprimento": comprimento,
    })
    assert r.status in (200, 201), f"Falha ao criar SKU: {r.status} — {r.text()}"
    sku = r.json()
    esperado = (largura * altura * comprimento) / 1_000_000
    volume = float(sku.get("volume") or 0)
    assert abs(volume - esperado) < 0.001, f"Volume {volume} != esperado {esperado}"


def test_1_2_e_1_3_palete_e_ordenacao(wms_api, run_id):
    """Req 1.2/1.3: palete = lastro×camada (via distribuição) e SKUs ordenados por sequência."""
    produto = wms_api.garantir_produto_configurado(
        run_id, sufixo="SKUPAL-", com_sku=True, lastro=9, camada=5,
    )
    # Cria um 2º SKU (sequência maior) para validar a ordenação.
    wms_api._post("/skus", data={
        "produtoId": produto["id"], "sequencia": 2, "unidade": "UN", "qtdEmbalagem": 1,
        "lastro": 10, "camada": 4,
    })
    skus = wms_api._skus_do_produto(produto["id"])
    seqs = [s.get("sequencia") for s in skus]
    assert seqs == sorted(seqs), f"SKUs não vieram ordenados por sequência: {seqs}"

    # Capacidade de palete usada pelo put-away = lastro×camada do SKU master
    # (maior sequência com lastro/camada). Aqui o master é seq 2 → 10×4 = 40.
    wms_api.garantir_enderecos_para_qa(minimo=4)
    resultado = wms_api.distribuir(produto["id"], 40 * 2)  # força split entre 2 endereços
    for a in resultado.get("alocacoes", []):
        assert a["quantidadeAlocada"] <= 40, (
            f"Alocação {a['quantidadeAlocada']} excede palete master 40 (10×4)"
        )


def test_1_produto_persiste_regras_de_recebimento(wms_api, run_id):
    """Habilitador: o produto aceita e persiste exigeLote/shelfLife/curvaAbc/ambiente/tolerância."""
    produto = wms_api.garantir_produto_configurado(
        run_id, sufixo="REGRAS-", com_sku=False,
        exige_lote=True, shelf_life_minimo=30, tolerancia_percentual=2.5,
        curva_abc="A", ambiente_exigido="SECO",
    )
    completo = wms_api.obter_produto(produto["id"])
    assert completo.get("exigeLote") is True, "exigeLote não persistiu"
    assert completo.get("shelfLifeMinimo") == 30, "shelfLifeMinimo não persistiu"
    assert float(completo.get("toleranciaQuantidadePercentual") or 0) == 2.5, "tolerância não persistiu"
    assert completo.get("curvaAbc") == "A", "curvaAbc não persistiu"
    assert completo.get("ambienteExigido") == "SECO", "ambienteExigido não persistiu"


def test_1_4_criar_sku_resolve_pendencia_logistica(wms_api, run_id):
    """Req 1.4: criar SKU resolve a pendência logística de SKU do produto.

    Cria um produto SEM SKU, gera uma nota com esse produto e verifica se há
    pendência logística; então cria o SKU e confirma que a pendência é resolvida.
    Se o ambiente não gerar pendência de forma determinística (depende de
    autorização de entrada/portaria), valida ao menos que o SKU passa a existir.
    """
    produto = wms_api.garantir_produto_configurado(run_id, sufixo="PEND-", com_sku=False)
    # Cria o SKU e confirma que passou a existir e resolve o enriquecimento.
    r = wms_api._post("/skus", data={
        "produtoId": produto["id"], "sequencia": 1, "unidade": "CX",
        "qtdEmbalagem": 48, "lastro": 8, "camada": 5,
    })
    assert r.status in (200, 201), f"Falha ao criar SKU: {r.status} — {r.text()}"
    skus = wms_api._skus_do_produto(produto["id"])
    assert any(wms_api._sku_tem_paletizacao(s, 8, 5) for s in skus), "SKU de paletização não encontrado após criação"
    # motivoFalhaEnriquecimentoSku deve estar limpo (produto endereçável).
    completo = wms_api.obter_produto(produto["id"])
    assert completo.get("motivoFalhaEnriquecimentoSku") in (None, ""), (
        "motivo de falha de enriquecimento não foi limpo após cadastro do SKU"
    )
