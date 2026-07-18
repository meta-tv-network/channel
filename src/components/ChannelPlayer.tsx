import React, { useState } from 'react';
import { Content } from '../types.js';
import { Play, VolumeX, Minimize2, Maximize2, Smartphone, Monitor } from 'lucide-react';
import YTVideoPlayer from './YTVideoPlayer.js';

interface ChannelPlayerProps {
  content: Content | null;
  channelName: string;
  isMuted?: boolean;
}

export default function ChannelPlayer({ content, channelName }: ChannelPlayerProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [deviceMode, setDeviceMode] = useState<'desktop' | 'mobile'>(content?.isVertical ? 'mobile' : 'desktop');

  React.useEffect(() => {
    if (content) {
      setDeviceMode(content.isVertical ? 'mobile' : 'desktop');
    }
  }, [content]);

  if (!content) {
    return (
      <div className="w-full aspect-video bg-[#111114] flex flex-col items-center justify-center border border-slate-800 rounded-2xl p-6 text-center">
        <div className="animate-pulse flex flex-col items-center">
          <Play className="w-12 h-12 text-indigo-500 mb-3 opacity-60" />
          <p className="text-slate-400 font-medium font-display uppercase tracking-wider text-xs">Intervallo di trasmissione</p>
          <p className="text-slate-500 text-xs max-w-xs mt-1">
            Nessun palinsesto programmato per quest'ora. Stiamo caricando la playlist automatica di {channelName}...
          </p>
        </div>
      </div>
    );
  }

  // Check if content is vertical (Shorts/Reels)
  const isVertical = content.isVertical;

  return (
    <div className="flex flex-col items-center w-full">
      {/* Device Mode Switcher */}
      <div className="flex gap-2 mb-4 bg-[#111114] p-1.5 rounded-xl border border-slate-800">
        <button
          onClick={() => setDeviceMode('desktop')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all uppercase tracking-wider ${
            deviceMode === 'desktop'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Monitor className="w-3.5 h-3.5" />
          TV 16:9
        </button>
        <button
          onClick={() => setDeviceMode('mobile')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all uppercase tracking-wider ${
            deviceMode === 'mobile'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5" />
          Mobile Reels
        </button>
      </div>

      {/* Main Screen */}
      <div
        className={`relative transition-all duration-300 shadow-2xl rounded-2xl border border-slate-800 overflow-hidden bg-[#0A0A0B] ${
          deviceMode === 'mobile'
            ? 'w-[320px] aspect-[9/16] max-h-[580px]'
            : 'w-full aspect-video'
        }`}
      >
        {/* Dynamic Safe Player Embed */}
        <div className="w-full h-full flex items-center justify-center">
          <YTVideoPlayer
            url={content.sourceUrl}
            sourceType={content.sourceType}
            iframeCode={content.iframeCode}
            isMuted={true}
            autoplay={true}
            isVertical={content.isVertical}
          />
        </div>

        {/* HUD overlay labels */}
        <div className="absolute top-4 left-4 right-4 flex justify-between items-center pointer-events-none">
          <div className="bg-[#0A0A0B]/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 flex items-center gap-2 pointer-events-auto">
            <span className="w-2.5 h-2.5 rounded-full bg-red-550 animate-ping"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-red-600 absolute"></span>
            <span className="text-xs font-bold tracking-wider text-white uppercase ml-1">ON AIR</span>
          </div>

          <div className="bg-[#0A0A0B]/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 text-xs font-mono text-slate-300 uppercase pointer-events-auto">
            {content.sourceType}
          </div>
        </div>

        {/* Content Meta bottom overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#0A0A0B] via-[#0A0A0B]/80 to-transparent p-5 pt-12 text-left">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 uppercase tracking-wider">
            {isVertical ? 'Vertical Reel' : 'Live Widescreen'}
          </span>
          <h3 className="text-base font-bold text-white mt-2 line-clamp-1">{content.title}</h3>
          <p className="text-xs text-slate-400 mt-1 line-clamp-2">{content.description}</p>
        </div>
      </div>

      {/* External Link Fallback Helper */}
      <div className="w-full max-w-2xl mt-4 bg-indigo-950/15 border border-indigo-500/20 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 text-left">
        <div className="space-y-1">
          <p className="text-xs text-indigo-300 font-bold leading-tight">
            Se il video non si avvia o mostra "Contenuto Protetto / Bloccato":
          </p>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Alcuni video di YouTube o altre piattaforme sono protetti dai titolari dei diritti d'autore che disabilitano l'incorporamento (embed) sui siti web esterni. Puoi comunque riprodurli direttamente sulla sorgente d'origine!
          </p>
        </div>
        {content.sourceUrl && (
          <a
            href={content.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-md uppercase tracking-wider cursor-pointer border border-indigo-500/20"
          >
            Apri su {content.sourceType === 'youtube' ? 'YouTube' : content.sourceType === 'vimeo' ? 'Vimeo' : 'Sorgente Esterna'} ↗
          </a>
        )}
      </div>
    </div>
  );
}
