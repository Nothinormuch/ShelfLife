import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { config } from '../../config/index.js';

const registerSchema = z.object({
  storeName: z.string().min(1, 'Store name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

function generateTokens(user: { id: string; storeId: string; email: string }) {
  const payload = { id: user.id, storeId: user.storeId, email: user.email };
  const accessToken = jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
  const refreshToken = jwt.sign(payload, config.jwtRefreshSecret, { expiresIn: config.jwtRefreshExpiresIn });
  return { accessToken, refreshToken };
}

export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { storeName, email, password } = registerSchema.parse(req.body);

    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      res.status(409).json({ error: 'email_already_registered', message: 'Email is already in use' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const result = await prisma.$transaction(async (tx) => {
      const store = await tx.store.create({
        data: { name: storeName },
      });

      const user = await tx.user.create({
        data: {
          storeId: store.id,
          email: email.toLowerCase(),
          passwordHash,
        },
      });

      return { store, user };
    });

    const tokens = generateTokens(result.user);

    const safeUser = {
      id: result.user.id,
      storeId: result.user.storeId,
      email: result.user.email,
      createdAt: result.user.createdAt,
    };

    res.status(201).json({
      user: safeUser,
      store: result.store,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { store: true },
    });

    if (!user) {
      res.status(401).json({ error: 'invalid_credentials', message: 'Invalid email or password' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({ error: 'invalid_credentials', message: 'Invalid email or password' });
      return;
    }

    const tokens = generateTokens(user);

    res.status(200).json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        storeId: user.storeId,
        email: user.email,
        createdAt: user.createdAt,
      },
      store: user.store,
    });
  } catch (error) {
    next(error);
  }
};

export const refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);

    let payload: any;
    try {
      payload = jwt.verify(refreshToken, config.jwtRefreshSecret);
    } catch (err: any) {
      res.status(401).json({ error: 'invalid_refresh_token', message: 'Refresh token expired or invalid' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.id },
    });

    if (!user) {
      res.status(401).json({ error: 'user_not_found', message: 'User does not exist' });
      return;
    }

    const tokens = generateTokens(user);

    res.status(200).json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  } catch (error) {
    next(error);
  }
};
