import { gmail_v1 } from 'googleapis';
import { getGmailClient } from '../config/gmail';
import { logger } from '../utils/logger';

export interface EmailMessage {
  id: string;
  threadId: string;
  from: string;
  to: string[];
  cc: string[];
  subject: string;
  snippet: string;
  bodyPlain: string;
  bodyHtml: string;
  receivedAt: Date;
  isRead: boolean;
}

export class GmailService {
  async fetchMessage(
    accessToken: string,
    refreshToken: string,
    messageId: string
  ): Promise<EmailMessage | null> {
    try {
      logger.info('Fetching message from Gmail API', { messageId });
      const gmail = getGmailClient(accessToken, refreshToken);
      
      const response = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full'
      });

      const message = response.data;
      if (!message) {
        logger.error('Gmail API returned empty message', { messageId });
        return null;
      }

      logger.info('Gmail message fetched, parsing...', { messageId });
      return this.parseMessage(message);
    } catch (error: any) {
      logger.error('Failed to fetch Gmail message', { 
        messageId, 
        error: error.message,
        code: error.code,
        status: error.response?.status,
        statusText: error.response?.statusText,
        details: error.response?.data
      });
      return null;
    }
  }

  async listMessages(
    accessToken: string,
    refreshToken: string,
    query?: string,
    maxResults: number = 100
  ): Promise<string[]> {
    try {
      const gmail = getGmailClient(accessToken, refreshToken);
      
      const response = await gmail.users.messages.list({
        userId: 'me',
        q: query || 'is:inbox is:unread',
        maxResults
      });

      return response.data.messages?.map(m => m.id!).filter(Boolean) || [];
    } catch (error) {
      logger.error('Failed to list Gmail messages', { error });
      return [];
    }
  }

  async setupWatch(
    accessToken: string,
    refreshToken: string,
    topicName: string
  ): Promise<void> {
    try {
      const gmail = getGmailClient(accessToken, refreshToken);
      
      await gmail.users.watch({
        userId: 'me',
        requestBody: {
          topicName,
          labelIds: ['INBOX']
        }
      });

      logger.info('Gmail watch setup successfully');
    } catch (error) {
      logger.error('Failed to setup Gmail watch', { error });
      throw error;
    }
  }

  private parseMessage(message: gmail_v1.Schema$Message): EmailMessage {
    const headers = message.payload?.headers || [];
    
    const getHeader = (name: string) => 
      headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

    const from = getHeader('from');
    const to = getHeader('to').split(',').map(e => e.trim()).filter(Boolean);
    const cc = getHeader('cc').split(',').map(e => e.trim()).filter(Boolean);
    const subject = getHeader('subject');
    const dateStr = getHeader('date');

    const { bodyPlain, bodyHtml } = this.extractBody(message.payload);
    
    // Check if message is read (doesn't have UNREAD label)
    const isRead = !message.labelIds?.includes('UNREAD');

    return {
      id: message.id!,
      threadId: message.threadId!,
      from,
      to,
      cc,
      subject,
      snippet: message.snippet || '',
      bodyPlain,
      bodyHtml,
      receivedAt: dateStr ? new Date(dateStr) : new Date(),
      isRead
    };
  }

  private extractBody(payload: gmail_v1.Schema$MessagePart | undefined): { bodyPlain: string; bodyHtml: string } {
    let bodyPlain = '';
    let bodyHtml = '';

    if (!payload) return { bodyPlain, bodyHtml };

    if (payload.mimeType === 'text/plain' && payload.body?.data) {
      bodyPlain = Buffer.from(payload.body.data, 'base64').toString('utf-8');
    } else if (payload.mimeType === 'text/html' && payload.body?.data) {
      bodyHtml = Buffer.from(payload.body.data, 'base64').toString('utf-8');
    } else if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          bodyPlain = Buffer.from(part.body.data, 'base64').toString('utf-8');
        } else if (part.mimeType === 'text/html' && part.body?.data) {
          bodyHtml = Buffer.from(part.body.data, 'base64').toString('utf-8');
        } else if (part.parts) {
          const nested = this.extractBody(part);
          if (!bodyPlain) bodyPlain = nested.bodyPlain;
          if (!bodyHtml) bodyHtml = nested.bodyHtml;
        }
      }
    }

    return { bodyPlain, bodyHtml };
  }
}

export const gmailService = new GmailService();
