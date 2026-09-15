"""
TEST SUITE 43 — Financeiro Operacional (Onda 1)
================================================
Valida o fluxo completo do módulo Financeiro (spec
`financeiro-operacional-completo`): contas a pagar/receber (criar, baixar,
editar, cancelar, estornar, baixa em lote), contas bancárias, lançamentos de
caixa, conciliação (OFX), dashboard, extrato, relatórios e isolamento
multi-tenant.

Os títulos são criados via as rotas de criação manual (não dependem de
efetivação fiscal/SEFAZ), então a suíte roda 100% por API.
"""
import time
import pytest

from wms_api import WmsApiClient


def _uniq() -> str:
    return str(int(time.time() * 1000))[-8:]


class TestFinanceiroEstrutura:
    def test_dashboard_responde(self, wms_api: WmsApiClient):
        r = wms_api.dashboard_financeiro()
        assert r.status == 200, f"/financeiro/dashboard 200 esperado ({r.status}: {r.text()})"
        body = r.json()
        assert "saldoTotal" in body and "receber" in body and "pagar" in body

    def test_listagens_respondem(self, wms_api: WmsApiClient):
        for chamada, nome in [
            (wms_api.listar_contas_receber, "contas-receber"),
            (wms_api.listar_contas_pagar, "contas-pagar"),
            (wms_api.listar_contas_financeiras, "contas financeiras"),
            (wms_api.listar_categorias_financeiras, "categorias"),
            (wms_api.relatorio_inadimplencia, "inadimplência"),
        ]:
            r = chamada()
            assert r.status == 200, f"{nome} deveria responder 200 ({r.status})"


class TestContasReceber:
    def test_ciclo_receber(self, wms_api: WmsApiClient):
        """Criar → receber → estornar → cancelar."""
        r = wms_api.criar_conta_receber(f"QA Receber {_uniq()}", 150.0)
        assert r.status in (200, 201), f"criar receber ({r.status}: {r.text()})"
        cid = r.json()["id"]

        # baixa individual
        rb = wms_api.receber_conta(cid, 150.0, "PIX")
        assert rb.status == 200, f"receber ({rb.status}: {rb.text()})"
        assert rb.json()["status"] == "RECEBIDA"

        # estorno volta para ABERTA
        re = wms_api.estornar_conta_receber(cid)
        assert re.status == 200, f"estornar ({re.status}: {re.text()})"
        assert re.json()["status"] == "ABERTA"

        # cancelar título aberto
        rc = wms_api.cancelar_conta_receber(cid)
        assert rc.status == 200, f"cancelar ({rc.status}: {rc.text()})"
        assert rc.json()["status"] == "CANCELADA"

    def test_editar_so_em_aberto(self, wms_api: WmsApiClient):
        r = wms_api.criar_conta_receber(f"QA Editar {_uniq()}", 100.0)
        cid = r.json()["id"]
        # editar aberto → ok
        re = wms_api.editar_conta_receber(cid, {"valor": 200.0})
        assert re.status == 200, f"editar aberto ({re.status}: {re.text()})"
        # baixar e tentar editar → 409
        wms_api.receber_conta(cid, 200.0, "PIX")
        re2 = wms_api.editar_conta_receber(cid, {"valor": 300.0})
        assert re2.status == 409, f"editar título baixado deveria dar 409 ({re2.status})"

    def test_baixa_em_lote_particiona(self, wms_api: WmsApiClient):
        ids = []
        for i in range(3):
            r = wms_api.criar_conta_receber(f"QA Lote {_uniq()}-{i}", 50.0 + i)
            ids.append(r.json()["id"])
        # baixa um deles antes, para virar "ignorado" no lote
        wms_api.receber_conta(ids[0], 50.0, "PIX")

        rl = wms_api.baixar_lote_receber(ids + ["00000000-0000-0000-0000-000000000000"], "PIX")
        assert rl.status == 200, f"baixar-lote ({rl.status}: {rl.text()})"
        res = rl.json()
        todos = set(res["sucesso"]) | {i["id"] for i in res["ignorados"]}
        # todo id enviado aparece em exatamente um dos dois grupos
        assert ids[0] in {i["id"] for i in res["ignorados"]}, "título já baixado deveria ser ignorado"
        assert ids[1] in res["sucesso"] and ids[2] in res["sucesso"]
        assert len(res["sucesso"]) + len(res["ignorados"]) == 4


class TestContasPagar:
    def test_ciclo_pagar(self, wms_api: WmsApiClient):
        r = wms_api.criar_conta_pagar(f"QA Pagar {_uniq()}", 80.0)
        assert r.status in (200, 201), f"criar pagar ({r.status}: {r.text()})"
        cid = r.json()["id"]
        rp = wms_api.pagar_conta(cid, 80.0, "BOLETO")
        assert rp.status == 200 and rp.json()["status"] == "PAGA"
        re = wms_api.estornar_conta_pagar(cid)
        assert re.status == 200 and re.json()["status"] == "ABERTA"


class TestContasBancariasELancamentos:
    def test_conta_bancaria_lancamento_extrato(self, wms_api: WmsApiClient):
        rc = wms_api.criar_conta_financeira(f"QA Banco {_uniq()}", "BANCO", 1000.0)
        assert rc.status in (200, 201), f"criar conta financeira ({rc.status}: {rc.text()})"
        conta_id = rc.json()["id"]

        # lançamento de entrada
        rl = wms_api.criar_lancamento_caixa(conta_id, "ENTRADA", 250.0, "QA entrada")
        assert rl.status in (200, 201), f"lançamento ({rl.status}: {rl.text()})"

        # extrato reflete saldo
        from datetime import datetime, timedelta, timezone
        de = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
        ate = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
        rex = wms_api.extrato_conta(conta_id, de, ate)
        assert rex.status == 200, f"extrato ({rex.status}: {rex.text()})"
        body = rex.json()
        assert body["saldoInicial"] == 1000.0
        assert len(body["linhas"]) >= 1
        assert body["saldoFinal"] == 1250.0

    def test_transferencia_entre_contas(self, wms_api: WmsApiClient):
        c1 = wms_api.criar_conta_financeira(f"QA Origem {_uniq()}", "BANCO", 500.0).json()["id"]
        c2 = wms_api.criar_conta_financeira(f"QA Destino {_uniq()}", "BANCO", 0.0).json()["id"]
        rt = wms_api.transferir_entre_contas(c1, c2, 200.0)
        assert rt.status in (200, 201), f"transferência ({rt.status}: {rt.text()})"


class TestConciliacao:
    def test_importar_ofx(self, wms_api: WmsApiClient):
        conta_id = wms_api.criar_conta_financeira(f"QA OFX {_uniq()}", "BANCO", 0.0).json()["id"]
        ofx = (
            "OFXHEADER:100\n<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>"
            f"<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260610<TRNAMT>100.00<FITID>QA{_uniq()}<MEMO>Deposito QA</STMTTRN>"
            "</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>"
        )
        r = wms_api.importar_ofx(conta_id, ofx)
        assert r.status in (200, 201), f"importar OFX ({r.status}: {r.text()})"
        body = r.json()
        assert body["importadas"] >= 1
        # reimportar o mesmo OFX é idempotente (nada novo)
        r2 = wms_api.importar_ofx(conta_id, ofx)
        assert r2.json()["importadas"] == 0 and r2.json()["ignoradas"] >= 1


class TestIsolamento:
    def test_titulo_nao_vaza_para_outra_empresa(self, wms_api: WmsApiClient):
        """Título criado numa empresa não aparece na listagem de outra."""
        token2, emp2 = wms_api.token_de_outra_empresa()
        if not token2:
            pytest.skip("Usuário tem apenas uma empresa — isolamento não testável.")
        marcador = f"QA-ISO-{_uniq()}"
        wms_api.criar_conta_receber(marcador, 999.0)
        # lista como a outra empresa
        r2 = wms_api.get_com_token("/contas-receber", token2, params={"limit": 100})
        assert r2.status == 200
        itens = wms_api._lista_do_corpo(r2.json())
        assert not any(i.get("descricao") == marcador for i in itens), "título vazou para outra empresa!"
