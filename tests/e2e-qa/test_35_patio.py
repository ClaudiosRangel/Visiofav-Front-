"""
TEST SUITE 35 — Pátio / Yard Management (módulo /patio)
========================================================
Valida fila, config, KPIs e relatórios do pátio, mais isolamento
(Requirements 4, 11).
"""
import pytest

from wms_api import WmsApiClient


class TestPatio:
    def test_estrutura_endpoints_respondem_200(self, wms_api: WmsApiClient):
        """4.1/4.3 — fila, veiculos, config, kpis e relatórios → 200."""
        # /patio/fila e /patio/config exigem query cdId — helpers resolvem o CD.
        assert wms_api.patio_fila().status == 200, "GET /patio/fila deveria responder 200"
        # A config do pátio pode não existir ainda para o CD (404 é estado
        # válido — config não criada). O que não pode é 5xx.
        cfg = wms_api.patio_config()
        assert cfg.status in (200, 404), (
            f"GET /patio/config deveria responder 200 ou 404 (config inexistente), "
            f"obtido {cfg.status}: {cfg.text()}"
        )
        assert wms_api._get("/patio/veiculos").status == 200, "GET /patio/veiculos deveria responder 200"
        # /patio/kpis exige dataInicio/dataFim.
        from datetime import datetime, timedelta
        di = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
        df = datetime.now().strftime("%Y-%m-%d")
        kpis = wms_api._get("/patio/kpis", params={"dataInicio": di, "dataFim": df})
        assert kpis.status == 200, f"GET /patio/kpis 200 esperado ({kpis.status}: {kpis.text()})"

    def test_relatorios_respondem_200(self, wms_api: WmsApiClient):
        """4.3 — relatórios de permanência, fila e ocupação → 200."""
        from datetime import datetime, timedelta
        di = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
        df = datetime.now().strftime("%Y-%m-%d")
        for path in ["/patio/relatorio/permanencia", "/patio/relatorio/fila", "/patio/relatorio/ocupacao"]:
            r = wms_api._get(path, params={"dataInicio": di, "dataFim": df})
            assert r.status == 200, f"GET {path} 200 esperado ({r.status}: {r.text()})"

    def test_isolamento_fila_por_empresa(self, wms_api: WmsApiClient):
        """4.4/11 — a fila da 2a empresa não contém veículos de QA da sessão."""
        token2, emp2 = wms_api.token_de_outra_empresa()
        if not token2:
            pytest.skip("Usuário tem apenas uma empresa — isolamento não testável.")
        # A fila exige cdId; usa o primeiro CD (a rota filtra por empresa do token).
        cd = wms_api.primeiro_cd()
        if not cd.get("id"):
            pytest.skip("Nenhum CD cadastrado para consultar a fila do pátio.")
        r2 = wms_api.get_com_token("/patio/fila", token2, params={"cdId": cd["id"]})
        assert r2.status == 200, f"fila da 2a empresa deveria responder 200 ({r2.status})"
        ids_emp = wms_api.empresas_ids_de_lista(r2.json())
        assert ids_emp <= {emp2} or not ids_emp, (
            f"fila da 2a empresa retornou empresaId de terceiros: {ids_emp}"
        )
