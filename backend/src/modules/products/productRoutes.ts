import { Router } from 'express';
import { authenticateJwt } from '../../middleware/auth.js';
import {
  getProducts,
  createProduct,
  patchProduct,
  deleteProduct,
} from './productController.js';

export const productRoutes = Router();

productRoutes.use(authenticateJwt);

productRoutes.get('/', getProducts);
productRoutes.post('/', createProduct);
productRoutes.patch('/:id', patchProduct);
productRoutes.delete('/:id', deleteProduct);
