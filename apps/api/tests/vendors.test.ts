import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../src/app'
import type { FastifyInstance } from 'fastify'

let app: FastifyInstance
let accessToken: string

// Track resources created during tests for cleanup
let createdVendorId: string
let tempVendorId: string
let tempProductId: string

beforeAll(async () => {
  app = buildApp()
  await app.ready()

  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'admin@example.com', password: 'Demo@12345' },
  })
  expect(res.statusCode).toBe(200)
  accessToken = res.json().accessToken
})

afterAll(async () => {
  // Clean up temp product first (FK constraint)
  if (tempProductId) {
    await app.prisma.alert.deleteMany({ where: { productId: tempProductId } })
    await app.prisma.inventory.deleteMany({ where: { productId: tempProductId } })
    await app.prisma.product.deleteMany({ where: { id: tempProductId } })
  }
  // Clean up test vendors
  if (createdVendorId) {
    await app.prisma.vendor.deleteMany({ where: { id: createdVendorId } })
  }
  if (tempVendorId) {
    await app.prisma.vendor.deleteMany({ where: { id: tempVendorId } })
  }
  await app.close()
})

describe('GET /api/vendors', () => {
  it('returns 200 with vendors array and pagination (total >= 2 from seed)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/vendors',
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.vendors)).toBe(true)
    expect(typeof body.total).toBe('number')
    expect(typeof body.page).toBe('number')
    expect(typeof body.limit).toBe('number')
    expect(typeof body.pages).toBe('number')
    expect(body.page).toBe(1)
    expect(body.limit).toBe(20)
    expect(body.total).toBeGreaterThanOrEqual(2)
  })

  it('filters vendors with search=acme to Acme Components Ltd', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/vendors?search=acme',
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.vendors)).toBe(true)
    expect(body.vendors.length).toBeGreaterThanOrEqual(1)
    const names: string[] = body.vendors.map((v: { name: string }) => v.name.toLowerCase())
    expect(names.some((n) => n.includes("acme"))).toBe(true)
  })
})

describe('POST /api/vendors', () => {
  it('creates a vendor with minimal fields and returns 201', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/vendors',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        name: 'Test Vendor Day4',
        contactName: 'Test Contact',
        phone: '9999900000',
      },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body).toHaveProperty('vendor')
    expect(body.vendor.name).toBe('Test Vendor Day4')
    expect(body.vendor.active).toBe(true)
    createdVendorId = body.vendor.id
  })

  it('returns 400 when creating a vendor with an invalid email', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/vendors',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: 'Bad Email Vendor', email: 'not-an-email' },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json()).toHaveProperty('error')
  })
})

describe('GET /api/vendors/:id', () => {
  it('returns 200 with vendor detail including products array', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/vendors/${createdVendorId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toHaveProperty('vendor')
    expect(body.vendor.id).toBe(createdVendorId)
    expect(Array.isArray(body.vendor.products)).toBe(true)
  })

  it('returns 404 for a non-existent UUID', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/vendors/00000000-0000-0000-0000-000000000000',
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(res.statusCode).toBe(404)
    expect(res.json().error).toBe('Vendor not found')
  })
})

describe('PUT /api/vendors/:id', () => {
  it('updates vendor name and returns 200 with updated data', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/vendors/${createdVendorId}`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: 'Test Vendor Day4 Updated' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toHaveProperty('vendor')
    expect(body.vendor.name).toBe('Test Vendor Day4 Updated')
  })
})

describe('DELETE /api/vendors/:id', () => {
  it('soft-deletes vendor and unlinks its products', async () => {
    // Step a: Create a temp vendor
    const vendorRes = await app.inject({
      method: 'POST',
      url: '/api/vendors',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: 'Temp Vendor For Delete Test' },
    })
    expect(vendorRes.statusCode).toBe(201)
    tempVendorId = vendorRes.json().vendor.id

    // Step b: Create a temp product linked to that vendor
    const productSku = `TVDT-${Date.now()}`
    const productRes = await app.inject({
      method: 'POST',
      url: '/api/products',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        name: 'Temp Product For Vendor Delete',
        sku: productSku,
        unit: 'pcs',
        minStockLevel: 0,
        vendorId: tempVendorId,
      },
    })
    expect(productRes.statusCode).toBe(201)
    tempProductId = productRes.json().product.id

    // Step c: DELETE the vendor
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/vendors/${tempVendorId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    })

    // Step d: Verify response
    expect(deleteRes.statusCode).toBe(200)
    const deleteBody = deleteRes.json()
    expect(deleteBody.success).toBe(true)
    expect(deleteBody.productsUnlinked).toBe(1)

    // Step e: GET the product and verify vendorId is null
    const productGetRes = await app.inject({
      method: 'GET',
      url: `/api/products/${tempProductId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(productGetRes.statusCode).toBe(200)
    const productBody = productGetRes.json()
    expect(productBody.product.vendorId).toBeNull()

    // tempVendorId is soft-deleted; afterAll hard-deletes it so no inactive rows are left behind
  })
})

describe('GET /api/vendors/:id/products', () => {
  it('returns 200 with array of active products for the vendor', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/vendors/${createdVendorId}/products`,
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.products)).toBe(true)
  })
})
