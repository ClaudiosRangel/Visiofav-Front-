"""
TEST SUITE 47 — Folha de Pagamento (Fase D3)
=============================================
Valida o lançamento do RESULTADO da folha em contas a pagar. O Vizor não calcula
folha — recebe o consolidado do período e gera os títulos:
- funcionário enriquecido (CPF validado; CPF inválido barrado);
- criar folha da competência (única ABERTA por competência);
- adicionar item (líquido = proventos - descontos) e encargo;
- efetivar → gera N contas a pagar (1 por item + 1 por encargo);
- idempotência: 2ª efetivação recusada, sem duplicar (Property 3);
- isolamento multi-tenant (Property 5).

Roda 100% por API com massa sintética.
"""
import time
from datetime import datetime, timedelta, timezone
import pytest

from wms_api import WmsApiClient


def _uniq() -> str:
    return str(int(time.time() * 1000))[-8:]


def _competencia_unica() -> str:
    # competência sintética distante para não colidir com dados reais/execuções
    seq = int(time.time()) % 12 + 1
    ano = 2090 + (int(time.time()) % 9)
    return f"{ano}-{seq:02d}"


def _iso(dias: int = 30) -> str:
    return (datetime.now(timezone.utc) + timedelta(days=dias)).isoformat()


class TestFuncionarioEnriquecido:
    def test_cria_funcionario_com_dados_trabalhistas(self, wms_api: WmsApiClient):
        r = wms_api.criar_funcionario({
            "nome": f"QA Colaborador {_uniq()}",
            "tipo": "OPERADOR",
            "matricula": f"M{_uniq()}",
            "cpf": "529.982.247-25",  # CPF válido
            "cargo": "Auxiliar",
            "salarioBase": 2500.0,
            "banco": "001",
            "agencia": "1234",
            "conta": "56789-0",
            "tipoConta": "CORRENTE",
        })
        assert r.status in (200, 201), f"criar funcionário ({r.status}: {r.text()})"

    def test_cpf_invalido_barra(self, wms_api: WmsApiClient):
        r = wms_api.criar_funcionario({
            "nome": f"QA CPF Ruim {_uniq()}",
            "tipo": "OPERADOR",
            "matricula": f"M{_uniq()}",
            "cpf": "111.111.111-11",  # inválido
        })
        assert r.status == 422, f"CPF inválido deveria dar 422 ({r.status})"


class TestFolhaCicloCompleto:
    def _funcionario_id(self, wms_api: WmsApiClient) -> str:
        r = wms_api.criar_funcionario({
            "nome": f"QA Folha Func {_uniq()}",
            "tipo": "OPERADOR",
            "matricula": f"F{_uniq()}",
        })
        assert r.status in (200, 201), f"criar func ({r.status}: {r.text()})"
        return r.json()["id"]

    def test_criar_add_efetivar_e_idempotencia(self, wms_api: WmsApiClient):
        comp = _competencia_unica()
        # cria folha
        rf = wms_api.criar_folha({"competencia": comp, "descricao": f"QA Folha {comp}"})
        assert rf.status in (200, 201), f"criar folha ({rf.status}: {rf.text()})"
        folha_id = rf.json()["id"]

        # segunda folha ABERTA para a mesma competência deve ser recusada
        rdup = wms_api.criar_folha({"competencia": comp})
        assert rdup.status == 409, f"folha duplicada deveria dar 409 ({rdup.status})"

        # adiciona item (líquido = 3000 - 800 = 2200)
        func_id = self._funcionario_id(wms_api)
        ri = wms_api.add_item_folha(folha_id, {"funcionarioId": func_id, "proventos": 3000.0, "descontos": 800.0})
        assert ri.status in (200, 201), f"add item ({ri.status}: {ri.text()})"
        assert float(ri.json()["liquido"]) == 2200.0

        # adiciona encargo INSS
        re = wms_api.add_encargo_folha(folha_id, {
            "tipo": "INSS", "beneficiario": "INSS - Uniao", "valor": 660.0, "vencimento": _iso(20),
        })
        assert re.status in (200, 201), f"add encargo ({re.status}: {re.text()})"

        # detalhe: totais consistentes
        rd = wms_api.obter_folha(folha_id)
        assert rd.status == 200
        totais = rd.json()["totais"]
        assert totais["totalLiquido"] == 2200.0
        assert totais["totalEncargos"] == 660.0
        assert totais["totalGeral"] == 2860.0

        # efetiva → gera 1 título de funcionário + 1 de encargo
        ref = wms_api.efetivar_folha(folha_id)
        assert ref.status == 200, f"efetivar ({ref.status}: {ref.text()})"
        body = ref.json()
        assert body["titulosFuncionarios"] == 1
        assert body["titulosEncargos"] == 1

        # idempotência: 2ª efetivação recusada (409), sem duplicar
        ref2 = wms_api.efetivar_folha(folha_id)
        assert ref2.status == 409, f"2ª efetivação deveria dar 409 ({ref2.status})"

        # folha agora EFETIVADA
        rd2 = wms_api.obter_folha(folha_id)
        assert rd2.json()["status"] == "EFETIVADA"


class TestIsolamentoFolha:
    def test_folha_nao_vaza_entre_empresas(self, wms_api: WmsApiClient):
        token2, _emp2 = wms_api.token_de_outra_empresa()
        if not token2:
            pytest.skip("Usuário tem apenas uma empresa — isolamento não testável.")
        comp = _competencia_unica()
        marcador = f"QA-FOLHA-ISO-{_uniq()}"
        wms_api.criar_folha({"competencia": comp, "descricao": marcador})
        r2 = wms_api.get_com_token("/financeiro/folha", token2)
        assert r2.status == 200, f"listar folha como outra empresa ({r2.status})"
        descricoes = {f.get("descricao") for f in wms_api._lista_do_corpo(r2.json())}
        assert marcador not in descricoes, "folha vazou para outra empresa!"
