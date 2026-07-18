import React, { useState } from 'react';
import { Code2, Copy, Check, Info, FileCode, Monitor, Smartphone } from 'lucide-react';

interface EmbedWizardProps {
  channelSlug: string;
}

export default function EmbedWizard({ channelSlug }: EmbedWizardProps) {
  const [embedWidth, setEmbedWidth] = useState('100%');
  const [embedHeight, setEmbedHeight] = useState('560px');
  const [playerRatio, setPlayerRatio] = useState<'16-9' | '9-16'>('16-9');
  const [autoplay, setAutoplay] = useState(true);
  const [mute, setMute] = useState(true);
  const [copiedType, setCopiedType] = useState<'iframe' | 'script' | 'url' | null>(null);

  const baseUrl = window.location.origin;
  const embedUrl = `${baseUrl}/embed/${channelSlug}?autoplay=${autoplay ? '1' : '0'}&mute=${mute ? '1' : '0'}&mode=${playerRatio === '9-16' ? 'mobile' : 'desktop'}`;

  // Iframe code generator
  const iframeCode = `<iframe src="${embedUrl}" width="${embedWidth}" height="${embedHeight}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="${playerRatio === '9-16' ? 'aspect-ratio: 9/16; max-height: 80vh; border-radius: 12px;' : 'aspect-ratio: 16/9;'} border: none; overflow: hidden;"></iframe>`;

  // Dynamic SDK Javascript Code
  const scriptCode = `<!-- Meta-TV Automatic Channel Widget -->
<div id="metatv-widget-container" 
     data-channel="${channelSlug}" 
     data-mode="${playerRatio === '9-16' ? 'mobile' : 'desktop'}" 
     data-autoplay="${autoplay ? 'true' : 'false'}" 
     data-mute="${mute ? 'true' : 'false'}"
     style="width: ${embedWidth}; max-width: 100%; transition: all 0.3s ease;">
</div>
<script src="${baseUrl}/widget.js" defer></script>`;

  const copyToClipboard = (text: string, type: 'iframe' | 'script' | 'url') => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2500);
  };

  return (
    <div className="bg-[#111114] border border-slate-800 rounded-2xl p-6 text-left">
      <div className="flex items-center gap-2.5 mb-5">
        <Code2 className="w-5 h-5 text-indigo-400" />
        <h3 className="text-lg font-bold font-display text-white uppercase tracking-tight">Integrazione Esterna (Embed)</h3>
      </div>

      <p className="text-xs text-slate-400 mb-6 leading-relaxed">
        Inserisci la tua TV ovunque sul web. Personalizza i parametri per ottenere il codice Iframe standard o lo script automatico asincrono per l'integrazione fluida nel tuo sito aziendale o blog.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Controls */}
        <div className="space-y-4.5 bg-[#0E0E12] p-5 rounded-xl border border-slate-800">
          <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-3">Impostazioni Widget</h4>

          {/* Ratio Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Formato Player predefinito</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setPlayerRatio('16-9');
                  setEmbedHeight('560px');
                }}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold border transition-all uppercase tracking-wider ${
                  playerRatio === '16-9'
                    ? 'bg-indigo-600/10 border-indigo-500 text-indigo-400'
                    : 'bg-[#0A0A0B] border-slate-800 text-slate-400 hover:text-slate-300'
                }`}
              >
                <Monitor className="w-4 h-4" />
                Standard 16:9
              </button>
              <button
                type="button"
                onClick={() => {
                  setPlayerRatio('9-16');
                  setEmbedHeight('640px');
                }}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold border transition-all uppercase tracking-wider ${
                  playerRatio === '9-16'
                    ? 'bg-indigo-600/10 border-indigo-500 text-indigo-400'
                    : 'bg-[#0A0A0B] border-slate-800 text-slate-400 hover:text-slate-300'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                Mobile Reel 9:16
              </button>
            </div>
          </div>

          {/* Sizing */}
          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Larghezza</label>
              <input
                type="text"
                value={embedWidth}
                onChange={e => setEmbedWidth(e.target.value)}
                placeholder="es. 100% o 640px"
                className="w-full bg-[#0A0A0B] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Altezza</label>
              <input
                type="text"
                value={embedHeight}
                onChange={e => setEmbedHeight(e.target.value)}
                placeholder="es. 560px o 100%"
                className="w-full bg-[#0A0A0B] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Flags */}
          <div className="space-y-2.5 pt-1.5">
            <label className="flex items-center gap-2.5 text-xs text-slate-300 select-none cursor-pointer">
              <input
                type="checkbox"
                checked={autoplay}
                onChange={e => setAutoplay(e.target.checked)}
                className="w-4 h-4 rounded bg-[#0A0A0B] border-slate-800 text-indigo-600 focus:ring-0 focus:ring-offset-0"
              />
              Avvia video automaticamente (Autoplay)
            </label>

            <label className="flex items-center gap-2.5 text-xs text-slate-300 select-none cursor-pointer">
              <input
                type="checkbox"
                checked={mute}
                onChange={e => setMute(e.target.checked)}
                className="w-4 h-4 rounded bg-[#0A0A0B] border-slate-800 text-indigo-600 focus:ring-0 focus:ring-offset-0"
              />
              Disattiva audio all'avvio (Consigliato per autoplay)
            </label>
          </div>
        </div>

        {/* Results / Copier boxes */}
        <div className="space-y-4">
          {/* Iframe copy card */}
          <div className="bg-[#0E0E12] p-4 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <FileCode className="w-3.5 h-3.5 text-indigo-400" />
                Codice Iframe Standard
              </span>
              <button
                onClick={() => copyToClipboard(iframeCode, 'iframe')}
                className="flex items-center gap-1 text-[11px] font-bold text-indigo-400 hover:text-indigo-300 uppercase tracking-wider"
              >
                {copiedType === 'iframe' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-green-400" />
                    Copiato!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copia
                  </>
                )}
              </button>
            </div>
            <pre className="text-[10px] font-mono text-slate-400 bg-[#0A0A0B] p-3 rounded-lg overflow-x-auto whitespace-pre border border-slate-800">
              {iframeCode}
            </pre>
          </div>

          {/* Script Copy Card */}
          <div className="bg-[#0E0E12] p-4 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Code2 className="w-3.5 h-3.5 text-indigo-400" />
                Script Automatico Dinamico (JS SDK)
              </span>
              <button
                onClick={() => copyToClipboard(scriptCode, 'script')}
                className="flex items-center gap-1 text-[11px] font-bold text-indigo-400 hover:text-indigo-300 uppercase tracking-wider"
              >
                {copiedType === 'script' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-green-400" />
                    Copiato!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copia
                  </>
                )}
              </button>
            </div>
            <pre className="text-[10px] font-mono text-slate-400 bg-[#0A0A0B] p-3 rounded-lg overflow-x-auto whitespace-pre border border-slate-800">
              {scriptCode}
            </pre>
          </div>

          {/* Embed Direct URL */}
          <div className="flex items-center gap-2 bg-[#0E0E12] px-3.5 py-2.5 rounded-xl border border-slate-800">
            <Info className="w-4 h-4 text-slate-500 shrink-0" />
            <div className="flex-1 min-w-0 text-left">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Link Diretto Embed Player</p>
              <p className="text-xs font-mono text-slate-300 truncate mt-0.5">{embedUrl}</p>
            </div>
            <button
              onClick={() => copyToClipboard(embedUrl, 'url')}
              className="p-2 bg-[#0A0A0B] rounded-lg hover:bg-slate-850 text-slate-300 border border-slate-800 transition-all"
              title="Copia Link Embed"
            >
              {copiedType === 'url' ? (
                <Check className="w-3.5 h-3.5 text-green-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
