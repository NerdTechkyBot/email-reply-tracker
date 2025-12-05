import { Router, Request, Response, NextFunction } from 'express';
import { getAuthUrl, getTokensFromCode } from '../config/gmail';
import { supabase } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

// Initialize Google OAuth flow
router.get('/google', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const state = req.query.state as string;
    // Use environment variable or construct from request
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${req.protocol}://${req.get('host')}/v1/auth/google/callback`;
    const authUrl = getAuthUrl(redirectUri, state);

    res.redirect(authUrl);
  } catch (error) {
    next(error);
  }
});

router.post('/google/init', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Use environment variable or construct from request
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${req.protocol}://${req.get('host')}/v1/auth/google/callback`;
    const authUrl = getAuthUrl(redirectUri);

    res.json({ authUrl });
  } catch (error) {
    next(error);
  }
});

// Handle Google OAuth callback (GET - called by Google)
router.get('/google/callback', async (req: Request, res: Response, _next: NextFunction) => {
  try {
    const { code } = req.query;

    if (!code || typeof code !== 'string') {
      return res.redirect(`${process.env.FRONTEND_URL}/mailboxes?error=no_code`);
    }

    // Exchange code for tokens
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${req.protocol}://${req.get('host')}/v1/auth/google/callback`;
    const tokens = await getTokensFromCode(code, redirectUri);

    if (!tokens.access_token || !tokens.refresh_token) {
      return res.redirect(`${process.env.FRONTEND_URL}/mailboxes?error=token_exchange_failed`);
    }

    // Get user email from Google
    const { google } = require('googleapis');
    const oauth2 = google.oauth2({ version: 'v2', auth: google.auth.fromJSON({
      type: 'authorized_user',
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: tokens.refresh_token
    })});

    const userInfo = await oauth2.userinfo.get();
    const mailboxEmail = userInfo.data.email;
    const userName = userInfo.data.name;

    // Check if user is already logged in (adding additional mailbox)
    const existingToken = req.query.state as string;
    let userId: string | undefined;

    if (existingToken) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(existingToken, process.env.JWT_SECRET) as { userId: string };
        userId = decoded.userId;
        logger.info('Adding mailbox to existing user', { userId, mailboxEmail });
      } catch (error) {
        logger.warn('Invalid existing token, creating new user');
        userId = undefined;
      }
    }

    // If no existing user, find or create user based on primary email
    if (!userId) {
      let { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('email', mailboxEmail)
        .single();

      if (!user) {
        const { data: newUser, error: userError } = await supabase
          .from('users')
          .insert({
            email: mailboxEmail,
            name: userName
          })
          .select()
          .single();

        if (userError) {
          logger.error('Failed to create user', { error: userError });
          return res.redirect(`${process.env.FRONTEND_URL}/mailboxes?error=user_creation_failed`);
        }
        user = newUser;
      }
      userId = user!.id;
    }

    // Store mailbox in database
    const { error } = await supabase
      .from('mailboxes')
      .insert({
        user_id: userId,
        email_address: mailboxEmail,
        google_user_id: userInfo.data.id,
        status: 'connected',
        access_token_encrypted: tokens.access_token,
        refresh_token_encrypted: tokens.refresh_token,
        token_expires_at: tokens.expiry_date ? new Date(tokens.expiry_date) : null
      })
      .select()
      .single();

    if (error) {
      logger.error('Failed to store mailbox', { error });
      return res.redirect(`${process.env.FRONTEND_URL}/mailboxes?error=mailbox_storage_failed`);
    }

    // Generate JWT token
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { userId },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    // Redirect to frontend with token
    res.redirect(`${process.env.FRONTEND_URL}/mailboxes?token=${token}&success=true`);
  } catch (error: any) {
    logger.error('OAuth callback error', { 
      error: error.message,
      stack: error.stack,
      details: error
    });
    const errorMsg = error.message || 'unknown';
    res.redirect(`${process.env.FRONTEND_URL}/mailboxes?error=${encodeURIComponent(errorMsg)}`);
  }
});

// Handle Google OAuth callback (POST - for frontend)
router.post('/google/callback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, redirectUrl } = req.body;

    if (!code || !redirectUrl) {
      throw new AppError('code and redirectUrl are required', 400);
    }

    // Exchange code for tokens
    const tokens = await getTokensFromCode(code, redirectUrl);

    if (!tokens.access_token || !tokens.refresh_token) {
      throw new AppError('Failed to obtain tokens', 500);
    }

    // Get user email from Google
    const { google } = require('googleapis');
    const oauth2 = google.oauth2({ version: 'v2', auth: google.auth.fromJSON({
      type: 'authorized_user',
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: tokens.refresh_token
    })});

    const userInfo = await oauth2.userinfo.get();
    const emailAddress = userInfo.data.email;
    const userName = userInfo.data.name;

    // Find or create user
    let { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('email', emailAddress)
      .single();

    if (!user) {
      const { data: newUser, error: userError } = await supabase
        .from('users')
        .insert({
          email: emailAddress,
          name: userName
        })
        .select()
        .single();

      if (userError) {
        logger.error('Failed to create user', { error: userError });
        throw new AppError('Failed to create user', 500);
      }
      user = newUser;
    }

    // Store mailbox in database
    if (!user) {
      throw new AppError('User creation failed', 500);
    }

    const { data: mailbox, error } = await supabase
      .from('mailboxes')
      .insert({
        user_id: user.id,
        email_address: emailAddress,
        google_user_id: userInfo.data.id,
        status: 'connected',
        access_token_encrypted: tokens.access_token, // TODO: Encrypt in production
        refresh_token_encrypted: tokens.refresh_token, // TODO: Encrypt in production
        token_expires_at: tokens.expiry_date ? new Date(tokens.expiry_date) : null
      })
      .select()
      .single();

    if (error) {
      logger.error('Failed to store mailbox', { error });
      throw new AppError('Failed to connect mailbox', 500);
    }

    // Generate JWT token
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    // Redirect to frontend with token
    return res.redirect(`${process.env.FRONTEND_URL}/oauth/callback?token=${token}&email=${encodeURIComponent(mailbox.email_address)}`);
  } catch (error) {
    next(error);
  }
});

// Get current user profile
router.get('/me', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('id', req.userId)
      .single();

    if (error || !user) {
      throw new AppError('User not found', 404);
    }

    res.json(user);
  } catch (error) {
    next(error);
  }
});

export default router;
