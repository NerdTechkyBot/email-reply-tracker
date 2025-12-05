import { Router, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();

// Get alert settings
router.get('/alerts', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { data: settings, error } = await supabase
      .from('settings')
      .select('*')
      .eq('user_id', req.userId)
      .single();

    if (error && error.code !== 'PGRST116') { // Not found is ok
      throw new AppError('Failed to fetch settings', 500);
    }

    res.json(settings || {
      notify_email: '',
      enabled_sentiments: ['positive', 'warm']
    });
  } catch (error) {
    next(error);
  }
});

// Update alert settings
router.put('/alerts', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { notifyEmail, enabledSentiments } = req.body;

    const { data, error } = await supabase
      .from('settings')
      .upsert({
        user_id: req.userId,
        notify_email: notifyEmail,
        enabled_sentiments: enabledSentiments
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single();

    if (error) {
      throw new AppError('Failed to update settings', 500);
    }

    res.json(data);
  } catch (error) {
    next(error);
  }
});

export default router;
