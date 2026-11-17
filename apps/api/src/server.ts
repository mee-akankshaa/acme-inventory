import { buildApp } from './app'

const start = async () => {
  const server = buildApp()
  try {
    const port = Number(process.env.PORT ?? 4000)
    await server.listen({ port, host: '0.0.0.0' })
  } catch (err) {
    server.log.error(err)
    process.exit(1)
  }
}

start()
