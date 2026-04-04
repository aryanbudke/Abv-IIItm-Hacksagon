import { clerkMiddleware, createRouteMatcher, clerkClient } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks(.*)',
  '/api/patient-call/webhook',
  '/api/elevenlabs/webhook',
])

const isAdminRoute = createRouteMatcher(['/admin(.*)'])
const isDoctorRoute = createRouteMatcher(['/doctor(.*)'])

export default clerkMiddleware(async (auth, request) => {
  if (isPublicRoute(request)) return

  const { userId } = await auth.protect()

  if (isAdminRoute(request) || isDoctorRoute(request)) {
    const clerk = await clerkClient()
    const user = await clerk.users.getUser(userId)
    const role = (user.publicMetadata as any)?.role as string | undefined

    if (isAdminRoute(request) && role !== 'admin') {
      return NextResponse.redirect(new URL('/', request.url))
    }

    if (isDoctorRoute(request) && role !== 'doctor') {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
