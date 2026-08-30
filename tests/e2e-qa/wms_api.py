"""
Cliente de API do fluxo WMS para a suite de QA (Python + Playwright).

Encapsula as chamadas HTTP autenticadas à API do Vizor usadas pelo cenário
E2E encadeado de recebimento WMS (semeadura de pré-requisitos e verificação
de estado de backend).

Reaproveita o ``APIRequestContext`` do Playwright (``page_auth.request``), de
modo que as chamadas de API compartilham a mesma sessão/TLS do navegador já
autenticado — não é criado um novo cliente HTTP nem uma nova sessão.

Esta é a estrutura base do cliente (task 1.2):
  - ``__init__`` recebe o request context do Playwright, a URL da API e o token.
  - ``_headers()`` monta o cabeçalho ``Authorization: Bearer <token>``.
  - ``_get()`` / ``_post()`` fazem as chamadas e tratam ``status >= 500`` como
    falha dura (assert), pois indica ambiente quebrado.

Os métodos de seed (``garantir_*``, ``criar_nota_entrada``) e de avanço/
verificação de estado (``iniciar_conferencia`` etc.) são declarados aqui como
stubs e serão implementados nas tasks 1.3 e 1.4.
"""

import random
from datetime import datetime, timedelta
from typing import Any, Optional

# Código de produto demo preferido (mesmo usado pelo teste TS de referência),
# com SKU cadastrado (lastro=9, camada=5). O seed tenta reaproveitá-lo antes de
# criar qualquer coisa nova, para não poluir a base demo compartilhada.
CODIGO_PRODUTO_DEMO = "MOCA395CX48"

# Tipos de endereço considerados "livres" para armazenagem (mesma regra do
# teste TS de referência e das rotas de endereçamento do backend).
TIPOS_ENDERECO_LIVRE = ("ARMAZENAGEM", "LIVRE")


class WmsApiClient:
    """Cliente de API do fluxo WMS.

    Args:
        request: O ``APIRequestContext`` do Playwright (``page_auth.request``),
            já autenticado na mesma sessão do navegador.
        api_url: A URL base da API (ex.: ``https://api.vizorerp.com.br/api``),
            sem barra final.
        token: O JWT lido do ``localStorage`` da sessão autenticada.
    """

    def __init__(self, request: Any, api_url: str, token: str):
        self._request = request
        self._api_url = api_url.rstrip("/")
        self._token = token

    # ──────────────────────────────────────────────────────────────
    # Helpers internos
    # ──────────────────────────────────────────────────────────────

    def _headers(self, com_json: bool = False) -> dict:
        """Monta os cabeçalhos HTTP da requisição.

        Sempre inclui ``Authorization: Bearer <token>``. Quando ``com_json``
        é verdadeiro (requisições com corpo JSON), acrescenta o
        ``Content-Type: application/json``.
        """
        headers = {"Authorization": f"Bearer {self._token}"}
        if com_json:
            headers["Content-Type"] = "application/json"
        return headers

    def _url(self, path: str) -> str:
        """Concatena a URL base com o caminho informado."""
        return f"{self._api_url}/{path.lstrip('/')}"

    def _get(self, path: str, params: Optional[dict] = None) -> Any:
        """Executa um GET autenticado.

        Trata ``status >= 500`` como falha dura (assert) — um erro de servidor
        indica ambiente quebrado e não faz sentido continuar o fluxo.
        Retorna o objeto de resposta do Playwright (``APIResponse``).
        """
        resp = self._request.get(
            self._url(path),
            headers=self._headers(),
            params=params or {},
        )
        assert resp.status < 500, (
            f"Falha dura (5xx) em GET {path}: status {resp.status}"
        )
        return resp

    def _post(self, path: str, data: Optional[dict] = None) -> Any:
        """Executa um POST autenticado com corpo JSON.

        Trata ``status >= 500`` como falha dura (assert). Retorna o objeto de
        resposta do Playwright (``APIResponse``).
        """
        resp = self._request.post(
            self._url(path),
            headers=self._headers(com_json=True),
            data=data or {},
        )
        assert resp.status < 500, (
            f"Falha dura (5xx) em POST {path}: status {resp.status}"
        )
        return resp

    def _patch(self, path: str, data: Optional[dict] = None) -> Any:
        """Executa um PATCH autenticado com corpo JSON.

        Trata ``status >= 500`` como falha dura (assert). Retorna o objeto de
        resposta do Playwright (``APIResponse``). Usado pelas transições do
        inventário cíclico (``/inventarios/:id/contar``, ``.../aplicar-ajustes``,
        ``.../concluir``), que o backend expõe como verbo ``PATCH``.
        """
        resp = self._request.patch(
            self._url(path),
            headers=self._headers(com_json=True),
            data=data or {},
        )
        assert resp.status < 500, (
            f"Falha dura (5xx) em PATCH {path}: status {resp.status}"
        )
        return resp

    # ──────────────────────────────────────────────────────────────
    # Seed / garantia de pré-requisitos (task 1.3)
    # ──────────────────────────────────────────────────────────────

    def _skus_do_produto(self, produto_id: str) -> list:
        """Lista os SKUs de um produto (``GET /skus?produtoId=``).

        Retorna a lista (``data``) ou ``[]`` quando a resposta não é OK — o
        chamador decide se isso é motivo para criar um SKU novo.
        """
        resp = self._get("/skus", params={"produtoId": produto_id})
        if not resp.ok:
            return []
        return resp.json().get("data", []) or []

    @staticmethod
    def _sku_tem_paletizacao(sku: dict, lastro: int, camada: int) -> bool:
        """Verifica se um SKU atende ao lastro/camada exigidos.

        Considera atendido quando o SKU tem lastro e camada definidos e
        maiores que zero (o valor exato só precisa existir para a distribuição
        inteligente funcionar; exigir a igualdade estrita causaria recriação
        desnecessária de dados na base demo).
        """
        s_lastro = sku.get("lastro")
        s_camada = sku.get("camada")
        return bool(s_lastro) and bool(s_camada) and s_lastro > 0 and s_camada > 0

    def garantir_produto_com_sku(
        self, run_id: str, lastro: int = 9, camada: int = 5
    ) -> dict:
        """Garante um produto que tenha SKU com lastro/camada.

        Idempotente — consulta (GET) antes de criar (POST):

        1. Procura o produto demo preferido (``MOCA395CX48``) via
           ``GET /produtos?search=``. Se existir e já tiver um SKU com
           paletização (lastro/camada > 0), retorna esse produto sem criar
           nada.
        2. Se o produto demo existir mas não tiver SKU adequado, cria um SKU
           com o lastro/camada informados e retorna o produto.
        3. Só se o produto demo não existir em toda a base é que cria um
           produto de QA rastreável (código ``QA-{run_id}``) + SKU.

        Retorna o dicionário do produto (``{id, codigo, nome, ...}``),
        acrescido da chave ``sku`` com o SKU garantido.
        """
        # 1) Preferir o produto demo existente (código EXATO — o search também
        # casa por nome/EAN, por isso não usamos produtos[0] como fallback aqui).
        resp = self._get(
            "/produtos", params={"search": CODIGO_PRODUTO_DEMO, "limit": 5}
        )
        produtos = resp.json().get("data", []) if resp.ok else []
        produto = next(
            (p for p in produtos if p.get("codigo") == CODIGO_PRODUTO_DEMO), None
        )

        if produto:
            skus = self._skus_do_produto(produto["id"])
            sku_ok = next(
                (s for s in skus if self._sku_tem_paletizacao(s, lastro, camada)),
                None,
            )
            if sku_ok:
                # Pré-requisito já atendido: nada a criar.
                return {**produto, "sku": sku_ok}
            # Produto existe, mas sem SKU de paletização: cria só o SKU.
            sku = self._criar_sku(produto, run_id, lastro, camada, skus)
            return {**produto, "sku": sku}

        # 2) Demo ausente: preferir um produto que JÁ TEM saldo WMS endereçado
        # (portanto comprovadamente ENDEREÇÁVEL pela distribuição inteligente).
        # Um produto de QA "vazio" (fallback do item 3) costuma NÃO ser
        # endereçável neste ambiente (a distribuição retorna alocacoes: [] por
        # falta de atributos/área compatível), quebrando o put-away do seed.
        # Reaproveitar um produto endereçável existente torna o seed
        # determinístico sem depender do produto demo canônico.
        enderecavel = self._produto_enderecavel_existente(lastro, camada)
        if enderecavel:
            return enderecavel

        # 3) Sem demo e sem produto endereçável reaproveitável: cria produto de
        # QA rastreável + SKU (último recurso; pode não ser endereçável, e o
        # teste chamador trata a ausência de alocação como pré-requisito de
        # ambiente — skip no seed).
        produto = self._criar_produto_qa(run_id)
        sku = self._criar_sku(produto, run_id, lastro, camada, [])
        return {**produto, "sku": sku}

    def _produto_enderecavel_existente(
        self, lastro: int, camada: int
    ) -> Optional[dict]:
        """Retorna um produto que já tem saldo WMS (logo, é endereçável) + SKU.

        Percorre os saldos consolidados de origem WMS (produtos com
        ``SaldoEndereco`` real) e devolve o primeiro que tenha um SKU com
        paletização (lastro/camada > 0). Como esse produto já foi endereçado
        antes, a distribuição inteligente sabe alocá-lo — o que torna o seed de
        físico determinístico mesmo sem o produto demo canônico. Retorna
        ``None`` quando nenhum candidato é encontrado (o chamador cai no
        fallback de criação).
        """
        try:
            saldos = self.listar_saldos_consolidados()
        except Exception:
            return None
        wms = [s for s in saldos if (s.get("origem") or "").upper() == "WMS"]
        for s in wms:
            produto_id = s.get("produtoId")
            if not produto_id:
                continue
            # Recupera o produto (código/nome) e garante um SKU de paletização.
            resp = self._get(f"/produtos/{produto_id}")
            if not resp.ok:
                continue
            produto = resp.json()
            if not produto.get("id"):
                continue
            skus = self._skus_do_produto(produto_id)
            sku_ok = next(
                (sk for sk in skus if self._sku_tem_paletizacao(sk, lastro, camada)),
                None,
            )
            if sku_ok:
                return {**produto, "sku": sku_ok}
        return None

    def _criar_produto_qa(self, run_id: str) -> dict:
        """Garante um produto de QA rastreável (fallback quando o demo não existe).

        IDEMPOTENTE: ``Produto`` tem ``@@unique([empresaId, codigo])`` no
        schema. Como o ``run_id`` é fixo por sessão, várias chamadas na mesma
        execução usariam o MESMO código ``QA-{run_id}`` — a segunda criação
        colidiria na unique (Prisma P2002 → HTTP 500). Por isso consultamos
        (GET) o produto pelo código antes de criar (POST) e reutilizamos quando
        já existe, evitando o 500 e a poluição progressiva da base demo.
        """
        codigo = f"QA-{run_id}"

        # 1) Reutiliza se o produto de QA desta execução já existe.
        resp_busca = self._get("/produtos", params={"search": codigo, "limit": 5})
        existentes = resp_busca.json().get("data", []) if resp_busca.ok else []
        ja_existe = next(
            (p for p in existentes if p.get("codigo") == codigo), None
        )
        if ja_existe:
            return ja_existe

        # 2) Não existe: cria.
        payload = {
            "codigo": codigo,
            "nome": f"PRODUTO QA WMS {run_id}",
            "descricao": f"Produto de teste automatizado — {run_id}",
            "unidade": "CX",
            "status": True,
        }
        resp = self._post("/produtos", data=payload)
        # Corrida rara: se dois fluxos criaram em paralelo, o POST pode falhar
        # na unique; nesse caso, relê e reutiliza em vez de estourar.
        if resp.status not in (200, 201):
            resp_relê = self._get("/produtos", params={"search": codigo, "limit": 5})
            recuperado = next(
                (
                    p
                    for p in (resp_relê.json().get("data", []) if resp_relê.ok else [])
                    if p.get("codigo") == codigo
                ),
                None,
            )
            if recuperado:
                return recuperado
        assert resp.status in (200, 201), (
            f"Falha ao criar produto de QA: status {resp.status} — {resp.text()}"
        )
        return resp.json()

    def _criar_sku(
        self,
        produto: dict,
        run_id: str,
        lastro: int,
        camada: int,
        skus_existentes: list,
    ) -> dict:
        """Cria um SKU com paletização (lastro/camada) para o produto.

        A ``sequencia`` é calculada a partir dos SKUs já existentes (maior + 1)
        para não colidir com a restrição de unicidade por produto.
        """
        proxima_seq = 1
        if skus_existentes:
            seqs = [s.get("sequencia", 0) or 0 for s in skus_existentes]
            proxima_seq = max(seqs) + 1

        payload = {
            "produtoId": produto["id"],
            "sequencia": proxima_seq,
            "descricao": f"SKU QA {run_id}",
            "unidade": "CX",
            "qtdEmbalagem": 48,
            "lastro": lastro,
            "camada": camada,
        }
        resp = self._post("/skus", data=payload)
        assert resp.status in (200, 201), (
            f"Falha ao criar SKU para o produto {produto.get('codigo')}: "
            f"status {resp.status} — {resp.text()}"
        )
        return resp.json()

    def garantir_enderecos_livres(self, minimo: int = 3) -> list:
        """Garante >= ``minimo`` endereços ARMAZENAGEM/LIVRE ativos.

        Idempotente — consulta (GET) antes de considerar criar:

        1. Lista endereços via ``GET /enderecos?limit=`` e filtra pelos que
           são do tipo ARMAZENAGEM/LIVRE e estão ativos (``status == True``).
        2. **Isolamento multi-tenant**: filtra a lista pela ``empresaId`` da
           sessão quando o endereço traz esse campo. A steering
           ``ATENCAO-pontos-verificar.md`` documenta que endereços de outras
           empresas já vazaram nas listagens — por segurança, filtramos também
           no cliente (endereços sem ``empresaId`` explícito são aceitos, pois
           podem ser compartilhados/globais).

        Retorna a lista de endereços livres encontrados. Não cria endereços
        automaticamente (a criação depende de CD/Depósito/formato e é feita
        pela UI/seed manual); se o mínimo não for atingido, o chamador decide
        como tratar (o cenário faz ``assert`` do pré-requisito).
        """
        resp = self._get("/enderecos", params={"limit": 200})
        enderecos = resp.json().get("data", []) if resp.ok else []

        empresa_sessao = self._empresa_id_sessao()

        livres = []
        for e in enderecos:
            tipo = e.get("tipo")
            ativo = e.get("status") is True
            if tipo not in TIPOS_ENDERECO_LIVRE or not ativo:
                continue
            # Filtro multi-tenant defensivo (ver docstring).
            emp = e.get("empresaId")
            if empresa_sessao and emp and emp != empresa_sessao:
                continue
            livres.append(e)

        return livres

    def _empresa_id_sessao(self) -> Optional[str]:
        """Descobre o ``empresaId`` da sessão autenticada via ``GET /auth/me``.

        Usado para o filtro multi-tenant defensivo em
        ``garantir_enderecos_livres``. Retorna ``None`` se não conseguir
        resolver (nesse caso o filtro por empresa é simplesmente pulado).
        """
        try:
            resp = self._get("/auth/me")
            if not resp.ok:
                return None
            corpo = resp.json()
            # A resposta pode expor o empresaId direto ou aninhado.
            return (
                corpo.get("empresaId")
                or (corpo.get("user") or {}).get("empresaId")
                or (corpo.get("empresa") or {}).get("id")
            )
        except Exception:
            return None

    @staticmethod
    def lote_do_run(run_id: str) -> str:
        """Retorna o lote canônico rastreável de uma execução, cabendo em VarChar(30).

        FONTE ÚNICA DE VERDADE do lote usado pela suíte. A coluna
        ``ItemNotaEntrada.lote`` é ``VarChar(30)`` no schema; o ``run_id``
        completo (``QA-WMS-YYYYMMDD-HHMMSS-RAND4`` = 27 chars) faria
        ``LOTE-{run_id}`` estourar 30 (Prisma P2000 → HTTP 500). Por isso o lote
        usa apenas a parte única do run_id (sem o prefixo ``QA-WMS-``):
        ``LOTE-YYYYMMDD-HHMMSS-RAND4`` (<= 26 chars). Todos os testes que
        precisam FILTRAR/comparar o lote gravado devem usar este método (em vez
        de reconstruir ``LOTE-{run_id}``), garantindo que o valor esperado
        bata com o efetivamente persistido.
        """
        sufixo_run = run_id.replace("QA-WMS-", "", 1)
        return f"LOTE-{sufixo_run}"[:30]

    def criar_nota_entrada(
        self, run_id: str, produto: dict, quantidade: int = 50
    ) -> dict:
        """Cria uma nota de entrada rastreável e retorna ``{id, numero, itens}``.

        Marca o ``fornecedor`` com ``"QA-WMS {run_id}"`` e o ``lote`` do item
        com o lote canônico ``lote_do_run(run_id)`` — os marcadores usados para
        localizar e limpar os dados de teste depois. A validade fica bem no
        futuro (2 anos) para não esbarrar em regra de shelf life no caminho
        feliz.

        Esta operação é sempre um POST (cada execução cria a sua própria nota,
        identificada pelo ``run_id`` — não há como reaproveitar uma nota
        anterior sem quebrar o encadeamento do fluxo).
        """
        # Número aleatório de 6 dígitos para não colidir com notas existentes.
        numero = random.randint(100000, 999999)
        validade = (datetime.now() + timedelta(days=730)).strftime("%Y-%m-%d")

        # Lote canônico rastreável (cabe em VarChar(30)) — ver ``lote_do_run``.
        lote = self.lote_do_run(run_id)

        payload = {
            "numero": numero,
            "serie": "1",
            "fornecedor": f"QA-WMS {run_id}",  # marcador rastreável (VarChar(200))
            "tipo": "COMPRA",
            "itens": [
                {
                    "item": 1,
                    "descricao": (
                        f"{produto.get('nome', 'PRODUTO QA')} — {run_id}"
                    ),
                    "codigoProduto": produto.get("codigo", CODIGO_PRODUTO_DEMO),
                    "unidade": "CX",
                    "quantidade": quantidade,
                    "lote": lote,  # marcador rastreável (VarChar(30))
                    "validade": validade,
                }
            ],
        }
        resp = self._post("/notas-entrada", data=payload)
        assert resp.status in (200, 201), (
            f"Falha ao criar nota de entrada: status {resp.status} — {resp.text()}"
        )
        return resp.json()

    # ──────────────────────────────────────────────────────────────
    # Avanço / verificação de estado (task 1.4)
    #
    # Endpoints confirmados no teste TS de referência
    # (``tests/e2e/fluxo-recebimento.spec.ts``) e no backend
    # (``VisioFab.Wms.Back/src/modules``). Onde o TS diverge do design, o TS
    # tem prioridade (é o comportamento real exercitado hoje):
    #   - ``sugerir_enderecamento`` usa GET ``/enderecamento-wms/sugerir-lote``
    #     com query ``notaEntradaId`` (o design supunha POST) — TS test 14.
    #   - ``saldo_consolidado`` usa GET ``/saldos/consolidado?busca=`` e
    #     filtra por ``produtoId`` no cliente (rota ``saldo.routes.ts`` do
    #     backend, prefixo ``/api/saldos``).
    # ──────────────────────────────────────────────────────────────

    def iniciar_conferencia(self, nota_id: str) -> dict:
        """Inicia a conferência de entrada de uma nota (IDEMPOTENTE).

        ``POST /conferencia-entrada/iniciar/:id`` (sem corpo). Retorna a
        conferência com a lista de ``itens`` (cada item traz ``id``, ``lote``,
        ``validade``), usada em seguida por ``conferir_todos``.

        IDEMPOTÊNCIA FRENTE À UI: a tela de conferência (best-effort) pode ter
        iniciado a conferência antes, deixando a nota EM_CONFERENCIA — nesse
        caso o backend responde 422 ("Nota em status ... não pode iniciar
        conferência"). Como só precisamos dos ``itens`` da nota para conferir,
        caímos no ``GET /conferencia-entrada/:notaId`` (detalhe com itens) e
        retornamos a nota, permitindo que ``conferir_todos`` prossiga.
        """
        resp = self._post(f"/conferencia-entrada/iniciar/{nota_id}")
        if resp.status in (200, 201):
            return resp.json()

        # 422 (ou outro 4xx): a nota provavelmente já está EM_CONFERENCIA/
        # CONFERIDA (a UI iniciou). Recupera os itens pelo detalhe da nota.
        if 400 <= resp.status < 500:
            det = self._get(f"/conferencia-entrada/{nota_id}")
            if det.ok:
                corpo = det.json()
                if corpo.get("itens"):
                    return corpo
        assert resp.status in (200, 201), (
            f"Falha ao iniciar conferência da nota {nota_id}: "
            f"status {resp.status} — {resp.text()}"
        )
        return resp.json()

    def conferir_todos(self, nota_id: str, itens: list) -> dict:
        """Confere todos os itens de uma nota de uma vez.

        ``POST /conferencia-entrada/conferir-todos/:id`` com o corpo
        ``{"itens": [...]}``. Cada item deve seguir o formato aceito pelo
        backend (ver TS de referência, testes 07 e 11):

            {
              "itemNotaEntradaId": str,
              "quantidadeConferida": number,
              "lote": str,            # opcional
              "validade": "dd/mm/aaaa",  # opcional, formato brasileiro
            }

        Retorna o resultado da conferência (``{totalItens, divergentes,
        falhasShelfLife, ...}``). ``divergentes == 0`` no caminho feliz
        (contagem == quantidade da nota) — ver Property 2 do design.
        """
        resp = self._post(
            f"/conferencia-entrada/conferir-todos/{nota_id}",
            data={"itens": itens},
        )
        assert resp.status in (200, 201), (
            f"Falha ao conferir itens da nota {nota_id}: "
            f"status {resp.status} — {resp.text()}"
        )
        return resp.json()

    def confirmar_conferencia(self, nota_id: str) -> dict:
        """Confirma/aprova a conferência de uma nota.

        ``POST /conferencia-entrada/confirmar/:id`` (sem corpo). É a transição
        que aprova a conferência e libera a nota para o endereçamento.
        Retorna o corpo da resposta (estado atualizado da conferência).
        """
        resp = self._post(f"/conferencia-entrada/confirmar/{nota_id}")
        assert resp.status in (200, 201), (
            f"Falha ao confirmar conferência da nota {nota_id}: "
            f"status {resp.status} — {resp.text()}"
        )
        return resp.json()

    def sugerir_enderecamento(self, nota_id: str) -> dict:
        """Sugere endereços de put-away para uma nota conferida.

        ``GET /enderecamento-wms/sugerir-lote?notaEntradaId=:id``. Retorna
        ``{"sugestoes": [...]}``; cada sugestão pode trazer
        ``distribuicao.alocacoes`` ou ``sugestao.enderecoId`` (ver TS de
        referência, teste 14/15).
        """
        resp = self._get(
            "/enderecamento-wms/sugerir-lote",
            params={"notaEntradaId": nota_id},
        )
        assert resp.ok, (
            f"Falha ao sugerir endereçamento da nota {nota_id}: "
            f"status {resp.status} — {resp.text()}"
        )
        return resp.json()

    def confirmar_enderecamento_lote(self, nota_id: str, itens: list) -> dict:
        """Efetiva o endereçamento (put-away) de uma nota conferida, em lote.

        ``POST /enderecamento-wms/confirmar-lote`` com o corpo
        ``{"notaEntradaId": ..., "itens": [...]}``. Cada item segue o schema
        aceito pelo backend (``confirmarLoteSchema`` em
        ``enderecamento-wms.routes.ts``):

            {
              "itemNotaEntradaId": str (uuid),
              "produtoId": str (uuid),
              "enderecoId": str (uuid),
              "quantidade": number > 0,
              "lote": str,            # opcional
              "validade": str,        # opcional
            }

        Esta é a operação que **efetiva estado real**: cria/incrementa
        ``SaldoEndereco`` por endereço, incrementa ``Estoque`` consolidado,
        registra ``LogMovimentacao`` e muda a nota para ``ENDERECADA`` (fechando
        a OS de endereçamento). É a fonte de verdade do put-away — por isso o
        cenário a usa para tornar determinística a verificação de "soma por
        endereço == quantidade endereçada" (a UI de endereçamento é frágil e
        roda apenas best-effort).

        Retorna ``{message, itensEnderecados, etiquetas:[...]}``.
        """
        resp = self._post(
            "/enderecamento-wms/confirmar-lote",
            data={"notaEntradaId": nota_id, "itens": itens},
        )
        assert resp.status in (200, 201), (
            f"Falha ao confirmar endereçamento em lote da nota {nota_id}: "
            f"status {resp.status} — {resp.text()}"
        )
        return resp.json()

    def distribuir(self, produto_id: str, quantidade: int) -> dict:
        """Executa a distribuição inteligente de uma quantidade em endereços.

        ``POST /enderecamento-inteligente/distribuir`` com o corpo
        ``{"produtoId": ..., "quantidade": ...}``. Retorna
        ``{"alocacoes": [{"enderecoId", "quantidadeAlocada"}], "quantidadeRestante"}``.

        Invariante de conservação (Property 1 do design):
            sum(quantidadeAlocada) + quantidadeRestante == quantidade
        """
        resp = self._post(
            "/enderecamento-inteligente/distribuir",
            data={"produtoId": produto_id, "quantidade": quantidade},
        )
        assert resp.ok, (
            f"Falha na distribuição inteligente do produto {produto_id}: "
            f"status {resp.status} — {resp.text()}"
        )
        return resp.json()

    def agendamentos_hoje(self) -> list:
        """Lista os agendamentos de portaria do dia.

        ``GET /portaria/agendamentos-hoje``. Retorna a lista (``data``) de
        agendamentos; ``[]`` quando a resposta não é OK (a portaria não
        bloqueia o fluxo de uma nota manual — ver design, FASE 1).
        """
        resp = self._get("/portaria/agendamentos-hoje")
        if not resp.ok:
            return []
        return resp.json().get("data", []) or []

    def saldo_consolidado(self, produto_id: str) -> dict:
        """Retorna o saldo consolidado de um produto.

        ``GET /saldos/consolidado?busca=`` retorna ``{"data": [...], "total"}``
        com um registro por produto (``{produtoId, fisico, reservado,
        disponivel, origem, enderecos, ...}``). A rota não filtra por
        ``produtoId`` — filtramos aqui pelo ``produtoId`` desejado.

        Retorna o dicionário de saldo do produto, ou ``{}`` quando o produto
        ainda não tem saldo consolidado (ex.: antes de qualquer entrada).
        """
        resp = self._get("/saldos/consolidado")
        if not resp.ok:
            return {}
        registros = resp.json().get("data", []) or []
        return next(
            (r for r in registros if r.get("produtoId") == produto_id),
            {},
        )

    def listar_saldos_consolidados(self, busca: str = "") -> list:
        """Retorna a lista completa de saldos consolidados (``data``).

        ``GET /saldos/consolidado?busca=`` retorna ``{"data": [...], "total"}``
        com um registro por produto (``{produtoId, fisico, reservado,
        disponivel, origem, enderecos, ...}``), já consolidado pela regra de
        origem WMS/ERP (ver steering ``pcp-modulo.md`` §1.7). Diferente de
        ``saldo_consolidado(produto_id)`` — que filtra um único produto no
        cliente —, este método devolve a lista inteira retornada pela rota,
        para validações que precisam iterar sobre todos os produtos (ex.:
        conferir a fórmula ``disponivel == fisico - reservado`` em cada
        registro e classificar as origens presentes no ambiente).

        Os registros são da empresa da sessão autenticada (isolamento
        multi-tenant garantido pela própria rota do backend). Retorna ``[]``
        quando a resposta não é OK.
        """
        resp = self._get("/saldos/consolidado", params={"busca": busca})
        if not resp.ok:
            return []
        return resp.json().get("data", []) or []

    # ──────────────────────────────────────────────────────────────
    # Integração PCP → WMS (test_12 — recebimento por produção)
    #
    # Estratégia de seed determinística: em vez de criar uma OP "normal"
    # (que exige produto com BOM ATIVA e percorrer toda a máquina de estados
    # RASCUNHO→PLANEJADA→...→EM_PRODUCAO), usamos a **OP Avulsa**
    # (``POST /pcp/etapas/adicionar-avulsa``): cria uma OP
    # ``origemImportacao='AVULSA'``, ``status='PROGRAMADA'``, com UMA única
    # etapa já na fila de um centro — sem depender de cadastro de BOM. É o
    # caminho mínimo (uma etapa) sugerido pela task, e a OP avulsa pode ser
    # excluída livremente ao final (``DELETE /pcp/ordens-avulsas/:opId``),
    # facilitando a limpeza rastreável.
    #
    # Ao concluir a ÚNICA (= última) etapa dessa OP com quantidade produzida
    # > 0 e a integração automática ativa (``empresa.usaWms`` +
    # ``pcp.integracaoWmsAutomatica``, default true), o backend cria uma
    # ``NotaEntrada`` tipo ``PRODUCAO`` (serie ``PRD``, status ``PENDENTE``) com
    # ``empresaId`` = o da OP e quantidade = quantidade produzida apontada
    # (fallback para a quantidade planejada da OP). Ver
    # ``etapa-operacional.service.ts`` (``concluirEtapa``) e
    # ``pcp-wms-integration.service.ts`` (``criarEntradaProducao``).
    # ──────────────────────────────────────────────────────────────

    def primeiro_centro_producao(self) -> dict:
        """Retorna o primeiro centro de produção ativo da empresa.

        ``GET /centros-producao`` (lista paginada). Filtra por ``status``
        ativo quando o campo está presente e prefere um centro do tipo de
        processo CORTADEIRA/IMPRESSAO quando disponível (irrelevante para a
        integração WMS, mas mantém a etapa avulsa num centro "real" de chão de
        fábrica). Retorna ``{}`` quando não há nenhum centro — o chamador
        decide como tratar (o teste faz ``pytest.skip`` do pré-requisito).
        """
        # O backend valida ``limit`` com ``.max(100)`` (Zod) na listagem de
        # centros (``centro-producao.routes.ts``); passar acima disso faz o
        # ``parse()`` lançar e a rota responder 500. Usamos 100 (o teto aceito)
        # — mais que suficiente para pegar o primeiro centro ativo.
        resp = self._get("/centros-producao", params={"limit": 100})
        centros = resp.json().get("data", []) if resp.ok else []
        ativos = [c for c in centros if c.get("status") in (True, None)]
        if not ativos:
            return {}
        return ativos[0]

    def criar_op_avulsa_com_etapa(
        self, run_id: str, centro_id: str, quantidade: int = 20
    ) -> dict:
        """Cria uma OP avulsa (uma etapa) rastreável e retorna a resposta.

        ``POST /pcp/etapas/adicionar-avulsa`` com o corpo mínimo
        (``centroProducaoId``, ``quantidade``, ``descricao`` marcada com o
        ``run_id`` — vira a tag ``[Descricao]`` nas observações). A OP nasce
        ``PROGRAMADA`` com uma etapa ``PENDENTE`` na fila do centro.

        Retorna ``{op, etapa, referenciaAvulsa}`` (o ``op`` traz
        ``id``/``empresaId``/``quantidade``; o ``etapa`` traz o ``id`` usado
        para iniciar/apontar/concluir).
        """
        payload = {
            "centroProducaoId": centro_id,
            "quantidade": quantidade,
            "produtoNomeLivre": f"PA QA WMS {run_id}",
            "descricao": f"OP QA WMS PRODUCAO {run_id}",
        }
        resp = self._post("/pcp/etapas/adicionar-avulsa", data=payload)
        assert resp.status in (200, 201), (
            f"Falha ao criar OP avulsa: status {resp.status} — {resp.text()}"
        )
        return resp.json()

    def iniciar_etapa(self, etapa_id: str) -> dict:
        """Inicia (coloca EM_ANDAMENTO) uma etapa de produção.

        ``PATCH /pcp/etapas/:id/iniciar`` (corpo opcional
        ``{funcionarioId}`` — omitido: o backend usa o próprio usuário). O
        usuário de QA é ADMIN, que faz bypass das permissões de processo.
        Retorna a etapa atualizada.
        """
        resp = self._request.patch(
            self._url(f"/pcp/etapas/{etapa_id}/iniciar"),
            headers=self._headers(com_json=True),
            data={},
        )
        assert resp.status in (200, 201), (
            f"Falha ao iniciar etapa {etapa_id}: status {resp.status} — {resp.text()}"
        )
        return resp.json()

    def apontar_producao(
        self, etapa_id: str, quantidade_produzida: float, quantidade_perda: float = 0
    ) -> dict:
        """Registra um apontamento de produção numa etapa EM_ANDAMENTO.

        ``POST /pcp/etapas/:id/apontar`` com ``{quantidadeProduzida,
        quantidadePerda}``. Incrementa ``quantidadeProduzida`` da etapa (via
        ``increment`` no backend) — esse acumulado é o que vira a quantidade
        da NotaEntrada PRODUCAO ao concluir a última etapa. Retorna o
        apontamento criado.
        """
        payload = {
            "quantidadeProduzida": quantidade_produzida,
            "quantidadePerda": quantidade_perda,
        }
        resp = self._post(f"/pcp/etapas/{etapa_id}/apontar", data=payload)
        assert resp.status in (200, 201), (
            f"Falha ao apontar produção na etapa {etapa_id}: "
            f"status {resp.status} — {resp.text()}"
        )
        return resp.json()

    def concluir_etapa(self, etapa_id: str) -> dict:
        """Conclui uma etapa; se for a última da OP, dispara a integração WMS.

        ``PATCH /pcp/etapas/:id/concluir``. Quando todas as etapas da OP ficam
        CONCLUIDA, o backend marca a OP como CONCLUIDA e — se a integração
        automática estiver ativa — cria a NotaEntrada PRODUCAO. A resposta
        traz ``{..., todasConcluidas, entradaWms}``; ``entradaWms`` é
        ``{notaEntradaId, numero, status}`` quando a nota foi criada, ou
        ``None`` quando não (produção zero, integração desativada, ou etapas
        pendentes). Retorna o corpo completo da resposta.
        """
        resp = self._request.patch(
            self._url(f"/pcp/etapas/{etapa_id}/concluir"),
            headers=self._headers(com_json=True),
            data={},
        )
        assert resp.status in (200, 201), (
            f"Falha ao concluir etapa {etapa_id}: status {resp.status} — {resp.text()}"
        )
        return resp.json()

    def obter_nota_entrada(self, nota_id: str) -> dict:
        """Busca uma nota de entrada por id (com itens).

        ``GET /notas-entrada/:id`` — a rota é escopada pela empresa da sessão
        (``empresaId``), então uma nota de outra empresa responde 404. Retorna
        o dicionário completo da nota (``{id, numero, serie, tipo, status,
        empresaId, itens:[...]}``), ou ``{}`` quando não encontrada.
        """
        resp = self._get(f"/notas-entrada/{nota_id}")
        if not resp.ok:
            return {}
        return resp.json()

    def excluir_op_avulsa(self, op_id: str) -> bool:
        """Exclui uma OP avulsa e suas dependências (limpeza rastreável).

        ``DELETE /pcp/ordens-avulsas/:opId`` — remove em cascata etapas,
        apontamentos, itens, logs e a própria OP (sem restrição de status).
        Retorna ``True`` quando a exclusão foi aceita (2xx), ``False`` caso
        contrário (a limpeza é best-effort: não deve derrubar o teste).
        """
        try:
            resp = self._request.delete(
                self._url(f"/pcp/ordens-avulsas/{op_id}"),
                headers=self._headers(),
            )
            return resp.status in (200, 204)
        except Exception:
            return False

    # ──────────────────────────────────────────────────────────────
    # Configuração PCP — flag de integração automática PCP → WMS (test_12)
    #
    # A flag ``pcp.integracaoWmsAutomatica`` (tabela ``Parametro``, prefixo
    # ``pcp.``) decide se concluir a ÚLTIMA etapa de uma OP dispara a criação
    # automática de uma NotaEntrada tipo PRODUCAO no WMS. Default ``true``
    # (preserva o comportamento já existente). É distinta de ``empresa.usaWms``
    # — a integração só acontece quando AMBOS estão ativos. Ver
    # ``configuracao-pcp.routes.ts`` e ``ATENCAO-pontos-verificar.md`` §3.
    #
    # Rotas (prefixo ``/api/pcp``, só ADMIN pode alterar — a sessão de QA é
    # admin):
    #   - GET   /pcp/configuracao   -> {empresaId, configuracao: {..., integracaoWmsAutomatica}}
    #   - PATCH /pcp/configuracao   -> body {integracaoWmsAutomatica: bool}
    #
    # ATENÇÃO (ambiente demo compartilhado): alternar esta flag é operação
    # administrativa global da empresa demo. Quem alterar DEVE restaurar o
    # valor original (padrão try/finally no teste) para não deixar a empresa
    # com a integração automática desativada por engano.
    # ──────────────────────────────────────────────────────────────

    def obter_configuracao_pcp(self) -> dict:
        """Retorna o mapa de flags de configuração PCP da empresa da sessão.

        ``GET /pcp/configuracao``. Retorna o dicionário ``configuracao``
        (ex.: ``{"integracaoWmsAutomatica": true, "usaControleBobina": false,
        ...}``), ou ``{}`` quando a resposta não é OK. Os defaults do backend
        já são aplicados na resposta (``integracaoWmsAutomatica`` default
        ``true`` quando o parâmetro não foi configurado).
        """
        resp = self._get("/pcp/configuracao")
        if not resp.ok:
            return {}
        return resp.json().get("configuracao", {}) or {}

    def definir_integracao_wms_automatica(self, ativa: bool) -> bool:
        """Liga/desliga a flag ``pcp.integracaoWmsAutomatica`` da empresa.

        ``PATCH /pcp/configuracao`` com o corpo
        ``{"integracaoWmsAutomatica": <bool>}``. Só ADMIN/SUPER_ADMIN pode
        alterar (a sessão de QA é admin). Retorna ``True`` quando a alteração
        foi aceita (2xx), ``False`` caso contrário — permitindo ao chamador
        pular o cenário quando o ambiente não permite alternar a flag (ex.:
        403 por perfil insuficiente) sem derrubar a suíte.
        """
        try:
            resp = self._patch(
                "/pcp/configuracao",
                data={"integracaoWmsAutomatica": ativa},
            )
            return resp.status in (200, 201)
        except Exception:
            return False

    # ──────────────────────────────────────────────────────────────
    # Isolamento multi-tenant (task 12) — helpers de leitura e por identificador
    #
    # Todos os métodos abaixo são idempotentes (apenas GET/leitura) e usados
    # pelo ``test_21_isolamento_multitenant.py`` para validar que consultas
    # autenticadas retornam somente dados da empresa da sessão e que o acesso a
    # um registro por identificador de outra empresa responde "não encontrado".
    #
    # Comportamento de isolamento confirmado no backend
    # (``VisioFab.Wms.Back/src/modules``):
    #   - ``GET /notas-entrada``      -> where { empresaId } (expõe empresaId no payload)
    #   - ``GET /enderecos``          -> where { empresaId } (expõe empresaId no payload)
    #   - ``GET /saldos/consolidado`` -> filtra user.empresaId no service (NÃO
    #     expõe empresaId no payload; retorna só produtoId/fisico/reservado/…)
    #   - ``GET /notas-entrada/:id``  -> findFirst { id, empresaId } -> 404 se
    #     de outra empresa/inexistente ("Não encontrado").
    #   - ``GET /enderecos/:id/capacidade`` -> mesmo padrão -> 404
    #     ("Endereço não encontrado").
    # ──────────────────────────────────────────────────────────────

    def listar_enderecos(self, limit: int = 200) -> list:
        """Lista endereços da empresa da sessão (``GET /enderecos``).

        Retorna a lista ``data`` (cada item expõe ``empresaId``), ou ``[]``
        quando a resposta não é OK. Usado para validar o isolamento por
        empresa em consultas (Requirement 12.1).
        """
        resp = self._get("/enderecos", params={"limit": limit})
        if not resp.ok:
            return []
        return resp.json().get("data", []) or []

    def listar_notas(self, limit: int = 200) -> list:
        """Lista notas de entrada da empresa da sessão (``GET /notas-entrada``).

        Retorna a lista ``data`` (cada item expõe ``empresaId``), ou ``[]``
        quando a resposta não é OK. Usado para validar o isolamento por
        empresa em consultas (Requirement 12.1).
        """
        resp = self._get("/notas-entrada", params={"limit": limit})
        if not resp.ok:
            return []
        return resp.json().get("data", []) or []

    def buscar_nota_por_id_raw(self, nota_id: str) -> Any:
        """Acessa uma nota de entrada por identificador (``GET /notas-entrada/:id``).

        Retorna o ``APIResponse`` cru do Playwright para que o chamador
        inspecione ``status`` e corpo. NÃO usa ``_get`` (que trata 5xx como
        falha dura), justamente porque o objetivo deste probe é observar o
        status retornado para um identificador estrangeiro/inexistente — o
        backend deveria responder 404, mas pode responder 500 por uma falha de
        robustez conhecida (ver ``test_21``). O teste de isolamento decide como
        classificar cada status observado.
        """
        return self._request.get(
            self._url(f"/notas-entrada/{nota_id}"), headers=self._headers()
        )

    def buscar_endereco_capacidade_raw(self, endereco_id: str) -> Any:
        """Acessa um endereço por identificador (``GET /enderecos/:id/capacidade``).

        Não existe rota ``GET /enderecos/:id`` pura no backend; a rota de
        capacidade aplica o mesmo filtro por empresa (``findFirst { id,
        empresaId }``) e responde 404 para endereço de outra empresa. Retorna
        o ``APIResponse`` cru (sem tratar 5xx como falha dura) para o chamador
        inspecionar ``status``.
        """
        return self._request.get(
            self._url(f"/enderecos/{endereco_id}/capacidade"),
            headers=self._headers(),
        )

    # Nota (Requirement 12.2): a integração externa por API-Key da suíte usa o
    # helper ``chamar_integracao`` (prefixo ``/api/v1/wms``, módulo
    # ``wms-api-integracao``), já definido mais abaixo neste arquivo e
    # reutilizado pelos test_19/test_21. Não duplicamos um cliente de
    # integração aqui — o ``empresaId`` gravado/consultado é sempre o da chave
    # (``integracao/api-key-guard.ts``), e a rota ``GET /api/v1/wms/status``
    # ecoa esse ``empresaId`` (base para o assert de 12.2).

    def listar_notas_por_marcador(self, run_id: str) -> list:
        """Lista as notas de entrada criadas por uma execução (marcador).

        As notas de QA têm ``fornecedor = "QA-WMS {run_id}"``. A rota
        ``GET /notas-entrada?search=`` filtra por ``fornecedor`` contendo o
        termo — passamos o ``run_id`` como busca. Por segurança, ainda
        filtramos no cliente as notas cujo ``fornecedor`` realmente contém o
        marcador (a busca do backend também casa por número).

        Usado pela limpeza rastreável (task 13). Retorna a lista de notas
        ``[{id, numero, fornecedor, itens, ...}]``.
        """
        resp = self._get("/notas-entrada", params={"search": run_id, "limit": 200})
        if not resp.ok:
            return []
        notas = resp.json().get("data", []) or []
        return [
            n for n in notas
            if run_id in (n.get("fornecedor") or "")
        ]

    def excluir_nota_entrada(self, nota_id: str) -> bool:
        """Exclui uma nota de entrada e seus itens (limpeza rastreável).

        ``DELETE /notas-entrada/:id`` — o backend valida que a nota pertence à
        empresa da sessão (senão 404), apaga os ``ItemNotaEntrada`` e a própria
        ``NotaEntrada`` (sem restrição de status). Uma nota que já gerou estado
        dependente (conferência, saldo por endereço, log de movimentação) pode
        falhar na exclusão por restrição de chave estrangeira — nesse caso a
        rota responde erro e este método retorna ``False``, para que a limpeza
        rastreável registre o identificador não removido no relatório e siga em
        frente (design, Requisito 13.3).

        Best-effort: nunca levanta exceção nem faz ``assert`` (a limpeza não
        pode derrubar o teste). Retorna ``True`` quando a exclusão foi aceita
        (2xx), ``False`` caso contrário.
        """
        try:
            resp = self._request.delete(
                self._url(f"/notas-entrada/{nota_id}"),
                headers=self._headers(),
            )
            return resp.status in (200, 204)
        except Exception:
            return False

    # ──────────────────────────────────────────────────────────────
    # Integração de ERP externo via API-Key (task 10)
    #
    # Diferente das demais chamadas desta classe (que usam o Bearer da
    # sessão), a integração externa é autenticada pelo header ``X-Api-Key``
    # e NÃO pelo Bearer. As rotas ficam sob o prefixo ``/api/v1/wms``
    # (módulo ``wms-standalone/wms-api-integracao.routes.ts``), registrado no
    # ``server.ts`` — repare que o prefixo é ``/api/v1/wms`` sobre a RAIZ do
    # host, não sob o mesmo ``/api`` da ``API_URL`` usada pelo restante da
    # suíte. Por isso derivamos aqui a base do host removendo o sufixo
    # ``/api`` final da ``API_URL``.
    #
    # Comportamento do backend (confirmado em
    # ``VisioFab.Wms.Back/src/modules/integracao/api-key-guard.ts`` e
    # ``wms-api-integracao.routes.ts``):
    #   - onRequest  -> apiKeyGuard:
    #       * sem header X-Api-Key            -> 401 code=API_KEY_MISSING
    #       * chave inexistente               -> 401 code=API_KEY_INVALID
    #       * chave revogada                  -> 401 code=API_KEY_REVOKED
    #       * chave expirada                  -> 401 code=API_KEY_EXPIRED
    #       * empresa da chave inativa        -> 401 code=EMPRESA_INACTIVE
    #   - preHandler -> verificarIntegracaoAtiva:
    #       * integração desativada p/ empresa -> 403 code=INTEGRACAO_DESATIVADA
    #   O guard (401) roda ANTES da checagem de integração (403); logo, uma
    #   chave inválida sempre resulta em 401, independentemente do estado da
    #   integração da empresa (Requirement 9.3).
    # ──────────────────────────────────────────────────────────────

    #: Endpoint de integração leve usado para exercitar a autenticação por
    #: API-Key (não altera estado — apenas ecoa status/empresa quando aceito).
    INTEGRACAO_STATUS_PATH = "/api/v1/wms/status"

    def _base_host(self) -> str:
        """Retorna a base do host sem o sufixo ``/api`` da ``API_URL``.

        As rotas de integração externa são registradas em ``/api/v1/wms``
        sobre a raiz do host (não sob o ``/api`` do restante da API). Ex.:
        ``https://api.vizorerp.com.br/api`` -> ``https://api.vizorerp.com.br``.
        """
        base = self._api_url
        if base.endswith("/api"):
            base = base[: -len("/api")]
        return base.rstrip("/")

    def _url_integracao(self, path: str) -> str:
        """Monta a URL absoluta de uma rota de integração externa."""
        return f"{self._base_host()}/{path.lstrip('/')}"

    def chamar_integracao(
        self,
        path: str = INTEGRACAO_STATUS_PATH,
        api_key: Optional[str] = None,
        metodo: str = "GET",
        data: Optional[dict] = None,
    ):
        """Faz uma chamada à API de integração externa com ``X-Api-Key``.

        Diferente de ``_get``/``_post``, esta chamada **não** envia o Bearer
        da sessão: a integração é autenticada exclusivamente pelo header
        ``X-Api-Key``. Quando ``api_key`` é ``None``, o header é omitido
        propositalmente (para exercitar o caso ``API_KEY_MISSING``).

        Retorna o objeto ``APIResponse`` do Playwright (o chamador inspeciona
        ``status`` e o corpo). Diferente dos demais helpers, ``5xx`` **não** é
        tratado como falha dura aqui — os testes de autenticação inspecionam o
        status/código diretamente.
        """
        headers: dict = {}
        if api_key is not None:
            headers["X-Api-Key"] = api_key

        url = self._url_integracao(path)
        if metodo.upper() == "POST":
            headers["Content-Type"] = "application/json"
            return self._request.post(url, headers=headers, data=data or {})
        return self._request.get(url, headers=headers)

    def empresa_id_integracao(self, api_key: str) -> Optional[str]:
        """Retorna o ``empresaId`` derivado de uma API-Key válida.

        Chama ``GET /api/v1/wms/status`` com a chave: quando aceita (guard +
        integração ativa), a rota ecoa ``{success, status, empresaId, ...}``.
        O ``empresaId`` ecoado é exatamente o injetado por
        ``api-key-guard.ts`` (``request.empresaId = apiKey.empresaId``), ou
        seja, é a prova de qual empresa a chave representa.

        Idempotente (somente leitura). Retorna ``None`` quando a chamada não é
        aceita (401/403) ou quando o corpo não traz ``empresaId`` — o chamador
        decide como tratar (ex.: ``pytest.skip`` se a chave não estiver apta).
        """
        resp = self.chamar_integracao(
            path=self.INTEGRACAO_STATUS_PATH, api_key=api_key, metodo="GET"
        )
        if not resp.ok:
            return None
        try:
            corpo = resp.json() or {}
        except Exception:
            return None
        return corpo.get("empresaId")

    def lancar_asn_integracao(
        self,
        api_key: str,
        run_id: str,
        produto_codigo: str,
        quantidade: float,
        lote: Optional[str] = None,
    ):
        """Lança uma entrada (ASN) via integração externa autenticada por API-Key.

        ``POST /api/v1/wms/recebimento/asn`` (schema ``asnSchema`` do backend):
        cria uma ``NotaEntrada`` tipo ``INTEGRACAO`` (serie ``INT``, status
        ``PENDENTE``) no ``empresaId`` da chave, com um item por produto. O
        documento é marcado com o ``run_id`` (``numeroDocumento`` e
        ``fornecedorNome``) para rastreio/limpeza.

        Retorna o ``APIResponse`` cru do Playwright (o chamador inspeciona
        ``status`` e o corpo ``{success, data:{notaEntradaId, numero,
        totalItens, status}}``). NÃO trata 5xx como falha dura — os testes de
        integração inspecionam o status diretamente.

        Observação de negócio: o ASN cria um DOCUMENTO de entrada pendente; o
        ``Saldo_Fisico`` só é efetivado após conferência + endereçamento
        (fluxo interno via Bearer). Ver a interpretação do Requirement 9.5 no
        ``test_19``.
        """
        item: dict = {"produtoCodigo": produto_codigo, "quantidade": quantidade}
        if lote:
            item["lote"] = lote
        payload = {
            "numeroDocumento": f"QA-ASN-{run_id}",
            "fornecedorNome": f"QA-WMS {run_id}",
            "itens": [item],
        }
        return self.chamar_integracao(
            path="/api/v1/wms/recebimento/asn",
            api_key=api_key,
            metodo="POST",
            data=payload,
        )

    def estoque_integracao(
        self,
        api_key: str,
        produto_codigo: Optional[str] = None,
        tipo: str = "consolidado",
    ) -> list:
        """Consulta o estoque via integração externa (mesma API-Key).

        ``GET /api/v1/wms/estoque?tipo=&produtoCodigo=``. Diferente das
        consultas Bearer da suíte, esta usa a própria API-Key — logo enxerga
        apenas o estoque do ``empresaId`` da chave (isolamento por empresa).
        ``tipo=consolidado`` retorna ``{produtoCodigo, quantidade, reservado,
        disponivel}`` por produto; ``tipo=posicional`` retorna por endereço.

        Retorna a lista ``data`` (filtrada por ``produtoCodigo`` no backend
        quando informado), ou ``[]`` quando a resposta não é OK.
        """
        params = f"tipo={tipo}"
        if produto_codigo:
            params += f"&produtoCodigo={produto_codigo}"
        resp = self.chamar_integracao(
            path=f"/api/v1/wms/estoque?{params}", api_key=api_key, metodo="GET"
        )
        if not resp.ok:
            return []
        try:
            corpo = resp.json() or {}
        except Exception:
            return []
        return corpo.get("data", []) or []

    # ──────────────────────────────────────────────────────────────
    # Inventário cíclico (task 7.1)
    #
    # Endpoints confirmados no backend
    # (``VisioFab.Wms.Back/src/modules/inventario/inventario.routes.ts``,
    # registrado em ``server.ts`` com prefixo ``/api/inventarios``):
    #   - POST   /inventarios                     cria inventário (snapshot dos
    #                                             SaldoEndereco > 0; opcionalmente
    #                                             filtrado por ``zonaId``/``rua``)
    #   - GET    /inventarios/:id                 detalhe + itens enriquecidos
    #   - PATCH  /inventarios/:id/contar          registra contagem de 1 item
    #   - PATCH  /inventarios/:id/contar-todos    registra contagem em lote
    #   - PATCH  /inventarios/:id/aplicar-ajustes aplica ajustes de divergência
    #                                             e conclui o inventário
    #   - PATCH  /inventarios/:id/concluir        conclui sem ajustes
    #
    # Regras de negócio relevantes (do backend), que os testes verificam:
    #   - ``divergencia = saldoContado - saldoSistema``; ``CONFORME`` quando 0,
    #     senão ``DIVERGENTE``.
    #   - ``aplicar-ajustes`` só toca itens ``DIVERGENTE`` ainda não aplicados:
    #     seta ``SaldoEndereco.quantidade = saldoContado`` e ajusta o
    #     ``Estoque`` consolidado por ``divergencia`` (contagem == saldo ⇒
    #     nenhum ajuste aplicado).
    # ──────────────────────────────────────────────────────────────

    def criar_inventario(
        self,
        tipo: str = "CICLICO",
        zona_id: Optional[str] = None,
        rua: Optional[str] = None,
        observacao: Optional[str] = None,
    ) -> dict:
        """Cria um inventário a partir dos saldos existentes.

        ``POST /inventarios``. O backend gera um ``ItemInventario`` por
        ``SaldoEndereco`` com ``quantidade > 0`` que casar com o filtro
        (``zonaId``/``rua`` opcionais). Cada item registra o ``saldoSistema``
        (snapshot do saldo atual) e nasce ``PENDENTE``.

        Retorna a resposta ``{id, numero, itens: [...], totalItens, ...}``.
        Falha dura se não houver saldo para inventariar (o backend responde
        422); o chamador deve garantir o pré-requisito (produto endereçado)
        antes de chamar.
        """
        payload: dict = {"tipo": tipo}
        if zona_id:
            payload["zonaId"] = zona_id
        if rua:
            payload["rua"] = rua
        if observacao:
            payload["observacao"] = observacao

        resp = self._post("/inventarios", data=payload)
        assert resp.status in (200, 201), (
            f"Falha ao criar inventário (tipo={tipo}): "
            f"status {resp.status} — {resp.text()}"
        )
        return resp.json()

    def detalhe_inventario(self, inventario_id: str) -> dict:
        """Retorna o detalhe de um inventário com itens e resumo.

        ``GET /inventarios/:id``. Os itens vêm enriquecidos com ``produto`` e
        ``endereco`` e com ``saldoSistema``/``saldoContado``/``divergencia``
        já convertidos para número. O corpo inclui um ``resumo``
        (``{total, contados, conformes, divergentes, pendentes}``).
        """
        resp = self._get(f"/inventarios/{inventario_id}")
        assert resp.ok, (
            f"Falha ao consultar inventário {inventario_id}: "
            f"status {resp.status} — {resp.text()}"
        )
        return resp.json()

    def contar_item_inventario(
        self, inventario_id: str, item_id: str, saldo_contado: float
    ) -> dict:
        """Registra a contagem de um item do inventário.

        ``PATCH /inventarios/:id/contar`` com o corpo
        ``{"itemId": ..., "saldoContado": ...}``. O backend calcula
        ``divergencia = saldoContado - saldoSistema`` e o ``status``
        (``CONFORME`` quando a divergência é zero, senão ``DIVERGENTE``).

        Retorna o item atualizado (``{saldoSistema, saldoContado, divergencia,
        status, ...}``).
        """
        resp = self._patch(
            f"/inventarios/{inventario_id}/contar",
            data={"itemId": item_id, "saldoContado": saldo_contado},
        )
        assert resp.status in (200, 201), (
            f"Falha ao contar item {item_id} do inventário {inventario_id}: "
            f"status {resp.status} — {resp.text()}"
        )
        return resp.json()

    def aplicar_ajustes_inventario(self, inventario_id: str) -> dict:
        """Aplica os ajustes de divergência e conclui o inventário.

        ``PATCH /inventarios/:id/aplicar-ajustes``. Para cada item
        ``DIVERGENTE`` ainda não aplicado, o backend seta
        ``SaldoEndereco.quantidade = saldoContado`` e ajusta o ``Estoque``
        consolidado pela ``divergencia``; itens ``CONFORME`` não geram ajuste.
        Ao final, o inventário fica ``CONCLUIDO`` e os endereços são
        desbloqueados.

        Retorna ``{message, ajustesAplicados}`` — ``ajustesAplicados`` é o
        número de itens efetivamente ajustados (0 quando não há divergência).
        """
        resp = self._patch(f"/inventarios/{inventario_id}/aplicar-ajustes")
        assert resp.status in (200, 201), (
            f"Falha ao aplicar ajustes do inventário {inventario_id}: "
            f"status {resp.status} — {resp.text()}"
        )
        return resp.json()

    def concluir_inventario(self, inventario_id: str) -> dict:
        """Conclui um inventário sem aplicar ajustes (todos conformes).

        ``PATCH /inventarios/:id/concluir``. Marca o inventário como
        ``CONCLUIDO`` e desbloqueia os endereços, sem tocar em saldos. Usado
        quando a contagem confirma o saldo do sistema (nenhuma divergência).

        Retorna ``{message}``.
        """
        resp = self._patch(f"/inventarios/{inventario_id}/concluir")
        assert resp.status in (200, 201), (
            f"Falha ao concluir inventário {inventario_id}: "
            f"status {resp.status} — {resp.text()}"
        )
        return resp.json()

    # ──────────────────────────────────────────────────────────────
    # Bloqueios de WMS (task 8.1)
    #
    # Endpoints confirmados no backend
    # (``VisioFab.Wms.Back/src/modules/bloqueio-wms/bloqueio-wms.routes.ts``,
    # registrado em ``server.ts`` com prefixo ``/api/bloqueio-wms`` — as rotas
    # internas são ``/bloqueios/lote`` etc., resultando em
    # ``/api/bloqueio-wms/bloqueios/lote``). Guard: ``moduloGuard('WMS')``.
    #
    #   - POST   /bloqueios/lote          bloqueia um lote/produto em TODAS as
    #                                     posições: seta ``SaldoEndereco.bloqueado
    #                                     = true`` + ``motivoBloqueioLote`` e cria
    #                                     um ``BloqueioHierarquico`` nível LOTE
    #                                     (RECALL) para rastreabilidade. Retorna
    #                                     ``{message, posicoesBloqueadas}``.
    #   - DELETE /bloqueios/lote          libera o lote (query ``produtoId`` +
    #                                     ``lote``): ``bloqueado = false`` e
    #                                     desativa o bloqueio hierárquico.
    #   - POST   /bloqueios/verificar     verifica se uma posição (endereço +
    #                                     produto + lote) está bloqueada em
    #                                     qualquer nível — retorna
    #                                     ``{bloqueado, motivos, bloqueios}``.
    #                                     É o pré-check que impede a separação
    #                                     sobre saldo bloqueado (Requisito 7.2).
    #
    # Como o "disponível" reflete o bloqueio (Requisitos 7.1/7.3): o serviço de
    # saldo consolidado (``saldo-consolidado.service.ts``) filtra
    # ``bloqueado: false`` ao somar o físico WMS. Logo, bloquear um lote REMOVE
    # aquela quantidade do ``fisico`` consolidado e, por consequência, do
    # ``disponivel`` (``disponivel = fisico − reservado``). Liberar o lote
    # devolve a quantidade ao ``fisico``/``disponivel``. Ou seja, a verificação
    # de 7.1 e 7.3 é feita comparando o ``disponivel`` do produto no
    # ``/saldos/consolidado`` antes e depois de bloquear/liberar.
    #
    # O prefixo do módulo é derivado dinamicamente (ver ``_bloqueio_prefix``)
    # a partir do ``server.ts``; caso o prefixo real difira, os testes falham
    # cedo com mensagem clara em vez de mascarar o problema.
    # ──────────────────────────────────────────────────────────────

    #: Prefixo (sob a ``API_URL``) em que o módulo de bloqueio-wms é montado.
    #: Confirmado no ``server.ts`` do backend
    #: (``app.register(bloqueioWmsRoutes, { prefix: '/api/bloqueio-wms' })``);
    #: como a ``API_URL`` já inclui ``/api``, aqui usamos só o segmento restante.
    BLOQUEIO_PREFIX = "/bloqueio-wms"

    def bloquear_lote(self, produto_id: str, lote: str, motivo: str) -> dict:
        """Bloqueia um lote/produto em todas as posições (``POST /bloqueios/lote``).

        Corpo ``{produtoId, lote, motivo}`` (``motivo`` mínimo 3 caracteres).
        Seta ``SaldoEndereco.bloqueado = true`` para todas as posições daquele
        lote/produto da empresa e cria um ``BloqueioHierarquico`` nível LOTE
        (tipo RECALL) para rastreabilidade — este último é o que faz
        ``verificar_bloqueio`` acusar a posição como bloqueada.

        Retorna ``{message, posicoesBloqueadas}`` — ``posicoesBloqueadas`` é o
        número de ``SaldoEndereco`` marcados como bloqueados.
        """
        resp = self._post(
            f"{self.BLOQUEIO_PREFIX}/bloqueios/lote",
            data={"produtoId": produto_id, "lote": lote, "motivo": motivo},
        )
        assert resp.status in (200, 201), (
            f"Falha ao bloquear lote {lote} do produto {produto_id}: "
            f"status {resp.status} — {resp.text()}"
        )
        return resp.json()

    def liberar_lote(self, produto_id: str, lote: str) -> bool:
        """Libera um lote/produto previamente bloqueado (``DELETE /bloqueios/lote``).

        A rota recebe ``produtoId`` e ``lote`` por **query string** (não no
        corpo). Seta ``SaldoEndereco.bloqueado = false`` para as posições
        bloqueadas do lote e desativa o ``BloqueioHierarquico`` LOTE
        correspondente, devolvendo a quantidade ao físico/disponível
        consolidado.

        Retorna ``True`` quando a liberação foi aceita (2xx); ``False`` caso
        contrário. Usado tanto na verificação de 7.3 quanto na limpeza
        best-effort do ``finally`` (por isso não faz assert — a limpeza não
        deve derrubar o teste).
        """
        try:
            resp = self._request.delete(
                self._url(f"{self.BLOQUEIO_PREFIX}/bloqueios/lote"),
                headers=self._headers(),
                params={"produtoId": produto_id, "lote": lote},
            )
            return resp.status in (200, 204)
        except Exception:
            return False

    def verificar_bloqueio(
        self,
        endereco_id: str,
        produto_id: Optional[str] = None,
        lote: Optional[str] = None,
    ) -> dict:
        """Verifica se uma posição está bloqueada (``POST /bloqueios/verificar``).

        Corpo ``{enderecoId, produtoId?, lote?}``. O backend consulta o
        bloqueio em cascata (endereço → nível → prédio → rua → zona → depósito
        → produto → lote) e também o ``SaldoEndereco.bloqueado`` do lote.
        Retorna ``{bloqueado: bool, motivos: [...], bloqueios: [...]}``.

        Este é o pré-check que impede a separação sobre saldo bloqueado
        (Requisito 7.2): quando ``bloqueado`` é ``True``, a operação de
        separação/picking sobre aquela posição é impedida pelo sistema (as
        rotas de movimentação chamam essa verificação antes de mover estoque).
        """
        payload: dict = {"enderecoId": endereco_id}
        if produto_id:
            payload["produtoId"] = produto_id
        if lote:
            payload["lote"] = lote
        resp = self._post(f"{self.BLOQUEIO_PREFIX}/bloqueios/verificar", data=payload)
        assert resp.status in (200, 201), (
            f"Falha ao verificar bloqueio do endereço {endereco_id}: "
            f"status {resp.status} — {resp.text()}"
        )
        return resp.json()

    def listar_bloqueios_ativos(self) -> list:
        """Lista os bloqueios hierárquicos ativos da empresa (``GET /bloqueios``).

        Usado pela limpeza best-effort (identificar bloqueios remanescentes do
        run) e por diagnósticos. Retorna a lista (pode vir como ``data`` ou
        como lista direta, dependendo do backend), ou ``[]`` quando não OK.
        """
        resp = self._get(f"{self.BLOQUEIO_PREFIX}/bloqueios")
        if not resp.ok:
            return []
        corpo = resp.json()
        if isinstance(corpo, list):
            return corpo
        return corpo.get("data", []) or []

    # ──────────────────────────────────────────────────────────────
    # Reserva de produção (test_13 — Requirement 3.4)
    #
    # A "Reserva de Produção" é a ``ReservaProducao`` ATIVA criada pelo botão
    # "Reservar Materiais" da Análise de Produção do PCP. Ela empenha o
    # material (componente) de uma OP, aumentando o ``reservado`` do produto e
    # reduzindo o ``disponivel`` no saldo consolidado
    # (``saldo-consolidado.service.ts``: ``reservado = venda + Σ ReservaProducao
    # ATIVA``; ``disponivel = max(0, fisico − reservado)``).
    #
    # Endpoint confirmado no backend
    # (``pcp/analise-producao/analise-producao.routes.ts`` +
    # ``reserva-producao.service.ts``):
    #   - POST   /pcp/analise-producao/:opId/reservar   cria ReservaProducao
    #     ATIVA para cada item da OP que tem ``produtoComponenteId``, com
    #     quantidade = necessidade líquida (``quantidade − quantidadeLiberada``).
    #     Idempotente: se a OP já tem reservas ATIVAS, não duplica.
    #   - DELETE /pcp/analise-producao/:opId/reservar   cancela as reservas
    #     ATIVAS da OP (limpeza).
    #
    # PRÉ-REQUISITO (não-óbvio): a reserva só nasce para itens com
    # ``produtoComponenteId`` (material cadastrado). Uma OP só ganha esses itens
    # ao explodir uma BOM (``EstruturaProduto`` ATIVA) — a OP avulsa do test_12
    # NÃO serve. Por isso o seed determinístico deste teste é auto-contido:
    #   1. cria (ou reusa) um produto-pai de QA + BOM ATIVA de 1 item apontando
    #      para o produto-componente (aquele que já tem físico via recebimento),
    #      com ``rendimento=1`` e ``percentualPerda=0`` → item da OP = Q exato;
    #   2. cria uma OP para o produto-pai (``explodirBom=true``,
    #      ``gerarEtapas=false``) → item da OP com ``produtoComponenteId`` =
    #      componente e quantidade = Q;
    #   3. reserva → ReservaProducao ATIVA de Q para o componente.
    # Toda a cadeia é rastreável (código ``QA-BOM-{run_id}``) e removível na
    # limpeza (cancelar reservas + excluir OP + inativar estrutura).
    # ──────────────────────────────────────────────────────────────

    def garantir_produto_pai_com_bom(
        self, run_id: str, componente: dict, quantidade_componente: float = 5
    ) -> dict:
        """Garante um produto-pai de QA com BOM ATIVA de 1 item (o componente).

        Idempotente — consulta antes de criar:

        1. Procura um produto-pai de QA (código ``QA-BOM-{run_id}``); cria se
           não existir.
        2. Procura uma ``EstruturaProduto`` ATIVA desse pai
           (``GET /estruturas-produto?produtoId=&status=ATIVA``); se existir e
           já tiver ao menos um item, reutiliza.
        3. Caso contrário, cria a estrutura (``rendimento=1``,
           ``status=ATIVA``) e adiciona um item apontando para o
           ``componente`` com ``quantidade=quantidade_componente`` e
           ``percentualPerda=0`` (⇒ ``quantidadeLiquida == quantidade``).

        Com ``rendimento=1`` e OP de ``quantidade=1``, o item explodido na OP
        terá quantidade == ``quantidade_componente`` (a quantidade reservada).

        Retorna ``{"produtoPai": {...}, "estrutura": {...}}``.
        """
        codigo_pai = f"QA-BOM-{run_id}"

        # 1) Produto-pai (reusa se já existe).
        resp = self._get("/produtos", params={"search": codigo_pai, "limit": 5})
        produtos = resp.json().get("data", []) if resp.ok else []
        produto_pai = next(
            (p for p in produtos if p.get("codigo") == codigo_pai), None
        )
        if not produto_pai:
            payload = {
                "codigo": codigo_pai,
                "nome": f"PRODUTO PAI QA BOM {run_id}",
                "descricao": f"Produto-pai de teste (BOM) — {run_id}",
                "unidade": "UN",
                "status": True,
            }
            r = self._post("/produtos", data=payload)
            assert r.status in (200, 201), (
                f"Falha ao criar produto-pai de QA: status {r.status} — {r.text()}"
            )
            produto_pai = r.json()

        # 2) Estrutura existente (QUALQUER status) — idempotência frente à
        # limpeza. ``EstruturaProduto`` tem unique ``[empresaId, produtoId,
        # versao]``: se uma execução anterior criou a versão 1 e a limpeza a
        # INATIVOU, criar uma nova versão 1 colide (409 "Versão 1 já existe").
        # Por isso buscamos em qualquer status e:
        #   - ATIVA com itens  → reutiliza direto.
        #   - INATIVA (ou ATIVA sem itens) → REATIVA (PUT status=ATIVA) e
        #     reaproveita, garantindo itens depois.
        resp = self._get(
            "/estruturas-produto",
            params={"produtoId": produto_pai["id"], "limit": 50},
        )
        estruturas = resp.json().get("data", []) if resp.ok else []
        # Prefere uma ATIVA com itens; senão qualquer estrutura existente.
        estrutura = next(
            (e for e in estruturas
             if (e.get("status") == "ATIVA") and (e.get("itens") or [])),
            None,
        )
        if estrutura:
            return {"produtoPai": produto_pai, "estrutura": estrutura}

        estrutura_existente = estruturas[0] if estruturas else None
        if estrutura_existente:
            # Reativa a estrutura existente (evita colisão de versão) e segue
            # para garantir o item abaixo.
            self._request.put(
                self._url(f"/estruturas-produto/{estrutura_existente['id']}"),
                headers=self._headers(com_json=True),
                data={"produtoId": produto_pai["id"], "status": "ATIVA"},
            )
            # Recarrega para saber se já tem itens.
            r_det = self._get(f"/estruturas-produto/{estrutura_existente['id']}")
            estrutura = r_det.json() if r_det.ok else estrutura_existente
            if estrutura.get("itens"):
                return {"produtoPai": produto_pai, "estrutura": estrutura}
            # Estrutura reativada mas sem itens: adiciona o item abaixo.
        else:
            # 3) Nenhuma estrutura existe: cria ATIVA nova.
            r = self._post(
                "/estruturas-produto",
                data={
                    "produtoId": produto_pai["id"],
                    "descricao": f"BOM QA {run_id}",
                    "rendimento": 1,
                    "status": "ATIVA",
                },
            )
            assert r.status in (200, 201), (
                f"Falha ao criar estrutura ATIVA do produto-pai: "
                f"status {r.status} — {r.text()}"
            )
            estrutura = r.json()

        r_item = self._post(
            f"/estruturas-produto/{estrutura['id']}/itens",
            data={
                "produtoComponenteId": componente["id"],
                "quantidade": quantidade_componente,
                "unidadeMedida": componente.get("unidade") or "CX",
                "percentualPerda": 0,
                "sequencia": 1,
                "tipoComponente": "MATERIA_PRIMA",
            },
        )
        assert r_item.status in (200, 201), (
            f"Falha ao adicionar item à estrutura {estrutura['id']}: "
            f"status {r_item.status} — {r_item.text()}"
        )

        # Recarrega a estrutura com os itens para o chamador.
        r_det = self._get(f"/estruturas-produto/{estrutura['id']}")
        if r_det.ok:
            estrutura = r_det.json()
        return {"produtoPai": produto_pai, "estrutura": estrutura}

    def inativar_estrutura(self, estrutura_id: str, produto_id: str) -> bool:
        """Inativa uma estrutura (limpeza best-effort da BOM de QA).

        ``PUT /estruturas-produto/:id`` com ``{status: 'INATIVA'}``. A rota não
        expõe DELETE da estrutura, então inativamos — isso libera a restrição
        de unicidade de estrutura ATIVA por produto para execuções futuras.
        Retorna ``True`` quando aceito (2xx), ``False`` caso contrário.
        """
        try:
            resp = self._request.put(
                self._url(f"/estruturas-produto/{estrutura_id}"),
                headers=self._headers(com_json=True),
                data={"produtoId": produto_id, "status": "INATIVA"},
            )
            return resp.status in (200, 201)
        except Exception:
            return False

    def criar_op_com_bom(
        self, produto_pai_id: str, quantidade: int = 1
    ) -> dict:
        """Cria uma OP para o produto-pai, explodindo a BOM em itens.

        ``POST /ordens-producao`` com ``explodirBom=true`` e
        ``gerarEtapas=false`` (mantém a OP em RASCUNHO sem etapas, para poder
        ser excluída livremente na limpeza — ``DELETE /ordens-producao/:id``
        bloqueia OPs com etapa iniciada/concluída, não com etapas PENDENTES,
        mas evitamos criá-las para simplificar). A explosão gera um
        ``ItemOrdemProducao`` com ``produtoComponenteId`` = o componente da BOM
        e quantidade = ``quantidadeLiquida × (quantidade / rendimento)``.

        Retorna a OP criada (``{id, numero, status, itensGerados, ...}``).
        """
        payload = {
            "produtoId": produto_pai_id,
            "quantidade": quantidade,
            "unidadeMedida": "UN",
            "dataEntregaPrevista": (datetime.now() + timedelta(days=30)).strftime(
                "%Y-%m-%d"
            ),
            "explodirBom": True,
            "gerarEtapas": False,
        }
        resp = self._post("/ordens-producao", data=payload)
        assert resp.status in (200, 201), (
            f"Falha ao criar OP com BOM: status {resp.status} — {resp.text()}"
        )
        return resp.json()

    def obter_ordem_producao(self, op_id: str) -> dict:
        """Busca o detalhe de uma OP (com ``itens``).

        ``GET /ordens-producao/:id`` — escopada pela empresa da sessão. Cada
        item traz ``produtoComponenteId``, ``quantidade`` e
        ``quantidadeLiberada`` (usados para calcular a necessidade líquida que
        vira a quantidade reservada). Retorna ``{}`` quando não encontrada.
        """
        resp = self._get(f"/ordens-producao/{op_id}")
        if not resp.ok:
            return {}
        return resp.json()

    def reservar_materiais_op(self, op_id: str) -> dict:
        """Cria as reservas de produção (ReservaProducao ATIVA) de uma OP.

        ``POST /pcp/analise-producao/:opId/reservar``. Cria uma reserva ATIVA
        para cada item da OP com ``produtoComponenteId``, com quantidade =
        ``quantidade − quantidadeLiberada``. Idempotente no backend (não
        duplica se já houver reservas ATIVAS). Retorna
        ``{ordemProducaoId, reservasCriadas, reservasIgnoradas, detalhes:[...]}``.
        """
        resp = self._post(f"/pcp/analise-producao/{op_id}/reservar")
        assert resp.status in (200, 201), (
            f"Falha ao reservar materiais da OP {op_id}: "
            f"status {resp.status} — {resp.text()}"
        )
        return resp.json()

    def cancelar_reservas_op(self, op_id: str) -> bool:
        """Cancela as reservas ATIVAS de uma OP (limpeza best-effort).

        ``DELETE /pcp/analise-producao/:opId/reservar`` — marca as
        ``ReservaProducao`` ATIVAS da OP como CANCELADAS (devolvendo o
        reservado/disponível). Retorna ``True`` quando aceito (2xx), ``False``
        caso contrário (a limpeza não deve derrubar o teste).
        """
        try:
            resp = self._request.delete(
                self._url(f"/pcp/analise-producao/{op_id}/reservar"),
                headers=self._headers(),
            )
            return resp.status in (200, 204)
        except Exception:
            return False

    def excluir_ordem_producao(self, op_id: str) -> bool:
        """Exclui uma OP normal (limpeza best-effort).

        ``DELETE /ordens-producao/:id`` — bloqueada se a OP estiver CONCLUIDA,
        tiver apontamentos, ou etapa iniciada/concluída. A OP criada por
        ``criar_op_com_bom`` fica em RASCUNHO sem etapas, então é removível.
        Retorna ``True`` quando aceito (2xx), ``False`` caso contrário.
        """
        try:
            resp = self._request.delete(
                self._url(f"/ordens-producao/{op_id}"),
                headers=self._headers(),
            )
            return resp.status in (200, 204)
        except Exception:
            return False

    # ──────────────────────────────────────────────────────────────
    # Seed de físico via recebimento (helper de alto nível)
    #
    # Reaproveita o fluxo de recebimento por compra já implementado nesta
    # classe (nota → conferência → endereçamento em lote) para dar físico
    # endereçado (origem WMS) a um produto, de forma determinística e via API.
    # Usado por testes que precisam de um produto COM saldo antes de exercitar
    # reserva/paridade (test_13). Retorna a quantidade efetivamente endereçada.
    # ──────────────────────────────────────────────────────────────

    def seed_fisico_por_recebimento(
        self, run_id: str, produto: dict, quantidade: int = 50
    ) -> dict:
        """Dá físico endereçado (WMS) a um produto via recebimento completo (API).

        Encadeia, via API (fonte de verdade), o caminho feliz do recebimento:
        cria nota rastreável → inicia conferência → confere tudo com contagem ==
        quantidade → confirma → sugere endereçamento → confirma em lote. Ao
        final, o produto tem ``SaldoEndereco`` (origem WMS) e o saldo
        consolidado reflete o físico.

        É idempotente no sentido de que cada chamada cria uma nova nota (com o
        ``run_id``) e soma físico — não "zera" o que já existe. Retorna
        ``{"nota": {...}, "quantidadeEnderecada": number}``.

        Observações:
          - As datas de validade vão bem no futuro (definidas em
            ``criar_nota_entrada``), evitando shelf life no caminho feliz.
          - A conferência usa validade no formato brasileiro (``dd/mm/aaaa``),
            exigido por ``conferir-todos`` (mesma regra do test_11).
        """
        nota = self.criar_nota_entrada(run_id, produto, quantidade=quantidade)
        nota_id = nota["id"]

        conf = self.iniciar_conferencia(nota_id)
        itens_conf = []
        for item in conf.get("itens", []):
            itens_conf.append(
                {
                    "itemNotaEntradaId": item["id"],
                    "quantidadeConferida": quantidade,
                    "lote": item.get("lote") or self.lote_do_run(run_id),
                    "validade": self._validade_br(item.get("validade")),
                }
            )
        assert itens_conf, "seed físico: conferência deve retornar itens da nota"
        self.conferir_todos(nota_id, itens_conf)
        self.confirmar_conferencia(nota_id)

        # Endereçamento em lote a partir das sugestões (put-away efetivo).
        sugestoes = self.sugerir_enderecamento(nota_id).get("sugestoes", [])
        itens_lote = []
        qtd_enderecada = 0
        for sug in sugestoes:
            produto_id_sug = sug.get("produtoId")
            item_id_sug = sug.get("itemId")
            distribuicao = sug.get("distribuicao") or {}
            if not produto_id_sug or not item_id_sug:
                continue
            for aloc in distribuicao.get("alocacoes", []) or []:
                q = aloc.get("quantidadeAlocada", 0) or 0
                if q <= 0:
                    continue
                itens_lote.append(
                    {
                        "itemNotaEntradaId": item_id_sug,
                        "produtoId": produto_id_sug,
                        "enderecoId": aloc["enderecoId"],
                        "quantidade": q,
                        "lote": sug.get("lote") or self.lote_do_run(run_id),
                        "validade": sug.get("validade") or None,
                    }
                )
                qtd_enderecada += q

        if itens_lote:
            self.confirmar_enderecamento_lote(nota_id, itens_lote)

        return {"nota": nota, "quantidadeEnderecada": qtd_enderecada}

    @staticmethod
    def _validade_br(validade) -> str:
        """Normaliza a validade para o formato brasileiro ``dd/mm/aaaa``.

        O endpoint ``conferir-todos`` aceita a validade no formato brasileiro.
        Converte ISO (``aaaa-mm-dd``) para ``dd/mm/aaaa``; na ausência de valor,
        devolve uma data bem no futuro (2 anos), coerente com o seed da nota.
        """
        if not validade:
            return (datetime.now() + timedelta(days=730)).strftime("%d/%m/%Y")
        texto = str(validade)
        if len(texto) >= 10 and texto[4] == "-" and texto[7] == "-":
            ano, mes, dia = texto[0:4], texto[5:7], texto[8:10]
            return f"{dia}/{mes}/{ano}"
        return texto

    # ──────────────────────────────────────────────────────────────
    # Ressuprimento — movimentação de saldo entre endereços
    # (test_18 — task 9.1, Requirements 8.1 e 8.2)
    #
    # Endpoint confirmado no backend
    # (``VisioFab.Wms.Back/src/modules/ressuprimento/ressuprimento.routes.ts``,
    # montado sob o prefixo ``/ressuprimento`` — o frontend consome
    # ``/ressuprimento/pendentes`` e ``/ressuprimento/executar``; guard
    # ``moduloGuard('WMS')``):
    #
    #   POST /ressuprimento/executar
    #     body: {produtoId, enderecoOrigemId, enderecoDestinoId, quantidade>0}
    #
    # É a operação de TRANSFERÊNCIA INTERNA entre dois endereços: dentro de uma
    # ``$transaction`` o backend DECREMENTA o ``SaldoEndereco`` da origem e
    # INCREMENTA (ou cria) o ``SaldoEndereco`` do destino pela MESMA
    # quantidade, grava dois ``LogMovimentacao`` (tipo ``TRANSFERENCIA``:
    # ``-quantidade`` na origem, ``+quantidade`` no destino) e uma
    # ``OrdemServicoWms`` (``operacao: 'REPOSICAO'``, ``status: 'CONCLUIDO'``).
    #
    # Pré-condição validada pelo backend: a origem precisa ter
    # ``SaldoEndereco.quantidade >= quantidade`` — caso contrário responde 422
    # ("Saldo insuficiente no pulmão") e NÃO move nada. A rota NÃO exige que a
    # origem seja ARMAZENAGEM nem que o destino seja PICKING (só move entre os
    # dois endereços informados), então o teste pode usar qualquer par de
    # endereços distintos com saldo na origem.
    #
    # Conservação (Requirement 8.2): como a operação é um par
    # débito(origem)/crédito(destino) de igual magnitude na MESMA transação, o
    # ``Saldo_Fisico`` TOTAL do produto (soma de todos os ``SaldoEndereco``, e
    # portanto o ``fisico`` consolidado) permanece inalterado — só muda a
    # distribuição por endereço (Requirement 8.1).
    # ──────────────────────────────────────────────────────────────

    def mover_saldo_entre_enderecos(
        self,
        produto_id: str,
        endereco_origem_id: str,
        endereco_destino_id: str,
        quantidade: float,
    ) -> Any:
        """Move (transfere) saldo de um endereço para outro — chamada CRUA.

        ``POST /ressuprimento/executar`` com
        ``{produtoId, enderecoOrigemId, enderecoDestinoId, quantidade}``.
        Decrementa o ``SaldoEndereco`` da origem e incrementa/cria o do destino
        pela mesma quantidade, na mesma transação — conservando o físico total
        do produto (ver bloco de documentação acima).

        Retorna o objeto de resposta CRU do Playwright (``APIResponse``) — o
        chamador inspeciona ``status``/corpo. O backend responde 422 quando a
        origem não tem saldo suficiente ("Saldo insuficiente no pulmão"); o
        teste trata esse caso como pré-requisito de ambiente (não como falha do
        fluxo feliz). ``5xx`` continua sendo tratado como falha dura pelo
        chamador (aqui a chamada é direta, sem o assert de 5xx de ``_post`` —
        para que o teste avalie o status explicitamente).
        """
        return self._request.post(
            self._url("/ressuprimento/executar"),
            headers=self._headers(com_json=True),
            data={
                "produtoId": produto_id,
                "enderecoOrigemId": endereco_origem_id,
                "enderecoDestinoId": endereco_destino_id,
                "quantidade": quantidade,
            },
        )

    # ──────────────────────────────────────────────────────────────
    # Separação / Picking (test_14 — task 5.2, Requirements 4.3 e 4.4)
    #
    # O caminho de picking do WMS é a Onda de Separação: uma ``OndaSeparacao``
    # gera ``ItemSeparacao`` (cada um com ``enderecoOrigemId`` escolhido por
    # FEFO/FIFO a partir dos ``SaldoEndereco`` do produto). Confirmar a
    # separação de um item (``PATCH /itens-separacao/:id/confirmar`` com
    # ``quantidadeSeparada``) **deduz o ``SaldoEndereco`` do endereço de
    # origem** (via ``StockService.deduzirSaldoEndereco``) — é essa dedução
    # que o Requirement 4.3 verifica.
    #
    # Nota de ambiente (registrada): a criação de uma onda nova exige um
    # ``PedidoVenda`` em status ``EM_SEPARACAO`` (``criarOnda`` valida isso).
    # Esse status só é atingido pela efetivação fiscal de uma venda
    # (``POST /vendas`` → emissão de NF-e real à SEFAZ), inviável de disparar
    # numa suíte de QA contra produção. Por isso o seed de picking é
    # **best-effort por reaproveitamento**: procuramos uma onda já existente
    # com item PENDENTE e saldo observável no endereço de origem. Quando o
    # ambiente não tem esse estado, o teste de 4.3 faz ``pytest.skip`` no seed
    # (pré-requisito de ambiente genuinamente indisponível), nunca no meio da
    # verificação. Prefixos reais: ``/api/ondas-separacao`` e
    # ``/api/itens-separacao`` (ver ``server.ts``).
    # ──────────────────────────────────────────────────────────────

    def saldos_por_endereco(
        self, produto_id: str, endereco_id: Optional[str] = None
    ) -> list:
        """Lista os ``SaldoEndereco`` de um produto (opcionalmente de 1 endereço).

        ``GET /saldos?search=&limit=`` retorna ``{data:[{enderecoId, produtoId,
        quantidade, endereco:{enderecoCompleto}, produto:{codigo,nome}}]}``. A
        rota não filtra por ``produtoId``/``enderecoId``, então filtramos aqui.
        Usado pelo Requirement 4.3 para medir o físico do endereço de origem
        antes e depois da separação. Retorna a lista (possivelmente vazia).
        """
        resp = self._get("/saldos", params={"limit": 500})
        registros = resp.json().get("data", []) if resp.ok else []
        saldos = []
        for r in registros:
            if r.get("produtoId") != produto_id:
                continue
            if endereco_id and r.get("enderecoId") != endereco_id:
                continue
            saldos.append(r)
        return saldos

    def saldo_no_endereco(self, produto_id: str, endereco_id: str) -> float:
        """Retorna a quantidade física (``SaldoEndereco.quantidade``) de um par
        produto×endereço, ou ``0.0`` quando não há registro.

        Conveniência sobre ``saldos_por_endereco`` para o Requirement 4.3
        (medir a redução do saldo físico no endereço de origem).
        """
        for s in self.saldos_por_endereco(produto_id, endereco_id):
            q = s.get("quantidade")
            try:
                return float(str(q).replace(",", ".")) if q is not None else 0.0
            except (ValueError, TypeError):
                return 0.0
        return 0.0

    def listar_ondas(self, status: Optional[str] = None, limit: int = 100) -> list:
        """Lista ondas de separação da empresa da sessão.

        ``GET /ondas-separacao?status=&limit=`` (isolada por empresa no
        backend). Cada onda traz ``progresso`` e ``ordens[].itens`` resumidos.
        Retorna a lista (``data``) ou ``[]`` quando a resposta não é OK. Usado
        para reaproveitar uma onda existente no seed best-effort do picking.
        """
        params: dict = {"limit": limit}
        if status:
            params["status"] = status
        resp = self._get("/ondas-separacao", params=params)
        if not resp.ok:
            return []
        return resp.json().get("data", []) or []

    def obter_onda(self, onda_id: str) -> dict:
        """Detalhe de uma onda (com ``ordens[].itens`` enriquecidos).

        ``GET /ondas-separacao/:id`` — cada item traz ``id``, ``produtoId``,
        ``enderecoOrigemId``, ``quantidadeSolicitada``, ``quantidadeSeparada``,
        ``status`` e ``produto``/``enderecoOrigem`` enriquecidos. Retorna
        ``{}`` quando não encontrada (404).
        """
        resp = self._get(f"/ondas-separacao/{onda_id}")
        if not resp.ok:
            return {}
        return resp.json()

    def itens_separacao_da_onda(self, onda_id: str) -> list:
        """Achata e retorna todos os ``ItemSeparacao`` de uma onda.

        Percorre ``ondas[].ordens[].itens`` do detalhe da onda. Cada item é o
        dicionário retornado pelo backend (com ``quantidadeSeparada`` — a
        quantidade separada "do backend" usada na paridade do Requirement 4.4).
        Retorna ``[]`` quando a onda não existe ou não tem itens.
        """
        onda = self.obter_onda(onda_id)
        itens = []
        for ordem in onda.get("ordens", []) or []:
            for item in ordem.get("itens", []) or []:
                itens.append(item)
        return itens

    def confirmar_item_separacao(
        self,
        item_id: str,
        quantidade_separada: float,
        motivo_divergencia: Optional[str] = None,
    ) -> Any:
        """Confirma a separação (picking) de um item — chamada CRUA (sem assert 2xx).

        ``PATCH /itens-separacao/:id/confirmar`` com ``{quantidadeSeparada,
        motivoDivergencia?}``. Deduz o ``SaldoEndereco`` do endereço de origem
        do item (Requirement 4.3). Quando ``quantidadeSeparada`` < solicitada,
        o backend exige ``motivoDivergencia`` (``PRODUTO_NAO_ENCONTRADO`` |
        ``QUANTIDADE_INSUFICIENTE`` | ``AVARIA``).

        Retorna o objeto de resposta cru do Playwright (``APIResponse``) — o
        chamador inspeciona ``status``/corpo (5xx continua sendo falha dura via
        ``_headers``/servidor, mas o PATCH direto aqui não faz o assert de 5xx;
        o teste trata o status explicitamente).
        """
        data: dict = {"quantidadeSeparada": quantidade_separada}
        if motivo_divergencia:
            data["motivoDivergencia"] = motivo_divergencia
        return self._request.patch(
            self._url(f"/itens-separacao/{item_id}/confirmar"),
            headers=self._headers(com_json=True),
            data=data,
        )

    def encontrar_item_separacao_pendente(self) -> dict:
        """Procura, nas ondas EM_SEPARACAO, um ``ItemSeparacao`` PENDENTE com
        saldo observável no endereço de origem.

        Percorre as ondas EM_SEPARACAO (reaproveitamento best-effort — ver nota
        do bloco) e retorna o primeiro item ``PENDENTE`` cujo
        ``enderecoOrigemId`` e ``produtoId`` tenham ``SaldoEndereco`` > 0
        (condição necessária para a dedução do Requirement 4.3 ser observável).
        Retorna ``{"onda": {...}, "item": {...}, "saldoOrigem": float}`` ou
        ``{}`` quando nenhum item elegível existe no ambiente.
        """
        for resumo in self.listar_ondas(status="EM_SEPARACAO"):
            onda_id = resumo.get("id")
            if not onda_id:
                continue
            for item in self.itens_separacao_da_onda(onda_id):
                if item.get("status") != "PENDENTE":
                    continue
                produto_id = item.get("produtoId")
                endereco_id = item.get("enderecoOrigemId")
                if not produto_id or not endereco_id:
                    continue
                saldo = self.saldo_no_endereco(produto_id, endereco_id)
                if saldo > 0:
                    return {
                        "onda": self.obter_onda(onda_id),
                        "item": item,
                        "saldoOrigem": saldo,
                    }
        return {}

    # ──────────────────────────────────────────────────────────────
    # Ondas × pedidos, conferência de saída (test_15 — Requirements 5.1, 5.2, 5.3)
    #
    # Prefixos reais (ver ``server.ts``):
    #   - ``/api/ondas-separacao``      (onda de separação)
    #   - ``/api/conferencias-saida``   (conferência de saída)
    #   - ``/api/pedidos-venda``        (pedidos que originam a onda)
    #   - ``/api/funcionarios``         (conferente da conferência de saída)
    #
    # Req 5.1 — a onda é gerada a partir de pedidos: ``iniciarOnda``
    # (``onda-separacao.service.ts``) agrupa os itens dos ``PedidoVenda`` da
    # onda POR PRODUTO e soma as quantidades, gerando os ``ItemSeparacao``
    # (distribuídos entre endereços de origem por FEFO/FIFO). Logo, a soma da
    # ``quantidadeSolicitada`` dos itens da onda POR PRODUTO deve ser igual à
    # soma da ``quantidade`` dos itens dos pedidos incluídos POR PRODUTO. É
    # essa igualdade que o Requirement 5.1 verifica quando há uma onda
    # observável no ambiente.
    #
    # Req 5.2/5.3 — conferência de saída: ``POST /conferencias-saida`` cria a
    # conferência de uma onda em status ``SEPARADA`` (exige ``conferenteId``) e
    # a coloca ``EM_CONFERENCIA``; ``PATCH /conferencias-saida/:id/itens/:itemId``
    # confere um ``ItemSeparacao`` comparando ``quantidadeConferida`` com a
    # ``quantidadeSeparada`` do item — igual ⇒ ``resultado=CONFORME`` (sem
    # divergência); menor ⇒ ``resultado=DIVERGENTE`` com ``tipoDivergencia``
    # (default ``FALTA``). O "valor faltante" do Req 5.3 é a diferença
    # ``quantidadeSeparada − quantidadeConferida``, derivada dos campos do item.
    #
    # ── LIMITAÇÃO DE AMBIENTE (registrada, herdada do test_14) ───────────
    # Criar uma onda NOVA exige um ``PedidoVenda`` em status ``EM_SEPARACAO``
    # (``criarOnda`` valida e rejeita 422 caso contrário), estado só atingido
    # pela efetivação fiscal real de uma venda (emissão de NF-e à SEFAZ),
    # inviável na suíte contra produção. Por isso o seed destes cenários é
    # **best-effort por REAPROVEITAMENTO**: procuramos uma onda já existente no
    # estado necessário (com pedidos observáveis, para 5.1; em ``SEPARADA``,
    # para 5.2/5.3). Quando o ambiente não tem esse estado, o teste faz
    # ``pytest.skip`` NO SEED (pré-requisito de ambiente genuinamente
    # indisponível), nunca um ``assert`` falso no meio da verificação.
    # ──────────────────────────────────────────────────────────────

    def itens_do_pedido_venda(self, pedido_id: str) -> list:
        """Retorna os itens de um pedido de venda (``GET /pedidos-venda/:id``).

        Cada item traz ``produtoId`` e ``quantidade`` (entre outros campos).
        Usado pelo Requirement 5.1 para somar, por produto, as quantidades dos
        pedidos incluídos numa onda e comparar com os itens da onda. Retorna
        ``[]`` quando o pedido não existe/não é acessível (isolamento por
        empresa) ou não tem itens.
        """
        resp = self._get(f"/pedidos-venda/{pedido_id}")
        if not resp.ok:
            return []
        return resp.json().get("itens", []) or []

    def soma_itens_pedidos_por_produto(self, pedido_ids: list) -> dict:
        """Soma, por ``produtoId``, as quantidades dos itens de vários pedidos.

        Percorre ``itens_do_pedido_venda`` de cada pedido e acumula a
        ``quantidade`` por produto. Retorna ``{produtoId: quantidadeTotal}``
        (float). É o lado "pedidos" da igualdade do Requirement 5.1.
        """
        soma: dict = {}
        for pedido_id in pedido_ids:
            for item in self.itens_do_pedido_venda(pedido_id):
                pid = item.get("produtoId")
                if not pid:
                    continue
                q = item.get("quantidade")
                try:
                    valor = float(str(q).replace(",", ".")) if q is not None else 0.0
                except (ValueError, TypeError):
                    valor = 0.0
                soma[pid] = soma.get(pid, 0.0) + valor
        return soma

    def soma_itens_onda_por_produto(self, onda_id: str) -> dict:
        """Soma, por ``produtoId``, a ``quantidadeSolicitada`` dos itens da onda.

        Achata ``itens_separacao_da_onda`` e acumula por produto. É o lado
        "onda" da igualdade do Requirement 5.1 (a onda é gerada agrupando os
        itens dos pedidos por produto). Retorna ``{produtoId: quantidadeTotal}``
        (float).
        """
        soma: dict = {}
        for item in self.itens_separacao_da_onda(onda_id):
            pid = item.get("produtoId")
            if not pid:
                continue
            q = item.get("quantidadeSolicitada")
            try:
                valor = float(str(q).replace(",", ".")) if q is not None else 0.0
            except (ValueError, TypeError):
                valor = 0.0
            soma[pid] = soma.get(pid, 0.0) + valor
        return soma

    def encontrar_onda_com_pedidos(self) -> dict:
        """Procura uma onda existente cujos pedidos e itens sejam observáveis.

        Reaproveitamento best-effort (Requirement 5.1): percorre as ondas da
        empresa (qualquer status, exceto CANCELADA) e retorna a primeira que
        tenha (a) ao menos um pedido vinculado com itens acessíveis e (b) ao
        menos um item de separação — isto é, a onda já foi iniciada e seus
        itens foram gerados a partir dos pedidos. Retorna
        ``{"onda": {...}, "pedidoIds": [...]}`` ou ``{}`` quando nenhuma onda
        elegível existe no ambiente.
        """
        for resumo in self.listar_ondas():
            if resumo.get("status") == "CANCELADA":
                continue
            onda_id = resumo.get("id")
            if not onda_id:
                continue
            onda = self.obter_onda(onda_id)
            pedidos = onda.get("pedidos", []) or []
            pedido_ids = [p.get("pedidoVendaId") for p in pedidos if p.get("pedidoVendaId")]
            if not pedido_ids:
                continue
            # A onda precisa ter itens gerados (foi iniciada a partir dos pedidos).
            if not self.itens_separacao_da_onda(onda_id):
                continue
            # E os itens dos pedidos precisam ser observáveis para comparar.
            if not self.soma_itens_pedidos_por_produto(pedido_ids):
                continue
            return {"onda": onda, "pedidoIds": pedido_ids}
        return {}

    def encontrar_onda_separada(self) -> dict:
        """Procura uma onda em status ``SEPARADA`` (pronta para conferência de saída).

        Reaproveitamento best-effort (Requirements 5.2/5.3): a conferência de
        saída (``POST /conferencias-saida``) exige a onda em ``SEPARADA``. Este
        método retorna a primeira onda ``SEPARADA`` com ao menos um
        ``ItemSeparacao`` (``{"onda": {...}, "itens": [...]}``) ou ``{}`` quando
        nenhuma existe. Ver LIMITAÇÃO DE AMBIENTE no cabeçalho do bloco: uma
        onda nova não pode ser criada na suíte, então dependemos do ambiente
        já ter uma onda nesse estado.
        """
        for resumo in self.listar_ondas(status="SEPARADA"):
            onda_id = resumo.get("id")
            if not onda_id:
                continue
            itens = self.itens_separacao_da_onda(onda_id)
            if itens:
                return {"onda": self.obter_onda(onda_id), "itens": itens}
        return {}

    def primeiro_funcionario(self) -> dict:
        """Retorna o primeiro funcionário ativo da empresa (para ``conferenteId``).

        ``GET /funcionarios`` (paginado). Retorna ``{}`` quando não há
        funcionário — o chamador decide (o teste faz ``pytest.skip`` do
        pré-requisito, já que a conferência de saída exige um ``conferenteId``).
        """
        resp = self._get("/funcionarios", params={"limit": 50})
        data = resp.json().get("data", []) if resp.ok else []
        ativos = [f for f in data if f.get("status") in (True, None, "ATIVO")]
        if ativos:
            return ativos[0]
        return data[0] if data else {}

    def criar_conferencia_saida(self, onda_id: str, conferente_id: str) -> Any:
        """Cria a conferência de saída de uma onda ``SEPARADA`` — chamada CRUA.

        ``POST /conferencias-saida`` com ``{ondaSeparacaoId, conferenteId}``.
        Coloca a conferência ``EM_CONFERENCIA``. Retorna o objeto de resposta
        cru do Playwright (``APIResponse``) — o chamador inspeciona ``status``/
        corpo (a onda precisa estar em ``SEPARADA``; caso contrário o backend
        responde 422, o que o teste trata como pré-requisito indisponível).
        5xx continua sendo falha dura (via ``_headers``/servidor não muda o
        contrato; o POST direto aqui não faz o assert de 5xx, o teste avalia o
        status explicitamente).
        """
        return self._request.post(
            self._url("/conferencias-saida"),
            headers=self._headers(com_json=True),
            data={"ondaSeparacaoId": onda_id, "conferenteId": conferente_id},
        )

    def conferir_item_saida(
        self,
        conferencia_id: str,
        item_separacao_id: str,
        quantidade_conferida: float,
        tipo_divergencia: Optional[str] = None,
        observacao: Optional[str] = None,
    ) -> Any:
        """Confere um item da conferência de saída — chamada CRUA (sem assert 2xx).

        ``PATCH /conferencias-saida/:id/itens/:itemId`` com
        ``{quantidadeConferida, tipoDivergencia?, observacao?}``. O backend
        compara ``quantidadeConferida`` com a ``quantidadeSeparada`` do
        ``ItemSeparacao``: iguais ⇒ ``resultado=CONFORME``; diferentes ⇒
        ``resultado=DIVERGENTE`` (com ``tipoDivergencia`` — default ``FALTA``
        quando não informado). ``tipoDivergencia`` ∈
        ``FALTA | EXCESSO | PRODUTO_ERRADO``.

        Retorna o objeto de resposta cru do Playwright (``APIResponse``).
        """
        data: dict = {"quantidadeConferida": quantidade_conferida}
        if tipo_divergencia:
            data["tipoDivergencia"] = tipo_divergencia
        if observacao:
            data["observacao"] = observacao
        return self._request.patch(
            self._url(f"/conferencias-saida/{conferencia_id}/itens/{item_separacao_id}"),
            headers=self._headers(com_json=True),
            data=data,
        )

    def obter_conferencia_saida(self, conferencia_id: str) -> dict:
        """Detalhe da conferência de saída (``GET /conferencias-saida/:id``).

        Retorna ``{id, status, ondaSeparacaoId, itens:[{id, produtoId,
        quantidadeEsperada, quantidadeConferida, status}]}`` — onde
        ``quantidadeEsperada`` é a ``quantidadeSeparada`` do item e ``status``
        do item ∈ ``PENDENTE | CONFORME | DIVERGENTE``. Retorna ``{}`` quando
        não encontrada (404). Aceita tanto o id da conferência quanto o
        ``ondaSeparacaoId`` (o backend faz fallback).
        """
        resp = self._get(f"/conferencias-saida/{conferencia_id}")
        if not resp.ok:
            return {}
        return resp.json()

    # ──────────────────────────────────────────────────────────────
    # Expedição / carregamento (test_15 — Requirements 5.4, 5.5)
    #
    # Prefixos reais (ver ``server.ts``):
    #   - ``/api/carregamentos``   (carregamento → expedição)
    #   - ``/api/estoque``         (visão de estoque global do ERP)
    #
    # Req 5.4 — expedir uma carga conferida reduz o Saldo_Fisico pela
    # quantidade expedida. A confirmação do carregamento
    # (``PATCH /carregamentos/:id/confirmar``) conclui a carga (status
    # ``CONCLUIDO``), marca os volumes como ``CARREGADO`` e, no fechamento,
    # chama ``StockService.deduzirEstoqueFinal`` — que **decrementa
    # ``Estoque.quantidade`` (o físico global do ERP) e ``Estoque.reservado``**
    # pela quantidade dos itens dos volumes (``ItemVolume.quantidade``, atrelada
    # ao ``ItemSeparacao.produtoId``). Portanto, a medida confiável e
    # observável do "Saldo_Fisico reduzido pela quantidade expedida" é o campo
    # ``quantidadeTotal`` de ``GET /estoque/:produtoId/visao`` (=
    # ``Estoque.quantidade``) — que é exatamente o que a dedução final abate.
    #
    # ── POR QUE A VISÃO ERP E NÃO O SALDO CONSOLIDADO ────────────────────
    # ``deduzirEstoqueFinal`` abate ``Estoque.quantidade`` (ERP global), NÃO o
    # ``SaldoEndereco`` (WMS endereçado). No ``saldo_consolidado``, quando o
    # produto tem ``SaldoEndereco`` > 0 a origem é WMS e o ``fisico`` vem da
    # soma dos endereços — que a dedução final NÃO toca. Logo, medir 5.4 pelo
    # ``fisico`` consolidado seria enganoso para produtos WMS. A visão de
    # estoque do ERP (``quantidadeTotal``) reflete a redução em qualquer caso —
    # é a fonte de verdade da baixa da expedição.
    #
    # ── LIMITAÇÃO DE AMBIENTE (registrada, herdada de 6.1/test_14) ───────
    # Para haver um carregamento CONFIRMÁVEL é preciso a cadeia completa:
    # pedido de venda em ``EM_SEPARACAO`` (efetivação fiscal real de NF-e à
    # SEFAZ) → onda → separação → volumes ``EMBALADO`` → carregamento com
    # volumes. Nada disso é disparável por uma suíte de QA contra produção. O
    # seed de 5.4 é, portanto, **best-effort por REAPROVEITAMENTO**: procuramos
    # um carregamento existente pronto para confirmar (com volumes, em status
    # não terminal). Quando o ambiente não tem esse estado, o teste faz
    # ``pytest.skip`` NO SEED (pré-requisito genuinamente indisponível), nunca
    # um ``assert`` falso. A expedição consome saldo real e NÃO é revertida
    # automaticamente — por isso só confirmamos uma carga que o ambiente já
    # montou (reaproveitamento), com cuidado, e registramos evidência.
    # ──────────────────────────────────────────────────────────────

    def listar_carregamentos(
        self, status: Optional[str] = None, limit: int = 100
    ) -> list:
        """Lista carregamentos da empresa da sessão.

        ``GET /carregamentos?status=&limit=`` (isolado por empresa no backend).
        Cada carregamento traz ``status``, ``totalVolumes``,
        ``volumesCarregados``, ``pesoTotal`` e ``volumes[]``. Retorna a lista
        (``data``) ou ``[]`` quando a resposta não é OK.
        """
        params: dict = {"limit": limit}
        if status:
            params["status"] = status
        resp = self._get("/carregamentos", params=params)
        if not resp.ok:
            return []
        return resp.json().get("data", []) or []

    def encontrar_carregamento_confirmavel(self) -> dict:
        """Procura um carregamento pronto para ser confirmado (expedido).

        Reaproveitamento best-effort (Requirement 5.4): percorre os
        carregamentos da empresa e retorna o primeiro em status NÃO terminal
        (diferente de ``CONCLUIDO``/``CANCELADO``) que tenha ao menos um volume
        associado (``totalVolumes`` > 0) — condição para a confirmação deduzir
        físico. Retorna o dicionário do carregamento ou ``{}`` quando nenhum
        elegível existe no ambiente.
        """
        for carreg in self.listar_carregamentos():
            status = carreg.get("status")
            if status in ("CONCLUIDO", "CANCELADO"):
                continue
            total = carreg.get("totalVolumes")
            if total is None:
                total = len(carreg.get("volumes", []) or [])
            if total and total > 0:
                return carreg
        return {}

    def visao_estoque(self, produto_id: str) -> dict:
        """Visão de estoque global (ERP) de um produto.

        ``GET /estoque/:produtoId/visao`` → ``{produtoId, empresaId,
        quantidadeTotal, reservado, emTransito, disponivel}``, onde
        ``quantidadeTotal`` = ``Estoque.quantidade`` (o físico global do ERP,
        abatido por ``deduzirEstoqueFinal`` na expedição). Retorna ``{}``
        quando não encontrada/não OK.
        """
        resp = self._get(f"/estoque/{produto_id}/visao")
        if not resp.ok:
            return {}
        return resp.json()

    def fisico_erp(self, produto_id: str) -> float:
        """Físico global do ERP (``quantidadeTotal``) de um produto, como float.

        Conveniência sobre ``visao_estoque`` para a medida do Requirement 5.4
        (redução do Saldo_Fisico pela quantidade expedida). Retorna ``0.0``
        quando não há registro de estoque.
        """
        visao = self.visao_estoque(produto_id)
        q = visao.get("quantidadeTotal")
        try:
            return float(str(q).replace(",", ".")) if q is not None else 0.0
        except (ValueError, TypeError):
            return 0.0

    def snapshot_fisico_erp(self, produto_ids: list) -> dict:
        """Snapshot ``{produtoId: fisicoErp}`` para um conjunto de produtos.

        Usado pelo Requirement 5.4 para medir o físico global do ERP de todos
        os produtos com saldo observável ANTES e DEPOIS da expedição, e assim
        aferir a redução agregada (a API não expõe, de forma limpa, a
        quantidade expedida por produto de um carregamento — ver nota do
        bloco). Retorna o mapa de físicos por produto.
        """
        return {pid: self.fisico_erp(pid) for pid in produto_ids}

    def produtos_com_saldo(self) -> list:
        """Lista os ``produtoId`` que têm saldo consolidado observável.

        Deriva do ``listar_saldos_consolidados`` (um registro por produto, já
        isolado por empresa). É o universo de produtos cujo físico global do
        ERP snapshotamos em torno da expedição (Requirement 5.4). Retorna a
        lista de ids (possivelmente vazia).
        """
        ids = []
        for r in self.listar_saldos_consolidados():
            pid = r.get("produtoId")
            if pid:
                ids.append(pid)
        return ids

    def confirmar_carregamento(self, carregamento_id: str) -> Any:
        """Confirma (expede) um carregamento — chamada CRUA (sem assert 2xx).

        ``PATCH /carregamentos/:id/confirmar``. Conclui a carga
        (``CONCLUIDO``), marca volumes como ``CARREGADO``, atualiza pedidos →
        ``FATURADO``, conclui as ondas e, no fechamento, deduz o físico global
        do ERP (``deduzirEstoqueFinal``) pela quantidade dos itens dos volumes
        — a baixa que o Requirement 5.4 verifica.

        Retorna o objeto de resposta cru do Playwright (``APIResponse``) — o
        chamador inspeciona ``status``/corpo (o backend pode responder 422 em
        pré-condições como "nenhum volume no carregamento" ou inconsistência de
        estoque; o teste trata isso como pré-requisito indisponível, não como
        falha do fluxo feliz). Operação IRREVERSÍVEL: só é chamada sobre uma
        carga que o ambiente já montou (reaproveitamento).
        """
        return self._request.patch(
            self._url(f"/carregamentos/{carregamento_id}/confirmar"),
            headers=self._headers(com_json=True),
            data={},
        )

    # ──────────────────────────────────────────────────────────────
    # Cross-dock (test_18 — task 9.2, Requirement 8.3)
    #
    # Módulo ``cross-dock`` do backend
    # (``VisioFab.Wms.Back/src/modules/cross-dock``), montado sob o prefixo
    # ``/api/cross-dock`` (ver ``server.ts``), guard ``moduloGuard('WMS')``.
    #
    # Fluxo (comprovado em ``cross-dock.service.ts``):
    #   POST /cross-dock/identificar {notaEntradaId}
    #     → cruza ItemNotaEntrada.codigoProduto → Produto.codigo →
    #       ItemPedidoVenda.produtoId de pedidos CONFIRMADO/EM_SEPARACAO,
    #       retornando os itens elegíveis + pedidos com quantidade pendente.
    #   POST /cross-dock/confirmar {itens:[{itemNotaEntradaId, produtoId,
    #       quantidade, pedidoVendaId, tipo:'TRANSITO'|'OPORTUNISTICO',
    #       justificativa?}]}
    #     → cria CrossDockItem (IDENTIFICADO) + OrdemServicoWms
    #       (operacao CROSS_DOCK) e move os itens para EM_TRANSITO. NÃO cria
    #       SaldoEndereco em ARMAZENAGEM — o item NUNCA passa pela armazenagem
    #       definitiva (é a essência do cross-dock).
    #   PUT /cross-dock/:id/rotear {docaSaidaId?}
    #     → resolve a staging area (por doca; fallback) e move o item para
    #       EM_STAGING (saldo TEMPORÁRIO admitido no endereço de staging). Exige
    #       uma StagingArea ativa (endereço + doca) para a doca de saída, ou o
    #       pedido vinculado a uma onda com doca.
    #   PUT /cross-dock/:id/expedir
    #     → EM_STAGING → EXPEDIDO. Dá baixa do SaldoEndereco no endereço de
    #       staging (se houver) e grava LogMovimentacao CROSS_DOCK_EXPEDIDO.
    #
    # Requirement 8.3: ao final (EXPEDIDO) o item CHEGOU à expedição; admite-se
    # saldo temporário em endereço de STAGING durante o roteamento, mas NÃO deve
    # restar saldo residual em endereço de ARMAZENAGEM para aquele produto/lote
    # ao final (o cross-dock não endereça a armazenagem definitiva).
    #
    # Nota de ambiente: o cenário determinístico depende de pré-requisitos
    # externos (um pedido de venda CONFIRMADO/EM_SEPARACAO com o produto e uma
    # staging area com doca). Quando genuinamente indisponíveis, o teste faz
    # ``pytest.skip`` NO SEED (nunca no meio da verificação), seguindo o Error
    # Handling do design — nunca um assert falso.
    # ──────────────────────────────────────────────────────────────

    def cross_dock_identificar(self, nota_id: str) -> Any:
        """Identifica itens elegíveis a cross-dock de uma nota — chamada CRUA.

        ``POST /cross-dock/identificar {notaEntradaId}``. Retorna o
        ``APIResponse`` cru do Playwright para o chamador inspecionar
        ``status``/corpo (o corpo OK é uma lista de elegíveis, cada um com
        ``itemNotaEntradaId``, ``produtoId`` e ``pedidosElegiveis``). NÃO usa
        ``_post`` para que o teste avalie o status explicitamente (5xx continua
        sendo falha dura via o assert do chamador).
        """
        return self._request.post(
            self._url("/cross-dock/identificar"),
            headers=self._headers(com_json=True),
            data={"notaEntradaId": nota_id},
        )

    def cross_dock_confirmar(self, itens: list) -> Any:
        """Confirma itens como cross-dock — chamada CRUA.

        ``POST /cross-dock/confirmar {itens:[...]}``. Cada item segue o schema
        do backend (``confirmarCrossDockSchema``):
            {itemNotaEntradaId, produtoId, quantidade>0, pedidoVendaId,
             tipo:'TRANSITO'|'OPORTUNISTICO', justificativa?}
        Retorna o ``APIResponse`` cru (o corpo OK — 201 — é a lista de
        ``CrossDockItem`` criados, já em EM_TRANSITO).
        """
        return self._request.post(
            self._url("/cross-dock/confirmar"),
            headers=self._headers(com_json=True),
            data={"itens": itens},
        )

    def cross_dock_rotear(
        self, cross_dock_item_id: str, doca_saida_id: Optional[str] = None
    ) -> Any:
        """Roteia um item cross-dock para staging — chamada CRUA.

        ``PUT /cross-dock/:id/rotear`` com corpo opcional ``{docaSaidaId}``.
        Move o item para EM_STAGING (saldo temporário no endereço de staging).
        Retorna o ``APIResponse`` cru — o backend responde 422 quando não há
        doca de saída resolvível ou nenhuma staging area disponível (tratado
        como pré-requisito de ambiente no seed).
        """
        corpo = {"docaSaidaId": doca_saida_id} if doca_saida_id else {}
        return self._request.put(
            self._url(f"/cross-dock/{cross_dock_item_id}/rotear"),
            headers=self._headers(com_json=True),
            data=corpo,
        )

    def cross_dock_expedir(self, cross_dock_item_id: str) -> Any:
        """Marca um item cross-dock como expedido — chamada CRUA.

        ``PUT /cross-dock/:id/expedir``. EM_STAGING → EXPEDIDO, dando baixa do
        SaldoEndereco no endereço de staging (se houver). Retorna o
        ``APIResponse`` cru — 422 quando o item não está EM_STAGING.
        """
        return self._request.put(
            self._url(f"/cross-dock/{cross_dock_item_id}/expedir"),
            headers=self._headers(com_json=True),
            data={},
        )

    def cross_dock_obter(self, cross_dock_item_id: str) -> dict:
        """Detalhe de um item cross-dock (``GET /cross-dock/:id``).

        Retorna o dicionário do item (``{id, status, stagingEnderecoId,
        produtoId, quantidade, ...}``) ou ``{}`` quando não encontrado/erro.
        """
        resp = self._get(f"/cross-dock/{cross_dock_item_id}")
        if not resp.ok:
            return {}
        corpo = resp.json()
        return corpo if isinstance(corpo, dict) else {}

    def cross_dock_cancelar(self, cross_dock_item_id: str) -> Any:
        """Cancela um item cross-dock — chamada CRUA (limpeza best-effort).

        ``PUT /cross-dock/:id/cancelar``. Só permitido em IDENTIFICADO/
        EM_TRANSITO (o backend responde 422 caso contrário). Retorna o
        ``APIResponse`` cru; usado na limpeza para reverter itens que não
        chegaram a ser expedidos.
        """
        return self._request.put(
            self._url(f"/cross-dock/{cross_dock_item_id}/cancelar"),
            headers=self._headers(com_json=True),
            data={},
        )

    def listar_staging_areas(self) -> list:
        """Lista as staging areas da empresa (``GET /cross-dock/staging-areas``).

        Retorna a lista ``data`` (cada uma com ``id``, ``enderecoId``,
        ``docaId``, ``nome``, ``capacidade``, ``ativo``, ``ocupacaoAtual``) ou
        ``[]`` quando a resposta não é OK. Usado para descobrir uma staging
        area ativa (e sua doca) para o roteamento do cross-dock.
        """
        resp = self._get("/cross-dock/staging-areas")
        if not resp.ok:
            return []
        return resp.json().get("data", []) or []

    def listar_docas(self, limit: int = 200) -> list:
        """Lista as docas da empresa (``GET /docas``).

        Retorna a lista ``data`` (cada doca traz ``id``, ``tipo``/``sentido``
        quando aplicável) ou ``[]``. Usado para criar uma staging area de
        cross-dock (que exige uma doca) quando nenhuma existe.
        """
        resp = self._get("/docas", params={"limit": limit})
        if not resp.ok:
            return []
        corpo = resp.json()
        if isinstance(corpo, list):
            return corpo
        return corpo.get("data", []) or []

    def criar_staging_area(
        self, endereco_id: str, doca_id: str, nome: str, capacidade: int = 100
    ) -> Any:
        """Cria uma staging area — chamada CRUA.

        ``POST /cross-dock/staging-areas {enderecoId, docaId, nome,
        capacidade}``. Retorna o ``APIResponse`` cru (201 na criação; 409 se já
        existe staging para o endereço — nesse caso o chamador reaproveita a
        existente). Usado como best-effort para viabilizar o roteamento quando
        o ambiente não tem staging area cadastrada.
        """
        return self._request.post(
            self._url("/cross-dock/staging-areas"),
            headers=self._headers(com_json=True),
            data={
                "enderecoId": endereco_id,
                "docaId": doca_id,
                "nome": nome[:50],
                "capacidade": capacidade,
            },
        )

    # ──────────────────────────────────────────────────────────────
    # Pedido de venda — seed best-effort para o cross-dock (test_18 9.2)
    #
    # O cross-dock exige um PedidoVenda CONFIRMADO/EM_SEPARACAO com o produto.
    # Preferimos reaproveitar um pedido já existente com o produto; se não
    # houver, tentamos criar um (RASCUNHO → confirmar), o que exige um cliente
    # e uma tabela de preço já cadastrados na empresa demo. Quando esses
    # pré-requisitos não existem, o chamador faz ``pytest.skip`` no seed.
    # ──────────────────────────────────────────────────────────────

    def primeiro_cliente(self) -> dict:
        """Retorna o primeiro cliente ativo da empresa (``GET /clientes``).

        Retorna ``{}`` quando não há nenhum — o chamador trata como
        pré-requisito ausente.
        """
        resp = self._get("/clientes", params={"limit": 50})
        if not resp.ok:
            return {}
        clientes = resp.json().get("data", []) or []
        ativos = [c for c in clientes if c.get("status") in (True, None, "ATIVO")]
        return (ativos or clientes or [{}])[0] or {}

    def primeira_tabela_preco(self) -> dict:
        """Retorna a primeira tabela de preço da empresa (``GET /tabelas-preco``).

        Retorna ``{}`` quando não há nenhuma.
        """
        resp = self._get("/tabelas-preco", params={"limit": 50})
        if not resp.ok:
            return {}
        corpo = resp.json()
        tabelas = corpo.get("data", corpo) if isinstance(corpo, dict) else corpo
        if not isinstance(tabelas, list):
            return {}
        return (tabelas or [{}])[0] or {}

    def encontrar_pedido_venda_com_produto(self, produto_id: str) -> dict:
        """Procura um pedido CONFIRMADO/EM_SEPARACAO que contenha o produto.

        Reaproveitamento best-effort: percorre os pedidos nesses status e
        retorna o primeiro cujo detalhe inclua o ``produto_id`` com quantidade
        pendente. Retorna ``{}`` quando nenhum atende.
        """
        for status in ("CONFIRMADO", "EM_SEPARACAO"):
            resp = self._get(
                "/pedidos-venda", params={"status": status, "limit": 50}
            )
            if not resp.ok:
                continue
            pedidos = resp.json().get("data", []) or []
            for resumo in pedidos:
                pid = resumo.get("id")
                if not pid:
                    continue
                for item in self.itens_do_pedido_venda(pid):
                    if item.get("produtoId") == produto_id:
                        return self._get(f"/pedidos-venda/{pid}").json()
        return {}

    def criar_pedido_venda_confirmado(
        self, run_id: str, produto: dict, quantidade: int
    ) -> dict:
        """Cria e confirma um pedido de venda com o produto — best-effort.

        Cria um pedido RASCUNHO (``POST /pedidos-venda``) com um cliente e uma
        tabela de preço existentes e o confirma (``PATCH /:id/confirmar`` →
        CONFIRMADO). Retorna o pedido confirmado (``{id, status, ...}``) ou
        ``{}`` quando um pré-requisito (cliente/tabela) não existe ou a criação
        falha — o chamador trata como pré-requisito de ambiente ausente.
        """
        cliente = self.primeiro_cliente()
        tabela = self.primeira_tabela_preco()
        if not cliente.get("id") or not tabela.get("id"):
            return {}

        payload = {
            "clienteId": cliente["id"],
            "tabelaPrecoId": tabela["id"],
            "observacao": f"QA-WMS cross-dock {run_id}",
            "itens": [
                {
                    "produtoId": produto["id"],
                    "quantidade": quantidade,
                    "precoUnitario": 1,
                }
            ],
        }
        resp = self._post("/pedidos-venda", data=payload)
        if resp.status not in (200, 201):
            return {}
        pedido = resp.json()
        pedido_id = pedido.get("id")
        if not pedido_id:
            return {}

        # Confirmar (RASCUNHO → CONFIRMADO) para tornar elegível ao cross-dock.
        conf = self._patch_raw(f"/pedidos-venda/{pedido_id}/confirmar")
        if conf.status not in (200, 201):
            return {}
        return self._get(f"/pedidos-venda/{pedido_id}").json()

    def _patch_raw(self, path: str, data: Optional[dict] = None) -> Any:
        """PATCH cru (sem assert de 5xx) — para transições cujo status o
        chamador precisa inspecionar (ex.: confirmar pedido de venda)."""
        return self._request.patch(
            self._url(path),
            headers=self._headers(com_json=True),
            data=data or {},
        )

    # ──────────────────────────────────────────────────────────────
    # Webhooks (task 11.1 — Requirements 10.1, 10.2, 10.3, 10.4)
    #
    # O módulo de webhooks do backend (``integracao/webhook.routes.ts``) é
    # registrado no ``server.ts`` sob o prefixo ``/api/webhooks`` (sobre a RAIZ
    # do host, como a integração externa — não sob o mesmo ``/api`` da
    # ``API_URL``). Ao contrário da integração por API-Key, estas rotas usam o
    # **Bearer da sessão** (``authenticate`` + ``moduloGuard('WMS')``), então
    # reaproveitamos ``_headers()`` (Authorization) — apenas montamos a URL
    # absoluta via ``_base_host()``.
    #
    # Modelo de dados (schema.prisma):
    #   WebhookConfig  { id, empresaId, url, eventos (CSV), ativo, criadoEm }
    #   WebhookEntrega { id, webhookConfigId, evento, payload (JSON string),
    #                    statusHttp, tentativas, sucesso, criadoEm,
    #                    ultimaTentativa }
    #
    # O ``payload`` gravado é a string JSON
    #   { evento, timestamp, empresaId, dados }
    # onde ``dados`` traz o identificador do registro que originou o evento
    # (ex.: ``carregamentoId`` para ``expedicao.carregada``).
    #
    # Eventos suportados (``EVENTOS_VALIDOS`` em webhook.routes.ts):
    #   nota.recebida, nota.divergente, separacao.iniciada,
    #   separacao.concluida, expedicao.carregada, estoque.atualizado
    #
    # Rotas:
    #   GET    /api/webhooks                    -> lista webhooks da empresa
    #   POST   /api/webhooks                    -> cria (url + eventos[])  -> 201
    #   PUT    /api/webhooks/:id                -> edita (url/eventos/ativo)
    #   DELETE /api/webhooks/:id                -> remove
    #   GET    /api/webhooks/:id/entregas       -> últimas 50 entregas
    #   POST   /api/webhooks/entregas/:id/reenviar -> redispara (cria nova entrega)
    #
    # Reprodutibilidade do DISPARO (10.1/10.2/10.3): a única chamada de
    # ``dispararWebhook`` a partir de um evento REAL do WMS é
    # ``expedicao.carregada`` (conclusão de carregamento — pipeline pesado
    # onda→separação→carregamento→volumes). Não há endpoint leve que dispare um
    # evento coberto de forma determinística contra produção. Por isso os
    # helpers abaixo apenas EXPÕEM o módulo; o teste decide entre observar
    # entregas já existentes / reenviar (quando houver) e, na ausência de massa,
    # ``pytest.skip`` no seed com motivo explícito (nunca assert falso).
    # ──────────────────────────────────────────────────────────────

    #: Eventos aceitos pelo cadastro de webhook (espelha EVENTOS_VALIDOS).
    WEBHOOK_EVENTOS_VALIDOS = (
        "nota.recebida",
        "nota.divergente",
        "separacao.iniciada",
        "separacao.concluida",
        "expedicao.carregada",
        "estoque.atualizado",
    )

    def _url_webhook(self, path: str) -> str:
        """Monta a URL absoluta de uma rota de webhook (base do host + path).

        As rotas de webhook são registradas em ``/api/webhooks`` sobre a raiz
        do host (não sob o ``/api`` do restante da API). Ex.:
        ``https://api.vizorerp.com.br`` + ``/api/webhooks``.
        """
        return f"{self._base_host()}/{path.lstrip('/')}"

    def listar_webhooks(self) -> list:
        """Lista os webhooks configurados da empresa da sessão.

        ``GET /api/webhooks`` — a rota filtra por ``empresaId`` do usuário
        autenticado (Bearer). Retorna a lista de ``WebhookConfig``
        (``[{id, empresaId, url, eventos, ativo, criadoEm}]``) ou ``[]`` quando
        a resposta não é OK. Somente leitura.
        """
        resp = self._request.get(
            self._url_webhook("/api/webhooks"), headers=self._headers()
        )
        assert resp.status < 500, (
            f"Falha dura (5xx) em GET /api/webhooks: status {resp.status}"
        )
        if not resp.ok:
            return []
        corpo = resp.json()
        # A rota retorna um array direto (findMany). Tolera formato {data:[...]}.
        if isinstance(corpo, list):
            return corpo
        return corpo.get("data", []) or []

    def criar_webhook(self, url: str, eventos: list) -> Any:
        """Cria um webhook para a empresa da sessão. Retorna o ``APIResponse``.

        ``POST /api/webhooks`` com ``{url, eventos:[...]}`` (201 em sucesso). O
        registro é gravado com ``empresaId`` do usuário autenticado. Retorna a
        resposta crua para o chamador inspecionar status/corpo (o teste usa o
        ``id`` retornado para depois listar entregas e limpar no ``finally``).
        NÃO trata 5xx como falha dura (o chamador decide), mas evita mascarar
        erros de servidor com o assert padrão.
        """
        resp = self._request.post(
            self._url_webhook("/api/webhooks"),
            headers=self._headers(com_json=True),
            data={"url": url, "eventos": eventos},
        )
        assert resp.status < 500, (
            f"Falha dura (5xx) em POST /api/webhooks: status {resp.status} — "
            f"{resp.text()}"
        )
        return resp

    def remover_webhook(self, webhook_id: str) -> Any:
        """Remove um webhook (limpeza best-effort). Retorna o ``APIResponse``.

        ``DELETE /api/webhooks/:id`` — a rota só remove se o webhook pertencer
        ao ``empresaId`` da sessão (senão 404). Usado no ``finally`` dos testes
        para não deixar configuração de QA residual.
        """
        resp = self._request.delete(
            self._url_webhook(f"/api/webhooks/{webhook_id}"),
            headers=self._headers(),
        )
        return resp

    def entregas_webhook(self, webhook_id: str) -> list:
        """Lista as entregas (deliveries) de um webhook.

        ``GET /api/webhooks/:id/entregas`` — retorna as últimas 50
        ``WebhookEntrega`` (mais recentes primeiro). A rota valida que o
        webhook pertence à empresa da sessão (senão 404). Retorna ``[]`` quando
        a resposta não é OK. Somente leitura.
        """
        resp = self._request.get(
            self._url_webhook(f"/api/webhooks/{webhook_id}/entregas"),
            headers=self._headers(),
        )
        assert resp.status < 500, (
            f"Falha dura (5xx) em GET /api/webhooks/{webhook_id}/entregas: "
            f"status {resp.status}"
        )
        if not resp.ok:
            return []
        corpo = resp.json()
        if isinstance(corpo, list):
            return corpo
        return corpo.get("data", []) or []

    def reenviar_entrega_webhook(self, entrega_id: str) -> Any:
        """Redispara uma entrega existente. Retorna o ``APIResponse``.

        ``POST /api/webhooks/entregas/:id/reenviar`` — recarrega o payload da
        entrega e chama ``dispararWebhook`` novamente, o que CRIA UMA NOVA
        ``WebhookEntrega`` para o mesmo evento (independente do sucesso HTTP).
        É o único caminho leve e determinístico para exercitar o registro de
        uma entrega (Req 10.1) quando já existe ao menos uma entrega de origem
        na empresa. Retorna a resposta crua (o chamador inspeciona status).
        """
        resp = self._request.post(
            self._url_webhook(f"/api/webhooks/entregas/{entrega_id}/reenviar"),
            headers=self._headers(com_json=True),
            data={},
        )
        assert resp.status < 500, (
            f"Falha dura (5xx) em POST reenviar entrega {entrega_id}: "
            f"status {resp.status} — {resp.text()}"
        )
        return resp

    @staticmethod
    def payload_dados_entrega(entrega: dict) -> dict:
        """Extrai o objeto ``dados`` do ``payload`` (JSON string) de uma entrega.

        O ``payload`` gravado é a string JSON
        ``{evento, timestamp, empresaId, dados}``. Retorna o dicionário
        ``dados`` (identificadores do registro que originou o evento) ou ``{}``
        quando o payload não é JSON válido ou não traz ``dados``.
        """
        import json

        bruto = entrega.get("payload")
        if not bruto:
            return {}
        try:
            corpo = json.loads(bruto)
        except (ValueError, TypeError):
            return {}
        dados = corpo.get("dados")
        return dados if isinstance(dados, dict) else {}

    # ──────────────────────────────────────────────────────────────
    # Importação de lançamentos por arquivo (test_20 — task 11.2,
    # Requirements 11.1, 11.2, 11.3)
    #
    # Estado do backend (investigado nesta task):
    #   ``VisioFab.Wms.Back/src/modules/integracao/file-importer.ts`` existe e
    #   expõe ``parseCSV(content)`` + ``TEMPLATES`` (layouts CSV de
    #   ``notas-entrada`` / ``pedidos-separacao`` / ``produtos``) + a interface
    #   ``ImportResult`` ({totalLinhas, importadas, rejeitadas, erros[]}). MAS
    #   ESSE MÓDULO NÃO É IMPORTADO NEM REGISTRADO EM NENHUMA ROTA — não há
    #   endpoint HTTP de importação por arquivo publicado (grep por
    #   ``file-importer``/``parseCSV``/``@fastify/multipart`` em todo
    #   ``src/`` = zero ocorrências fora do próprio arquivo). É código
    #   preparado/legado, ainda não plugado.
    #
    # Como não há endpoint reproduzível de forma determinística contra
    # produção, a disciplina da suíte manda ``pytest.skip`` NO SEED com motivo
    # explícito (nunca assert falso). Ainda assim, deixamos aqui um
    # ``importar_arquivo_lancamentos`` que SONDA os caminhos candidatos: se um
    # dia o endpoint for publicado (ex.: ``/api/v1/wms/importar`` ou
    # ``/importacao/arquivo``), o helper passa a funcionar sem reescrever os
    # testes — enquanto não existir, sinaliza "indisponível" e os testes pulam.
    #
    # Playwright ``APIRequestContext`` suporta multipart via ``multipart=``
    # (dict com ``{name, mimeType, buffer}`` para o campo de arquivo).
    # ──────────────────────────────────────────────────────────────

    #: Layout CSV de notas de entrada esperado pelo ``file-importer.ts``
    #: (cabeçalho da constante ``TEMPLATES['notas-entrada']``).
    IMPORT_CSV_HEADER_NOTAS = (
        "fornecedor_cnpj,numero_nota,serie,produto_codigo,quantidade,"
        "preco_unitario,data_entrega"
    )

    #: Caminhos candidatos onde um endpoint de importação por arquivo poderia
    #: ser publicado. Sondados em ordem; o primeiro que não responder 404/405
    #: (rota inexistente) é considerado o endpoint real.
    IMPORT_PATHS_CANDIDATOS = (
        "/api/v1/wms/importar",
        "/api/v1/wms/importacao/arquivo",
        "/api/webhooks/../importacao/arquivo",  # placeholder defensivo
        "/importacao/arquivo",
        "/integracao/importar-arquivo",
    )

    def montar_csv_notas(self, linhas: list) -> str:
        """Monta o conteúdo CSV de notas de entrada a partir de linhas.

        Cada ``linha`` é um dict com as chaves do layout
        (``fornecedor_cnpj``, ``numero_nota``, ``serie``, ``produto_codigo``,
        ``quantidade``, ``preco_unitario``, ``data_entrega``). Campos ausentes
        viram string vazia — útil para gerar propositalmente linhas inválidas
        (ex.: ``quantidade`` vazia/negativa) na validação do 11.2.

        Retorna o CSV completo (cabeçalho + linhas) como string.
        """
        colunas = self.IMPORT_CSV_HEADER_NOTAS.split(",")
        partes = [self.IMPORT_CSV_HEADER_NOTAS]
        for linha in linhas:
            partes.append(",".join(str(linha.get(c, "")) for c in colunas))
        return "\n".join(partes)

    def importar_arquivo_lancamentos(
        self,
        conteudo_csv: str,
        tipo: str = "notas-entrada",
        nome_arquivo: str = "lancamentos-qa.csv",
        api_key: Optional[str] = None,
    ) -> dict:
        """Sonda e (se existir) invoca o endpoint de importação por arquivo.

        Envia o CSV como multipart (campo ``arquivo``) para cada caminho
        candidato em ``IMPORT_PATHS_CANDIDATOS`` até um responder algo
        diferente de "rota inexistente" (404/405). Autentica com o Bearer da
        sessão por padrão; se ``api_key`` for informado, usa o header
        ``X-Api-Key`` (integração externa).

        Retorna um dict discriminado:
          - ``{"disponivel": False, "motivo": <str>}`` quando NENHUM caminho
            candidato responde como endpoint real (todos 404/405) — o teste
            deve ``pytest.skip`` com esse motivo.
          - ``{"disponivel": True, "status": <int>, "corpo": <dict|str>,
            "path": <str>}`` quando um endpoint respondeu (o teste inspeciona
            ``corpo`` — que deveria conter ``importadas``/``rejeitadas``/
            ``erros`` conforme ``ImportResult``).
        """
        buffer = conteudo_csv.encode("utf-8")
        ultimo_status = None
        for path in self.IMPORT_PATHS_CANDIDATOS:
            if ".." in path:
                # Placeholder defensivo — nunca é um endpoint real.
                continue
            url = self._url_integracao(path)
            headers = {}
            if api_key:
                headers["X-Api-Key"] = api_key
            else:
                headers = self._headers()
            try:
                resp = self._request.post(
                    url,
                    headers=headers,
                    multipart={
                        "tipo": tipo,
                        "arquivo": {
                            "name": nome_arquivo,
                            "mimeType": "text/csv",
                            "buffer": buffer,
                        },
                    },
                )
            except Exception:
                # Caminho não roteável / erro de transporte: tenta o próximo.
                continue
            ultimo_status = resp.status
            if resp.status in (404, 405):
                # Rota inexistente/método não permitido: tenta o próximo.
                continue
            # Endpoint respondeu (2xx, 4xx de validação, etc.) — é o real.
            try:
                corpo: Any = resp.json()
            except Exception:
                corpo = resp.text()
            return {
                "disponivel": True,
                "status": resp.status,
                "corpo": corpo,
                "path": path,
            }

        return {
            "disponivel": False,
            "motivo": (
                "Nenhum endpoint de importação de lançamentos por arquivo está "
                "publicado no backend. O utilitário 'file-importer.ts' "
                "(parseCSV + TEMPLATES + ImportResult) existe em "
                "src/modules/integracao/, porém NÃO é importado nem registrado "
                "em nenhuma rota (grep por 'file-importer'/'parseCSV'/multipart "
                "em src/ retorna zero ocorrências fora do próprio arquivo). "
                "Caminhos candidatos sondados retornaram 404/405 "
                f"(último status observado: {ultimo_status}). Publique a rota "
                "de importação por arquivo para habilitar 11.1/11.2/11.3."
            ),
        }

    # ──────────────────────────────────────────────────────────────
    # Endereçamento RF008 — config, overflow e validação (Requirement 11)
    #
    # Cobrem o Motor_Putaway do spec `enderecamento-pulmao-rf008`:
    #   - GET/PATCH /api/wms/putaway/config (wms-putaway-config.ts)
    #   - PUT /api/enderecos/:id { permiteOverflow } (endereco.routes.ts)
    #   - POST /api/enderecamento-inteligente/distribuir (motor RF008)
    # ──────────────────────────────────────────────────────────────

    def ler_config_putaway(self) -> dict:
        """Lê a Config_Putaway efetiva da empresa (GET /wms/putaway/config).

        Retorna ``{prediosVarreduraPorLado, usarClasseAbc, politicaIncompleto,
        overflowCapacidadePadrao}`` (com defaults aplicados pelo backend).
        Retorna ``{}`` se a rota não responder OK.
        """
        resp = self._get("/wms/putaway/config")
        return resp.json() if resp.ok else {}

    def set_config_putaway(self, **campos: Any) -> Any:
        """Atualiza a Config_Putaway (PATCH /wms/putaway/config).

        Aceita qualquer subconjunto de: ``prediosVarreduraPorLado`` (int),
        ``usarClasseAbc`` (bool), ``politicaIncompleto`` ('PARCIAL'|'BLOQUEAR'),
        ``overflowCapacidadePadrao`` (number). Retorna o ``APIResponse`` cru
        para o teste inspecionar status (403 quando não-admin) e corpo.
        """
        return self._patch("/wms/putaway/config", data=campos)

    def marcar_endereco_overflow(self, endereco_id: str, permite: bool = True) -> Any:
        """Marca/desmarca um endereço como overflow (PUT /enderecos/:id).

        Retorna o ``APIResponse`` cru para o teste inspecionar status/corpo.
        """
        return self._request.put(
            self._url(f"/enderecos/{endereco_id}"),
            headers=self._headers(com_json=True),
            data={"permiteOverflow": permite},
        )

    def listar_enderecos(self, limit: int = 200) -> list:
        """Lista endereços (GET /enderecos?limit=). Retorna ``data`` ou ``[]``."""
        resp = self._get("/enderecos", params={"limit": limit})
        if not resp.ok:
            return []
        corpo = resp.json()
        # A rota pode devolver {data:[...]} ou lista direta.
        if isinstance(corpo, dict):
            return corpo.get("data", []) or []
        return corpo or []

    def distribuir_raw(self, produto_id: str, quantidade: int) -> Any:
        """Distribuição inteligente retornando o ``APIResponse`` cru.

        Diferente de ``distribuir`` (que faz assert de OK e devolve o JSON),
        este método devolve a resposta crua para os testes que precisam
        verificar o status (ex.: 422 quando não há SKU master — Req 11.6).
        """
        return self._post(
            "/enderecamento-inteligente/distribuir",
            data={"produtoId": produto_id, "quantidade": quantidade},
        )

    # ──────────────────────────────────────────────────────────────
    # Setup de endereços para QA de put-away (Requirement 11)
    # ──────────────────────────────────────────────────────────────

    def _primeiro(self, path: str, params: Optional[dict] = None) -> Optional[dict]:
        """Retorna o primeiro item de uma listagem (``data``) ou None."""
        resp = self._get(path, params=params or {})
        if not resp.ok:
            return None
        corpo = resp.json()
        data = corpo.get("data", corpo) if isinstance(corpo, dict) else corpo
        if isinstance(data, list) and data:
            return data[0]
        return None

    def garantir_enderecos_para_qa(self, minimo: int = 6) -> list:
        """Garante uma malha mínima de endereços ARMAZENAGEM/LIVRE para o QA.

        Idempotente: se já houver >= ``minimo`` endereços de armazenagem/livre
        ativos, não gera nada. Caso contrário, usa os cadastros-base existentes
        (CD, Depósito, Zona, Estrutura) para gerar uma malha pequena via
        ``POST /enderecos/gerar`` (rua 1, prédios 1..N, 1 nível, 1 apto).

        Retorna a lista de endereços livres após a operação. Se faltar algum
        cadastro-base (CD/Depósito), retorna a lista atual sem gerar — o teste
        decide se faz skip.
        """
        atuais = self.garantir_enderecos_livres(minimo=minimo)
        if len(atuais) >= minimo:
            return atuais

        cd = self._primeiro("/centros-distribuicao", {"limit": 5})
        dep = self._primeiro("/depositos", {"limit": 5})
        zona = self._primeiro("/zonas", {"limit": 5})
        estrutura = self._primeiro("/estruturas", {"limit": 5})
        if not cd or not dep:
            return atuais  # sem cadastro-base para gerar — chamador faz skip

        payload = {
            "centroDistribuicaoId": cd["id"],
            "depositoId": dep["id"],
            "codigoDeposito": "001",
            "codigoZona": "001",
            "zonaId": zona["id"] if zona else None,
            "estruturaId": estrutura["id"] if estrutura else None,
            "areaArmazenagem": "PULMAO",
            "tipo": "ARMAZENAGEM",
            "lado": "AMBOS",
            "ruaInicio": 1, "ruaFim": 1,
            "predioInicio": 1, "predioFim": max(6, minimo),
            "nivelInicio": 1, "nivelFim": 1,
            "aptoInicio": 1, "aptoFim": 1,
        }
        # Remove chaves None (o backend valida uuid opcional).
        payload = {k: v for k, v in payload.items() if v is not None}
        self._post("/enderecos/gerar", data=payload)
        return self.garantir_enderecos_livres(minimo=minimo)
