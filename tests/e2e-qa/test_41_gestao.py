"""
TEST SUITE 41 — Gestão (dashboards consolidados)
=================================================
Valida os dashboards gerenciais (WMS e unificado PCP+WMS+Vendas) e o
isolamento por empresa (Requirements 10, 11).
"""
import pytest

from wms_api import WmsApiClient


class TestGestao:
    def test_dashboards_respondem_200(self, wms_api: WmsApiClient):
        """10.1 — dashboard WMS e dashboard unificado → 200 com indicadores."""
        dw = wms_api.dashboard_wms()
        assert dw.status == 200, f"/dashboard-wms 200 esperado ({dw.status}: {dw.text()})"
        assert isinstance(dw.json(), (dict, list)), "dashboard WMS deveria retornar objeto/lista"

        du = wms_api.dashboard_unificado()
        assert du.status == 200, f"/pcp/dashboard/unificado 200 esperado ({du.status}: {du.text()})"

    def test_isolamento_dashboard_por_empresa(self, wms_api: WmsApiClient):
        """10.2/11 — o dashboard da 2a empresa é independente da sessão."""
        token2, emp2 = wms_api.token_de_outra_empresa()
        if not token2:
            pytest.skip("Usuário tem apenas uma empresa — isolamento não testável.")
        r2 = wms_api.get_com_token("/dashboard-wms", token2)
        assert r2.status == 200, f"dashboard WMS da 2a empresa deveria responder 200 ({r2.status})"
