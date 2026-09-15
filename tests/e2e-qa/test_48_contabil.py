"""
TEST SUITE 48 — Contabilidade / Partidas Dobradas (Fase D4)
===========================================================
Valida o registro contábil em partidas dobradas:
- criar contas contábeis (plano de contas);
- lançamento manual balanceado (ok) e desbalanceado (422);
- conta sintética barrada em partida (só analítica lança);
- balancete fecha (Σ débitos = Σ créditos);
- isolamento multi-tenant.

Roda 100% por API com massa sintética.
"""
import time
from datetime import datetime, timezone
import pytest

from wms_api import WmsApiClient


def _uniq() -> str:
    return str(int(time.time() * 1000))[-8:]


def _hoje() -> str:
    return datetime.now(timezone.utc).isoformat()


def _cria_conta(wms_api: WmsApiClient, natureza: str, grupo: str) -> str:
    r = wms_api.criar_conta_contabil({
        "codigo": f"QA.{_uniq()}.{int(time.time()*1000) % 1000}",
        "nome": f"QA Conta {natureza}",
        "natureza": natureza,
        "grupo": grupo,
    })
    assert r.status in (200, 201), f"criar conta ({r.status}: {r.text()})"
    return r.json()["id"]


class TestPlanoDeContas:
    def test_cria_conta_analitica(self, wms_api: WmsApiClient):
        r = wms_api.criar_conta_contabil({
            "codigo": f"QA.A.{_uniq()}",
            "nome": "QA Banco",
            "natureza": "DEVEDORA",
            "grupo": "ATIVO",
        })
        assert r.status in (200, 201), f"({r.status}: {r.text()})"
        assert r.json()["analitica"] is True


class TestLancamentoManual:
    def test_lancamento_balanceado_ok(self, wms_api: WmsApiClient):
        debito = _cria_conta(wms_api, "DEVEDORA", "DESPESA")
        credito = _cria_conta(wms_api, "CREDORA", "PASSIVO")
        r = wms_api.criar_lancamento_contabil({
            "data": _hoje(),
            "historico": f"QA lançamento {_uniq()}",
            "partidas": [
                {"contaId": debito, "tipo": "DEBITO", "valor": 1500.0},
                {"contaId": credito, "tipo": "CREDITO", "valor": 1500.0},
            ],
        })
        assert r.status in (200, 201), f"lançamento balanceado ({r.status}: {r.text()})"

    def test_lancamento_desbalanceado_422(self, wms_api: WmsApiClient):
        debito = _cria_conta(wms_api, "DEVEDORA", "DESPESA")
        credito = _cria_conta(wms_api, "CREDORA", "PASSIVO")
        r = wms_api.criar_lancamento_contabil({
            "data": _hoje(),
            "historico": f"QA desbalanceado {_uniq()}",
            "partidas": [
                {"contaId": debito, "tipo": "DEBITO", "valor": 1500.0},
                {"contaId": credito, "tipo": "CREDITO", "valor": 1000.0},
            ],
        })
        assert r.status == 422, f"desbalanceado deveria dar 422 ({r.status}: {r.text()})"

    def test_conta_sintetica_barrada(self, wms_api: WmsApiClient):
        # cria uma conta pai (fica sintética) e uma filha
        pai = _cria_conta(wms_api, "DEVEDORA", "ATIVO")
        rfilha = wms_api.criar_conta_contabil({
            "codigo": f"QA.F.{_uniq()}",
            "nome": "QA Filha",
            "natureza": "DEVEDORA",
            "grupo": "ATIVO",
            "paiId": pai,
        })
        assert rfilha.status in (200, 201)
        credito = _cria_conta(wms_api, "CREDORA", "PASSIVO")
        # tentar lançar na conta pai (agora sintética) deve dar 422
        r = wms_api.criar_lancamento_contabil({
            "data": _hoje(),
            "historico": f"QA sintetica {_uniq()}",
            "partidas": [
                {"contaId": pai, "tipo": "DEBITO", "valor": 100.0},
                {"contaId": credito, "tipo": "CREDITO", "valor": 100.0},
            ],
        })
        assert r.status == 422, f"conta sintética deveria ser barrada (422), veio {r.status}"


class TestBalancete:
    def test_balancete_fecha(self, wms_api: WmsApiClient):
        debito = _cria_conta(wms_api, "DEVEDORA", "DESPESA")
        credito = _cria_conta(wms_api, "CREDORA", "PASSIVO")
        wms_api.criar_lancamento_contabil({
            "data": _hoje(),
            "historico": f"QA balancete {_uniq()}",
            "partidas": [
                {"contaId": debito, "tipo": "DEBITO", "valor": 2000.0},
                {"contaId": credito, "tipo": "CREDITO", "valor": 2000.0},
            ],
        })
        r = wms_api.balancete()
        assert r.status == 200, f"balancete ({r.status}: {r.text()})"
        assert r.json()["fecha"] is True


class TestIsolamentoContabil:
    def test_conta_nao_vaza_entre_empresas(self, wms_api: WmsApiClient):
        token2, _emp2 = wms_api.token_de_outra_empresa()
        if not token2:
            pytest.skip("Usuário tem apenas uma empresa — isolamento não testável.")
        codigo = f"QA-CT-ISO-{_uniq()}"
        wms_api.criar_conta_contabil({
            "codigo": codigo, "nome": "QA Iso", "natureza": "DEVEDORA", "grupo": "ATIVO",
        })
        r2 = wms_api.get_com_token("/financeiro/contabil/contas", token2)
        assert r2.status == 200, f"listar contas como outra empresa ({r2.status})"
        codigos = {c.get("codigo") for c in wms_api._lista_do_corpo(r2.json())}
        assert codigo not in codigos, "conta contábil vazou para outra empresa!"
