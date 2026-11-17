// Larger synthetic demo dataset. Fully fictional and deterministic (seeded PRNG).
// Run after `db:seed` (needs the demo users): npm run seed:demo
import { PrismaClient, TransactionType, AlertType } from '@prisma/client'

const prisma = new PrismaClient()

// Small deterministic PRNG (mulberry32)
let state = 20240601
function rnd() {
  state |= 0; state = (state + 0x6d2b79f5) | 0
  let t = Math.imul(state ^ (state >>> 15), 1 | state)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1))
const pick = <T,>(xs: T[]) => xs[int(0, xs.length - 1)]

const CITIES = ['Springfield', 'Shelbyville', 'Rivertown', 'Lakeside', 'Hillview', 'Brookfield']
const VENDOR_NAMES = ['Orbit Parts', 'Cobalt Wholesale', 'Juniper Trading', 'Pinecrest Supply', 'Zephyr Distribution',
  'Maple Industrial', 'Quartz Components', 'Harbor Goods', 'Summit Sourcing', 'Willow Logistics']
const BUYER_NAMES = ['Globex Retail', 'Initech Services', 'Umbrella Works', 'Stark Fabrication',
  'Wayne Facilities', 'Hooli Campus Ops', 'Vandelay Imports', 'Soylent Catering']
const CONTACTS = ['Casey Demo', 'Jordan Test', 'Riley Sample', 'Taylor Mock', 'Morgan Example', 'Avery Placeholder']

const CATEGORIES = [
  { name: 'Sensors', slug: 'sensors', items: ['Proximity Sensor', 'Thermal Probe', 'Light Sensor', 'Humidity Sensor'] },
  { name: 'Cables', slug: 'cables', items: ['USB-C Cable 1m', 'Patch Cable 2m', 'Power Lead 3m', 'HDMI Cable 1.5m'] },
  { name: 'Enclosures', slug: 'enclosures', items: ['Wall Box S', 'Wall Box M', 'Rack Tray 1U', 'DIN Rail Case'] },
  { name: 'Fasteners', slug: 'fasteners', items: ['Hex Bolt M6 (100)', 'Washer Pack M6', 'Standoff Kit', 'Rivet Pack'] },
  { name: 'Packaging', slug: 'packaging', items: ['Carton Small', 'Carton Large', 'Void Fill Bag', 'Label Roll'] },
  { name: 'Safety', slug: 'safety', items: ['Safety Glasses', 'Work Gloves L', 'Ear Defenders', 'First Aid Pouch'] },
]

async function main() {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@example.com' } })

  await prisma.alert.deleteMany()
  await prisma.stockTransaction.deleteMany()
  await prisma.inventory.deleteMany()
  await prisma.product.deleteMany()
  await prisma.category.deleteMany()
  await prisma.vendor.deleteMany()
  await prisma.buyer.deleteMany()

  const vendors = []
  for (let i = 0; i < VENDOR_NAMES.length; i++) {
    vendors.push(await prisma.vendor.create({ data: {
      name: VENDOR_NAMES[i], contactName: pick(CONTACTS),
      phone: `+1 555 020 ${String(1000 + i)}`,
      email: `contact${i + 1}@vendor${i + 1}.example.com`,
      city: pick(CITIES), address: `${i + 10} Demo Lane`,
    }}))
  }

  const buyers = []
  for (let i = 0; i < BUYER_NAMES.length; i++) {
    buyers.push(await prisma.buyer.create({ data: {
      name: BUYER_NAMES[i], phone: `+1 555 030 ${String(2000 + i)}`,
      email: `buyer${i + 1}@customer${i + 1}.example.com`, city: pick(CITIES), address: `${i + 100} Sample Blvd`,
    }}))
  }

  const products: { id: string; sku: string; vendorId: string; cost: number; price: number; min: number }[] = []
  for (const cat of CATEGORIES) {
    const c = await prisma.category.create({ data: { name: cat.name, slug: cat.slug } })
    for (let j = 0; j < cat.items.length; j++) {
      const cost = int(4, 90)
      const price = Math.round(cost * (1.2 + rnd() * 0.4))
      const v = pick(vendors)
      const min = int(5, 25)
      const p = await prisma.product.create({ data: {
        name: cat.items[j], sku: `${cat.slug.slice(0, 3).toUpperCase()}-${String(j + 1).padStart(3, '0')}`,
        unit: 'pcs', price, costPrice: cost, categoryId: c.id, vendorId: v.id, minStockLevel: min,
        inventory: { create: { quantityOnHand: 0 } },
      }})
      products.push({ id: p.id, sku: p.sku, vendorId: v.id, cost, price, min })
    }
  }

  const qty: Record<string, number> = Object.fromEntries(products.map((p) => [p.id, 0]))
  const DAY = 86400000
  let n = 0

  // Stock-in: every product gets 1-3 receipts
  for (const p of products) {
    for (let k = int(1, 3); k > 0; k--) {
      const q = int(10, 60)
      qty[p.id] += q
      await prisma.stockTransaction.create({ data: {
        type: TransactionType.IN, productId: p.id, vendorId: p.vendorId, quantity: q, unitPrice: p.cost,
        serialNo: `SN-${String(++n).padStart(6, '0')}`, notes: `Demo receipt PO-${1000 + n}`,
        idempotencyKey: `demo-in-${n}`, createdBy: admin.id,
        transactionDate: new Date(Date.now() - int(10, 60) * DAY),
      }})
    }
  }

  // Stock-out: random issues, never exceeding on-hand; some products drained on purpose
  for (let i = 0; i < 70; i++) {
    const p = pick(products)
    const drain = i < 8 ? qty[p.id] : int(1, 12)
    const q = Math.min(drain, qty[p.id])
    if (q <= 0) continue
    qty[p.id] -= q
    const b = pick(buyers)
    await prisma.stockTransaction.create({ data: {
      type: TransactionType.OUT, productId: p.id, quantity: q, unitPrice: p.price,
      buyerId: b.id, buyerName: b.name, issuedTo: pick(CONTACTS),
      notes: `Demo order SO-${2000 + i}`, idempotencyKey: `demo-out-${i}`, createdBy: admin.id,
      transactionDate: new Date(Date.now() - int(0, 9) * DAY),
    }})
  }

  let alerts = 0
  for (const p of products) {
    await prisma.inventory.update({ where: { productId: p.id }, data: { quantityOnHand: qty[p.id] } })
    if (qty[p.id] <= p.min) {
      await prisma.alert.create({ data: {
        type: qty[p.id] === 0 ? AlertType.OUT_OF_STOCK : AlertType.LOW_STOCK,
        productId: p.id,
        message: qty[p.id] === 0 ? `${p.sku} is out of stock.` : `${p.sku} is low: ${qty[p.id]} left (min ${p.min}).`,
      }})
      alerts++
    }
  }

  console.log(`Demo seed: ${vendors.length} vendors, ${buyers.length} buyers, ${products.length} products, ${alerts} alerts`)
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
