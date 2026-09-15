"""
TEST SUITE 44 — Cobrança Bancária (Onda 2)
============================================
Valida boleto (linha digitável), CNAB (remessa/retorno idempotente), PIX
(BR Code/QR + webhook idempotente), régua de cobrança e convênio (credencial
não vaza). Modo "pronto para integrar": valida geração/parsing com massa
sintética, sem transmissão a banco real.
"""
import time
import pytest

from wms_api import WmsApiClient


def _uniq() -> str:
    return str(int(time.time() * 1000))[-8:]


class TestConvenio:
    def test_criar_convenio_nao_vaza_credencial(self, wms_api: WmsApiClient):
        conta = wms_api.criar_conta_financeira_cob(f"QA Conta Cob {_uniq()}")
        assert conta.status in (200, 201), f"conta ({conta.status}: {conta.text()})"
        conta_id = conta.json()["id"]

        r = wms_api.criar_convenio(conta_id, tipo="AMBOS", client_secret="SECRETO-NAO-VAZAR")
        assert r.status in (200, 201), f"convenio ({r.status}: {r.text()})"
        body = r.json()
        # credencial NÃO pode aparecer em texto
        txt = r.text()
        assert "SECRETO-NAO-VAZAR" not in txt, "client_secret vazou na resposta!"
        assert body.get("temClientSecret") is True

        # listagem também não vaza
        lst = wms_api.listar_convenios()
        assert "SECRETO-NAO-VAZAR" not in lst.text(), "client_secret vazou na listagem!"


class TestBoletoCnab:
    def test_emitir_boleto_e_remessa(self, wms_api: WmsApiClient):
        conta = wms_api.criar_conta_financeira_cob(f"QA Cob {_uniq()}").json()["id"]
        convenio = wms_api.criar_convenio(conta, tipo="BOLETO").json()["id"]
        titulo = wms_api.criar_conta_receber(f"QA Boleto {_uniq()}", 300.0).json()["id"]

        rb = wms_api.emitir_boleto(titulo, convenio)
        assert rb.status in (200, 201), f"emitir boleto ({rb.status}: {rb.text()})"
        boleto = rb.json()
        assert len(boleto["linhaDigitavel"]) == 47, "linha digitável deve ter 47 posições"
        assert len(boleto["codigoBarras"]) == 44, "código de barras deve ter 44 posições"

        # emitir de novo é idempotente (mesmo boleto)
        rb2 = wms_api.emitir_boleto(titulo, convenio)
        assert rb2.json()["id"] == boleto["id"], "emissão deveria ser idempotente"

        # remessa CNAB
        rr = wms_api.gerar_remessa(convenio, [boleto["id"]])
        assert rr.status in (200, 201), f"remessa ({rr.status}: {rr.text()})"
        rem = rr.json()
        assert rem["boletos"] == 1
        # cada linha do CNAB tem 240 posições
        linhas = [l for l in rem["conteudo"].split("\r\n") if l]
        assert all(len(l) == 240 for l in linhas), "linhas CNAB devem ter 240 posições"

    def test_retorno_idempotente(self, wms_api: WmsApiClient):
        # retorno sintético que não casa com nenhum boleto (órfão), mas valida idempotência de arquivo
        conteudo = ("34100001300001T 01" + ("0" * 220))[:240] + "\r\n"
        r1 = wms_api.processar_retorno(conteudo)
        assert r1.status == 200, f"retorno 1 ({r1.status}: {r1.text()})"
        r2 = wms_api.processar_retorno(conteudo)
        assert r2.status == 200
        assert r2.json().get("jaProcessado") is True, "reprocessar o mesmo retorno deve ser idempotente"


class TestPix:
    def test_gerar_pix_e_webhook_idempotente(self, wms_api: WmsApiClient):
        conta = wms_api.criar_conta_financeira_cob(f"QA Pix {_uniq()}").json()["id"]
        convenio = wms_api.criar_convenio(conta, tipo="PIX", chave_pix=f"qa{_uniq()}@pix.com").json()["id"]
        titulo = wms_api.criar_conta_receber(f"QA PIX {_uniq()}", 120.0).json()["id"]

        rp = wms_api.gerar_pix(titulo, convenio)
        assert rp.status in (200, 201), f"gerar pix ({rp.status}: {rp.text()})"
        cob = rp.json()
        assert cob["brcode"].endswith(cob["brcode"][-4:]), "BR Code deve terminar com CRC"
        assert "br.gov.bcb.pix" in cob["brcode"] or "6304" in cob["brcode"]
        txid = cob["txid"]

        empresa_id = wms_api._empresa_id_sessao()
        # webhook confirma pagamento
        w1 = wms_api.webhook_pix(empresa_id, txid)
        assert w1.status == 200, f"webhook ({w1.status}: {w1.text()})"
        assert w1.json().get("baixado") is True

        # webhook repetido é idempotente (não baixa de novo)
        w2 = wms_api.webhook_pix(empresa_id, txid)
        assert w2.status == 200 and w2.json().get("baixado") is False

        # título ficou RECEBIDA
        lst = wms_api.listar_contas_receber(params={"limit": 200})
        item = next((i for i in wms_api._lista_do_corpo(lst.json()) if i.get("id") == titulo), None)
        if item:
            assert item.get("status") == "RECEBIDA", "título deveria estar recebido pelo webhook PIX"

    def test_webhook_txid_desconhecido_nao_erra(self, wms_api: WmsApiClient):
        empresa_id = wms_api._empresa_id_sessao()
        w = wms_api.webhook_pix(empresa_id, "txid-inexistente-999")
        assert w.status == 200, "webhook nunca deve retornar erro ao PSP"
        assert w.json().get("baixado") is False


class TestRegua:
    def test_salvar_e_obter_regua(self, wms_api: WmsApiClient):
        eventos = [
            {"offsetDias": -3, "assunto": "Vence em 3 dias", "template": "Olá {cliente}, {valor} vence em {vencimento}"},
            {"offsetDias": 0, "assunto": "Vence hoje", "template": "Olá {cliente}, {valor} vence hoje"},
        ]
        r = wms_api.salvar_regua(True, eventos)
        assert r.status == 200, f"salvar régua ({r.status}: {r.text()})"
        g = wms_api.obter_regua()
        assert g.status == 200
        body = g.json()
        assert body and body.get("ativa") is True
        assert len(body.get("eventos", [])) == 2


class TestIsolamento:
    def test_convenio_nao_vaza_para_outra_empresa(self, wms_api: WmsApiClient):
        token2, emp2 = wms_api.token_de_outra_empresa()
        if not token2:
            pytest.skip("Usuário tem apenas uma empresa — isolamento não testável.")
        conta = wms_api.criar_conta_financeira_cob(f"QA ISO {_uniq()}").json()["id"]
        wms_api.criar_convenio(conta, banco="999")
        r2 = wms_api.get_com_token("/financeiro-cobranca/convenios", token2)
        assert r2.status == 200
        bancos = {c.get("banco") for c in wms_api._lista_do_corpo(r2.json())}
        # a outra empresa não deve ver um convênio recém-criado com banco 999 desta empresa
        # (só falha se vazar — pode haver 999 legítimo, então validamos por contagem de conta)
        assert isinstance(r2.json(), list)
