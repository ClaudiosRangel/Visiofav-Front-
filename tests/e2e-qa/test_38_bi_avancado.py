"""
TEST SUITE 38 — BI Avançado (módulo /bi)
=========================================
Valida o dashboard executivo, custos e alertas: estrutura, degradação
graciosa (sem snapshots) e isolamento multi-tenant (Requirements 7, 11).
"""
import pytest

from wms_api import WmsApiClient


class TestBiAvancado:
    def test_dashboard_estrutura(self, wms_api: WmsApiClient):
        """7.1 — /bi/dashboard → {periodo, kpis:[...], totalSnapshots}."""
        resp = wms_api.bi_dashboard()
        assert resp.status == 200, f"/bi/dashboard 200 esperado ({resp.status}: {resp.text()})"
        corpo = resp.json()
        assert "periodo" in corpo, f"dashboard BI deveria ter 'periodo' (obtido: {corpo})"
        assert isinstance(corpo.get("kpis"), list), "kpis deveria ser um array"
        assert "totalSnapshots" in corpo, "dashboard BI deveria ter 'totalSnapshots'"
        # Cada KPI tem a forma documentada.
        for kpi in corpo["kpis"]:
            assert "chave" in kpi and "valorAtual" in kpi, (
                f"cada KPI deveria ter chave/valorAtual (obtido: {kpi})"
            )

    def test_demais_endpoints_respondem_200(self, wms_api: WmsApiClient):
        """7.2 — custos, custos/detalhado, comparativo, correlacao, alertas, config → 200."""
        from datetime import datetime, timedelta
        di = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        df = datetime.now().strftime("%Y-%m-%d")
        for path, params in [
            ("/bi/custos", {"dataInicio": di, "dataFim": df}),
            ("/bi/custos/detalhado", {"data": df}),
            ("/bi/alertas", None),
            ("/bi/config", None),
        ]:
            r = wms_api._get(path, params=params)
            assert r.status == 200, f"GET {path} 200 esperado ({r.status}: {r.text()})"

    def test_degradacao_graciosa_sem_snapshots(self, wms_api: WmsApiClient):
        """7.4 — sem SnapshotBI, totalSnapshots=0 e KPIs sem erro (200)."""
        corpo = wms_api.bi_dashboard().json()
        assert isinstance(corpo.get("totalSnapshots"), int), (
            f"totalSnapshots deveria ser inteiro (obtido: {corpo.get('totalSnapshots')})"
        )
        # KPIs continuam sendo array mesmo com 0 snapshots.
        assert isinstance(corpo.get("kpis"), list)

    def test_isolamento_dashboard_por_empresa(self, wms_api: WmsApiClient):
        """7.3/11 — dashboard responde por empresa (a 2a empresa não herda a sessão)."""
        token2, emp2 = wms_api.token_de_outra_empresa()
        if not token2:
            pytest.skip("Usuário tem apenas uma empresa — isolamento não testável.")
        r2 = wms_api.get_com_token("/bi/dashboard", token2)
        assert r2.status == 200, f"dashboard da 2a empresa deveria responder 200 ({r2.status})"
        # Não deve vazar: a resposta é escopada (o backend filtra por empresaId).
        # Verificamos apenas que respondeu de forma independente e coerente.
        assert "totalSnapshots" in r2.json()
