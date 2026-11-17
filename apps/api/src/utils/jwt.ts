import jwt from 'jsonwebtoken'

export interface AccessTokenPayload {
  userId: string
  role: 'admin' | 'staff'
}

export interface RefreshTokenPayload {
  userId: string
  tokenId: string
}

// Dev-only fallbacks; production refuses to run without real secrets.
function secret(name: 'JWT_SECRET' | 'JWT_REFRESH_SECRET', devFallback: string): string {
  const v = process.env[name]
  if (v) return v
  if (process.env.NODE_ENV === 'production') throw new Error(`${name} must be set in production`)
  return devFallback
}
const accessSecret = () => secret('JWT_SECRET', 'dev-access-secret')
const refreshSecret = () => secret('JWT_REFRESH_SECRET', 'dev-refresh-secret')
const accessExpiry = () => process.env.JWT_ACCESS_EXPIRY ?? '15m'
const refreshExpiry = () => process.env.JWT_REFRESH_EXPIRY ?? '7d'

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, accessSecret(), { expiresIn: accessExpiry() } as jwt.SignOptions)
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, refreshSecret(), { expiresIn: refreshExpiry() } as jwt.SignOptions)
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, accessSecret()) as AccessTokenPayload
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, refreshSecret()) as RefreshTokenPayload
}
