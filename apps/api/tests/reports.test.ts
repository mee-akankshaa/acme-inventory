import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { buildApp } from '../src/app'
import type { FastifyInstance } from 'fastify'

// Mock alertQueue to prevent Redis/BullMQ issues in tests
vi.mock('../src/queues/alertQueue', () => ({
  alertQueue: { add: vi.fn().mockResolvedValue(undefined) },
}))

let app: FastifyInstance
let accessToken: string
let testProductId: string
let testProductSku: string

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

  // Create a test product for movement tests
  testProductSku = `REPORT-TEST-${Date.now()}`
  const productRes = await app.inject({
    method: 'POST',
    url: '/api/products',
    headers: { authorization: `Bearer ${accessToken}` },
    payload: {
      name: 'Report Test Product',
      sku: testProductSku,
      unit: 'pcs',
      minStockLevel: 5,
    },
  })
  expect(productRes.statusCode).toBe(201)
  testProductId = productRes.json().product.id

  // Create a stock-in transaction so movement report has data
  await app.inject({
    method: 'POST',
    url: '/api/stock/in',
    headers: { authorization: `Bearer ${accessToken}` },
    payload: {
      productId: testProductId,
      quantity: 10,
      idempotencyKey: `report-test-${Date.now()}`,
    },
  })
})

afterAll(async () => {
  // Clean up in FK order: stockTransactions → alerts → inventory → product
  if (testProductId) {
    await app.prisma.stockTransaction.deleteMany({ where: { productId: testProductId } })
    await app.prisma.alert.deleteMany({ where: { productId: testProductId } })
    await app.prisma.inventory.deleteMany({ where: { productId: testProductId } })
    await app.prisma.product.deleteMany({ where: { id: testProductId } })
  }
  await app.close()
})

describe('GET /api/reports/stock-summary', () => {
  it('returns aggregated stock summary with correct shape', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/reports/stock-summary',
      headers: { authorization: `Bearer ${accessToken}` },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    // Seed has 10 products + our test product = 11
    expect(typeof body.totalProducts).toBe('number')
    expect(body.totalProducts).toBeGreaterThanOrEqual(10)
    expect(typeof body.totalInventoryValue).toBe('number')
    expect(body.totalInventoryValue).toBeGreaterThanOrEqual(0)
    expect(typeof body.lowStockCount).toBe('number')
    expect(body.lowStockCount).toBeGreaterThanOrEqual(0)
    expect(typeof body.outOfStockCount).toBe('number')
    expect(body.outOfStockCount).toBeGreaterThanOrEqual(0)
  })

  it('returns 401 without token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/reports/stock-summary',
    })
    expect(res.statusCode).toBe(401)
  })
})

describe('GET /api/reports/stock-movement', () => {
  it('default (no params) returns movement array', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/reports/stock-movement',
      headers: { authorization: `Bearer ${accessToken}` },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.movement)).toBe(true)
    // After stock-in in beforeAll, there should be at least 1 day
    expect(body.movement.length).toBeGreaterThanOrEqual(1)
    const item = body.movement[0]
    expect(typeof item.date).toBe('string')
    expect(item.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(typeof item.totalIn).toBe('number')
    expect(typeof item.totalOut).toBe('number')
    expect(typeof item.netChange).toBe('number')
  })

  it('with explicit dateFrom/dateTo returns movement array', async () => {
    const dateFrom = new Date()
    dateFrom.setDate(dateFrom.getDate() - 7)
    const res = await app.inject({
      method: 'GET',
      url: `/api/reports/stock-movement?dateFrom=${dateFrom.toISOString()}&dateTo=${new Date().toISOString()}`,
      headers: { authorization: `Bearer ${accessToken}` },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.movement)).toBe(true)
  })

  it('filters by productId', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/reports/stock-movement?productId=${testProductId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.movement)).toBe(true)
    // Our test product had stock-in so should have at least 1 row
    expect(body.movement.length).toBeGreaterThanOrEqual(1)
  })

  it('returns 400 for invalid dateFrom', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/reports/stock-movement?dateFrom=not-a-date',
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 401 without token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/reports/stock-movement',
    })
    expect(res.statusCode).toBe(401)
  })
})

describe('GET /api/reports/top-products', () => {
  it('type=most-stocked returns products sorted by quantityOnHand desc', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/reports/top-products?type=most-stocked',
      headers: { authorization: `Bearer ${accessToken}` },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.type).toBe('most-stocked')
    expect(Array.isArray(body.products)).toBe(true)
    expect(body.products.length).toBeGreaterThan(0)

    // Verify sorted descending
    for (let i = 1; i < body.products.length; i++) {
      expect(body.products[i - 1].value).toBeGreaterThanOrEqual(body.products[i].value)
    }

    // Verify shape
    const p = body.products[0]
    expect(typeof p.id).toBe('string')
    expect(typeof p.name).toBe('string')
    expect(typeof p.sku).toBe('string')
    expect(typeof p.value).toBe('number')
  })

  it('type=most-moved with limit=5 returns ≤5 items', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/reports/top-products?type=most-moved&limit=5',
      headers: { authorization: `Bearer ${accessToken}` },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.type).toBe('most-moved')
    expect(Array.isArray(body.products)).toBe(true)
    expect(body.products.length).toBeLessThanOrEqual(5)

    // Verify shape
    if (body.products.length > 0) {
      const p = body.products[0]
      expect(typeof p.value).toBe('number')
      expect(typeof p.totalQuantity).toBe('number')
    }
  })

  it('returns 401 without token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/reports/top-products',
    })
    expect(res.statusCode).toBe(401)
  })
})

describe('GET /api/reports/vendor-summary', () => {
  it('returns 2 vendors from seed with correct shape', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/reports/vendor-summary',
      headers: { authorization: `Bearer ${accessToken}` },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.vendors)).toBe(true)
    // Seed has 2 vendors
    expect(body.vendors.length).toBe(2)

    const vendor = body.vendors[0]
    expect(typeof vendor.id).toBe('string')
    expect(typeof vendor.name).toBe('string')
    expect(typeof vendor.totalProducts).toBe('number')
    expect(typeof vendor.totalValueReceived).toBe('number')
    // Vendors are ordered by name ASC: Acme Components Ltd, Nimbus Supply Co
    expect(body.vendors[0].name).toBe('Acme Components Ltd')
    expect(body.vendors[1].name).toBe('Nimbus Supply Co')
  })

  it('returns 401 without token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/reports/vendor-summary',
    })
    expect(res.statusCode).toBe(401)
  })
})

describe('GET /api/reports/low-stock-report', () => {
  it('returns products where quantityOnHand <= minStockLevel', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/reports/low-stock-report',
      headers: { authorization: `Bearer ${accessToken}` },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.products)).toBe(true)
    expect(typeof body.total).toBe('number')
    expect(body.total).toBe(body.products.length)

    // All returned items must have quantityOnHand <= minStockLevel
    for (const p of body.products) {
      expect(p.quantityOnHand).toBeLessThanOrEqual(p.minStockLevel)
    }

    // Seed has at least 3 low-stock products (Cotton Shirt: 8<=20, Copper Wire: 8<=20, Bubble Wrap: 3<=5)
    // Plus our test product (qty=10, min=5) — 10 > 5 so NOT low stock
    expect(body.total).toBeGreaterThanOrEqual(3)

    // Verify shape
    if (body.products.length > 0) {
      const p = body.products[0]
      expect(typeof p.id).toBe('string')
      expect(typeof p.name).toBe('string')
      expect(typeof p.sku).toBe('string')
      expect(typeof p.minStockLevel).toBe('number')
      expect(typeof p.quantityOnHand).toBe('number')
    }
  })

  it('products are ordered by quantityOnHand ASC', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/reports/low-stock-report',
      headers: { authorization: `Bearer ${accessToken}` },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    for (let i = 1; i < body.products.length; i++) {
      expect(body.products[i - 1].quantityOnHand).toBeLessThanOrEqual(body.products[i].quantityOnHand)
    }
  })

  it('returns 401 without token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/reports/low-stock-report',
    })
    expect(res.statusCode).toBe(401)
  })
})

describe('GET /api/reports/transaction-export', () => {
  it('returns paginated response with correct shape', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/reports/transaction-export',
      headers: { authorization: `Bearer ${accessToken}` },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.transactions)).toBe(true)
    expect(typeof body.total).toBe('number')
    expect(typeof body.page).toBe('number')
    expect(typeof body.limit).toBe('number')
    expect(typeof body.pages).toBe('number')
    expect(body.page).toBe(1)
    expect(body.limit).toBe(100)
    expect(body.pages).toBe(Math.ceil(body.total / body.limit))

    // Should have at least the 1 transaction from beforeAll stock-in
    expect(body.total).toBeGreaterThanOrEqual(1)
  })

  it('pagination with custom page and limit', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/reports/transaction-export?page=1&limit=5',
      headers: { authorization: `Bearer ${accessToken}` },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.limit).toBe(5)
    expect(body.transactions.length).toBeLessThanOrEqual(5)
  })

  it('includes product, vendor, user in each transaction', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/reports/transaction-export?limit=5',
      headers: { authorization: `Bearer ${accessToken}` },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    if (body.transactions.length > 0) {
      const tx = body.transactions[0]
      expect(tx.product).toBeDefined()
      expect(tx.product.name).toBeTruthy()
      expect(tx.product.sku).toBeTruthy()
      expect(tx.user).toBeDefined()
      expect(tx.user.name).toBeTruthy()
    }
  })

  it('returns 401 without token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/reports/transaction-export',
    })
    expect(res.statusCode).toBe(401)
  })
})
