"""Setup pontual (não é teste): garante endereços de armazenagem na demo
para o QA de put-away RF008. Uso: python _setup_enderecos_qa.py"""
from playwright.sync_api import sync_playwright
from conftest import BASE_URL, EMAIL, PASSWORD, API_URL
from wms_api import WmsApiClient


def main():
    p = sync_playwright().start()
    b = p.chromium.launch(headless=True)
    c = b.new_context(ignore_https_errors=True)
    pg = c.new_page()
    pg.goto(f"{BASE_URL}/login"); pg.wait_for_load_state("networkidle")
    pg.get_by_label("Email").fill(EMAIL); pg.get_by_label("Senha").fill(PASSWORD)
    pg.get_by_role("button", name="Entrar").click()
    pg.wait_for_url("**/selecionar-empresa", timeout=20000); pg.wait_for_load_state("networkidle")
    cards = pg.locator('[class*="Card"]'); cards.first.wait_for(timeout=15000); cards.first.click()
    pg.wait_for_url("**/modulos", timeout=15000)
    tok = pg.evaluate("() => localStorage.getItem('visiofab-wms-token')")
    api = WmsApiClient(c.request, API_URL, tok)

    antes = api.listar_enderecos(limit=500)
    print(f"enderecos antes: {len(antes)}")
    livres = api.garantir_enderecos_para_qa(minimo=8)
    depois = api.listar_enderecos(limit=500)
    print(f"enderecos depois: {len(depois)} | livres armazenagem: {len(livres)}")
    for e in depois[:12]:
        print(f"  - {e.get('enderecoCompleto')} tipo={e.get('tipo')} status={e.get('status')} overflow={e.get('permiteOverflow')}")

    c.close(); b.close(); p.stop()


if __name__ == "__main__":
    main()
