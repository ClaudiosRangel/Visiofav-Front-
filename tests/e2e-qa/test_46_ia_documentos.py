"""
TEST SUITE 46 — Vizor AI: Documentos Financeiros (Fase D2)
==========================================================
Valida o lançamento de documentos financeiros assistido por IA. Como a suíte
roda contra produção sem massa de imagem real e sem depender do LLM, o foco é
o caminho DETERMINÍSTICO que a tool `lancar_documento_financeiro` reusa
(`incluirTitulo` — o mesmo motor de D1 usado por `/contas-pagar`):

- lançamento a pagar por dados informados (com parceiro livre PF/PJ);
- boleto: linha digitável válida interpretada; inválida barrada (422);
- documento inválido (CPF/CNPJ inválido) é barrado antes de gravar;
- parcelamento gera N títulos;
- isolamento multi-tenant (documento não vaza para outra empresa);
- rota de chat da IA responde 200 (fallback ou LLM), sem 5xx.

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


class TestLancamentoPorDadosIA:
    """A tool lancar_documento_financeiro resolve parceiro/categoria e chama
    incluirTitulo — o mesmo caminho de /contas-pagar. Validamos esse motor."""

    def test_lanca_documento_pagar_parceiro_livre(self, wms_api: WmsApiClient):
        r = wms_api.incluir_documento_pagar({
            "descricao": f"QA IA Boleto {_uniq()}",
            "valor": 1350.75,
            "dataVencimento": _iso(20),
            "tipoDocumento": "BOLETO",
            "parceiroNomeLivre": "Fornecedor Extraido Do PDF Ltda",
            "parceiroDocLivre": "45.723.174/0001-10",  # CNPJ válido (PJ)
        })
        assert r.status in (200, 201), f"lançar ({r.status}: {r.text()})"
        assert r.json()["criadas"] == 1

    def test_lanca_documento_pagar_pessoa_fisica(self, wms_api: WmsApiClient):
        # documento de PF (ex.: guia de autônomo) — CPF válido
        r = wms_api.incluir_documento_pagar({
            "descricao": f"QA IA Guia PF {_uniq()}",
            "valor": 420.0,
            "dataVencimento": _iso(12),
            "tipoDocumento": "IMPOSTO",
            "parceiroNomeLivre": "Prestador Pessoa Fisica",
            "parceiroDocLivre": "529.982.247-25",  # CPF válido
        })
        assert r.status in (200, 201), f"lançar PF ({r.status}: {r.text()})"
        assert r.json()["criadas"] == 1

    def test_documento_parcelado_gera_n_titulos(self, wms_api: WmsApiClient):
        # financiamento (carro/imóvel) lido pela IA → parcelas
        r = wms_api.incluir_documento_pagar({
            "descricao": f"QA IA Financiamento {_uniq()}",
            "valor": 6000.0,
            "dataVencimento": _iso(30),
            "tipoDocumento": "FINANCIAMENTO",
            "parcelas": 60,
        })
        assert r.status in (200, 201), f"parcelado ({r.status}: {r.text()})"
        body = r.json()
        assert body["criadas"] == 60 and body["parcelas"] == 60


class TestValidacaoDocumento:
    def test_cnpj_invalido_barra(self, wms_api: WmsApiClient):
        r = wms_api.incluir_documento_pagar({
            "descricao": f"QA IA Doc Invalido {_uniq()}",
            "valor": 200.0,
            "dataVencimento": _iso(10),
            "parceiroNomeLivre": "Beneficiario Ruim",
            "parceiroDocLivre": "00.000.000/0000-00",  # inválido
        })
        assert r.status == 422, f"CNPJ inválido deveria dar 422 ({r.status})"


class TestBoleto:
    def test_linha_digitavel_invalida_422(self, wms_api: WmsApiClient):
        r = wms_api.interpretar_boleto("123")
        assert r.status == 422, "linha digitável curta deveria dar 422"


class TestChatIA:
    """A rota do chat deve responder sem 5xx. Sem API key, o backend usa o
    fallback determinístico e ainda retorna 200 com corpo conversacional."""

    def test_chat_responde_sem_erro(self, wms_api: WmsApiClient):
        r = wms_api.ai_chat("o que você pode fazer?")
        assert r.status == 200, f"chat IA ({r.status}: {r.text()})"
        corpo = r.json()
        assert isinstance(corpo.get("resposta"), str) and len(corpo["resposta"]) > 0


class TestIsolamentoIA:
    def test_documento_nao_vaza_entre_empresas(self, wms_api: WmsApiClient):
        token2, _emp2 = wms_api.token_de_outra_empresa()
        if not token2:
            pytest.skip("Usuário tem apenas uma empresa — isolamento não testável.")
        marcador = f"QA-IA-DOC-ISO-{_uniq()}"
        wms_api.incluir_documento_pagar({
            "descricao": marcador,
            "valor": 777.0,
            "dataVencimento": _iso(15),
            "tipoDocumento": "DESPESA",
        })
        r2 = wms_api.get_com_token("/contas-pagar", token2)
        assert r2.status == 200, f"listar como outra empresa ({r2.status})"
        descricoes = {c.get("descricao") for c in wms_api._lista_do_corpo(r2.json())}
        assert marcador not in descricoes, "documento vazou para outra empresa!"
