import nodemailer from 'nodemailer'
import { PrismaClient } from '@prisma/client'

export async function processAlertEmail(
  prisma: PrismaClient,
  data: { alertId: string; productName: string; alertType: string; message: string }
) {
  const configs = await prisma.alertConfig.findMany({
    where: { emailEnabled: true },
    include: { user: { select: { email: true, name: true } } },
  })

  if (configs.length === 0) return

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? 'smtp.example.com',
    port: Number(process.env.SMTP_PORT ?? 587),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })

  for (const config of configs) {
    await transporter.sendMail({
      from: process.env.ALERT_FROM_EMAIL ?? 'noreply@example.com',
      to: config.user.email,
      subject: `[Acme Inventory] ${data.alertType.replace('_', ' ')}: ${data.productName}`,
      text: data.message,
    })
  }

  await prisma.alert.update({ where: { id: data.alertId }, data: { isSent: true } })
}
