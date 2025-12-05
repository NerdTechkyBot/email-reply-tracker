import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

export const getGmailClient = (accessToken: string, refreshToken: string) => {
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken
  });

  return google.gmail({ version: 'v1', auth: oauth2Client });
};

export const getAuthUrl = (redirectUrl: string, state?: string) => {
  const scopes = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/userinfo.email'
  ];

  const authUrlParams: any = {
    access_type: 'offline',
    scope: scopes,
    redirect_uri: redirectUrl,
    prompt: 'consent'
  };

  if (state) {
    authUrlParams.state = state;
  }

  return oauth2Client.generateAuthUrl(authUrlParams);
};

export const getTokensFromCode = async (code: string, redirectUrl: string) => {
  // Create a new OAuth2 client with the correct redirect URI
  const tempClient = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUrl
  );
  
  const { tokens } = await tempClient.getToken(code);
  return tokens;
};

export { oauth2Client };
