// Minimal synthetic seed (also used by the test-suite). All data is fictional.
import { PrismaClient, Role, Unit } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? 'Demo@12345'

async function main() {
  const hash = await bcrypt.hash(DEMO_PASSWORD, 12)
  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: { name: 'Demo Admin', email: 'admin@example.com', passwordHash: hash, role: Role.admin },
  })
  await prisma.user.upsert({
    where: { email: 'staff@example.com' },
    update: {},
    create: { name: 'Demo Staff', email: 'staff@example.com', passwordHash: hash, role: Role.staff },
  })

  await prisma.alertConfig.deleteMany()
  await prisma.alert.deleteMany()
  await prisma.inventory.deleteMany()
  await prisma.stockTransaction.deleteMany()
  await prisma.product.deleteMany()
  await prisma.category.deleteMany()
  await prisma.vendor.deleteMany()

  const [v1, v2] = await Promise.all([
    prisma.vendor.create({ data: {
      name: 'Acme Components Ltd', contactName: 'Alex Example',
      phone: '+1 555 010 0101', email: 'sales@acme-components.example.com',
      city: 'Springfield', address: '123 Example St',
    }}),
    prisma.vendor.create({ data: {
      name: 'Nimbus Supply Co', contactName: 'Sam Sample',
      phone: '+1 555 010 0102', email: 'orders@nimbus-supply.example.com',
      city: 'Shelbyville', address: '456 Sample Rd',
    }}),
  ])

  const [lighting, apparel, pantry, tools, office] = await Promise.all([
    prisma.category.create({ data: { name: 'Lighting',  slug: 'lighting' } }),
    prisma.category.create({ data: { name: 'Apparel',   slug: 'apparel' } }),
    prisma.category.create({ data: { name: 'Pantry',    slug: 'pantry' } }),
    prisma.category.create({ data: { name: 'Tools',     slug: 'tools' } }),
    prisma.category.create({ data: { name: 'Office',    slug: 'office' } }),
  ])

  const products = [
    { name: 'LED Panel Light 12W',   sku: 'LGT-001', unit: Unit.pcs, catId: lighting.id, vendorId: v1.id, price: 12,  cost: 8,  minStock: 40, qty: 95 },
    { name: 'Smart Dimmer Switch',   sku: 'LGT-002', unit: Unit.pcs, catId: lighting.id, vendorId: v1.id, price: 94,  cost: 61, minStock: 6,  qty: 14 },
    { name: 'Canvas Tote Bag',       sku: 'APP-001', unit: Unit.pcs, catId: apparel.id,  vendorId: v2.id, price: 31,  cost: 19, minStock: 15, qty: 6 },
    { name: 'Instant Oats 2kg',      sku: 'PNT-001', unit: Unit.kg,  catId: pantry.id,   vendorId: v2.id, price: 41,  cost: 33, minStock: 60, qty: 180 },
    { name: 'Olive Oil 1L',          sku: 'PNT-002', unit: Unit.ltr, catId: pantry.id,   vendorId: v2.id, price: 56,  cost: 43, minStock: 30, qty: 55 },
    { name: 'Cable Ties 200pk',      sku: 'TLS-001', unit: Unit.box, catId: tools.id,    vendorId: v1.id, price: 15,  cost: 9,  minStock: 20, qty: 7 },
    { name: 'Torque Screwdriver Set',sku: 'TLS-002', unit: Unit.pcs, catId: tools.id,    vendorId: v1.id, price: 185,  cost: 132,minStock: 5,  qty: 11 },
    { name: 'Packing Foam Roll',     sku: 'TLS-003', unit: Unit.pcs, catId: tools.id,    vendorId: v1.id, price: 28,  cost: 19, minStock: 8,  qty: 2 },
    { name: 'Notebook A5 Ruled',     sku: 'OFF-001', unit: Unit.box, catId: office.id,   vendorId: v2.id, price: 22,  cost: 15, minStock: 12, qty: 33 },
    { name: 'Desk Organizer Mesh',   sku: 'OFF-002', unit: Unit.pcs, catId: office.id,   vendorId: v2.id, price: 39,  cost: 26, minStock: 10, qty: 21 },
  ]

  for (const p of products) {
    await prisma.product.create({ data: {
      name: p.name, sku: p.sku, unit: p.unit, price: p.price, costPrice: p.cost,
      categoryId: p.catId, vendorId: p.vendorId, minStockLevel: p.minStock,
      inventory: { create: { quantityOnHand: p.qty } },
    }})
  }

  console.log('Seed: 2 users, 2 vendors, 5 categories, 10 products')
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
