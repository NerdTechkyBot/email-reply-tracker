import { Router, Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();

// Debug endpoint to check database contents (no auth for debugging)
router.get('/debug', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data: messages } = await supabase
      .from('messages')
      .select('*')
      .limit(10);

    const { data: classifications } = await supabase
      .from('classifications')
      .select('*')
      .limit(10);

    const { data: threads } = await supabase
      .from('threads')
      .select('*, mailbox:mailboxes(*)')
      .limit(10);

    res.json({
      messageCount: messages?.length || 0,
      classificationCount: classifications?.length || 0,
      threadCount: threads?.length || 0,
      messages,
      classifications,
      threads
    });
  } catch (error) {
    next(error);
  }
});

// Get all classified replies with filters
router.get('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const {
      page = '1',
      pageSize = '25',
      sentiment,
      mailboxId,
      search,
      from,
      to,
      interestLevel
    } = req.query;

    const pageNum = parseInt(page as string);
    const pageSizeNum = parseInt(pageSize as string);
    const offset = (pageNum - 1) * pageSizeNum;

    let query = supabase
      .from('classifications')
      .select(`
        *,
        message:messages!inner(
          id,
          thread_id,
          from_address,
          subject,
          snippet,
          body_plain,
          body_html,
          received_at,
          is_read,
          thread:threads!inner(
            mailbox:mailboxes!inner(
              id,
              email_address,
              user_id
            )
          )
        )
      `, { count: 'exact' });

    if (sentiment) {
      query = query.eq('sentiment', sentiment);
    }

    if (interestLevel) {
      query = query.eq('interest_level', interestLevel);
    }

    if (mailboxId) {
      query = query.eq('message.thread.mailbox.id', mailboxId);
    }

    if (search) {
      query = query.or(`message.subject.ilike.%${search}%,message.from_address.ilike.%${search}%`);
    }

    if (from) {
      query = query.gte('message.received_at', from);
    }

    if (to) {
      query = query.lte('message.received_at', to);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSizeNum - 1);

    if (error) {
      throw new AppError('Failed to fetch replies', 500);
    }

    res.json({
      page: pageNum,
      pageSize: pageSizeNum,
      total: count || 0,
      data: data || []
    });
  } catch (error) {
    next(error);
  }
});

// Delete a classification
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Verify ownership before deleting
    const { data: classification, error: fetchError } = await supabase
      .from('classifications')
      .select('id, message_id')
      .eq('id', id)
      .single();

    if (fetchError || !classification) {
      throw new AppError('Classification not found', 404);
    }

    const { error } = await supabase
      .from('classifications')
      .delete()
      .eq('id', id);

    if (error) {
      throw new AppError('Failed to delete classification', 500);
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Get a specific reply with full details
router.get('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('classifications')
      .select(`
        *,
        message:messages(
          *,
          thread:threads(
            *,
            mailbox:mailboxes(
              id,
              email_address,
              user_id
            )
          )
        )
      `)
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new AppError('Reply not found', 404);
    }

    // Verify user owns this mailbox
    const mailbox = (data.message as any)?.thread?.mailbox;
    if (mailbox?.user_id !== req.userId) {
      throw new AppError('Unauthorized', 403);
    }

    res.json(data);
  } catch (error) {
    next(error);
  }
});

export default router;
