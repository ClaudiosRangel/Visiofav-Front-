"""
Utilitário de manutenção do ambiente de QA (empresa demo).
==========================================================
NÃO é um teste — é uma ferramenta operacional para liberar endereços na demo,
executável manualmente quando o ambiente acumula saldo de QA a ponto de esgotar
os endereços (a distribuição inteligente do WMS não tem fallback de overflow —
ver docs/melhoria-endereco-overflow-putaway.md no backend).

O que faz (best-effort, tudo rastreável e reversível):
  1. Zera, via INVENTÁRIO, o SaldoEndereco dos lotes de QA (``LOTE-*``): cria
     um inventário, conta como 0 os itens cujo lote começa com "LOTE-" e aplica
     o ajuste — o backend seta o SaldoEndereco daquele item para 0 e ajusta o
     Estoque consolidado. Isso libera os endereços (Prioridade 3 da distribuição
     volta a enxergá-los como livres).
  2. Garante o produto demo MOCA395CX48 (endereçável, com SKU lastro/camada).

Como rodar (modo visual para acompanhar):
    cd tests/e2e-qa
    .venv\\Scripts\\activate
    $env:HEADLESS="false"; $env:SLOW_MO="300"; python manutencao_ambiente.py
"""
import os
from playwright.sync_api import sync_playwright
from conftest import BASE_URL, EMAIL, PASSWORD, API_URL
from wms_api import WmsApiClient, CODIGO_PRODUTO_DEMO


def _login_client():
    p = sync_playwright().start()
    headless = os.getenv("HEADLESS", "true").lower() == "true"
    slow_mo = int(os.getenv("SLOW_MO", "0"))
    b = p.chromium.launch(headless=headless, slow_mo=slow_mo)
    c = b.new_context(ignore_https_errors=True)
    pg = c.new_page()
    pg.goto(f"{BASE_URL}/login")
    pg.wait_for_load_state("networkidle")
    pg.get_by_label("Email").fill(EMAIL)
    pg.get_by_label("Senha").fill(PASSWORD)
    pg.get_by_role("button", name="Entrar").click()
    pg.wait_for_url("**/selecionar-empresa", timeout=20000)
    pg.wait_for_load_state("networkidle")
    cards = pg.locator('[class*="Card"]')
    cards.first.wait_for(timeout=15000)
    cards.first.click()
    pg.wait_for_url("**/modulos", timeout=15000)
    tok = pg.evaluate("() => localStorage.getItem('visiofab-wms-token')")
    api = WmsApiClient(c.request, API_URL, tok)
    return p, b, api


def zerar_saldos_qa(api: WmsApiClient) -> int:
    """Zera via inventário os SaldoEndereco de lotes de QA (LOTE-*).

    Retorna o número de itens ajustados (zerados).
    """
    # Cria um inventário CICLICO cobrindo todos os SaldoEndereco > 0.
    inv = api.criar_inventario(tipo="CICLICO")
    inv_id = inv.get("id")
    if not inv_id:
        print("[manutencao] não foi possível criar inventário — nada a zerar.")
        return 0

    detalhe = api.detalhe_inventario(inv_id)
    itens = detalhe.get("itens", []) or []
    ajustados = 0
    for item in itens:
        # O ItemInventario NÃO traz ``lote``; identificamos o saldo de QA pelo
        # CÓDIGO do produto (produtos de QA têm código ``QA-*`` ou o demo
        # ``MOCA395CX48``). Preservamos o estoque de negócio real (ex.: MP-*,
        # Stora Enzo, tintas) — só zeramos o que a suíte criou.
        produto = item.get("produto") or {}
        codigo = (produto.get("codigo") or "")
        eh_qa = codigo.startswith("QA-") or codigo == CODIGO_PRODUTO_DEMO
        if not eh_qa:
            continue
        # PULA endereços corrompidos (``enderecoCompleto`` com "NaN") — eles
        # fazem o ``aplicar-ajustes`` em bloco falhar com 500 no backend
        # (transação única). Zeramos apenas os saldos de QA em endereços
        # válidos, o que já libera endereços saudáveis para a distribuição.
        endereco = item.get("endereco") or {}
        end_completo = endereco.get("enderecoCompleto") or ""
        if "NaN" in end_completo:
            print(f"[manutencao] pulando endereço corrompido (NaN): {end_completo} "
                  f"produto={codigo}")
            continue
        item_id = item.get("id")
        if not item_id:
            continue
        try:
            api.contar_item_inventario(inv_id, item_id, saldo_contado=0)
            ajustados += 1
            print(f"[manutencao] zerando saldo QA: produto={codigo} "
                  f"endereco={end_completo} saldo={item.get('saldoSistema')}")
        except Exception as exc:
            print(f"[manutencao] falha ao contar item {item_id} como 0: {exc}")

    if ajustados > 0:
        try:
            res = api.aplicar_ajustes_inventario(inv_id)
            print(f"[manutencao] ajustes aplicados: {res.get('ajustesAplicados')} "
                  f"(itens de QA contados como 0: {ajustados})")
        except Exception as exc:
            print(f"[manutencao] falha ao aplicar ajustes: {exc}")
            # Se falhar em bloco mesmo sem NaN, cai para modo item-a-item.
            return _zerar_item_a_item(api)
    else:
        # Nenhum item de QA (em endereço válido) para zerar: conclui sem ajuste.
        try:
            api.concluir_inventario(inv_id)
        except Exception:
            pass
        print("[manutencao] nenhum item de QA em endereço válido neste inventário.")
    return ajustados


def _zerar_item_a_item(api: WmsApiClient) -> int:
    """Fallback: zera saldos de QA um endereço por inventário (isola item ruim).

    Quando o ``aplicar-ajustes`` em bloco falha (um item corrompido derruba a
    transação), criamos um inventário por vez, contamos UM item de QA como 0 e
    aplicamos — assim um item problemático não impede os demais.
    """
    total = 0
    for _ in range(60):  # teto de segurança
        inv = api.criar_inventario(tipo="CICLICO")
        inv_id = inv.get("id")
        if not inv_id:
            break
        det = api.detalhe_inventario(inv_id)
        alvo = None
        for item in det.get("itens", []) or []:
            produto = item.get("produto") or {}
            codigo = (produto.get("codigo") or "")
            endereco = item.get("endereco") or {}
            end_completo = endereco.get("enderecoCompleto") or ""
            saldo = item.get("saldoSistema", 0) or 0
            if (codigo.startswith("QA-") or codigo == CODIGO_PRODUTO_DEMO) \
                    and "NaN" not in end_completo and saldo > 0:
                alvo = item
                break
        if not alvo:
            try:
                api.concluir_inventario(inv_id)
            except Exception:
                pass
            break
        try:
            api.contar_item_inventario(inv_id, alvo["id"], saldo_contado=0)
            api.aplicar_ajustes_inventario(inv_id)
            total += 1
            print(f"[manutencao] (item-a-item) zerado produto="
                  f"{(alvo.get('produto') or {}).get('codigo')} "
                  f"endereco={(alvo.get('endereco') or {}).get('enderecoCompleto')}")
        except Exception as exc:
            print(f"[manutencao] (item-a-item) falha: {exc}")
            try:
                api.concluir_inventario(inv_id)
            except Exception:
                pass
            break
    return total


def garantir_demo(api: WmsApiClient) -> None:
    """Garante o produto demo MOCA395CX48 com SKU lastro/camada."""
    resp = api._get("/produtos", params={"search": CODIGO_PRODUTO_DEMO, "limit": 5})
    data = resp.json().get("data", []) if resp.ok else []
    demo = next((x for x in data if x.get("codigo") == CODIGO_PRODUTO_DEMO), None)
    if not demo:
        r = api._post("/produtos", data={
            "codigo": CODIGO_PRODUTO_DEMO,
            "nome": "MOCA 395 CAIXA 48 (QA DEMO)",
            "descricao": "Produto demo dedicado da suíte de QA (endereçável).",
            "unidade": "CX",
            "status": True,
        })
        assert r.status in (200, 201), f"Falha ao criar demo: {r.status} {r.text()}"
        demo = r.json()
        print(f"[manutencao] produto demo {CODIGO_PRODUTO_DEMO} criado.")
    skus = api._skus_do_produto(demo["id"])
    if not any(api._sku_tem_paletizacao(s, 9, 5) for s in skus):
        api._criar_sku(demo, "DEMO-SETUP", 9, 5, skus)
        print("[manutencao] SKU lastro=9/camada=5 criado para o demo.")
    print(f"[manutencao] produto demo pronto (id={demo['id']}).")


def main():
    p, b, api = _login_client()
    try:
        # Repete o inventário algumas vezes: cada inventário cobre os saldos
        # existentes; zerar libera endereços, mas pode haver itens novos.
        total = 0
        for _ in range(3):
            n = zerar_saldos_qa(api)
            total += n
            if n == 0:
                break
        print(f"[manutencao] total de itens de QA zerados: {total}")
        garantir_demo(api)
        print("MANUTENCAO_OK")
    finally:
        b.close()
        p.stop()


if __name__ == "__main__":
    main()
