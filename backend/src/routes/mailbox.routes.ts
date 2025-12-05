import { Router, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();

// Get all mailboxes for the authenticated user
router.get('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { data: mailboxes, error } = await supabase
      .from('mailboxes')
      .select('id, email_address, status, last_synced_at, created_at')
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new AppError('Failed to fetch mailboxes', 500);
    }

    res.json(mailboxes || []);
  } catch (error) {
    next(error);
  }
});

// Get a specific mailbox
router.get('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const { data: mailbox, error } = await supabase
      .from('mailboxes')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.userId)
      .single();

    if (error || !mailbox) {
      throw new AppError('Mailbox not found', 404);
    }

    // Don't expose tokens
    delete mailbox.access_token_encrypted;
    delete mailbox.refresh_token_encrypted;

    res.json(mailbox);
  } catch (error) {
    next(error);
  }
});

// Delete a mailbox
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('mailboxes')
      .delete()
      .eq('id', id)
      .eq('user_id', req.userId);

    if (error) {
      throw new AppError('Failed to delete mailbox', 500);
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
