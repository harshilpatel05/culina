import { SignJWT, jwtVerify, decodeJwt } from 'jose'

interface JWTPayload {
  id: string
  staff_id: string
  name: string
  role: string
  restaurant_id: string | null
  iat?: number
  exp?: number
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production'
const JWT_EXPIRATION = '7d'

const secret = new TextEncoder().encode(JWT_SECRET)

export async function generateJWT(payload: Omit<JWTPayload, 'iat' | 'exp'>): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRATION)
    .sign(secret)
}

export async function verifyJWT(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ['HS256']
    })

    return {
      id: String(payload.id ?? ''),
      staff_id: String(payload.staff_id ?? ''),
      name: String(payload.name ?? ''),
      role: String(payload.role ?? ''),
      restaurant_id:
        payload.restaurant_id === null || payload.restaurant_id === undefined
          ? null
          : String(payload.restaurant_id),
      iat: typeof payload.iat === 'number' ? payload.iat : undefined,
      exp: typeof payload.exp === 'number' ? payload.exp : undefined
    }
  } catch (error) {
    console.error('JWT verification error:', error)
    return null
  }
}

export function decodeJWT(token: string): JWTPayload | null {
  try {
    const decoded = decodeJwt(token)

    return {
      id: String(decoded.id ?? ''),
      staff_id: String(decoded.staff_id ?? ''),
      name: String(decoded.name ?? ''),
      role: String(decoded.role ?? ''),
      restaurant_id:
        decoded.restaurant_id === null || decoded.restaurant_id === undefined
          ? null
          : String(decoded.restaurant_id),
      iat: typeof decoded.iat === 'number' ? decoded.iat : undefined,
      exp: typeof decoded.exp === 'number' ? decoded.exp : undefined
    }
  } catch (error) {
    console.error('JWT decode error:', error)
    return null
  }
}
