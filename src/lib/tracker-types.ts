export interface UserSession {
  sessionId: string;
  userEmail?: string;
  userName?: string;
  ip: string;
  country: string;
  countryCode: string;
  city: string;
  region: string;
  browser: string;
  os: string;
  device: 'Desktop' | 'Mobile' | 'Tablet' | 'Bot' | 'Unknown';
  userAgent: string;
  firstSeen: string;
  lastActive: string;
  requestsCount: number;
  nickname?: string;
  status?: 'ONLINE' | 'AWAY' | 'OFFLINE';
}

export type ActivityCategory =
  | 'AUTH'
  | 'PAGE_VIEW'
  | 'UPLOAD'
  | 'MATCH'
  | 'SMTP_CONFIG'
  | 'EMAIL_SEND'
  | 'TRACKING_VIEW'
  | 'DOWNLOAD'
  | 'SYSTEM';

export interface ActivityLogEvent {
  id: string;
  timestamp: string;
  sessionId: string;
  userEmail?: string;
  userName?: string;
  ip: string;
  country: string;
  countryCode: string;
  city: string;
  category: ActivityCategory;
  action: string;
  details?: Record<string, unknown>;
  status: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
}

export interface ConnectionsSummary {
  activeCount: number;
  totalUniqueVisitors: number;
  totalEventsCount: number;
  countriesCount: number;
  countryDistribution: { country: string; countryCode: string; count: number }[];
  deviceDistribution: { device: string; count: number }[];
  browserDistribution: { browser: string; count: number }[];
  sessions: UserSession[];
  recentEvents: ActivityLogEvent[];
}

/**
 * Country code to Flag emoji conversion (client & server safe)
 */
export function getCountryFlag(countryCode: string): string {
  if (!countryCode || countryCode === 'XX' || countryCode === 'LOCAL' || countryCode.length !== 2) {
    return '🌐';
  }
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}
