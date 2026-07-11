import { Router, type Router as ExpressRouter } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma.js'
import { authenticateToken, type AuthRequest } from '../middleware/auth.js'

const router: ExpressRouter = Router()

router.post('/register', async (req, res) => {
  const { email, username, password, nickname } = req.body
  if (!email || !username || !password) {
    return res.status(400).json({ error: '邮箱、用户名和密码不能为空' })
  }

  if (password.length < 8) {
    return res.status(400).json({ error: '密码长度至少 8 位' })
  }

  const hashed = await bcrypt.hash(password, 10)

  try {
    const user = await prisma.user.create({
      data: { email, username, password: hashed, nickname: nickname || username },
    })
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '7d' })
    res.json({
      token,
      user: { id: user.id, username: user.username, email: user.email, nickname: user.nickname },
    })
  } catch {
    res.status(400).json({ error: '用户名或邮箱已存在' })
  }
})

router.post('/login', async (req, res) => {
  const { username, password } = req.body
  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' })
  }

  const user = await prisma.user.findUnique({ where: { username } })

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: '用户名或密码错误' })
  }

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '7d' })
  res.json({
    token,
    user: { id: user.id, username: user.username, email: user.email, nickname: user.nickname },
  })
})

router.get('/me', authenticateToken, async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, username: true, email: true, nickname: true },
  })
  if (!user) return res.status(404).json({ error: '用户不存在' })
  res.json(user)
})

export default router
