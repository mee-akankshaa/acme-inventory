import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../src/app'
import type { FastifyInstance } from 'fastify'

let app: FastifyInstance
let accessToken: string
let refreshToken: string
let oldRefreshToken: string

beforeAll(async () => {
  app = buildApp()
  await app.ready()
})

afterAll(async () => {
  // Clean up refresh tokens created during tests
  await app.prisma.refreshToken.deleteMany({
    where: { user: { email: 'admin@example.com' } },
  })
  await app.close()
})

describe('POST /api/auth/login', () => {
  it('returns 200 + tokens on valid credentials', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'admin@example.com', password: 'Demo@12345' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.accessToken).toBeTruthy()
    expect(body.refreshToken).toBeTruthy()
    expect(body.user.role).toBe('admin')
    accessToken = body.accessToken
    refreshToken = body.refreshToken
    oldRefreshToken = refreshToken
  })

  it('returns 401 on wrong password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'admin@example.com', password: 'wrongpass' },
    })
    expect(res.statusCode).toBe(401)
    expect(res.json().error).toBe('Invalid credentials')
  })

  it('returns 401 on unknown email', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'nobody@example.com', password: 'whatever' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('returns 400 on invalid input', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'not-an-email', password: '' },
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('GET /api/auth/me', () => {
  it('returns 401 without token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/auth/me' })
    expect(res.statusCode).toBe(401)
  })

  it('returns 401 with invalid token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: 'Bearer invalid.token.here' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('returns 200 with valid token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().user.email).toBe('admin@example.com')
  })
})

describe('POST /api/auth/refresh', () => {
  it('returns new tokens on valid refresh token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refreshToken },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.accessToken).toBeTruthy()
    expect(body.refreshToken).toBeTruthy()
    // Update tokens for subsequent tests
    accessToken = body.accessToken
    refreshToken = body.refreshToken
  })

  it('old refresh token after rotation is rejected (401)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refreshToken: oldRefreshToken },
    })
    expect(res.statusCode).toBe(401)
  })

  it('returns 401 on tampered refresh token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refreshToken: 'tampered.jwt.token' },
    })
    expect(res.statusCode).toBe(401)
  })
})

describe('POST /api/auth/logout', () => {
  it('returns 200 and invalidates refresh token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { refreshToken },
    })
    expect(res.statusCode).toBe(200)

    // Refresh token should now be invalid
    const refreshRes = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refreshToken },
    })
    expect(refreshRes.statusCode).toBe(401)
  })
})
