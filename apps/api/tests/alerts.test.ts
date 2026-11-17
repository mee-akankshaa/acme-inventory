import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { buildApp } from '../src/app'
import { processAlertCheck } from '../src/workers/processors/alertCheck'
import type { FastifyInstance } from 'fastify'

// Mock alertQueue to prevent actual Redis/BullMQ connections in tests
vi.mock('../src/queues/alertQueue', () => ({
  alertQueue: { add: vi.fn().mockResolvedValue(undefined) },
}))

let app: FastifyInstance
let accessToken: string

// Resources created during tests
let testProductId: string
let testProductSku: string
let createdAlertIds: string[] = []

beforeAll(async () => {
  app = buildApp()
  await app.ready()

  // Login as admin
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'admin@example.com', password: 'Demo@12345' },
  })
  expect(res.statusCode).toBe(200)
  accessToken = res.json().accessToken

  // Create a test product with inventory (minStockLevel=5)
  testProductSku = `ALERT-TEST-${Date.now()}`
  const productRes = await app.inject({
    method: 'POST',
    url: '/api/products',
    headers: { authorization: `Bearer ${accessToken}` },
    payload: {
      name: 'Alert Test Product',
      sku: testProductSku,
      unit: 'pcs',
      minStockLevel: 5,
    },
  })
  expect(productRes.statusCode).toBe(201)
  testProductId = productRes.json().product.id
})

afterAll(async () => {
  // Clean up in FK order: alerts → inventory → product
  if (testProductId) {
    await app.prisma.alert.deleteMany({ where: { productId: testProductId } })
    await app.prisma.inventory.deleteMany({ where: { productId: testProductId } })
    await app.prisma.product.deleteMany({ where: { id: testProductId } })
  }
  // Clean up any alertConfig created during tests
  const adminUser = await app.prisma.user.findUnique({ where: { email: 'admin@example.com' } })
  if (adminUser) {
    await app.prisma.alertConfig.deleteMany({ where: { userId: adminUser.id } })
  }
  await app.close()
})

// ─── Processor unit tests ──────────────────────────────────────────────────

describe('Alert processor — processAlertCheck unit tests', () => {
  it('does not create alert when stock is healthy', async () => {
    // Set inventory to well above minStockLevel (5)
    await app.prisma.inventory.update({
      where: { productId: testProductId },
      data: { quantityOnHand: 50 },
    })

    const before = await app.prisma.alert.count({ where: { productId: testProductId } })
    await processAlertCheck(app.prisma, {
      productId: testProductId,
      quantityOnHand: 50,
      transactionType: 'IN',
    })
    const after = await app.prisma.alert.count({ where: { productId: testProductId } })
    expect(after).toBe(before)
  })

  it('creates LOW_STOCK alert when quantityOnHand <= minStockLevel', async () => {
    // Clear any existing alerts first
    await app.prisma.alert.deleteMany({ where: { productId: testProductId } })

    const alert = await processAlertCheck(app.prisma, {
      productId: testProductId,
      quantityOnHand: 3, // below minStockLevel=5
      transactionType: 'OUT',
    })

    expect(alert).toBeDefined()
    expect(alert!.type).toBe('LOW_STOCK')
    expect(alert!.productId).toBe(testProductId)
    expect(alert!.isRead).toBe(false)
    expect(alert!.isSent).toBe(false)
    if (alert) createdAlertIds.push(alert.id)
  })

  it('does not create duplicate unread alert for same product+type', async () => {
    // There's already an unread LOW_STOCK alert for this product
    const countBefore = await app.prisma.alert.count({
      where: { productId: testProductId, type: 'LOW_STOCK', isRead: false },
    })
    expect(countBefore).toBe(1)

    const result = await processAlertCheck(app.prisma, {
      productId: testProductId,
      quantityOnHand: 2, // still low
      transactionType: 'OUT',
    })

    // Should return undefined (deduplicated)
    expect(result).toBeUndefined()

    const countAfter = await app.prisma.alert.count({
      where: { productId: testProductId, type: 'LOW_STOCK', isRead: false },
    })
    expect(countAfter).toBe(1) // no new alert created
  })

  it('creates OUT_OF_STOCK alert when quantityOnHand is 0', async () => {
    // Clear existing alerts so dedup doesn't block
    await app.prisma.alert.deleteMany({ where: { productId: testProductId } })

    const alert = await processAlertCheck(app.prisma, {
      productId: testProductId,
      quantityOnHand: 0,
      transactionType: 'OUT',
    })

    expect(alert).toBeDefined()
    expect(alert!.type).toBe('OUT_OF_STOCK')
    expect(alert!.message).toContain('out of stock')
    if (alert) createdAlertIds.push(alert.id)
  })
})

// ─── HTTP routes ───────────────────────────────────────────────────────────

describe('GET /api/alerts', () => {
  it('returns paginated list of alerts', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/alerts',
      headers: { authorization: `Bearer ${accessToken}` },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.alerts)).toBe(true)
    expect(typeof body.total).toBe('number')
    expect(typeof body.page).toBe('number')
    expect(typeof body.limit).toBe('number')
    expect(typeof body.pages).toBe('number')
    expect(body.page).toBe(1)
    expect(body.limit).toBe(20)
  })

  it('filters by isRead=false', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/alerts?isRead=false',
      headers: { authorization: `Bearer ${accessToken}` },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.alerts)).toBe(true)
    for (const alert of body.alerts) {
      expect(alert.isRead).toBe(false)
    }
  })

  it('returns 401 without token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/alerts' })
    expect(res.statusCode).toBe(401)
  })
})

describe('GET /api/alerts/unread-count', () => {
  it('returns count of unread alerts', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/alerts/unread-count',
      headers: { authorization: `Bearer ${accessToken}` },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(typeof body.count).toBe('number')
    expect(body.count).toBeGreaterThanOrEqual(0)
  })
})

describe('PUT /api/alerts/:id/read', () => {
  it('marks a specific alert as read', async () => {
    // Create a fresh unread alert
    const newAlert = await app.prisma.alert.create({
      data: {
        type: 'LOW_STOCK',
        productId: testProductId,
        message: 'Test alert for read test',
      },
    })
    createdAlertIds.push(newAlert.id)

    const res = await app.inject({
      method: 'PUT',
      url: `/api/alerts/${newAlert.id}/read`,
      headers: { authorization: `Bearer ${accessToken}` },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.alert.id).toBe(newAlert.id)
    expect(body.alert.isRead).toBe(true)
  })

  it('returns 404 for non-existent alert id', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/alerts/00000000-0000-0000-0000-000000000000/read',
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(res.statusCode).toBe(404)
    expect(res.json().error).toBe('Alert not found')
  })
})

describe('PUT /api/alerts/read-all', () => {
  it('marks all unread alerts as read and returns count', async () => {
    // Ensure there's at least one unread alert
    const newAlert = await app.prisma.alert.create({
      data: {
        type: 'OUT_OF_STOCK',
        productId: testProductId,
        message: 'Test alert for read-all',
        isRead: false,
      },
    })
    createdAlertIds.push(newAlert.id)

    const countBefore = await app.prisma.alert.count({ where: { isRead: false } })
    expect(countBefore).toBeGreaterThan(0)

    const res = await app.inject({
      method: 'PUT',
      url: '/api/alerts/read-all',
      headers: { authorization: `Bearer ${accessToken}` },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(typeof body.updated).toBe('number')
    expect(body.updated).toBeGreaterThan(0)

    // Verify all alerts are now read
    const countAfter = await app.prisma.alert.count({ where: { isRead: false } })
    expect(countAfter).toBe(0)
  })
})

describe('GET /api/alerts/config', () => {
  it('returns default config via upsert if none exists', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/alerts/config',
      headers: { authorization: `Bearer ${accessToken}` },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toHaveProperty('config')
    expect(typeof body.config.emailEnabled).toBe('boolean')
    expect(typeof body.config.lowStockThreshold).toBe('number')
    expect(typeof body.config.outOfStockEnabled).toBe('boolean')
  })
})

describe('PUT /api/alerts/config', () => {
  it('updates emailEnabled and lowStockThreshold', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/alerts/config',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        emailEnabled: true,
        lowStockThreshold: 15,
        outOfStockEnabled: true,
      },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.config.emailEnabled).toBe(true)
    expect(body.config.lowStockThreshold).toBe(15)
    expect(body.config.outOfStockEnabled).toBe(true)
  })

  it('returns 400 on invalid input (negative threshold)', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/alerts/config',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { lowStockThreshold: -1 },
    })
    expect(res.statusCode).toBe(400)
  })
})
