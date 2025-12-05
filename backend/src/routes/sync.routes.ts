import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { supabase } from '../config/supabase';
import { gmailService } from '../services/gmail.service';
import { GeminiService } from '../services/gemini.service';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = Router();
const geminiService = new GeminiService();

// Sync emails for a specific mailbox
router.post('/mailbox/:mailboxId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { mailboxId } = req.params;
    const maxResults = parseInt(req.body.maxResults || '10');

    // Get mailbox details
    const { data: mailbox, error: mailboxError } = await supabase
      .from('mailboxes')
      .select('*')
      .eq('id', mailboxId)
      .eq('user_id', req.userId)
      .single();

    if (mailboxError || !mailbox) {
      throw new AppError('Mailbox not found', 404);
    }

    logger.info('Starting email sync', { mailboxId, email: mailbox.email_address });

    // Fetch recent message IDs (all inbox messages, not just unread)
    logger.info('Fetching messages from Gmail', { 
      mailbox: mailbox.email_address,
      query: 'in:inbox',
      maxResults 
    });
    
    const messageIds = await gmailService.listMessages(
      mailbox.access_token_encrypted,
      mailbox.refresh_token_encrypted,
      'in:inbox',
      maxResults
    );

    logger.info(`Found ${messageIds.length} messages to process`, { 
      messageIds: messageIds.slice(0, 3) 
    });

    let processedCount = 0;
    let classifiedCount = 0;

    for (const messageId of messageIds) {
      try {
        // Get full message details
        const parsedMessage = await gmailService.fetchMessage(
          mailbox.access_token_encrypted,
          mailbox.refresh_token_encrypted,
          messageId
        );

        if (!parsedMessage) {
          logger.error('Failed to fetch message from Gmail', { 
            messageId,
            mailbox: mailbox.email_address 
          });
          continue;
        }

        logger.info('Message fetched successfully', { 
          messageId,
          subject: parsedMessage.subject,
          from: parsedMessage.from 
        });

        // Check if message already exists
        const { data: existingMessage } = await supabase
          .from('messages')
          .select('id, body_plain, snippet, subject')
          .eq('gmail_message_id', messageId)
          .single();

        if (existingMessage) {
          // Check if message has classification
          const { data: existingClassification } = await supabase
            .from('classifications')
            .select('id')
            .eq('message_id', existingMessage.id)
            .single();

          if (existingClassification) {
            logger.info('Message already processed', { messageId });
            continue;
          }

          // Message exists but no classification - classify it now
          logger.info('Message exists but not classified, classifying now', { messageId });
          try {
            const classification = await geminiService.classifyEmail(
              existingMessage.body_plain || existingMessage.snippet,
              existingMessage.subject
            );

            await supabase
              .from('classifications')
              .insert({
                message_id: existingMessage.id,
                sentiment: classification.sentiment,
                confidence_score: classification.confidence_score,
                interest_level: classification.interest_level,
                summary: classification.summary,
                category: classification.category,
                recommended_action: classification.recommended_action
              });

            logger.info('Existing message classified successfully', { messageId });
          } catch (error) {
            logger.error('Failed to classify existing message', { messageId, error });
          }
          continue;
        }

        // Create or get thread
        let threadId;
        const { data: existingThread } = await supabase
          .from('threads')
          .select('id')
          .eq('mailbox_id', mailboxId)
          .eq('gmail_thread_id', parsedMessage.threadId)
          .single();

        if (existingThread) {
          threadId = existingThread.id;
        } else {
          const { data: newThread, error: threadError } = await supabase
            .from('threads')
            .insert({
              mailbox_id: mailboxId,
              gmail_thread_id: parsedMessage.threadId,
              subject: parsedMessage.subject,
              lead_email: parsedMessage.from,
              last_message_at: parsedMessage.receivedAt
            })
            .select()
            .single();

          if (threadError) {
            logger.error('Failed to create thread', { error: threadError });
            continue;
          }
          threadId = newThread.id;
        }

        // Insert message
        const { data: insertedMessage, error: messageError } = await supabase
          .from('messages')
          .insert({
            thread_id: threadId,
            gmail_message_id: messageId,
            direction: 'inbound',
            from_address: parsedMessage.from,
            to_addresses: parsedMessage.to,
            cc_addresses: parsedMessage.cc,
            subject: parsedMessage.subject,
            snippet: parsedMessage.snippet,
            body_plain: parsedMessage.bodyPlain,
            body_html: parsedMessage.bodyHtml,
            received_at: parsedMessage.receivedAt,
            is_read: parsedMessage.isRead
          })
          .select()
          .single();

        if (messageError) {
          logger.error('Failed to insert message into database', { 
            error: messageError,
            messageId,
            subject: parsedMessage.subject 
          });
          continue;
        }

        logger.info('Message inserted into database', { 
          messageId,
          dbId: insertedMessage.id 
        });

        processedCount++;

        // Classify with Gemini AI
        try {
          const geminiService = new GeminiService();
          const classification = await geminiService.classifyEmail(
            parsedMessage.bodyPlain || parsedMessage.snippet || '',
            parsedMessage.subject || ''
          );

          // Insert classification
          const { error: classificationError } = await supabase
            .from('classifications')
            .insert({
              message_id: insertedMessage.id,
              sentiment: classification.sentiment,
              confidence_score: classification.confidence_score,
              interest_level: classification.interest_level,
              summary: classification.summary,
              category: classification.category,
              recommended_action: classification.recommended_action,
              raw_ai_response: classification
            });

          if (classificationError) {
            logger.error('Failed to insert classification', { error: classificationError });
          } else {
            classifiedCount++;
            logger.info('Message classified', { 
              messageId, 
              sentiment: classification.sentiment 
            });
          }
        } catch (classifyError) {
          logger.error('Failed to classify message', { error: classifyError });
        }

      } catch (msgError) {
        logger.error('Failed to process message', { messageId, error: msgError });
      }
    }

    // Update last synced timestamp
    await supabase
      .from('mailboxes')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', mailboxId);

    logger.info('Sync completed', { 
      mailbox: mailbox.email_address,
      totalMessages: messageIds.length,
      processedCount,
      classifiedCount 
    });

    res.json({
      success: true,
      totalMessages: messageIds.length,
      processedCount,
      classifiedCount,
      mailbox: mailbox.email_address,
      messageIds: messageIds.slice(0, 5) // Show first 5 message IDs for debugging
    });

  } catch (error) {
    next(error);
  }
});

// Sync all mailboxes for the authenticated user
router.post('/all', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const maxResults = parseInt(req.body.maxResults || '10');

    // Get all user's mailboxes
    const { data: mailboxes, error } = await supabase
      .from('mailboxes')
      .select('*')
      .eq('user_id', req.userId)
      .eq('status', 'connected');

    if (error) {
      throw new AppError('Failed to fetch mailboxes', 500);
    }

    if (!mailboxes || mailboxes.length === 0) {
      return res.json({
        success: true,
        message: 'No mailboxes to sync',
        results: []
      });
    }

    const results = [];

    for (const mailbox of mailboxes) {
      try {
        logger.info('Syncing mailbox', { email: mailbox.email_address });

        logger.info('Calling Gmail API', { 
          email: mailbox.email_address,
          query: 'in:inbox',
          maxResults 
        });

        const messageIds = await gmailService.listMessages(
          mailbox.access_token_encrypted,
          mailbox.refresh_token_encrypted,
          'in:inbox',
          maxResults
        );

        logger.info('Gmail API response', { 
          email: mailbox.email_address,
          messageCount: messageIds.length,
          sampleIds: messageIds.slice(0, 3)
        });

        let processed = 0;
        let classified = 0;

        for (const messageId of messageIds) {
          try {
            const parsedMessage = await gmailService.fetchMessage(
              mailbox.access_token_encrypted,
              mailbox.refresh_token_encrypted,
              messageId
            );

            if (!parsedMessage) {
              logger.error('Failed to parse message', { messageId });
              continue;
            }

            logger.info('Message parsed', { 
              messageId,
              subject: parsedMessage.subject 
            });

            const { data: existingMessage } = await supabase
              .from('messages')
              .select('id, body_plain, snippet, subject')
              .eq('gmail_message_id', messageId)
              .single();

            if (existingMessage) {
              // Check if message has classification
              const { data: existingClassification } = await supabase
                .from('classifications')
                .select('id')
                .eq('message_id', existingMessage.id)
                .single();

              if (existingClassification) {
                logger.info('Message already exists, skipping', { messageId });
                continue;
              }

              // Message exists but no classification - classify it now
              logger.info('Message exists but not classified, classifying now', { messageId });
              try {
                const classification = await geminiService.classifyEmail(
                  existingMessage.body_plain || existingMessage.snippet,
                  existingMessage.subject
                );

                await supabase
                  .from('classifications')
                  .insert({
                    message_id: existingMessage.id,
                    sentiment: classification.sentiment,
                    confidence_score: classification.confidence_score,
                    interest_level: classification.interest_level,
                    summary: classification.summary,
                    category: classification.category,
                    recommended_action: classification.recommended_action
                  });

                classified++;
                logger.info('Existing message classified successfully', { messageId });
              } catch (error) {
                logger.error('Failed to classify existing message', { messageId, error });
              }
              continue;
            }

            let threadId;
            const { data: existingThread } = await supabase
              .from('threads')
              .select('id')
              .eq('mailbox_id', mailbox.id)
              .eq('gmail_thread_id', parsedMessage.threadId)
              .single();

            if (existingThread) {
              threadId = existingThread.id;
            } else {
              const { data: newThread } = await supabase
                .from('threads')
                .insert({
                  mailbox_id: mailbox.id,
                  gmail_thread_id: parsedMessage.threadId,
                  subject: parsedMessage.subject,
                  lead_email: parsedMessage.from,
                  last_message_at: parsedMessage.receivedAt
                })
                .select()
                .single();

              threadId = newThread?.id;
              logger.info('Thread created', { threadId, messageId });
            }

            if (!threadId) {
              logger.error('No thread ID, skipping message', { messageId });
              continue;
            }

            logger.info('Inserting message into database', { messageId, threadId });

            const { data: insertedMessage, error: insertError } = await supabase
              .from('messages')
              .insert({
                thread_id: threadId,
                gmail_message_id: messageId,
                direction: 'inbound',
                from_address: parsedMessage.from,
                to_addresses: parsedMessage.to,
                cc_addresses: parsedMessage.cc,
                subject: parsedMessage.subject,
                snippet: parsedMessage.snippet,
                body_plain: parsedMessage.bodyPlain,
                body_html: parsedMessage.bodyHtml,
                received_at: parsedMessage.receivedAt,
                is_read: parsedMessage.isRead
              })
              .select()
              .single();

            if (insertError || !insertedMessage) {
              logger.error('Failed to insert message', { 
                messageId,
                error: insertError 
              });
              continue;
            }

            logger.info('Message inserted successfully', { 
              messageId,
              dbId: insertedMessage.id 
            });

            processed++;

            try {
              const geminiService = new GeminiService();
              const classification = await geminiService.classifyEmail(
                parsedMessage.bodyPlain || parsedMessage.snippet || '',
                parsedMessage.subject || ''
              );

              await supabase
                .from('classifications')
                .insert({
                  message_id: insertedMessage.id,
                  sentiment: classification.sentiment,
                  confidence_score: classification.confidence_score,
                  interest_level: classification.interest_level,
                  summary: classification.summary,
                  category: classification.category,
                  recommended_action: classification.recommended_action,
                  raw_ai_response: classification
                });

              classified++;
            } catch (classifyError) {
              logger.error('Classification failed', { error: classifyError });
            }

          } catch (msgError) {
            logger.error('Message processing failed', { error: msgError });
          }
        }

        await supabase
          .from('mailboxes')
          .update({ last_synced_at: new Date().toISOString() })
          .eq('id', mailbox.id);

        results.push({
          email: mailbox.email_address,
          totalMessages: messageIds.length,
          processed,
          classified
        });

      } catch (mailboxError) {
        logger.error('Mailbox sync failed', { 
          email: mailbox.email_address, 
          error: mailboxError 
        });
        results.push({
          email: mailbox.email_address,
          error: 'Sync failed'
        });
      }
    }

    res.json({
      success: true,
      results
    });

  } catch (error) {
    next(error);
  }
});

export default router;
