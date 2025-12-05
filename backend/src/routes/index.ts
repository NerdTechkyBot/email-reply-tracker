import { Router } from 'express';
import authRoutes from './auth.routes';
import mailboxRoutes from './mailbox.routes';
import replyRoutes from './reply.routes';
import analyticsRoutes from './analytics.routes';
import settingsRoutes from './settings.routes';
import syncRoutes from './sync.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/mailboxes', mailboxRoutes);
router.use('/replies', replyRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/settings', settingsRoutes);
router.use('/sync', syncRoutes);

export default router;
