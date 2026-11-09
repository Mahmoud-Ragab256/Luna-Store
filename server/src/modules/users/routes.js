import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { requireAuth } from '../../common/middleware/auth.js';
import { validate } from '../../common/middleware/validate.js';
import { AppError } from '../../common/errors/app-error.js';
import { User, Session } from '../../database/models.js';
import { publicUser } from '../auth/auth.service.js';
export const usersRouter = Router();
usersRouter.use(requireAuth);
usersRouter.get('/me', (req, res) => res.json({ data: publicUser(req.user) }));
usersRouter.patch(
  '/me',
  validate(
    z.object({
      name: z.string().trim().min(2).max(100),
      phone: z
        .string()
        .regex(/^(?:\+20|0)1[0125]\d{8}$/)
        .optional()
        .or(z.literal('')),
    }),
  ),
  async (req, res) => {
    req.user.set(req.validated);
    await req.user.save();
    res.json({ data: publicUser(req.user) });
  },
);
usersRouter.patch(
  '/me/password',
  validate(
    z.object({ currentPassword: z.string().max(128), newPassword: z.string().min(10).max(128) }),
  ),
  async (req, res) => {
    const user = await User.findById(req.user._id).select('+passwordHash');
    if (!(await bcrypt.compare(req.validated.currentPassword, user.passwordHash)))
      throw new AppError(400, 'Current password is incorrect.');
    user.passwordHash = await bcrypt.hash(req.validated.newPassword, 12);
    await user.save();
    await Session.updateMany({ userId: user._id }, { $set: { revokedAt: new Date() } });
    res.json({ data: { message: 'Password changed. Sign in again.' } });
  },
);
const addressSchema = z.object({
  label: z.string().max(50).optional(),
  fullName: z.string().max(100).optional(),
  governorate: z.string().min(2).max(80),
  city: z.string().min(2).max(80),
  street: z.string().min(3).max(250),
  building: z.string().max(30).optional(),
  apartment: z.string().max(30).optional(),
  buildingNumber: z.string().max(30).optional(),
  apartmentNumber: z.string().max(30).optional(),
  postalCode: z.string().max(12).optional(),
  notes: z.string().max(500).optional(),
  isDefault: z.boolean().optional(),
});
usersRouter.post('/me/addresses', validate(addressSchema), async (req, res) => {
  const user = await User.findOneAndUpdate(
    { _id: req.user._id, 'addresses.9': { $exists: false } },
    { $push: { addresses: req.validated } },
    { new: true, runValidators: true },
  );
  if (!user) throw new AppError(409, 'You can save up to 10 addresses.');
  res.status(201).json({ data: publicUser(user) });
});
usersRouter.delete('/me/addresses/:id', async (req, res) => {
  if (!/^[a-f\d]{24}$/i.test(req.params.id)) throw new AppError(400, 'Invalid address.');
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $pull: { addresses: { _id: req.params.id } } },
    { new: true },
  );
  res.json({ data: publicUser(user) });
});
