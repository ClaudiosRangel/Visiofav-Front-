"""
TEST SUITE 40 — Portal 3PL (módulo /portal)
=============================================
O Portal 3PL tem duas camadas: rotas de usuário externo (autenticadas por
`portalAuth`, escopo dedicado — FORA desta cobertura administrativa) e rotas
`admin/*` (autenticadas por `authenticate` + `moduloGuard('WMS')`, acessíveis
pela sessão admin do QA). Validamos a camada admin: listagem de usuários do
portal + isolamento multi-tenant (Requirements 9, 11).
"""
import pytest

from wms_api import WmsApiClient


class TestPortal3pl:
    def test_admin_listar_usuarios_portal_responde_200(self, wms_api: WmsApiClient):
        """9.1 — GET /portal/admin/usuarios (admin) responde 200 com estrutura coerente."""
        resp = wms_api._get("/portal/admin/usuarios")
        assert resp.status == 200, (
            f"GET /portal/admin/usuarios deveria responder 200 "
            f"(status {resp.status}: {resp.text()})"
        )
        assert isinstance(wms_api._lista_do_corpo(resp.json()), list), (
            "a listagem de usuários do portal deveria ser uma lista"
        )

    def test_escopo_externo_fora_desta_cobertura(self):
        """9.3 — as rotas de usuário do portal (portalAuth) exigem escopo dedicado.

        Documentado como skip: o login/rotas do portal externo usam um token de
        escopo próprio (não o Bearer admin da sessão de QA), fora desta
        cobertura administrativa.
        """
        pytest.skip(
            "Rotas de usuário externo do Portal 3PL usam autenticação dedicada "
            "(portalAuth), fora do escopo desta cobertura administrativa."
        )

    def test_isolamento_usuarios_portal_por_empresa(self, wms_api: WmsApiClient):
        """9.2/11 — a listagem admin da 2a empresa não vaza usuários da sessão."""
        token2, emp2 = wms_api.token_de_outra_empresa()
        if not token2:
            pytest.skip("Usuário tem apenas uma empresa — isolamento não testável.")
        r2 = wms_api.get_com_token("/portal/admin/usuarios", token2)
        assert r2.status == 200, f"listagem admin da 2a empresa deveria responder 200 ({r2.status})"
        ids_emp = wms_api.empresas_ids_de_lista(r2.json())
        assert ids_emp <= {emp2} or not ids_emp, (
            f"usuários do portal da 2a empresa retornaram empresaId de terceiros: {ids_emp}"
        )
