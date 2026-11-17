import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  jwtSecret: process.env.JWT_SECRET || 'shelflife_super_secret_jwt_key_2024',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'shelflife_super_secret_refresh_jwt_key_2024',
  jwtExpiresIn: (process.env.JWT_EXPIRES_IN || '15m') as any,
  jwtRefreshExpiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as any,
  mlServiceUrl: process.env.ML_SERVICE_URL || 'http://localhost:8000',
  corsOrigin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(s => s.trim()) : ['http://localhost:3000', 'http://localhost:5173'],
};
