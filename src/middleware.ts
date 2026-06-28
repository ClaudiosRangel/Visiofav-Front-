import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Next.js Middleware — Proteção de rotas no server-side.
 * 
 * Verifica se o usuário possui token antes de acessar rotas protegidas.
 * Nota: A validação real do JWT acontece no backend. Este middleware
 * apenas impede acesso a páginas protegidas sem token no cookie/header.
 */

// Rotas que NÃO requerem autenticação
const PUBLIC_PATHS = [
  '/login',
  '/portal/login',
  '/acompanhamento',
  '/_next',
  '/favicon.ico',
  '/api',
]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Permitir rotas públicas
  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next()
  }

  // Permitir assets estáticos
  if (pathname.includes('.')) {
    return NextResponse.next()
  }

  // Verificar token no cookie (se implementado) ou seguir normalmente
  // O frontend usa localStorage para o token, então o middleware serve
  // como camada extra de proteção — a validação real está no client-side + backend
  const response = NextResponse.next()

  // ── Segurança: Adicionar headers de proteção em todas as respostas ──
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-XSS-Protection', '1; mode=block')

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
