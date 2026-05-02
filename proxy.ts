import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

const PUBLIC_PAGE_PATHS = new Set(['/leaderboard', '/sign-in', '/reset-password'])
const PUBLIC_API_PREFIXES = ['/api/auth', '/api/leaderboard']

function isStaticAsset(pathname: string) {
  return (
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    pathname === '/manifest.webmanifest' ||
    pathname === '/manifest.ts' ||
    pathname === '/apple-icon.png' ||
    pathname === '/icon0.svg' ||
    pathname === '/icon1.png' ||
    /\.[a-zA-Z0-9]+$/.test(pathname)
  )
}

function isPublicPage(pathname: string) {
  return PUBLIC_PAGE_PATHS.has(pathname)
}

function isPublicApi(pathname: string) {
  return PUBLIC_API_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isStaticAsset(pathname)) {
    return NextResponse.next()
  }

  const isApi = pathname.startsWith('/api/')
  const isPublic = isApi ? isPublicApi(pathname) : isPublicPage(pathname) || pathname === '/'

  if (isPublic && pathname !== '/sign-in') {
    return NextResponse.next()
  }

  const session = await auth.api.getSession({
    headers: request.headers,
  })

  if (session && pathname === '/sign-in') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  if (session || isPublic) {
    return NextResponse.next()
  }

  if (isApi) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const signInUrl = new URL('/sign-in', request.url)
  signInUrl.searchParams.set('callbackURL', `${pathname}${request.nextUrl.search}`)
  return NextResponse.redirect(signInUrl)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
}
