"""
TEST SUITE 49 — Baixa Profissional de Títulos (Liquidação)
==========================================================
Valida a baixa enriquecida de contas a pagar:
- baixa com juros/multa/desconto → valor líquido correto persistido;
- baixa com desconto excessivo barrada (422, líquido negativo);
- estorno limpa os componentes e volta o título a ABERTA;
- isolamento multi-tenant.

Roda 100% por API com massa sintética. Reusa os helpers de inclusão (D1).
"""
import time
from datetime import datetime, timedelta, timezone
import pytest

from wms_api import WmsApiClient


def _uniq() -> str:
    return str(int(time.time() * 1000))[-8:]


def _iso(dias: int = 15) -> str:
    return (datetime.now(timezone.utc) + timedelta(days=dias)).isoformat()


def _cria_titulo_pagar(wms_api: WmsApiClient, valor: float) -> str:
    r = wms_api.incluir_documento_pagar({
        "descricao": f"QA Baixa {_uniq()}",
        "valor": valor,
        "dataVencimento": _iso(15),
        "tipoDocumento": "DESPESA",
        "parceiroNomeLivre": "Fornecedor Baixa QA",
    })
    assert r.status in (200, 201), f"criar título ({r.status}: {r.text()})"
    # a listagem traz o id; buscamos o mais recente com a descrição não é trivial,
    # então listamos abertos e pegamos por descrição única
    lst = wms_api._get("/contas-pagar", {"status": "ABERTA", "limit": 50})
    assert lst.status == 200
    itens = lst.json().get("data", [])
    alvo = next((i for i in itens if i["descricao"].startswith("QA Baixa")), None)
    assert alvo, "título recém-criado não encontrado na listagem"
    return alvo["id"]


class TestBaixaComAjustes:
    def test_baixa_com_juros_multa_desconto(self, wms_api: WmsApiClient):
        tid = _cria_titulo_pagar(wms_api, 1000.0)
        r = wms_api.pagar_titulo(tid, {
            "valorPago": 1000.0,
            "formaPagamento": "PIX",
            "dataPagamento": _iso(0),
            "juros": 50.0,
            "multa": 30.0,
            "desconto": 20.0,
            "tarifa": 5.0,
        })
        assert r.status in (200, 201), f"baixa ({r.status}: {r.text()})"
        # líquido pagar = 1000 + 50 + 30 - 20 + 5 = 1065
        detalhe = wms_api.obter_conta_pagar(tid).json()
        assert float(detalhe["valorPago"]) == 1065.0, f"líquido esperado 1065, veio {detalhe.get('valorPago')}"
        assert detalhe["status"] in ("PAGA",)

    def test_desconto_excessivo_barrado(self, wms_api: WmsApiClient):
        tid = _cria_titulo_pagar(wms_api, 100.0)
        r = wms_api.pagar_titulo(tid, {
            "valorPago": 100.0,
            "formaPagamento": "PIX",
            "desconto": 500.0,  # maior que o valor → líquido negativo
        })
        assert r.status == 422, f"desconto excessivo deveria dar 422 ({r.status}: {r.text()})"


class TestEstorno:
    def test_estorno_limpa_componentes(self, wms_api: WmsApiClient):
        tid = _cria_titulo_pagar(wms_api, 800.0)
        wms_api.pagar_titulo(tid, {"valorPago": 800.0, "formaPagamento": "PIX", "juros": 40.0})
        r = wms_api.estornar_pagar(tid)
        assert r.status in (200, 201), f"estorno ({r.status}: {r.text()})"
        detalhe = wms_api.obter_conta_pagar(tid).json()
        assert detalhe["status"] == "ABERTA"
        assert detalhe.get("valorPago") in (None, 0)
        assert detalhe.get("jurosBaixa") in (None, 0)


class TestIsolamentoBaixa:
    def test_titulo_de_outra_empresa_nao_baixavel(self, wms_api: WmsApiClient):
        token2, _emp2 = wms_api.token_de_outra_empresa()
        if not token2:
            pytest.skip("Usuário tem apenas uma empresa — isolamento não testável.")
        tid = _cria_titulo_pagar(wms_api, 300.0)
        # tenta pagar o título da empresa atual usando o token da outra empresa
        r2 = wms_api._request.patch(
            wms_api._url(f"/contas-pagar/{tid}/pagar"),
            headers={"Authorization": f"Bearer {token2}", "Content-Type": "application/json"},
            data={"valorPago": 300.0, "formaPagamento": "PIX"},
        )
        assert r2.status in (403, 404), f"baixa cross-empresa deveria falhar (403/404), veio {r2.status}"
