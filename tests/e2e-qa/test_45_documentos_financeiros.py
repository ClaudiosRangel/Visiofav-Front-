"""
TEST SUITE 45 — Documentos Financeiros (Fase D1)
=================================================
Valida o lançamento profissional de documentos: tipagem, fornecedor PF/PJ
(parceiro livre com validação de CPF/CNPJ), parcelamento (N títulos), contrato
de parcelamento (saldo devedor) e isolamento multi-tenant.
Roda 100% por API com massa sintética.
"""
import time
from datetime import datetime, timedelta, timezone
import pytest

from wms_api import WmsApiClient


def _uniq() -> str:
    return str(int(time.time() * 1000))[-8:]


def _iso(dias: int = 30) -> str:
    return (datetime.now(timezone.utc) + timedelta(days=dias)).isoformat()


class TestInclusaoTipada:
    def test_documento_tipado_parceiro_livre(self, wms_api: WmsApiClient):
        r = wms_api.incluir_documento_pagar({
            "descricao": f"QA Despesa {_uniq()}",
            "valor": 500.0,
            "dataVencimento": _iso(15),
            "tipoDocumento": "DESPESA",
            "parceiroNomeLivre": "Prestador Autônomo",
            "parceiroDocLivre": "529.982.247-25",  # CPF válido (PF)
        })
        assert r.status in (200, 201), f"incluir ({r.status}: {r.text()})"
        assert r.json()["criadas"] == 1

    def test_rejeita_cpf_invalido(self, wms_api: WmsApiClient):
        r = wms_api.incluir_documento_pagar({
            "descricao": f"QA Invalido {_uniq()}",
            "valor": 100.0,
            "dataVencimento": _iso(10),
            "parceiroNomeLivre": "Fulano",
            "parceiroDocLivre": "111.111.111-11",  # inválido
        })
        assert r.status == 422, f"CPF inválido deveria dar 422 ({r.status})"

    def test_parcelamento_gera_n_titulos(self, wms_api: WmsApiClient):
        r = wms_api.incluir_documento_pagar({
            "descricao": f"QA Parcelado {_uniq()}",
            "valor": 1200.0,
            "dataVencimento": _iso(30),
            "tipoDocumento": "FINANCIAMENTO",
            "parcelas": 12,
        })
        assert r.status in (200, 201)
        assert r.json()["criadas"] == 12 and r.json()["parcelas"] == 12


class TestInterpretarBoleto:
    def test_boleto_invalido_422(self, wms_api: WmsApiClient):
        r = wms_api.interpretar_boleto("123")
        assert r.status == 422, "linha digitável curta deveria dar 422"


class TestContrato:
    def test_contrato_gera_parcelas_e_saldo(self, wms_api: WmsApiClient):
        r = wms_api.criar_contrato({
            "descricao": f"QA Financiamento {_uniq()}",
            "tipo": "FINANCIAMENTO",
            "valorTotal": 12000.0,
            "entrada": 2000.0,
            "numeroParcelas": 10,
            "dataPrimeira": _iso(30),
        })
        assert r.status in (200, 201), f"criar contrato ({r.status}: {r.text()})"
        contrato_id = r.json()["id"]

        d = wms_api.detalhe_contrato(contrato_id)
        assert d.status == 200, f"detalhe ({d.status}: {d.text()})"
        body = d.json()
        # 10 parcelas geradas, saldo devedor = total(12000) - entrada(2000) - pago(0) = 10000
        assert len(body["parcelas"]) == 10
        assert body["saldoDevedor"] == 10000.0
        # soma das parcelas == valor parcelado (10000)
        soma = sum(p["valor"] for p in body["parcelas"])
        assert abs(soma - 10000.0) <= 0.01, f"soma das parcelas {soma} != 10000"


class TestIsolamento:
    def test_contrato_nao_vaza(self, wms_api: WmsApiClient):
        token2, emp2 = wms_api.token_de_outra_empresa()
        if not token2:
            pytest.skip("Usuário tem apenas uma empresa — isolamento não testável.")
        marcador = f"QA-CT-ISO-{_uniq()}"
        wms_api.criar_contrato({"descricao": marcador, "tipo": "OUTRO", "valorTotal": 999.0, "numeroParcelas": 3, "dataPrimeira": _iso(30)})
        r2 = wms_api.get_com_token("/financeiro/contratos", token2)
        assert r2.status == 200
        descricoes = {c.get("descricao") for c in wms_api._lista_do_corpo(r2.json())}
        assert marcador not in descricoes, "contrato vazou para outra empresa!"
