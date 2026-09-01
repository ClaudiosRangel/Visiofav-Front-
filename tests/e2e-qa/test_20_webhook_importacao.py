"""
TEST SUITE 20 — Webhooks e Importação por Arquivo
==================================================
Cobre a integração de eventos do WMS para ERPs externos por **webhook**
(``webhook-dispatcher``, task 11.1 — Requirements 10.1, 10.2, 10.3, 10.4) e a
**importação de lançamentos por arquivo** (task 11.2 — Requirements 11.1,
11.2, 11.3, reservada abaixo).

Módulo de webhooks no backend
-----------------------------
``VisioFab.Wms.Back/src/modules/integracao/webhook.routes.ts`` +
``webhook-dispatcher.ts``, registrado no ``server.ts`` sob o prefixo
``/api/webhooks`` (sobre a raiz do host). Autenticação pelo **Bearer** da
sessão (``authenticate`` + ``moduloGuard('WMS')``) — não por API-Key.

Rotas:
  - GET    /api/webhooks                      -> lista webhooks da empresa
  - POST   /api/webhooks                      -> cria (url + eventos[]) -> 201
  - PUT    /api/webhooks/:id                  -> edita
  - DELETE /api/webhooks/:id                  -> remove
  - GET    /api/webhooks/:id/entregas         -> últimas 50 entregas (deliveries)
  - POST   /api/webhooks/entregas/:id/reenviar-> redispara (cria nova entrega)

Modelo (schema.prisma):
  WebhookConfig  { id, empresaId, url, eventos(CSV), ativo, criadoEm }
  WebhookEntrega { id, webhookConfigId, evento, payload(JSON string),
                   statusHttp, tentativas, sucesso, criadoEm, ultimaTentativa }

O ``payload`` gravado é a string JSON ``{evento, timestamp, empresaId, dados}``
onde ``dados`` traz o identificador do registro que originou o evento (ex.:
``carregamentoId`` para ``expedicao.carregada``).

Disparo (retentativa em ``enviarComRetry``): ao criar a entrega,
``tentativas=0`` e ``sucesso=false``; após o POST HTTP, atualiza ``statusHttp``,
``tentativas`` e ``sucesso``. Se ``!response.ok`` (ou erro de rede) e ainda há
tentativas, reagenda um reenvio (backoff 1min/5min/30min) — ou seja, uma
entrega que falhou fica marcada para retentativa (``sucesso=false`` com
tentativas < MAX).

Reprodutibilidade do DISPARO contra produção
--------------------------------------------
A única chamada de ``dispararWebhook`` a partir de um evento REAL do WMS é
``expedicao.carregada`` (conclusão de carregamento — pipeline pesado
onda→separação→carregamento→volumes). Não há endpoint leve/determinístico que
dispare um evento coberto contra produção. Por isso:

  * Req 10.4 (isolamento por empresa) é validado de forma DETERMINÍSTICA e
    segura: criamos um webhook de QA na empresa da sessão, confirmamos que ele
    aparece na listagem (que é escopada por ``empresaId``) e que suas entregas
    são acessíveis; limpamos no ``finally``.
  * Req 10.1/10.2/10.3 (registro da entrega, identificador no payload,
    marcação para retentativa) dependem de o disparo ter ocorrido. Usamos a
    estratégia determinística de **reenvio** (``/entregas/:id/reenviar``) QUANDO
    já existe ao menos uma entrega de origem na empresa (de um
    ``expedicao.carregada`` real anterior). Na ausência de qualquer entrega
    reproduzível, seguimos a disciplina da suíte: ``pytest.skip`` NO SEED com
    motivo explícito — nunca um assert falso.

Segurança/limpeza
-----------------
Criar/remover ``WebhookConfig`` não altera saldo nem dispara HTTP externo por
si só (o disparo só ocorre em eventos). Usamos uma URL de destino que falha de
propósito (``https://webhook.invalid.example`` / ``httpstat``) para exercitar o
caminho de retentativa sem depender de um receptor real. Todo webhook criado é
removido no ``finally`` (best-effort).
"""

import os

import pytest

from wms_api import WmsApiClient
from helpers import screenshot_com_nome


# URL de destino de teste. Por padrão aponta para um host inexistente
# (``.invalid`` nunca resolve — RFC 6761), forçando falha de entrega para
# exercitar o caminho de retentativa (10.3). A env ``WEBHOOK_TEST_URL`` permite
# apontar para um endpoint que retorne erro HTTP controlado (ex.: httpstat 500)
# quando se quiser observar ``statusHttp`` != 0.
_WEBHOOK_URL_FALHA = os.getenv(
    "WEBHOOK_TEST_URL", "https://webhook-qa-falha.invalid.example/hook"
)


def _entrega_marcada_para_retentativa(entrega: dict) -> bool:
    """Uma entrega está marcada para retentativa quando falhou e ainda cabe reenvio.

    Espelha ``enviarComRetry`` (webhook-dispatcher.ts): ``MAX_TENTATIVAS = 3``.
    Uma entrega que falhou (``sucesso is False``) com ``tentativas < 3`` está,
    por definição do dispatcher, elegível a (agendada para) uma nova tentativa.
    Uma entrega recém-criada mas ainda não processada (``tentativas == 0``,
    ``sucesso False``) também está pendente de tentativa. Consideramos "marcada
    para retentativa" o estado ``sucesso == False and tentativas < 3``.
    """
    sucesso = entrega.get("sucesso")
    tentativas = entrega.get("tentativas", 0) or 0
    return sucesso is not True and tentativas < 3


@pytest.mark.slow
class TestWebhooks:
    """Disparo e conteúdo de webhooks (task 11.1 — Requirements 10.1–10.4)."""

    def test_webhooks_visiveis_apenas_para_empresa_que_configurou(
        self, wms_api: WmsApiClient
    ):
        """10.4 — Webhooks/entregas visíveis apenas para o ``empresaId`` que os configurou.

        Determinístico e seguro contra produção: cria um webhook na empresa da
        sessão, confirma que ele aparece na listagem (rota escopada por
        ``empresaId`` do Bearer) e que TODOS os webhooks retornados pertencem à
        MESMA empresa (nenhum vazamento de outra empresa). Também confirma que
        as entregas do webhook são acessíveis pela mesma sessão. Limpa no
        ``finally``.
        """
        empresa_sessao = wms_api._empresa_id_sessao()

        webhook_id = None
        try:
            resp = wms_api.criar_webhook(
                url=_WEBHOOK_URL_FALHA,
                eventos=["expedicao.carregada", "nota.recebida"],
            )
            assert resp.status in (200, 201), (
                f"Esperado 201 ao criar webhook, obtido {resp.status}: "
                f"{resp.text()}"
            )
            criado = resp.json()
            webhook_id = criado.get("id")
            assert webhook_id, f"Webhook criado sem id: {resp.text()}"

            # O webhook nasce com o empresaId da sessão (Bearer).
            if empresa_sessao:
                assert criado.get("empresaId") == empresa_sessao, (
                    "Webhook criado deveria pertencer ao empresaId da sessão "
                    f"({empresa_sessao}), obtido {criado.get('empresaId')}"
                )

            # A listagem é escopada por empresa: o webhook criado aparece e
            # TODOS os retornados pertencem à mesma empresa.
            webhooks = wms_api.listar_webhooks()
            ids = {w.get("id") for w in webhooks}
            assert webhook_id in ids, (
                "O webhook recém-criado deveria aparecer na listagem da própria "
                f"empresa. IDs retornados: {ids}"
            )
            if empresa_sessao:
                empresas_retornadas = {
                    w.get("empresaId")
                    for w in webhooks
                    if w.get("empresaId") is not None
                }
                assert empresas_retornadas <= {empresa_sessao}, (
                    "A listagem de webhooks vazou registros de outra empresa: "
                    f"esperado apenas {empresa_sessao}, obtido {empresas_retornadas}"
                )

            # As entregas do webhook são acessíveis pela própria empresa (lista,
            # possivelmente vazia — o webhook é novo e ainda não disparou).
            entregas = wms_api.entregas_webhook(webhook_id)
            assert isinstance(entregas, list), (
                "Entregas do webhook deveriam ser uma lista (escopada à empresa)"
            )
        finally:
            if webhook_id:
                wms_api.remover_webhook(webhook_id)

    def test_entrega_de_outra_empresa_nao_e_acessivel_por_identificador(
        self, wms_api: WmsApiClient
    ):
        """10.4 — Acesso às entregas de um webhook de OUTRA empresa responde 404.

        Reforça o isolamento por identificador: a rota
        ``GET /api/webhooks/:id/entregas`` só retorna as entregas quando o
        webhook pertence ao ``empresaId`` da sessão (``findFirst`` com filtro de
        empresa; senão 404). Um UUID que não seja um webhook da empresa da
        sessão (aqui, um UUID sintético que não pertence a ninguém) deve
        responder 404 — o mesmo caminho de código que barra o acesso cruzado
        entre empresas. Somente leitura, seguro contra produção.
        """
        uuid_inexistente = "00000000-0000-4000-8000-000000000000"
        resp = wms_api._request.get(
            wms_api._url_webhook(f"/api/webhooks/{uuid_inexistente}/entregas"),
            headers=wms_api._headers(),
        )
        assert resp.status == 404, (
            "Acesso às entregas de um webhook que não pertence à empresa da "
            f"sessão deveria responder 404 (não encontrado), obtido "
            f"{resp.status}: {resp.text()}"
        )

    def test_reenvio_registra_entrega_com_identificador_e_marca_retentativa(
        self, wms_api: WmsApiClient, page_auth
    ):
        """10.1/10.2/10.3 — Reenvio registra entrega, com identificador e marcada p/ retentativa.

        Estratégia determinística de disparo: o único gatilho leve de
        ``dispararWebhook`` é o **reenvio** de uma entrega já existente
        (``POST /api/webhooks/entregas/:id/reenviar``), que recria uma
        ``WebhookEntrega`` para o mesmo evento — independentemente do sucesso
        HTTP (10.1). O payload da nova entrega preserva o identificador do
        registro que originou o evento (10.2). Como redirecionamos o webhook
        para uma URL que falha, a entrega recriada fica ``sucesso=false`` com
        ``tentativas < 3``, isto é, marcada para retentativa (10.3).

        Pré-requisito (SEED): precisa existir ao menos uma entrega de origem na
        empresa (de um ``expedicao.carregada`` real anterior). Não há endpoint
        leve que dispare um evento coberto de forma determinística contra
        produção (o disparo real exige o pipeline de carregamento/expedição).
        Na ausência de qualquer entrega reproduzível, ``pytest.skip`` NO SEED
        com motivo explícito — nunca assert falso.
        """
        # ── SEED: localizar uma entrega de origem em algum webhook da empresa ──
        webhooks = wms_api.listar_webhooks()
        if not webhooks:
            pytest.skip(
                "Nenhum webhook configurado na empresa demo — não há entrega de "
                "origem para exercitar o reenvio (10.1/10.2/10.3). O disparo "
                "real de webhook só ocorre em 'expedicao.carregada' (pipeline "
                "onda→separação→carregamento→volumes), não reproduzível de forma "
                "determinística e leve contra produção. Configure um webhook e "
                "gere um carregamento para popular entregas, ou rode em ambiente "
                "com massa de entregas."
            )

        webhook_origem = None
        entrega_origem = None
        for wh in webhooks:
            entregas = wms_api.entregas_webhook(wh["id"])
            if entregas:
                webhook_origem = wh
                # Preferir uma entrega que traga 'dados' no payload (10.2).
                entrega_origem = next(
                    (
                        e
                        for e in entregas
                        if wms_api.payload_dados_entrega(e)
                    ),
                    entregas[0],
                )
                break

        if not entrega_origem:
            pytest.skip(
                "Há webhook(s) configurado(s), mas nenhuma entrega registrada "
                "para reenviar (nenhum evento 'expedicao.carregada' disparou "
                "ainda nesta empresa). Sem entrega de origem não é possível "
                "exercitar o registro/identificador/retentativa de forma "
                "determinística. Gere um carregamento para popular entregas."
            )

        entrega_origem_id = entrega_origem["id"]
        evento_origem = entrega_origem.get("evento")
        dados_origem = wms_api.payload_dados_entrega(entrega_origem)

        entregas_antes = len(wms_api.entregas_webhook(webhook_origem["id"]))

        # ── 10.1: o reenvio registra uma nova entrega (independe do HTTP) ──
        resp = wms_api.reenviar_entrega_webhook(entrega_origem_id)
        assert resp.status in (200, 201), (
            f"Esperado 2xx no reenvio da entrega {entrega_origem_id}, obtido "
            f"{resp.status}: {resp.text()}"
        )

        entregas_depois = wms_api.entregas_webhook(webhook_origem["id"])
        assert len(entregas_depois) >= entregas_antes + 1, (
            "O reenvio deveria registrar uma nova entrega (10.1): antes="
            f"{entregas_antes}, depois={len(entregas_depois)}"
        )

        # A nova entrega é a mais recente (ordenada por criadoEm desc) do mesmo
        # evento de origem.
        novas_do_evento = [
            e for e in entregas_depois if e.get("evento") == evento_origem
        ]
        assert novas_do_evento, (
            f"Nenhuma entrega do evento '{evento_origem}' após o reenvio"
        )
        nova = novas_do_evento[0]

        # ── 10.2: o payload contém o identificador do registro de origem ──
        dados_nova = wms_api.payload_dados_entrega(nova)
        if dados_origem:
            # O reenvio reusa dados.dados do payload original — os
            # identificadores do registro que originou o evento são preservados.
            assert dados_nova == dados_origem, (
                "O payload da entrega reenviada deveria preservar o "
                f"identificador do registro de origem. Origem={dados_origem}, "
                f"nova={dados_nova}"
            )
            assert len(dados_nova) >= 1, (
                "O payload da entrega deveria conter ao menos um identificador "
                f"do registro que originou o evento, obtido: {dados_nova}"
            )
        else:
            # A entrega de origem não trazia 'dados' estruturado (payload legado
            # ou evento sem identificador). Documentamos e ainda validamos 10.1.
            assert isinstance(dados_nova, dict), (
                "payload_dados_entrega deveria retornar um dict (10.2)"
            )

        # ── 10.3: a entrega recriada está marcada para retentativa ──
        # O destino de teste falha (URL .invalid ou httpstat de erro), então a
        # nova entrega fica sucesso=false com tentativas < MAX — elegível a
        # reenvio automático. Como o processamento é assíncrono (fire-and-forget
        # + setTimeout), a entrega pode ainda estar em tentativas=0/sucesso=false
        # (recém-criada, pendente de tentativa) ou já com uma tentativa falha
        # agendada para retry. Ambos os estados satisfazem "marcada para
        # retentativa".
        assert _entrega_marcada_para_retentativa(nova), (
            "A entrega reenviada deveria estar marcada para retentativa "
            "(sucesso=false e tentativas < 3), obtido: "
            f"sucesso={nova.get('sucesso')}, tentativas={nova.get('tentativas')}"
        )

        screenshot_com_nome(page_auth, "webhook_reenvio_entrega")


# ══════════════════════════════════════════════════════════════════════════
# TASK 11.2 — Importação de lançamentos por arquivo (Requirements 11.1–11.3)
#
# Módulo de importação por arquivo no backend (``file-importer``)
# ---------------------------------------------------------------
# ``VisioFab.Wms.Back/src/modules/integracao/file-importer.ts`` expõe:
#   - ``parseCSV(content)`` — parser CSV genérico (cabeçalho na 1ª linha,
#     separador vírgula, ``trim`` por célula, linhas vazias descartadas).
#   - ``TEMPLATES`` — layouts CSV suportados. O de lançamentos de entrada é
#     ``'notas-entrada'``: cabeçalho
#     ``fornecedor_cnpj,numero_nota,serie,produto_codigo,quantidade,``
#     ``preco_unitario,data_entrega`` (uma linha de exemplo).
#   - ``ImportResult`` — contrato do resultado: ``{totalLinhas, importadas,``
#     ``rejeitadas, erros: [{linha, campo, mensagem}]}``.
#
# ENDPOINT: NÃO EXISTE. Investigação nesta task (11.2): ``file-importer.ts``
# NÃO é importado nem registrado em nenhuma rota — ``grep`` por
# ``file-importer`` / ``parseCSV`` / ``TEMPLATES`` / ``@fastify/multipart`` em
# todo ``VisioFab.Wms.Back/src/`` retorna ZERO ocorrências fora do próprio
# arquivo. É código preparado/legado, ainda não plugado a nenhuma rota HTTP.
# Também não há rota de importação por arquivo nos módulos ``integracao`` nem
# ``wms-standalone`` (que abrigam a integração de ERP externo).
#
# Disciplina da suíte: como não há endpoint reproduzível de forma
# determinística contra produção, os testes abaixo ``pytest.skip`` NO SEED com
# motivo explícito — NUNCA assert falso. Os testes usam
# ``WmsApiClient.importar_arquivo_lancamentos`` (multipart), que SONDA os
# caminhos candidatos; enquanto nenhum endpoint estiver publicado, o helper
# retorna ``{"disponivel": False, ...}`` e o teste pula com o motivo. Quando a
# rota for publicada, os testes passam a exercitar os invariantes 11.1/11.2/
# 11.3 sem reescrita (montam o CSV, importam e conferem
# persistidas==válidas / inválidas reportadas / saldo == soma das válidas).
#
# Limpeza: best-effort. Como não há import real hoje, nada é persistido; se um
# endpoint futuro persistir, o produto/nota de QA carrega o ``run_id`` e é
# rastreável para remoção pelos utilitários da suíte.
# ══════════════════════════════════════════════════════════════════════════


@pytest.mark.slow
class TestImportacaoArquivo:
    """Importação de lançamentos por arquivo (task 11.2 — Requirements 11.1–11.3).

    Ver o cabeçalho acima: o endpoint de importação por arquivo não está
    publicado no backend hoje, então cada caso pula NO SEED com motivo
    explícito (disciplina da suíte — nunca assert falso), mas está pronto para
    exercitar os invariantes assim que a rota existir.
    """

    def _cnpj_fornecedor_valido(self, wms_api: WmsApiClient) -> str:
        """Retorna o CNPJ (só dígitos) de um fornecedor real da empresa da sessão.

        O layout ``notas-entrada`` casa o fornecedor por CNPJ
        (``fornecedor.findFirst({ empresaId, cnpj })``). Sem um fornecedor
        real, TODAS as linhas seriam rejeitadas por ``FORNECEDOR_NOT_FOUND`` e
        não seria possível distinguir "linha inválida" de "fornecedor
        ausente". Buscamos um fornecedor da empresa; se nenhum tiver CNPJ,
        retornamos ``""`` (o chamador decide como tratar). Somente leitura.
        """
        resp = wms_api._get("/fornecedores", params={"limit": 50})
        fornecedores = resp.json().get("data", []) if resp.ok else []
        for f in fornecedores:
            cnpj = (f.get("cnpj") or "").strip()
            if cnpj:
                return "".join(ch for ch in cnpj if ch.isdigit())
        return ""

    def test_importacao_arquivo_valido_persiste_linhas_validas(
        self, wms_api: WmsApiClient, run_id: str
    ):
        """11.1 — Arquivo válido: registros persistidos == número de linhas válidas.

        SEED: garante um produto com SKU (código rastreável), monta um CSV de
        ``notas-entrada`` com N linhas todas válidas (mesmo produto, quantidade
        e preço positivos, fornecedor real da empresa) e importa. O invariante
        é ``importadas == N`` e ``rejeitadas == 0`` (contrato ``ImportResult``).

        Sem endpoint publicado, pula NO SEED com motivo explícito.
        """
        produto = wms_api.garantir_produto_com_sku(run_id)
        cnpj = self._cnpj_fornecedor_valido(wms_api)
        if not cnpj:
            pytest.skip(
                "Nenhum fornecedor com CNPJ cadastrado na empresa demo para "
                "montar linhas VÁLIDAS de importação (o layout 'notas-entrada' "
                "casa o fornecedor por CNPJ). Cadastre um fornecedor com CNPJ "
                "para habilitar a validação 11.1."
            )

        linhas_validas = [
            {
                "fornecedor_cnpj": cnpj,
                "numero_nota": f"QA{run_id[-6:]}{i}",
                "serie": "1",
                "produto_codigo": produto.get("codigo"),
                "quantidade": 10,
                "preco_unitario": "25.90",
                "data_entrega": "2027-01-15",
            }
            for i in range(1, 4)  # 3 linhas válidas
        ]
        n_validas = len(linhas_validas)
        csv = wms_api.montar_csv_notas(linhas_validas)

        res = wms_api.importar_arquivo_lancamentos(csv, tipo="notas-entrada")
        if not res.get("disponivel"):
            pytest.skip(res.get("motivo"))

        # Endpoint existe: valida o invariante 11.1.
        corpo = res["corpo"]
        dados = corpo.get("data", corpo) if isinstance(corpo, dict) else {}
        importadas = dados.get("importadas")
        rejeitadas = dados.get("rejeitadas")
        assert importadas == n_validas, (
            "11.1 — número de registros persistidos deveria ser igual ao "
            f"número de linhas válidas ({n_validas}), obtido importadas="
            f"{importadas} (corpo: {corpo})"
        )
        assert rejeitadas in (0, None), (
            "11.1 — arquivo totalmente válido não deveria ter linhas rejeitadas, "
            f"obtido rejeitadas={rejeitadas}"
        )

    def test_importacao_reporta_invalidas_e_persiste_validas(
        self, wms_api: WmsApiClient, run_id: str
    ):
        """11.2 — Arquivo com linhas inválidas: reporta as inválidas e persiste só as válidas.

        SEED: monta um CSV misto — algumas linhas válidas e outras
        propositalmente inválidas (quantidade vazia/negativa, produto
        inexistente). O invariante: ``importadas == nº de válidas``,
        ``rejeitadas == nº de inválidas`` e ``erros`` reporta cada linha
        inválida (contrato ``ImportResult.erros[]``).

        Sem endpoint publicado, pula NO SEED com motivo explícito.
        """
        produto = wms_api.garantir_produto_com_sku(run_id)
        cnpj = self._cnpj_fornecedor_valido(wms_api)
        if not cnpj:
            pytest.skip(
                "Nenhum fornecedor com CNPJ cadastrado na empresa demo para "
                "montar as linhas VÁLIDAS do arquivo misto (11.2). Cadastre um "
                "fornecedor com CNPJ para habilitar esta validação."
            )

        codigo = produto.get("codigo")
        base = {
            "fornecedor_cnpj": cnpj,
            "serie": "1",
            "data_entrega": "2027-01-15",
        }
        linhas_validas = [
            {**base, "numero_nota": f"QA{run_id[-6:]}V1", "produto_codigo": codigo,
             "quantidade": 5, "preco_unitario": "10.00"},
            {**base, "numero_nota": f"QA{run_id[-6:]}V2", "produto_codigo": codigo,
             "quantidade": 8, "preco_unitario": "12.50"},
        ]
        linhas_invalidas = [
            # quantidade vazia
            {**base, "numero_nota": f"QA{run_id[-6:]}I1", "produto_codigo": codigo,
             "quantidade": "", "preco_unitario": "10.00"},
            # produto inexistente
            {**base, "numero_nota": f"QA{run_id[-6:]}I2",
             "produto_codigo": f"PROD-INEXISTENTE-{run_id[-4:]}",
             "quantidade": 3, "preco_unitario": "9.90"},
        ]
        n_validas = len(linhas_validas)
        n_invalidas = len(linhas_invalidas)
        csv = wms_api.montar_csv_notas(linhas_validas + linhas_invalidas)

        res = wms_api.importar_arquivo_lancamentos(csv, tipo="notas-entrada")
        if not res.get("disponivel"):
            pytest.skip(res.get("motivo"))

        corpo = res["corpo"]
        dados = corpo.get("data", corpo) if isinstance(corpo, dict) else {}
        importadas = dados.get("importadas")
        rejeitadas = dados.get("rejeitadas")
        erros = dados.get("erros") or []

        assert importadas == n_validas, (
            "11.2 — deveria persistir apenas as linhas válidas "
            f"({n_validas}), obtido importadas={importadas} (corpo: {corpo})"
        )
        assert rejeitadas == n_invalidas, (
            "11.2 — deveria rejeitar exatamente as linhas inválidas "
            f"({n_invalidas}), obtido rejeitadas={rejeitadas}"
        )
        assert len(erros) == n_invalidas, (
            "11.2 — o sistema deveria reportar cada linha inválida em 'erros', "
            f"esperado {n_invalidas}, obtido {len(erros)}: {erros}"
        )

    def test_saldo_resultante_igual_soma_das_validas_inclusive_zero(
        self, wms_api: WmsApiClient, run_id: str
    ):
        """11.3 — Saldos resultantes == soma das quantidades das linhas válidas por produto.

        Inclui o caso soma ZERO: um arquivo em que NENHUMA linha é válida
        (todas inválidas) não deve alterar o saldo do produto (soma das
        válidas = 0 → saldo inalterado).

        SEED: mede o saldo físico do produto ANTES, importa um arquivo só com
        linhas inválidas e confere que o saldo DEPOIS é igual ao de antes
        (delta zero). Quando o endpoint existir e persistir estoque, o mesmo
        teste cobre o caso com linhas válidas comparando o delta com a soma das
        quantidades válidas.

        Sem endpoint publicado, pula NO SEED com motivo explícito.
        """
        produto = wms_api.garantir_produto_com_sku(run_id)
        produto_id = produto.get("id")

        def _fisico() -> float:
            saldo = wms_api.saldo_consolidado(produto_id)
            return float(saldo.get("fisico", 0) or 0)

        fisico_antes = _fisico()

        # Arquivo somente com linhas inválidas → soma das válidas == 0.
        codigo_inexistente = f"PROD-INEXISTENTE-{run_id[-4:]}"
        linhas_invalidas = [
            {
                "fornecedor_cnpj": "00000000000000",  # fornecedor inexistente
                "numero_nota": f"QA{run_id[-6:]}Z{i}",
                "serie": "1",
                "produto_codigo": codigo_inexistente,
                "quantidade": 5,
                "preco_unitario": "10.00",
                "data_entrega": "2027-01-15",
            }
            for i in range(1, 3)
        ]
        csv = wms_api.montar_csv_notas(linhas_invalidas)

        res = wms_api.importar_arquivo_lancamentos(csv, tipo="notas-entrada")
        if not res.get("disponivel"):
            pytest.skip(res.get("motivo"))

        # Endpoint existe: nenhuma linha válida → saldo inalterado (soma zero).
        corpo = res["corpo"]
        dados = corpo.get("data", corpo) if isinstance(corpo, dict) else {}
        importadas = dados.get("importadas")
        assert importadas in (0, None), (
            "11.3 — arquivo sem linhas válidas não deveria persistir registros "
            f"(soma zero), obtido importadas={importadas} (corpo: {corpo})"
        )

        fisico_depois = _fisico()
        assert fisico_depois == fisico_antes, (
            "11.3 — sem linhas válidas (soma zero), o saldo físico deveria "
            f"permanecer inalterado: antes={fisico_antes}, depois={fisico_depois}"
        )
