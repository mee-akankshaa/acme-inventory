import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../src/app'
import type { FastifyInstance } from 'fastify'

let app: FastifyInstance
let accessToken: string

// Track resources created during tests so we can clean up
let createdProductId: string
let createdProductSku: string
let createdCategoryId: string | undefined

beforeAll(async () => {
  app = buildApp()
  await app.ready()

  // Login as admin to get access token
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'admin@example.com', password: 'Demo@12345' },
  })
  expect(res.statusCode).toBe(200)
  accessToken = res.json().accessToken
})

afterAll(async () => {
  // Clean up: delete test products and categories created during tests
  if (createdProductId) {
    await app.prisma.alert.deleteMany({ where: { productId: createdProductId } })
    await app.prisma.inventory.deleteMany({ where: { productId: createdProductId } })
    await app.prisma.product.deleteMany({ where: { id: createdProductId } })
  }
  if (createdCategoryId) {
    await app.prisma.category.deleteMany({ where: { id: createdCategoryId } })
  }
  await app.close()
})

describe('GET /api/categories', () => {
  it('returns 200 with categories array', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/categories',
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toHaveProperty('categories')
    expect(Array.isArray(body.categories)).toBe(true)
    // Each root category should have a children array
    for (const cat of body.categories) {
      expect(cat).toHaveProperty('id')
      expect(cat).toHaveProperty('name')
      expect(cat).toHaveProperty('slug')
      expect(Array.isArray(cat.children)).toBe(true)
    }
  })

  it('returns 401 without token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/categories' })
    expect(res.statusCode).toBe(401)
  })
})

describe('POST /api/products', () => {
  it('creates a product and returns 201', async () => {
    createdProductSku = `TEST-${Date.now()}`
    const res = await app.inject({
      method: 'POST',
      url: '/api/products',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        name: 'Test LED Bulb',
        sku: createdProductSku,
        description: 'A test product',
        unit: 'pcs',
        price: 49.99,
        costPrice: 25.0,
        minStockLevel: 5,
      },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body).toHaveProperty('product')
    expect(body.product.name).toBe('Test LED Bulb')
    expect(body.product.sku).toBe(createdProductSku.toUpperCase())
    expect(body.product.active).toBe(true)
    // Decimal fields come back as strings in JSON
    expect(typeof body.product.price).toBe('string')
    expect(parseFloat(body.product.price)).toBeCloseTo(49.99)
    createdProductId = body.product.id
  })

  it('returns 409 on duplicate SKU', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/products',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        name: 'Duplicate SKU Product',
        sku: createdProductSku,
        unit: 'pcs',
        minStockLevel: 0,
      },
    })
    expect(res.statusCode).toBe(409)
    expect(res.json().error).toBe('SKU already exists')
  })

  it('returns 400 on invalid data (negative price)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/products',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        name: 'Bad Product',
        sku: `BAD-${Date.now()}`,
        unit: 'pcs',
        price: -10,
        minStockLevel: 0,
      },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json()).toHaveProperty('error')
  })
})

describe('GET /api/products', () => {
  it('returns 200 with products array and pagination fields', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/products',
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.products)).toBe(true)
    expect(typeof body.total).toBe('number')
    expect(typeof body.page).toBe('number')
    expect(typeof body.limit).toBe('number')
    expect(typeof body.pages).toBe('number')
    expect(body.page).toBe(1)
    expect(body.limit).toBe(20)
  })

  it('filters by search=LED', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/products?search=LED',
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.products)).toBe(true)
    // All returned products should match the search term in name or sku
    for (const p of body.products) {
      const matchesName = p.name.toLowerCase().includes('led')
      const matchesSku = p.sku.toLowerCase().includes('led')
      expect(matchesName || matchesSku).toBe(true)
    }
  })

  it('filters by inStock=true — returns only products with qty > 0', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/products?inStock=true',
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.products)).toBe(true)
    // All returned products must have inventory quantity > 0
    for (const p of body.products) {
      expect(p.inventory).toBeDefined()
      expect(p.inventory.quantityOnHand).toBeGreaterThan(0)
    }
  })
})

describe('GET /api/products/:id', () => {
  it('returns 200 with product detail including category and inventory', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/products/${createdProductId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toHaveProperty('product')
    expect(body.product.id).toBe(createdProductId)
    // inventory should be included
    expect(body.product).toHaveProperty('inventory')
    expect(body.product.inventory).toHaveProperty('quantityOnHand')
    // category may be null if not set
    expect('category' in body.product).toBe(true)
  })

  it('returns 404 for a non-existent UUID', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/products/00000000-0000-0000-0000-000000000000',
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(res.statusCode).toBe(404)
    expect(res.json().error).toBe('Product not found')
  })
})

describe('PUT /api/products/:id', () => {
  it('updates product fields and returns 200', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/products/${createdProductId}`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        name: 'Updated LED Bulb',
        price: 59.99,
        minStockLevel: 10,
      },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toHaveProperty('product')
    expect(body.product.name).toBe('Updated LED Bulb')
    expect(parseFloat(body.product.price)).toBeCloseTo(59.99)
    expect(body.product.minStockLevel).toBe(10)
  })

  it('returns 404 for non-existent product', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/products/00000000-0000-0000-0000-000000000000',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: 'Ghost Product' },
    })
    expect(res.statusCode).toBe(404)
  })
})

describe('DELETE /api/products/:id', () => {
  it('soft-deletes a product and subsequent GET returns 404', async () => {
    // Delete
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/products/${createdProductId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(deleteRes.statusCode).toBe(200)
    expect(deleteRes.json().success).toBe(true)

    // Subsequent GET should return 404
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/products/${createdProductId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(getRes.statusCode).toBe(404)

    // Mark as already soft-deleted so afterAll cleanup uses deleteMany safely
  })

  it('returns 404 when deleting an already-deleted product', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/products/${createdProductId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(res.statusCode).toBe(404)
  })
})
