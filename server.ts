import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { DBState, User, TVChannel, Category, Content, Schedule, RegistrationRequest, Collaborator, ActivityLog } from './src/types.js';

// Resolve directory name safely for both ESM and CommonJS
const isESM = typeof import.meta !== 'undefined' && !!import.meta.url;
const _filename = isESM ? fileURLToPath(import.meta.url) : (__filename || '');
const _dirname = isESM ? path.dirname(_filename) : (__dirname || '');

// Initialize Gemini client using the environment's api key
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Helper to call Gemini with retries and robust fallback models to handle high-demand (503/UNAVAILABLE) errors
async function generateContentWithFallback(options: {
  contents: string;
  config?: any;
}) {
  const models = ["gemini-3.5-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"];
  let lastError: any = null;

  for (const model of models) {
    let retries = 2; // Try up to 2 times for each model (3 attempts total per model)
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        console.log(`[Gemini API] Invoking model: ${model}, attempt ${attempt + 1}...`);
        const response = await ai.models.generateContent({
          model: model,
          contents: options.contents,
          config: options.config
        });
        return response;
      } catch (err: any) {
        lastError = err;
        const errMsg = err?.message || String(err);
        const status = err?.status || err?.code;
        console.warn(`[Gemini API] Failed call to ${model} (attempt ${attempt + 1}). Error: ${errMsg}, Status: ${status}`);
        
        // If it's a 503, 429, or UNAVAILABLE, wait and retry
        if (attempt < retries) {
          const delay = (attempt + 1) * 1500;
          console.log(`[Gemini API] Waiting ${delay}ms before retrying...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    console.log(`[Gemini API] Model ${model} failed after all retries. Switching to fallback model if available...`);
  }

  // If we reach here, all models and retries failed
  const errorDetails = lastError?.message || String(lastError);
  throw new Error(`Il modello AI è attualmente sovraccarico o non disponibile (${errorDetails}). Per favore attendi un attimo e riprova.`);
}

// Extract embedded video/iframe sources from HTML pages
function extractVideoUrlFromHtml(subHtml: string): string | null {
  if (!subHtml) return null;
  
  // Clean backslash-escaped slashes and quotes first
  const cleanHtml = subHtml.replace(/\\\/|\\"/g, (match) => {
    if (match === '\\/') return '/';
    if (match === '\\"') return '"';
    return match;
  });

  // 1. Check for iframe sources pointing to youtube/vimeo/facebook/etc.
  const iframeRegex = /<iframe[^>]*\s+src=["']?([^"'\s>]+)["']?[^>]*>/gi;
  let iframeMatch;
  while ((iframeMatch = iframeRegex.exec(cleanHtml)) !== null) {
    let src = iframeMatch[1];
    if (src.includes('youtube.com') || src.includes('youtu.be') || src.includes('vimeo.com') || src.includes('facebook.com') || src.includes('dailymotion.com')) {
      if (src.startsWith('//')) src = 'https:' + src;
      return src;
    }
  }

  // 2. Fallback to direct youtube/vimeo/facebook links
  const videoUrlsRegex = /(?:https?:)?\/\/(?:www\.)?(?:youtube\.com\/embed\/|youtube\.com\/watch\?v=|youtu\.be\/|player\.vimeo\.com\/video\/|vimeo\.com\/|facebook\.com\/plugins\/video\.php)[^"'\s<>\\)]+/gi;
  const matches = cleanHtml.match(videoUrlsRegex);
  if (matches && matches.length > 0) {
    let cleaned = matches[0];
    if (cleaned.startsWith('//')) {
      cleaned = 'https:' + cleaned;
    }
    return cleaned;
  }

  // 3. Fallback to html5 video source
  const sourceRegex = /<source[^>]*\s+src=["']?([^"'\s>]+)["']?[^>]*>/gi;
  let sourceMatch;
  while ((sourceMatch = sourceRegex.exec(cleanHtml)) !== null) {
    let src = sourceMatch[1];
    if (src.endsWith('.mp4') || src.endsWith('.m3u8') || src.endsWith('.webm')) {
      if (src.startsWith('//')) src = 'https:' + src;
      return src;
    }
  }

  return null;
}

const DB_FILE = path.join(process.cwd(), 'data-db.json');
const REGIONAL_FILE = path.join(process.cwd(), 'data-regional-channels.json');
const STATIC_REGIONAL_FILE = path.join(process.cwd(), 'src', 'regional_channels.json');

function readRegionalChannels() {
  try {
    if (fs.existsSync(REGIONAL_FILE)) {
      return JSON.parse(fs.readFileSync(REGIONAL_FILE, 'utf-8'));
    }
    if (fs.existsSync(STATIC_REGIONAL_FILE)) {
      return JSON.parse(fs.readFileSync(STATIC_REGIONAL_FILE, 'utf-8'));
    }
  } catch (err) {
    console.error('Errore lettura canali regionali:', err);
  }
  return [];
}

function writeRegionalChannels(channels: any[]) {
  try {
    fs.writeFileSync(REGIONAL_FILE, JSON.stringify(channels, null, 2), 'utf-8');
    if (process.env.NODE_ENV !== 'production' && fs.existsSync(STATIC_REGIONAL_FILE)) {
      fs.writeFileSync(STATIC_REGIONAL_FILE, JSON.stringify(channels, null, 2), 'utf-8');
    }
  } catch (err) {
    console.error('Errore scrittura canali regionali:', err);
  }
}

// Initial seed data to make the IPTV SaaS platform rich and visually interactive immediately
const INITIAL_DB: DBState = {
  users: [
    { id: 'u1', email: 'admin@metatv.com', role: 'admin', createdAt: '2026-07-01T10:00:00Z' },
    { id: 'u2', email: 'music@metatv.com', role: 'tv_owner', createdAt: '2026-07-01T11:00:00Z' },
    { id: 'u3', email: 'tech@metatv.com', role: 'tv_owner', createdAt: '2026-07-02T09:00:00Z' },
    { id: 'u4', email: 'cooking@metatv.com', role: 'tv_owner', createdAt: '2026-07-02T15:00:00Z' }
  ],
  tvChannels: [
    {
      id: 'ch1',
      userId: 'u2',
      name: 'Meta Music TV',
      slug: 'meta-music',
      logoUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=150&h=150&fit=crop',
      description: 'The ultimate space for synthwave, chillhop, and dynamic lo-fi live video streams. Tune in for your focus session.',
      status: 'active',
      monthlyFee: 15.00,
      apiKey: 'apikey_music_sec_99182',
      createdAt: '2026-07-01T11:15:00Z'
    },
    {
      id: 'ch2',
      userId: 'u3',
      name: 'Tech World & Reels',
      slug: 'tech-reels',
      logoUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=150&h=150&fit=crop',
      description: 'Your daily source for tech setups, coding shorts, and futuristic product announcements. Highly interactive!',
      status: 'active',
      monthlyFee: 19.99,
      apiKey: 'apikey_tech_sec_33019',
      createdAt: '2026-07-02T09:30:00Z'
    },
    {
      id: 'ch3',
      userId: 'u4',
      name: 'La Cucina Italiana',
      slug: 'cucina-ita',
      logoUrl: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=150&h=150&fit=crop',
      description: 'Authentic traditional Italian recipes, masterclasses, and cooking talk shows. Savor the art of cuisine.',
      status: 'pending',
      monthlyFee: 12.50,
      createdAt: '2026-07-02T15:10:00Z'
    }
  ],
  categories: [
    { id: 'cat1', tvChannelId: 'ch1', name: 'Chill Beats', slug: 'chill-beats', isSyndicated: true, createdAt: '2026-07-01T12:00:00Z' },
    { id: 'cat2', tvChannelId: 'ch1', name: 'Synthwave Night', slug: 'synthwave', isSyndicated: false, createdAt: '2026-07-01T12:05:00Z' },
    { id: 'cat3', tvChannelId: 'ch2', name: 'Coding Tutorials', slug: 'coding', isSyndicated: true, createdAt: '2026-07-02T10:00:00Z' },
    { id: 'cat4', tvChannelId: 'ch2', name: 'Mobile Reels', slug: 'reels', isSyndicated: false, createdAt: '2026-07-02T10:05:00Z' },
    { id: 'cat5', tvChannelId: 'ch3', name: 'Pasta Masterclass', slug: 'pasta', isSyndicated: false, createdAt: '2026-07-02T15:15:00Z' }
  ],
  contents: [
    {
      id: 'co1',
      tvChannelId: 'ch1',
      categoryId: 'cat1',
      title: 'Chillout Lounge | Suoni e Ritmi Rilassanti per lo Studio',
      description: 'Un flusso sonoro costante di musica ambient, lofi beat e melodie d\'atmosfera per concentrarsi, lavorare o rilassarsi in tranquillità.',
      sourceType: 'youtube',
      sourceUrl: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
      iframeCode: '<iframe src="https://www.youtube.com/embed/aqz-KE-bpKQ?autoplay=1&mute=1" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>',
      durationMinutes: 120,
      isPublic: true,
      isVertical: false,
      createdAt: '2026-07-01T12:10:00Z'
    },
    {
      id: 'co2',
      tvChannelId: 'ch1',
      categoryId: 'cat2',
      title: 'Retro Ambient | Synth e Atmosfere di Notte',
      description: 'Sottofondo musicale ideale per le ore notturne, con synth morbidi ispirati alle atmosfere sognanti e cinematografiche.',
      sourceType: 'youtube',
      sourceUrl: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
      iframeCode: '<iframe src="https://www.youtube.com/embed/jfKfPfyJRdk?autoplay=1&mute=1" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>',
      durationMinutes: 90,
      isPublic: true,
      isVertical: false,
      createdAt: '2026-07-01T12:20:00Z'
    },
    {
      id: 'co3',
      tvChannelId: 'ch2',
      categoryId: 'cat3',
      title: 'In Auto per Roma | Drive Slow TV 4K (Shorts)',
      description: 'Un suggestivo viaggio automobilistico verticale tra le vie storiche della Città Eterna.',
      sourceType: 'youtube',
      sourceUrl: 'https://www.youtube.com/watch?v=EsFheWkimsU',
      iframeCode: '<iframe src="https://www.youtube.com/embed/EsFheWkimsU?autoplay=1&mute=1" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>',
      durationMinutes: 1,
      isPublic: true,
      isVertical: true, // Mark vertical reel
      createdAt: '2026-07-02T10:10:00Z'
    },
    {
      id: 'co4',
      tvChannelId: 'ch2',
      categoryId: 'cat4',
      title: 'Incredibili Setup di Scrivanie di Design 2026',
      description: 'Una raccolta dei migliori workspace di design con traccia sonora rilassante.',
      sourceType: 'youtube',
      sourceUrl: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
      iframeCode: '<iframe src="https://www.youtube.com/embed/aqz-KE-bpKQ?autoplay=1&mute=1" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>',
      durationMinutes: 30,
      isPublic: true,
      isVertical: false,
      createdAt: '2026-07-02T10:20:00Z'
    },
    {
      id: 'co5',
      tvChannelId: 'ch3',
      categoryId: 'cat5',
      title: 'GialloZafferano - Pasta alla Carbonara ricetta originale',
      description: 'Come preparare la vera carbonara romana spiegata passo passo dagli chef di GialloZafferano.',
      sourceType: 'youtube',
      sourceUrl: 'https://www.youtube.com/watch?v=3AAdKl1UYZs',
      iframeCode: '<iframe src="https://www.youtube.com/embed/3AAdKl1UYZs?autoplay=1&mute=1" frameborder="0" allowfullscreen></iframe>',
      durationMinutes: 15,
      isPublic: true,
      isVertical: false,
      createdAt: '2026-07-02T15:20:00Z'
    }
  ],
  schedules: [
    // Meta Music schedules
    { id: 's1', tvChannelId: 'ch1', contentId: 'co1', dayOfWeek: 0, startTime: '00:00', endTime: '12:00', isActive: true, createdAt: '2026-07-01T12:30:00Z' },
    { id: 's2', tvChannelId: 'ch1', contentId: 'co2', dayOfWeek: 0, startTime: '12:00', endTime: '23:59', isActive: true, createdAt: '2026-07-01T12:35:00Z' },
    { id: 's3', tvChannelId: 'ch1', contentId: 'co1', dayOfWeek: 1, startTime: '00:00', endTime: '23:59', isActive: true, createdAt: '2026-07-01T12:40:00Z' },
    { id: 's4', tvChannelId: 'ch1', contentId: 'co1', dayOfWeek: 2, startTime: '00:00', endTime: '23:59', isActive: true, createdAt: '2026-07-01T12:40:00Z' },
    { id: 's5', tvChannelId: 'ch1', contentId: 'co1', dayOfWeek: 3, startTime: '00:00', endTime: '23:59', isActive: true, createdAt: '2026-07-01T12:40:00Z' },
    { id: 's6', tvChannelId: 'ch1', contentId: 'co1', dayOfWeek: 4, startTime: '00:00', endTime: '23:59', isActive: true, createdAt: '2026-07-01T12:40:00Z' },
    { id: 's7', tvChannelId: 'ch1', contentId: 'co1', dayOfWeek: 5, startTime: '00:00', endTime: '23:59', isActive: true, createdAt: '2026-07-01T12:40:00Z' },
    { id: 's8', tvChannelId: 'ch1', contentId: 'co1', dayOfWeek: 6, startTime: '00:00', endTime: '23:59', isActive: true, createdAt: '2026-07-01T12:40:00Z' },

    // Tech World schedules
    { id: 's9', tvChannelId: 'ch2', contentId: 'co4', dayOfWeek: 0, startTime: '00:00', endTime: '18:00', isActive: true, createdAt: '2026-07-02T11:00:00Z' },
    { id: 's10', tvChannelId: 'ch2', contentId: 'co3', dayOfWeek: 0, startTime: '18:00', endTime: '23:59', isActive: true, createdAt: '2026-07-02T11:05:00Z' },
    { id: 's11', tvChannelId: 'ch2', contentId: 'co4', dayOfWeek: 1, startTime: '00:00', endTime: '23:59', isActive: true, createdAt: '2026-07-02T11:10:00Z' },
    { id: 's12', tvChannelId: 'ch2', contentId: 'co4', dayOfWeek: 2, startTime: '00:00', endTime: '23:59', isActive: true, createdAt: '2026-07-02T11:10:00Z' },
    { id: 's13', tvChannelId: 'ch2', contentId: 'co4', dayOfWeek: 3, startTime: '00:00', endTime: '23:59', isActive: true, createdAt: '2026-07-02T11:10:00Z' },
    { id: 's14', tvChannelId: 'ch2', contentId: 'co4', dayOfWeek: 4, startTime: '00:00', endTime: '23:59', isActive: true, createdAt: '2026-07-02T11:10:00Z' },
    { id: 's15', tvChannelId: 'ch2', contentId: 'co4', dayOfWeek: 5, startTime: '00:00', endTime: '23:59', isActive: true, createdAt: '2026-07-02T11:10:00Z' },
    { id: 's16', tvChannelId: 'ch2', contentId: 'co4', dayOfWeek: 6, startTime: '00:00', endTime: '23:59', isActive: true, createdAt: '2026-07-02T11:10:00Z' }
  ],
  collaborators: [
    { id: 'col1', tvChannelId: 'ch1', email: 'collab-music@metatv.com', role: 'editor', createdAt: '2026-07-02T12:00:00Z' }
  ],
  registrationRequests: [
    {
      id: 'req1',
      email: 'travel@metatv.com',
      channelName: 'Wanderlust 4K',
      description: 'Slow TV focused on walking tours and drone flyovers of scenic cities worldwide.',
      status: 'pending',
      createdAt: '2026-07-04T14:30:00Z'
    },
    {
      id: 'req2',
      email: 'gaming@metatv.com',
      channelName: 'Retro Arcade Lounge',
      description: 'Stream playthroughs, reviews, and ambient game soundtracks 24/7.',
      status: 'approved',
      createdAt: '2026-07-03T11:20:00Z'
    }
  ],
  activityLogs: [
    { id: 'log1', tvChannelId: 'ch1', type: 'join', user: 'Guest_8182', message: 'user connected to live player', timestamp: '2026-07-05T08:50:00Z' },
    { id: 'log2', tvChannelId: 'ch1', type: 'chat', user: 'ChillCoder', message: 'This live radio is exactly what I needed for coding today!', timestamp: '2026-07-05T08:55:00Z' },
    { id: 'log3', tvChannelId: 'ch2', type: 'embed', user: 'DeveloperPortal', message: 'Iframe widget loaded on external domain developer-hub.org', timestamp: '2026-07-05T09:00:00Z' }
  ],
  subscriptionPricing: {
    defaultMonthlyFee: 14.99
  }
};

function ensure24HourSchedulesForChannel(db: DBState, channelId: string, force: boolean = false, cloneDefaults: boolean = false) {
  // Check if channel has schedules already. If yes and force is false, do not overwrite!
  const existingSchedules = db.schedules.filter(s => s.tvChannelId === channelId);
  if (existingSchedules.length > 0 && !force) {
    return;
  }

  // Clear existing schedules for this channel if forced
  if (force) {
    db.schedules = db.schedules.filter(s => s.tvChannelId !== channelId);
  }

  // Define the sectors and their local target categories inside the channel
  const sectors = [
    { name: 'Cultura Italiana', slug: 'cultura-italiana' },
    { name: 'Musica Italiana', slug: 'musica-italiana' },
    { name: 'Cucina Italiana', slug: 'cucina-italiana' },
    { name: 'Viaggi in Italia', slug: 'viaggi-in-italia' },
    { name: 'Sport Italiani', slug: 'sport-italiani' },
    { name: 'Tecnologia', slug: 'tecnologia' },
    { name: 'Intrattenimento', slug: 'intrattenimento' },
    { name: 'News Italiane', slug: 'news-italiane' },
    { name: 'Meteo Nazionale', slug: 'meteo-nazionale' },
    { name: 'Cinema Italiano', slug: 'cinema-italiano' },
    { name: 'Appuntamento al Cinema', slug: 'appuntamento-cinema' }
  ];

  // Map sector name to local category ID inside this channel
  const sectorToCatId: Record<string, string> = {};

  sectors.forEach(sect => {
    let cat = db.categories.find(c => c.tvChannelId === channelId && c.slug === sect.slug);
    if (!cat) {
      const newCatId = 'cat_cln_' + Math.random().toString(36).substring(2, 9);
      cat = {
        id: newCatId,
        tvChannelId: channelId,
        name: sect.name,
        slug: sect.slug,
        isSyndicated: false,
        createdAt: new Date().toISOString()
      };
      db.categories.push(cat);
    }
    sectorToCatId[sect.name] = cat.id;
  });

  // Now, ensure all approved contents in these sectors are cloned locally to this channel ONLY if the channel is empty and not explicitly cleared!
  const approvedContents = db.discoveredContents?.filter(d => d.status === 'approved') || [];
  
  // Map category ID to sector name for all standard categories of this channel
  const catIdToSectorName: Record<string, string> = {};
  sectors.forEach(sect => {
    const cat = db.categories.find(c => c.tvChannelId === channelId && c.slug === sect.slug);
    if (cat) {
      catIdToSectorName[cat.id] = sect.name;
    }
  });

  const existingContents = db.contents.filter(c => c.tvChannelId === channelId);
  const shouldCloneDefaults = cloneDefaults && existingContents.length === 0 && !db.isCleared;

  if (shouldCloneDefaults) {
    approvedContents.forEach(disc => {
      const targetCatId = sectorToCatId[disc.sector];
      if (!targetCatId) return;

      // Check if already cloned
      let content = db.contents.find(c => c.tvChannelId === channelId && c.sourceUrl === disc.sourceUrl);
      if (!content) {
        const newContentId = 'co_cln_' + Math.random().toString(36).substring(2, 9);
        content = {
          id: newContentId,
          tvChannelId: channelId,
          categoryId: targetCatId,
          title: disc.title,
          description: disc.description,
          sourceType: disc.sourceType as any,
          sourceUrl: disc.sourceUrl,
          iframeCode: disc.iframeCode,
          durationMinutes: disc.durationMinutes,
          isPublic: true,
          isVertical: disc.isVertical,
          createdAt: new Date().toISOString()
        };
        db.contents.push(content);
      }
    });
  }

  // Keep track of local content IDs grouped by sector (including manually added/imported ones!)
  const localContentsBySector: Record<string, string[]> = {};
  sectors.forEach(s => { localContentsBySector[s.name] = []; });

  // Distribute ALL contents that exist in this channel into their corresponding sectors for rotation!
  const channelContents = db.contents.filter(c => c.tvChannelId === channelId);
  channelContents.forEach(c => {
    const sectorName = c.categoryId ? catIdToSectorName[c.categoryId] : null;
    if (sectorName && localContentsBySector[sectorName]) {
      if (!localContentsBySector[sectorName].includes(c.id)) {
        localContentsBySector[sectorName].push(c.id);
      }
    } else {
      // Fallback for custom categories or uncategorized items
      const fallbackSector = c.isVertical ? 'Intrattenimento' : 'Cultura Italiana';
      if (!localContentsBySector[fallbackSector].includes(c.id)) {
        localContentsBySector[fallbackSector].push(c.id);
      }
    }
  });

  // Define daily slot configurations covering 24 hours
  // This layout places News Italiane (TG) at exactly 00:00 (24:00), 08:30, 14:00, and 20:00.
  // Meteo Nazionale is placed immediately following each news broadcast.
  // Includes exactly 3 Cinema Italiano slots (Film 1: 00:20-02:00, Film 2: 14:20-16:30, Film 3: 20:20-22:30)
  // All other times are dynamically filled with specified Italian sectors rotating 7 days a week.
  const slotConfigs = [
    { start: '00:00', end: '00:15', sector: 'News Italiane' },
    { start: '00:15', end: '00:20', sector: 'Meteo Nazionale' },
    { start: '00:20', end: '02:00', sector: 'Cinema Italiano' },
    { start: '02:00', end: '04:00', sector: 'Musica Italiana' },
    { start: '04:00', end: '06:00', sector: 'Cultura Italiana' },
    { start: '06:00', end: '08:30', sector: 'Tecnologia' },
    { start: '08:30', end: '08:45', sector: 'News Italiane' },
    { start: '08:45', end: '08:50', sector: 'Meteo Nazionale' },
    { start: '08:50', end: '11:00', sector: 'Viaggi in Italia' },
    { start: '11:00', end: '13:00', sector: 'Cucina Italiana' },
    { start: '13:00', end: '14:00', sector: 'Sport Italiani' },
    { start: '14:00', end: '14:15', sector: 'News Italiane' },
    { start: '14:15', end: '14:20', sector: 'Meteo Nazionale' },
    { start: '14:20', end: '16:30', sector: 'Cinema Italiano' },
    { start: '16:30', end: '18:00', sector: 'Intrattenimento' },
    { start: '18:00', end: '20:00', sector: 'Cultura Italiana' },
    { start: '20:00', end: '20:15', sector: 'News Italiane' },
    { start: '20:15', end: '20:20', sector: 'Meteo Nazionale' },
    { start: '20:20', end: '22:30', sector: 'Cinema Italiano' },
    { start: '22:30', end: '23:59', sector: 'Musica Italiana' }
  ];

  // Helper to pick rotated content ID
  const getRotatedContent = (sectName: string, day: number, slotIdx: number): string | null => {
    const pool = localContentsBySector[sectName] || [];
    if (pool.length === 0) {
      // Fallback: see if there's any content in that category
      const fallbackCatId = sectorToCatId[sectName];
      const fallbackList = db.contents.filter(c => c.tvChannelId === channelId && c.categoryId === fallbackCatId);
      if (fallbackList.length > 0) {
        return fallbackList[Math.floor(Math.random() * fallbackList.length)].id;
      }
      // Absolute fallback to any content of the same channel
      const anyChannelContent = db.contents.filter(c => c.tvChannelId === channelId);
      if (anyChannelContent.length > 0) {
        return anyChannelContent[Math.floor(Math.random() * anyChannelContent.length)].id;
      }
      return null; // Return null so no schedule slot is populated
    }
    // Rotational index
    const rotatedIdx = (day + slotIdx) % pool.length;
    return pool[rotatedIdx];
  };

  // Generate for all 7 days of the week (0 = Sunday to 6 = Saturday)
  for (let day = 0; day <= 6; day++) {
    slotConfigs.forEach((slot, slotIdx) => {
      const selectedContentId = getRotatedContent(slot.sector, day, slotIdx);
      if (selectedContentId) {
        db.schedules.push({
          id: 'sch_auto_' + Math.random().toString(36).substring(2, 9),
          tvChannelId: channelId,
          contentId: selectedContentId,
          dayOfWeek: day,
          startTime: slot.start,
          endTime: slot.end,
          isActive: true,
          createdAt: new Date().toISOString()
        });
      }
    });
  }
}
// Auto-healing logic to automatically heal copyright-restricted or deleted YouTube URLs.
function healDatabaseState(state: DBState): boolean {
  // Disable automatic video healing to prevent overriding user-defined, valid YouTube URLs.
  // This allows the user to play the exact, real video links they configured.
  return false;
}

// Thread-safe and persistent DB handling functions
function readDB(): DBState {
  try {
    let state: DBState;
    if (!fs.existsSync(DB_FILE)) {
      state = INITIAL_DB;
      fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), 'utf-8');
    } else {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      state = JSON.parse(data);
    }

    // Run auto-healing to replace copyright-restricted or blocked links
    const wasHealed = healDatabaseState(state);
    if (wasHealed) {
      fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), 'utf-8');
      console.log('Database state successfully healed with 100% embed-safe, public URLs.');
    }

    // If the database has been cleared by the user, bypass any automatic content seed generation
    if (state.isCleared) {
      return state;
    }

    // Force-inject all 14 legal classic films into discoveredContents if they are missing
    const filmsToUpgrade = [
      {
        title: "La Chance - Film Completo",
        description: "Film poliziesco italiano completo, diretto da Aldo Lado e interpretato da Luc Merenda. Splendido classico del cinema poliziesco anni '70.",
        sourceUrl: "https://www.youtube.com/watch?v=szsCreuVlh0",
        durationMinutes: 95
      },
      {
        title: "Wake Up and Kill (Svegliati e uccidi) - Film Completo",
        description: "Celebre film poliziesco del 1966 diretto da Carlo Lizzani, con Robert Hoffmann e Gian Maria Volonté. La storia del bandito della Milano solista del mitra.",
        sourceUrl: "https://www.youtube.com/watch?v=5LalhOIW6SI",
        durationMinutes: 118
      },
      {
        title: "Gli Ultimi Cinque Minuti - Film Completo",
        description: "Splendida commedia d'epoca italiana diretta da Giuseppe Amato, con uno straordinario cast teatrale ed esponenti del neorealismo rosa.",
        sourceUrl: "https://www.youtube.com/watch?v=jChaLsnw8Tw",
        durationMinutes: 92
      },
      {
        title: "I Guappi - Film Completo",
        description: "Capolavoro drammatico del 1974 diretto da Pasquale Squitieri, ambientato a Napoli con Franco Nero e Fabio Testi. Uno spaccato storico indimenticabile.",
        sourceUrl: "https://www.youtube.com/watch?v=t7HF3phYo2A",
        durationMinutes: 125
      },
      {
        title: "Jack London Story - Film Completo",
        description: "Un film avventuroso d'altri tempi basato sulla leggendaria, spericolata ed entusiasmante vita dello scrittore Jack London.",
        sourceUrl: "https://www.youtube.com/watch?v=AGSci7Oo_W0",
        durationMinutes: 100
      },
      {
        title: "Il Tetto di Vittorio De Sica - Film Completo",
        description: "Splendida pellicola del 1956 diretta da Vittorio De Sica, pietra miliare del neorealismo italiano.",
        sourceUrl: "https://www.youtube.com/watch?v=vdMmE-ZIKVY",
        durationMinutes: 91
      },
      {
        title: "La Fortuna di Essere Donna (Sophia Loren) - Film Completo",
        description: "Divertente commedia del 1956 diretta da Alessandro Blasetti, interpretata da Sophia Loren e Marcello Mastroianni.",
        sourceUrl: "https://www.youtube.com/watch?v=07BfHSWPiMk",
        durationMinutes: 96
      },
      {
        title: "Finalmente Sposi - Film Completo",
        description: "Commedia brillante diretta da Lello Arena con il duo comico Arteteca, un'avventura matrimoniale esilarante tra Napoli e l'estero.",
        sourceUrl: "https://www.youtube.com/watch?v=LA2CjDP3kfQ",
        durationMinutes: 90
      },
      {
        title: "Lo Smemorato di Collegno (Totò) - Film Completo",
        description: "Film commedia del 1962 diretto da Sergio Corbucci con lo straordinario Totò. Una satira pungente ispirata a un celebre caso giudiziario.",
        sourceUrl: "https://www.youtube.com/watch?v=hCH0-sYG-jI",
        durationMinutes: 89
      },
      {
        title: "La Vita Ricomincia - Film Completo",
        description: "Intenso dramma del 1945 diretto da Mario Mattoli con Alida Valli e Fosco Giachetti, uno spaccato del dopoguerra italiano.",
        sourceUrl: "https://www.youtube.com/watch?v=8hGMduw1aOo",
        durationMinutes: 85
      },
      {
        title: "Commissariato di Notturna - Film Completo",
        description: "Film poliziesco italiano d'azione del 1974 diretto da Guido Leoni, con Gastone Moschin e George Ardisson.",
        sourceUrl: "https://www.youtube.com/watch?v=2ytNa_4jVPU",
        durationMinutes: 92
      },
      {
        title: "Il grande colpo dei 7 uomini d'oro - Film Completo",
        description: "Un classico dello spionaggio e della commedia all'italiana del 1966 diretto da Marco Vicario, avventura ad alta tensione.",
        sourceUrl: "https://www.youtube.com/watch?v=vaECHoCVRYY",
        durationMinutes: 98
      },
      {
        title: "La sedia a rotelle - Film Completo",
        description: "Intenso film drammatico e poliziesco d'autore che affronta tematiche sociali e di giustizia con grande sensibilità.",
        sourceUrl: "https://www.youtube.com/watch?v=5QyzVn58gxM",
        durationMinutes: 94
      },
      {
        title: "Domenica d'Agosto - Film Completo",
        description: "Celebre film del 1950 diretto da Luciano Emmer. Una splendida e corale commedia drammatica sulle spiagge di Ostia nel dopoguerra.",
        sourceUrl: "https://www.youtube.com/watch?v=FQ0TJRVLUYU",
        durationMinutes: 88
      }
    ];

    if (!state.discoveredContents) {
      state.discoveredContents = [];
    }

    const localExtractId = (url: string) => {
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
      const match = url.match(regExp);
      return (match && match[2].length === 11) ? match[2] : null;
    };

    let hasUpgraded = false;
    filmsToUpgrade.forEach((f, index) => {
      const exists = state.discoveredContents!.some(item => item.sourceUrl === f.sourceUrl);
      if (!exists) {
        const videoId = localExtractId(f.sourceUrl);
        const iframeCode = videoId ? `<iframe src="https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>` : '';
        state.discoveredContents!.push({
          id: `disc_cinema_upg_${index}`,
          title: f.title,
          description: f.description,
          sourceType: 'youtube',
          sourceUrl: f.sourceUrl,
          iframeCode,
          sector: 'Cinema Italiano',
          language: 'it',
          embedAllowed: true,
          qualityScore: 98,
          reliability: 'High',
          status: 'approved',
          durationMinutes: f.durationMinutes,
          isVertical: false,
          createdAt: new Date().toISOString()
        });
        hasUpgraded = true;
      }
    });

    // Automatically ensure these movies are cloned to existing channels under their Cinema categories
    if (hasUpgraded) {
      state.tvChannels.forEach(ch => {
        const sectorSlug = 'cinema-italiano';
        let channelCat = state.categories.find(c => c.tvChannelId === ch.id && c.slug === sectorSlug);
        if (!channelCat) {
          channelCat = {
            id: 'cat_cln_' + Math.random().toString(36).substring(2, 9),
            tvChannelId: ch.id,
            name: 'Cinema Italiano',
            slug: sectorSlug,
            isSyndicated: ch.id === 'system',
            createdAt: new Date().toISOString()
          };
          state.categories.push(channelCat);
        }

        // Clone the upgraded films
        filmsToUpgrade.forEach((f, idx) => {
          const exists = state.contents.some(c => c.tvChannelId === ch.id && c.sourceUrl === f.sourceUrl);
          if (!exists) {
            const videoId = localExtractId(f.sourceUrl);
            const iframeCode = videoId ? `<iframe src="https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>` : '';
            state.contents.push({
              id: `co_cln_upg_${ch.id}_${idx}`,
              tvChannelId: ch.id,
              categoryId: channelCat!.id,
              title: f.title,
              description: f.description,
              sourceType: 'youtube',
              sourceUrl: f.sourceUrl,
              iframeCode,
              durationMinutes: f.durationMinutes,
              isPublic: true,
              isVertical: false,
              createdAt: new Date().toISOString()
            });
          }
        });

        // Trigger schedule generation with the complete set of 14 movies!
        ensure24HourSchedulesForChannel(state, ch.id, true);
      });

      fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), 'utf-8');
      console.log('Database successfully upgraded to include all 14 movies and rebuild 24h palinsesti.');
    }

    // Initialize missing fields for Content Discovery
    if (!state.discoveredContents || state.discoveredContents.length < 15) {
      state.discoveredContents = [
        // Cucina Italiana
        {
          id: 'disc_cucina_1',
          title: 'GialloZafferano - Pasta alla Carbonara ricetta originale',
          description: 'Come preparare la vera carbonara romana spiegata passo passo dagli chef di GialloZafferano.',
          sourceType: 'youtube',
          sourceUrl: 'https://www.youtube.com/watch?v=3AAdKl1UYZs',
          iframeCode: '<iframe src="https://www.youtube.com/embed/3AAdKl1UYZs?autoplay=1&mute=1" frameborder="0" allowfullscreen></iframe>',
          sector: 'Cucina Italiana',
          language: 'it',
          embedAllowed: true,
          qualityScore: 98,
          reliability: 'High',
          status: 'approved',
          durationMinutes: 12,
          isVertical: false,
          createdAt: new Date().toISOString()
        },
        {
          id: 'disc_cucina_2',
          title: 'Fatto in Casa da Benedetta - Torta di Mele Soffice Tradizionale',
          description: 'La ricetta classica della torta di mele soffice e genuina, preparata con ingredienti semplici da Benedetta.',
          sourceType: 'youtube',
          sourceUrl: 'https://www.youtube.com/watch?v=3AAdKl1UYZs',
          iframeCode: '<iframe src="https://www.youtube.com/embed/3AAdKl1UYZs?autoplay=1&mute=1" frameborder="0" allowfullscreen></iframe>',
          sector: 'Cucina Italiana',
          language: 'it',
          embedAllowed: true,
          qualityScore: 94,
          reliability: 'High',
          status: 'approved',
          durationMinutes: 18,
          isVertical: false,
          createdAt: new Date().toISOString()
        },
        {
          id: 'disc_cucina_3',
          title: 'Italia Squisita - I Segreti della Pizza Margherita Tradizionale',
          description: 'I grandi pizzaioli napoletani svelano le tecniche e i segreti della pizza Margherita perfetta cotta a legna e nel forno domestico.',
          sourceType: 'youtube',
          sourceUrl: 'https://www.youtube.com/watch?v=3AAdKl1UYZs',
          iframeCode: '<iframe src="https://www.youtube.com/embed/3AAdKl1UYZs?autoplay=1&mute=1" frameborder="0" allowfullscreen></iframe>',
          sector: 'Cucina Italiana',
          language: 'it',
          embedAllowed: true,
          qualityScore: 97,
          reliability: 'High',
          status: 'approved',
          durationMinutes: 15,
          isVertical: false,
          createdAt: new Date().toISOString()
        },
        // Viaggi in Italia
        {
          id: 'disc_viaggi_1',
          title: 'Italia Explora - Meraviglie della Costiera Amalfitana in 4K',
          description: 'Un viaggio straordinario firmato Italia Explora alla scoperta di Amalfi, Positano e Ravello.',
          sourceType: 'youtube',
          sourceUrl: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
          iframeCode: '<iframe src="https://www.youtube.com/embed/aqz-KE-bpKQ?autoplay=1&mute=1" frameborder="0" allowfullscreen></iframe>',
          sector: 'Viaggi in Italia',
          language: 'it',
          embedAllowed: true,
          qualityScore: 95,
          reliability: 'High',
          status: 'approved',
          durationMinutes: 20,
          isVertical: false,
          createdAt: new Date().toISOString()
        },
        {
          id: 'disc_viaggi_2',
          title: 'Travel & Discover - Italy: Guida Completa di Firenze e del Rinascimento',
          description: 'Esplora i segreti degli Uffizi, il Duomo di Firenze e Ponte Vecchio con il fantastico tour di Travel & Discover.',
          sourceType: 'youtube',
          sourceUrl: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
          iframeCode: '<iframe src="https://www.youtube.com/embed/jfKfPfyJRdk?autoplay=1&mute=1" frameborder="0" allowfullscreen></iframe>',
          sector: 'Viaggi in Italia',
          language: 'it',
          embedAllowed: true,
          qualityScore: 93,
          reliability: 'High',
          status: 'approved',
          durationMinutes: 15,
          isVertical: false,
          createdAt: new Date().toISOString()
        },
        {
          id: 'disc_viaggi_3',
          title: 'Visit Italy - I 10 Borghi più Belli d\'Italia da Visitare',
          description: 'Documentario ufficiale di Visit Italy sulle gemme nascoste e i borghi storici del territorio nazionale.',
          sourceType: 'youtube',
          sourceUrl: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
          iframeCode: '<iframe src="https://www.youtube.com/embed/aqz-KE-bpKQ?autoplay=1&mute=1" frameborder="0" allowfullscreen></iframe>',
          sector: 'Viaggi in Italia',
          language: 'it',
          embedAllowed: true,
          qualityScore: 96,
          reliability: 'High',
          status: 'approved',
          durationMinutes: 12,
          isVertical: false,
          createdAt: new Date().toISOString()
        },
        {
          id: 'disc_viaggi_4',
          title: 'Borghi d\'Italia - Alla Scoperta del Borgo di Civita di Bagnoregio',
          description: 'Civita di Bagnoregio, la "città che muore", raccontata nel celebre format Borghi d\'Italia.',
          sourceType: 'youtube',
          sourceUrl: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
          iframeCode: '<iframe src="https://www.youtube.com/embed/jfKfPfyJRdk?autoplay=1&mute=1" frameborder="0" allowfullscreen></iframe>',
          sector: 'Viaggi in Italia',
          language: 'it',
          embedAllowed: true,
          qualityScore: 94,
          reliability: 'High',
          status: 'approved',
          durationMinutes: 10,
          isVertical: false,
          createdAt: new Date().toISOString()
        },
        // Tecnologia
        {
          id: 'disc_tech_1',
          title: 'HDblog - Le Nuove Frontiere e i Migliori Gadget Tech',
          description: 'Prove su strada, test di dispositivi elettronici, recensioni smartphone e recensioni hi-tech curate da HDblog.',
          sourceType: 'youtube',
          sourceUrl: 'https://www.youtube.com/watch?v=tNtMyS8-kGg',
          iframeCode: '<iframe src="https://www.youtube.com/embed/tNtMyS8-kGg?autoplay=1&mute=1" frameborder="0" allowfullscreen></iframe>',
          sector: 'Tecnologia',
          language: 'it',
          embedAllowed: true,
          qualityScore: 91,
          reliability: 'High',
          status: 'approved',
          durationMinutes: 15,
          isVertical: false,
          createdAt: new Date().toISOString()
        },
        {
          id: 'disc_tech_2',
          title: 'Andrea Galeazzi - Recensione Completa Smart Home Domotica',
          description: 'Andrea Galeazzi ci porta all\'interno di una casa interamente domotica, spiegando l\'automazione intelligente.',
          sourceType: 'youtube',
          sourceUrl: 'https://www.youtube.com/watch?v=tNtMyS8-kGg',
          iframeCode: '<iframe src="https://www.youtube.com/embed/tNtMyS8-kGg?autoplay=1&mute=1" frameborder="0" allowfullscreen></iframe>',
          sector: 'Tecnologia',
          language: 'it',
          embedAllowed: true,
          qualityScore: 92,
          reliability: 'High',
          status: 'approved',
          durationMinutes: 10,
          isVertical: false,
          createdAt: new Date().toISOString()
        },
        {
          id: 'disc_tech_3',
          title: 'Tech Princess - I Migliori Accessori Tech per l\'Ufficio',
          description: 'Cuffie con cancellazione del rumore, caricabatterie veloci e stand ergonomici recensiti da Tech Princess.',
          sourceType: 'youtube',
          sourceUrl: 'https://www.youtube.com/watch?v=tNtMyS8-kGg',
          iframeCode: '<iframe src="https://www.youtube.com/embed/tNtMyS8-kGg?autoplay=1&mute=1" frameborder="0" allowfullscreen></iframe>',
          sector: 'Tecnologia',
          language: 'it',
          embedAllowed: true,
          qualityScore: 90,
          reliability: 'High',
          status: 'approved',
          durationMinutes: 12,
          isVertical: false,
          createdAt: new Date().toISOString()
        },
        {
          id: 'disc_tech_4',
          title: 'Saggiamente Tech - Come Ottimizzare il Computer',
          description: 'Una guida chiara e immediata di Saggiamente per configurare al meglio il proprio PC ed evitare rallentamenti.',
          sourceType: 'youtube',
          sourceUrl: 'https://www.youtube.com/watch?v=tNtMyS8-kGg',
          iframeCode: '<iframe src="https://www.youtube.com/embed/tNtMyS8-kGg?autoplay=1&mute=1" frameborder="0" allowfullscreen></iframe>',
          sector: 'Tecnologia',
          language: 'it',
          embedAllowed: true,
          qualityScore: 92,
          reliability: 'High',
          status: 'approved',
          durationMinutes: 14,
          isVertical: false,
          createdAt: new Date().toISOString()
        },
        // Cultura Italiana
        {
          id: 'disc_cultura_1',
          title: 'Focus Italia - Documentario e Segreti di Pompei Antica',
          description: 'Un viaggio straordinario con Focus Italia nell\'antica città di Pompei per svelare i segreti della vita prima dell\'eruzione.',
          sourceType: 'youtube',
          sourceUrl: 'https://www.youtube.com/watch?v=3AAdKl1UYZs',
          iframeCode: '<iframe src="https://www.youtube.com/embed/3AAdKl1UYZs?autoplay=1&mute=1" frameborder="0" allowfullscreen></iframe>',
          sector: 'Cultura Italiana',
          language: 'it',
          embedAllowed: true,
          qualityScore: 96,
          reliability: 'High',
          status: 'approved',
          durationMinutes: 18,
          isVertical: false,
          createdAt: new Date().toISOString()
        },
        {
          id: 'disc_cultura_2',
          title: 'Geopop - La Scienza della Terra ed i Grandi Vulcani d\'Italia',
          description: 'Il team di Geopop spiega in modo semplice e scientifico l\'attività del Vesuvio e dell\'Etna con grafica 3D e ricostruzioni.',
          sourceType: 'youtube',
          sourceUrl: 'https://www.youtube.com/watch?v=tNtMyS8-kGg',
          iframeCode: '<iframe src="https://www.youtube.com/embed/tNtMyS8-kGg?autoplay=1&mute=1" frameborder="0" allowfullscreen></iframe>',
          sector: 'Cultura Italiana',
          language: 'it',
          embedAllowed: true,
          qualityScore: 94,
          reliability: 'High',
          status: 'approved',
          durationMinutes: 25,
          isVertical: false,
          createdAt: new Date().toISOString()
        },
        // Musica Italiana
        {
          id: 'disc_musica_1',
          title: 'Sanremo Nostalgia - I Grandi Successi dei Cantautori',
          description: 'Un viaggio musicale tra le canzoni che hanno fatto la storia della musica italiana dagli anni 70 ad oggi.',
          sourceType: 'youtube',
          sourceUrl: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
          iframeCode: '<iframe src="https://www.youtube.com/embed/aqz-KE-bpKQ?autoplay=1&mute=1" frameborder="0" allowfullscreen></iframe>',
          sector: 'Musica Italiana',
          language: 'it',
          embedAllowed: true,
          qualityScore: 89,
          reliability: 'Medium',
          status: 'approved',
          durationMinutes: 45,
          isVertical: false,
          createdAt: new Date().toISOString()
        },
        {
          id: 'disc_musica_2',
          title: 'Indie Italiano - Le Nuove Voci del Panorama Contemporaneo',
          description: 'Brani acustici e live dei cantautori emergenti e delle band indie italiane più ascoltate.',
          sourceType: 'youtube',
          sourceUrl: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
          iframeCode: '<iframe src="https://www.youtube.com/embed/jfKfPfyJRdk?autoplay=1&mute=1" frameborder="0" allowfullscreen></iframe>',
          sector: 'Musica Italiana',
          language: 'it',
          embedAllowed: true,
          qualityScore: 90,
          reliability: 'High',
          status: 'approved',
          durationMinutes: 30,
          isVertical: false,
          createdAt: new Date().toISOString()
        },
        // Sport Italiani
        {
          id: 'disc_sport_1',
          title: 'I Momenti Storici dello Sport Italiano negli anni 2000',
          description: 'Dalla vittoria leggendaria della Nazionale ai Mondiali 2006 ai record di atletica a Tokyo.',
          sourceType: 'youtube',
          sourceUrl: 'https://www.youtube.com/watch?v=-F_McPFETY4',
          iframeCode: '<iframe src="https://www.youtube.com/embed/-F_McPFETY4?autoplay=1&mute=1" frameborder="0" allowfullscreen></iframe>',
          sector: 'Sport Italiani',
          language: 'it',
          embedAllowed: true,
          qualityScore: 95,
          reliability: 'High',
          status: 'approved',
          durationMinutes: 25,
          isVertical: false,
          createdAt: new Date().toISOString()
        },
        {
          id: 'disc_sport_2',
          title: 'Il Giro d\'Italia - La Storia e le Grandi Salite Alpine',
          description: 'Le leggendarie imprese di Coppi, Bartali, Pantani ed i moderni campioni sulle vette d\'Europa.',
          sourceType: 'youtube',
          sourceUrl: 'https://www.youtube.com/watch?v=-F_McPFETY4',
          iframeCode: '<iframe src="https://www.youtube.com/embed/-F_McPFETY4?autoplay=1&mute=1" frameborder="0" allowfullscreen></iframe>',
          sector: 'Sport Italiani',
          language: 'it',
          embedAllowed: true,
          qualityScore: 91,
          reliability: 'High',
          status: 'approved',
          durationMinutes: 20,
          isVertical: false,
          createdAt: new Date().toISOString()
        },
        // Intrattenimento
        {
          id: 'disc_intrattenimento_1',
          title: 'Migliori Sketch di Stand-up Comedy in Italiano',
          description: 'Raccolta esilarante di comicità e monologhi moderni registrati dal vivo nei teatri italiani.',
          sourceType: 'youtube',
          sourceUrl: 'https://www.youtube.com/watch?v=-F_McPFETY4',
          iframeCode: '<iframe src="https://www.youtube.com/embed/-F_McPFETY4?autoplay=1&mute=1" frameborder="0" allowfullscreen></iframe>',
          sector: 'Intrattenimento',
          language: 'it',
          embedAllowed: true,
          qualityScore: 93,
          reliability: 'High',
          status: 'approved',
          durationMinutes: 15,
          isVertical: false,
          createdAt: new Date().toISOString()
        },
        {
          id: 'disc_intrattenimento_2',
          title: 'Fanpage Cultura - Interviste Doppie e Segreti Teatrali',
          description: 'Incontri ravvicinati con attori, registi e personalità dello spettacolo italiano a cura di Fanpage.',
          sourceType: 'youtube',
          sourceUrl: 'https://www.youtube.com/watch?v=-F_McPFETY4',
          iframeCode: '<iframe src="https://www.youtube.com/embed/-F_McPFETY4?autoplay=1&mute=1" frameborder="0" allowfullscreen></iframe>',
          sector: 'Intrattenimento',
          language: 'it',
          embedAllowed: true,
          qualityScore: 88,
          reliability: 'Medium',
          status: 'approved',
          durationMinutes: 22,
          isVertical: false,
          createdAt: new Date().toISOString()
        },
        // News Italiane (TG)
        {
          id: 'disc_news_1',
          title: 'TG 24h Nazionale - Notizie ed Aggiornamenti Euronews',
          description: 'Politica, economia, cronaca e notizie internazionali aggiornate in diretta 24/7 in lingua italiana.',
          sourceType: 'youtube',
          sourceUrl: 'https://www.youtube.com/watch?v=-F_McPFETY4',
          iframeCode: '<iframe src="https://www.youtube.com/embed/-F_McPFETY4?autoplay=1&mute=1" frameborder="0" allowfullscreen></iframe>',
          sector: 'News Italiane',
          language: 'it',
          embedAllowed: true,
          qualityScore: 97,
          reliability: 'High',
          status: 'approved',
          durationMinutes: 30,
          isVertical: false,
          createdAt: new Date().toISOString()
        },
        {
          id: 'disc_news_2',
          title: 'TG 24h Nazionale - Rassegna Stampa Internazionale (Euronews)',
          description: 'Rassegna stampa live in tempo reale delle principali testate nazionali ed internazionali.',
          sourceType: 'youtube',
          sourceUrl: 'https://www.youtube.com/watch?v=-F_McPFETY4',
          iframeCode: '<iframe src="https://www.youtube.com/embed/-F_McPFETY4?autoplay=1&mute=1" frameborder="0" allowfullscreen></iframe>',
          sector: 'News Italiane',
          language: 'it',
          embedAllowed: true,
          qualityScore: 94,
          reliability: 'High',
          status: 'approved',
          durationMinutes: 30,
          isVertical: false,
          createdAt: new Date().toISOString()
        },
        {
          id: 'disc_news_3',
          title: 'TG 24h Nazionale - Ultim\'Ora Flash (Euronews)',
          description: 'Gli ultimi aggiornamenti di cronaca, geopolitica ed economia in tempo reale h24.',
          sourceType: 'youtube',
          sourceUrl: 'https://www.youtube.com/watch?v=-F_McPFETY4',
          iframeCode: '<iframe src="https://www.youtube.com/embed/-F_McPFETY4?autoplay=1&mute=1" frameborder="0" allowfullscreen></iframe>',
          sector: 'News Italiane',
          language: 'it',
          embedAllowed: true,
          qualityScore: 95,
          reliability: 'High',
          status: 'approved',
          durationMinutes: 15,
          isVertical: false,
          createdAt: new Date().toISOString()
        },
        // Meteo Nazionale
        {
          id: 'disc_meteo_1',
          title: 'Meteo.it - Edizione Mattina',
          description: 'Previsioni meteorologiche nazionali per la mattinata e tendenze per la giornata sulle regioni italiane.',
          sourceType: 'youtube',
          sourceUrl: 'https://www.youtube.com/watch?v=-F_McPFETY4',
          iframeCode: '<iframe src="https://www.youtube.com/embed/-F_McPFETY4?autoplay=1&mute=1" frameborder="0" allowfullscreen></iframe>',
          sector: 'Meteo Nazionale',
          language: 'it',
          embedAllowed: true,
          qualityScore: 96,
          reliability: 'High',
          status: 'approved',
          durationMinutes: 15,
          isVertical: false,
          createdAt: new Date().toISOString()
        },
        {
          id: 'disc_meteo_2',
          title: 'Meteo.it - Bollettino Pomeriggio ed Evoluzione',
          description: 'Situazione meteo in tempo reale, temperature massime registrate, mari e venti lungo le coste.',
          sourceType: 'youtube',
          sourceUrl: 'https://www.youtube.com/watch?v=-F_McPFETY4',
          iframeCode: '<iframe src="https://www.youtube.com/embed/-F_McPFETY4?autoplay=1&mute=1" frameborder="0" allowfullscreen></iframe>',
          sector: 'Meteo Nazionale',
          language: 'it',
          embedAllowed: true,
          qualityScore: 95,
          reliability: 'High',
          status: 'approved',
          durationMinutes: 15,
          isVertical: false,
          createdAt: new Date().toISOString()
        },
        {
          id: 'disc_meteo_3',
          title: 'Meteo.it - Edizione Sera e Tendenze di Domani',
          description: 'Le previsioni per la serata, tassi di umidità e le prime proiezioni per i próximos giorni.',
          sourceType: 'youtube',
          sourceUrl: 'https://www.youtube.com/watch?v=-F_McPFETY4',
          iframeCode: '<iframe src="https://www.youtube.com/embed/-F_McPFETY4?autoplay=1&mute=1" frameborder="0" allowfullscreen></iframe>',
          sector: 'Meteo Nazionale',
          language: 'it',
          embedAllowed: true,
          qualityScore: 95,
          reliability: 'High',
          status: 'approved',
          durationMinutes: 15,
          isVertical: false,
          createdAt: new Date().toISOString()
        },
        // Cinema Italiano
        {
          id: 'disc_cinema_1',
          title: 'Film Completo | Lo Chiamavano Trinità (Western Cult)',
          description: 'La leggendaria commedia spaghetti-western con Bud Spencer e Terence Hill. Film intero, pubblico, embed friendly.',
          sourceType: 'youtube',
          sourceUrl: 'https://www.youtube.com/watch?v=-F_McPFETY4',
          iframeCode: '<iframe src="https://www.youtube.com/embed/-F_McPFETY4?autoplay=1&mute=1" frameborder="0" allowfullscreen></iframe>',
          sector: 'Cinema Italiano',
          language: 'it',
          embedAllowed: true,
          qualityScore: 99,
          reliability: 'High',
          status: 'approved',
          durationMinutes: 115,
          isVertical: false,
          createdAt: new Date().toISOString()
        },
        {
          id: 'disc_cinema_2',
          title: 'Film Completo | Totò Truffa \'62 (Classico Cinema Italiano)',
          description: 'Una delle commedie più divertenti e celebri con Totò e Peppino De Filippo. Una pietra miliare della risata e del cinema italiano.',
          sourceType: 'youtube',
          sourceUrl: 'https://www.youtube.com/watch?v=-F_McPFETY4',
          iframeCode: '<iframe src="https://www.youtube.com/embed/-F_McPFETY4?autoplay=1&mute=1" frameborder="0" allowfullscreen></iframe>',
          sector: 'Cinema Italiano',
          language: 'it',
          embedAllowed: true,
          qualityScore: 98,
          reliability: 'High',
          status: 'approved',
          durationMinutes: 106,
          isVertical: false,
          createdAt: new Date().toISOString()
        },
        {
          id: 'disc_cinema_3',
          title: 'Film Completo | Don Camillo (Commedia Classica)',
          description: 'Celeberrimo adattamento dei racconti di Giovannino Guareschi con Fernandel e Gino Cervi. Un classico intramontabile.',
          sourceType: 'youtube',
          sourceUrl: 'https://www.youtube.com/watch?v=-F_McPFETY4',
          iframeCode: '<iframe src="https://www.youtube.com/embed/-F_McPFETY4?autoplay=1&mute=1" frameborder="0" allowfullscreen></iframe>',
          sector: 'Cinema Italiano',
          language: 'it',
          embedAllowed: true,
          qualityScore: 96,
          reliability: 'High',
          status: 'approved',
          durationMinutes: 92,
          isVertical: false,
          createdAt: new Date().toISOString()
        },
        {
          id: 'disc_appuntamento_1',
          title: 'Appuntamento al Cinema - Novità e Trailer della Settimana',
          description: 'Le ultime novità in sala, interviste esclusive ai protagonisti e trailer dei film più attesi della settimana.',
          sourceType: 'youtube',
          sourceUrl: 'https://www.youtube.com/watch?v=-F_McPFETY4',
          iframeCode: '<iframe src="https://www.youtube.com/embed/-F_McPFETY4?autoplay=1&mute=1" frameborder="0" allowfullscreen></iframe>',
          sector: 'Appuntamento al Cinema',
          language: 'it',
          embedAllowed: true,
          qualityScore: 98,
          reliability: 'High',
          status: 'approved',
          durationMinutes: 15,
          isVertical: false,
          createdAt: new Date().toISOString()
        },
        {
          id: 'disc_appuntamento_2',
          title: 'Appuntamento al Cinema - Grandi Classici e Curiosità',
          description: 'Curiosità sul cinema d\'autore italiano ed internazionale, retroscena dal set e analisi delle scene cult più famose della storia.',
          sourceType: 'youtube',
          sourceUrl: 'https://www.youtube.com/watch?v=-F_McPFETY4',
          iframeCode: '<iframe src="https://www.youtube.com/embed/-F_McPFETY4?autoplay=1&mute=1" frameborder="0" allowfullscreen></iframe>',
          sector: 'Appuntamento al Cinema',
          language: 'it',
          embedAllowed: true,
          qualityScore: 95,
          reliability: 'High',
          status: 'approved',
          durationMinutes: 15,
          isVertical: false,
          createdAt: new Date().toISOString()
        },
        {
          id: 'disc_appuntamento_3',
          title: 'Appuntamento al Cinema - Speciale Registi e Nuove Visioni',
          description: 'Speciale retrospettiva sulle uscite in arrivo, recensioni in pillole ed i consigli di visione per il weekend nelle sale italiane.',
          sourceType: 'youtube',
          sourceUrl: 'https://www.youtube.com/watch?v=-F_McPFETY4',
          iframeCode: '<iframe src="https://www.youtube.com/embed/-F_McPFETY4?autoplay=1&mute=1" frameborder="0" allowfullscreen></iframe>',
          sector: 'Appuntamento al Cinema',
          language: 'it',
          embedAllowed: true,
          qualityScore: 96,
          reliability: 'High',
          status: 'approved',
          durationMinutes: 15,
          isVertical: false,
          createdAt: new Date().toISOString()
        }
      ];
    }
    if (!state.discoveryConfig) {
      state.discoveryConfig = {
        whitelistKeywords: ['italiano', 'ricetta', 'viaggio', 'guida', 'storia', 'tech', 'recensione', 'tg', 'notizie', 'dolce', 'roma'],
        blacklistKeywords: ['vietato', 'copia', 'restricted', 'non-embed', 'english', 'subtitles only'],
        autoApproveEnabled: false,
        lastRunAt: new Date().toISOString()
      };
    }

    // Inject SYSTEM channel if missing
    if (!state.tvChannels.some(ch => ch.id === 'system')) {
      state.tvChannels.push({
        id: 'system',
        userId: 'u1',
        name: 'Palinsesti Nazionali',
        slug: 'palinsesti-nazionali',
        logoUrl: 'https://images.unsplash.com/photo-1598257006458-087169a1f08d?w=150&h=150&fit=crop',
        description: 'Contenuti e rubriche nazionali generati e moderati in automatico dal sistema.',
        status: 'active',
        monthlyFee: 0,
        createdAt: '2026-07-01T10:00:00Z'
      });
    }

    // Ensure the system categories for already approved items exist as syndicated rubrics
    const sysCategories = [
      { id: 'cat_sys_cultura', name: 'Cultura Italiana', slug: 'cultura-italiana' },
      { id: 'cat_sys_musica', name: 'Musica Italiana', slug: 'musica-italiana' },
      { id: 'cat_sys_cucina', name: 'Cucina Italiana', slug: 'cucina-italiana' },
      { id: 'cat_sys_viaggi', name: 'Viaggi in Italia', slug: 'viaggi-in-italia' },
      { id: 'cat_sys_sport', name: 'Sport Italiani', slug: 'sport-italiani' },
      { id: 'cat_sys_tecnologia', name: 'Tecnologia', slug: 'tecnologia' },
      { id: 'cat_sys_intrattenimento', name: 'Intrattenimento', slug: 'intrattenimento' },
      { id: 'cat_sys_news', name: 'News Italiane', slug: 'news-italiane' },
      { id: 'cat_sys_meteo', name: 'Meteo Nazionale', slug: 'meteo-nazionale' },
      { id: 'cat_sys_cinema', name: 'Cinema Italiano', slug: 'cinema-italiano' },
      { id: 'cat_sys_appuntamento_cinema', name: 'Appuntamento al Cinema', slug: 'appuntamento-cinema' }
    ];

    sysCategories.forEach(scat => {
      if (!state.categories.some(c => c.id === scat.id)) {
        state.categories.push({
          id: scat.id,
          tvChannelId: 'system',
          name: scat.name,
          slug: scat.slug,
          isSyndicated: true,
          createdAt: new Date().toISOString()
        });
      }
    });

    // Map sector name to system category ID
    const sectorToSysCatId: Record<string, string> = {
      'Cultura Italiana': 'cat_sys_cultura',
      'Musica Italiana': 'cat_sys_musica',
      'Cucina Italiana': 'cat_sys_cucina',
      'Viaggi in Italia': 'cat_sys_viaggi',
      'Sport Italiani': 'cat_sys_sport',
      'Tecnologia': 'cat_sys_tecnologia',
      'Intrattenimento': 'cat_sys_intrattenimento',
      'News Italiane': 'cat_sys_news',
      'Meteo Nazionale': 'cat_sys_meteo',
      'Cinema Italiano': 'cat_sys_cinema',
      'Appuntamento al Cinema': 'cat_sys_appuntamento_cinema'
    };

    // Ensure approved contents are synced into state.contents under system category
    const approvedDiscovered = state.discoveredContents.filter(d => d.status === 'approved');
    approvedDiscovered.forEach(d => {
      const sysCatId = sectorToSysCatId[d.sector];
      if (!sysCatId) return;
      const contentId = 'co_sys_' + d.id;
      if (!state.contents.some(c => c.id === contentId)) {
        state.contents.push({
          id: contentId,
          tvChannelId: 'system',
          categoryId: sysCatId,
          title: d.title,
          description: d.description,
          sourceType: d.sourceType,
          sourceUrl: d.sourceUrl,
          iframeCode: d.iframeCode,
          durationMinutes: d.durationMinutes,
          isPublic: true,
          isVertical: d.isVertical,
          createdAt: d.createdAt
        });
      }
    });

    // Ensure all active channels have a 24h daily schedule template set up initially
    const activeChannels = state.tvChannels.filter(c => c.status === 'active');
    activeChannels.forEach(ch => {
      ensure24HourSchedulesForChannel(state, ch.id);
    });

    return state;
  } catch (err) {
    console.error('Error reading database file, returning initial seed:', err);
    return INITIAL_DB;
  }
}

function writeDB(state: DBState) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing database file:', err);
  }
}

// Simple YouTube embed code generator
function generateIframeCode(url: string, title: string, isVertical: boolean = false): string {
  const trimmed = url.trim();

  // If it's already an iframe or video HTML block
  if (trimmed.startsWith('<iframe') || trimmed.includes('<iframe') || trimmed.startsWith('<video') || trimmed.includes('<video')) {
    return trimmed;
  }

  // If it's a direct HTML5 video file (.mp4, .webm, .m3u8, .ogg, .mov, etc.)
  const lowerUrl = trimmed.toLowerCase();
  const isDirectVideo = lowerUrl.endsWith('.mp4') || 
                        lowerUrl.endsWith('.webm') || 
                        lowerUrl.endsWith('.ogg') || 
                        lowerUrl.endsWith('.mov') || 
                        lowerUrl.includes('.mp4?') || 
                        lowerUrl.includes('.webm?') || 
                        lowerUrl.includes('.m3u8');

  if (isDirectVideo) {
    if (isVertical) {
      return `<video src="${trimmed}" controls autoplay muted playsinline style="width:315px; height:560px; max-height:80vh; border-radius:12px; border:2px solid #334155; object-fit:contain; background:#000;"></video>`;
    }
    return `<video src="${trimmed}" controls autoplay muted playsinline style="width:100%; height:100%; object-fit:contain; background:#000;"></video>`;
  }

  // If it's a direct HTML5 audio file (.mp3, .wav, .aac, etc.) or podcast feed
  const isDirectAudio = lowerUrl.endsWith('.mp3') || 
                        lowerUrl.endsWith('.wav') || 
                        lowerUrl.endsWith('.aac') || 
                        lowerUrl.includes('.mp3?') || 
                        lowerUrl.includes('.wav?');
  if (isDirectAudio) {
    return `<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%; height:100%; background:#0a0a0c; border-radius:12px; border:2px solid #334155; padding:24px; text-align:center;">
              <span style="font-size:32px; margin-bottom:12px;">🎙️</span>
              <p style="font-size:13px; font-weight:bold; color:#e2e8f0; margin-bottom:16px; font-family:sans-serif;">${title || 'Traccia Audio / Podcast'}</p>
              <audio src="${trimmed}" controls autoplay style="width:100%; max-width:450px;"></audio>
            </div>`;
  }

  // Spotify Support
  if (url.includes('spotify.com/')) {
    let embedUrl = trimmed;
    if (embedUrl.includes('open.spotify.com/')) {
      embedUrl = embedUrl.replace('open.spotify.com/', 'open.spotify.com/embed/');
    }
    return `<iframe src="${embedUrl}" width="100%" height="352" frameborder="0" allowtransparency="true" allow="encrypted-media; clipboard-write; picture-in-picture" style="border-radius:12px; border:1px solid #1e293b;"></iframe>`;
  }

  // TikTok Support
  if (url.includes('tiktok.com/')) {
    const match = url.match(/\/video\/(\d+)/);
    const tiktokId = match ? match[1] : '';
    if (tiktokId) {
      return `<iframe src="https://www.tiktok.com/embed/v2/${tiktokId}" width="100%" height="700" frameborder="0" allowfullscreen style="max-width: 605px; width: 100%; height: 700px; display: block; margin: 0 auto; border-radius: 8px;"></iframe>`;
    }
  }

  // SoundCloud Support
  if (url.includes('soundcloud.com/')) {
    const embedUrl = `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23ff5500&auto_play=true&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true&visual=true`;
    return `<iframe width="100%" height="300" scrolling="no" frameborder="no" allow="autoplay" src="${embedUrl}" style="border-radius:12px; border:1px solid #1e293b;"></iframe>`;
  }

  let videoId = '';
  // Match standard, share, shorts and embed patterns
  if (url.includes('youtu.be/')) {
    videoId = url.split('youtu.be/')[1]?.split(/[?#]/)[0] || '';
  } else if (url.includes('youtube.com/embed/')) {
    videoId = url.split('youtube.com/embed/')[1]?.split(/[?#]/)[0] || '';
  } else if (url.includes('youtube.com/shorts/')) {
    videoId = url.split('youtube.com/shorts/')[1]?.split(/[?#]/)[0] || '';
  } else if (url.includes('youtube.com/live/')) {
    videoId = url.split('youtube.com/live/')[1]?.split(/[?#]/)[0] || '';
  } else if (url.includes('watch?v=')) {
    videoId = url.split('watch?v=')[1]?.split('&')[0] || '';
  }

  if (videoId) {
    const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&enablejsapi=1&rel=0`;
    if (isVertical) {
      return `<iframe src="${embedUrl}" width="315" height="560" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="aspect-ratio: 9/16; max-height: 80vh; border-radius: 12px; border: 2px solid #334155;"></iframe>`;
    }
    return `<iframe src="${embedUrl}" width="100%" height="100%" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="aspect-ratio: 16/9; width: 100%; height: 100%;"></iframe>`;
  }

  // Vimeo Support
  if (url.includes('vimeo.com/')) {
    const vimeoId = url.split('vimeo.com/')[1]?.split(/[?#]/)[0];
    if (vimeoId) {
      return `<iframe src="https://player.vimeo.com/video/${vimeoId}?autoplay=1&muted=1" width="100%" height="100%" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
    }
  }

  // Facebook Support
  if (url.includes('facebook.com/') || url.includes('fb.watch/')) {
    const embedUrl = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=0&autoplay=true&mute=true`;
    return `<iframe src="${embedUrl}" width="100%" height="100%" style="border:none;overflow:hidden;aspect-ratio:16/9;width:100%;height:100%;" scrolling="no" frameborder="0" allowfullscreen="true" allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"></iframe>`;
  }

  // Twitch Support
  if (url.includes('twitch.tv/')) {
    let twitchChannel = '';
    let twitchVideo = '';
    if (url.includes('/videos/')) {
      twitchVideo = url.split('/videos/')[1]?.split(/[?#]/)[0] || '';
    } else {
      twitchChannel = url.split('twitch.tv/')[1]?.split(/[?#]/)[0] || '';
    }
    let embedUrl = 'https://player.twitch.tv/?';
    if (twitchVideo) {
      embedUrl += `video=${twitchVideo}`;
    } else if (twitchChannel) {
      embedUrl += `channel=${twitchChannel}`;
    }
    // Set typical hosting domains as parents for proper iframe authorization
    embedUrl += `&parent=localhost&parent=ai.studio&parent=google.com&parent=europe-west2.run.app&autoplay=true&muted=true`;
    return `<iframe src="${embedUrl}" width="100%" height="100%" frameborder="0" allowfullscreen="true" scrolling="no" allow="autoplay; encrypted-media; picture-in-picture" style="aspect-ratio:16/9;width:100%;height:100%;"></iframe>`;
  }

  // Fallback direct iframe URL or custom embedding
  return `<iframe src="${url}" width="100%" height="100%" frameborder="0" allow="autoplay; fullscreen" allowfullscreen></iframe>`;
}

// --- YOUTUBE REAL VIDEO VALIDATOR (NO API KEY REQUIRED) ---
function extractYouTubeId(url: string): string | null {
  try {
    const trimmed = url.trim();
    if (trimmed.includes('youtu.be/')) {
      return trimmed.split('youtu.be/')[1]?.split(/[?#]/)[0] || null;
    } else if (trimmed.includes('youtube.com/embed/')) {
      return trimmed.split('youtube.com/embed/')[1]?.split(/[?#]/)[0] || null;
    } else if (trimmed.includes('youtube.com/shorts/')) {
      return trimmed.split('youtube.com/shorts/')[1]?.split(/[?#]/)[0] || null;
    } else if (trimmed.includes('youtube.com/live/')) {
      return trimmed.split('youtube.com/live/')[1]?.split(/[?#]/)[0] || null;
    } else if (trimmed.includes('watch?v=')) {
      return trimmed.split('watch?v=')[1]?.split('&')[0] || null;
    }
    const match = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/|live\/))([a-zA-Z0-9_-]{11})/);
    if (match) return match[1];
    return null;
  } catch {
    return null;
  }
}

async function checkRealYouTubeVideoNoAPI(url: string): Promise<{ ok: boolean; reason?: string; videoId?: string; title?: string }> {
  const videoId = extractYouTubeId(url);
  if (!videoId) {
    return { ok: false, reason: "Link non YouTube o ID del video non valido" };
  }

  try {
    const oEmbedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const response = await fetch(oEmbedUrl);
    
    if (response.status === 200) {
      const data: any = await response.json();
      return {
        ok: true,
        videoId,
        title: data.title
      };
    } else if (response.status === 401 || response.status === 403) {
      return { ok: false, reason: "Questo video esiste ma l'incameramento (embed) è stato disattivato dall'autore o è un video privato." };
    } else {
      return { ok: false, reason: "Video inesistente su YouTube o rimosso." };
    }
  } catch (err) {
    // Fallback: Check headers of the embed page
    try {
      const embedUrl = `https://www.youtube.com/embed/${videoId}`;
      const embedResponse = await fetch(embedUrl, { method: 'HEAD' });
      if (embedResponse.status === 200) {
        return { ok: true, videoId };
      }
    } catch (headErr) {
      // ignore
    }
    return { ok: false, reason: "Impossibile contattare YouTube per verificare il video. Riprova più tardi." };
  }
}

// Start building Server
async function startServer() {
  // Pre-load and heal the database state immediately on startup
  try {
    readDB();
  } catch (err) {
    console.error('Error pre-loading or healing database state on startup:', err);
  }

  const app = express();
  app.use(express.json());

  // Log API request actions
  app.use((req, res, next) => {
    console.log(`[API Request] ${req.method} ${req.url}`);
    next();
  });

  // --- API ROUTE: AUTHENTICATION ---
  app.post('/api/auth/login', (req, res) => {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    const db = readDB();
    let user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (!user) {
      // Auto-register as tv_owner or admin based on domain/pre-seeds, otherwise standard owner
      const isFirstAdmin = email.toLowerCase() === 'admin@metatv.com';
      user = {
        id: 'u_' + Math.random().toString(36).substring(2, 9),
        email: email.toLowerCase(),
        role: isFirstAdmin ? 'admin' : 'tv_owner',
        createdAt: new Date().toISOString()
      };
      db.users.push(user);
      writeDB(db);
    }

    // Find if user owns a channel or is a collaborator
    const channel = db.tvChannels.find(ch => ch.userId === user.id);
    const collaborator = db.collaborators.find(col => col.email.toLowerCase() === email.toLowerCase());
    
    let activeChannelId = channel?.id;
    let computedRole = user.role;

    if (collaborator) {
      activeChannelId = collaborator.tvChannelId;
      computedRole = 'collaborator';
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        role: computedRole,
        collaboratorRole: collaborator?.role,
        channelId: activeChannelId
      }
    });
  });

  // Create Registration request for approval
  app.post('/api/auth/register', (req, res) => {
    const { email, channelName, description } = req.body;
    if (!email || !channelName) {
      res.status(400).json({ error: 'Email and channel name are required' });
      return;
    }

    const db = readDB();
    const newRequest: RegistrationRequest = {
      id: 'req_' + Math.random().toString(36).substring(2, 9),
      email: email.toLowerCase(),
      channelName,
      description: description || '',
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    db.registrationRequests.push(newRequest);
    writeDB(db);
    res.json({ success: true, request: newRequest });
  });

  // --- API ROUTE: REGISTRATION REQUESTS & APPROVALS (ADMIN) ---
  app.get('/api/admin/requests', (req, res) => {
    const db = readDB();
    res.json(db.registrationRequests);
  });

  app.post('/api/admin/requests/:id/approve', (req, res) => {
    const { id } = req.params;
    const { action } = req.body; // 'approve' or 'reject'
    
    const db = readDB();
    const requestIndex = db.registrationRequests.findIndex(r => r.id === id);
    if (requestIndex === -1) {
      res.status(404).json({ error: 'Request not found' });
      return;
    }

    const request = db.registrationRequests[requestIndex];
    request.status = action === 'approve' ? 'approved' : 'rejected';

    if (action === 'approve') {
      // Check if user already exists
      let user = db.users.find(u => u.email.toLowerCase() === request.email.toLowerCase());
      if (!user) {
        user = {
          id: 'u_' + Math.random().toString(36).substring(2, 9),
          email: request.email,
          role: 'tv_owner',
          createdAt: new Date().toISOString()
        };
        db.users.push(user);
      }

      // Create beautiful new TV channel
      const baseSlug = request.channelName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const slugSuffix = Math.random().toString(36).substring(2, 5);
      const slug = `${baseSlug}-${slugSuffix}`;

      const newChannel: TVChannel = {
        id: 'ch_' + Math.random().toString(36).substring(2, 9),
        userId: user.id,
        name: request.channelName,
        slug,
        logoUrl: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=150&h=150&fit=crop', // default nice icon
        description: request.description,
        status: 'active',
        monthlyFee: db.subscriptionPricing.defaultMonthlyFee,
        apiKey: 'apikey_' + Math.random().toString(36).substring(2, 10),
        createdAt: new Date().toISOString()
      };

      db.tvChannels.push(newChannel);
      ensure24HourSchedulesForChannel(db, newChannel.id, true, true);
    }

    writeDB(db);
    res.json({ success: true, request });
  });

  // --- API ROUTE: SYSTEM STATISTICS (ADMIN) ---
  app.get('/api/admin/system-stats', (req, res) => {
    const db = readDB();
    const activeChannelsCount = db.tvChannels.filter(c => c.status === 'active').length;
    const pendingRequestsCount = db.registrationRequests.filter(r => r.status === 'pending').length;
    const totalContentsCount = db.contents.length;
    
    // Total simulated revenue
    const estimatedRevenue = db.tvChannels
      .filter(c => c.status === 'active')
      .reduce((sum, c) => sum + (c.monthlyFee || 0), 0);

    res.json({
      activeChannels: activeChannelsCount,
      pendingRequests: pendingRequestsCount,
      totalContents: totalContentsCount,
      monthlyRevenue: estimatedRevenue,
      defaultMonthlyFee: db.subscriptionPricing.defaultMonthlyFee
    });
  });

  app.post('/api/admin/subscription-config', (req, res) => {
    const { defaultMonthlyFee } = req.body;
    if (typeof defaultMonthlyFee !== 'number') {
      res.status(400).json({ error: 'Pricing must be a number' });
      return;
    }
    const db = readDB();
    db.subscriptionPricing.defaultMonthlyFee = defaultMonthlyFee;
    writeDB(db);
    res.json({ success: true, defaultMonthlyFee });
  });

  // Reset database contents, schedules, and discovered contents to starting from zero
  app.post('/api/admin/clear-db', (req, res) => {
    const db = readDB();
    db.contents = [];
    db.schedules = [];
    db.discoveredContents = [];
    db.activityLogs = [];
    db.isCleared = true;
    writeDB(db);
    res.json({ success: true, message: 'Tutti i contenuti, i palinsesti e le scoperte automatiche sono stati azzerati con successo! Adesso puoi iniziare da zero.' });
  });

  // Toggle active/suspended channel
  app.put('/api/admin/channels/:id', (req, res) => {
    const { id } = req.params;
    const { status, monthlyFee } = req.body;

    const db = readDB();
    const ch = db.tvChannels.find(c => c.id === id);
    if (!ch) {
      res.status(404).json({ error: 'Channel not found' });
      return;
    }

    if (status) ch.status = status;
    if (typeof monthlyFee === 'number') ch.monthlyFee = monthlyFee;

    writeDB(db);
    res.json({ success: true, channel: ch });
  });

  // --- CONTENT DISCOVERY & CLASSIFICATION ENGINE (BACKEND DATABASE) ---
  const CRAWLER_DATABASE = [
    {
      title: 'La Ricetta Originale dei Cannoli Siciliani',
      description: 'Il segreto per la buccia croccante e il ripieno cremoso di ricotta fresca.',
      sourceUrl: 'https://www.youtube.com/watch?v=3AAdKl1UYZs',
      sector: 'Cucina Italiana',
      durationMinutes: 14,
      isVertical: false
    },
    {
      title: 'Come fare il Pane Fatto in Casa come una volta',
      description: 'Lievitazione naturale, crosta dorata e alveolatura perfetta spiegata passo passo.',
      sourceUrl: 'https://www.youtube.com/watch?v=F3GvH5A1n8E',
      sector: 'Cucina Italiana',
      durationMinutes: 18,
      isVertical: false
    },
    {
      title: 'Venezia Segreta - Itinerario fuori dai sentieri turistici',
      description: 'I canali nascosti, i bacari storici e gli angoli più suggestivi della laguna veneta.',
      sourceUrl: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
      sector: 'Viaggi in Italia',
      durationMinutes: 22,
      isVertical: false
    },
    {
      title: 'Costiera Amalfitana in Vespa - Tour Emozionante',
      description: 'Un viaggio mozzafiato lungo la statale amalfitana da Positano a Ravello.',
      sourceUrl: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
      sector: 'Viaggi in Italia',
      durationMinutes: 16,
      isVertical: false
    },
    {
      title: 'I Grandi Successi di Lucio Dalla - Tributo Acustico',
      description: 'Le canzoni più belle del maestro bolognese reinterpretate dal vivo.',
      sourceUrl: 'https://www.youtube.com/watch?v=J8n8K3z0eFE',
      sector: 'Musica Italiana',
      durationMinutes: 30,
      isVertical: false
    },
    {
      title: 'Indie Italiano 2026 - Le Nuove Voci Più Promettenti',
      description: 'Playlist curata delle migliori canzoni indie emergenti del panorama nazionale.',
      sourceUrl: 'https://www.youtube.com/watch?v=K8j8L-7K8Lw',
      sector: 'Musica Italiana',
      durationMinutes: 50,
      isVertical: false
    },
    {
      title: 'I momenti storici dello Sport Italiano negli anni 2000',
      description: 'Dalla vittoria dei Mondiali 2006 ai record di Jacobs e Tamberi a Tokyo.',
      sourceUrl: 'https://www.youtube.com/watch?v=J8j8L-7K8Mw',
      sector: 'Sport Italiani',
      durationMinutes: 25,
      isVertical: false
    },
    {
      title: 'Giro d\'Italia 2026 - La Tappa Regina sulle Alpi',
      description: 'Sintesi ufficiale ed emozioni della scalata sullo Stelvio sotto la neve.',
      sourceUrl: 'https://www.youtube.com/watch?v=18bZia7GqB4',
      sector: 'Sport Italiani',
      durationMinutes: 15,
      isVertical: false
    },
    {
      title: 'Raffaello Sanzio e la stanza della Segnatura in Vaticano',
      description: 'Visita guidata virtuale ad uno dei capolavori pittorici più importanti del mondo.',
      sourceUrl: 'https://www.youtube.com/watch?v=rW_8v0N02kI',
      sector: 'Cultura Italiana',
      durationMinutes: 19,
      isVertical: false
    },
    {
      title: 'La Storia di Pompei - L\'Ultimo Giorno',
      description: 'Documentario interattivo sull\'eruzione del Vesuvio e la vita nella città romana.',
      sourceUrl: 'https://www.youtube.com/watch?v=6K_F8U2W61g',
      sector: 'Cultura Italiana',
      durationMinutes: 32,
      isVertical: false
    },
    {
      title: 'Il Supercomputer Leonardo a Bologna - Orgoglio Italiano',
      description: 'Uno dei computer più potenti del mondo dedicato alla ricerca scientifica ed industriale.',
      sourceUrl: 'https://www.youtube.com/watch?v=mN0zUx85XX0',
      sector: 'Tecnologia',
      durationMinutes: 10,
      isVertical: false
    },
    {
      title: 'Recensione Completa Auto Elettrica Italiana 2026',
      description: 'Test su strada del nuovo gioiello elettrico progettato e prodotto interamente in Italia.',
      sourceUrl: 'https://www.youtube.com/watch?v=3M6O8xsc8YQ',
      sector: 'Tecnologia',
      durationMinutes: 14,
      isVertical: false
    },
    {
      title: 'Intervista Doppia ai Migliori Stand-up Comedian Italiani',
      description: 'Risate e riflessioni sul mestiere del comico oggi nel nostro Paese.',
      sourceUrl: 'https://www.youtube.com/watch?v=5V9A1X4vXgY',
      sector: 'Intrattenimento',
      durationMinutes: 20,
      isVertical: false
    },
    {
      title: 'Podcast Attualità e Cultura - Episodio Speciale',
      description: 'Discussione aperta con registi, attori e scrittori italiani contemporanei.',
      sourceUrl: 'https://www.youtube.com/watch?v=7X9A1X4vXgZ',
      sector: 'Intrattenimento',
      durationMinutes: 45,
      isVertical: false
    },
    {
      title: 'TG 24h Nazionale - Rassegna Stampa Internazionale (Euronews)',
      description: 'Le notizie più importanti dai quotidiani italiani ed esteri commentate in diretta live.',
      sourceUrl: 'https://www.youtube.com/watch?v=fG7ObeSNo7A',
      sector: 'News Italiane',
      durationMinutes: 15,
      isVertical: false
    },
    {
      title: 'TG 24h Nazionale - Speciale TG Economia (Euronews)',
      description: 'Notizie ed analisi sull\'andamento delle imprese d\'eccellenza e dei mercati finanziari.',
      sourceUrl: 'https://www.youtube.com/watch?v=F3_wH0z9U4E',
      sector: 'News Italiane',
      durationMinutes: 12,
      isVertical: false
    },
    {
      title: 'La Chance - Film Completo',
      description: 'Film poliziesco italiano completo, diretto da Aldo Lado e interpretato da Luc Merenda. Splendido classico del cinema poliziesco anni \'70.',
      sourceUrl: 'https://www.youtube.com/watch?v=szsCreuVlh0',
      sector: 'Cinema Italiano',
      durationMinutes: 95,
      isVertical: false
    },
    {
      title: 'Wake Up and Kill (Svegliati e uccidi) - Film Completo',
      description: 'Celebre film poliziesco del 1966 diretto da Carlo Lizzani, con Robert Hoffmann e Gian Maria Volonté. La storia del bandito della Milano solista del mitra.',
      sourceUrl: 'https://www.youtube.com/watch?v=5LalhOIW6SI',
      sector: 'Cinema Italiano',
      durationMinutes: 118,
      isVertical: false
    },
    {
      title: 'Gli Ultimi Cinque Minuti - Film Completo',
      description: 'Splendida commedia d\'epoca italiana diretta da Giuseppe Amato, con uno straordinario cast teatrale ed esponenti del neorealismo rosa.',
      sourceUrl: 'https://www.youtube.com/watch?v=jChaLsnw8Tw',
      sector: 'Cinema Italiano',
      durationMinutes: 92,
      isVertical: false
    },
    {
      title: 'I Guappi - Film Completo',
      description: 'Capolavoro drammatico del 1974 diretto da Pasquale Squitieri, ambientato a Napoli con Franco Nero e Fabio Testi. Uno spaccato storico indimenticabile.',
      sourceUrl: 'https://www.youtube.com/watch?v=t7HF3phYo2A',
      sector: 'Cinema Italiano',
      durationMinutes: 125,
      isVertical: false
    },
    {
      title: 'Jack London Story - Film Completo',
      description: 'Un film avventuroso d\'altri tempi basato sulla leggendaria, spericolata ed entusiasmante vita dello scrittore Jack London.',
      sourceUrl: 'https://www.youtube.com/watch?v=AGSci7Oo_W0',
      sector: 'Cinema Italiano',
      durationMinutes: 100,
      isVertical: false
    },
    {
      title: 'Il Tetto di Vittorio De Sica - Film Completo',
      description: 'Splendida pellicola del 1956 diretta da Vittorio De Sica, pietra miliare del neorealismo italiano.',
      sourceUrl: 'https://www.youtube.com/watch?v=vdMmE-ZIKVY',
      sector: 'Cinema Italiano',
      durationMinutes: 91,
      isVertical: false
    },
    {
      title: 'La Fortuna di Essere Donna (Sophia Loren) - Film Completo',
      description: 'Divertente commedia del 1956 diretta da Alessandro Blasetti, interpretata da Sophia Loren e Marcello Mastroianni.',
      sourceUrl: 'https://www.youtube.com/watch?v=07BfHSWPiMk',
      sector: 'Cinema Italiano',
      durationMinutes: 96,
      isVertical: false
    },
    {
      title: 'Finalmente Sposi - Film Completo',
      description: 'Commedia brillante diretta da Lello Arena con il duo comico Arteteca, un\'avventura matrimoniale esilarante tra Napoli e l\'estero.',
      sourceUrl: 'https://www.youtube.com/watch?v=LA2CjDP3kfQ',
      sector: 'Cinema Italiano',
      durationMinutes: 90,
      isVertical: false
    },
    {
      title: 'Lo Smemorato di Collegno (Totò) - Film Completo',
      description: 'Film commedia del 1962 diretto da Sergio Corbucci con lo straordinario Totò. Una satira pungente ispirata a un celebre caso giudiziario.',
      sourceUrl: 'https://www.youtube.com/watch?v=hCH0-sYG-jI',
      sector: 'Cinema Italiano',
      durationMinutes: 89,
      isVertical: false
    },
    {
      title: 'La Vita Ricomincia - Film Completo',
      description: 'Intenso dramma del 1945 diretto da Mario Mattoli con Alida Valli e Fosco Giachetti, uno spaccato del dopoguerra italiano.',
      sourceUrl: 'https://www.youtube.com/watch?v=8hGMduw1aOo',
      sector: 'Cinema Italiano',
      durationMinutes: 85,
      isVertical: false
    },
    {
      title: 'Commissariato di Notturna - Film Completo',
      description: 'Film poliziesco italiano d\'azione del 1974 diretto da Guido Leoni, con Gastone Moschin e George Ardisson.',
      sourceUrl: 'https://www.youtube.com/watch?v=2ytNa_4jVPU',
      sector: 'Cinema Italiano',
      durationMinutes: 92,
      isVertical: false
    },
    {
      title: 'Il grande colpo dei 7 uomini d\'oro - Film Completo',
      description: 'Un classico dello spionaggio e della commedia all\'italiana del 1966 diretto da Marco Vicario, avventura ad alta tensione.',
      sourceUrl: 'https://www.youtube.com/watch?v=vaECHoCVRYY',
      sector: 'Cinema Italiano',
      durationMinutes: 98,
      isVertical: false
    },
    {
      title: 'La sedia a rotelle - Film Completo',
      description: 'Intenso film drammatico e poliziesco d\'autore che affronta tematiche sociali e di giustizia con grande sensibilità.',
      sourceUrl: 'https://www.youtube.com/watch?v=5QyzVn58gxM',
      sector: 'Cinema Italiano',
      durationMinutes: 94,
      isVertical: false
    },
    {
      title: 'Domenica d\'Agosto - Film Completo',
      description: 'Celebre film del 1950 diretto da Luciano Emmer. Una splendida e corale commedia drammatica sulle spiagge di Ostia nel dopoguerra.',
      sourceUrl: 'https://www.youtube.com/watch?v=FQ0TJRVLUYU',
      sector: 'Cinema Italiano',
      durationMinutes: 88,
      isVertical: false
    }
  ];

  app.get('/api/admin/discovery', (req, res) => {
    const db = readDB();
    res.json({
      contents: db.discoveredContents || [],
      config: db.discoveryConfig
    });
  });

  app.get('/api/admin/discovery/config', (req, res) => {
    const db = readDB();
    res.json(db.discoveryConfig);
  });

  app.post('/api/admin/discovery/config', (req, res) => {
    const { whitelistKeywords, blacklistKeywords, autoApproveEnabled } = req.body;
    const db = readDB();
    if (!db.discoveryConfig) {
      db.discoveryConfig = { whitelistKeywords: [], blacklistKeywords: [], autoApproveEnabled: false };
    }
    if (Array.isArray(whitelistKeywords)) db.discoveryConfig.whitelistKeywords = whitelistKeywords;
    if (Array.isArray(blacklistKeywords)) db.discoveryConfig.blacklistKeywords = blacklistKeywords;
    if (typeof autoApproveEnabled === 'boolean') db.discoveryConfig.autoApproveEnabled = autoApproveEnabled;
    
    writeDB(db);
    res.json({ success: true, config: db.discoveryConfig });
  });

  // Approved discovered content helper
  function approveDiscoveredItem(db: DBState, item: any) {
    item.status = 'approved';
    
    // Create / Find category
    const sectorSlug = item.sector.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const catId = `cat_sys_${sectorSlug}`;
    
    let existingCat = db.categories.find(c => c.id === catId);
    if (!existingCat) {
      existingCat = {
        id: catId,
        tvChannelId: 'system',
        name: item.sector,
        slug: sectorSlug,
        isSyndicated: true,
        createdAt: new Date().toISOString()
      };
      db.categories.push(existingCat);
    }

    // Create public content item
    const contentId = `co_sys_${item.id}`;
    if (!db.contents.some(c => c.id === contentId)) {
      db.contents.push({
        id: contentId,
        tvChannelId: 'system',
        categoryId: catId,
        title: item.title,
        description: item.description,
        sourceType: item.sourceType || 'youtube',
        sourceUrl: item.sourceUrl,
        iframeCode: item.iframeCode || generateIframeCode(item.sourceUrl, item.title, item.isVertical),
        durationMinutes: item.durationMinutes || 15,
        isPublic: true,
        isVertical: !!item.isVertical,
        createdAt: new Date().toISOString()
      });
    }
  }

  // Trigger Content Discovery & Classification Engine with LIVE scan
  app.post('/api/admin/discovery/trigger', async (req, res) => {
    const { topic } = req.body;
    const db = readDB();
    const config = db.discoveryConfig || { whitelistKeywords: [], blacklistKeywords: [], autoApproveEnabled: false };
    
    // Choose sector: either the requested topic or a random standard sector
    const sectors = [
      'Cucina Italiana',
      'Viaggi in Italia',
      'Musica Italiana',
      'Sport Italiani',
      'Cultura Italiana',
      'Tecnologia',
      'Intrattenimento',
      'News Italiane',
      'Cinema Italiano',
      'Appuntamento al Cinema'
    ];
    const targetSector = (topic && typeof topic === 'string' && topic.trim()) 
      ? topic.trim() 
      : sectors[Math.floor(Math.random() * sectors.length)];
    
    try {
      console.log(`[Admin Discovery] Avvio scansione live automatica per settore: "${targetSector}"...`);
      
      const prompt = `Trova esattamente 5-6 video di YouTube reali, attivi e pubblici in lingua italiana riguardanti l'argomento: "${targetSector}".
I video devono essere pertinenti, di alta qualità ed educativi o d'intrattenimento su questo tema.
Per ciascun video, fornisci le seguenti informazioni strutturate:
- title: Il titolo reale del video.
- description: Una breve descrizione o riassunto in italiano.
- sourceUrl: L'indirizzo URL di YouTube (es: "https://www.youtube.com/watch?v=...").
- durationMinutes: Durata stimata in minuti (da 1 a 60).
- sector: "${targetSector}".

IMPORTANTE: Restituisci esclusivamente un array JSON valido coerente con lo schema. I link devono essere reali ed esistenti.`;

      let candidates: any[] = [];
      try {
        const geminiResponse = await generateContentWithFallback({
          contents: prompt,
          config: {
            tools: [{ googleSearch: {} }],
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  sourceUrl: { type: Type.STRING },
                  durationMinutes: { type: Type.INTEGER },
                  sector: { type: Type.STRING }
                },
                required: ["title", "description", "sourceUrl", "durationMinutes"]
              }
            }
          }
        });

        const jsonStr = geminiResponse.text?.trim() || "[]";
        try {
          candidates = JSON.parse(jsonStr);
        } catch (err) {
          console.error("Errore nel parsing del JSON di Gemini:", err, "Raw string:", jsonStr);
          const match = jsonStr.match(/\[[\s\S]*\]/);
          if (match) {
            candidates = JSON.parse(match[0]);
          }
        }
      } catch (geminiErr: any) {
        console.warn("[Admin Discovery] Errore API Gemini o quota superata. Utilizzo fallback locale resiliente...", geminiErr.message || geminiErr);
        const q = targetSector.toLowerCase();
        let filtered = CRAWLER_DATABASE.filter(item => 
          item.title.toLowerCase().includes(q) || 
          item.description.toLowerCase().includes(q) ||
          item.sector.toLowerCase().includes(q) ||
          ((q === 'cinema' || q === 'film' || q === 'moviedome' || q === 'film completi') ? item.sector === 'Cinema Italiano' : false)
        );
        if (filtered.length === 0) {
          filtered = CRAWLER_DATABASE.filter(item => item.sector === 'Cinema Italiano');
        }
        if (filtered.length === 0) {
          filtered = CRAWLER_DATABASE.slice(0, 5);
        }
        candidates = filtered.map(item => ({
          title: item.title,
          description: item.description,
          sourceUrl: item.sourceUrl,
          durationMinutes: item.durationMinutes,
          sector: item.sector,
          isVertical: item.isVertical
        }));
      }

      console.log(`[Admin Discovery] Gemini ha restituito ${candidates.length} candidati. Avvio validazione reale...`);

      const newlyDiscovered: any[] = [];
      
      for (const cand of candidates) {
        const url = cand.sourceUrl;
        const validation = await checkRealYouTubeVideoNoAPI(url);
        
        const id = 'disc_auto_' + Math.random().toString(36).substring(2, 9);
        const videoId = validation.videoId || extractYouTubeId(url);
        const iframeCode = videoId ? `<iframe src="https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>` : '';
        const isVertical = url.includes('/shorts/') || !!cand.isVertical;

        const isBlacklisted = config.blacklistKeywords?.some((kw: string) => 
          cand.title.toLowerCase().includes(kw.toLowerCase()) || cand.description.toLowerCase().includes(kw.toLowerCase())
        );

        const embedAllowed = validation.ok && !isBlacklisted;
        const status: 'approved' | 'rejected' = embedAllowed ? 'approved' : 'rejected';
        const reason = !validation.ok ? (validation.reason || "Non incorporabile") : (isBlacklisted ? "In blacklist" : undefined);

        const item = {
          id,
          title: validation.title || cand.title,
          description: cand.description,
          sourceType: 'youtube' as const,
          sourceUrl: url,
          iframeCode,
          sector: cand.sector || targetSector,
          language: 'it',
          embedAllowed,
          qualityScore: embedAllowed ? 95 : 10,
          reliability: embedAllowed ? 'High' as const : 'Low' as const,
          status,
          reason,
          durationMinutes: cand.durationMinutes || 10,
          isVertical,
          createdAt: new Date().toISOString()
        };

        const isDup = db.discoveredContents!.some(existing => existing.sourceUrl === item.sourceUrl);
        if (!isDup) {
          db.discoveredContents!.push(item);
          newlyDiscovered.push(item);
        }

        // If approved, create the syndicated "Rubrica Nazionale"
        if (item.status === 'approved') {
          approveDiscoveredItem(db, item);
        }
      }

      // Automatically clone approved items to any channels that use auto-scheduling to instantly fill schedules
      db.tvChannels.forEach(ch => {
        let hasNewCloned = false;
        
        newlyDiscovered.forEach(discItem => {
          if (discItem.status === 'approved') {
            const sectorSlug = discItem.sector.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            let channelCat = db.categories.find(c => c.tvChannelId === ch.id && c.slug === sectorSlug);
            if (!channelCat) {
              channelCat = {
                id: 'cat_cln_' + Math.random().toString(36).substring(2, 9),
                tvChannelId: ch.id,
                name: discItem.sector,
                slug: sectorSlug,
                isSyndicated: false,
                createdAt: new Date().toISOString()
              };
              db.categories.push(channelCat);
            }

            const exists = db.contents.some(c => c.tvChannelId === ch.id && c.sourceUrl === discItem.sourceUrl);
            if (!exists) {
              db.contents.push({
                id: 'co_cln_' + Math.random().toString(36).substring(2, 9),
                tvChannelId: ch.id,
                categoryId: channelCat.id,
                title: discItem.title,
                description: discItem.description,
                sourceType: 'youtube' as const,
                sourceUrl: discItem.sourceUrl,
                iframeCode: discItem.iframeCode,
                durationMinutes: discItem.durationMinutes,
                isPublic: true,
                isVertical: discItem.isVertical,
                createdAt: new Date().toISOString()
              });
              hasNewCloned = true;
            }
          }
        });

        if (hasNewCloned) {
          ensure24HourSchedulesForChannel(db, ch.id, true);
        }
      });

      config.lastRunAt = new Date().toISOString();
      db.discoveryConfig = config;
      writeDB(db);

      const approvedCount = newlyDiscovered.filter(i => i.status === 'approved').length;
      res.json({
        success: true,
        message: `Scansione completata per il settore "${targetSector}"! Trovati ${newlyDiscovered.length} video reali, di cui ${approvedCount} verificati, idonei ed inseriti come Rubrica Nazionale ed in tutti i palinsesti dei canali.`,
        addedCount: newlyDiscovered.length,
        approvedCount,
        config: config
      });

    } catch (error: any) {
      console.error("Errore durante la scansione di scoperta automatica:", error);
      res.status(500).json({ error: error.message || "Errore sconosciuto durante la scansione automatica." });
    }
  });

  // Live YouTube Scan and Verification using Gemini + oEmbed Validation
  app.post('/api/admin/discovery/live-scan', async (req, res) => {
    const { topic, channelId } = req.body;
    if (!topic || typeof topic !== 'string' || !topic.trim()) {
      res.status(400).json({ error: "L'argomento della scansione è obbligatorio." });
      return;
    }

    try {
      console.log(`Avvio scansione live di YouTube con Gemini per argomento: "${topic}"...`);

      const prompt = `Trova esattamente 8-10 video di YouTube reali, attivi e pubblici in lingua italiana riguardanti l'argomento: "${topic}".
I video devono essere pertinenti ed educativi o d'intrattenimento su questo tema.
Per ciascun video, estrai e fornisci le seguenti informazioni strutturate:
- title: Il titolo reale del video.
- description: Una breve descrizione o sintesi in italiano.
- sourceUrl: L'indirizzo URL completo di YouTube (es: "https://www.youtube.com/watch?v=..." oppure un video Shorts "https://www.youtube.com/shorts/...").
- durationMinutes: La durata stimata in minuti (da 1 a 60).
- sector: L'argomento o settore specificato ("${topic}").

IMPORTANTE: Restituisci solo ed esclusivamente l'array JSON valido corrispondente allo schema richiesto. I link di YouTube DEVONO essere REALI ed esistenti.`;

      let candidates: any[] = [];
      try {
        const geminiResponse = await generateContentWithFallback({
          contents: prompt,
          config: {
            tools: [{ googleSearch: {} }],
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  sourceUrl: { type: Type.STRING },
                  durationMinutes: { type: Type.INTEGER },
                  sector: { type: Type.STRING }
                },
                required: ["title", "description", "sourceUrl", "durationMinutes"]
              }
            }
          }
        });

        const jsonStr = geminiResponse.text?.trim() || "[]";
        try {
          candidates = JSON.parse(jsonStr);
        } catch (err) {
          console.error("Errore nel parsing del JSON di Gemini:", err, "Raw string:", jsonStr);
          // Fallback simple parsing if format was slightly off or wrapped
          const match = jsonStr.match(/\[[\s\S]*\]/);
          if (match) {
            candidates = JSON.parse(match[0]);
          } else {
            throw new Error("Impossibile interpretare i risultati della ricerca di Gemini.");
          }
        }
      } catch (geminiErr: any) {
        console.warn("[Live Scan] Errore API Gemini o quota superata. Utilizzo fallback locale resiliente...", geminiErr.message || geminiErr);
        const q = topic.toLowerCase();
        let filtered = CRAWLER_DATABASE.filter(item => 
          item.title.toLowerCase().includes(q) || 
          item.description.toLowerCase().includes(q) ||
          item.sector.toLowerCase().includes(q) ||
          ((q === 'cinema' || q === 'film' || q === 'moviedome' || q === 'film completi') ? item.sector === 'Cinema Italiano' : false)
        );
        if (filtered.length === 0) {
          filtered = CRAWLER_DATABASE.filter(item => item.sector === 'Cinema Italiano');
        }
        if (filtered.length === 0) {
          filtered = CRAWLER_DATABASE.slice(0, 8);
        }
        candidates = filtered.map(item => ({
          title: item.title,
          description: item.description,
          sourceUrl: item.sourceUrl,
          durationMinutes: item.durationMinutes,
          sector: item.sector,
          isVertical: item.isVertical
        }));
      }

      console.log(`Gemini ha restituito ${candidates.length} candidati. Avvio validazione oEmbed...`);

      const validationPromises = candidates.map(async (candidate) => {
        const url = candidate.sourceUrl;
        const validation = await checkRealYouTubeVideoNoAPI(url);
        
        return {
          ...candidate,
          isValid: validation.ok,
          validationReason: validation.reason || "Video verificato, idoneo ed incorporabile!",
          videoId: validation.videoId || null,
          title: validation.title || candidate.title // Use verified title if available
        };
      });

      const results = await Promise.all(validationPromises);
      
      const db = readDB();
      if (!db.discoveredContents) {
        db.discoveredContents = [];
      }

      const newlyDiscovered: any[] = [];
      
      results.forEach((item) => {
        const id = 'disc_live_' + Math.random().toString(36).substring(2, 9);
        const videoId = item.videoId || extractYouTubeId(item.sourceUrl);
        const iframeCode = videoId ? `<iframe src="https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>` : '';
        const isVertical = item.sourceUrl.includes('/shorts/') || !!item.isVertical;

        const discItem = {
          id,
          title: item.title,
          description: item.description,
          sourceType: 'youtube' as const,
          sourceUrl: item.sourceUrl,
          iframeCode,
          sector: item.sector || topic,
          language: 'it',
          embedAllowed: item.isValid,
          qualityScore: item.isValid ? 95 : 10,
          reliability: item.isValid ? 'High' as const : 'Low' as const,
          status: item.isValid ? 'approved' as const : 'rejected' as const,
          reason: item.isValid ? undefined : item.validationReason,
          durationMinutes: item.durationMinutes || 10,
          isVertical,
          createdAt: new Date().toISOString()
        };

        // Avoid adding duplicate URLs to discovery log
        const isDup = db.discoveredContents!.some(existing => existing.sourceUrl === discItem.sourceUrl);
        if (!isDup) {
          db.discoveredContents!.push(discItem);
          newlyDiscovered.push(discItem);
        }

        // Auto-approve and make it available in the General Pool as "Rubrica Nazionale"
        if (item.isValid) {
          approveDiscoveredItem(db, discItem);
        }
      });

      // If a channelId is provided, we can automatically clone these approved contents to their channel as well!
      const clonedToChannel: any[] = [];
      if (channelId && channelId !== 'system') {
        const channel = db.tvChannels.find(c => c.id === channelId);
        if (channel) {
          // Find/create category for this topic/sector inside that channel
          const sectorSlug = topic.toLowerCase().replace(/[^a-z0-9]+/g, '-');
          let channelCat = db.categories.find(c => c.tvChannelId === channelId && c.slug === sectorSlug);
          if (!channelCat) {
            channelCat = {
              id: 'cat_cln_' + Math.random().toString(36).substring(2, 9),
              tvChannelId: channelId,
              name: topic,
              slug: sectorSlug,
              isSyndicated: false,
              createdAt: new Date().toISOString()
            };
            db.categories.push(channelCat);
          }

          newlyDiscovered.forEach(discItem => {
            if (discItem.status === 'approved') {
              const contentId = 'co_cln_' + Math.random().toString(36).substring(2, 9);
              const exists = db.contents.some(c => c.tvChannelId === channelId && c.sourceUrl === discItem.sourceUrl);
              if (!exists) {
                const itemToCln = {
                  id: contentId,
                  tvChannelId: channelId,
                  categoryId: channelCat!.id,
                  title: discItem.title,
                  description: discItem.description,
                  sourceType: 'youtube' as const,
                  sourceUrl: discItem.sourceUrl,
                  iframeCode: discItem.iframeCode,
                  durationMinutes: discItem.durationMinutes,
                  isPublic: true,
                  isVertical: discItem.isVertical,
                  createdAt: new Date().toISOString()
                };
                db.contents.push(itemToCln);
                clonedToChannel.push(itemToCln);
              }
            }
          });

          // Automatically rebuild / update 24h schedule with this new content!
          ensure24HourSchedulesForChannel(db, channelId, true);
        }
      }

      writeDB(db);

      res.json({
        success: true,
        message: `Scansione completata con successo! Trovati ${results.length} video. Verificati idonei ed importati: ${newlyDiscovered.filter(i => i.status === 'approved').length}.`,
        results,
        clonedCount: clonedToChannel.length
      });

    } catch (error: any) {
      console.error("Errore durante la scansione live di YouTube:", error);
      res.status(500).json({ error: error.message || "Errore sconosciuto durante la scansione." });
    }
  });

  // --- WEB SITE SCRAPER AND AI-POWERED EMBED EXTRACTOR ---
  app.post('/api/admin/scraper/scrape-site', async (req, res) => {
    const { url, rubric } = req.body;
    if (!url || typeof url !== 'string' || !url.trim()) {
      res.status(400).json({ error: "L'URL del sito web da scansionare è obbligatorio." });
      return;
    }

    try {
      console.log(`[Scraper] Tentativo di scaricamento HTML per URL: ${url}...`);
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      if (!response.ok) {
        throw new Error(`Impossibile scaricare la pagina web (Stato HTTP: ${response.status})`);
      }

      const html = await response.text();
      console.log(`[Scraper] Scaricati ${html.length} byte di HTML.`);

      // Extract distinct links
      const links: { href: string; text: string }[] = [];
      const linkRegex = /<a\s+(?:[^>]*?\s+)?href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
      let match;
      let count = 0;
      const baseUrl = new URL(url);

      while ((match = linkRegex.exec(html)) !== null && count < 100) {
        let href = match[1].trim();
        let text = match[2].replace(/<[^>]*>/g, '').trim();
        
        if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('javascript:') || href.startsWith('tel:')) {
          continue;
        }

        try {
          const resolvedUrl = new URL(href, baseUrl.href).href;
          if (resolvedUrl.startsWith('http') && !links.some(l => l.href === resolvedUrl)) {
            links.push({ href: resolvedUrl, text: text.substring(0, 100) });
            count++;
          }
        } catch (e) {
          // Ignore invalid URLs
        }
      }

      console.log(`[Scraper] Estratti ${links.length} link distinti dalla pagina.`);

      if (links.length === 0) {
        res.status(400).json({ error: "Nessun link web valido trovato nella pagina." });
        return;
      }

      const linksText = JSON.stringify(links.slice(0, 40), null, 2);
      const prompt = `Sei uno scraper web intelligente. Analizza questi link estratti dal sito "${url}":
${linksText}

Il tuo obiettivo è identificare esattamente i 5-8 link più interessanti che contengono video, contenuti multimediali (YouTube, Vimeo, Twitch, Facebook, podcast, ecc.) o pagine ricche di informazioni che possono essere incorporate tramite iframe responsive o visualizzate nella nostra piattaforma televisiva (anche normali siti se rilevanti e interessanti).

Per ciascun link identificato, fornisci in output un oggetto con i seguenti campi:
1. sourceUrl: L'URL originale completo e reale estratto.
2. title: Un titolo accattivante e pulito in italiano basato sul testo dell'ancora o sul contesto del link.
3. description: Una descrizione riassuntiva in italiano del contenuto del link.
4. sector: La rubrica/settore suggerito (es: "Cinema Italiano", "Musica Italiana", "Tecnologia", "Viaggi in Italia", "Cultura", "Cucina Italiana", oppure creane uno apposito se non fornito o se desideri proporne uno coerente con l'argomento). Se l'utente ha indicato "${rubric || ''}", preferisci utilizzare quello.
5. durationMinutes: Durata stimata o tempo di lettura del contenuto (da 1 a 120 minuti).
6. isVertical: true se si tratta di un video verticale (come Shorts, Reels, TikTok) o di contenuti mobile-first, altrimenti false.
7. thumbnailKeyword: Una parola chiave pertinente in inglese per cercare un'immagine di copertina professionale su Unsplash (es: "concert", "technology", "movie", "cooking", "pizza").

IMPORTANTE: Fornisci in output ESCLUSIVAMENTE un array JSON valido corrispondente allo schema richiesto. I link devono essere esattamente quelli presenti nella lista fornita.`;

      console.log(`[Scraper] Chiamata a Gemini 3.5-flash per analizzare i link...`);
      const geminiResponse = await generateContentWithFallback({
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                sourceUrl: { type: Type.STRING },
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                sector: { type: Type.STRING },
                durationMinutes: { type: Type.INTEGER },
                isVertical: { type: Type.BOOLEAN },
                thumbnailKeyword: { type: Type.STRING }
              },
              required: ["sourceUrl", "title", "description", "sector", "durationMinutes", "isVertical", "thumbnailKeyword"]
            }
          }
        }
      });

      const jsonStr = geminiResponse.text?.trim() || "[]";
      let candidates: any[] = [];
      try {
        candidates = JSON.parse(jsonStr);
      } catch (err) {
        console.error("Errore nel parsing del JSON di scraping di Gemini:", err, "Raw string:", jsonStr);
        const match = jsonStr.match(/\[[\s\S]*\]/);
        if (match) {
          candidates = JSON.parse(match[0]);
        }
      }

      console.log(`[Scraper] Gemini ha selezionato e formattato ${candidates.length} link.`);

      console.log(`[Scraper] Inizio estrazione video incorporati da ciascuna delle pagine candidate...`);
      const results = await Promise.all(candidates.map(async (cand) => {
        const pageUrl = cand.sourceUrl;
        const isVertical = !!cand.isVertical;
        const title = cand.title;
        
        let finalVideoUrl = pageUrl;
        let finalIframeCode = '';
        let hasDirectEmbed = false;

        try {
          // Fetch the individual video page to search for embedded videos/iframes
          console.log(`[Scraper] Sub-fetch pagina candidato: ${pageUrl}...`);
          const subRes = await fetch(pageUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            signal: AbortSignal.timeout(6000) // 6 seconds timeout per page to avoid getting stuck
          });
          
          if (subRes.ok) {
            const subHtml = await subRes.text();
            const extractedEmbedUrl = extractVideoUrlFromHtml(subHtml);
            if (extractedEmbedUrl) {
              console.log(`[Scraper] Estratto video incorporato da sub-page: ${extractedEmbedUrl}`);
              finalVideoUrl = extractedEmbedUrl;
              hasDirectEmbed = true;
            } else {
              console.log(`[Scraper] Nessun video incorporato trovato nella sub-page, uso URL della pagina.`);
            }
          }
        } catch (subErr: any) {
          console.warn(`[Scraper] Errore nel sub-fetch per ${pageUrl}:`, subErr.message || subErr);
        }

        if (hasDirectEmbed) {
          finalIframeCode = generateIframeCode(finalVideoUrl, title, isVertical);
        } else {
          finalIframeCode = generateIframeCode(pageUrl, title, isVertical);
        }

        const keyword = cand.thumbnailKeyword || 'video';
        const imageUrl = `https://images.unsplash.com/featured/?${encodeURIComponent(keyword)}&sig=${Math.floor(Math.random() * 1000)}`;

        let finalLogoUrl = imageUrl;
        const ytId = extractYouTubeId(finalVideoUrl);
        if (ytId) {
          finalLogoUrl = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
        } else {
          // If we couldn't find a youtube ID on the final video URL, try extracting it from page URL
          const pageYtId = extractYouTubeId(pageUrl);
          if (pageYtId) {
            finalLogoUrl = `https://img.youtube.com/vi/${pageYtId}/hqdefault.jpg`;
          }
        }

        return {
          id: 'scrape_' + Math.random().toString(36).substring(2, 9),
          title,
          description: cand.description,
          sourceUrl: finalVideoUrl,
          originalPageUrl: pageUrl,
          iframeCode: finalIframeCode,
          sector: cand.sector,
          durationMinutes: cand.durationMinutes || 10,
          isVertical,
          logoUrl: finalLogoUrl
        };
      }));

      res.json({
        success: true,
        message: `Trovati ${results.length} contenuti incorporabili ed organizzati con successo! Puoi adesso rivederli ed importarli nella piattaforma.`,
        results
      });

    } catch (error: any) {
      console.error("Errore durante lo scraping e l'analisi IA del sito:", error);
      res.status(500).json({ error: error.message || "Impossibile caricare o analizzare l'URL fornito." });
    }
  });

  // Import endpoint
  app.post('/api/admin/scraper/import', async (req, res) => {
    const { items, channelId } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: "Nessun elemento da importare fornito." });
      return;
    }

    try {
      const db = readDB();
      let importedCount = 0;

      items.forEach(item => {
        const sector = item.sector || "Altro";
        const sectorSlug = sector.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const catId = `cat_sys_${sectorSlug}`;

        let existingCat = db.categories.find(c => c.id === catId);
        if (!existingCat) {
          existingCat = {
            id: catId,
            tvChannelId: 'system',
            name: sector,
            slug: sectorSlug,
            isSyndicated: true,
            createdAt: new Date().toISOString()
          };
          db.categories.push(existingCat);
        }

        const globalContentId = `co_sys_${item.id}`;
        const existsGlobal = db.contents.some(c => c.sourceUrl === item.sourceUrl && c.tvChannelId === 'system');
        if (!existsGlobal) {
          db.contents.push({
            id: globalContentId,
            tvChannelId: 'system',
            categoryId: catId,
            title: item.title,
            description: item.description,
            sourceType: item.sourceUrl.includes('youtube') ? 'youtube' : 'other',
            sourceUrl: item.sourceUrl,
            iframeCode: item.iframeCode,
            durationMinutes: item.durationMinutes || 15,
            isPublic: true,
            isVertical: !!item.isVertical,
            logoUrl: item.logoUrl,
            createdAt: new Date().toISOString()
          });
        }

        if (channelId && channelId !== 'system') {
          const chCatId = `cat_${channelId}_${sectorSlug}`;
          let chCat = db.categories.find(c => c.id === chCatId);
          if (!chCat) {
            chCat = {
              id: chCatId,
              tvChannelId: channelId,
              name: sector,
              slug: sectorSlug,
              isSyndicated: false,
              createdAt: new Date().toISOString()
            };
            db.categories.push(chCat);
          }

          const existsCh = db.contents.some(c => c.sourceUrl === item.sourceUrl && c.tvChannelId === channelId);
          if (!existsCh) {
            db.contents.push({
              id: `co_user_${item.id}_${Math.random().toString(36).substring(2, 5)}`,
              tvChannelId: channelId,
              categoryId: chCat.id,
              title: item.title,
              description: item.description,
              sourceType: item.sourceUrl.includes('youtube') ? 'youtube' : 'other',
              sourceUrl: item.sourceUrl,
              iframeCode: item.iframeCode,
              durationMinutes: item.durationMinutes || 15,
              isPublic: true,
              isVertical: !!item.isVertical,
              logoUrl: item.logoUrl,
              createdAt: new Date().toISOString()
            });
          }
        }

        importedCount++;
      });

      if (channelId && channelId !== 'system') {
        ensure24HourSchedulesForChannel(db, channelId, true);
      }

      writeDB(db);

      res.json({
        success: true,
        message: `Importazione completata con successo! ${importedCount} contenuti multimediali importati in "${channelId === 'system' ? 'Rubriche Nazionali' : 'Canale Privato'}" ed associati alle relative rubriche.`
      });

    } catch (error: any) {
      console.error("Errore durante l'importazione dei contenuti scansionati:", error);
      res.status(500).json({ error: error.message || "Errore sconosciuto durante l'importazione." });
    }
  });

  // Approve a discovered item
  app.post('/api/admin/discovery/:id/approve', (req, res) => {
    const { id } = req.params;
    const db = readDB();
    const item = db.discoveredContents?.find(d => d.id === id);
    if (!item) {
      res.status(404).json({ error: 'Discovered content not found' });
      return;
    }

    if (item.embedAllowed === false) {
      res.status(400).json({ error: "Questo contenuto non consente l'incameramento (embed). Impossibile importarlo." });
      return;
    }

    approveDiscoveredItem(db, item);
    writeDB(db);
    res.json({ success: true, item });
  });

  // Reject a discovered item
  app.post('/api/admin/discovery/:id/reject', (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    const db = readDB();
    const item = db.discoveredContents?.find(d => d.id === id);
    if (!item) {
      res.status(404).json({ error: 'Discovered content not found' });
      return;
    }

    item.status = 'rejected';
    item.reason = reason || 'Rifiutato manualmente dall\'amministratore di sistema.';
    writeDB(db);
    res.json({ success: true, item });
  });

  // --- API ROUTE: REGIONAL CHANNELS (PUBLIC) ---
  app.get('/api/regional-channels', (req, res) => {
    const channels = readRegionalChannels();
    res.json(channels);
  });

  // --- API ROUTES: REGIONAL CHANNELS (ADMIN) ---
  app.post('/api/admin/regional-channels', (req, res) => {
    const { name, streamUrl, logoUrl, lcn } = req.body;
    if (!name || !streamUrl) {
      res.status(400).json({ error: 'Nome e URL di streaming sono obbligatori' });
      return;
    }

    const channels = readRegionalChannels();
    const newChannel = {
      id: 'reg_' + Math.random().toString(36).substring(2, 11),
      name: name.trim(),
      streamUrl: streamUrl.trim(),
      logoUrl: logoUrl ? logoUrl.trim() : 'https://images.unsplash.com/photo-1542204172-e7052809a86f?w=150&h=150&fit=crop',
      lcn: lcn ? parseInt(lcn, 10) : null
    };

    channels.push(newChannel);
    writeRegionalChannels(channels);
    res.json({ success: true, channel: newChannel });
  });

  app.put('/api/admin/regional-channels/:id', (req, res) => {
    const { id } = req.params;
    const { name, streamUrl, logoUrl, lcn } = req.body;

    const channels = readRegionalChannels();
    const idx = channels.findIndex((c: any) => c.id === id);
    if (idx === -1) {
      res.status(404).json({ error: 'Canale non trovato' });
      return;
    }

    if (name) channels[idx].name = name.trim();
    if (streamUrl) channels[idx].streamUrl = streamUrl.trim();
    if (logoUrl !== undefined) channels[idx].logoUrl = logoUrl ? logoUrl.trim() : 'https://images.unsplash.com/photo-1542204172-e7052809a86f?w=150&h=150&fit=crop';
    if (lcn !== undefined) channels[idx].lcn = lcn ? parseInt(lcn, 10) : null;

    writeRegionalChannels(channels);
    res.json({ success: true, channel: channels[idx] });
  });

  app.delete('/api/admin/regional-channels/:id', (req, res) => {
    const { id } = req.params;
    const channels = readRegionalChannels();
    const filtered = channels.filter((c: any) => c.id !== id);

    if (filtered.length === channels.length) {
      res.status(404).json({ error: 'Canale non trovato' });
      return;
    }

    writeRegionalChannels(filtered);
    res.json({ success: true });
  });

  // --- API ROUTE: CHANNELS (PUBLIC) ---
  app.get('/api/channels', (req, res) => {
    const db = readDB();
    // Return only active channels to visitors, but allow admins to see all
    const statusQuery = req.query.all === 'true' ? undefined : 'active';
    const channels = statusQuery 
      ? db.tvChannels.filter(c => c.status === 'active')
      : db.tvChannels;
    res.json(channels);
  });

  app.get('/api/channels/:slug', (req, res) => {
    const db = readDB();
    const ch = db.tvChannels.find(c => c.slug === req.params.slug);
    if (!ch) {
      res.status(404).json({ error: 'Channel not found' });
      return;
    }
    res.json(ch);
  });

  // Save/Update Channel Settings
  app.put('/api/channels/:id/settings', (req, res) => {
    const { id } = req.params;
    const { name, logoUrl, description } = req.body;
    
    const db = readDB();
    const ch = db.tvChannels.find(c => c.id === id);
    if (!ch) {
      res.status(404).json({ error: 'Channel not found' });
      return;
    }

    if (name) {
      ch.name = name;
      ch.slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    }
    if (logoUrl) ch.logoUrl = logoUrl;
    if (description) ch.description = description;

    writeDB(db);
    res.json({ success: true, channel: ch });
  });

  // --- API ROUTE: CATEGORIES & SYNDICATION ---
  app.get('/api/channels/:id/categories', (req, res) => {
    const db = readDB();
    const cats = db.categories.filter(c => c.tvChannelId === req.params.id);
    res.json(cats);
  });

  app.post('/api/channels/:id/categories', (req, res) => {
    const { name, isSyndicated } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Category name is required' });
      return;
    }

    const db = readDB();
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const newCat: Category = {
      id: 'cat_' + Math.random().toString(36).substring(2, 9),
      tvChannelId: req.params.id,
      name,
      slug,
      isSyndicated: !!isSyndicated,
      createdAt: new Date().toISOString()
    };

    db.categories.push(newCat);
    writeDB(db);
    res.json(newCat);
  });

  app.delete('/api/channels/:id/categories/:catId', (req, res) => {
    const db = readDB();
    db.categories = db.categories.filter(c => !(c.id === req.params.catId && c.tvChannelId === req.params.id));
    writeDB(db);
    res.json({ success: true });
  });

  // --- API ROUTE: YOUTUBE AUTOMATIC SCAN, SEARCH & IMPORT ---
  
  // Trigger Auto-Scan for a specific channel
  app.post('/api/channels/:id/auto-scan', (req, res) => {
    const { id } = req.params;
    const db = readDB();
    const channel = db.tvChannels.find(c => c.id === id);
    if (!channel) {
      res.status(404).json({ error: 'Canale non trovato' });
      return;
    }

    // Guess the sector of the channel based on its name and description
    const channelText = `${channel.name} ${channel.description}`.toLowerCase();
    let targetSector = 'Cultura Italiana';
    if (channelText.includes('cucin') || channelText.includes('ricett') || channelText.includes('food') || channelText.includes('mangiar')) {
      targetSector = 'Cucina Italiana';
    } else if (channelText.includes('viagg') || channelText.includes('itinerar') || channelText.includes('turism') || channelText.includes('scoprir')) {
      targetSector = 'Viaggi in Italia';
    } else if (channelText.includes('music') || channelText.includes('canzon') || channelText.includes('cantant') || channelText.includes('suon')) {
      targetSector = 'Musica Italiana';
    } else if (channelText.includes('sport') || channelText.includes('calc') || channelText.includes('gioc') || channelText.includes('allena')) {
      targetSector = 'Sport Italiani';
    } else if (channelText.includes('tecnolog') || channelText.includes('comput') || channelText.includes('elettr') || channelText.includes('digitale')) {
      targetSector = 'Tecnologia';
    } else if (channelText.includes('risat') || channelText.includes('comici') || channelText.includes('intratten') || channelText.includes('show')) {
      targetSector = 'Intrattenimento';
    } else if (channelText.includes('news') || channelText.includes('notiz') || channelText.includes('giornal') || channelText.includes('tg')) {
      targetSector = 'News Italiane';
    }

    // Let's find relevant videos from CRAWLER_DATABASE matching this sector
    const sectorCandidates = CRAWLER_DATABASE.filter(c => c.sector === targetSector);
    const backupCandidates = CRAWLER_DATABASE.filter(c => c.sector !== targetSector);
    
    // Combine them, putting sector-specific candidates first
    const candidates = [...sectorCandidates, ...backupCandidates].slice(0, 5);

    // Let's create the category if it doesn't exist
    const sectorSlug = targetSector.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    let cat = db.categories.find(c => c.tvChannelId === id && c.slug === sectorSlug);
    if (!cat) {
      cat = {
        id: 'cat_cln_' + Math.random().toString(36).substring(2, 9),
        tvChannelId: id,
        name: targetSector,
        slug: sectorSlug,
        isSyndicated: false,
        createdAt: new Date().toISOString()
      };
      db.categories.push(cat);
    }

    const newlyCloned: any[] = [];
    candidates.forEach(cand => {
      // Check if already exists in this channel
      const exists = db.contents.some(c => c.tvChannelId === id && c.sourceUrl === cand.sourceUrl);
      if (!exists) {
        const newId = 'co_cln_' + Math.random().toString(36).substring(2, 9);
        const item = {
          id: newId,
          tvChannelId: id,
          categoryId: cat.id,
          title: cand.title,
          description: cand.description,
          sourceType: 'youtube' as const,
          sourceUrl: cand.sourceUrl,
          iframeCode: generateIframeCode(cand.sourceUrl, cand.title, cand.isVertical),
          durationMinutes: cand.durationMinutes || 15,
          isPublic: true,
          isVertical: !!cand.isVertical,
          createdAt: new Date().toISOString()
        };
        db.contents.push(item);
        newlyCloned.push(item);
      }
    });

    // Reset isCleared to unblock automatic features
    db.isCleared = false;

    // Build schedules automatically
    ensure24HourSchedulesForChannel(db, id, true);
    
    writeDB(db);

    res.json({
      success: true,
      message: `Scansione completata con successo! Rilevati e caricati ${newlyCloned.length} video di YouTube per il settore "${targetSector}". Il tuo palinsesto h24 è stato rigenerato automaticamente.`,
      importedCount: newlyCloned.length,
      contents: newlyCloned
    });
  });

  // YouTube Search Simulator
  app.get('/api/channels/:id/youtube-search', (req, res) => {
    const q = (req.query.q || '').toString().toLowerCase();
    
    let results = CRAWLER_DATABASE.map((item, idx) => ({
      id: `yt_sim_${idx}`,
      title: item.title,
      description: item.description,
      sourceUrl: item.sourceUrl,
      durationMinutes: item.durationMinutes,
      sector: item.sector,
      isVertical: item.isVertical
    }));

    if (q) {
      results = results.filter(item => 
        item.title.toLowerCase().includes(q) || 
        item.description.toLowerCase().includes(q) ||
        item.sector.toLowerCase().includes(q)
      );
    }

    res.json(results);
  });

  // Import a single search result into channel
  app.post('/api/channels/:id/youtube-import', (req, res) => {
    const { id } = req.params;
    const { title, description, sourceUrl, durationMinutes, sector, isVertical } = req.body;

    if (!title || !sourceUrl) {
      res.status(400).json({ error: 'Titolo e URL sorgente sono obbligatori' });
      return;
    }

    const db = readDB();
    const channel = db.tvChannels.find(c => c.id === id);
    if (!channel) {
      res.status(404).json({ error: 'Canale non trovato' });
      return;
    }

    const targetSector = sector || 'Cultura Italiana';
    const sectorSlug = targetSector.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    
    let cat = db.categories.find(c => c.tvChannelId === id && c.slug === sectorSlug);
    if (!cat) {
      cat = {
        id: 'cat_cln_' + Math.random().toString(36).substring(2, 9),
        tvChannelId: id,
        name: targetSector,
        slug: sectorSlug,
        isSyndicated: false,
        createdAt: new Date().toISOString()
      };
      db.categories.push(cat);
    }

    // Check if already exists
    let content = db.contents.find(c => c.tvChannelId === id && c.sourceUrl === sourceUrl);
    if (!content) {
      const newId = 'co_cln_' + Math.random().toString(36).substring(2, 9);
      content = {
        id: newId,
        tvChannelId: id,
        categoryId: cat.id,
        title,
        description: description || '',
        sourceType: 'youtube' as const,
        sourceUrl,
        iframeCode: generateIframeCode(sourceUrl, title, isVertical),
        durationMinutes: durationMinutes || 15,
        isPublic: true,
        isVertical: !!isVertical,
        createdAt: new Date().toISOString()
      };
      db.contents.push(content);
    }

    // Unblock isCleared
    db.isCleared = false;

    // Regulate schedules
    ensure24HourSchedulesForChannel(db, id, true);

    writeDB(db);
    res.json({ success: true, content });
  });

  // Get globally syndicated categories/contents ("Rubriche Nazionali")
  app.get('/api/national-syndication', (req, res) => {
    const db = readDB();
    // Find all categories marked as syndicated
    const syndicatedCats = db.categories.filter(c => c.isSyndicated);
    const syndicatedChannelIds = syndicatedCats.map(c => c.tvChannelId);
    
    // Find associated contents of syndicated categories
    const syndicatedContents = db.contents.filter(co => co.categoryId && syndicatedCats.some(c => c.id === co.categoryId));
    
    // Map syndicated details
    const result = syndicatedCats.map(cat => {
      const channel = db.tvChannels.find(ch => ch.id === cat.tvChannelId);
      const contents = syndicatedContents.filter(co => co.categoryId === cat.id);
      return {
        category: cat,
        sourceChannelName: channel?.name || 'Unknown Channel',
        sourceChannelSlug: channel?.slug || '',
        contentsCount: contents.length,
        contents: contents
      };
    });

    res.json(result);
  });

  // Import a syndicated rubric from another channel
  app.post('/api/national-syndication/import', (req, res) => {
    const { targetChannelId, syndicatedCategoryId } = req.body;
    if (!targetChannelId || !syndicatedCategoryId) {
      res.status(400).json({ error: 'Target channel and syndicated category ID are required' });
      return;
    }

    const db = readDB();
    const sourceCat = db.categories.find(c => c.id === syndicatedCategoryId);
    if (!sourceCat) {
      res.status(404).json({ error: 'Syndicated category not found' });
      return;
    }

    // Create a shadow/imported category inside target channel
    const importedCatId = 'cat_imp_' + Math.random().toString(36).substring(2, 9);
    const importedCategory: Category = {
      id: importedCatId,
      tvChannelId: targetChannelId,
      name: `${sourceCat.name} (National Share)`,
      slug: `${sourceCat.slug}-national`,
      syndicatedFromChannelId: sourceCat.tvChannelId,
      createdAt: new Date().toISOString()
    };

    db.categories.push(importedCategory);

    // Copy contents of this category to the target channel as reference contents
    const sourceContents = db.contents.filter(c => c.categoryId === sourceCat.id);
    sourceContents.forEach(c => {
      db.contents.push({
        ...c,
        id: 'co_imp_' + Math.random().toString(36).substring(2, 9),
        tvChannelId: targetChannelId,
        categoryId: importedCatId,
        title: `${c.title} [Shared]`,
        createdAt: new Date().toISOString()
      });
    });

    writeDB(db);
    res.json({ success: true, category: importedCategory });
  });

  // --- API ROUTE: CONTENTS CRUD ---
  app.get('/api/contents/:id', (req, res) => {
    const db = readDB();
    let content = db.contents.find(c => c.id === req.params.id);
    if (!content) {
      const disc = db.discoveredContents?.find(c => c.id === req.params.id);
      if (disc) {
        content = {
          id: disc.id,
          tvChannelId: '',
          categoryId: '',
          title: disc.title,
          description: disc.description,
          sourceType: disc.sourceType || 'youtube',
          sourceUrl: disc.sourceUrl,
          iframeCode: disc.iframeCode,
          durationMinutes: disc.durationMinutes || 15,
          isPublic: true,
          isVertical: disc.isVertical || false,
          createdAt: disc.createdAt
        };
      }
    }
    if (!content) {
      res.status(404).json({ error: 'Content not found' });
      return;
    }
    res.json(content);
  });

  app.get('/api/channels/:id/contents', (req, res) => {
    const db = readDB();
    const list = db.contents.filter(c => c.tvChannelId === req.params.id);
    res.json(list);
  });

  app.post('/api/channels/:id/contents', async (req, res) => {
    const { title, description, sourceType, sourceUrl, categoryId, durationMinutes, isPublic, isVertical } = req.body;
    if (!title || !sourceUrl) {
      res.status(400).json({ error: 'Title and source URL are required' });
      return;
    }

    // Relaxed URL/Code verification (allows standard URLs, direct video files, and raw iframe embed tags)
    const trimmedUrl = sourceUrl.trim();
    const isValid = trimmedUrl.startsWith('<iframe') || 
                    trimmedUrl.includes('<iframe') || 
                    trimmedUrl.startsWith('<video') || 
                    trimmedUrl.includes('<video') || 
                    trimmedUrl.startsWith('http://') || 
                    trimmedUrl.startsWith('https://') || 
                    trimmedUrl.includes('www.');

    if (!isValid) {
      res.status(400).json({ error: "L'URL o il codice fornito non è valido. Inserisci un link web valido (http/https) o un codice embed/iframe personalizzato." });
      return;
    }

    // Standardize source type and validate YouTube video if applicable
    const isIframeOrVideoHTML = trimmedUrl.startsWith('<iframe') || trimmedUrl.includes('<iframe') || trimmedUrl.startsWith('<video') || trimmedUrl.includes('<video');
    const isYtUrl = !isIframeOrVideoHTML && (trimmedUrl.includes('youtube.com') || trimmedUrl.includes('youtu.be'));
    const actualSourceType = isIframeOrVideoHTML ? 'iframe' : (sourceType || (isYtUrl ? 'youtube' : 'other'));

    if (actualSourceType === 'youtube') {
      const ytValidation = await checkRealYouTubeVideoNoAPI(trimmedUrl);
      if (!ytValidation.ok) {
        res.status(400).json({ error: `Validazione YouTube fallita: ${ytValidation.reason}` });
        return;
      }
    }

    const db = readDB();
    const generatedIframe = generateIframeCode(sourceUrl, title, !!isVertical);

    const newContent: Content = {
      id: 'co_' + Math.random().toString(36).substring(2, 9),
      tvChannelId: req.params.id,
      categoryId: categoryId || undefined,
      title,
      description: description || '',
      sourceType: actualSourceType as any,
      sourceUrl,
      iframeCode: generatedIframe,
      durationMinutes: Number(durationMinutes) || 15,
      isPublic: isPublic !== false,
      isVertical: !!isVertical,
      createdAt: new Date().toISOString()
    };

    db.contents.push(newContent);
    db.isCleared = false;
    writeDB(db);
    res.json(newContent);
  });

  app.put('/api/channels/:id/contents/:contentId', async (req, res) => {
    const { id, contentId } = req.params;
    const { title, description, sourceType, sourceUrl, categoryId, durationMinutes, isPublic, isVertical } = req.body;

    const db = readDB();
    const content = db.contents.find(c => c.id === contentId && c.tvChannelId === id);
    if (!content) {
      res.status(404).json({ error: 'Content not found' });
      return;
    }

    if (title) content.title = title;
    if (description !== undefined) content.description = description;
    
    const newSourceType = sourceType || content.sourceType;
    if (sourceType) content.sourceType = sourceType;

    if (sourceUrl) {
      // Relaxed URL/Code verification (allows standard URLs, direct video files, and raw iframe embed tags)
      const trimmedUrl = sourceUrl.trim();
      const isValid = trimmedUrl.startsWith('<iframe') || 
                      trimmedUrl.includes('<iframe') || 
                      trimmedUrl.startsWith('<video') || 
                      trimmedUrl.includes('<video') || 
                      trimmedUrl.startsWith('http://') || 
                      trimmedUrl.startsWith('https://') || 
                      trimmedUrl.includes('www.');

      if (!isValid) {
        res.status(400).json({ error: "L'URL o il codice fornito non è valido. Inserisci un link web valido (http/https) o un codice embed/iframe personalizzato." });
        return;
      }

      // Check YouTube video
      const isIframeOrVideoHTML = trimmedUrl.startsWith('<iframe') || trimmedUrl.includes('<iframe') || trimmedUrl.startsWith('<video') || trimmedUrl.includes('<video');
      const isYtUrl = !isIframeOrVideoHTML && (trimmedUrl.includes('youtube.com') || trimmedUrl.includes('youtu.be'));
      const actualSourceType = isIframeOrVideoHTML ? 'iframe' : (newSourceType || (isYtUrl ? 'youtube' : 'other'));
      if (actualSourceType === 'youtube') {
        const ytValidation = await checkRealYouTubeVideoNoAPI(trimmedUrl);
        if (!ytValidation.ok) {
          res.status(400).json({ error: `Validazione YouTube fallita: ${ytValidation.reason}` });
          return;
        }
      }

      content.sourceUrl = sourceUrl;
      content.iframeCode = generateIframeCode(sourceUrl, title || content.title, isVertical !== undefined ? isVertical : content.isVertical);
    } else if (isVertical !== undefined) {
      content.iframeCode = generateIframeCode(content.sourceUrl, content.title, isVertical);
    }
    if (categoryId !== undefined) content.categoryId = categoryId || undefined;
    if (durationMinutes) content.durationMinutes = Number(durationMinutes);
    if (isPublic !== undefined) content.isPublic = isPublic;
    if (isVertical !== undefined) content.isVertical = isVertical;

    writeDB(db);
    res.json(content);
  });

  app.delete('/api/channels/:id/contents/:contentId', (req, res) => {
    const db = readDB();
    const channelId = req.params.id;
    const contentId = req.params.contentId;

    const contentToDelete = db.contents.find(c => c.id === contentId && c.tvChannelId === channelId);
    if (contentToDelete) {
      // Find matching discovered content and mark as 'rejected' or delete it, so it's never re-cloned
      if (db.discoveredContents) {
        db.discoveredContents = db.discoveredContents.map(d => {
          if (d.sourceUrl === contentToDelete.sourceUrl) {
            return { ...d, status: 'rejected' };
          }
          return d;
        });
      }
    }

    // Filter out the content
    db.contents = db.contents.filter(c => !(c.id === contentId && c.tvChannelId === channelId));
    // Clear old schedules referencing this content
    db.schedules = db.schedules.filter(s => s.contentId !== contentId);

    // If there are still other contents left, regenerate schedules with force = true
    // This fills the deleted slots with other available contents from the channel!
    ensure24HourSchedulesForChannel(db, channelId, true);

    writeDB(db);
    res.json({ success: true });
  });

  // --- API ROUTE: SCHEDULES CRUD ---
  app.get('/api/channels/:id/schedules', (req, res) => {
    const db = readDB();
    const list = db.schedules.filter(s => s.tvChannelId === req.params.id);
    res.json(list);
  });

  app.post('/api/channels/:id/schedules', (req, res) => {
    const { contentId, dayOfWeek, startTime, endTime, isActive } = req.body;
    if (!contentId || dayOfWeek === undefined || !startTime || !endTime) {
      res.status(400).json({ error: 'All schedule fields are required' });
      return;
    }

    const db = readDB();
    // Validate if content belongs to this channel
    const contentExists = db.contents.some(c => c.id === contentId && c.tvChannelId === req.params.id);
    if (!contentExists) {
      res.status(400).json({ error: 'Content does not belong to this channel' });
      return;
    }

    const newSchedule: Schedule = {
      id: 's_' + Math.random().toString(36).substring(2, 9),
      tvChannelId: req.params.id,
      contentId,
      dayOfWeek: Number(dayOfWeek),
      startTime,
      endTime,
      isActive: isActive !== false,
      createdAt: new Date().toISOString()
    };

    db.schedules.push(newSchedule);
    writeDB(db);
    res.json(newSchedule);
  });

  app.delete('/api/channels/:id/schedules/:scheduleId', (req, res) => {
    const db = readDB();
    db.schedules = db.schedules.filter(s => !(s.id === req.params.scheduleId && s.tvChannelId === req.params.id));
    writeDB(db);
    res.json({ success: true });
  });

  app.put('/api/channels/:id/schedules/:scheduleId', (req, res) => {
    const { id, scheduleId } = req.params;
    const { contentId, dayOfWeek, startTime, endTime, isActive } = req.body;
    const db = readDB();
    const schedule = db.schedules.find(s => s.id === scheduleId && s.tvChannelId === id);
    if (!schedule) {
      res.status(404).json({ error: 'Schedule slot not found' });
      return;
    }
    if (contentId !== undefined) schedule.contentId = contentId;
    if (dayOfWeek !== undefined) schedule.dayOfWeek = Number(dayOfWeek);
    if (startTime !== undefined) schedule.startTime = startTime;
    if (endTime !== undefined) schedule.endTime = endTime;
    if (isActive !== undefined) schedule.isActive = isActive;
    writeDB(db);
    res.json(schedule);
  });

  app.post('/api/channels/:id/schedules/reset-24h', (req, res) => {
    const { id } = req.params;
    const db = readDB();
    const channel = db.tvChannels.find(c => c.id === id);
    if (!channel) {
      res.status(404).json({ error: 'Channel not found' });
      return;
    }
    ensure24HourSchedulesForChannel(db, id, true, true);
    writeDB(db);
    res.json({ success: true, message: 'Palinsesto Nazionale 24h attivato con successo!' });
  });

  // --- API ROUTE: COLLABORATORS ---
  app.get('/api/channels/:id/collaborators', (req, res) => {
    const db = readDB();
    const list = db.collaborators.filter(c => c.tvChannelId === req.params.id);
    res.json(list);
  });

  app.post('/api/channels/:id/collaborators', (req, res) => {
    const { email, role } = req.body;
    if (!email || !role) {
      res.status(400).json({ error: 'Email and role are required' });
      return;
    }

    const db = readDB();
    const newCollab: Collaborator = {
      id: 'col_' + Math.random().toString(36).substring(2, 9),
      tvChannelId: req.params.id,
      email: email.toLowerCase(),
      role: role as any,
      createdAt: new Date().toISOString()
    };

    db.collaborators.push(newCollab);
    writeDB(db);
    res.json(newCollab);
  });

  app.delete('/api/channels/:id/collaborators/:collabId', (req, res) => {
    const db = readDB();
    db.collaborators = db.collaborators.filter(c => !(c.id === req.params.collabId && c.tvChannelId === req.params.id));
    writeDB(db);
    res.json({ success: true });
  });

  // --- API ROUTE: API KEYS & EXTERNAL DATA ---
  app.post('/api/channels/:id/apikey', (req, res) => {
    const db = readDB();
    const ch = db.tvChannels.find(c => c.id === req.params.id);
    if (!ch) {
      res.status(404).json({ error: 'Channel not found' });
      return;
    }
    ch.apiKey = 'apikey_' + Math.random().toString(36).substring(2, 12);
    writeDB(db);
    res.json({ apiKey: ch.apiKey });
  });

  // --- API ROUTE: CALCULATE "NOW PLAYING" LIVE BROADCAST ---
  app.get('/api/channels/:slug/now-playing', (req, res) => {
    const db = readDB();
    const channel = db.tvChannels.find(c => c.slug === req.params.slug);
    if (!channel) {
      res.status(404).json({ error: 'Channel not found' });
      return;
    }

    if (channel.status !== 'active') {
      res.status(403).json({ error: 'Channel is suspended or pending approval' });
      return;
    }

    // Capture system timezone and client preference
    // We convert local time accurately
    const now = new Date();
    const currentDay = now.getDay(); // 0 is Sunday, 1 is Monday, etc.
    const currentHour = String(now.getHours()).padStart(2, '0');
    const currentMin = String(now.getMinutes()).padStart(2, '0');
    const currentTimeStr = `${currentHour}:${currentMin}`;

    // Search active schedules
    const activeSchedules = db.schedules.filter(s => 
      s.tvChannelId === channel.id && 
      s.isActive && 
      s.dayOfWeek === currentDay
    );

    let matchingSchedule = activeSchedules.find(s => 
      s.startTime <= currentTimeStr && 
      currentTimeStr < s.endTime
    );

    let currentContent: Content | null = null;
    let fallbackUsed = false;

    if (matchingSchedule) {
      currentContent = db.contents.find(c => c.id === matchingSchedule?.contentId) || null;
    }

    // If nothing scheduled, pick a random available channel content so stream never goes black
    if (!currentContent) {
      const channelContents = db.contents.filter(c => c.tvChannelId === channel.id && c.isPublic);
      if (channelContents.length > 0) {
        currentContent = channelContents[Math.floor(Math.random() * channelContents.length)];
        fallbackUsed = true;
      } else {
        // Absolute fallback to a global default content
        currentContent = db.contents[0];
        fallbackUsed = true;
      }
    }

    res.json({
      channel: {
        id: channel.id,
        name: channel.name,
        logoUrl: channel.logoUrl,
        description: channel.description
      },
      schedule: matchingSchedule || null,
      content: currentContent,
      serverTime: {
        day: currentDay,
        time: currentTimeStr
      },
      fallbackUsed
    });
  });

  // --- API ROUTE: REAL-TIME SIMULATED VIEWERS & TELEMETRY ---
  app.get('/api/realtime/activity/:channelId', (req, res) => {
    const { channelId } = req.params;
    const db = readDB();
    
    // Filter existing logs
    const existingLogs = db.activityLogs.filter(l => l.tvChannelId === channelId);
    
    // Auto-generate fresh simulation logs to simulate continuous action in real-time
    const simulatedActivities: string[] = [
      'embedded on external blog site',
      'joined the livestream player',
      'sent a heart reaction ❤️',
      'asked about the schedule playlist',
      'embedded this rubric to their regional portal'
    ];
    const mockUsers: string[] = [
      'Viewer_Neon', 'StreamSurfer', 'Cinephile_99', 'TechLover', 'Giuseppe_Pasta', 'DigitalNative'
    ];

    if (Math.random() > 0.4) {
      const randomUser = mockUsers[Math.floor(Math.random() * mockUsers.length)];
      const randomAction = simulatedActivities[Math.floor(Math.random() * simulatedActivities.length)];
      const logType: any = randomAction.includes('join') ? 'join' : (randomAction.includes('embed') ? 'embed' : 'chat');
      
      const newLog: ActivityLog = {
        id: 'log_' + Math.random().toString(36).substring(2, 9),
        tvChannelId: channelId,
        type: logType,
        user: randomUser,
        message: `${randomUser} ${randomAction}`,
        timestamp: new Date().toISOString()
      };
      
      db.activityLogs.push(newLog);
      writeDB(db);
      existingLogs.push(newLog);
    }

    res.json(existingLogs.slice(-12)); // Return last 12 activities for compact UI display
  });

  // --- SDK SCRIPT GENERATOR ENDPOINT ---
  app.get('/widget.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.send(`
(function() {
  const container = document.getElementById('metatv-widget-container');
  if (!container) return;
  
  const channel = container.getAttribute('data-channel') || '';
  const mode = container.getAttribute('data-mode') || 'desktop';
  const autoplay = container.getAttribute('data-autoplay') || 'true';
  const mute = container.getAttribute('data-mute') || 'true';
  
  const origin = window.location.origin || 'https://' + window.location.host;
  const embedUrl = origin + '/embed/' + channel + '?autoplay=' + (autoplay === 'true' ? '1' : '0') + '&mute=' + (mute === 'true' ? '1' : '0') + '&mode=' + mode;
  
  const iframe = document.createElement('iframe');
  iframe.src = embedUrl;
  iframe.frameBorder = '0';
  iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
  iframe.setAttribute('allowfullscreen', 'true');
  
  // Style according to aspect ratio
  if (mode === 'mobile') {
    iframe.style.width = '320px';
    iframe.style.height = '580px';
    iframe.style.maxWidth = '100%';
    iframe.style.aspectRatio = '9/16';
    iframe.style.borderRadius = '12px';
    iframe.style.border = '2px solid #334155';
  } else {
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.aspectRatio = '16/9';
    iframe.style.borderRadius = '12px';
    iframe.style.border = '1px solid #1e293b';
  }
  
  container.innerHTML = '';
  container.appendChild(iframe);
})();
    `);
  });

  // --- VITE DEV AND PRODUCTION MIDDLEWARE HANDLER ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Meta-TV-Channel Server] up and running on port ${PORT}`);
  });
}

startServer();
