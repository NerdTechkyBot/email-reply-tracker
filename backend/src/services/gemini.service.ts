import axios from 'axios';
import { logger } from '../utils/logger';

export interface ClassificationResult {
  sentiment: 'positive' | 'warm' | 'neutral' | 'negative' | 'auto_reply' | 'out_of_office' | 'spam';
  interest_level: 'high' | 'medium' | 'low' | 'none';
  summary: string;
  recommended_action: string;
  category: string;
  confidence_score?: number;
}

export class GeminiService {
  private apiKey: string;
  private apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || '';
    if (!this.apiKey) {
      logger.warn('Gemini API key not configured');
    }
  }

  async classifyEmail(emailBody: string, subject: string): Promise<ClassificationResult> {
    try {
      const prompt = this.buildPrompt(emailBody, subject);
      
      const response = await axios.post(
        `${this.apiUrl}?key=${this.apiKey}`,
        {
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.2,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          }
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.data.candidates || response.data.candidates.length === 0) {
        logger.error('Gemini returned no candidates', { response: response.data });
        throw new Error('No classification candidates returned');
      }

      const candidate = response.data.candidates[0];
      if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
        logger.error('Gemini response missing content', { candidate });
        throw new Error('Invalid Gemini response structure');
      }

      const text = candidate.content.parts[0].text;
      logger.info('Gemini raw response', { text: text.substring(0, 200) });
      
      const result = this.parseGeminiResponse(text);
      
      logger.info('Email classified successfully', { 
        sentiment: result.sentiment,
        interest: result.interest_level,
        confidence: result.confidence_score 
      });
      return result;
    } catch (error: any) {
      logger.error('Gemini classification error', { 
        error: error.message,
        response: error.response?.data 
      });
      throw new Error('Failed to classify email');
    }
  }

  private buildPrompt(emailBody: string, subject: string): string {
    return `You are an assistant that classifies replies to B2B outbound sales emails.

Given the EMAIL below, respond in valid JSON only with these fields:
- sentiment: one of ["positive", "warm", "neutral", "negative", "auto_reply", "out_of_office", "spam"]
- interest_level: one of ["high", "medium", "low", "none"]
- summary: short 1-2 sentence summary of the email
- recommended_action: short suggestion for the sales team (max 20 words)
- category: high-level tag like "demo_request", "pricing", "not_interested", "follow_up_later", "job_application", "other"
- confidence_score: a number between 0 and 1 indicating your confidence in the classification

Classification Guidelines:

**POSITIVE** - Clear interest, wants to move forward:
- Requesting demo, call, meeting, or pricing
- "Let's schedule a call", "I'm interested", "Send me more info"

**WARM** - Polite response with potential future interest:
- "Not right now, but maybe later"
- "Keep us in mind for the future"
- "We'll reach out if needed"
- "Thank you, we'll consider it"
- Polite acknowledgment with door left open

**NEUTRAL** - Simple acknowledgment without clear sentiment:
- Generic "Thank you for reaching out"
- No indication of interest or disinterest

**NEGATIVE** - Clear rejection with no future interest:
- "Not interested", "Please remove us", "Stop contacting"
- Harsh or rude rejection
- Explicit request to stop communication

**AUTO_REPLY** - Automated response:
- Auto-responders, chatbots
- Bounce-back emails (e.g., "Undelivered Mail", "Mail Delivery Failed", "Returned to Sender")
- "Thank you for contacting us" automated messages
- Email delivery failure notifications
- System-generated messages

**OUT_OF_OFFICE** - Out of office message (human-set auto-reply)

**SPAM** - Spam, unrelated, or junk email

IMPORTANT: If the email is polite and mentions "future", "later", "keep in touch", or "reach out if needed", classify as WARM, not negative!

SUBJECT: ${subject}

EMAIL TEXT:
"""
${emailBody}
"""

Respond with ONLY valid JSON, no other text.`;
  }

  private parseGeminiResponse(text: string): ClassificationResult {
    try {
      // Remove markdown code blocks if present
      let cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      // Try to extract JSON if there's extra text
      const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanText = jsonMatch[0];
      }
      
      logger.info('Attempting to parse JSON', { cleanText: cleanText.substring(0, 300) });
      const parsed = JSON.parse(cleanText);
      
      return {
        sentiment: parsed.sentiment || 'neutral',
        interest_level: parsed.interest_level || 'none',
        summary: parsed.summary || 'No summary available',
        recommended_action: parsed.recommended_action || 'Review manually',
        category: parsed.category || 'other',
        confidence_score: parsed.confidence_score || 0.5
      };
    } catch (error: any) {
      logger.error('Failed to parse Gemini response', { 
        text: text.substring(0, 500),
        error: error.message 
      });
      return {
        sentiment: 'neutral',
        interest_level: 'none',
        summary: 'Failed to analyze email - Invalid AI response format',
        recommended_action: 'Review manually',
        category: 'other',
        confidence_score: 0
      };
    }
  }
}

export const geminiService = new GeminiService();
