import { Router, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();

// Get analytics overview
router.get('/overview', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Get all classifications for user's mailboxes
    const { data: classifications, error } = await supabase
      .from('classifications')
      .select(`
        *,
        message:messages!inner(
          thread:threads!inner(
            mailbox:mailboxes!inner(
              id,
              email_address,
              user_id
            )
          )
        )
      `);

    if (error) {
      throw new AppError('Failed to fetch analytics', 500);
    }

    const data = classifications || [];

    // Calculate totals by sentiment
    const totalReplies = data.length;
    const positiveCount = data.filter(c => c.sentiment === 'positive').length;
    const warmCount = data.filter(c => c.sentiment === 'warm').length;
    const negativeCount = data.filter(c => c.sentiment === 'negative').length;
    const neutralCount = data.filter(c => c.sentiment === 'neutral').length;
    const autoReplyCount = data.filter(c => c.sentiment === 'auto_reply').length;
    const outOfOfficeCount = data.filter(c => c.sentiment === 'out_of_office').length;

    // Group by mailbox
    const byMailbox: any[] = [];
    const mailboxMap = new Map();

    data.forEach((item: any) => {
      const mailboxId = item.message?.thread?.mailbox?.id;
      const emailAddress = item.message?.thread?.mailbox?.email_address;
      
      if (!mailboxId) return;

      if (!mailboxMap.has(mailboxId)) {
        mailboxMap.set(mailboxId, {
          mailbox_id: mailboxId,
          email_address: emailAddress,
          positive: 0,
          warm: 0,
          negative: 0,
          neutral: 0
        });
      }

      const mailboxData = mailboxMap.get(mailboxId);
      if (item.sentiment === 'positive') mailboxData.positive++;
      if (item.sentiment === 'warm') mailboxData.warm++;
      if (item.sentiment === 'negative') mailboxData.negative++;
      if (item.sentiment === 'neutral') mailboxData.neutral++;
    });

    mailboxMap.forEach(value => byMailbox.push(value));

    // Trend by day (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const trendByDay: any[] = [];
    const dayMap = new Map();

    data.forEach((item: any) => {
      const createdAt = new Date(item.created_at);
      if (createdAt < thirtyDaysAgo) return;

      const dateKey = createdAt.toISOString().split('T')[0];

      if (!dayMap.has(dateKey)) {
        dayMap.set(dateKey, {
          date: dateKey,
          positive: 0,
          warm: 0,
          negative: 0
        });
      }

      const dayData = dayMap.get(dateKey);
      if (item.sentiment === 'positive') dayData.positive++;
      if (item.sentiment === 'warm') dayData.warm++;
      if (item.sentiment === 'negative') dayData.negative++;
    });

    dayMap.forEach(value => trendByDay.push(value));
    trendByDay.sort((a, b) => a.date.localeCompare(b.date));

    res.json({
      totalReplies,
      positiveCount,
      warmCount,
      negativeCount,
      neutralCount,
      autoReplyCount,
      outOfOfficeCount,
      byMailbox,
      trendByDay
    });
  } catch (error) {
    next(error);
  }
});

export default router;
