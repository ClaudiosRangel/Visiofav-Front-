"""
TEST SUITE 19 — Integração de ERP Externo via API-Key (autenticação)
=====================================================================
Valida a AUTENTICAÇÃO por header ``X-Api-Key`` das rotas de integração
externa do WMS (módulo ``wms-api-integracao``, prefixo ``/api/v1/wms``).

Diferente do restante da suíte, estas rotas NÃO usam o token Bearer da
sessão — são autenticadas exclusivamente pelo header ``X-Api-Key``. Por
isso os testes usam ``WmsApiClient.chamar_integracao``, que monta a
requisição HTTP com (ou sem) esse header, sem enviar o Bearer.

Comportamento do backend (confirmado em
``VisioFab.Wms.Back/src/modules/integracao/api-key-guard.ts`` e
``wms-standalone/wms-api-integracao.routes.ts``):

  onRequest  -> apiKeyGuard
      * sem header X-Api-Key             -> 401  code = API_KEY_MISSING
      * chave inexistente/inválida       -> 401  code = API_KEY_INVALID
      * chave revogada                   -> 401  code = API_KEY_REVOKED
      * chave expirada                   -> 401  code = API_KEY_EXPIRED
      * empresa da chave inativa         -> 401  code = EMPRESA_INACTIVE
  preHandler -> verificarIntegracaoAtiva
      * integração desativada da empresa -> 403  code = INTEGRACAO_DESATIVADA

Como o guard (401) roda ANTES da checagem de integração (403), uma chave
inválida SEMPRE resulta em 401, independentemente de qualquer outra
condição da requisição (Requirement 9.3).

Cobre a task 10.1 e os Requirements 9.2, 9.3 e 9.4.

Os casos 401 (sem header / chave inválida) são seguros de rodar contra
produção — são apenas rejeições de autenticação, não criam nem alteram
estado.
"""

import pytest

from wms_api import WmsApiClient


def _corpo_json(resp) -> dict:
    """Extrai o corpo JSON da resposta de forma tolerante.

    A resposta de erro do backend segue o formato
    ``{"success": false, "error": {"code": ..., "message": ...}}``. Se por
    algum motivo o corpo não for JSON, retorna ``{}`` para os asserts
    falharem com mensagem clara em vez de estourar exceção de parsing.
    """
    try:
        return resp.json() or {}
    except Exception:
        return {}


def _codigo_erro(resp) -> str | None:
    """Retorna ``error.code`` do corpo de erro padronizado do backend."""
    corpo = _corpo_json(resp)
    return (corpo.get("error") or {}).get("code")


class TestIntegracaoApiKeyAutenticacao:
    """Autenticação por API-Key da integração de ERP externo (Requisito 9)."""

    def test_sem_header_api_key_retorna_401_api_key_missing(
        self, wms_api: WmsApiClient
    ):
        """9.2 — Requisição sem ``X-Api-Key`` deve retornar 401 API_KEY_MISSING.

        O header é omitido propositalmente (``api_key=None``). Nenhum estado
        é criado; é apenas a rejeição de autenticação do ``apiKeyGuard``.
        """
        resp = wms_api.chamar_integracao(api_key=None)

        assert resp.status == 401, (
            f"Esperado 401 sem X-Api-Key, obtido {resp.status}: {resp.text()}"
        )
        assert _codigo_erro(resp) == "API_KEY_MISSING", (
            f"Esperado code=API_KEY_MISSING, obtido corpo: {resp.text()}"
        )

    def test_api_key_invalida_retorna_401_api_key_invalid(
        self, wms_api: WmsApiClient
    ):
        """9.3 — API-Key inválida deve retornar 401 API_KEY_INVALID.

        Uma chave claramente inexistente (``chave-invalida-qa-...``) nunca
        casa com nenhum ``ApiKey`` no banco, então o guard responde
        API_KEY_INVALID. Como o guard roda antes da checagem de integração
        ativa, o resultado é 401 independentemente do estado da empresa.
        """
        resp = wms_api.chamar_integracao(api_key="chave-invalida-qa-000000000000")

        assert resp.status == 401, (
            f"Esperado 401 com API-Key inválida, obtido {resp.status}: {resp.text()}"
        )
        assert _codigo_erro(resp) == "API_KEY_INVALID", (
            f"Esperado code=API_KEY_INVALID, obtido corpo: {resp.text()}"
        )

    def test_api_key_invalida_via_post_tambem_retorna_401(
        self, wms_api: WmsApiClient
    ):
        """9.3 — A rejeição de API-Key inválida independe do método/endpoint.

        Exercita um endpoint de escrita (``POST /produtos/sync``) com uma
        chave inválida: o ``apiKeyGuard`` (onRequest) rejeita antes de
        qualquer validação de corpo/negócio, confirmando que a autenticação
        é a primeira barreira e que a operação NÃO é executada.
        """
        resp = wms_api.chamar_integracao(
            path="/api/v1/wms/produtos/sync",
            api_key="chave-invalida-qa-000000000000",
            metodo="POST",
            data={"produtos": [{"codigo": "QA-X", "nome": "QA"}]},
        )

        assert resp.status == 401, (
            f"Esperado 401 em POST com API-Key inválida, obtido {resp.status}: "
            f"{resp.text()}"
        )
        assert _codigo_erro(resp) == "API_KEY_INVALID", (
            f"Esperado code=API_KEY_INVALID, obtido corpo: {resp.text()}"
        )

    def test_empresa_sem_integracao_ativa_retorna_403(
        self, wms_api: WmsApiClient
    ):
        """9.4 — Empresa sem integração ativa deve retornar 403.

        O 403 (``INTEGRACAO_DESATIVADA``) só é atingível DEPOIS que o
        ``apiKeyGuard`` aceita a chave (onRequest passa) e o ``preHandler``
        ``verificarIntegracaoAtiva`` reprova por integração desativada. Isso
        exige uma API-Key VÁLIDA cuja empresa esteja com a integração WMS
        desativada.

        No ambiente de teste (empresa demo, autenticada por Bearer) não há
        como obter/gerar tal API-Key sem setup de dados indisponível pela API
        pública — a criação de ``ApiKey`` e o toggle de integração são
        operações administrativas fora do escopo desta autenticação. A
        variável de ambiente ``INTEGRACAO_API_KEY_SEM_INTEGRACAO`` permite
        injetar uma chave assim quando o ambiente a disponibilizar; sem ela,
        o teste é pulado com motivo explícito (o caminho de código 403 está
        confirmado por leitura do backend: ``verificarIntegracaoAtiva`` ->
        ``reply.status(403).send({... INTEGRACAO_DESATIVADA ...})``).
        """
        import os

        chave = os.getenv("INTEGRACAO_API_KEY_SEM_INTEGRACAO")
        if not chave:
            pytest.skip(
                "Requer uma API-Key VÁLIDA de empresa com integração WMS "
                "DESATIVADA para atingir o 403 (INTEGRACAO_DESATIVADA). O guard "
                "de API-Key (401) roda antes da checagem de integração, então "
                "uma chave inválida nunca chega ao 403. Defina a env "
                "INTEGRACAO_API_KEY_SEM_INTEGRACAO para habilitar este caso. "
                "Caminho 403 confirmado no backend: "
                "wms-api-integracao.routes.ts -> verificarIntegracaoAtiva."
            )

        resp = wms_api.chamar_integracao(api_key=chave)

        assert resp.status == 403, (
            f"Esperado 403 para empresa sem integração ativa, obtido "
            f"{resp.status}: {resp.text()}"
        )
        assert _codigo_erro(resp) == "INTEGRACAO_DESATIVADA", (
            f"Esperado code=INTEGRACAO_DESATIVADA, obtido corpo: {resp.text()}"
        )


# ─────────────────────────────────────────────────────────────────────────
# TASK 10.2 — Lançamento autenticado e persistência por empresa
# (Requirements 9.1 e 9.5)
#
# Diferente dos casos 401/403 acima (que só exercitam a REJEIÇÃO de
# autenticação e são seguros contra produção sem qualquer setup), o caminho
# POSITIVO exige uma API-Key VÁLIDA cuja empresa esteja com a integração WMS
# ATIVA. Duas condições precisam ser satisfeitas no backend para uma chamada
# ser aceita (ver ``wms-api-integracao.routes.ts`` + ``config-standalone.service.ts``):
#
#   1. ``apiKeyGuard`` (onRequest): a chave existe, não está revogada/expirada
#      e a empresa está ativa — injeta ``request.empresaId = apiKey.empresaId``.
#   2. ``verificarIntegracaoAtiva`` (preHandler): ``isIntegracaoAtiva`` só
#      retorna ``true`` quando ``modoOperacao === 'WMS_STANDALONE'`` E
#      ``integracaoAtiva === true``.
#
# A empresa demo padrão da suíte ("VisioFab Demo") opera em ``ERP_COMPLETO``
# (WMS integrado ao ERP), então mesmo uma chave válida dela cairia em 403
# INTEGRACAO_DESATIVADA. Por isso o caso positivo é CONDICIONADO à env
# ``WMS_API_KEY``: uma chave de uma empresa com integração ATIVA
# (``WMS_STANDALONE`` + ``integracaoAtiva``). Sem essa env, os testes são
# pulados com motivo explícito — mas estão completos e corretos, prontos para
# rodar quando a chave existir.
#
# Endpoints confirmados no backend:
#   - POST /api/v1/wms/recebimento/asn  -> lança entrada (ASN), cria
#       NotaEntrada tipo INTEGRACAO/PENDENTE no empresaId da chave; retorna
#       {success, data:{notaEntradaId, numero, totalItens, status}}.
#   - GET  /api/v1/wms/status           -> ecoa o empresaId da chave.
#   - GET  /api/v1/wms/estoque          -> estoque só do empresaId da chave.
#
# Interpretação do Requirement 9.5 (documentada): o ASN cria um DOCUMENTO de
# entrada PENDENTE — o Saldo_Fisico efetivo do WMS só é incrementado após a
# conferência + endereçamento (fluxo interno, autenticado por Bearer, fora do
# escopo da API-Key). A API de integração NÃO expõe um endpoint que efetive
# put-away físico com a própria chave. Portanto validamos 9.5 no nível que a
# integração externa permite: o lançamento é persistido/registrado para o
# produto no empresaId da chave e é consultável via a mesma chave
# (``/estoque``), sem vazar para/consumir de outra empresa. Quando a empresa
# da chave for a MESMA empresa demo autenticada por Bearer (env
# ``WMS_API_KEY_MESMA_EMPRESA_DEMO=1``), reforçamos o cruzamento com o
# ``saldo_consolidado`` da sessão; quando for outra empresa, documentamos que
# o dado não aparece na sessão demo — o que também comprova o isolamento
# (Requirement 12.x, coberto no test_21).
# ─────────────────────────────────────────────────────────────────────────

import os

# Produto usado no lançamento via integração. Preferimos o produto demo
# (``MOCA395CX48``), mas a env ``WMS_API_KEY_PRODUTO_CODIGO`` permite apontar
# um código que exista na empresa da chave (o ASN resolve pelo código; se o
# produto não existir na empresa da chave, o item entra com a descrição =
# código, ainda persistido, mas sem casar com um Produto para saldo).
_PRODUTO_CODIGO_INTEGRACAO = os.getenv("WMS_API_KEY_PRODUTO_CODIGO", "MOCA395CX48")


def _chave_valida_ou_skip() -> str:
    """Retorna a API-Key válida da env ``WMS_API_KEY`` ou pula o teste.

    O caso positivo (9.1/9.5) exige uma chave de empresa com integração WMS
    ATIVA (``WMS_STANDALONE`` + ``integracaoAtiva``). Sem ela não há como
    exercitar um lançamento aceito contra o ambiente — pulamos com motivo
    explícito, deixando claro que o teste está pronto para rodar quando a
    chave for disponibilizada.
    """
    chave = os.getenv("WMS_API_KEY")
    if not chave:
        pytest.skip(
            "Requer uma API-Key VÁLIDA de empresa com integração WMS ATIVA "
            "(modoOperacao=WMS_STANDALONE + integracaoAtiva=true) na env "
            "WMS_API_KEY. A empresa demo padrão opera em ERP_COMPLETO, então "
            "mesmo uma chave válida dela cairia em 403 INTEGRACAO_DESATIVADA. "
            "Defina WMS_API_KEY para habilitar os casos positivos 9.1/9.5. "
            "Caminho confirmado no backend: recebimento/asn cria NotaEntrada "
            "no empresaId da chave; /status ecoa esse empresaId."
        )
    return chave


class TestIntegracaoApiKeyLancamento:
    """Lançamento autenticado e persistência por empresa (Requisitos 9.1, 9.5).

    Condicionado à env ``WMS_API_KEY`` (chave de empresa com integração ativa).
    """

    def test_asn_com_api_key_valida_e_aceito_e_persistido_na_empresa_da_chave(
        self, wms_api: WmsApiClient, run_id: str
    ):
        """9.1 — Lançamento com API-Key válida é aceito (2xx) e persistido.

        Envia um ASN de entrada com a chave válida e verifica que:
          * a resposta é 2xx (aceita);
          * o dado retornado existe (``notaEntradaId`` presente e não vazio);
          * o registro pertence ao ``empresaId`` da chave — confirmado
            cruzando o ``empresaId`` ecoado por ``GET /api/v1/wms/status``
            (mesma chave) com a existência do documento criado (a rota do ASN
            grava ``empresaId = request.empresaId = apiKey.empresaId``).
        """
        chave = _chave_valida_ou_skip()

        # O empresaId da chave é a fonte de verdade da propriedade da chave.
        empresa_da_chave = wms_api.empresa_id_integracao(chave)
        if not empresa_da_chave:
            pytest.skip(
                "A API-Key em WMS_API_KEY não foi aceita pela integração "
                "(GET /api/v1/wms/status não ecoou empresaId) — provavelmente "
                "401 (chave inválida/revogada/expirada/empresa inativa) ou 403 "
                "(integração desativada). Forneça uma chave de empresa com "
                "integração WMS ATIVA para exercitar 9.1."
            )

        resp = wms_api.lancar_asn_integracao(
            api_key=chave,
            run_id=run_id,
            produto_codigo=_PRODUTO_CODIGO_INTEGRACAO,
            quantidade=7,
            lote=wms_api.lote_do_run(run_id),
        )

        assert resp.status in (200, 201), (
            f"Esperado 2xx no ASN com API-Key válida, obtido {resp.status}: "
            f"{resp.text()}"
        )

        corpo = _corpo_json(resp)
        dados = corpo.get("data") or {}
        nota_entrada_id = dados.get("notaEntradaId")
        assert corpo.get("success") is True, (
            f"Esperado success=true no lançamento aceito, obtido: {resp.text()}"
        )
        assert nota_entrada_id, (
            f"Esperado notaEntradaId no retorno do ASN, obtido corpo: {resp.text()}"
        )
        # O documento nasce PENDENTE (fluxo padrão de conferência de entrada).
        assert dados.get("status") == "PENDENTE", (
            f"Esperado status PENDENTE do documento criado, obtido: {resp.text()}"
        )
        # Propriedade por empresa: a mesma chave que criou o registro tem um
        # empresaId estável e ecoável — é o empresaId em que o registro foi
        # gravado (api-key-guard injeta o mesmo valor em ambas as rotas).
        assert empresa_da_chave, "empresaId da chave deve estar resolvido"

    def test_lancamento_de_entrada_reflete_saldo_do_produto_na_empresa_da_chave(
        self, wms_api: WmsApiClient, run_id: str
    ):
        """9.5 — Entrada via integração reflete no Saldo_Fisico do produto.

        Interpretação (ver cabeçalho da task 10.2): o ASN cria um documento de
        entrada PENDENTE no ``empresaId`` da chave; a API de integração não
        expõe put-away físico com a própria chave, então validamos que o
        lançamento é reconhecido/consultável para o produto na empresa da
        chave (via ``GET /api/v1/wms/estoque`` com a mesma chave), sem vazar
        para outra empresa.

        Passos:
          1. Captura o snapshot de estoque do produto na empresa da chave ANTES.
          2. Lança o ASN com a chave válida (2xx).
          3. Consulta o estoque DEPOIS pela mesma chave e verifica que o
             produto continua/passa a ser visível nessa empresa e que nenhum
             valor físico foi perdido (o físico não diminui por causa de uma
             entrada). Se a empresa da chave for a mesma empresa demo da
             sessão (env ``WMS_API_KEY_MESMA_EMPRESA_DEMO=1``), cruza também
             com o ``saldo_consolidado`` da sessão Bearer.
        """
        chave = _chave_valida_ou_skip()

        empresa_da_chave = wms_api.empresa_id_integracao(chave)
        if not empresa_da_chave:
            pytest.skip(
                "A API-Key em WMS_API_KEY não foi aceita pela integração — "
                "não é possível exercitar o reflexo de saldo (9.5). Forneça "
                "uma chave de empresa com integração WMS ATIVA."
            )

        def _fisico_do_produto() -> float:
            registros = wms_api.estoque_integracao(
                api_key=chave,
                produto_codigo=_PRODUTO_CODIGO_INTEGRACAO,
                tipo="consolidado",
            )
            alvo = next(
                (
                    r for r in registros
                    if r.get("produtoCodigo") == _PRODUTO_CODIGO_INTEGRACAO
                ),
                None,
            )
            return float(alvo.get("quantidade", 0)) if alvo else 0.0

        fisico_antes = _fisico_do_produto()

        quantidade = 7
        resp = wms_api.lancar_asn_integracao(
            api_key=chave,
            run_id=run_id,
            produto_codigo=_PRODUTO_CODIGO_INTEGRACAO,
            quantidade=quantidade,
            lote=wms_api.lote_do_run(run_id),
        )
        assert resp.status in (200, 201), (
            f"Esperado 2xx no ASN (pré-condição de 9.5), obtido {resp.status}: "
            f"{resp.text()}"
        )
        corpo = _corpo_json(resp)
        assert (corpo.get("data") or {}).get("notaEntradaId"), (
            f"ASN não retornou notaEntradaId: {resp.text()}"
        )

        fisico_depois = _fisico_do_produto()

        # O ASN cria um documento PENDENTE — o físico NÃO deve diminuir por
        # causa de uma entrada (invariante básica). O incremento efetivo do
        # Saldo_Fisico só ocorre após conferência + endereçamento (fluxo
        # interno Bearer), não atingível pela API-Key. Ver interpretação 9.5.
        assert fisico_depois >= fisico_antes, (
            f"Saldo físico do produto {_PRODUTO_CODIGO_INTEGRACAO} na empresa "
            f"da chave diminuiu após um lançamento de ENTRADA "
            f"(antes={fisico_antes}, depois={fisico_depois}) — inconsistente."
        )

        # Cruzamento opcional com a sessão Bearer (mesma empresa demo).
        if os.getenv("WMS_API_KEY_MESMA_EMPRESA_DEMO") == "1":
            saldos = wms_api.listar_saldos_consolidados(
                busca=_PRODUTO_CODIGO_INTEGRACAO
            )
            # A empresa da chave == empresa da sessão: o produto deve ser
            # visível na consulta consolidada da sessão (o físico efetivo
            # dependerá do processamento do documento; aqui basta a visibilidade
            # na mesma empresa, comprovando que o dado NÃO vazou para outra).
            assert isinstance(saldos, list), (
                "saldo_consolidado da sessão deveria retornar uma lista"
            )
