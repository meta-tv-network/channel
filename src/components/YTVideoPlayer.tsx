import React, { useState, useEffect, useRef } from 'react';
import Hls from 'hls.js';

interface YTVideoPlayerProps {
  url: string;
  sourceType: string;
  iframeCode?: string;
  isMuted?: boolean;
  autoplay?: boolean;
  isVertical?: boolean;
}

function HlsPlayer({ url, autoplay, isMuted }: { url: string; autoplay: boolean; isMuted: boolean }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    let hls: Hls | null = null;
    const video = videoRef.current;
    if (!video) return;

    if (Hls.isSupported()) {
      hls = new Hls({
        maxMaxBufferLength: 10,
        enableWorker: true,
      });
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (autoplay) {
          video.play().catch(e => console.log('Autoplay blocked:', e));
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
      video.addEventListener('loadedmetadata', () => {
        if (autoplay) {
          video.play().catch(e => console.log('Autoplay blocked:', e));
        }
      });
    }

    return () => {
      if (hls) {
        hls.destroy();
      }
    };
  }, [url, autoplay]);

  return (
    <div className="w-full h-full bg-black flex items-center justify-center relative">
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        controls
        muted={isMuted}
        playsInline
      />
    </div>
  );
}

export function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  
  // Try raw 11 character ID check first
  if (/^[a-zA-Z0-9_-]{11}$/.test(url)) {
    return url;
  }

  // Handle standard matches including shorts and live streams
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/|live\/)([^#\&\?]*).*/;
  const match = url.match(regExp);
  if (match && match[2] && match[2].length === 11) {
    return match[2];
  }

  // Final URL-based fallback parsing
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtube.com')) {
      const v = u.searchParams.get('v');
      if (v) return v;
      
      const parts = u.pathname.split('/');
      const embedIdx = parts.indexOf('embed');
      if (embedIdx !== -1 && parts[embedIdx + 1]) {
        return parts[embedIdx + 1];
      }
      
      const shortsIdx = parts.indexOf('shorts');
      if (shortsIdx !== -1 && parts[shortsIdx + 1]) {
        return parts[shortsIdx + 1];
      }

      const liveIdx = parts.indexOf('live');
      if (liveIdx !== -1 && parts[liveIdx + 1]) {
        const idPart = parts[liveIdx + 1].split(/[?#&]/)[0];
        if (idPart && idPart.length === 11) return idPart;
      }
    }
    if (u.hostname.includes('youtu.be')) {
      return u.pathname.replace('/', '');
    }
  } catch (e) {
    // Ignore URL errors and fallback
  }

  return null;
}

export function extractVimeoId(url: string): string | null {
  if (!url) return null;
  const regExp = /^.*(vimeo\.com\/)((channels\/[^\/]+\/)|(groups\/[^\/]+\/video\/)|(album\/[^\/]+\/video\/)|(video\/))?([0-9]+)/;
  const match = url.match(regExp);
  if (match && match[7]) {
    return match[7];
  }
  return null;
}

export default function YTVideoPlayer({
  url,
  sourceType,
  iframeCode = '',
  isMuted = true,
  autoplay = true,
  isVertical = false
}: YTVideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const ytPlayerInstance = useRef<any>(null);
  const [isYTReady, setIsYTReady] = useState<boolean>(!!(window as any).YT?.Player);

  // 1. Dynamic injection of YouTube Player API Script
  useEffect(() => {
    if (!(window as any).YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      if (firstScriptTag && firstScriptTag.parentNode) {
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      } else {
        document.head.appendChild(tag);
      }
    }

    const interval = setInterval(() => {
      if ((window as any).YT?.Player) {
        setIsYTReady(true);
        clearInterval(interval);
      }
    }, 100);

    const prevCallback = (window as any).onYouTubeIframeAPIReady;
    (window as any).onYouTubeIframeAPIReady = () => {
      setIsYTReady(true);
      if (prevCallback) prevCallback();
    };

    return () => clearInterval(interval);
  }, []);

  // Dynamic play-time substitution is disabled to ensure user-defined, real URLs play exactly as configured
  const PLAYBACK_ID_REPLACEMENTS: Record<string, string> = {};

  const rawYtId = extractYouTubeId(url);
  let ytId = rawYtId;
  if (ytId && PLAYBACK_ID_REPLACEMENTS[ytId]) {
    ytId = PLAYBACK_ID_REPLACEMENTS[ytId];
  }
  const isYoutube = sourceType === 'youtube' || !!rawYtId || url.includes('youtube.com') || url.includes('youtu.be');

  const vimeoId = extractVimeoId(url);
  const isVimeo = sourceType === 'vimeo' || !!vimeoId;

  const isMp4 = url.toLowerCase().endsWith('.mp4') || url.includes('gtv-videos-bucket') || url.includes('sample/Sintel') || url.includes('sample/BigBuckBunny') || url.includes('sample/TearsOfSteel');

  const isM3u8 = url.toLowerCase().includes('.m3u8') || sourceType === 'm3u8' || (sourceType === 'other' && url.toLowerCase().includes('m3u8'));

  // Render logic based on matched video type
  if (isM3u8) {
    return <HlsPlayer url={url} autoplay={autoplay} isMuted={isMuted} />;
  }

  if (isYoutube && ytId) {
    const embedUrl = `https://www.youtube.com/embed/${ytId}?autoplay=${autoplay ? '1' : '0'}&mute=${isMuted ? '1' : '0'}&controls=1&rel=0&playsinline=1&enablejsapi=1`;
    if (isVertical) {
      return (
        <div className="w-full h-full bg-black flex items-center justify-center p-2">
          <iframe 
            src={embedUrl} 
            width="315" 
            height="560" 
            frameBorder="0" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
            allowFullScreen 
            className="rounded-2xl border-2 border-slate-800 shadow-xl"
            style={{ aspectRatio: '9/16', maxHeight: '80vh' }}
            title={url}
          />
        </div>
      );
    }
    return (
      <div className="w-full h-full bg-black">
        <iframe 
          src={embedUrl} 
          width="100%" 
          height="100%" 
          frameBorder="0" 
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
          allowFullScreen 
          className="w-full h-full border-none"
          title={url}
        />
      </div>
    );
  }

  if (isVimeo && vimeoId) {
    const vimeoEmbedUrl = `https://player.vimeo.com/video/${vimeoId}?autoplay=${autoplay ? '1' : '0'}&muted=${isMuted ? '1' : '0'}&byline=0&portrait=0&title=0`;
    return (
      <div className="w-full h-full bg-black">
        <iframe
          src={vimeoEmbedUrl}
          className="w-full h-full border-none"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          title="Vimeo Player"
        />
      </div>
    );
  }

  if (isMp4) {
    return (
      <div className="w-full h-full bg-black flex items-center justify-center">
        <video
          src={url}
          className="w-full h-full object-contain"
          controls
          autoPlay={autoplay}
          muted={isMuted}
          loop
          playsInline
        />
      </div>
    );
  }

  // Fallback to manual custom iframeCode if present
  if (iframeCode) {
    // Add extra params to standard manual youtube iframe codes inside iframeCode if needed
    let sanitizedCode = iframeCode;

    // Dynamically replace blocked IDs in iframe codes
    for (const [oldId, newId] of Object.entries(PLAYBACK_ID_REPLACEMENTS)) {
      if (sanitizedCode.includes(oldId)) {
        sanitizedCode = sanitizedCode.replaceAll(oldId, newId);
      }
    }

    if (sanitizedCode.includes('youtube.com/embed/')) {
      // Add origin, controls, rel to be safe
      sanitizedCode = sanitizedCode
        .replace('src="https://www.youtube.com/embed/', `src="https://www.youtube.com/embed/`)
        .replace('allowfullscreen', 'allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen');
    }

    return (
      <div 
        className="w-full h-full"
        dangerouslySetInnerHTML={{ __html: sanitizedCode }}
      />
    );
  }

  // Safe blank state
  return (
    <div className="w-full h-full bg-slate-900 flex flex-col items-center justify-center text-slate-400 p-4 text-center text-xs">
      <p>Nessun riproduttore compatibile rilevato per questo formato.</p>
      {url && (
        <a 
          href={url} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="mt-2 text-indigo-400 hover:underline font-bold"
        >
          Apri collegamento esterno ↗
        </a>
      )}
    </div>
  );
}
