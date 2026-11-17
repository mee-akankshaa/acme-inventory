import { FastifyInstance } from 'fastify'
import ExcelJS from 'exceljs'
import { z } from 'zod'
import { authenticate } from '../middleware/auth'

const HEADER_ARGB = 'FF1E1B4B'
const EXAMPLE_ARGB = 'FFE8E8E8'

function buildTemplate(
  sheetName: string,
  columns: { header: string; key: string; width: number }[],
  exampleRow: Record<string, string>,
  instructions: string[]
): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Acme Inventory'

  const ws = wb.addWorksheet(sheetName)
  ws.columns = columns

  // Style header
  const hr = ws.getRow(1)
  hr.height = 22
  hr.eachCell((cell: ExcelJS.Cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_ARGB } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
  })

  // Example row (grey, italic)
  const er = ws.addRow(exampleRow)
  er.eachCell((cell: ExcelJS.Cell) => {
    cell.font = { italic: true, color: { argb: 'FF888888' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXAMPLE_ARGB } }
  })

  // Instructions sheet
  const wi = wb.addWorksheet('Instructions')
  wi.getColumn(1).width = 60
  wi.getCell('A1').value = 'IMPORT INSTRUCTIONS'
  wi.getCell('A1').font = { bold: true, size: 14, color: { argb: HEADER_ARGB } }
  wi.addRow([])
  instructions.forEach((line) => {
    const row = wi.addRow([line])
    if (line.startsWith('•') || line.startsWith('*')) {
      row.getCell(1).font = { size: 11 }
    }
  })

  return wb
}

async function sendXlsx(reply: any, wb: ExcelJS.Workbook, filename: string) {
  const buffer = await wb.xlsx.writeBuffer()
  reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  reply.header('Content-Disposition', `attachment; filename="${filename}"`)
  return reply.send(Buffer.from(buffer as ArrayBuffer))
}

export default async function importRoutes(fastify: FastifyInstance) {

  // ── TEMPLATES ─────────────────────────────────────────────────────────────

  fastify.get('/template/vendors', { preHandler: [authenticate] }, async (_request, reply) => {
    const wb = buildTemplate(
      'Vendors',
      [
        { header: 'Company Name *', key: 'name', width: 28 },
        { header: 'Contact Person', key: 'contactName', width: 22 },
        { header: 'Phone', key: 'phone', width: 16 },
        { header: 'Email', key: 'email', width: 28 },
        { header: 'City', key: 'city', width: 14 },
        { header: 'Address', key: 'address', width: 35 },
      ],
      { name: 'Example Vendor Ltd', contactName: 'Jane Doe', phone: '5550100100', email: 'vendor@example.com', city: 'Springfield', address: '123 Example St' },
      [
        '* = Required field. Rows with empty Company Name will be skipped.',
        '',
        '• Company Name: Required. Duplicate names (already in system) will be skipped.',
        '• Contact Person: Optional. Name of contact at vendor.',
        '• Phone: Optional. With or without country code.',
        '• Email: Optional. Valid email format (name@domain.com).',
        '• City: Optional.',
        '• Address: Optional. Full address including shop/street.',
        '',
        'Row 2 in Template sheet is an EXAMPLE row — delete it before importing.',
        'Fill data from Row 3 onwards.',
        'Maximum 500 records per import.',
      ]
    )
    return sendXlsx(reply, wb, 'Vendors_Import_Template.xlsx')
  })

  fastify.get('/template/buyers', { preHandler: [authenticate] }, async (_request, reply) => {
    const wb = buildTemplate(
      'Buyers',
      [
        { header: 'Name *', key: 'name', width: 25 },
        { header: 'Phone', key: 'phone', width: 16 },
        { header: 'Email', key: 'email', width: 28 },
        { header: 'City', key: 'city', width: 14 },
        { header: 'Address', key: 'address', width: 35 },
      ],
      { name: 'Example Buyer Inc', phone: '5550100100', email: 'buyer@example.com', city: 'Springfield', address: '2 Example Avenue' },
      [
        '* = Required field. Rows with empty Name will be skipped.',
        '',
        '• Name: Required. Duplicate names (already in system) will be skipped.',
        '• Phone: Optional.',
        '• Email: Optional.',
        '• City: Optional.',
        '• Address: Optional.',
        '',
        'Row 2 in Template sheet is an EXAMPLE row — delete it before importing.',
        'Fill data from Row 3 onwards.',
        'Maximum 500 records per import.',
      ]
    )
    return sendXlsx(reply, wb, 'Buyers_Import_Template.xlsx')
  })

  fastify.get('/template/products', { preHandler: [authenticate] }, async (_request, reply) => {
    const wb = buildTemplate(
      'Products',
      [
        { header: 'Product Name *', key: 'name', width: 30 },
        { header: 'SKU *', key: 'sku', width: 15 },
        { header: 'Category', key: 'category', width: 18 },
        { header: 'Unit', key: 'unit', width: 10 },
        { header: 'Min Stock Level', key: 'minStock', width: 16 },
        { header: 'Opening Stock', key: 'openingStock', width: 16 },
        { header: 'Unit Price', key: 'price', width: 14 },
      ],
      { name: 'USB Cable 1m', sku: 'CAB-101', category: 'Electronics', unit: 'pcs', minStock: '5', openingStock: '50', price: '12' },
      [
        '* = Required fields.',
        '',
        '• Product Name: Required.',
        '• SKU: Required. Must be unique. If SKU already exists, record will be skipped.',
        '• Category: Optional. Category name (must exist in system, or will be ignored).',
        '• Unit: Optional. pcs / kg / ltr / box (default: pcs).',
        '• Min Stock Level: Optional. Number for low-stock alert (default: 0).',
        '• Opening Stock: Optional. Initial stock quantity to set.',
        '• Unit Price: Optional. Selling price in USD.',
        '',
        'Row 2 in Template sheet is an EXAMPLE row — delete it before importing.',
        'Fill data from Row 3 onwards.',
        'Maximum 500 records per import.',
      ]
    )
    return sendXlsx(reply, wb, 'Products_Import_Template.xlsx')
  })

  fastify.get('/template/inventory', { preHandler: [authenticate] }, async (_request, reply) => {
    const wb = buildTemplate(
      'Inventory',
      [
        { header: 'SKU *', key: 'sku', width: 15 },
        { header: 'Product Name', key: 'name', width: 30 },
        { header: 'Current Stock', key: 'stock', width: 16 },
        { header: 'Unit Price', key: 'price', width: 14 },
        { header: 'Notes', key: 'notes', width: 30 },
      ],
      { sku: 'CAB-101', name: 'USB Cable 1m', stock: '100', price: '12', notes: 'Opening stock adjustment' },
      [
        '* = Required field.',
        '',
        '• SKU: Required. Must match an existing product SKU in the system.',
        '• Product Name: Optional. For reference only — SKU is used to find the product.',
        '• Current Stock: Required. New stock quantity (replaces current quantity).',
        '• Unit Price: Optional. Updates selling price.',
        '• Notes: Optional. Reason for adjustment.',
        '',
        'Row 2 in Template sheet is an EXAMPLE row — delete it before importing.',
        'Fill data from Row 3 onwards.',
        'WARNING: This will create ADJUSTMENT transactions, not replace history.',
        'Maximum 500 records per import.',
      ]
    )
    return sendXlsx(reply, wb, 'Inventory_Import_Template.xlsx')
  })

  // ── IMPORT ENDPOINTS ──────────────────────────────────────────────────────

  fastify.post('/vendors', { preHandler: [authenticate] }, async (request, reply) => {
    const bodySchema = z.object({
      records: z.array(z.object({
        name: z.string(),
        contactName: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().optional(),
        city: z.string().optional(),
        address: z.string().optional(),
      })).max(500),
    })
    const parsed = bodySchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid request', details: parsed.error.flatten() })

    const { records } = parsed.data
    const result = { total: records.length, success: 0, warnings: 0, errors: 0, errorDetails: [] as any[] }

    // Get existing vendor names for duplicate check (batch)
    const names = records.map((r) => r.name.trim().toLowerCase()).filter(Boolean)
    const existing = await fastify.prisma.vendor.findMany({
      where: { active: true, name: { in: names.map((n) => n), mode: 'insensitive' } as any },
      select: { name: true },
    })
    const existingNames = new Set(existing.map((v) => v.name.toLowerCase()))

    for (let i = 0; i < records.length; i++) {
      const rec = records[i]
      const name = rec.name.trim()
      if (!name) {
        result.errors++
        result.errorDetails.push({ row: i + 3, name: '(empty)', reason: 'Company Name is required' })
        continue
      }
      if (existingNames.has(name.toLowerCase())) {
        result.errors++
        result.errorDetails.push({ row: i + 3, name, reason: 'Duplicate — vendor with this name already exists' })
        continue
      }
      try {
        await fastify.prisma.vendor.create({
          data: {
            name, contactName: rec.contactName?.trim() || null,
            phone: rec.phone?.trim() || null, email: rec.email?.trim() || null,
            city: rec.city?.trim() || null, address: rec.address?.trim() || null,
          },
        })
        result.success++
        existingNames.add(name.toLowerCase()) // prevent intra-batch duplicates
      } catch (err: any) {
        result.errors++
        result.errorDetails.push({ row: i + 3, name, reason: err.message ?? 'Insert failed' })
      }
    }
    return reply.send(result)
  })

  fastify.post('/buyers', { preHandler: [authenticate] }, async (request, reply) => {
    const bodySchema = z.object({
      records: z.array(z.object({
        name: z.string(),
        phone: z.string().optional(),
        email: z.string().optional(),
        city: z.string().optional(),
        address: z.string().optional(),
      })).max(500),
    })
    const parsed = bodySchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid request', details: parsed.error.flatten() })

    const { records } = parsed.data
    const result = { total: records.length, success: 0, warnings: 0, errors: 0, errorDetails: [] as any[] }

    const existing = await fastify.prisma.buyer.findMany({
      where: { active: true, name: { in: records.map((r) => r.name.trim()).filter(Boolean) as any, mode: 'insensitive' } as any },
      select: { name: true },
    })
    const existingNames = new Set(existing.map((b) => b.name.toLowerCase()))

    for (let i = 0; i < records.length; i++) {
      const rec = records[i]
      const name = rec.name.trim()
      if (!name) {
        result.errors++
        result.errorDetails.push({ row: i + 3, name: '(empty)', reason: 'Name is required' })
        continue
      }
      if (existingNames.has(name.toLowerCase())) {
        result.errors++
        result.errorDetails.push({ row: i + 3, name, reason: 'Duplicate — buyer with this name already exists' })
        continue
      }
      try {
        await fastify.prisma.buyer.create({
          data: { name, phone: rec.phone?.trim() || null, email: rec.email?.trim() || null, city: rec.city?.trim() || null, address: rec.address?.trim() || null },
        })
        result.success++
        existingNames.add(name.toLowerCase())
      } catch (err: any) {
        result.errors++
        result.errorDetails.push({ row: i + 3, name, reason: err.message ?? 'Insert failed' })
      }
    }
    return reply.send(result)
  })

  fastify.post('/products', { preHandler: [authenticate] }, async (request, reply) => {
    const bodySchema = z.object({
      records: z.array(z.object({
        name: z.string(),
        sku: z.string(),
        category: z.string().optional(),
        unit: z.string().optional(),
        minStock: z.coerce.number().optional(),
        openingStock: z.coerce.number().optional(),
        price: z.coerce.number().optional(),
      })).max(500),
    })
    const parsed = bodySchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid request', details: parsed.error.flatten() })

    const { records } = parsed.data
    const result = { total: records.length, success: 0, warnings: 0, errors: 0, errorDetails: [] as any[] }

    // Prefetch existing SKUs and categories
    const skus = records.map((r) => r.sku.trim().toUpperCase()).filter(Boolean)
    const [existingProducts, allCategories] = await Promise.all([
      fastify.prisma.product.findMany({ where: { sku: { in: skus } }, select: { sku: true } }),
      fastify.prisma.category.findMany({ select: { id: true, name: true } }),
    ])
    const existingSkus = new Set(existingProducts.map((p) => p.sku.toUpperCase()))
    const catMap = new Map(allCategories.map((c) => [c.name.toLowerCase(), c.id]))

    const VALID_UNITS = new Set(['pcs', 'kg', 'ltr', 'box'])

    for (let i = 0; i < records.length; i++) {
      const rec = records[i]
      const name = rec.name.trim()
      const sku = rec.sku.trim().toUpperCase()
      if (!name || !sku) {
        result.errors++
        result.errorDetails.push({ row: i + 3, name: name || '(empty)', reason: !name ? 'Product Name is required' : 'SKU is required' })
        continue
      }
      if (existingSkus.has(sku)) {
        result.errors++
        result.errorDetails.push({ row: i + 3, name, reason: `Duplicate SKU "${sku}" already exists` })
        continue
      }
      const categoryId = rec.category ? catMap.get(rec.category.trim().toLowerCase()) ?? null : null
      const unit = rec.unit && VALID_UNITS.has(rec.unit.trim().toLowerCase()) ? rec.unit.trim().toLowerCase() : 'pcs'
      try {
        const product = await fastify.prisma.product.create({
          data: {
            name, sku, unit: unit as any,
            categoryId,
            minStockLevel: rec.minStock ?? 0,
            price: rec.price ?? null,
          },
        })
        // Set opening stock if provided
        if (rec.openingStock != null && rec.openingStock > 0) {
          await fastify.prisma.$transaction([
            fastify.prisma.stockTransaction.create({
              data: {
                type: 'ADJUSTMENT', productId: product.id,
                quantity: rec.openingStock, notes: 'Opening stock from import',
                transactionDate: new Date(),
                createdBy: (request as any).user?.id,
              } as any,
            }),
            fastify.prisma.inventory.upsert({
              where: { productId: product.id },
              update: { quantityOnHand: rec.openingStock },
              create: { productId: product.id, quantityOnHand: rec.openingStock },
            }),
          ])
        }
        result.success++
        existingSkus.add(sku)
      } catch (err: any) {
        result.errors++
        result.errorDetails.push({ row: i + 3, name, reason: err.message ?? 'Insert failed' })
      }
    }
    return reply.send(result)
  })

  fastify.post('/inventory', { preHandler: [authenticate] }, async (request, reply) => {
    const bodySchema = z.object({
      records: z.array(z.object({
        sku: z.string(),
        stock: z.coerce.number().min(0),
        price: z.coerce.number().optional(),
        notes: z.string().optional(),
      })).max(500),
    })
    const parsed = bodySchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid request', details: parsed.error.flatten() })

    const { records } = parsed.data
    const result = { total: records.length, success: 0, warnings: 0, errors: 0, errorDetails: [] as any[] }

    const skus = records.map((r) => r.sku.trim().toUpperCase()).filter(Boolean)
    const products = await fastify.prisma.product.findMany({
      where: { sku: { in: skus }, active: true },
      select: { id: true, sku: true },
    })
    const skuToId = new Map(products.map((p) => [p.sku.toUpperCase(), p.id]))

    for (let i = 0; i < records.length; i++) {
      const rec = records[i]
      const sku = rec.sku.trim().toUpperCase()
      if (!sku) {
        result.errors++
        result.errorDetails.push({ row: i + 3, name: '(empty)', reason: 'SKU is required' })
        continue
      }
      const productId = skuToId.get(sku)
      if (!productId) {
        result.errors++
        result.errorDetails.push({ row: i + 3, name: sku, reason: `Product with SKU "${sku}" not found` })
        continue
      }
      try {
        await fastify.prisma.$transaction([
          fastify.prisma.stockTransaction.create({
            data: {
              type: 'ADJUSTMENT', productId,
              quantity: rec.stock, notes: rec.notes?.trim() || 'Bulk stock adjustment from import',
              transactionDate: new Date(),
              createdBy: (request as any).user?.id,
            } as any,
          }),
          fastify.prisma.inventory.upsert({
            where: { productId },
            update: {
              quantityOnHand: rec.stock,
              ...(rec.price != null && {}),
            },
            create: { productId, quantityOnHand: rec.stock },
          }),
          ...(rec.price != null ? [fastify.prisma.product.update({ where: { id: productId }, data: { price: rec.price } })] : []),
        ])
        result.success++
      } catch (err: any) {
        result.errors++
        result.errorDetails.push({ row: i + 3, name: sku, reason: err.message ?? 'Update failed' })
      }
    }
    return reply.send(result)
  })
}
