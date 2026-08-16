import fs from 'fs';
import path from 'path';
import os from 'os';
import { NextRequest } from 'next/server';
import {
  UserSession,
  ActivityCategory,
  ActivityLogEvent,
  ConnectionsSummary,
} from './tracker-types';

export * from './tracker-types';


function getDataDir(): string {
  const isServerless = Boolean(
    process.env.NETLIFY ||
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    (process.env.NODE_ENV === 'production' && !process.env.IS_LOCAL)
  );

  const baseDir = isServerless ? os.tmpdir() : process.cwd();
  return path.join(baseDir, '.diplomail_data');
}

function getSessionsFile(): string {
  return path.join(getDataDir(), 'sessions.json');
}

function getActivitiesFile(): string {
  return path.join(getDataDir(), 'activity_logs.json');
}

function ensureDataDir(): void {
  const dataDir = getDataDir();
  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  } catch (err) {
    console.error('Failed to create tracker directory:', err);
  }
}

function getHeaderFromRequest(req: NextRequest | Headers | null | undefined, key: string): string | null {
  if (!req) return null;
  try {
    if ('headers' in req && req.headers && typeof req.headers.get === 'function') {
      return req.headers.get(key);
    }
    if ('get' in req && typeof req.get === 'function') {
      return req.get(key);
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Extract true client IP address taking into account reverse proxies, CDN, and local addresses.
 */
export function extractClientIp(req: NextRequest | Headers | null | undefined): string {
  if (!req) return '127.0.0.1';

  const cfIp = getHeaderFromRequest(req, 'cf-connecting-ip');
  if (cfIp) return cfIp.trim();

  const realIp = getHeaderFromRequest(req, 'x-real-ip');
  if (realIp) return realIp.trim();

  const forwardedFor = getHeaderFromRequest(req, 'x-forwarded-for');
  if (forwardedFor) {
    const ips = forwardedFor.split(',').map((ip) => ip.trim());
    if (ips.length > 0 && ips[0]) {
      return ips[0];
    }
  }

  const vercelIp = getHeaderFromRequest(req, 'x-vercel-ip');
  if (vercelIp) return vercelIp.trim();

  return '127.0.0.1';
}

/**
 * Extract Geolocation details from deployment headers or recognize local / private network.
 */
export function extractGeoLocation(req: NextRequest | Headers | null | undefined, ip: string): {
  country: string;
  countryCode: string;
  city: string;
  region: string;
} {
  const getHeader = (key: string): string | null => getHeaderFromRequest(req, key);


  // Local / Private IP detection
  const isLocal =
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip === 'localhost' ||
    ip.startsWith('192.168.') ||
    ip.startsWith('10.') ||
    ip.startsWith('172.16.') ||
    ip.startsWith('172.31.') ||
    ip.startsWith('fe80:');

  if (isLocal) {
    return {
      country: 'Local Network',
      countryCode: 'LOCAL',
      city: 'Localhost',
      region: 'LAN',
    };
  }

  // Cloudflare headers
  const cfCountry = getHeader('cf-ipcountry');
  const cfCity = getHeader('cf-ipcity');
  const cfRegion = getHeader('cf-region');

  // Vercel / Netlify headers
  const vercelCountry = getHeader('x-vercel-ip-country');
  const vercelCity = getHeader('x-vercel-ip-city');
  const vercelRegion = getHeader('x-vercel-ip-country-region');

  const countryCode = (cfCountry || vercelCountry || 'UN').toUpperCase();
  const city = cfCity || vercelCity || 'Unknown City';
  const region = cfRegion || vercelRegion || 'Unknown Region';

  const countryNames: Record<string, string> = {
    US: 'United States',
    IN: 'India',
    GB: 'United Kingdom',
    CA: 'Canada',
    AU: 'Australia',
    DE: 'Germany',
    FR: 'France',
    JP: 'Japan',
    SG: 'Singapore',
    BR: 'Brazil',
    NL: 'Netherlands',
    UN: 'Unknown Country',
  };

  const country = countryNames[countryCode] || (countryCode !== 'UN' ? countryCode : 'Unknown Location');

  return {
    country,
    countryCode,
    city: decodeURIComponent(city),
    region: decodeURIComponent(region),
  };
}

/**
 * Parse browser, OS, and device type from User-Agent string.
 */
export function parseUserAgent(uaString: string): {
  browser: string;
  os: string;
  device: 'Desktop' | 'Mobile' | 'Tablet' | 'Bot' | 'Unknown';
} {
  const ua = uaString.toLowerCase();

  // 1. Detect Bots
  if (
    ua.includes('bot') ||
    ua.includes('crawler') ||
    ua.includes('spider') ||
    ua.includes('postman') ||
    ua.includes('curl') ||
    ua.includes('wget') ||
    ua.includes('headless')
  ) {
    return {
      browser: ua.includes('postman') ? 'Postman' : ua.includes('curl') ? 'cURL' : 'Automated Bot',
      os: 'Server',
      device: 'Bot',
    };
  }

  // 2. Detect OS
  let os = 'Unknown OS';
  if (ua.includes('windows nt 10.0') || ua.includes('windows nt 11.0')) os = 'Windows';
  else if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('macintosh') || ua.includes('mac os x')) os = 'macOS';
  else if (ua.includes('iphone')) os = 'iOS (iPhone)';
  else if (ua.includes('ipad')) os = 'iPadOS';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('linux')) os = 'Linux';
  else if (ua.includes('cros')) os = 'Chrome OS';

  // 3. Detect Browser
  let browser = 'Unknown Browser';
  if (ua.includes('edg/')) browser = 'Edge';
  else if (ua.includes('opr/') || ua.includes('opera/')) browser = 'Opera';
  else if (ua.includes('chrome/') && !ua.includes('edg/')) browser = 'Chrome';
  else if (ua.includes('safari/') && !ua.includes('chrome/')) browser = 'Safari';
  else if (ua.includes('firefox/')) browser = 'Firefox';

  // 4. Detect Device Type
  let device: 'Desktop' | 'Mobile' | 'Tablet' | 'Bot' | 'Unknown' = 'Desktop';
  if (ua.includes('ipad') || (ua.includes('android') && !ua.includes('mobile'))) {
    device = 'Tablet';
  } else if (ua.includes('mobile') || ua.includes('iphone') || ua.includes('android')) {
    device = 'Mobile';
  }

  return { browser, os, device };
}

/**
 * Read all recorded sessions from disk.
 */
export function getAllSessions(): UserSession[] {
  ensureDataDir();
  const file = getSessionsFile();
  if (!fs.existsSync(file)) return [];
  try {
    const raw = fs.readFileSync(file, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to read sessions file:', err);
    return [];
  }
}

/**
 * Save sessions list to disk.
 */
function saveSessions(sessions: UserSession[]): void {
  ensureDataDir();
  const file = getSessionsFile();
  try {
    // Keep max 200 recent sessions
    const capped = sessions.slice(0, 200);
    fs.writeFileSync(file, JSON.stringify(capped, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save sessions:', err);
  }
}

/**
 * Read all activity log events from disk.
 */
export function getAllActivityLogs(): ActivityLogEvent[] {
  ensureDataDir();
  const file = getActivitiesFile();
  if (!fs.existsSync(file)) return [];
  try {
    const raw = fs.readFileSync(file, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to read activity logs:', err);
    return [];
  }
}

/**
 * Save activity logs to disk.
 */
function saveActivityLogs(logs: ActivityLogEvent[]): void {
  ensureDataDir();
  const file = getActivitiesFile();
  try {
    // Keep max 500 recent events
    const capped = logs.slice(0, 500);
    fs.writeFileSync(file, JSON.stringify(capped, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save activity logs:', err);
  }
}

/**
 * Record a user session connection or heartbeat ping.
 */
export function recordSession(params: {
  sessionId: string;
  ip: string;
  userAgent: string;
  headers?: Headers | NextRequest | null;
  nickname?: string;
  userEmail?: string;
  userName?: string;
}): UserSession {
  const { sessionId, ip, userAgent, headers, nickname, userEmail, userName } = params;
  const now = new Date().toISOString();
  const sessions = getAllSessions();

  const geo = headers ? extractGeoLocation(headers, ip) : {
    country: 'Local Network',
    countryCode: 'LOCAL',
    city: 'Localhost',
    region: 'LAN',
  };
  const uaDetails = parseUserAgent(userAgent || '');

  let session = sessions.find((s) => s.sessionId === sessionId || (s.ip === ip && s.userAgent === userAgent));

  if (session) {
    session.lastActive = now;
    session.requestsCount = (session.requestsCount || 1) + 1;
    if (nickname) session.nickname = nickname;
    if (userEmail) session.userEmail = userEmail;
    if (userName) session.userName = userName;
    if (sessionId) session.sessionId = sessionId;
  } else {
    session = {
      sessionId: sessionId || `sess_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      userEmail,
      userName,
      ip: ip || '127.0.0.1',
      country: geo.country,
      countryCode: geo.countryCode,
      city: geo.city,
      region: geo.region,
      browser: uaDetails.browser,
      os: uaDetails.os,
      device: uaDetails.device,
      userAgent: userAgent || 'Unknown',
      firstSeen: now,
      lastActive: now,
      requestsCount: 1,
      nickname,
    };
    sessions.unshift(session);
  }

  saveSessions(sessions);
  return session;
}

/**
 * Log a user action or system event.
 */
export function logActivity(params: {
  sessionId?: string;
  userEmail?: string;
  userName?: string;
  ip?: string;
  country?: string;
  countryCode?: string;
  city?: string;
  category: ActivityCategory;
  action: string;
  details?: Record<string, unknown>;
  status?: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
}): ActivityLogEvent {
  const now = new Date().toISOString();
  const logs = getAllActivityLogs();

  const newEvent: ActivityLogEvent = {
    id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: now,
    sessionId: params.sessionId || 'anonymous',
    userEmail: params.userEmail,
    userName: params.userName,
    ip: params.ip || '127.0.0.1',
    country: params.country || 'Local Network',
    countryCode: params.countryCode || 'LOCAL',
    city: params.city || 'Localhost',
    category: params.category,
    action: params.action,
    details: params.details,
    status: params.status || 'INFO',
  };

  logs.unshift(newEvent);
  saveActivityLogs(logs);
  return newEvent;
}


/**
 * Calculate connection summary, active users count, and distribution statistics.
 */
export function getConnectionsSummary(): ConnectionsSummary {
  const sessions = getAllSessions();
  const logs = getAllActivityLogs();
  const nowTime = Date.now();

  // Active definition: seen in last 2 minutes (120,000 ms) = ONLINE, 2-15 mins = AWAY, >15 mins = OFFLINE
  let activeCount = 0;
  const sessionsWithStatus = sessions.map((sess) => {
    const lastActiveTime = new Date(sess.lastActive).getTime();
    const diffMs = nowTime - lastActiveTime;

    let status: 'ONLINE' | 'AWAY' | 'OFFLINE' = 'OFFLINE';
    if (diffMs <= 2 * 60 * 1000) {
      status = 'ONLINE';
      activeCount++;
    } else if (diffMs <= 15 * 60 * 1000) {
      status = 'AWAY';
    }

    return {
      ...sess,
      status,
    };
  });

  // Country breakdown
  const countryMap: Record<string, { country: string; countryCode: string; count: number }> = {};
  sessions.forEach((s) => {
    const key = s.countryCode || 'UN';
    if (!countryMap[key]) {
      countryMap[key] = { country: s.country, countryCode: s.countryCode, count: 0 };
    }
    countryMap[key].count++;
  });
  const countryDistribution = Object.values(countryMap).sort((a, b) => b.count - a.count);

  // Device breakdown
  const deviceMap: Record<string, number> = {};
  sessions.forEach((s) => {
    const key = s.device || 'Unknown';
    deviceMap[key] = (deviceMap[key] || 0) + 1;
  });
  const deviceDistribution = Object.entries(deviceMap).map(([device, count]) => ({ device, count }));

  // Browser breakdown
  const browserMap: Record<string, number> = {};
  sessions.forEach((s) => {
    const key = s.browser || 'Unknown';
    browserMap[key] = (browserMap[key] || 0) + 1;
  });
  const browserDistribution = Object.entries(browserMap).map(([browser, count]) => ({ browser, count }));

  const uniqueIps = new Set(sessions.map((s) => s.ip)).size;

  return {
    activeCount,
    totalUniqueVisitors: uniqueIps,
    totalEventsCount: logs.length,
    countriesCount: countryDistribution.length,
    countryDistribution,
    deviceDistribution,
    browserDistribution,
    sessions: sessionsWithStatus,
    recentEvents: logs.slice(0, 100),
  };
}

/**
 * Clear or reset all access and activity logs.
 */
export function clearAllLogs(): void {
  ensureDataDir();
  saveSessions([]);
  saveActivityLogs([]);
}
