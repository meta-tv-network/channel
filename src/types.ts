export type UserRole = 'admin' | 'tv_owner' | 'collaborator';
export type ChannelStatus = 'active' | 'suspended' | 'pending';
export type SourceType = 'youtube' | 'vimeo' | 'iframe' | 'facebook' | 'twitch' | 'spotify' | 'soundcloud' | 'tiktok' | 'audio' | 'other';
export type RequestStatus = 'pending' | 'approved' | 'rejected';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  collaboratorRole?: 'editor' | 'scheduler' | 'moderator' | 'journalist' | 'speaker';
  createdAt: string;
  channelId?: string; // If collaborator or owner, points to channel
}

export interface TVChannel {
  id: string;
  userId: string;
  name: string;
  slug: string;
  logoUrl: string;
  description: string;
  status: ChannelStatus;
  monthlyFee: number; // Set by admin
  apiKey?: string; // API key for external integrations
  createdAt: string;
}

export interface Category {
  id: string;
  tvChannelId: string;
  name: string;
  slug: string;
  isSyndicated?: boolean; // If true, other channels can import / share this rubric as "Rubrica Nazionale"
  syndicatedFromChannelId?: string; // Reference to original channel
  createdAt: string;
}

export interface Content {
  id: string;
  tvChannelId: string;
  categoryId?: string;
  title: string;
  description: string;
  sourceType: SourceType;
  sourceUrl: string;
  iframeCode: string;
  durationMinutes: number;
  isPublic: boolean;
  isVertical?: boolean; // Flag for Reels / vertical short-form contents
  logoUrl?: string; // Custom thumbnail image URL for imported link
  createdAt: string;
}

export interface Schedule {
  id: string;
  tvChannelId: string;
  contentId: string;
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  startTime: string; // "HH:MM" e.g., "08:30"
  endTime: string; // "HH:MM" e.g., "10:00"
  isActive: boolean;
  createdAt: string;
}

export interface Collaborator {
  id: string;
  tvChannelId: string;
  email: string;
  role: 'editor' | 'scheduler' | 'moderator' | 'journalist' | 'speaker';
  createdAt: string;
}

export interface RegistrationRequest {
  id: string;
  email: string;
  channelName: string;
  description: string;
  status: RequestStatus;
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  tvChannelId: string;
  type: 'join' | 'leave' | 'chat' | 'embed' | 'error';
  user: string;
  message: string;
  timestamp: string;
}

export interface DiscoveryContent {
  id: string;
  title: string;
  description: string;
  sourceType: SourceType;
  sourceUrl: string;
  iframeCode: string;
  sector: string; // 'Cucina Italiana', 'Viaggi in Italia', 'Musica Italiana', 'Sport Italiani', 'Cultura Italiana', 'Tecnologia', 'Intrattenimento', 'News Italiane'
  language: string; // 'it'
  embedAllowed: boolean;
  qualityScore: number; // 0-100 score of reliability
  reliability: 'High' | 'Medium' | 'Low';
  status: 'pending_approval' | 'approved' | 'rejected';
  reason?: string;
  durationMinutes: number;
  isVertical: boolean;
  createdAt: string;
}

export interface DiscoveryConfig {
  whitelistKeywords: string[];
  blacklistKeywords: string[];
  autoApproveEnabled: boolean;
  lastRunAt?: string;
}

export interface DBState {
  users: User[];
  tvChannels: TVChannel[];
  categories: Category[];
  contents: Content[];
  schedules: Schedule[];
  collaborators: Collaborator[];
  registrationRequests: RegistrationRequest[];
  activityLogs: ActivityLog[];
  subscriptionPricing: {
    defaultMonthlyFee: number;
  };
  discoveredContents?: DiscoveryContent[];
  discoveryConfig?: DiscoveryConfig;
  isCleared?: boolean;
}
