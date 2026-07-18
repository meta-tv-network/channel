import React, { useState, useEffect, useRef } from 'react';
import { 
  TVChannel, Content, Schedule, Category, User, RegistrationRequest, ActivityLog, SourceType 
} from './types.js';
import ChannelPlayer from './components/ChannelPlayer.js';
import ScheduleGrid from './components/ScheduleGrid.js';
import EmbedWizard from './components/EmbedWizard.js';
import YTVideoPlayer from './components/YTVideoPlayer.js';
import staticRegionalChannels from './regional_channels.json';
import { 
  Tv, Shield, Users, Radio, Video, Plus, Trash2, Sliders, ExternalLink, 
  Settings, Key, Layers, LogIn, LogOut, CheckCircle, AlertTriangle, 
  Clock, DollarSign, Send, MessageSquare, Heart, RefreshCw, BarChart3, HelpCircle,
  Search, Download, Sparkles, Globe, Bookmark
} from 'lucide-react';

export default function App() {
  // Navigation / Routing State
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [activeChannelSlug, setActiveChannelSlug] = useState<string | null>(null);
  
  // App Session state
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('metatv_session');
    return saved ? JSON.parse(saved) : null;
  });
  const [authEmail, setAuthEmail] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // App Data State
  const [channels, setChannels] = useState<TVChannel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<TVChannel | null>(null);
  const [nowPlaying, setNowPlaying] = useState<{ content: Content | null; schedule: Schedule | null; fallbackUsed: boolean } | null>(null);
  const [selectedChannelSchedules, setSelectedChannelSchedules] = useState<Schedule[]>([]);
  const [selectedChannelContents, setSelectedChannelContents] = useState<Content[]>([]);
  const [selectedChannelCategories, setSelectedChannelCategories] = useState<Category[]>([]);
  const [selectedChannelCollaborators, setSelectedChannelCollaborators] = useState<any[]>([]);

  // Admin view lists
  const [adminRequests, setAdminRequests] = useState<RegistrationRequest[]>([]);
  const [adminStats, setAdminStats] = useState<any>(null);
  const [allChannelsForAdmin, setAllChannelsForAdmin] = useState<TVChannel[]>([]);
  const [activeAdminTab, setActiveAdminTab] = useState<'requests' | 'channels' | 'discovery' | 'regional'>('requests');

  // Content Discovery Engine State
  const [discoveredContents, setDiscoveredContents] = useState<any[]>([]);
  const [discoveryConfig, setDiscoveryConfig] = useState<any>({
    whitelistKeywords: [],
    blacklistKeywords: [],
    autoApproveEnabled: false
  });
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [discoverySectorFilter, setDiscoverySectorFilter] = useState('Tutti');

  // Backoffice manager state
  const [activeBackofficeTab, setActiveBackofficeTab] = useState<'details' | 'contents' | 'categories' | 'schedule' | 'collaborators' | 'embed' | 'analytics' | 'national-rubrics' | 'youtube-scan'>('contents');
  const [ownerChannel, setOwnerChannel] = useState<TVChannel | null>(null);
  const [isResettingSchedules, setIsResettingSchedules] = useState(false);
  const [scheduleSuccessMsg, setScheduleSuccessMsg] = useState<string | null>(null);

  // Form states
  const [newContentTitle, setNewContentTitle] = useState('');
  const [newContentDesc, setNewContentDesc] = useState('');
  const [newContentUrl, setNewContentUrl] = useState('');
  const [newContentSourceType, setNewContentSourceType] = useState<SourceType>('youtube');
  const [newContentCatId, setNewContentCatId] = useState('');
  const [newContentDuration, setNewContentDuration] = useState('15');
  const [newContentIsVertical, setNewContentIsVertical] = useState(false);

  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategorySyndicated, setNewCategorySyndicated] = useState(false);

  const [newCollabEmail, setNewCollabEmail] = useState('');
  const [newCollabRole, setNewCollabRole] = useState<'editor' | 'scheduler' | 'moderator' | 'journalist' | 'speaker'>('editor');

  // Registration wizard state
  const [regEmail, setRegEmail] = useState('');
  const [regChannelName, setRegChannelName] = useState('');
  const [regDesc, setRegDesc] = useState('');
  const [regSuccess, setRegSuccess] = useState(false);

  // Shared National Rubrics state
  const [nationalSyndications, setNationalSyndications] = useState<any[]>([]);
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  // Regional digital channels state
  const [regionalChannels, setRegionalChannels] = useState<any[]>(staticRegionalChannels || []);
  const [activeRegionalChannel, setActiveRegionalChannel] = useState<any>(null);
  const [regionalSearch, setRegionalSearch] = useState('');
  const [regionalLimit, setRegionalLimit] = useState(24);
  const regionalPlayerRef = useRef<HTMLDivElement | null>(null);

  // Regional admin editor states
  const [editingRegionalChannel, setEditingRegionalChannel] = useState<any | null>(null);
  const [isAddingRegionalChannel, setIsAddingRegionalChannel] = useState(false);
  const [regionalFormName, setRegionalFormName] = useState('');
  const [regionalFormStreamUrl, setRegionalFormStreamUrl] = useState('');
  const [regionalFormLogoUrl, setRegionalFormLogoUrl] = useState('');
  const [regionalFormLcn, setRegionalFormLcn] = useState('');
  const [regionalAdminSearch, setRegionalAdminSearch] = useState('');
  const [regionalAdminLimit, setRegionalAdminLimit] = useState(20);
  const [regionalAdminError, setRegionalAdminError] = useState<string | null>(null);
  const [regionalAdminSuccess, setRegionalAdminSuccess] = useState<string | null>(null);
  const [regionalDeleteConfirmId, setRegionalDeleteConfirmId] = useState<string | null>(null);

  // Real-time Chat state
  const [chatMessages, setChatMessages] = useState<{ id: string; user: string; message: string; timestamp: string }[]>([]);
  const [currentChatMessage, setCurrentChatMessage] = useState('');
  const [likesCount, setLikesCount] = useState(148);
  const [floatingHearts, setFloatingHearts] = useState<{ id: number; left: number }[]>([]);
  const [realtimeLogs, setRealtimeLogs] = useState<ActivityLog[]>([]);

  // State for iframe-safe database clearing
  const [clearStep, setClearStep] = useState(0); // 0 = default, 1 = confirm
  const [clearStatus, setClearStatus] = useState<string | null>(null);

  // States for YouTube automatic scan and manual search import
  const [ytSearchQuery, setYtSearchQuery] = useState('');
  const [ytSearchResults, setYtSearchResults] = useState<any[]>([]);
  const [ytSearchLoading, setYtSearchLoading] = useState(false);
  const [ytScanLoading, setYtScanLoading] = useState(false);
  const [ytScanMessage, setYtScanMessage] = useState<string | null>(null);

  // Live YouTube Scan via Gemini and oEmbed validation
  const [liveScanTopic, setLiveScanTopic] = useState('');
  const [liveScanLoading, setLiveScanLoading] = useState(false);
  const [liveScanResults, setLiveScanResults] = useState<any[]>([]);
  const [liveScanMessage, setLiveScanMessage] = useState<string | null>(null);
  const [liveScanError, setLiveScanError] = useState<string | null>(null);

  // Admin Custom Topic Scanner
  const [adminScanTopic, setAdminScanTopic] = useState('');

  // Web Site AI Link Scraper states
  const [scraperUrl, setScraperUrl] = useState('');
  const [scraperRubric, setScraperRubric] = useState('');
  const [scraperLoading, setScraperLoading] = useState(false);
  const [scraperResults, setScraperResults] = useState<any[]>([]);
  const [scraperError, setScraperError] = useState<string | null>(null);
  const [scraperSuccessMessage, setScraperSuccessMessage] = useState<string | null>(null);
  const [selectedScrapeItems, setSelectedScrapeItems] = useState<Record<string, boolean>>({});
  const [scrapeImportChannelId, setScrapeImportChannelId] = useState('system'); // 'system' means national rubrics, or channel ID
  const [scrapeImportLoading, setScrapeImportLoading] = useState(false);
  const [activeScraperTab, setActiveScraperTab] = useState<'youtube' | 'scraper'>('scraper');

  // Auto pollers and listeners
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Fetch standard channels list initially
  useEffect(() => {
    fetchChannels();
    fetchNationalSyndications();
    fetchRegionalChannels();
  }, []);

  // Detect and resolve dynamic routes
  useEffect(() => {
    const segments = currentPath.split('/');
    if (segments[1] === 'tv' && segments[2]) {
      setActiveChannelSlug(segments[2]);
      loadChannelDetailsBySlug(segments[2]);
    } else if (segments[1] === 'embed' && segments[2]) {
      setActiveChannelSlug(segments[2]);
      loadChannelDetailsBySlug(segments[2]);
    } else {
      setActiveChannelSlug(null);
    }
  }, [currentPath]);

  // Load backoffice details if user is tv_owner or collaborator
  useEffect(() => {
    if (user && (user.role === 'tv_owner' || user.role === 'collaborator')) {
      fetchOwnerChannel();
    } else if (user && user.role === 'admin') {
      fetchAdminStats();
      fetchAdminRequests();
      fetchAllChannelsForAdmin();
      fetchDiscoveryData();
    }
  }, [user]);

  // Real-time poller for "Now Playing" and activity logs when watching a channel
  useEffect(() => {
    if (selectedChannel) {
      if (!isPreviewMode) {
        fetchNowPlaying(selectedChannel.slug);
      }
      fetchRealtimeActivity(selectedChannel.id);

      // Poll now-playing every 30 seconds for live synchronization
      const timer = setInterval(() => {
        if (!isPreviewMode) {
          fetchNowPlaying(selectedChannel.slug);
        }
        fetchRealtimeActivity(selectedChannel.id);
      }, 30000);

      // Add default dummy chat messages
      setChatMessages([
        { id: '1', user: 'Matteo_Cook', message: 'Benvenuti sul canale! Trasmissione ottima!', timestamp: '09:01' },
        { id: '2', user: 'Sara_Music', message: 'Questa programmazione è geniale.', timestamp: '09:05' },
        { id: '3', user: 'DevSpace', message: 'Adoro il mobile vertical player sul mio telefono!', timestamp: '09:12' }
      ]);

      return () => clearInterval(timer);
    }
  }, [selectedChannel, isPreviewMode]);

  // Navigation pushState helper
  const navigateTo = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  // --- API CALLS ---

  const fetchChannels = async () => {
    try {
      const res = await fetch('/api/channels');
      const data = await res.json();
      setChannels(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchNationalSyndications = async () => {
    try {
      const res = await fetch('/api/national-syndication');
      const data = await res.json();
      setNationalSyndications(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchRegionalChannels = async () => {
    try {
      const res = await fetch('/api/regional-channels');
      const data = await res.json();
      setRegionalChannels(data);
    } catch (e) {
      console.error('Errore caricamento canali regionali:', e);
    }
  };

  const handleResetToNational24h = async () => {
    if (!ownerChannel) return;
    setIsResettingSchedules(true);
    setScheduleSuccessMsg(null);
    try {
      const res = await fetch(`/api/channels/${ownerChannel.id}/schedules/reset-24h`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      if (res.ok) {
        fetchBackofficeDetails(ownerChannel.id);
        fetchNationalSyndications();
        setScheduleSuccessMsg('Palinsesto Nazionale 24h attivato con successo! Le categorie, i contenuti nazionali e l\'orario 24 ore sono stati configurati e sono ora attivi.');
      } else {
        alert('Errore durante l\'attivazione del palinsesto automatico.');
      }
    } catch (e) {
      console.error(e);
      alert('Errore di connessione durante l\'attivazione del palinsesto.');
    } finally {
      setIsResettingSchedules(false);
    }
  };

  const loadChannelDetailsBySlug = async (slug: string) => {
    try {
      const res = await fetch(`/api/channels/${slug}`);
      if (res.status === 200) {
        const channelData = await res.json();
        setSelectedChannel(channelData);
        setIsPreviewMode(false);
        // Fetch contents, schedules, categories
        fetchChannelSchedules(channelData.id);
        fetchChannelContents(channelData.id);
        fetchChannelCategories(channelData.id);
      } else {
        setSelectedChannel(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchNowPlaying = async (slug: string) => {
    try {
      const res = await fetch(`/api/channels/${slug}/now-playing`);
      if (res.status === 200) {
        const data = await res.json();
        setNowPlaying({
          content: data.content,
          schedule: data.schedule,
          fallbackUsed: data.fallbackUsed
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchChannelSchedules = async (channelId: string) => {
    try {
      const res = await fetch(`/api/channels/${channelId}/schedules`);
      const data = await res.json();
      setSelectedChannelSchedules(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchChannelContents = async (channelId: string) => {
    try {
      const res = await fetch(`/api/channels/${channelId}/contents`);
      const data = await res.json();
      setSelectedChannelContents(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchChannelCategories = async (channelId: string) => {
    try {
      const res = await fetch(`/api/channels/${channelId}/categories`);
      const data = await res.json();
      setSelectedChannelCategories(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchRealtimeActivity = async (channelId: string) => {
    try {
      const res = await fetch(`/api/realtime/activity/${channelId}`);
      const data = await res.json();
      setRealtimeLogs(data);
    } catch (e) {
      console.error(e);
    }
  };

  // --- BACKOFFICE API CALLS ---

  const fetchOwnerChannel = async () => {
    try {
      const res = await fetch('/api/channels');
      const data: TVChannel[] = await res.json();
      
      // If user is collaborator, find appropriate channel
      if (user?.role === 'collaborator' && user.channelId) {
        const chan = data.find(c => c.id === user.channelId);
        if (chan) {
          setOwnerChannel(chan);
          fetchBackofficeDetails(chan.id);
        }
      } else if (user && user.role === 'tv_owner') {
        const chan = data.find(c => c.userId === user.id);
        if (chan) {
          setOwnerChannel(chan);
          fetchBackofficeDetails(chan.id);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchBackofficeDetails = (channelId: string) => {
    fetchChannelContents(channelId);
    fetchChannelCategories(channelId);
    fetchChannelSchedules(channelId);
    fetchCollaborators(channelId);
  };

  const fetchCollaborators = async (channelId: string) => {
    try {
      const res = await fetch(`/api/channels/${channelId}/collaborators`);
      const data = await res.json();
      setSelectedChannelCollaborators(data);
    } catch (e) {
      console.error(e);
    }
  };

  // --- ADMIN ACTIONS ---

  const fetchAdminStats = async () => {
    try {
      const res = await fetch('/api/admin/system-stats');
      const data = await res.json();
      setAdminStats(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAdminRequests = async () => {
    try {
      const res = await fetch('/api/admin/requests');
      const data = await res.json();
      setAdminRequests(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAllChannelsForAdmin = async () => {
    try {
      const res = await fetch('/api/channels?all=true');
      const data = await res.json();
      setAllChannelsForAdmin(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleApproveRequest = async (id: string, action: 'approve' | 'reject') => {
    try {
      const res = await fetch(`/api/admin/requests/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      if (res.status === 200) {
        fetchAdminRequests();
        fetchAdminStats();
        fetchAllChannelsForAdmin();
        fetchChannels();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateChannelStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/admin/channels/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.status === 200) {
        fetchAllChannelsForAdmin();
        fetchChannels();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateChannelFee = async (id: string, fee: number) => {
    try {
      const res = await fetch(`/api/admin/channels/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthlyFee: fee })
      });
      if (res.status === 200) {
        fetchAllChannelsForAdmin();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateDefaultPricing = async (fee: number) => {
    try {
      const res = await fetch('/api/admin/subscription-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultMonthlyFee: fee })
      });
      if (res.status === 200) {
        fetchAdminStats();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // --- REGIONAL CHANNELS CRUD ACTIONS (ADMIN) ---

  const handleOpenAddRegionalChannel = () => {
    setEditingRegionalChannel(null);
    setIsAddingRegionalChannel(true);
    setRegionalFormName('');
    setRegionalFormStreamUrl('');
    setRegionalFormLogoUrl('');
    setRegionalFormLcn('');
    setRegionalAdminError(null);
    setRegionalAdminSuccess(null);
  };

  const handleOpenEditRegionalChannel = (ch: any) => {
    setEditingRegionalChannel(ch);
    setIsAddingRegionalChannel(false);
    setRegionalFormName(ch.name || '');
    setRegionalFormStreamUrl(ch.streamUrl || '');
    setRegionalFormLogoUrl(ch.logoUrl || '');
    setRegionalFormLcn(ch.lcn !== null && ch.lcn !== undefined ? String(ch.lcn) : '');
    setRegionalAdminError(null);
    setRegionalAdminSuccess(null);
  };

  const handleSaveRegionalChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegionalAdminError(null);
    setRegionalAdminSuccess(null);

    if (!regionalFormName.trim() || !regionalFormStreamUrl.trim()) {
      setRegionalAdminError('Nome e URL di streaming sono obbligatori.');
      return;
    }

    try {
      const isEdit = !!editingRegionalChannel;
      const url = isEdit 
        ? `/api/admin/regional-channels/${editingRegionalChannel.id}` 
        : '/api/admin/regional-channels';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: regionalFormName.trim(),
          streamUrl: regionalFormStreamUrl.trim(),
          logoUrl: regionalFormLogoUrl.trim() || undefined,
          lcn: regionalFormLcn.trim() ? parseInt(regionalFormLcn.trim(), 10) : null
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setRegionalAdminError(data.error || 'Errore durante il salvataggio.');
        return;
      }

      setRegionalAdminSuccess(isEdit ? 'Canale regionale aggiornato con successo!' : 'Nuovo canale regionale aggiunto con successo!');
      
      // Refresh list
      fetchRegionalChannels();

      // Reset form / state
      setIsAddingRegionalChannel(false);
      setEditingRegionalChannel(null);
    } catch (err) {
      console.error(err);
      setRegionalAdminError('Errore di connessione al server.');
    }
  };

  const handleDeleteRegionalChannel = async (id: string) => {
    setRegionalAdminError(null);
    setRegionalAdminSuccess(null);

    try {
      const res = await fetch(`/api/admin/regional-channels/${id}`, {
        method: 'DELETE'
      });

      if (!res.ok) {
        const data = await res.json();
        setRegionalAdminError(data.error || 'Errore durante l\'eliminazione.');
        return;
      }

      setRegionalAdminSuccess('Canale regionale eliminato con successo!');
      setRegionalDeleteConfirmId(null);
      fetchRegionalChannels();
    } catch (err) {
      console.error(err);
      setRegionalAdminError('Errore di connessione al server.');
    }
  };

  // --- AUTHENTICATION ACTIONS ---

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail) return;

    setAuthLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail })
      });
      if (res.status === 200) {
        const data = await res.json();
        setUser(data.user);
        localStorage.setItem('metatv_session', JSON.stringify(data.user));
        
        // Redirect appropriately
        if (data.user.role === 'admin') {
          navigateTo('/');
        } else {
          navigateTo('/backoffice');
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setOwnerChannel(null);
    localStorage.removeItem('metatv_session');
    navigateTo('/');
  };

  const handleClearDB = async () => {
    if (clearStep === 0) {
      setClearStep(1);
      // Auto-reset back to normal if not clicked again within 6 seconds
      setTimeout(() => {
        setClearStep(0);
      }, 6000);
      return;
    }

    setClearStep(0);
    setClearStatus('Svuotamento in corso...');

    try {
      const res = await fetch('/api/admin/clear-db', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      if (res.ok) {
        const data = await res.json();
        setClearStatus(data.message || 'Contenuti svuotati con successo!');
        
        // Clear message after 5 seconds
        setTimeout(() => {
          setClearStatus(null);
        }, 5000);

        fetchChannels();
        fetchNationalSyndications();
        if (user && user.role === 'admin') {
          fetchAdminStats();
          fetchAdminRequests();
          fetchAllChannelsForAdmin();
          fetchDiscoveryData();
        }
        if (ownerChannel) {
          fetchBackofficeDetails(ownerChannel.id);
        }
        setSelectedChannel(null);
        setNowPlaying(null);
        setSelectedChannelContents([]);
        setSelectedChannelSchedules([]);
        navigateTo('/');
      } else {
        setClearStatus('Errore durante lo svuotamento dei contenuti.');
        setTimeout(() => setClearStatus(null), 5000);
      }
    } catch (e) {
      console.error(e);
      setClearStatus('Errore di connessione durante lo svuotamento.');
      setTimeout(() => setClearStatus(null), 5000);
    }
  };

  // Register channel wizard
  const handleRegisterChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regEmail || !regChannelName) return;

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: regEmail,
          channelName: regChannelName,
          description: regDesc
        })
      });
      if (res.status === 200) {
        setRegSuccess(true);
        // Clear wizard fields
        setRegEmail('');
        setRegChannelName('');
        setRegDesc('');
      }
    } catch (e) {
      console.error(e);
    }
  };

  // --- CONTENT CRUD ---
  const [contentError, setContentError] = useState<string | null>(null);

  const handleCreateContent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerChannel || !newContentTitle || !newContentUrl) return;
    setContentError(null);

    // Strict URL embeddability verification (YouTube, Vimeo, Facebook, or custom iframe/video tag)
    const lowerUrl = newContentUrl.toLowerCase();
    const isIframeOrVideo = lowerUrl.includes('<iframe') || lowerUrl.includes('<video');
    const isEmbeddable = isIframeOrVideo ||
                         lowerUrl.includes('youtu.be/') ||
                         lowerUrl.includes('youtube.com/') ||
                         lowerUrl.includes('vimeo.com/') ||
                         lowerUrl.includes('facebook.com/') ||
                         lowerUrl.includes('fb.watch/') ||
                         lowerUrl.startsWith('http://') ||
                         lowerUrl.startsWith('https://');

    if (!isEmbeddable) {
      setContentError("L'URL o il codice fornito non è valido. Inserisci un link web valido (http/https) o un codice embed/iframe personalizzato (es. <iframe ...>).");
      return;
    }

    try {
      const res = await fetch(`/api/channels/${ownerChannel.id}/contents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newContentTitle,
          description: newContentDesc,
          sourceType: newContentSourceType,
          sourceUrl: newContentUrl,
          categoryId: newContentCatId || null,
          durationMinutes: Number(newContentDuration),
          isVertical: newContentIsVertical
        })
      });

      if (res.status === 200) {
        // Refresh contents
        fetchChannelContents(ownerChannel.id);
        // Clear fields
        setNewContentTitle('');
        setNewContentDesc('');
        setNewContentUrl('');
        setNewContentCatId('');
        setNewContentDuration('15');
        setNewContentIsVertical(false);
        setContentError(null);
      } else {
        const errData = await res.json();
        setContentError(errData.error || "Errore durante la creazione del contenuto.");
      }
    } catch (e) {
      console.error(e);
      setContentError("Errore di rete durante la creazione del contenuto.");
    }
  };

  const handlePreviewSchedule = async (sched: Schedule) => {
    let video = selectedChannelContents.find(c => c.id === sched.contentId);
    
    if (!video && nationalSyndications) {
      video = nationalSyndications.find(n => n.id === sched.contentId);
    }

    if (!video) {
      try {
        const res = await fetch(`/api/contents/${sched.contentId}`);
        if (res.ok) {
          video = await res.json();
        }
      } catch (e) {
        console.error("Errore nel recupero del contenuto via API:", e);
      }
    }

    if (video) {
      setNowPlaying({
        content: video,
        schedule: sched,
        fallbackUsed: false
      });
      setIsPreviewMode(true);
      
      // Smoothly scroll to the player section so the user sees it immediately
      setTimeout(() => {
        const playerEl = document.getElementById('channel-player-section');
        if (playerEl) {
          playerEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    } else {
      alert("Impossibile caricare il video nel player. Verifica se è presente.");
    }
  };

  const handleDeleteContent = async (contentId: string) => {
    if (!ownerChannel) return;
    try {
      await fetch(`/api/channels/${ownerChannel.id}/contents/${contentId}`, {
        method: 'DELETE'
      });
      fetchChannelContents(ownerChannel.id);
      fetchChannelSchedules(ownerChannel.id); // Sched was cascaded on backend
    } catch (e) {
      console.error(e);
    }
  };

  // --- CATEGORIES CRUD ---

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerChannel || !newCategoryName) return;

    try {
      const res = await fetch(`/api/channels/${ownerChannel.id}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCategoryName,
          isSyndicated: newCategorySyndicated
        })
      });

      if (res.status === 200) {
        fetchChannelCategories(ownerChannel.id);
        setNewCategoryName('');
        setNewCategorySyndicated(false);
        fetchNationalSyndications(); // Refresh global list
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteCategory = async (catId: string) => {
    if (!ownerChannel) return;
    try {
      await fetch(`/api/channels/${ownerChannel.id}/categories/${catId}`, {
        method: 'DELETE'
      });
      fetchChannelCategories(ownerChannel.id);
      fetchNationalSyndications(); // Refresh global list
    } catch (e) {
      console.error(e);
    }
  };

  // --- SCHEDULE SLOT MANAGERS ---

  const handleAddSchedule = async (data: { contentId: string; dayOfWeek: number; startTime: string; endTime: string }) => {
    if (!ownerChannel) return;
    try {
      const res = await fetch(`/api/channels/${ownerChannel.id}/schedules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (res.status === 200) {
        fetchChannelSchedules(ownerChannel.id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    if (!ownerChannel) return;
    try {
      await fetch(`/api/channels/${ownerChannel.id}/schedules/${scheduleId}`, {
        method: 'DELETE'
      });
      fetchChannelSchedules(ownerChannel.id);
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateSchedule = async (scheduleId: string, data: { contentId?: string; dayOfWeek?: number; startTime?: string; endTime?: string; isActive?: boolean }) => {
    if (!ownerChannel) return;
    try {
      const res = await fetch(`/api/channels/${ownerChannel.id}/schedules/${scheduleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        fetchChannelSchedules(ownerChannel.id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // --- COLLABORATORS ---

  const handleCreateCollaborator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerChannel || !newCollabEmail) return;

    try {
      const res = await fetch(`/api/channels/${ownerChannel.id}/collaborators`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newCollabEmail,
          role: newCollabRole
        })
      });

      if (res.status === 200) {
        fetchCollaborators(ownerChannel.id);
        setNewCollabEmail('');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteCollaborator = async (collabId: string) => {
    if (!ownerChannel) return;
    try {
      await fetch(`/api/channels/${ownerChannel.id}/collaborators/${collabId}`, {
        method: 'DELETE'
      });
      fetchCollaborators(ownerChannel.id);
    } catch (e) {
      console.error(e);
    }
  };

  // --- CHANNEL API KEY ROTATE ---

  const handleGenerateApiKey = async () => {
    if (!ownerChannel) return;
    try {
      const res = await fetch(`/api/channels/${ownerChannel.id}/apikey`, { method: 'POST' });
      const data = await res.json();
      setOwnerChannel({
        ...ownerChannel,
        apiKey: data.apiKey
      });
    } catch (e) {
      console.error(e);
    }
  };

  // --- IMPORT NATIONAL SYNDICATED RUBRIC ---

  const handleImportNationalRubric = async (syndicatedCategoryId: string) => {
    if (!ownerChannel) return;
    try {
      const res = await fetch('/api/national-syndication/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetChannelId: ownerChannel.id,
          syndicatedCategoryId
        })
      });
      if (res.status === 200) {
        fetchBackofficeDetails(ownerChannel.id);
        alert('Rubrica Nazionale importata con successo nel tuo canale!');
      }
    } catch (e) {
      console.error(e);
    }
  };

  // --- CONTENT DISCOVERY ENGINE CLIENT ---

  const fetchDiscoveryData = async () => {
    try {
      const res = await fetch('/api/admin/discovery');
      const data = await res.json();
      setDiscoveredContents(data.contents || []);
      setDiscoveryConfig(data.config || { whitelistKeywords: [], blacklistKeywords: [], autoApproveEnabled: false });
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateDiscoveryConfig = async (updatedConfig: any) => {
    try {
      const res = await fetch('/api/admin/discovery/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedConfig)
      });
      const data = await res.json();
      if (data.success) {
        setDiscoveryConfig(data.config);
        alert('Configurazione di Auto-Rilevamento aggiornata con successo!');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleTriggerDiscoveryScan = async () => {
    setDiscoveryLoading(true);
    try {
      const res = await fetch('/api/admin/discovery/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: adminScanTopic })
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        setAdminScanTopic('');
        fetchDiscoveryData();
        fetchNationalSyndications(); // Refresh syndicated categories list
      } else {
        alert(data.error || 'Errore durante la scansione.');
      }
    } catch (e) {
      console.error(e);
      alert('Errore di connessione durante la scansione.');
    } finally {
      setDiscoveryLoading(false);
    }
  };

  const handleScrapeSite = async () => {
    if (!scraperUrl.trim()) {
      setScraperError("Inserisci un URL valido del sito web da scansionare.");
      return;
    }
    setScraperLoading(true);
    setScraperError(null);
    setScraperSuccessMessage(null);
    setScraperResults([]);
    try {
      const res = await fetch('/api/admin/scraper/scrape-site', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: scraperUrl, rubric: scraperRubric })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setScraperResults(data.results || []);
        setScraperSuccessMessage(data.message);
        // Pre-select all results by default
        const initialSelected: Record<string, boolean> = {};
        data.results.forEach((item: any) => {
          initialSelected[item.id] = true;
        });
        setSelectedScrapeItems(initialSelected);
      } else {
        setScraperError(data.error || "Impossibile completare l'analisi del sito.");
      }
    } catch (err: any) {
      console.error(err);
      setScraperError("Errore di rete o server non raggiungibile.");
    } finally {
      setScraperLoading(false);
    }
  };

  const handleImportScrapedItems = async () => {
    const itemsToImport = scraperResults.filter(item => selectedScrapeItems[item.id]);
    if (itemsToImport.length === 0) {
      alert("Seleziona almeno un contenuto da importare.");
      return;
    }

    setScrapeImportLoading(true);
    try {
      const res = await fetch('/api/admin/scraper/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: itemsToImport,
          channelId: scrapeImportChannelId
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(data.message);
        setScraperResults([]);
        setScraperUrl('');
        setScraperRubric('');
        fetchChannels();
        fetchNationalSyndications();
        fetchDiscoveryData();
        if (ownerChannel) {
          fetchChannelContents(ownerChannel.id);
        }
      } else {
        alert(data.error || "Errore durante l'importazione dei contenuti.");
      }
    } catch (err) {
      console.error(err);
      alert("Errore di connessione durante l'importazione.");
    } finally {
      setScrapeImportLoading(false);
    }
  };

  // --- YOUTUBE BACKOFFICE DISCOVERY ACTIONS ---
  
  const handleYtSearch = async (queryStr: string = ytSearchQuery) => {
    if (!ownerChannel) return;
    setYtSearchLoading(true);
    try {
      const res = await fetch(`/api/channels/${ownerChannel.id}/youtube-search?q=${encodeURIComponent(queryStr)}`);
      if (res.ok) {
        const data = await res.json();
        setYtSearchResults(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setYtSearchLoading(false);
    }
  };

  const handleYtScanAuto = async () => {
    if (!ownerChannel) return;
    setYtScanLoading(true);
    setYtScanMessage('Inizializzazione scansione automatica YouTube...');
    try {
      const res = await fetch(`/api/channels/${ownerChannel.id}/auto-scan`, {
        method: 'POST'
      });
      const data = await res.json();
      if (res.ok) {
        setYtScanMessage(data.message || 'Scansione completata con successo!');
        // Refresh channel state
        fetchBackofficeDetails(ownerChannel.id);
        fetchChannels();
      } else {
        setYtScanMessage(data.error || 'Errore durante la scansione.');
      }
    } catch (e) {
      console.error(e);
      setYtScanMessage('Errore di connessione durante la scansione.');
    } finally {
      setYtScanLoading(false);
      setTimeout(() => setYtScanMessage(null), 8000);
    }
  };

  const handleTriggerLiveScan = async () => {
    if (!liveScanTopic.trim()) {
      setLiveScanError("Inserisci un argomento o parola chiave da scansionare.");
      return;
    }
    setLiveScanLoading(true);
    setLiveScanError(null);
    setLiveScanMessage("Avvio della scansione live di YouTube con Gemini AI...");
    setLiveScanResults([]);
    try {
      const res = await fetch('/api/admin/discovery/live-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: liveScanTopic,
          channelId: ownerChannel?.id || 'system'
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setLiveScanResults(data.results || []);
        setLiveScanMessage(data.message);
        // Refresh channel state
        if (ownerChannel) {
          fetchBackofficeDetails(ownerChannel.id);
        }
        fetchChannels();
        fetchNationalSyndications();
        fetchDiscoveryData();
      } else {
        setLiveScanError(data.error || "Errore durante la scansione o verifica live dei video.");
        setLiveScanMessage(null);
      }
    } catch (e: any) {
      console.error(e);
      setLiveScanError("Errore di rete durante la scansione.");
      setLiveScanMessage(null);
    } finally {
      setLiveScanLoading(false);
    }
  };

  const handleYtImport = async (video: any) => {
    if (!ownerChannel) return;
    try {
      const res = await fetch(`/api/channels/${ownerChannel.id}/youtube-import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(video)
      });
      const data = await res.json();
      if (res.ok) {
        alert(`"${video.title}" importato con successo nel tuo canale!`);
        fetchBackofficeDetails(ownerChannel.id);
      } else {
        alert(data.error || 'Errore durante l\'importazione.');
      }
    } catch (e) {
      console.error(e);
      alert('Errore di connessione durante l\'importazione.');
    }
  };

  const handleApproveDiscovered = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/discovery/${id}/approve`, { method: 'POST' });
      if (res.status === 200) {
        fetchDiscoveryData();
        fetchNationalSyndications(); // Refresh global category list
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRejectDiscovered = async (id: string, reason?: string) => {
    try {
      const res = await fetch(`/api/admin/discovery/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });
      if (res.status === 200) {
        fetchDiscoveryData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // --- CHAT INTERACTION (FRONT-OFFICE) ---

  const handleSendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentChatMessage) return;

    const newMsg = {
      id: Math.random().toString(),
      user: user?.email.split('@')[0] || 'Ospite_' + Math.floor(Math.random() * 1000),
      message: currentChatMessage,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChatMessages([...chatMessages, newMsg]);
    setCurrentChatMessage('');
  };

  const triggerHeartEffect = () => {
    setLikesCount(likesCount + 1);
    const newHeart = {
      id: Date.now(),
      left: Math.random() * 80 + 10 // Random percentage left alignment
    };
    setFloatingHearts(prev => [...prev, newHeart]);
    setTimeout(() => {
      setFloatingHearts(prev => prev.filter(h => h.id !== newHeart.id));
    }, 1500);
  };

  // ----------------------------------------------------
  // --- SUB-VIEW RENDERERS ---

  // 1. EMBED FULL SCREEN VIEW
  if (currentPath.startsWith('/embed/')) {
    return (
      <div className="w-screen h-screen bg-slate-950 flex items-center justify-center m-0 p-0 overflow-hidden">
        {selectedChannel ? (
          <div className="w-full h-full relative">
            {nowPlaying?.content ? (
              <div className="w-full h-full">
                <YTVideoPlayer
                  url={nowPlaying.content.sourceUrl}
                  sourceType={nowPlaying.content.sourceType}
                  iframeCode={nowPlaying.content.iframeCode}
                  isMuted={true}
                  autoplay={true}
                  isVertical={nowPlaying.content.isVertical}
                />
              </div>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 font-mono text-xs">
                <Radio className="w-8 h-8 text-blue-500 animate-pulse mb-2" />
                <span>Caricamento Streaming - {selectedChannel.name}</span>
              </div>
            )}
            <div className="absolute top-3 left-3 bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-800 text-[10px] font-bold uppercase tracking-wider text-white">
              {selectedChannel.name}
            </div>
          </div>
        ) : (
          <div className="text-slate-500 text-xs font-mono">Canale non trovato</div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-slate-200 font-sans flex flex-col selection:bg-indigo-600 selection:text-white">
      {/* GLOBAL NAVBAR */}
      <nav className="border-b border-slate-800 bg-[#111114]/90 backdrop-blur-md sticky top-0 z-50 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div onClick={() => navigateTo('/')} className="flex items-center gap-3 cursor-pointer group">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-xl text-white shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-all">
              <Tv className="w-5 h-5" />
            </div>
            <div>
              <span className="font-display font-bold text-base tracking-tight text-white group-hover:text-indigo-400 transition-colors uppercase">
                Meta-tv-channel
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 block">SaaS IPTV Hub</span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-6 text-xs font-semibold tracking-widest text-slate-400">
            <button onClick={() => navigateTo('/')} className="hover:text-white transition-colors uppercase">Esplora Canali</button>
            <button onClick={() => navigateTo('/#syndication')} className="hover:text-white transition-colors uppercase">Rubriche Nazionali</button>
            <button onClick={() => navigateTo('/#request-wizard')} className="hover:text-white transition-colors uppercase">Crea la tua TV</button>
            
            {user && (user.role === 'tv_owner' || user.role === 'collaborator') && (
              <button 
                onClick={() => navigateTo('/backoffice')} 
                className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 transition-colors uppercase border-b border-indigo-500/40"
              >
                <Sliders className="w-3.5 h-3.5" />
                La Mia TV
              </button>
            )}

            {user?.role === 'admin' && (
              <button 
                onClick={() => navigateTo('/admin')} 
                className="flex items-center gap-1.5 text-purple-400 hover:text-purple-300 transition-colors uppercase border-b border-purple-500/40"
              >
                <Shield className="w-3.5 h-3.5" />
                Pannello Admin
              </button>
            )}
          </div>

          <div className="flex items-center gap-3.5">
            {clearStatus && (
              <span className="text-xs bg-amber-950/60 border border-amber-800/40 text-amber-300 font-medium px-3 py-1.5 rounded-xl animate-pulse">
                {clearStatus}
              </span>
            )}

            <button 
              onClick={handleClearDB}
              className={`flex items-center gap-1.5 border font-bold px-3.5 py-2 rounded-xl transition-all text-xs ${
                clearStep === 1 
                  ? 'bg-red-600 border-red-500 hover:bg-red-700 text-white animate-bounce' 
                  : 'bg-red-950/40 border-red-800/60 hover:bg-red-900/40 text-red-400'
              }`}
              title={clearStep === 1 ? "Clicca di nuovo per confermare l'eliminazione" : "Azzera e svuota tutti i contenuti per iniziare da zero"}
            >
              <Trash2 className="w-3.5 h-3.5" />
              {clearStep === 1 ? 'SICURO? CLICCA DI NUOVO!' : 'Svuota Contenuti'}
            </button>

            {user ? (
              <div className="flex items-center gap-3 bg-[#111114] border border-slate-800 rounded-xl px-3 py-1.5">
                <div className="text-right">
                  <p className="text-[10px] font-bold text-slate-400 truncate max-w-[120px]">{user.email}</p>
                  <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider">{user.role}</p>
                </div>
                <button 
                  onClick={handleLogout} 
                  className="p-1 text-slate-400 hover:text-red-400 transition-colors"
                  title="Esci"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button 
                onClick={() => navigateTo('/login')} 
                className="flex items-center gap-1.5 bg-[#0E0E12] border border-slate-800 hover:bg-[#16161A] text-slate-200 text-xs font-bold px-4 py-2 rounded-xl transition-all"
              >
                <LogIn className="w-3.5 h-3.5" />
                Accedi
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* MAIN VIEW CONTROLLER */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8">
        
        {/* VIEW 1: HOME PAGE (CATALOG & WIZARD) */}
        {currentPath === '/' && (
          <div className="space-y-16 animate-fade-in">
            {/* Hero Section */}
            <div className="text-center max-w-3xl mx-auto py-12 relative">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-72 bg-indigo-600/10 rounded-full blur-3xl -z-10"></div>
              <h1 className="text-3xl md:text-5xl font-display font-extrabold tracking-tight text-white mb-4 leading-tight">
                Crea, Pianifica ed Embedda <br />
                la tua <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-500 bg-clip-text text-transparent">TV Digitale h24</span>
              </h1>
              <p className="text-sm md:text-base text-slate-400 leading-relaxed max-w-xl mx-auto">
                Meta-tv-channel è la piattaforma SaaS IPTV multi-tenant che ti consente di organizzare palinsesti orari, condividere rubriche nazionali ed embeddare la tua web TV ovunque sul web.
              </p>
              
              <div className="flex flex-wrap justify-center gap-4 mt-8">
                <a href="#active-channels" className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-6 py-3 rounded-xl transition-all shadow-lg shadow-indigo-500/20 uppercase">
                  Esplora Canali Live
                </a>
                <a href="#request-wizard" className="bg-[#0E0E12] border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-xs font-bold px-6 py-3 rounded-xl transition-all uppercase">
                  Crea Canale (SaaS Request)
                </a>
              </div>
            </div>

            {/* SECTION 1: ACTIVE CHANNELS CATALOG */}
            <div id="active-channels" className="space-y-6">
              <div className="flex items-center gap-2.5">
                <Radio className="w-5 h-5 text-indigo-500 animate-pulse" />
                <h2 className="text-xl font-display font-bold text-white uppercase tracking-tight">Canali Attivi in Streaming</h2>
              </div>

              {channels.length === 0 ? (
                <div className="py-12 bg-[#111114] rounded-2xl border border-slate-800 text-center">
                  <Radio className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm">Nessun canale TV è attualmente online.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {channels.map(ch => (
                    <div 
                      key={ch.id} 
                      className="bg-[#111114] border border-slate-800 hover:border-indigo-500/40 rounded-2xl p-5 text-left transition-all hover:scale-[1.01] flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-4 mb-4">
                          <img 
                            src={ch.logoUrl} 
                            alt={ch.name} 
                            className="w-12 h-12 rounded-xl object-cover border border-slate-800 shrink-0" 
                          />
                          <div>
                            <h3 className="font-display font-bold text-white text-sm">{ch.name}</h3>
                            <span className="text-[10px] font-mono text-slate-500">/{ch.slug}</span>
                          </div>
                        </div>
                        <p className="text-xs text-slate-400 line-clamp-3 mb-5 leading-relaxed">
                          {ch.description}
                        </p>
                      </div>

                      <div className="flex items-center justify-between border-t border-slate-800/80 pt-4 mt-2">
                        <span className="text-[10px] font-bold uppercase text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-full">
                          Live Active
                        </span>
                        <button 
                          onClick={() => navigateTo(`/tv/${ch.slug}`)} 
                          className="flex items-center gap-1 bg-[#0E0E12] border border-slate-800 hover:border-indigo-500/60 hover:text-indigo-400 text-slate-300 text-xs font-bold px-3 py-1.5 rounded-lg transition-all"
                        >
                          Apri Player
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* SECTION: CANALI REGIONALI DIGITALE */}
            <div id="regional-channels-section" className="space-y-8" ref={regionalPlayerRef}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
                <div className="flex items-center gap-2.5">
                  <Tv className="w-5 h-5 text-indigo-500 animate-pulse" />
                  <div className="text-left">
                    <h2 className="text-xl font-display font-bold text-white uppercase tracking-tight">Canali Regionali Digitale</h2>
                    <p className="text-xs text-slate-400 mt-1">Sintonizzati in tempo reale sui principali flussi streaming delle emittenti regionali italiane.</p>
                  </div>
                </div>

                {/* Search Bar for 300+ channels */}
                <div className="relative max-w-sm w-full">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Cerca emittente regionale (es. Tele, Parma, Sicilia)..."
                    value={regionalSearch}
                    onChange={e => {
                      setRegionalSearch(e.target.value);
                      setRegionalLimit(24); // reset limit on search
                    }}
                    className="w-full bg-[#111114] border border-slate-800 focus:border-indigo-500/50 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 focus:outline-none transition-all placeholder:text-slate-500"
                  />
                </div>
              </div>

              {/* Active Regional Player */}
              {activeRegionalChannel && (
                <div className="bg-[#111114] border-2 border-indigo-500/40 rounded-3xl p-6 space-y-4 animate-fade-in text-left shadow-xl shadow-indigo-950/20">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-850 pb-4">
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-850 p-1 flex items-center justify-center shrink-0">
                        <img
                          src={activeRegionalChannel.logoUrl}
                          alt={activeRegionalChannel.name}
                          className="max-w-full max-h-full object-contain rounded-lg"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-display font-black text-white text-base tracking-tight">{activeRegionalChannel.name}</h3>
                          <span className="bg-red-600 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider animate-pulse flex items-center gap-1">
                            <span className="w-1 h-1 rounded-full bg-white animate-ping"></span>
                            Live Streaming
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 font-mono">Segnale streaming diretto • HLS Playlist (.m3u8)</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveRegionalChannel(null)}
                      className="bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-400 hover:text-white text-xs font-bold px-4 py-2 rounded-xl transition-all uppercase tracking-wider cursor-pointer"
                    >
                      Chiudi Player ✕
                    </button>
                  </div>

                  {/* Player Canvas */}
                  <div className="w-full aspect-video rounded-2xl overflow-hidden border border-slate-850 bg-black relative">
                    <YTVideoPlayer
                      url={activeRegionalChannel.streamUrl}
                      sourceType="m3u8"
                      isMuted={false}
                      autoplay={true}
                    />
                  </div>
                </div>
              )}

              {/* Regional Grid Catalog */}
              {(() => {
                const filtered = (regionalChannels || []).filter(c =>
                  c.name.toLowerCase().includes(regionalSearch.toLowerCase())
                );

                if (filtered.length === 0) {
                  return (
                    <div className="py-16 bg-[#111114] rounded-3xl border border-slate-800 text-center">
                      <Tv className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                      <p className="text-slate-400 text-sm font-bold">Nessuna emittente trovata</p>
                      <p className="text-slate-500 text-xs mt-1 max-w-xs mx-auto">Nessun canale regionale corrisponde a "{regionalSearch}". Riprova con un altro nome.</p>
                    </div>
                  );
                }

                const visible = filtered.slice(0, regionalLimit);

                return (
                  <div className="space-y-8">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                      {visible.map(c => {
                        const isActive = activeRegionalChannel?.id === c.id;
                        return (
                          <div
                            key={c.id}
                            onClick={() => {
                              setActiveRegionalChannel(c);
                              setTimeout(() => {
                                regionalPlayerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                              }, 150);
                            }}
                            className={`group relative bg-[#111114] border ${
                              isActive ? 'border-indigo-500 bg-indigo-500/5' : 'border-slate-800/80 hover:border-indigo-500/40'
                            } rounded-2xl p-4 text-center cursor-pointer transition-all hover:scale-[1.03] duration-200 flex flex-col items-center justify-between min-h-[140px] shadow-sm hover:shadow-indigo-500/5`}
                          >
                            {/* LCN Indicator Pill if exists */}
                            {c.lcn && (
                              <span className="absolute top-2 right-2 bg-slate-950/80 border border-slate-800 text-slate-400 text-[9px] font-mono px-1.5 py-0.5 rounded-md">
                                LCN {c.lcn}
                              </span>
                            )}

                            {/* Clickable Logo with beautiful custom shadow on hover */}
                            <div className="w-16 h-16 rounded-xl bg-slate-950 border border-slate-850 p-2 flex items-center justify-center transition-all group-hover:shadow-md group-hover:shadow-indigo-500/10 shrink-0">
                              <img
                                src={c.logoUrl}
                                alt={c.name}
                                className="max-w-full max-h-full object-contain rounded-md"
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  // fallback image if loading fails
                                  (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1542204172-e7052809a86f?w=150&h=150&fit=crop';
                                }}
                              />
                            </div>

                            {/* Name label below logo */}
                            <div className="mt-3 w-full">
                              <p className="text-xs font-bold text-slate-200 group-hover:text-indigo-400 transition-colors line-clamp-1">
                                {c.name}
                              </p>
                              <p className="text-[9px] text-slate-500 uppercase tracking-widest font-mono mt-0.5">Stream live</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Pagination Actions */}
                    <div className="flex justify-center items-center gap-4 border-t border-slate-850 pt-6">
                      {filtered.length > regionalLimit && (
                        <button
                          onClick={() => setRegionalLimit(prev => Math.min(prev + 24, filtered.length))}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-6 py-2.5 rounded-xl transition-all uppercase tracking-wider cursor-pointer shadow-md shadow-indigo-500/10"
                        >
                          Mostra Altri Canali ({filtered.length - regionalLimit} rimanenti) ➔
                        </button>
                      )}
                      
                      {regionalLimit > 24 && (
                        <button
                          onClick={() => setRegionalLimit(24)}
                          className="bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-400 hover:text-white text-xs font-bold px-6 py-2.5 rounded-xl transition-all uppercase tracking-wider cursor-pointer"
                        >
                          Riduci Lista ✕
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* SECTION 2: NATIONAL SYNDICATIONS ("RUBRICHE NAZIONALI") */}
            <div id="syndication" className="bg-[#111114] border border-slate-800 rounded-3xl p-8 space-y-6">
              <div className="text-left max-w-2xl">
                <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">Collaborazione SaaS</span>
                <h2 className="text-2xl font-display font-bold text-white mt-1">Rubriche Nazionali Condivisibili</h2>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Queste categorie di contenuti di alto valore sono state rese pubbliche e syndicate dai rispettivi canali proprietari. Qualsiasi TV affiliata può importarle per trasmetterle nel proprio palinsesto!
                </p>
              </div>

              {nationalSyndications.length === 0 ? (
                <p className="text-slate-500 text-xs">Nessuna rubrica nazionale condivisa al momento.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-left">
                  {nationalSyndications.map((item, idx) => (
                    <div key={idx} className="bg-[#0E0E12] border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-3.5">
                          <span className="text-xs font-bold text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded border border-indigo-500/20">
                            {item.category.name}
                          </span>
                          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                            Da: {item.sourceChannelName}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-2 line-clamp-2">
                          Video pronti per la riproduzione: {item.contentsCount}. Ideale per riempire fasce orarie vuote con programmi culturali.
                        </p>
                      </div>
                      <div className="mt-4 border-t border-slate-800 pt-3 flex flex-wrap gap-2">
                        {item.contents.slice(0, 3).map((co: any) => (
                          <span key={co.id} className="text-[10px] bg-[#111114] px-2 py-1 rounded border border-slate-800 text-slate-400">
                            • {co.title}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* SECTION 3: REQUEST CREATION WIZARD (TV REGISTER) */}
            <div id="request-wizard" className="max-w-xl mx-auto bg-[#111114] border border-slate-800 rounded-3xl p-6 md:p-8 text-left space-y-6">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">Inizia Ora</span>
                <h2 className="text-xl md:text-2xl font-display font-bold text-white mt-1">Richiedi la tua Web TV</h2>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Invia la tua proposta a Meta-tv-channel. L'amministratore valuterà la richiesta di attivazione, configurerà il canone di abbonamento mensile sbloccando la TV e fornendoti l'accesso al tuo pannello.
                </p>
              </div>

              {regSuccess ? (
                <div className="bg-green-600/10 border border-green-500/30 rounded-xl p-5 text-center space-y-3">
                  <CheckCircle className="w-8 h-8 text-green-400 mx-auto" />
                  <h4 className="text-sm font-bold text-white">Richiesta Inviata con Successo!</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Il nostro amministratore sta analizzando la proposta per il canale. Riceverai un'approvazione a breve e potrai accedere inserendo la tua e-mail nella barra di login in alto!
                  </p>
                  <button 
                    onClick={() => setRegSuccess(false)}
                    className="text-xs font-bold text-indigo-400 hover:underline"
                  >
                    Invia un'altra richiesta
                  </button>
                </div>
              ) : (
                <form onSubmit={handleRegisterChannel} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">La tua E-mail</label>
                    <input 
                      type="email" 
                      required
                      placeholder="es. mauro@email.com"
                      value={regEmail}
                      onChange={e => setRegEmail(e.target.value)}
                      className="w-full bg-[#0A0A0B] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Nome del Canale TV</label>
                    <input 
                      type="text" 
                      required
                      placeholder="es. Mauro Cucinando Live"
                      value={regChannelName}
                      onChange={e => setRegChannelName(e.target.value)}
                      className="w-full bg-[#0A0A0B] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Descrizione Palinsesto e Target</label>
                    <textarea 
                      rows={3}
                      placeholder="Descrivi di cosa si occuperà la tua TV, quali contenuti caricherai (es. lezioni culinarie h24)..."
                      value={regDesc}
                      onChange={e => setRegDesc(e.target.value)}
                      className="w-full bg-[#0A0A0B] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <button 
                    type="submit" 
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-3 rounded-xl transition-all shadow-md shadow-indigo-500/10 mt-2 uppercase tracking-wider"
                  >
                    Sottoponi Richiesta ad Admin
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* VIEW 2: PUBLIC TV CHANNEL DETAIL & STREAM PLAYER */}
        {currentPath.startsWith('/tv/') && (
          <div className="space-y-8 animate-fade-in text-left">
            {selectedChannel ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Left Side: Channel logo, Player, and description */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Channel Title Card */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#111114] border border-slate-800 rounded-2xl p-5">
                    <div className="flex items-center gap-4">
                      <img 
                        src={selectedChannel.logoUrl} 
                        alt={selectedChannel.name} 
                        className="w-14 h-14 rounded-xl object-cover border border-slate-800 shrink-0"
                      />
                      <div>
                        <h1 className="text-xl font-display font-extrabold text-white leading-tight uppercase">
                          {selectedChannel.name}
                        </h1>
                        <p className="text-xs text-slate-400 mt-1">
                          Canale Ufficiale • {selectedChannelSchedules.length} slot programmati
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-green-400 bg-green-500/10 px-3 py-1 rounded border border-green-500/20">
                        Online h24
                      </span>
                    </div>
                  </div>

                  {/* Channel Player Panel */}
                  <div id="channel-player-section" className="space-y-4">
                    {isPreviewMode && (
                      <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-left animate-fade-in">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">📺</span>
                          <div>
                            <p className="text-xs font-bold text-amber-400 uppercase tracking-wider">Modalità Anteprima Attiva</p>
                            <p className="text-[11px] text-slate-300">Stai visualizzando il test player per lo slot selezionato. I visitatori pubblici del canale continuano a vedere la regolare diretta oraria.</p>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setIsPreviewMode(false);
                            if (selectedChannel) {
                              fetchNowPlaying(selectedChannel.slug);
                            }
                          }}
                          className="bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black px-4 py-2 rounded-xl transition-all uppercase tracking-wider cursor-pointer shadow-md shadow-amber-500/15"
                        >
                          Torna alla Diretta ⚡
                        </button>
                      </div>
                    )}
                    <ChannelPlayer 
                      content={nowPlaying?.content || null} 
                      channelName={selectedChannel.name}
                    />
                  </div>

                  {/* About Channel */}
                  <div className="bg-[#111114] border border-slate-800 rounded-2xl p-5">
                    <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Informazioni sul canale</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {selectedChannel.description}
                    </p>
                  </div>

                  {/* Schedules program list */}
                  <ScheduleGrid 
                    schedules={selectedChannelSchedules} 
                    contents={selectedChannelContents} 
                    isEditable={false}
                    isAdminOrOwner={user?.role === 'admin' || user?.role === 'tv_owner'}
                    onPreviewSchedule={handlePreviewSchedule}
                  />
                </div>

                {/* Right Side: Interactive Chat & Simulation Metrics */}
                <div className="space-y-6">
                  {/* Live interactions hub */}
                  <div className="bg-[#111114] border border-slate-800 rounded-2xl p-5 flex flex-col justify-between h-[480px]">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-indigo-400" />
                        <h3 className="text-xs font-bold uppercase text-white tracking-wider">Live Chat & Interaction</h3>
                      </div>
                      
                      {/* Heart trigger */}
                      <button 
                        onClick={triggerHeartEffect}
                        className="relative p-1.5 rounded-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-500 hover:scale-110 transition-all flex items-center gap-1 text-[11px] font-bold"
                      >
                        <Heart className="w-3.5 h-3.5 fill-current" />
                        {likesCount}

                        {/* Floating hearts animation */}
                        {floatingHearts.map(heart => (
                          <div 
                            key={heart.id} 
                            style={{ left: `${heart.left}%` }}
                            className="absolute -top-10 text-red-500 text-lg animate-bounce transition-all duration-1000 opacity-0 transform translate-y-[-20px]"
                          >
                            ❤️
                          </div>
                        ))}
                      </button>
                    </div>

                    {/* Messages panel */}
                    <div className="flex-1 overflow-y-auto space-y-3.5 my-4 pr-1 scrollbar-thin scrollbar-thumb-slate-800 text-xs">
                      {chatMessages.map(msg => (
                        <div key={msg.id} className="bg-[#0A0A0B]/60 p-2.5 rounded-xl border border-slate-800/40">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="font-bold text-indigo-400">{msg.user}</span>
                            <span className="text-[9px] font-mono text-slate-500">{msg.timestamp}</span>
                          </div>
                          <p className="text-slate-300 leading-normal">{msg.message}</p>
                        </div>
                      ))}
                    </div>

                    {/* Form input */}
                    <form onSubmit={handleSendChatMessage} className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="Invia un messaggio..."
                        value={currentChatMessage}
                        onChange={e => setCurrentChatMessage(e.target.value)}
                        className="flex-1 bg-[#0A0A0B] border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                      />
                      <button 
                        type="submit"
                        className="bg-indigo-600 hover:bg-indigo-500 text-white p-2.5 rounded-xl transition-all"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </form>
                  </div>

                  {/* Real-time Simulated Telemetry logs */}
                  <div className="bg-[#111114] border border-slate-800 rounded-2xl p-5 text-left">
                    <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
                      <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-indigo-400" />
                        Attività del Canale (Simulatore Real-Time)
                      </span>
                    </div>

                    <div className="space-y-2 h-[120px] overflow-y-auto font-mono text-[10px] text-slate-400">
                      {realtimeLogs.map((log, idx) => (
                        <div key={idx} className="flex items-start gap-1">
                          <span className="text-indigo-400 shrink-0">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                          <span className="text-slate-300">{log.message}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

              </div>
            ) : (
              <div className="py-24 text-center">
                <AlertTriangle className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-white">Canale Non Trovato</h3>
                <p className="text-xs text-slate-500 mt-1">L'URL potrebbe essere errato, oppure il canale potrebbe essere stato sospeso dall'amministratore.</p>
              </div>
            )}
          </div>
        )}

        {/* VIEW 3: USER LOGIN */}
        {currentPath === '/login' && (
          <div className="max-w-md mx-auto bg-[#111114] border border-slate-800 rounded-3xl p-6 md:p-8 text-left space-y-6 my-12 animate-fade-in">
            <div className="text-center">
              <LogIn className="w-10 h-10 text-indigo-500 mx-auto mb-2" />
              <h2 className="text-xl font-display font-bold text-white uppercase tracking-tight">Accedi alla Piattaforma</h2>
              <p className="text-xs text-slate-400 mt-1">Inserisci la tua e-mail registrata per sbloccare la tua TV o accedere come amministratore.</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">E-mail</label>
                <input 
                  type="email" 
                  required
                  placeholder="admin@metatv.com o owner@channel.com"
                  value={authEmail}
                  onChange={e => setAuthEmail(e.target.value)}
                  className="w-full bg-[#0A0A0B] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <button 
                type="submit" 
                disabled={authLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-3 rounded-xl transition-all shadow-md mt-2 disabled:opacity-50 uppercase tracking-wider"
              >
                {authLoading ? 'Verifica in corso...' : 'Entra'}
              </button>
            </form>

            <div className="border-t border-slate-800 pt-4 text-center">
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Suggerimenti di test:<br />
                Amministratore: <span className="font-mono text-slate-400">admin@metatv.com</span><br />
                Proprietario TV: <span className="font-mono text-slate-400">music@metatv.com</span> o <span className="font-mono text-slate-400">tech@metatv.com</span>
              </p>
            </div>
          </div>
        )}

        {/* VIEW 4: ADMIN DASHBOARD */}
        {currentPath === '/admin' && user?.role === 'admin' && (
          <div className="space-y-8 animate-fade-in text-left">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#111114] border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center gap-3">
                <Shield className="w-8 h-8 text-indigo-500" />
                <div>
                  <h1 className="text-lg font-display font-bold text-white uppercase tracking-tight">Dashboard di Controllo Globale</h1>
                  <p className="text-xs text-slate-400">Amministratore di Sistema • Gestione Multi-Tenant SaaS IPTV</p>
                </div>
              </div>

              {/* Stats highlights */}
              {adminStats && (
                <div className="flex items-center gap-4">
                  <div className="bg-[#0A0A0B] border border-slate-800 px-3.5 py-1.5 rounded-xl text-center">
                    <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Ricavo Mensile</span>
                    <p className="text-sm font-bold text-green-400 mt-0.5">€{adminStats.monthlyRevenue?.toFixed(2)}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Admin navigation tabs */}
            <div className="flex gap-2 border-b border-slate-800 pb-px">
              <button 
                onClick={() => setActiveAdminTab('requests')}
                className={`pb-2.5 px-4 text-xs font-bold border-b-2 transition-all uppercase tracking-wider ${
                  activeAdminTab === 'requests' 
                    ? 'border-indigo-500 text-indigo-400' 
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Richieste di Registrazione ({adminRequests.filter(r => r.status === 'pending').length})
              </button>
              <button 
                onClick={() => setActiveAdminTab('channels')}
                className={`pb-2.5 px-4 text-xs font-bold border-b-2 transition-all uppercase tracking-wider ${
                  activeAdminTab === 'channels' 
                    ? 'border-indigo-500 text-indigo-400' 
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Canali TV Attivati ({allChannelsForAdmin.length})
              </button>
              <button 
                onClick={() => setActiveAdminTab('regional')}
                className={`pb-2.5 px-4 text-xs font-bold border-b-2 transition-all uppercase tracking-wider ${
                  activeAdminTab === 'regional' 
                    ? 'border-indigo-500 text-indigo-400' 
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Canali Regionali ({regionalChannels.length})
              </button>
              <button 
                onClick={() => setActiveAdminTab('discovery')}
                className={`pb-2.5 px-4 text-xs font-bold border-b-2 transition-all uppercase tracking-wider ${
                  activeAdminTab === 'discovery' 
                    ? 'border-indigo-500 text-indigo-400' 
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Autodiscovery IA & Scraper ({discoveredContents.length})
              </button>
            </div>

            {/* TAB CONTENT: REQUESTS APPROVALS */}
            {activeAdminTab === 'requests' && (
              <div className="bg-[#111114] border border-slate-800 rounded-2xl p-5 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Nuove proposte pervenute</h3>
                
                {adminRequests.length === 0 ? (
                  <p className="text-slate-500 text-xs py-8 text-center">Nessuna richiesta di attivazione.</p>
                ) : (
                  <div className="space-y-3">
                    {adminRequests.map(req => (
                      <div key={req.id} className="bg-[#0E0E12] border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-bold text-white">{req.channelName}</h4>
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase ${
                              req.status === 'pending' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/25' :
                              req.status === 'approved' ? 'bg-green-500/10 text-green-400 border border-green-500/25' :
                              'bg-red-500/10 text-red-400 border border-red-500/25'
                            }`}>
                              {req.status}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400">Proposta da: <span className="text-slate-300">{req.email}</span></p>
                          <p className="text-[11px] text-slate-500 max-w-xl">{req.description}</p>
                        </div>

                        {req.status === 'pending' && (
                          <div className="flex gap-2 self-end md:self-auto shrink-0">
                            <button 
                              onClick={() => handleApproveRequest(req.id, 'reject')}
                              className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/25 text-red-400 border border-red-500/20 text-[10px] font-bold transition-all uppercase"
                            >
                              Rifiuta
                            </button>
                            <button 
                              onClick={() => handleApproveRequest(req.id, 'approve')}
                              className="px-3 py-1.5 rounded-lg bg-green-500/10 hover:bg-green-500/25 text-green-400 border border-green-500/20 text-[10px] font-bold transition-all uppercase"
                            >
                              Approva e Attiva TV
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: CHANNELS MASTER LIST & FEES */}
            {activeAdminTab === 'channels' && (
              <div className="bg-[#111114] border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Monitoraggio Canali e Canoni</h3>
                  
                  {adminStats && (
                    <div className="flex items-center gap-2.5">
                      <span className="text-[11px] text-slate-400 font-medium">Canone Base:</span>
                      <input 
                        type="number" 
                        value={adminStats.defaultMonthlyFee}
                        onChange={e => handleUpdateDefaultPricing(Number(e.target.value))}
                        className="w-16 bg-[#0A0A0B] border border-slate-800 rounded px-2 py-0.5 text-xs text-center font-bold text-indigo-400"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-3.5">
                  {allChannelsForAdmin.map(ch => (
                    <div key={ch.id} className="bg-[#0E0E12] border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div className="flex items-center gap-3.5">
                        <img src={ch.logoUrl} alt={ch.name} className="w-10 h-10 rounded-lg object-cover border border-slate-800" />
                        <div>
                          <h4 className="text-xs font-bold text-white">{ch.name}</h4>
                          <p className="text-[10px] text-slate-500">Slug: /{ch.slug} • Stato: {ch.status}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end shrink-0">
                        {/* Monthly Fee Control */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-400">Canone TV:</span>
                          <input 
                            type="number"
                            value={ch.monthlyFee}
                            onChange={e => handleUpdateChannelFee(ch.id, Number(e.target.value))}
                            className="w-16 bg-[#0A0A0B] border border-slate-800 rounded px-2 py-0.5 text-xs text-slate-100 font-bold"
                          />
                        </div>

                        {/* Suspension / Activation Control */}
                        <div className="flex gap-2">
                          {ch.status === 'active' ? (
                            <button 
                              onClick={() => handleUpdateChannelStatus(ch.id, 'suspended')}
                              className="px-3 py-1.5 rounded-lg bg-red-650/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-[10px] font-bold uppercase"
                            >
                              Sospendi
                            </button>
                          ) : (
                            <button 
                              onClick={() => handleUpdateChannelStatus(ch.id, 'active')}
                              className="px-3 py-1.5 rounded-lg bg-green-650/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 text-[10px] font-bold uppercase"
                            >
                              Riattiva
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB CONTENT: REGIONAL CHANNELS MANAGEMENT */}
            {activeAdminTab === 'regional' && (
              <div className="bg-[#111114] border border-slate-800 rounded-2xl p-6 space-y-6">
                
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
                  <div className="text-left">
                    <h3 className="text-base font-display font-black text-white uppercase tracking-tight">Database Canali Regionali</h3>
                    <p className="text-xs text-slate-400 mt-1">Gestisci i flussi e le LCN delle {regionalChannels.length} emittenti del digitale terrestre.</p>
                  </div>
                  
                  <button
                    onClick={handleOpenAddRegionalChannel}
                    className="flex items-center justify-center gap-1.5 bg-indigo-650 hover:bg-indigo-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all uppercase tracking-wider cursor-pointer shadow-md shadow-indigo-500/10"
                  >
                    <Plus className="w-4 h-4" /> Aggiungi Nuovo Canale
                  </button>
                </div>

                {/* Notifications */}
                {regionalAdminSuccess && (
                  <div className="p-3.5 bg-green-500/10 border border-green-500/30 text-green-400 rounded-xl text-xs flex justify-between items-center">
                    <span>{regionalAdminSuccess}</span>
                    <button onClick={() => setRegionalAdminSuccess(null)} className="hover:text-white">✕</button>
                  </div>
                )}
                {regionalAdminError && (
                  <div className="p-3.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-xs flex justify-between items-center">
                    <span>{regionalAdminError}</span>
                    <button onClick={() => setRegionalAdminError(null)} className="hover:text-white">✕</button>
                  </div>
                )}

                {/* Add/Edit Form */}
                {(isAddingRegionalChannel || editingRegionalChannel) && (
                  <div className="bg-[#0A0A0B] border border-slate-800 rounded-2xl p-5 space-y-4 animate-fade-in text-left">
                    <div className="flex items-center justify-between border-b border-slate-850 pb-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                        {editingRegionalChannel ? `Modifica Canale: ${editingRegionalChannel.name}` : 'Aggiungi Nuovo Canale Regionale'}
                      </h4>
                      <button
                        onClick={() => {
                          setIsAddingRegionalChannel(false);
                          setEditingRegionalChannel(null);
                        }}
                        className="text-slate-500 hover:text-slate-300 text-xs"
                      >
                        Annulla ✕
                      </button>
                    </div>

                    <form onSubmit={handleSaveRegionalChannel} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-slate-400 uppercase">Nome Canale *</label>
                          <input
                            type="text"
                            placeholder="Es. Antenna Sud, Telelombardia"
                            value={regionalFormName}
                            onChange={e => setRegionalFormName(e.target.value)}
                            className="w-full bg-[#111114] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                            required
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-slate-400 uppercase">Numero LCN (Opzionale)</label>
                          <input
                            type="number"
                            placeholder="Es. 10, 13, 77"
                            value={regionalFormLcn}
                            onChange={e => setRegionalFormLcn(e.target.value)}
                            className="w-full bg-[#111114] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-400 uppercase">URL Streaming Playlist HLS (.m3u8) *</label>
                        <input
                          type="url"
                          placeholder="https://.../playlist.m3u8"
                          value={regionalFormStreamUrl}
                          onChange={e => setRegionalFormStreamUrl(e.target.value)}
                          className="w-full bg-[#111114] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                          required
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-400 uppercase">URL Logo (Opzionale)</label>
                        <input
                          type="url"
                          placeholder="https://.../logo.png"
                          value={regionalFormLogoUrl}
                          onChange={e => setRegionalFormLogoUrl(e.target.value)}
                          className="w-full bg-[#111114] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div className="flex justify-end gap-2.5 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setIsAddingRegionalChannel(false);
                            setEditingRegionalChannel(null);
                          }}
                          className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white text-xs font-bold transition-all uppercase"
                        >
                          Annulla
                        </button>
                        <button
                          type="submit"
                          className="px-5 py-2 rounded-xl bg-indigo-650 hover:bg-indigo-600 text-white text-xs font-bold transition-all uppercase tracking-wider"
                        >
                          {editingRegionalChannel ? 'Salva Modifiche' : 'Crea Canale'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Search & Filter Row */}
                <div className="relative max-w-md w-full text-left">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Filtra canali per nome o LCN..."
                    value={regionalAdminSearch}
                    onChange={e => {
                      setRegionalAdminSearch(e.target.value);
                      setRegionalAdminLimit(20); // reset limit
                    }}
                    className="w-full bg-[#0A0A0B] border border-slate-800 focus:border-indigo-500/50 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 focus:outline-none transition-all placeholder:text-slate-500"
                  />
                </div>

                {/* Table/List of channels */}
                {(() => {
                  const filtered = (regionalChannels || []).filter(c =>
                    c.name.toLowerCase().includes(regionalAdminSearch.toLowerCase()) ||
                    (c.lcn && String(c.lcn).includes(regionalAdminSearch))
                  );

                  if (filtered.length === 0) {
                    return (
                      <div className="py-12 text-center bg-[#0A0A0B] rounded-xl border border-slate-850">
                        <Tv className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                        <p className="text-slate-400 text-xs font-bold">Nessun canale corrisponde alla ricerca</p>
                      </div>
                    );
                  }

                  const visible = filtered.slice(0, regionalAdminLimit);

                  return (
                    <div className="space-y-4 text-left">
                      <div className="border border-slate-850 rounded-xl overflow-hidden">
                        <table className="w-full text-xs text-slate-300">
                          <thead className="bg-[#0A0A0B] text-slate-400 uppercase text-[10px] font-bold tracking-wider border-b border-slate-850">
                            <tr>
                              <th className="py-3 px-4 text-left">Logo & Canale</th>
                              <th className="py-3 px-4 text-center">LCN</th>
                              <th className="py-3 px-4 text-left hidden md:table-cell">HLS URL (.m3u8)</th>
                              <th className="py-3 px-4 text-center">Azioni</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-850">
                            {visible.map(c => (
                              <tr key={c.id} className="hover:bg-[#0E0E12] transition-colors">
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-slate-950 rounded border border-slate-800 p-0.5 flex items-center justify-center shrink-0">
                                      <img
                                        src={c.logoUrl}
                                        alt={c.name}
                                        className="max-w-full max-h-full object-contain rounded"
                                        referrerPolicy="no-referrer"
                                        onError={(e) => {
                                          (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1542204172-e7052809a86f?w=150&h=150&fit=crop';
                                        }}
                                      />
                                    </div>
                                    <div>
                                      <span className="font-bold text-white text-xs">{c.name}</span>
                                      <span className="md:hidden block text-[9px] text-slate-500 font-mono truncate max-w-[150px]">{c.streamUrl}</span>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-center">
                                  {c.lcn ? (
                                    <span className="bg-indigo-950/40 border border-indigo-900/40 text-indigo-400 text-[10px] font-mono px-2 py-0.5 rounded-md font-bold">
                                      {c.lcn}
                                    </span>
                                  ) : (
                                    <span className="text-slate-600 font-mono">-</span>
                                  )}
                                </td>
                                <td className="py-3 px-4 hidden md:table-cell max-w-[200px] truncate font-mono text-[10px] text-slate-400">
                                  {c.streamUrl}
                                </td>
                                <td className="py-3 px-4">
                                  <div className="flex justify-center items-center gap-2">
                                    <button
                                      onClick={() => handleOpenEditRegionalChannel(c)}
                                      className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-850 border border-slate-800 text-[10px] text-indigo-400 hover:text-indigo-300 font-bold transition-all uppercase"
                                    >
                                      Modifica
                                    </button>
                                    {regionalDeleteConfirmId === c.id ? (
                                      <div className="flex items-center gap-1">
                                        <button
                                          onClick={() => handleDeleteRegionalChannel(c.id)}
                                          className="px-2.5 py-1 rounded bg-red-650 hover:bg-red-500 text-[10px] text-white font-bold transition-all uppercase"
                                        >
                                          Sicuro?
                                        </button>
                                        <button
                                          onClick={() => setRegionalDeleteConfirmId(null)}
                                          className="px-1.5 py-1 rounded bg-slate-800 hover:bg-slate-750 text-[10px] text-slate-300 font-bold transition-all uppercase"
                                        >
                                          No
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={() => setRegionalDeleteConfirmId(c.id)}
                                        className="px-2.5 py-1 rounded bg-red-950/20 hover:bg-red-500/10 border border-red-900/30 text-[10px] text-red-400 hover:text-red-300 font-bold transition-all uppercase"
                                      >
                                        Elimina
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination Controls */}
                      {filtered.length > regionalAdminLimit && (
                        <div className="flex justify-center pt-2">
                          <button
                            onClick={() => setRegionalAdminLimit(prev => Math.min(prev + 30, filtered.length))}
                            className="bg-indigo-650 hover:bg-indigo-500 text-white text-xs font-bold px-5 py-2 rounded-xl transition-all uppercase tracking-wider cursor-pointer"
                          >
                            Mostra altri ({filtered.length - regionalAdminLimit} rimanenti) ➔
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* TAB CONTENT: AUTO-DISCOVERY & NATIONAL RUBRICS */}
            {activeAdminTab === 'discovery' && (
              <div className="space-y-6 animate-fade-in text-left">
                
                {/* Subtab Selector */}
                <div className="flex border-b border-slate-800 gap-2 mb-2">
                  <button
                    onClick={() => setActiveScraperTab('youtube')}
                    className={`pb-3 px-6 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${
                      activeScraperTab === 'youtube'
                        ? 'border-indigo-500 text-indigo-400'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    Autodiscovery IA (YouTube)
                  </button>
                  <button
                    onClick={() => setActiveScraperTab('scraper')}
                    className={`pb-3 px-6 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${
                      activeScraperTab === 'scraper'
                        ? 'border-indigo-500 text-indigo-400'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5" />
                    AI Web Scraper & Responsive Embedder
                  </button>
                </div>

                {activeScraperTab === 'youtube' && (
                  <div className="space-y-6">
                
                {/* Discovery configuration & control row */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Discovery controls card */}
                  <div className="bg-[#111114] border border-slate-800 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center gap-2">
                      <RefreshCw className={`w-4 h-4 text-indigo-400 ${discoveryLoading ? 'animate-spin' : ''}`} />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Modulo Content Discovery</h3>
                    </div>
                    
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      L'algoritmo effettua una scansione autonoma del web (YouTube, Vimeo, feed embeddabili) per rintracciare video in lingua italiana coerenti con i settori delle rubriche nazionali.
                    </p>

                    <div className="space-y-1.5">
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider text-left">Argomento Specifico (Opzionale)</label>
                      <input
                        type="text"
                        value={adminScanTopic}
                        onChange={e => setAdminScanTopic(e.target.value)}
                        placeholder="Lascia vuoto per settore casuale..."
                        className="w-full bg-[#0A0A0B] border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 font-medium text-[11px] outline-none"
                        disabled={discoveryLoading}
                      />
                    </div>

                    <div className="pt-1">
                      <button
                        onClick={handleTriggerDiscoveryScan}
                        disabled={discoveryLoading}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold py-3 px-4 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 uppercase tracking-wider"
                      >
                        {discoveryLoading ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            Scansione in corso...
                          </>
                        ) : (
                          <>
                            <Sliders className="w-3.5 h-3.5" />
                            Avvia Scansione Web Ora
                          </>
                        )}
                      </button>
                    </div>

                    {discoveryConfig.lastRunAt && (
                      <div className="text-[10px] text-slate-500 text-center font-mono">
                        Ultima esecuzione: {new Date(discoveryConfig.lastRunAt).toLocaleString('it-IT')}
                      </div>
                    )}
                  </div>

                  {/* Whitelist / Blacklist and auto-approve config card */}
                  <div className="bg-[#111114] border border-slate-800 rounded-2xl p-5 space-y-4 lg:col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Settings className="w-4 h-4 text-slate-400" />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Regole del Motore di Classificazione</h3>
                      </div>
                      
                      {/* Auto-approve toggle */}
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-300">
                        <input
                          type="checkbox"
                          checked={discoveryConfig.autoApproveEnabled}
                          onChange={e => handleUpdateDiscoveryConfig({
                            ...discoveryConfig,
                            autoApproveEnabled: e.target.checked
                          })}
                          className="rounded border-slate-800 bg-[#0A0A0B] text-indigo-500 focus:ring-0 w-4 h-4"
                        />
                        Auto-Approvazione Rubriche
                      </label>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      {/* Whitelist input */}
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Parole Chiave Whitelist (Rilevanti)</label>
                        <input
                          type="text"
                          placeholder="italiano, ricetta, viaggio (separate da virgola)"
                          defaultValue={discoveryConfig.whitelistKeywords?.join(', ')}
                          onBlur={e => {
                            const list = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                            handleUpdateDiscoveryConfig({ ...discoveryConfig, whitelistKeywords: list });
                          }}
                          className="w-full bg-[#0A0A0B] border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono text-[11px]"
                        />
                        <p className="text-[9px] text-slate-500 leading-normal">I video che contengono questi termini hanno punteggi di qualità più elevati.</p>
                      </div>

                      {/* Blacklist input */}
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider text-red-400">Blacklist Globale (Termini Vietati)</label>
                        <input
                          type="text"
                          placeholder="vietato, copia, restricted (separate da virgola)"
                          defaultValue={discoveryConfig.blacklistKeywords?.join(', ')}
                          onBlur={e => {
                            const list = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                            handleUpdateDiscoveryConfig({ ...discoveryConfig, blacklistKeywords: list });
                          }}
                          className="w-full bg-[#0A0A0B] border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono text-[11px]"
                        />
                        <p className="text-[9px] text-slate-500 leading-normal">I video che contengono questi termini vengono automaticamente rifiutati o esclusi.</p>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Statistics Highlights */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-[#111114] border border-slate-800 p-4 rounded-xl text-left">
                    <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Rilevazioni Totali</span>
                    <p className="text-xl font-bold text-white mt-1">{discoveredContents.length}</p>
                  </div>
                  <div className="bg-[#111114] border border-slate-800 p-4 rounded-xl text-left">
                    <span className="text-[9px] uppercase font-bold text-yellow-400 tracking-wider">Pendenti Approvazione</span>
                    <p className="text-xl font-bold text-yellow-400 mt-1">
                      {discoveredContents.filter(d => d.status === 'pending_approval').length}
                    </p>
                  </div>
                  <div className="bg-[#111114] border border-slate-800 p-4 rounded-xl text-left">
                    <span className="text-[9px] uppercase font-bold text-green-400 tracking-wider">Approvati e Pubblicati</span>
                    <p className="text-xl font-bold text-green-400 mt-1">
                      {discoveredContents.filter(d => d.status === 'approved').length}
                    </p>
                  </div>
                  <div className="bg-[#111114] border border-slate-800 p-4 rounded-xl text-left">
                    <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Scartati / Rifiutati</span>
                    <p className="text-xl font-bold text-slate-400 mt-1">
                      {discoveredContents.filter(d => d.status === 'rejected').length}
                    </p>
                  </div>
                </div>

                {/* Sector Filters & Results Table */}
                <div className="bg-[#111114] border border-slate-800 rounded-2xl p-5 space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Coda di Monitoraggio dei Contenuti Nazionali</h3>
                    
                    {/* Sector Pills */}
                    <div className="flex flex-wrap gap-1.5">
                      {['Tutti', 'Cucina Italiana', 'Viaggi in Italia', 'Musica Italiana', 'Sport Italiani', 'Cultura Italiana', 'Tecnologia', 'Intrattenimento', 'News Italiane'].map(sect => (
                        <button
                          key={sect}
                          onClick={() => setDiscoverySectorFilter(sect)}
                          className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all ${
                            discoverySectorFilter === sect
                              ? 'bg-indigo-600 text-white'
                              : 'bg-[#0E0E12] border border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {sect}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Discovered Items list */}
                  {discoveredContents.filter(d => 
                    discoverySectorFilter === 'Tutti' || d.sector === discoverySectorFilter
                  ).length === 0 ? (
                    <div className="text-center py-12 text-slate-500 text-xs">
                      Nessun contenuto rintracciato per il filtro selezionato. Avvia una scansione per trovare nuovi video.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {discoveredContents
                        .filter(d => discoverySectorFilter === 'Tutti' || d.sector === discoverySectorFilter)
                        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                        .map(item => (
                          <div 
                            key={item.id} 
                            className={`p-4 rounded-xl border flex flex-col md:flex-row justify-between gap-4 transition-all text-left ${
                              item.status === 'pending_approval' ? 'bg-[#0E0E12] border-slate-800 hover:border-slate-700' :
                              item.status === 'approved' ? 'bg-green-500/5 border-green-500/15' :
                              'bg-red-500/5 border-red-500/15 opacity-70'
                            }`}
                          >
                            <div className="space-y-2.5 flex-1">
                              {/* Metadata header */}
                              <div className="flex flex-wrap items-center gap-2 text-[10px]">
                                <span className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-2.5 py-0.5 rounded font-bold uppercase">
                                  {item.sector}
                                </span>
                                <span className="text-slate-500 font-mono">ID: {item.id}</span>
                                <span className="text-slate-500">•</span>
                                <span className="text-slate-400 font-mono flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-slate-500" />
                                  {item.durationMinutes} min
                                </span>
                                <span className="text-slate-500">•</span>
                                <span className="text-slate-500 font-mono">Trovato il {new Date(item.createdAt).toLocaleDateString('it-IT')}</span>
                              </div>

                              {/* Title & Desc */}
                              <div>
                                <h4 className="text-xs font-bold text-white leading-snug">{item.title}</h4>
                                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{item.description}</p>
                              </div>

                              {/* URL link */}
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-slate-500 font-mono uppercase">URL Sorgente:</span>
                                <a 
                                  href={item.sourceUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="text-[10px] text-indigo-400 hover:underline font-mono truncate max-w-xs md:max-w-md inline-flex items-center gap-1"
                                >
                                  {item.sourceUrl}
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </div>

                              {/* Brain Classifiers Diagnostics */}
                              <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-slate-850">
                                <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Analisi AI:</span>
                                
                                <span className="text-[10px] text-slate-300 font-mono bg-[#0A0A0B] border border-slate-800 px-2 py-0.5 rounded-md">
                                  Lingua: <strong className="text-indigo-400 uppercase">{item.language}</strong>
                                </span>

                                <span className="text-[10px] text-slate-300 font-mono bg-[#0A0A0B] border border-slate-800 px-2 py-0.5 rounded-md flex items-center gap-1">
                                  Embed: 
                                  {item.embedAllowed ? (
                                    <strong className="text-green-400">Consentito</strong>
                                  ) : (
                                    <strong className="text-red-400">Bloccato</strong>
                                  )}
                                </span>

                                <span className="text-[10px] text-slate-300 font-mono bg-[#0A0A0B] border border-slate-800 px-2 py-0.5 rounded-md">
                                  Punteggio Qualità: <strong className="text-indigo-400">{item.qualityScore}/100</strong>
                                </span>

                                <span className="text-[10px] text-slate-300 font-mono bg-[#0A0A0B] border border-slate-800 px-2 py-0.5 rounded-md">
                                  Affidabilità: <strong className={item.reliability === 'High' ? 'text-green-400' : 'text-yellow-400'}>{item.reliability}</strong>
                                </span>
                              </div>

                              {/* Rejection reason if any */}
                              {item.reason && (
                                <div className="text-[10px] bg-red-950/20 border border-red-900/25 text-red-400 px-3 py-1.5 rounded-lg mt-2 font-mono leading-relaxed">
                                  Motivazione: {item.reason}
                                </div>
                              )}
                            </div>

                            {/* Action Buttons */}
                            <div className="flex md:flex-col justify-end gap-2 shrink-0 md:w-48 border-t md:border-t-0 border-slate-850 pt-3 md:pt-0">
                              {item.status === 'pending_approval' && (
                                <>
                                  <button
                                    onClick={() => handleApproveDiscovered(item.id)}
                                    className="flex-1 bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 rounded-xl py-2 px-3 text-[10px] font-bold uppercase tracking-wider transition-all"
                                  >
                                    Approva e Ingerisci
                                  </button>
                                  <button
                                    onClick={() => {
                                      const reason = prompt('Inserisci la motivazione del rifiuto (opzionale):');
                                      handleRejectDiscovered(item.id, reason || undefined);
                                    }}
                                    className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl py-2 px-3 text-[10px] font-bold uppercase tracking-wider transition-all"
                                  >
                                    Rifiuta / Scarta
                                  </button>
                                </>
                              )}

                              {item.status === 'approved' && (
                                <div className="w-full text-center text-[10px] font-bold uppercase text-green-400 bg-green-500/10 border border-green-500/20 py-2 rounded-xl flex items-center justify-center gap-1">
                                  <CheckCircle className="w-3.5 h-3.5" />
                                  Approvato & In Linea
                                </div>
                              )}

                              {item.status === 'rejected' && (
                                <div className="w-full text-center text-[10px] font-bold uppercase text-red-400 bg-red-500/10 border border-red-500/20 py-2 rounded-xl flex items-center justify-center gap-1">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  Scartato / Escluso
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
                </div>
                )}

                {activeScraperTab === 'scraper' && (
                  <div className="space-y-6 animate-fade-in">
                    {/* The NEW Scraper Panel */}
                    <div className="bg-[#111114] border border-slate-800 rounded-2xl p-6 space-y-6">
                      <div>
                        <h3 className="text-sm font-display font-bold text-white uppercase tracking-wider flex items-center gap-2">
                          <Globe className="w-4 h-4 text-indigo-400" />
                          Scraper Web Intelligente & Generatore di Embed Responsive
                        </h3>
                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                          Inserisci l'URL di un qualsiasi sito web (blog, sito di notizie, lista di video o canali).
                          L'algoritmo scaricherà l'HTML della pagina, ne estrarrà i link, ed utilizzerà l'intelligenza artificiale 
                          <strong> Gemini 3.5-flash</strong> per identificare i contenuti multimediali ideali, convertirli in player 
                          <code>iframe</code> responsive, catalogarli in rubriche ed associare la copertina di anteprima.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">URL del Sito da Scansionare</label>
                          <div className="relative">
                            <input
                              type="text"
                              value={scraperUrl}
                              onChange={e => setScraperUrl(e.target.value)}
                              placeholder="https://example.com/notizie-musica o canale-video..."
                              className="w-full bg-[#0A0A0B] border border-slate-800 rounded-xl pl-9 pr-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500 font-medium text-xs outline-none"
                              disabled={scraperLoading}
                            />
                            <Globe className="absolute left-3 top-3.5 w-4 h-4 text-slate-500" />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Rubrica Predefinita (Opzionale)</label>
                          <div className="relative">
                            <input
                              type="text"
                              value={scraperRubric}
                              onChange={e => setScraperRubric(e.target.value)}
                              placeholder="Es: Musica, Cinema, Tecnologia..."
                              className="w-full bg-[#0A0A0B] border border-slate-800 rounded-xl pl-9 pr-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500 font-medium text-xs outline-none"
                              disabled={scraperLoading}
                            />
                            <Bookmark className="absolute left-3 top-3.5 w-4 h-4 text-slate-500" />
                          </div>
                        </div>
                      </div>

                      <div>
                        <button
                          onClick={handleScrapeSite}
                          disabled={scraperLoading || !scraperUrl.trim()}
                          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold py-3.5 px-6 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 uppercase tracking-wider cursor-pointer"
                        >
                          {scraperLoading ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              Analisi e Scraping in corso con Gemini...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4" />
                              Estrai, Dividi in Rubriche & Crea Embed
                            </>
                          )}
                        </button>
                      </div>

                      {scraperLoading && (
                        <div className="p-8 border border-slate-800 bg-[#0A0A0B]/50 rounded-xl flex flex-col items-center justify-center text-center space-y-3">
                          <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
                          <div className="space-y-1">
                            <p className="text-xs font-bold text-white animate-pulse">Il motore di scraping è attivo</p>
                            <p className="text-[10px] text-slate-400">
                              L'IA sta estraendo l'albero HTML, filtrando le ancore e selezionando i link migliori da far diventare player responsive...
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2 justify-center pt-2 max-w-lg">
                            <span className="text-[9px] font-bold uppercase tracking-wider bg-slate-900 border border-slate-800 px-2 py-1 rounded text-slate-300 animate-pulse">1. Lettura Pagina Web</span>
                            <span className="text-[9px] font-bold uppercase tracking-wider bg-slate-900 border border-slate-800 px-2 py-1 rounded text-slate-300">2. Filtraggio Link</span>
                            <span className="text-[9px] font-bold uppercase tracking-wider bg-indigo-950/40 border border-indigo-900/30 px-2 py-1 rounded text-indigo-400 font-sans">3. Interpretazione Gemini</span>
                            <span className="text-[9px] font-bold uppercase tracking-wider bg-slate-950 border border-slate-900 px-2 py-1 rounded text-slate-600 font-sans">4. Creazione Embed Responsive</span>
                          </div>
                        </div>
                      )}

                      {scraperError && (
                        <div className="bg-red-950/20 border border-red-900/25 p-4 rounded-xl text-xs text-red-400 flex items-start gap-2.5">
                          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                          <div>
                            <strong className="font-bold block mb-1">Errore durante lo Scraping:</strong>
                            {scraperError}
                          </div>
                        </div>
                      )}

                      {scraperSuccessMessage && (
                        <div className="bg-green-950/20 border border-green-900/25 p-4 rounded-xl text-xs text-green-400 flex items-start gap-2.5">
                          <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                          <div>
                            <strong className="font-bold block mb-1">Scraping Completato con Successo!</strong>
                            {scraperSuccessMessage}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* RESULTS WORKSPACE */}
                    {scraperResults.length > 0 && (
                      <div className="bg-[#111114] border border-slate-800 rounded-2xl p-6 space-y-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                          <div>
                            <h4 className="text-sm font-display font-bold text-white uppercase tracking-wider">
                              Contenuti Rintracciati ({scraperResults.length})
                            </h4>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              Seleziona i link estratti dal sito, imposta la destinazione e importali come canali TV o rubriche.
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-2 bg-[#0A0A0B] border border-slate-800 px-3 py-1.5 rounded-xl">
                              <span className="text-[10px] font-bold text-slate-400 uppercase">Destinazione:</span>
                              <select
                                value={scrapeImportChannelId}
                                onChange={e => setScrapeImportChannelId(e.target.value)}
                                className="bg-transparent text-xs text-indigo-400 font-bold outline-none border-none cursor-pointer"
                              >
                                <option value="system" className="bg-[#111114] text-white">Rubriche Nazionali</option>
                                {channels.map(ch => (
                                  <option key={ch.id} value={ch.id} className="bg-[#111114] text-white">
                                    Canale: {ch.name}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <button
                              onClick={handleImportScrapedItems}
                              disabled={scrapeImportLoading || Object.values(selectedScrapeItems).filter(Boolean).length === 0}
                              className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-xs font-bold py-2.5 px-5 rounded-xl transition-all uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
                            >
                              {scrapeImportLoading ? (
                                <>
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  Importazione...
                                </>
                              ) : (
                                <>
                                  <Download className="w-3.5 h-3.5" />
                                  Importa Selezionati ({Object.values(selectedScrapeItems).filter(Boolean).length})
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Scraped items cards */}
                        <div className="space-y-4">
                          {scraperResults.map((item, index) => {
                            const isSelected = !!selectedScrapeItems[item.id];
                            return (
                              <React.Fragment key={item.id}>
                                <div
                                  className={`p-5 rounded-xl border transition-all text-left flex flex-col lg:flex-row justify-between gap-5 ${
                                    isSelected
                                      ? 'bg-indigo-950/10 border-indigo-500/30 shadow-indigo-950/20 shadow'
                                      : 'bg-[#0A0A0B]/40 border-slate-800/80'
                                  }`}
                                >
                                {/* Checkbox + Title / Thumb Info */}
                                <div className="flex gap-4 items-start flex-1">
                                  <div className="pt-1">
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={e => setSelectedScrapeItems({
                                        ...selectedScrapeItems,
                                        [item.id]: e.target.checked
                                      })}
                                      className="rounded border-slate-800 bg-[#0A0A0B] text-indigo-500 focus:ring-0 w-4 h-4 cursor-pointer"
                                    />
                                  </div>

                                  {/* Thumbnail representation extracted from URL context */}
                                  <div className="relative shrink-0 w-24 h-16 rounded-lg overflow-hidden border border-slate-800 bg-slate-900">
                                    <img
                                      src={item.logoUrl}
                                      alt={item.title}
                                      className="w-full h-full object-cover"
                                      referrerPolicy="no-referrer"
                                    />
                                    <div className="absolute bottom-1 right-1 bg-black/70 px-1 py-0.5 rounded text-[8px] font-mono font-bold text-slate-300">
                                      {item.durationMinutes} min
                                    </div>
                                    {item.isVertical && (
                                      <div className="absolute top-1 left-1 bg-indigo-600 px-1 py-0.5 rounded text-[7px] font-bold uppercase tracking-wider text-white">
                                        Verticale
                                      </div>
                                    )}
                                  </div>

                                  <div className="space-y-1.5 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="text-[9px] font-bold uppercase tracking-wider bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded">
                                        {item.sector}
                                      </span>
                                      <span className="text-[9px] font-mono text-slate-500 truncate max-w-xs block">
                                        {item.sourceUrl}
                                      </span>
                                    </div>

                                    {/* Editable Title */}
                                    <input
                                      type="text"
                                      value={item.title}
                                      onChange={e => {
                                        const updated = [...scraperResults];
                                        updated[index].title = e.target.value;
                                        setScraperResults(updated);
                                      }}
                                      className="block w-full bg-transparent text-xs font-bold text-white border-b border-transparent focus:border-slate-800 focus:outline-none pb-0.5"
                                    />
                                    <p className="text-[11px] text-slate-400 leading-relaxed mt-1">
                                      {item.description}
                                    </p>
                                  </div>
                                </div>

                                {/* Actions / Embed Preview */}
                                <div className="flex flex-col justify-between items-end gap-2 lg:w-72 border-t lg:border-t-0 border-slate-800/60 pt-3 lg:pt-0">
                                  <div className="w-full flex flex-col gap-1.5">
                                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Codice Embed Responsive (Generato)</div>
                                    <div className="font-mono text-[9px] text-slate-400 bg-[#050507] border border-slate-800 px-2.5 py-1.5 rounded-lg select-all overflow-x-auto whitespace-nowrap max-w-full font-sans">
                                      {item.iframeCode}
                                    </div>
                                  </div>

                                  <div className="w-full flex items-center justify-end gap-2 pt-2">
                                    <button
                                      onClick={() => {
                                        const updated = scraperResults.filter(r => r.id !== item.id);
                                        setScraperResults(updated);
                                        const updatedSelected = { ...selectedScrapeItems };
                                        delete updatedSelected[item.id];
                                        setSelectedScrapeItems(updatedSelected);
                                      }}
                                      className="text-[10px] font-bold text-red-400 hover:text-red-300 uppercase transition-all flex items-center gap-1 cursor-pointer mr-auto bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 hover:border-red-500/20 px-2 py-1.5 rounded-lg"
                                      title="Escludi questo contenuto dai risultati"
                                    >
                                      <Trash2 className="w-3 h-3" /> Escludi
                                    </button>

                                    <button
                                      onClick={() => {
                                        const win = window.open(item.sourceUrl, '_blank');
                                        if (win) win.focus();
                                      }}
                                      className="text-[10px] font-bold text-slate-400 hover:text-white uppercase transition-all flex items-center gap-1 cursor-pointer bg-[#0e0e12] border border-slate-800 hover:border-slate-700 px-2.5 py-1.5 rounded-lg"
                                    >
                                      Sorgente <ExternalLink className="w-3 h-3" />
                                    </button>

                                    {/* Inline responsive simulation player */}
                                    <button
                                      onClick={() => {
                                        const updated = [...scraperResults];
                                        updated[index].showPreview = !updated[index].showPreview;
                                        setScraperResults(updated);
                                      }}
                                      className="bg-[#0e0e12] border border-slate-800 hover:border-slate-700 text-indigo-400 hover:text-indigo-300 text-[10px] font-bold py-1.5 px-3 rounded-lg uppercase tracking-wide transition-all cursor-pointer"
                                    >
                                      {item.showPreview ? 'Chiudi Anteprima' : 'Testa Player Responsive'}
                                    </button>
                                  </div>
                                </div>
                              </div>

                              {/* Simulated Iframe / Player Drawer */}
                              {item.showPreview && (
                                <div key={`preview-${item.id}`} className="bg-[#050507] border border-slate-800 p-4 rounded-xl space-y-2 text-left animate-fade-in">
                                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                                    <span className="font-mono uppercase tracking-wider">Player Embed Responsive Integrato</span>
                                    <span>Rapporto d'aspetto autoadattivo</span>
                                  </div>
                                  <div 
                                    className={`relative mx-auto bg-black border border-slate-800 rounded-lg overflow-hidden flex items-center justify-center ${
                                      item.isVertical ? 'aspect-[9/16] w-64' : 'aspect-video w-full'
                                    }`}
                                    dangerouslySetInnerHTML={{ __html: item.iframeCode }}
                                  />
                                </div>
                              )}
                              </React.Fragment>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* VIEW 5: USER / COLLABORATOR BACKOFFICE (CMS & PALINSESTO) */}
        {currentPath === '/backoffice' && (user?.role === 'tv_owner' || user?.role === 'collaborator') && (
          <div className="space-y-8 animate-fade-in text-left">
            
            {ownerChannel ? (
              <div>
                {/* Backoffice Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#111114] border border-slate-800 rounded-2xl p-5 mb-8">
                  <div className="flex items-center gap-4">
                    <img src={ownerChannel.logoUrl} alt={ownerChannel.name} className="w-14 h-14 rounded-xl object-cover border border-slate-800 shrink-0" />
                    <div>
                      <div className="flex items-center gap-2">
                        <h1 className="text-lg font-display font-bold text-white uppercase">{ownerChannel.name}</h1>
                        <span className="text-[10px] bg-indigo-500/10 border border-indigo-500/25 text-indigo-400 px-2 py-0.5 rounded">
                          Abbonato (Abbonamento: €{ownerChannel.monthlyFee}/mese)
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">SaaS TV Console • Gestisci rubriche, contenuti ed integrazioni</p>
                    </div>
                  </div>

                  <button 
                    onClick={() => window.open(`/tv/${ownerChannel.slug}`, '_blank')}
                    className="flex items-center gap-1 bg-[#0E0E12] border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-xs font-bold px-4 py-2 rounded-xl transition-all uppercase"
                  >
                    Vedi Pagina Pubblica
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Test Player Monitor for Backoffice */}
                {nowPlaying && (
                  <div id="channel-player-section" className="bg-[#111114] border border-indigo-500/30 shadow-indigo-950/40 shadow-lg rounded-2xl p-5 mb-8 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="flex h-2 w-2 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                        </span>
                        <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Test Player Monitor • Simulatore Canale</h3>
                      </div>
                      <button
                        onClick={() => setNowPlaying(null)}
                        className="text-[10px] text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-2.5 py-1.5 rounded-lg border border-red-500/20 hover:border-red-500/30 uppercase font-bold transition-all cursor-pointer animate-fade-in"
                      >
                        Spegni Monitor ✕
                      </button>
                    </div>
                    
                    <ChannelPlayer 
                      content={nowPlaying.content} 
                      channelName={ownerChannel.name}
                    />

                    <div className="bg-[#0A0A0B] border border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left">
                      <div>
                        <span className="text-[9px] uppercase font-bold tracking-wider text-indigo-400 block mb-0.5">Stato Programma in Riproduzione:</span>
                        <h4 className="text-xs font-bold text-white uppercase">{nowPlaying.content?.title || "Video Senza Titolo"}</h4>
                        <p className="text-[10px] text-slate-400 mt-1 leading-relaxed max-w-xl">{nowPlaying.content?.description || "Nessuna descrizione."}</p>
                      </div>
                      {nowPlaying.schedule && (
                        <div className="bg-[#111114] border border-slate-800 rounded-lg p-2 text-center shrink-0 min-w-[120px]">
                          <span className="text-[9px] font-mono uppercase text-slate-500 block">Fascia Oraria</span>
                          <span className="text-xs font-mono font-bold text-white mt-0.5 block">{nowPlaying.schedule.startTime} - {nowPlaying.schedule.endTime}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Backoffice navigation tabs */}
                <div className="flex overflow-x-auto gap-2 border-b border-slate-800 pb-px mb-8">
                  {(user?.role !== 'collaborator' || ['editor', 'scheduler', 'journalist', 'speaker', 'moderator'].includes(user.collaboratorRole || '')) && (
                    <button 
                      onClick={() => setActiveBackofficeTab('contents')}
                      className={`pb-2 px-4 text-xs font-bold border-b-2 whitespace-nowrap transition-all uppercase tracking-wider ${
                        activeBackofficeTab === 'contents' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Gestione Contenuti ({selectedChannelContents.length})
                    </button>
                  )}
                  {(user?.role !== 'collaborator' || user.collaboratorRole === 'scheduler') && (
                    <button 
                      onClick={() => setActiveBackofficeTab('schedule')}
                      className={`pb-2 px-4 text-xs font-bold border-b-2 whitespace-nowrap transition-all uppercase tracking-wider ${
                        activeBackofficeTab === 'schedule' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Pianificatore Palinsesto
                    </button>
                  )}
                  {(user?.role !== 'collaborator' || ['editor', 'moderator'].includes(user.collaboratorRole || '')) && (
                    <button 
                      onClick={() => setActiveBackofficeTab('categories')}
                      className={`pb-2 px-4 text-xs font-bold border-b-2 whitespace-nowrap transition-all uppercase tracking-wider ${
                        activeBackofficeTab === 'categories' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Categorie & Condivisione
                    </button>
                  )}
                  {user?.role === 'tv_owner' && (
                    <>
                      <button 
                        onClick={() => setActiveBackofficeTab('collaborators')}
                        className={`pb-2 px-4 text-xs font-bold border-b-2 whitespace-nowrap transition-all uppercase tracking-wider ${
                          activeBackofficeTab === 'collaborators' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Collaboratori ({selectedChannelCollaborators.length})
                      </button>
                      <button 
                        onClick={() => setActiveBackofficeTab('embed')}
                        className={`pb-2 px-4 text-xs font-bold border-b-2 whitespace-nowrap transition-all uppercase tracking-wider ${
                          activeBackofficeTab === 'embed' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Widget Embed & API
                      </button>
                      <button 
                        onClick={() => setActiveBackofficeTab('details')}
                        className={`pb-2 px-4 text-xs font-bold border-b-2 whitespace-nowrap transition-all uppercase tracking-wider ${
                          activeBackofficeTab === 'details' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Configurazione Canale
                      </button>
                    </>
                  )}
                </div>

                {/* TAB: CONTENTS MANAGER */}
                {activeBackofficeTab === 'contents' && (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Form to add content */}
                    <div className="bg-[#111114] border border-slate-800 rounded-2xl p-5 h-fit">
                      <div className="flex items-center gap-2 mb-4">
                        <Video className="w-4 h-4 text-indigo-500" />
                        <h3 className="text-sm font-bold text-white uppercase tracking-tight">Carica Nuovo Video</h3>
                      </div>

                      <form onSubmit={handleCreateContent} className="space-y-4 text-xs">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Titolo Video</label>
                          <input 
                            type="text" required placeholder="es. Intervista Talk Show #1"
                            value={newContentTitle} onChange={e => setNewContentTitle(e.target.value)}
                            className="w-full bg-[#0A0A0B] border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Descrizione</label>
                          <textarea 
                            rows={2} placeholder="Fornisci una sintetica presentazione del programma..."
                            value={newContentDesc} onChange={e => setNewContentDesc(e.target.value)}
                            className="w-full bg-[#0A0A0B] border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Tipo Sorgente</label>
                            <select 
                              value={newContentSourceType} onChange={e => setNewContentSourceType(e.target.value as any)}
                              className="w-full bg-[#0A0A0B] border border-slate-800 rounded-lg px-2.5 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                            >
                              <option value="youtube">YouTube / Shorts</option>
                              <option value="vimeo">Vimeo</option>
                              <option value="facebook">Facebook Video</option>
                              <option value="twitch">Twitch Stream / Video</option>
                              <option value="spotify">Spotify (Brani / Playlist)</option>
                              <option value="soundcloud">SoundCloud (Audio / Mus)</option>
                              <option value="tiktok">TikTok Video</option>
                              <option value="audio">Audio / Podcast Diretto</option>
                              <option value="iframe">Iframe Libero / Altro</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Categoria</label>
                            <select 
                              value={newContentCatId} onChange={e => setNewContentCatId(e.target.value)}
                              className="w-full bg-[#0A0A0B] border border-slate-800 rounded-lg px-2.5 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                            >
                              <option value="">-- Nessuna --</option>
                              {selectedChannelCategories.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Codice Iframe, URL Video o Link Condivisione</label>
                          <input 
                            type="text" required placeholder="Incolla un codice <iframe> completo o un link es. https://www.youtube.com/watch?v=..."
                            value={newContentUrl} onChange={e => setNewContentUrl(e.target.value)}
                            className="w-full bg-[#0A0A0B] border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 text-xs"
                          />
                          <p className="text-[9px] text-slate-500 mt-1">Puoi incollare qualsiasi codice &lt;iframe&gt; completo o link web (YouTube, Vimeo, ecc.).</p>
                        </div>

                        <div className="grid grid-cols-2 gap-3 items-center">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Durata (Minuti)</label>
                            <input 
                              type="number" required
                              value={newContentDuration} onChange={e => setNewContentDuration(e.target.value)}
                              className="w-full bg-[#0A0A0B] border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 text-center"
                            />
                          </div>

                          <div className="pt-4 select-none">
                            <label className="flex items-center gap-2 cursor-pointer text-[11px] font-bold text-slate-300">
                              <input 
                                type="checkbox"
                                checked={newContentIsVertical} onChange={e => setNewContentIsVertical(e.target.checked)}
                                className="w-4 h-4 rounded bg-[#0A0A0B] border-slate-800 text-indigo-600 focus:ring-0 focus:ring-offset-0"
                              />
                              Vertical Shorts?
                            </label>
                          </div>
                        </div>

                        {contentError && (
                          <div className="bg-red-500/10 border border-red-500/25 text-red-400 p-3 rounded-xl text-[11px] leading-relaxed text-left">
                            {contentError}
                          </div>
                        )}

                        <button 
                          type="submit"
                          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2.5 rounded-xl transition-all shadow-md mt-2 uppercase tracking-wider"
                        >
                          Salva Contenuto
                        </button>
                      </form>
                    </div>

                    {/* Content List Table */}
                    <div className="lg:col-span-2 bg-[#111114] border border-slate-800 rounded-2xl p-5 space-y-4">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Libreria Multimediale del Canale</h3>
                      
                      {selectedChannelContents.length === 0 ? (
                        <p className="text-slate-500 text-xs py-8 text-center">Nessun video caricato. Utilizza il modulo a sinistra.</p>
                      ) : (
                        <div className="space-y-3">
                          {selectedChannelContents.map(co => (
                            <div key={co.id} className="bg-[#0E0E12] border border-slate-800 rounded-xl p-4 flex items-center justify-between gap-4">
                              <div className="text-left">
                                <h4 className="text-xs font-bold text-white">{co.title}</h4>
                                <div className="flex items-center gap-2.5 mt-1">
                                  <span className="text-[10px] font-mono text-slate-500 uppercase">{co.sourceType}</span>
                                  <span className="text-[10px] text-slate-500">Durata: {co.durationMinutes}m</span>
                                  {co.isVertical && (
                                    <span className="text-[9px] font-bold text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
                                      Vertical
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  onClick={() => {
                                    setNowPlaying({
                                      content: co,
                                      schedule: null,
                                      fallbackUsed: false
                                    });
                                    setTimeout(() => {
                                      const playerEl = document.getElementById('channel-player-section');
                                      if (playerEl) {
                                        playerEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                      }
                                    }, 100);
                                  }}
                                  className="flex items-center gap-1 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 hover:text-indigo-300 text-[10px] font-bold px-3 py-1.5 rounded-lg border border-indigo-500/15 hover:border-indigo-500/30 transition-all uppercase tracking-wider cursor-pointer"
                                  title="Testa questo video nel monitor di anteprima"
                                >
                                  Test Player ▶
                                </button>
                                <button 
                                  onClick={() => handleDeleteContent(co.id)}
                                  className="p-2 bg-[#111114] hover:bg-red-500/20 hover:text-red-400 text-slate-500 border border-slate-800 hover:border-red-500/30 rounded-lg transition-all"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* TAB: PLANNER/PALINSESTO */}
                {activeBackofficeTab === 'schedule' && (
                  <div className="space-y-6">
                    {scheduleSuccessMsg && (
                      <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-xl text-xs font-medium flex items-start gap-2.5">
                        <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                          <p className="font-bold text-white mb-0.5">Operazione Completata con Successo</p>
                          <p className="text-[11px] text-slate-300 leading-relaxed">{scheduleSuccessMsg}</p>
                          <button onClick={() => setScheduleSuccessMsg(null)} className="mt-2 text-[10px] font-bold text-emerald-300 hover:text-emerald-200 uppercase tracking-wider underline cursor-pointer">Nascondi messaggio</button>
                        </div>
                      </div>
                    )}

                    <div className="bg-indigo-950/20 border border-indigo-800/30 rounded-2xl p-5 flex flex-col md:flex-row items-center justify-between gap-5">
                      <div className="text-left space-y-1">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 uppercase tracking-wide">
                          Automazione Canale
                        </span>
                        <h4 className="text-xs font-bold text-white uppercase tracking-tight">Palinsesto Nazionale Automatico (24 Ore / 7 Giorni)</h4>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          Attiva o ripristina all\'istante una programmazione oraria pre-compilata coprente 24h su 7 giorni. Il sistema popolerà le rubriche nazionali (News, Meteo, Film completi senza copyright, Cucina, Viaggi, ecc.) ruotandoli in automatico per evitare duplicati seriali e garantendo un flusso continuo!
                        </p>
                      </div>
                      <button
                        onClick={handleResetToNational24h}
                        disabled={isResettingSchedules}
                        className="shrink-0 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-[11px] px-4 py-2.5 rounded-xl transition-all shadow-md uppercase tracking-wider flex items-center gap-2 cursor-pointer"
                      >
                        {isResettingSchedules ? (
                          <>
                            <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Attivazione...
                          </>
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            Attiva Palinsesto 24h
                          </>
                        )}
                      </button>
                    </div>

                    <ScheduleGrid 
                      schedules={selectedChannelSchedules}
                      contents={selectedChannelContents}
                      isEditable={true}
                      onAddSchedule={handleAddSchedule}
                      onDeleteSchedule={handleDeleteSchedule}
                      onUpdateSchedule={handleUpdateSchedule}
                      isAdminOrOwner={user?.role === 'admin' || user?.role === 'tv_owner' || (user?.role === 'collaborator' && user.collaboratorRole === 'scheduler')}
                      onPreviewSchedule={handlePreviewSchedule}
                    />
                  </div>
                )}

                {/* TAB: CATEGORIES & SYNDICATION */}
                {activeBackofficeTab === 'categories' && (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Add Category */}
                    <div className="bg-[#111114] border border-slate-800 rounded-2xl p-5 h-fit">
                      <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-tight">Crea Categoria / Rubrica</h3>
                      
                      <form onSubmit={handleCreateCategory} className="space-y-4 text-xs">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nome Rubrica</label>
                          <input 
                            type="text" required placeholder="es. Cucina Tradizionale"
                            value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)}
                            className="w-full bg-[#0A0A0B] border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                          />
                        </div>

                        <div className="pt-2 select-none">
                          <label className="flex items-start gap-2.5 cursor-pointer text-slate-300">
                            <input 
                              type="checkbox"
                              checked={newCategorySyndicated} onChange={e => setNewCategorySyndicated(e.target.checked)}
                              className="w-4 h-4 rounded bg-[#0A0A0B] border-slate-800 text-indigo-600 focus:ring-0 focus:ring-offset-0 mt-0.5 shrink-0"
                            />
                            <div>
                              <span className="block text-[11px] font-bold">Sindacazione Nazionale</span>
                              <span className="block text-[10px] text-slate-500 mt-0.5">Se attiva, questa rubrica diventerà pubblica ed importabile da altre TV nazionali affiliate.</span>
                            </div>
                          </label>
                        </div>

                        <button 
                          type="submit"
                          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2.5 rounded-xl transition-all shadow-md mt-2 uppercase tracking-wider"
                        >
                          Crea Categoria
                        </button>
                      </form>
                    </div>

                    {/* Category List */}
                    <div className="lg:col-span-2 bg-[#111114] border border-slate-800 rounded-2xl p-5 space-y-4">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Rubriche Attive</h3>

                      {selectedChannelCategories.length === 0 ? (
                        <p className="text-slate-500 text-xs py-8 text-center">Nessuna categoria creata.</p>
                      ) : (
                        <div className="space-y-3">
                          {selectedChannelCategories.map(cat => (
                            <div key={cat.id} className="bg-[#0E0E12] border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                              <div className="text-left">
                                <h4 className="text-xs font-bold text-white">{cat.name}</h4>
                                <div className="flex items-center gap-2 mt-1">
                                  {cat.isSyndicated ? (
                                    <span className="text-[9px] font-bold text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20 uppercase">
                                      Rubrica Nazionale Condivisa
                                    </span>
                                  ) : (
                                    <span className="text-[9px] font-bold text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded">
                                      Privata Canale
                                    </span>
                                  )}
                                </div>
                              </div>

                              <button 
                                onClick={() => handleDeleteCategory(cat.id)}
                                className="p-2 bg-[#111114] hover:bg-red-500/20 hover:text-red-400 text-slate-500 border border-slate-800 hover:border-red-500/30 rounded-lg transition-all"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Syndicated rubrics of others that I can import! */}
                      <div className="border-t border-slate-800 pt-6 mt-6">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-3">Seleziona e Importa Rubriche Nazionali</h4>
                        
                        {nationalSyndications.filter(it => it.category.tvChannelId !== ownerChannel.id).length === 0 ? (
                          <p className="text-slate-500 text-[11px]">Nessun programma nazionale disponibile per l'importazione.</p>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {nationalSyndications
                              .filter(it => it.category.tvChannelId !== ownerChannel.id)
                              .map((item, idx) => (
                                <div key={idx} className="bg-[#0E0E12] border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
                                  <div className="text-left">
                                    <span className="text-[10px] font-mono text-slate-500 block mb-1">Fornito da: {item.sourceChannelName}</span>
                                    <h5 className="text-xs font-bold text-white">{item.category.name}</h5>
                                    <p className="text-[10px] text-slate-400 mt-1">Contiene {item.contentsCount} video legali.</p>
                                  </div>
                                  <button
                                    onClick={() => handleImportNationalRubric(item.category.id)}
                                    className="mt-3 bg-indigo-600/10 hover:bg-indigo-600/25 text-indigo-400 border border-indigo-500/20 text-[10px] font-bold py-1.5 rounded-lg transition-all uppercase tracking-wider"
                                  >
                                    Importa Rubrica Nazionale
                                  </button>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB: COLLABORATORS */}
                {activeBackofficeTab === 'collaborators' && (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Add Collaborator */}
                    <div className="bg-[#111114] border border-slate-800 rounded-2xl p-5 h-fit">
                      <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-tight">Crea Collaboratore</h3>
                      
                      <form onSubmit={handleCreateCollaborator} className="space-y-4 text-xs">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">E-mail del Collaboratore</label>
                          <input 
                            type="email" required placeholder="collaboratore@email.com"
                            value={newCollabEmail} onChange={e => setNewCollabEmail(e.target.value)}
                            className="w-full bg-[#0A0A0B] border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Permessi / Ruolo</label>
                          <select 
                            value={newCollabRole} onChange={e => setNewCollabRole(e.target.value as any)}
                            className="w-full bg-[#0A0A0B] border border-slate-800 rounded-lg px-2.5 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                          >
                            <option value="editor">Editor (Inserimento video)</option>
                            <option value="scheduler">Scheduler (Gestione palinsesto)</option>
                            <option value="moderator">Moderator (Gestione categorie)</option>
                            <option value="journalist">Journalist (Editoria & Notizie)</option>
                            <option value="speaker">Speaker (Podcast & Audio)</option>
                          </select>
                        </div>

                        <button 
                          type="submit"
                          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2.5 rounded-xl transition-all shadow-md mt-2 uppercase tracking-wider"
                        >
                          Aggiungi Collaboratore
                        </button>
                      </form>
                    </div>

                    {/* Collaborator List */}
                    <div className="lg:col-span-2 bg-[#111114] border border-slate-800 rounded-2xl p-5 space-y-4">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Staff di Gestione</h3>

                      {selectedChannelCollaborators.length === 0 ? (
                        <p className="text-slate-500 text-xs py-8 text-center">Nessun collaboratore aggiunto.</p>
                      ) : (
                        <div className="space-y-3">
                          {selectedChannelCollaborators.map(c => (
                            <div key={c.id} className="bg-[#0E0E12] border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                              <div className="text-left">
                                <h4 className="text-xs font-bold text-white">{c.email}</h4>
                                <span className="text-[10px] font-mono text-indigo-400 font-bold bg-indigo-500/10 px-2.5 py-0.5 rounded border border-indigo-500/20 uppercase mt-1 inline-block">
                                  {c.role}
                                </span>
                              </div>

                              <button 
                                onClick={() => handleDeleteCollaborator(c.id)}
                                className="p-2 bg-[#111114] hover:bg-red-500/20 hover:text-red-400 text-slate-500 border border-slate-800 hover:border-red-500/30 rounded-lg transition-all"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* TAB: YOUTUBE SCAN & MANUAL SEARCH */}
                {activeBackofficeTab === 'youtube-scan' && (
                  <div className="space-y-8">
                    {/* Header Card */}
                    <div className="bg-gradient-to-r from-red-950/20 to-indigo-950/20 border border-slate-800 rounded-2xl p-6">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 text-left">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-red-500 animate-pulse" />
                            <h3 className="text-base font-extrabold text-white uppercase tracking-tight">Modulo Content Discovery & YouTube Scan</h3>
                          </div>
                          <p className="text-xs text-slate-400">
                            Scansiona il web o cerca nell'indice per caricare e strutturare automaticamente palinsesti di alta qualità in lingua italiana.
                          </p>
                        </div>
                        
                        <div className="shrink-0">
                          <button
                            onClick={handleYtScanAuto}
                            disabled={ytScanLoading}
                            className={`w-full md:w-auto flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
                              ytScanLoading 
                                ? 'bg-indigo-950 border border-indigo-800/50 text-indigo-400' 
                                : 'bg-red-600 hover:bg-red-700 text-white border border-red-500 shadow-md shadow-red-950/40'
                            }`}
                          >
                            {ytScanLoading ? (
                              <>
                                <span className="animate-spin inline-block h-3.5 w-3.5 border-2 border-t-transparent border-indigo-400 rounded-full animate-pulse"></span>
                                Scansione in corso...
                              </>
                            ) : (
                              <>
                                <Sliders className="w-4 h-4" />
                                Avvia Scansione Automatica ⚡
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {ytScanMessage && (
                        <div className="mt-4 p-3 bg-indigo-950/50 border border-indigo-800/40 text-indigo-300 rounded-xl text-xs text-left font-medium animate-pulse">
                          {ytScanMessage}
                        </div>
                      )}
                    </div>

                    {/* Explanatory Banner */}
                    <div className="bg-[#111114] border border-slate-800 rounded-xl p-4 text-xs text-left text-slate-400 leading-relaxed flex items-start gap-3">
                      <span className="text-lg leading-none">💡</span>
                      <div>
                        <strong>Come funziona?</strong> Cliccando su <strong className="text-white">"Avvia Scansione Automatica"</strong>, l'algoritmo analizza il titolo e la descrizione della tua emittente per identificare il tuo settore (es: <em>Cucina, Musica, Viaggi</em>). Quindi seleziona dall'indice i migliori video di YouTube in lingua italiana e li importa nel tuo canale, rigenerando un palinsesto completo h24 per garantirti streaming continuo.
                      </div>
                    </div>

                    {/* NEW SECTION: GEMINI LIVE SEARCH & OEMBED VERIFICATION */}
                    <div className="bg-[#111114] border border-slate-800 rounded-2xl p-6 space-y-6">
                      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                        <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider text-left">
                          Scansione Live per Argomenti con Verifica Reale (Gemini AI)
                        </h4>
                      </div>

                      <div className="text-xs text-slate-400 text-left space-y-2 leading-relaxed">
                        <p>
                          Inserisci un argomento o rubrica (es: <strong className="text-slate-300">"Meteo Nazionale"</strong>, <strong className="text-slate-300">"Cinema Cult Italiano"</strong>, <strong className="text-slate-300">"Ricette Siciliane"</strong>). 
                          Gemini cercherà video reali su YouTube tramite Google Search Grounding.
                        </p>
                        <p className="text-slate-500">
                          Ogni video sarà verificato in tempo reale: 1) Se esiste, 2) Se ha restrizioni di copyright, 3) Se permette l'incorporamento (embed). 
                          I video idonei formeranno una <strong>Rubrica Nazionale</strong> e verranno inseriti automaticamente nel palinsesto.
                        </p>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-3">
                        <input
                          type="text"
                          value={liveScanTopic}
                          onChange={(e) => setLiveScanTopic(e.target.value)}
                          placeholder="Scrivi l'argomento (es. Cucina Toscana, Focus Lofi, Notizie del Giorno)..."
                          className="flex-1 bg-[#0A0A0B] border border-slate-800 focus:border-amber-500/50 hover:border-slate-750 text-white rounded-xl py-3 px-4 text-xs outline-none transition-all"
                          disabled={liveScanLoading}
                        />
                        <button
                          onClick={handleTriggerLiveScan}
                          disabled={liveScanLoading}
                          className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-extrabold text-xs uppercase tracking-wider transition-all cursor-pointer shrink-0 ${
                            liveScanLoading
                              ? 'bg-amber-950/40 border border-amber-900/30 text-amber-500 cursor-not-allowed'
                              : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 shadow-md shadow-amber-500/10 font-black'
                          }`}
                        >
                          {liveScanLoading ? (
                            <>
                              <span className="animate-spin inline-block h-3.5 w-3.5 border-2 border-t-transparent border-amber-500 rounded-full"></span>
                              Scansione & Verifica...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5 text-slate-950" />
                              Scansiona & Verifica ⚡
                            </>
                          )}
                        </button>
                      </div>

                      {/* Status / Loading details */}
                      {liveScanLoading && (
                        <div className="space-y-2 py-4 px-5 bg-amber-950/10 border border-amber-500/20 rounded-xl text-xs text-left text-amber-400">
                          <p className="font-bold flex items-center gap-2">
                            <span className="animate-pulse">🔄</span> In esecuzione...
                          </p>
                          <ul className="list-disc pl-4 space-y-1 text-slate-400 font-medium">
                            <li>Gemini sta eseguendo una ricerca intelligente su YouTube per "{liveScanTopic}"...</li>
                            <li>Estrazione degli indirizzi video reali...</li>
                            <li>Interrogazione di YouTube oEmbed per verificare disponibilità e permessi di condivisione...</li>
                            <li>Esclusione dei video rimossi o protetti da copyright con embed disattivato...</li>
                          </ul>
                        </div>
                      )}

                      {/* Success message / feedback */}
                      {liveScanMessage && !liveScanLoading && (
                        <div className="p-4 bg-emerald-950/20 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs text-left font-medium">
                          ✨ {liveScanMessage}
                        </div>
                      )}

                      {liveScanError && (
                        <div className="p-4 bg-red-950/20 border border-red-500/30 text-red-400 rounded-xl text-xs text-left font-medium">
                          ⚠️ Errore: {liveScanError}
                        </div>
                      )}

                      {/* Results list */}
                      {liveScanResults.length > 0 && (
                        <div className="space-y-4">
                          <h5 className="text-[11px] font-bold text-slate-300 uppercase tracking-wider text-left">
                            Risultati dell'Analisi di YouTube per "{liveScanTopic}"
                          </h5>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {liveScanResults.map((item, idx) => (
                              <div 
                                key={idx} 
                                className={`p-4 rounded-xl border text-left flex flex-col justify-between gap-3 ${
                                  item.isValid 
                                    ? 'bg-emerald-950/10 border-emerald-500/20 hover:border-emerald-500/40' 
                                    : 'bg-red-950/10 border-red-500/25 opacity-75'
                                }`}
                              >
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase ${
                                      item.isValid 
                                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                                        : 'bg-red-500/10 text-red-400 border-red-500/20'
                                    }`}>
                                      {item.isValid ? '✓ Verificato & Idoneo' : '✗ Non Idoneo'}
                                    </span>
                                    <span className="text-[10px] font-mono text-slate-500">
                                      ⏱ {item.durationMinutes} min
                                    </span>
                                  </div>

                                  <h6 className="text-xs font-bold text-slate-200 line-clamp-2 leading-tight">
                                    {item.title}
                                  </h6>

                                  <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed">
                                    {item.description}
                                  </p>
                                </div>

                                <div className="pt-2 border-t border-slate-800/40 flex items-center justify-between gap-4">
                                  <a 
                                    href={item.sourceUrl} 
                                    target="_blank" 
                                    rel="noreferrer" 
                                    className="text-[10px] text-indigo-400 hover:underline font-medium truncate"
                                  >
                                    Vedi su YouTube ↗
                                  </a>
                                  
                                  <span className={`text-[10px] font-medium ${
                                    item.isValid ? 'text-emerald-400' : 'text-red-400'
                                  }`}>
                                    {item.isValid ? 'Embed Abilitato' : 'Embed Disattivato / Copyright'}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Manual Search Section */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider text-left">Cerca ed Importa da YouTube manualmente</h4>
                        <span className="text-[10px] font-mono text-slate-500">Pronto per l'importazione immediata in un clic</span>
                      </div>

                      <form 
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleYtSearch();
                        }}
                        className="flex gap-2"
                      >
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                          <input 
                            type="text"
                            value={ytSearchQuery}
                            onChange={(e) => setYtSearchQuery(e.target.value)}
                            placeholder="Cerca per parole chiave (es: Carbonara, Canzoni, Firenze, Notizie)..."
                            className="w-full bg-[#111114] border border-slate-800 focus:border-slate-700 hover:border-slate-750 text-white rounded-xl py-2.5 pl-10 pr-4 text-xs outline-none transition-colors"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={ytSearchLoading}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white border border-indigo-500 px-5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shrink-0 cursor-pointer flex items-center gap-1.5"
                        >
                          {ytSearchLoading ? 'Cerca...' : 'Cerca'}
                        </button>
                      </form>

                      {/* Quick Tags */}
                      <div className="flex flex-wrap gap-1.5 text-left">
                        {['Cinema Italiano', 'Cucina Italiana', 'Viaggi in Italia', 'Musica Italiana', 'Sport Italiani', 'Tecnologia', 'Intrattenimento', 'News Italiane'].map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => {
                              setYtSearchQuery(tag);
                              handleYtSearch(tag);
                            }}
                            className="bg-slate-900/60 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all uppercase cursor-pointer"
                          >
                            {tag}
                          </button>
                        ))}
                      </div>

                      {/* Results Grid */}
                      {ytSearchLoading ? (
                        <div className="bg-[#111114] border border-slate-800 rounded-2xl p-12 text-center text-slate-500 text-xs">
                          <span className="animate-spin inline-block h-5 w-5 border-2 border-t-transparent border-indigo-500 rounded-full mb-3"></span>
                          <p>Ricerca in corso tra gli indici di YouTube...</p>
                        </div>
                      ) : ytSearchResults.length === 0 ? (
                        <div className="bg-[#111114] border border-slate-800 rounded-2xl p-12 text-center text-slate-500 text-xs">
                          Nessun video trovato. Prova con una parola chiave diversa o clicca su uno dei tag qui sopra.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-left">
                          {ytSearchResults.map((video) => {
                            const isAlreadyInChannel = selectedChannelContents.some(
                              c => c.sourceUrl === video.sourceUrl
                            );
                            
                            return (
                              <div key={video.id} className="bg-[#111114] border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between gap-4 hover:border-slate-700 transition-all">
                                <div className="space-y-2">
                                  <div className="flex items-start justify-between gap-2">
                                    <span className="text-[9px] font-bold bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded uppercase border border-indigo-500/15">
                                      {video.sector}
                                    </span>
                                    <span className="text-[10px] font-mono text-slate-500">
                                      ⏱ {video.durationMinutes} min
                                    </span>
                                  </div>

                                  <h5 className="text-xs font-bold text-slate-200 uppercase line-clamp-2 leading-snug">
                                    {video.title}
                                  </h5>

                                  <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed">
                                    {video.description || 'Nessuna descrizione.'}
                                  </p>
                                </div>

                                <div className="border-t border-slate-800/40 pt-3">
                                  <button
                                    onClick={() => handleYtImport(video)}
                                    disabled={isAlreadyInChannel}
                                    className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all uppercase cursor-pointer ${
                                      isAlreadyInChannel
                                        ? 'bg-slate-900 border border-slate-800/60 text-slate-600 cursor-not-allowed'
                                        : 'bg-indigo-600 hover:bg-indigo-700 text-white border border-indigo-500'
                                    }`}
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                    {isAlreadyInChannel ? 'Già Importato' : 'Importa nel Canale'}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* TAB: EMBED WIZARDS & SECURE API CONFIG */}
                {activeBackofficeTab === 'national-rubrics' && (
                  <div className="space-y-6">
                    <div className="bg-[#111114] border border-slate-800 rounded-2xl p-5">
                      <div className="flex items-center gap-3 mb-3 text-left">
                        <Radio className="w-6 h-6 text-indigo-500 animate-pulse" />
                        <div>
                          <h3 className="text-sm font-bold text-white uppercase tracking-tight">Rubriche Nazionali della Piattaforma</h3>
                          <p className="text-xs text-slate-400 mt-0.5">Importa rubriche auto-gestite, popolate in tempo reale dall'algoritmo di Content Discovery.</p>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed text-left border-t border-slate-800 pt-3">
                        Abilitando una rubrica nazionale, la categoria e l'intero parco video approvato verranno clonati nel tuo backoffice. Potrai così pianificarli nelle tue fasce orarie settimanali, alternandoli o mescolandoli con i tuoi programmi e video caricati localmente.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                      {nationalSyndications.length === 0 ? (
                        <div className="bg-[#111114] border border-slate-800 rounded-2xl p-8 text-center col-span-2 text-slate-500 text-xs">
                          Nessuna rubrica nazionale disponibile al momento. L'amministratore deve approvare le prime auto-rilevazioni.
                        </div>
                      ) : (
                        nationalSyndications.map(syn => {
                          const isAlreadyImported = selectedChannelCategories.some(
                            c => c.slug === syn.category.slug && c.tvChannelId === ownerChannel.id
                          );
                          
                          return (
                            <div key={syn.category.id} className="bg-[#111114] border border-slate-800 rounded-2xl p-5 flex flex-col justify-between gap-4">
                              <div className="space-y-3">
                                <div className="flex items-start justify-between">
                                  <div>
                                    <h4 className="text-xs font-bold text-white uppercase tracking-tight">{syn.category.name}</h4>
                                    <span className="text-[9px] text-indigo-400 font-mono font-bold bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5 rounded mt-1.5 inline-block uppercase">
                                      Canale Nazionale • Alimentazione Autonoma
                                    </span>
                                  </div>

                                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase ${
                                    isAlreadyImported 
                                      ? 'bg-green-500/10 text-green-400 border border-green-500/25' 
                                      : 'bg-slate-800/50 text-slate-500 border border-slate-700/50'
                                  }`}>
                                    {isAlreadyImported ? 'Abilitata' : 'Disponibile'}
                                  </span>
                                </div>

                                <p className="text-xs text-slate-400 leading-relaxed">
                                  La rubrica contiene attualmente <strong className="text-white">{syn.contentsCount} video</strong> di alta qualità in lingua italiana, verificati contro il copyright ed embed-friendly.
                                </p>

                                {/* List of video previews inside the rubrica */}
                                <div className="space-y-1.5 bg-[#0A0A0B] border border-slate-850 p-2.5 rounded-xl max-h-36 overflow-y-auto">
                                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Anteprima Palinsesto Nazionale:</span>
                                  {syn.contents?.length === 0 ? (
                                    <p className="text-[10px] text-slate-600 font-mono italic">Nessun video inserito.</p>
                                  ) : (
                                    syn.contents.map((co: any) => (
                                      <div key={co.id} className="text-[10px] text-slate-400 border-b border-slate-900 pb-1.5 last:border-0 last:pb-0 pt-1.5 first:pt-0">
                                        <div className="flex items-center justify-between text-slate-300 font-medium font-mono gap-2">
                                          <span className="truncate max-w-[150px]">{co.title}</span>
                                          <div className="flex items-center gap-1.5 shrink-0">
                                            <span className="text-slate-500">{co.durationMinutes}m</span>
                                            <button
                                              onClick={() => {
                                                setNowPlaying({
                                                  content: co,
                                                  schedule: null,
                                                  fallbackUsed: false
                                                });
                                                setTimeout(() => {
                                                  const playerEl = document.getElementById('channel-player-section');
                                                  if (playerEl) {
                                                    playerEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                  }
                                                }, 100);
                                              }}
                                              className="text-[9px] text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 px-1.5 py-0.5 rounded border border-indigo-500/20 uppercase font-bold cursor-pointer"
                                              title="Testa questo video nazionale nel player"
                                            >
                                              Test ▶
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>

                              <div className="pt-2">
                                {isAlreadyImported ? (
                                  <div className="flex gap-2">
                                    <div className="flex-1 bg-green-500/10 border border-green-500/20 rounded-xl py-2 px-3 text-[10px] font-bold uppercase text-green-400 text-center flex items-center justify-center gap-1.5">
                                      <CheckCircle className="w-3.5 h-3.5" />
                                      Rubrica Attiva
                                    </div>
                                    <button
                                      onClick={() => setActiveBackofficeTab('schedule')}
                                      className="bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-500/30 rounded-xl py-2 px-4 text-[10px] font-bold uppercase tracking-wider transition-all"
                                    >
                                      Pianifica
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => handleImportNationalRubric(syn.category.id)}
                                    className="w-full bg-[#0E0E12] border border-slate-800 hover:border-slate-700 hover:bg-[#121217] text-slate-300 hover:text-white rounded-xl py-2.5 px-3 text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
                                  >
                                    <Plus className="w-3.5 h-3.5 text-indigo-400" />
                                    Importa Rubrica Nazionale
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* TAB: EMBED WIZARDS & SECURE API CONFIG */}
                {activeBackofficeTab === 'embed' && (
                  <div className="space-y-8">
                    {/* Visual generator */}
                    <EmbedWizard channelSlug={ownerChannel.slug} />

                    {/* API keys config */}
                    <div className="bg-[#111114] border border-slate-800 rounded-2xl p-6 text-left space-y-4">
                      <div className="flex items-center gap-2">
                        <Key className="w-5 h-5 text-indigo-400" />
                        <h3 className="text-lg font-bold font-display text-white uppercase tracking-tight">Integrazione API Protette</h3>
                      </div>
                      <p className="text-xs text-slate-400">
                        Se desideri recuperare i palinsesti correnti della tua TV tramite endpoint REST esterni, utilizza la chiave API protetta per autorizzare le chiamate.
                      </p>

                      <div className="bg-[#0E0E12] border border-slate-800 p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="w-full sm:w-auto text-left">
                          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">Chiave di Sicurezza Canale</span>
                          <span className="text-xs font-mono text-slate-200 block mt-1 break-all">
                            {ownerChannel.apiKey || 'Nessuna chiave generata.'}
                          </span>
                        </div>

                        <button 
                          onClick={handleGenerateApiKey}
                          className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-2 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-500/25 px-4.5 py-2.5 rounded-xl text-xs font-bold transition-all uppercase tracking-wider"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          Rigenera Chiave API
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB: CONFIGURATION */}
                {activeBackofficeTab === 'details' && (
                  <div className="max-w-2xl bg-[#111114] border border-slate-800 rounded-2xl p-6 text-left space-y-6">
                    <h3 className="text-lg font-bold font-display text-white uppercase tracking-tight">Dati Generali del Canale TV</h3>

                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      const form = e.target as HTMLFormElement;
                      const name = (form.elements.namedItem('chName') as HTMLInputElement).value;
                      const logo = (form.elements.namedItem('chLogo') as HTMLInputElement).value;
                      const desc = (form.elements.namedItem('chDesc') as HTMLTextAreaElement).value;
                      
                      const res = await fetch(`/api/channels/${ownerChannel.id}/settings`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name, logoUrl: logo, description: desc })
                      });
                      if (res.status === 200) {
                        alert('Impostazioni salvate!');
                        fetchOwnerChannel();
                        fetchChannels();
                      }
                    }} className="space-y-4 text-xs">
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Nome Canale</label>
                        <input 
                          name="chName" type="text" required defaultValue={ownerChannel.name}
                          className="w-full bg-[#0A0A0B] border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">URL Immagine Logo</label>
                        <input 
                          name="chLogo" type="url" required defaultValue={ownerChannel.logoUrl}
                          className="w-full bg-[#0A0A0B] border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Descrizione Canale</label>
                        <textarea 
                          name="chDesc" rows={4} required defaultValue={ownerChannel.description}
                          className="w-full bg-[#0A0A0B] border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      <button 
                        type="submit"
                        className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-5 py-2.5 rounded-lg transition-all uppercase tracking-wider"
                      >
                        Salva Impostazioni
                      </button>
                    </form>
                  </div>
                )}

              </div>
            ) : (
              <div className="py-24 text-center">
                <AlertTriangle className="w-12 h-12 text-slate-600 mx-auto mb-3 animate-pulse" />
                <h3 className="text-lg font-bold text-white uppercase">Canale Non Sincronizzato</h3>
                <p className="text-xs text-slate-500 mt-1">Stiamo preparando il tuo ambiente o la tua TV non è ancora stata approvata dall'amministratore.</p>
              </div>
            )}
          </div>
        )}

      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-800 bg-[#111114]/50 py-8 px-4 mt-16 text-xs text-slate-500 text-center">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <p>© 2026 Meta-tv-channel. Tutti i diritti riservati. Soluzione IPTV SaaS Multi-Tenant.</p>
          <div className="flex gap-4">
            <span className="cursor-pointer hover:text-slate-400 uppercase tracking-widest">Termini di Servizio</span>
            <span>•</span>
            <span className="cursor-pointer hover:text-slate-400 uppercase tracking-widest">Informativa Privacy</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
