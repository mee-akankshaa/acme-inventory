import { PrismaClient } from '@prisma/client'
import { alertQueue } from '../../queues/alertQueue'

export async function processAlertCheck(
  prisma: PrismaClient,
  data: { productId: string; quantityOnHand: number; transactionType: string }
) {
  const product = await prisma.product.findUnique({
    where: { id: data.productId },
    select: { id: true, name: true, sku: true, minStockLevel: true },
  })
  if (!product) return

  const { quantityOnHand } = data
  const isOutOfStock = quantityOnHand === 0
  const isLowStock = !isOutOfStock && quantityOnHand <= product.minStockLevel

  if (!isOutOfStock && !isLowStock) return

  const alertType = isOutOfStock ? 'OUT_OF_STOCK' : 'LOW_STOCK'

  // Deduplication: skip if unread alert of same type already exists
  const existing = await prisma.alert.findFirst({
    where: { productId: data.productId, type: alertType, isRead: false },
  })
  if (existing) return

  const message = isOutOfStock
    ? `${product.name} (${product.sku}) is out of stock.`
    : `${product.name} (${product.sku}) is running low — only ${quantityOnHand} units left (threshold: ${product.minStockLevel}).`

  const alert = await prisma.alert.create({
    data: { type: alertType, productId: data.productId, message },
  })

  // Queue email if any user has email enabled
  const configs = await prisma.alertConfig.findMany({
    where: {
      emailEnabled: true,
      ...(alertType === 'OUT_OF_STOCK' ? { outOfStockEnabled: true } : {}),
    },
    select: { userId: true },
  })

  if (configs.length > 0) {
    await alertQueue.add('alert:email', {
      alertId: alert.id,
      productName: product.name,
      alertType,
      message,
    })
  }

  return alert
}
