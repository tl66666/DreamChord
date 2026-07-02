import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export interface AuthRequest extends Request {
  userId?: string
}

export function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return res.status(401).json({ error: '未提供访问令牌' })
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string }
    req.userId = decoded.userId
    next()
  } catch {
    return res.status(403).json({ error: '令牌无效或已过期' })
  }
}
