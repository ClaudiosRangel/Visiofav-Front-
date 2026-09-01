"""
TEST SUITE 42 — Isolamento multi-tenant transversal (módulos avançados)
========================================================================
Verificação transversal do Requirement 11: para CADA listagem coberta dos dez
módulos avançados, todo `empresaId` retornado deve ser o da empresa do token,
e a Segunda_Empresa não deve ver dados exclusivos da Empresa_Sessao.

Este é o teste que teria capturado automaticamente o vazamento real da
Conferência de Entrada (query sem filtro `empresaId`). Se qualquer rota vazar,
o teste FALHA (assert) — nunca mascara com skip.
"""
import pytest

from wms_api import WmsApiClient


# Listagens (path, params) escopadas por empresa nos 10 módulos.
# Cada uma deve responder 200 e, se os itens expõem empresaId, todos devem ser
# da empresa do token usado.
def _rotas_cobertas(wms_api: WmsApiClient) -> list:
    cd = wms_api.primeiro_cd().get("id")
    from datetime import datetime, timedelta, timezone
    di = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%dT%H:%M:%SZ")
    df = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    dia = datetime.now().strftime("%Y-%m-%d")
    rotas = [
        ("/faturamento/contratos", {"limit": 100}),
        ("/faturamento/faturas", {"limit": 100}),
        ("/picking-zona/zonas", {"limit": 100}),
        ("/lms/metas", None),
        ("/multi-cd/solicitacoes", {"limit": 100}),
        ("/multi-cd/transito", {"limit": 100}),
        ("/multi-cd/painel", {"dataInicio": di, "dataFim": df}),
        ("/demanda/abc", {"criterio": "VALOR"}),
        ("/wave/regras", {"limit": 100}),
        ("/portal/admin/usuarios", None),
    ]
    if cd:
        rotas.append(("/patio/fila", {"cdId": cd}))
    return rotas


class TestIsolamentoModulosAvancados:
    def test_toda_listagem_responde_escopada_pela_empresa_da_sessao(
        self, wms_api: WmsApiClient
    ):
        """11.1/11.2 — todo empresaId retornado é o da empresa da sessão."""
        empresa_sessao = wms_api._empresa_id_sessao()
        assert empresa_sessao, "não foi possível resolver o empresaId da sessão (JWT)"

        falhas = []
        for path, params in _rotas_cobertas(wms_api):
            resp = wms_api._get(path, params=params)
            if resp.status != 200:
                # 500/4xx aqui é problema da rota (registrado), não de isolamento.
                falhas.append(f"{path} -> HTTP {resp.status}")
                continue
            ids = wms_api.empresas_ids_de_lista(resp.json())
            vazados = ids - {empresa_sessao}
            if vazados:
                falhas.append(f"{path} -> empresaId de terceiros: {vazados}")
        assert not falhas, (
            "Isolamento/estrutura violado em uma ou mais rotas: " + "; ".join(falhas)
        )

    def test_segunda_empresa_nao_ve_dados_da_sessao(self, wms_api: WmsApiClient):
        """11.1/11.3 — a Segunda_Empresa não retorna empresaId da Empresa_Sessao."""
        empresa_sessao = wms_api._empresa_id_sessao()
        token2, emp2 = wms_api.token_de_outra_empresa()
        if not token2:
            pytest.skip("Usuário tem apenas uma empresa — isolamento não testável.")

        falhas = []
        for path, params in _rotas_cobertas(wms_api):
            # A fila do pátio depende de cdId da empresa da sessão; pular no cross.
            if path == "/patio/fila":
                continue
            r2 = wms_api.get_com_token(path, token2, params=params)
            if r2.status != 200:
                continue  # rota com erro próprio — não é vazamento
            ids = wms_api.empresas_ids_de_lista(r2.json())
            if empresa_sessao in ids:
                falhas.append(f"{path} -> vazou empresaId da sessão para a 2a empresa")
        assert not falhas, (
            "VAZAMENTO multi-tenant detectado: " + "; ".join(falhas)
        )
