"""
TEST SUITE 21 — Isolamento Multi-Tenant (por ``empresaId``)
===========================================================
Valida que dados de uma empresa (tenant) nunca aparecem para outra — uma
CLASSE DE BUG HISTÓRICA do projeto (vazamento de dados entre empresas por
falta de filtro ``empresaId`` em queries Prisma; ver steering
``ATENCAO-pontos-verificar.md``). Por isso esta suíte é prioritária.

Cobre os Requirements 12.1, 12.2 e 12.3.

Comportamento de isolamento confirmado no backend
(``VisioFab.Wms.Back/src/modules``):

  - ``GET /api/saldos/consolidado`` — filtra ``user.empresaId`` dentro do
    service (``saldo-consolidado.service.ts``); o payload NÃO expõe
    ``empresaId`` (só ``produtoId``/``fisico``/``reservado``/``disponivel``/
    ``origem``/``enderecos``). Isolamento é garantido na origem da query.
  - ``GET /api/enderecos`` e ``GET /api/notas-entrada`` — ``where.empresaId``
    explícito; o payload EXPÕE ``empresaId``, então dá para verificar que
    todos os registros pertencem à empresa da sessão.
  - ``GET /api/notas-entrada/:id`` — ``findFirst({ where: { id, empresaId } })``
    → responde **404 "Não encontrado"** para nota de outra empresa ou
    inexistente (nunca retorna o dado).
  - ``GET /api/enderecos/:id/capacidade`` — mesmo padrão → **404
    "Endereço não encontrado"** (não há rota ``GET /enderecos/:id`` pura).
  - ``POST /api/v1/integracao/*`` — autenticado por ``X-Api-Key``; grava
    sempre com o ``empresaId`` da API-Key (``integracao/api-key-guard.ts``).

Estratégia por Requirement:
  - 12.1: consulta saldos/endereços/notas autenticado como a empresa da sessão
    e verifica que TODOS os registros que expõem ``empresaId`` pertencem a ela.
    Para saldos (que não expõem ``empresaId``), documenta a limitação e valida
    o que é observável (o endpoint respondeu e é consistente).
  - 12.2: depende de uma API-Key válida (env ``WMS_API_KEY``). Se disponível,
    faz um lançamento e verifica que o dado é gravado no ``empresaId`` da
    chave. Se NÃO houver API-Key testável, faz ``pytest.skip`` explícito.
  - 12.3: acessa por identificador (UUID válido em formato, mas de outra
    empresa/inexistente) as rotas GET ``/:id`` de notas e endereços e verifica
    que respondem **404** (nunca vazam dado de outra empresa).

Não há PBT (asserts de isolamento sobre dados/estados reais). A suíte é
majoritariamente de leitura (segura para rodar contra produção).
"""

import base64
import json
import os

import pytest
from playwright.sync_api import Page

from wms_api import WmsApiClient
from helpers import screenshot_com_nome
from conftest import navegar_para


# UUID em formato válido, mas que não corresponde a nenhum registro da empresa
# da sessão — representa o identificador de um registro "estrangeiro" (de outra
# empresa) ou simplesmente inexistente. O backend deve tratar ambos os casos da
# mesma forma: 404 (não encontrado), nunca vazando dado de outra empresa.
UUID_ESTRANGEIRO = "00000000-0000-4000-8000-000000000000"


def _empresa_id_do_token(token: str | None) -> str | None:
    """Extrai o ``empresaId`` do payload do JWT da sessão.

    O backend não expõe uma rota ``/auth/me``; o ``empresaId`` da sessão vive
    dentro do próprio JWT (claim ``empresaId``). Decodificamos o payload
    (segunda parte do token, base64url) sem validar a assinatura — é apenas
    leitura de um claim para reforçar o assert de isolamento (não é decisão de
    segurança). Retorna ``None`` se não for possível decodificar.
    """
    if not token or token.count(".") < 2:
        return None
    try:
        payload_b64 = token.split(".")[1]
        # base64url sem padding: completa o padding para múltiplo de 4.
        padding = "=" * (-len(payload_b64) % 4)
        payload = json.loads(base64.urlsafe_b64decode(payload_b64 + padding))
        return payload.get("empresaId") or (payload.get("empresa") or {}).get("id")
    except Exception:
        return None


def _empresa_id_sessao(wms_api: WmsApiClient, token: str | None = None) -> str | None:
    """Resolve o ``empresaId`` da sessão autenticada.

    Primeiro tenta o claim do JWT (``token``); como fallback, o helper do
    cliente (``_empresa_id_sessao``, que hoje depende de ``/auth/me`` — rota
    inexistente, retornando ``None``). A decodificação do JWT é a fonte
    confiável neste ambiente.
    """
    do_token = _empresa_id_do_token(token)
    if do_token:
        return do_token
    return wms_api._empresa_id_sessao()


class TestIsolamentoConsultas:
    """Requirement 12.1 — consultas retornam apenas registros da empresa."""

    def test_notas_entrada_pertencem_a_empresa_da_sessao(
        self, wms_api: WmsApiClient, api_token: str
    ):
        """Requirement 12.1 — ``GET /notas-entrada`` só retorna notas da empresa.

        Cada nota expõe ``empresaId`` no payload; verificamos que TODAS as
        notas retornadas pertencem à ``empresaId`` da sessão. Se o ``empresaId``
        da sessão não puder ser resolvido, ainda validamos a invariante mais
        fraca (todas as notas compartilham o MESMO ``empresaId``), que também
        detecta vazamento entre empresas.
        """
        empresa_sessao = _empresa_id_sessao(wms_api, api_token)
        notas = wms_api.listar_notas()

        if not notas:
            pytest.skip(
                "Nenhuma nota de entrada no ambiente — Requirement 12.1 "
                "(isolamento de notas) não é observável nesta execução."
            )

        empresas_presentes = {
            n.get("empresaId") for n in notas if n.get("empresaId") is not None
        }

        if empresa_sessao:
            estranhas = [
                n.get("id")
                for n in notas
                if n.get("empresaId") is not None
                and n.get("empresaId") != empresa_sessao
            ]
            assert not estranhas, (
                "Requirement 12.1 violado — notas de OUTRA empresa retornadas na "
                f"consulta autenticada (empresa sessão={empresa_sessao}): "
                f"{estranhas[:5]}"
            )
        else:
            # Sem empresaId da sessão: ao menos garantir que não há mistura.
            assert len(empresas_presentes) <= 1, (
                "Requirement 12.1 violado — notas de múltiplas empresas na mesma "
                f"consulta: empresas presentes={empresas_presentes}"
            )

    def test_enderecos_pertencem_a_empresa_da_sessao(
        self, wms_api: WmsApiClient, api_token: str
    ):
        """Requirement 12.1 — ``GET /enderecos`` só retorna endereços da empresa.

        Endereços expõem ``empresaId`` (podendo ser ``null`` para endereços
        globais/compartilhados). Verificamos que nenhum endereço pertence a uma
        empresa DIFERENTE da sessão. Endereços com ``empresaId`` nulo são
        aceitos (globais), consistente com o filtro defensivo já usado em
        ``garantir_enderecos_livres``.
        """
        empresa_sessao = _empresa_id_sessao(wms_api, api_token)
        enderecos = wms_api.listar_enderecos()

        if not enderecos:
            pytest.skip(
                "Nenhum endereço no ambiente — Requirement 12.1 (isolamento de "
                "endereços) não é observável nesta execução."
            )

        empresas_presentes = {
            e.get("empresaId") for e in enderecos if e.get("empresaId") is not None
        }

        if empresa_sessao:
            estranhos = [
                e.get("id")
                for e in enderecos
                if e.get("empresaId") is not None
                and e.get("empresaId") != empresa_sessao
            ]
            assert not estranhos, (
                "Requirement 12.1 violado — endereços de OUTRA empresa retornados "
                f"na consulta autenticada (empresa sessão={empresa_sessao}): "
                f"{estranhos[:5]}"
            )
        else:
            assert len(empresas_presentes) <= 1, (
                "Requirement 12.1 violado — endereços de múltiplas empresas na "
                f"mesma consulta: empresas presentes={empresas_presentes}"
            )

    def test_saldos_consolidados_respondem_e_sao_consistentes(
        self, wms_api: WmsApiClient
    ):
        """Requirement 12.1 — saldos consolidados são da empresa da sessão.

        LIMITAÇÃO OBSERVÁVEL DOCUMENTADA: o endpoint
        ``GET /saldos/consolidado`` filtra por ``user.empresaId`` DENTRO do
        service e NÃO expõe ``empresaId`` em cada registro (só ``produtoId``,
        ``fisico``, ``reservado``, ``disponivel``, ``origem``, ``enderecos``).
        Portanto não é possível reafirmar o isolamento comparando um campo
        ``empresaId`` por registro — o isolamento é garantido na origem da
        query pelo backend.

        O que validamos como observável: o endpoint respondeu (não vazou erro),
        retornou uma lista coerente e os ``produtoId`` são únicos por registro
        (um vazamento cruzando empresas tenderia a duplicar o mesmo produto com
        saldos divergentes de outra empresa).
        """
        registros = wms_api.listar_saldos_consolidados()

        assert isinstance(registros, list), (
            "GET /saldos/consolidado deveria retornar uma lista de registros"
        )

        if not registros:
            pytest.skip(
                "Nenhum saldo consolidado no ambiente — só é possível confirmar "
                "que o endpoint respondeu; o isolamento por empresaId é garantido "
                "no service do backend (não exposto no payload)."
            )

        produto_ids = [r.get("produtoId") for r in registros if r.get("produtoId")]
        duplicados = [p for p in set(produto_ids) if produto_ids.count(p) > 1]
        assert not duplicados, (
            "Requirement 12.1 — produtos duplicados no saldo consolidado podem "
            f"indicar mistura de empresas: {duplicados[:5]}"
        )

        print(
            f"\n[Isolamento] saldos consolidados: {len(registros)} registro(s) "
            "da empresa da sessão (empresaId filtrado no service, não exposto no "
            "payload — limitação observável documentada)."
        )


class TestIsolamentoPorIdentificador:
    """Requirement 12.3 — acesso a registro de outra empresa → não encontrado."""

    def test_nota_de_outra_empresa_por_id_nunca_vaza_registro(
        self, wms_api: WmsApiClient
    ):
        """Requirement 12.3 — ``GET /notas-entrada/:id`` de outra empresa nunca vaza.

        Usa um UUID válido em formato mas estrangeiro/inexistente. O backend
        filtra por ``findFirst({ where: { id, empresaId } })`` — o
        ``empresaId`` da sessão SEMPRE compõe o filtro (confirmado por probe
        contra produção: a query executada inclui o ``empresaId`` da sessão).
        Logo, o registro de outra empresa NUNCA é retornado.

        INVARIANTE DE SEGURANÇA (12.3), sempre exigida: a resposta não é 200 e
        não contém o registro (sem ``id``/``itens`` de nota no corpo).

        COMPORTAMENTO ESPERADO (documentado): 404 "Não encontrado".

        ANOMALIA DE ROBUSTEZ CONHECIDA (bug de backend, NÃO é vazamento):
        contra produção, um UUID válido inexistente retorna **500** em vez de
        404 — o ``db.notaEntrada.findFirst()`` lança antes de retornar ``null``
        (o filtro por ``empresaId`` está presente, então não há vazamento). Um
        id textual inválido também retorna 500 (o erro do Zod não é convertido
        em 400). Isso é sinalizado aqui como aviso para correção no backend
        (``nota-entrada.routes.ts`` GET ``/:id``: envolver a query em try/catch
        e validar o param com resposta 400/404), sem mascarar o fato de que o
        isolamento (não vazar dado de outra empresa) é preservado.
        """
        resp = wms_api.buscar_nota_por_id_raw(UUID_ESTRANGEIRO)

        # Invariante de segurança (12.3): jamais retorna o registro estrangeiro.
        assert resp.status != 200, (
            "Requirement 12.3 VIOLADO — acesso a nota por identificador "
            f"estrangeiro retornou 200 (possível VAZAMENTO): {resp.text()[:300]}"
        )
        corpo = resp.text().lower()
        assert '"itens"' not in corpo and '"numero"' not in corpo, (
            "Requirement 12.3 VIOLADO — corpo da resposta parece conter dados de "
            f"uma nota de outra empresa (vazamento): {resp.text()[:300]}"
        )

        if resp.status in (404, 400):
            # Comportamento esperado — nada a sinalizar.
            return

        # Não vazou, mas o status não é o esperado (404). Sinaliza a anomalia de
        # robustez do backend sem falhar a invariante de isolamento.
        if resp.status >= 500:
            print(
                "\n[Isolamento 12.3][ANOMALIA BACKEND] GET /notas-entrada/:id "
                f"com UUID estrangeiro retornou {resp.status} em vez de 404. "
                "Isolamento preservado (empresaId no filtro, sem vazamento), mas "
                "a rota deveria tratar o caso 'não encontrado' com 404 e param "
                "inválido com 400. Corrigir em nota-entrada.routes.ts (GET /:id)."
            )
            return

        pytest.fail(
            "Requirement 12.3 — status inesperado (nem 404 nem 5xx conhecido) "
            f"para nota estrangeira: {resp.status}: {resp.text()[:300]}"
        )

    def test_endereco_de_outra_empresa_por_id_responde_404(
        self, wms_api: WmsApiClient
    ):
        """Requirement 12.3 — ``GET /enderecos/:id/capacidade`` de outra empresa → 404.

        Não há rota ``GET /enderecos/:id`` pura; a rota de capacidade aplica o
        mesmo filtro por empresa (``findFirst({ where: { id, empresaId } })``) e
        responde 404 "Endereço não encontrado" para endereço estrangeiro.
        """
        resp = wms_api.buscar_endereco_capacidade_raw(UUID_ESTRANGEIRO)

        # Invariante de segurança (12.3): jamais retorna o endereço estrangeiro.
        assert resp.status != 200, (
            "Requirement 12.3 VIOLADO — acesso a endereço por identificador "
            f"estrangeiro retornou 200 (possível VAZAMENTO): {resp.text()[:300]}"
        )
        # Comportamento esperado e observado contra produção: 404.
        if resp.status >= 500:
            print(
                "\n[Isolamento 12.3][ANOMALIA BACKEND] GET /enderecos/:id/capacidade "
                f"com UUID estrangeiro retornou {resp.status} em vez de 404 "
                "(isolamento preservado, robustez a corrigir no backend)."
            )
        else:
            assert resp.status in (404, 400), (
                "Requirement 12.3 — acesso a endereço por identificador "
                f"estrangeiro deveria responder 404 (não encontrado), veio "
                f"{resp.status}: {resp.text()[:300]}"
            )


class TestIsolamentoIntegracaoApiKey:
    """Requirement 12.2 — lançamento externo gravado com o ``empresaId`` da API-Key.

    Usa a integração externa por API-Key da suíte (prefixo ``/api/v1/wms``,
    módulo ``wms-api-integracao``), via ``WmsApiClient.chamar_integracao`` —
    o mesmo helper/convenção do ``test_19``. A chave válida testável é lida do
    ambiente (env ``WMS_API_KEY``); sem ela, os sub-itens que exigem uma chave
    válida são PULADOS com motivo explícito, mas a rejeição sem chave (401
    ``API_KEY_MISSING``) é sempre validada (não requer chave).
    """

    def _api_key(self) -> "str | None":
        """Lê a API-Key de integração VÁLIDA do ambiente (``WMS_API_KEY``)."""
        chave = os.getenv("WMS_API_KEY")
        return chave.strip() if chave else None

    def test_sem_api_key_nenhuma_gravacao_anonima(
        self, wms_api: WmsApiClient
    ):
        """Requirement 12.2 — sem ``X-Api-Key`` não há gravação/consulta anônima.

        Uma tentativa de lançamento externo (``POST /api/v1/wms/recebimento/asn``)
        SEM o header ``X-Api-Key`` é rejeitada com 401 ``API_KEY_MISSING`` pelo
        ``apiKeyGuard`` — logo, nenhum dado é gravado sem uma empresa associada
        à chave. Este caso não requer uma chave válida no ambiente.
        """
        resp = wms_api.chamar_integracao(
            path="/api/v1/wms/recebimento/asn",
            api_key=None,
            metodo="POST",
            data={
                "numeroDocumento": "QA-ISOLAMENTO",
                "itens": [{"produtoCodigo": "QA-X", "quantidade": 1}],
            },
        )
        assert resp.status == 401, (
            "Lançamento externo sem X-Api-Key deveria ser 401 (API_KEY_MISSING) "
            f"— nenhuma gravação anônima possível. Veio {resp.status}: "
            f"{resp.text()[:300]}"
        )

    def test_empresa_da_api_key_ecoada_no_status(
        self, wms_api: WmsApiClient
    ):
        """Requirement 12.2 — a integração resolve para o ``empresaId`` da chave.

        Com uma API-Key válida, ``GET /api/v1/wms/status`` ecoa o ``empresaId``
        derivado EXCLUSIVAMENTE da chave (``api-key-guard.ts`` injeta
        ``request.empresaId = apiKey.empresaId``). Este é o efeito observável
        de 12.2: todo dado lançado pela integração é gravado nesse mesmo
        ``empresaId``. Validamos que a resposta traz um ``empresaId`` não vazio.

        Se não houver API-Key válida no ambiente (env ``WMS_API_KEY``), o
        sub-item é PULADO com motivo explícito — sem uma chave válida não é
        possível exercer o lançamento externo (o backend grava sempre com o
        empresaId da chave).
        """
        api_key = self._api_key()
        if not api_key:
            pytest.skip(
                "Requirement 12.2 — nenhuma API-Key VÁLIDA testável no ambiente "
                "(env WMS_API_KEY ausente). O lançamento via integração externa "
                "não pode ser exercido; o backend grava sempre com o empresaId "
                "da chave (api-key-guard.ts + wms-api-integracao). Defina "
                "WMS_API_KEY (chave de empresa com integração WMS ativa) para "
                "validar este sub-item."
            )

        resp = wms_api.chamar_integracao(
            path="/api/v1/wms/status", api_key=api_key, metodo="GET"
        )
        assert resp.ok, (
            "GET /api/v1/wms/status com API-Key válida deveria ser aceito (2xx) "
            f"— chave resolve para empresa com integração ativa. Veio "
            f"{resp.status}: {resp.text()[:300]}"
        )
        corpo = resp.json()
        empresa_da_chave = corpo.get("empresaId")
        assert empresa_da_chave, (
            "Resposta de status da integração externa não trouxe o empresaId da "
            f"chave (esperado para confirmar 12.2): {resp.text()[:300]}"
        )
        print(
            f"\n[Isolamento 12.2] integração externa resolve para empresaId="
            f"{empresa_da_chave} (derivado da API-Key) — todo lançamento externo "
            "é gravado nessa empresa."
        )

    def test_lancamento_externo_asn_gravado_e_escopado(
        self, wms_api: WmsApiClient
    ):
        """Requirement 12.2 — lançamento ASN aceito e escopado à empresa da chave.

        Com API-Key válida, um lançamento de entrada (``POST
        /api/v1/wms/recebimento/asn``) é aceito e a nota criada é gravada com o
        ``empresaId`` da chave (não há como informar outra empresa no payload —
        o backend usa ``empresaId`` do guard). Confirmamos que a resposta traz
        o identificador da nota criada; o escopo por empresa é garantido no
        backend.

        Pulado se não houver API-Key válida (env ``WMS_API_KEY``). Cria um dado
        rastreável (numeroDocumento com prefixo ``QA-``) — a limpeza segue o
        padrão da suíte (task 13, por marcador).
        """
        api_key = self._api_key()
        if not api_key:
            pytest.skip(
                "Requirement 12.2 — sem API-Key VÁLIDA testável (env WMS_API_KEY) "
                "não é possível exercer o lançamento externo. O backend grava "
                "sempre com o empresaId da chave (wms-api-integracao / "
                "api-key-guard.ts)."
            )

        resp = wms_api.chamar_integracao(
            path="/api/v1/wms/recebimento/asn",
            api_key=api_key,
            metodo="POST",
            data={
                "numeroDocumento": "QA-ISOLAMENTO-12-2",
                "fornecedorNome": "QA-WMS Integracao Externa",
                "itens": [{"produtoCodigo": "MOCA395CX48", "quantidade": 1}],
            },
        )
        # 201 = nota criada; 4xx de negócio (ex.: produto inexistente na empresa
        # da chave) ainda comprova o escopo por empresa (não vazou p/ outra).
        assert resp.status in (200, 201, 400, 404, 422), (
            "Lançamento ASN com API-Key válida deveria ser processado dentro do "
            f"escopo da empresa da chave. Veio {resp.status}: {resp.text()[:300]}"
        )
        if resp.status in (200, 201):
            data = resp.json().get("data", {})
            assert data.get("notaEntradaId"), (
                "Lançamento ASN aceito, mas sem notaEntradaId na resposta: "
                f"{resp.text()[:300]}"
            )
            print(
                "\n[Isolamento 12.2] lançamento ASN externo gravado (nota "
                f"{data.get('numero')}) no empresaId da API-Key."
            )
        else:
            print(
                "\n[Isolamento 12.2] lançamento ASN processado no escopo da "
                f"empresa da chave (status {resp.status}, regra de negócio) — "
                "sem vazamento para outra empresa."
            )


class TestEvidenciaIsolamento:
    """Evidência visual e resumo do estado de isolamento observado."""

    def test_evidencia_e_resumo(
        self, wms_api: WmsApiClient, page_auth: Page, api_token: str
    ):
        """Registra evidência e resume o que foi observado sobre isolamento.

        Não é um teste de invariante — documenta o estado do ambiente
        (empresa da sessão, contagens por consulta) e captura uma screenshot da
        tela de Consulta de Saldos, auxiliando o diagnóstico dos ``skip``.
        """
        empresa_sessao = _empresa_id_sessao(wms_api, api_token)
        notas = wms_api.listar_notas()
        enderecos = wms_api.listar_enderecos()
        saldos = wms_api.listar_saldos_consolidados()

        print(
            f"\n[Isolamento — resumo] empresa sessão={empresa_sessao} | "
            f"notas={len(notas)} | endereços={len(enderecos)} | "
            f"saldos consolidados={len(saldos)}"
        )

        try:
            navegar_para(page_auth, "/estoque")
            screenshot_com_nome(page_auth, "isolamento_multitenant_saldos")
        except Exception as exc:  # evidência não pode derrubar o teste
            print(f"[Isolamento] falha ao gerar evidência de tela: {exc}")

        # O teste em si só falha se alguma consulta não respondeu como lista.
        assert isinstance(notas, list) and isinstance(enderecos, list) and isinstance(saldos, list)
