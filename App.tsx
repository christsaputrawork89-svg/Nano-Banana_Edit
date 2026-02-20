
import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, Wand2, Download, Image as ImageIcon, Trash2, 
  RefreshCw, AlertCircle, CheckCircle2, ScanFace, 
  Sparkles, Eraser, Palette, SunMedium, Scaling, History,
  MousePointer2, Pencil, RotateCcw, ShieldCheck, Zap, X,
  Layers, ChevronRight, Layout, Plus
} from 'lucide-react';
import { editImageWithGemini } from './services/geminiService';
import { Button } from './components/Button';
import { AppStatus, ImageState, MarkerColor, MarkingAction } from './types';

const QUICK_TOOLS = [
  { id: 'face', name: 'Face Repair', icon: ScanFace, prompt: 'Repair and enhance the face, sharpen eyes, and smooth skin naturally.' },
  { id: 'skin', name: 'Skin Retouch', icon: Sparkles, prompt: 'Apply natural skin retouching, remove blemishes.' },
  { id: 'bg', name: 'Clean Background', icon: Eraser, prompt: 'Clean up the background, remove distractions.' },
  { id: 'color', name: 'Color Fix', icon: Palette, prompt: 'Balance the colors and fix white balance.' },
  { id: 'light', name: 'Pro Lighting', icon: SunMedium, prompt: 'Correct exposure and add cinematic lighting.' },
];

const MARKER_COLORS: { id: MarkerColor; label: string; hex: string; desc: string }[] = [
  { id: 'red', label: 'Modify', hex: '#f87171', desc: 'Target area' },
  { id: 'blue', label: 'Protect', hex: '#60a5fa', desc: 'Keep original' },
  { id: 'green', label: 'Enhance', hex: '#4ade80', desc: 'Boost quality' },
  { id: 'yellow', label: 'Suggest', hex: '#facc15', desc: 'AI Creative' },
];

const App: React.FC = () => {
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [originalImage, setOriginalImage] = useState<ImageState | null>(null);
  const [referenceImages, setReferenceImages] = useState<File[]>([]);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<string>('');
  const [prompt, setPrompt] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [history, setHistory] = useState<{url: string, date: string}[]>([]);
  
  const [activeMarker, setActiveMarker] = useState<MarkerColor>(null);
  const [markings, setMarkings] = useState<MarkingAction[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const refInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (originalImage && canvasRef.current && imageRef.current) {
      // Sync canvas size to image size
      const img = imageRef.current;
      canvasRef.current.width = img.clientWidth;
      canvasRef.current.height = img.clientHeight;
      drawAllMarkings();
    }
  }, [markings, originalImage]);

  // Handle resizing of window to keep canvas synced
  useEffect(() => {
    const handleResize = () => {
      if (originalImage && canvasRef.current && imageRef.current) {
         const img = imageRef.current;
         canvasRef.current.width = img.clientWidth;
         canvasRef.current.height = img.clientHeight;
         drawAllMarkings();
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [originalImage]);

  const drawAllMarkings = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    markings.forEach(marking => {
      if (!marking || !marking.points || marking.points.length < 2) return;
      
      const colorHex = MARKER_COLORS.find(c => c.id === marking.color)?.hex;
      if (!colorHex) return;

      ctx.beginPath();
      ctx.strokeStyle = colorHex + '99'; 
      ctx.lineWidth = 14; // Fixed width, or can scale with image
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      const firstPoint = marking.points[0];
      if (!firstPoint) return;
      
      ctx.moveTo(firstPoint.x, firstPoint.y);
      marking.points.forEach(p => {
         if(p) ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
    });
  };

  const processFile = (file: File) => {
    const previewUrl = URL.createObjectURL(file);
    setOriginalImage({ file, previewUrl, mimeType: file.type });
    setGeneratedImage(null);
    setAnalysis('');
    setMarkings([]);
    setErrorMsg(null);
    setStatus(AppStatus.IDLE);
  };

  const handleRefImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setReferenceImages(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeRefImage = (index: number) => {
    setReferenceImages(prev => prev.filter((_, i) => i !== index));
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (!activeMarker || !canvasRef.current || !originalImage) return;
    setIsDrawing(true);
    
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    setMarkings(prev => [...prev, { color: activeMarker, points: [{ x, y }] }]);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !activeMarker || !canvasRef.current || !originalImage) return;
    e.preventDefault(); // Prevent scrolling on touch
    
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    setMarkings(prev => {
      if (prev.length === 0) return prev;
      const lastIndex = prev.length - 1;
      const last = prev[lastIndex];
      
      if (!last || !last.points) return prev;
      
      const newLast = { ...last, points: [...last.points, { x, y }] };
      const newMarkings = [...prev];
      newMarkings[lastIndex] = newLast;
      return newMarkings;
    });
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const getMarkedImageBase64 = (): string | undefined => {
    if (!originalImage || markings.length === 0) return undefined;
    const sourceImg = imageRef.current;
    if (!sourceImg) return undefined;

    const offCanvas = document.createElement('canvas');
    offCanvas.width = sourceImg.naturalWidth;
    offCanvas.height = sourceImg.naturalHeight;
    const ctx = offCanvas.getContext('2d');
    if (!ctx) return undefined;

    // Calculate scale factor between natural size and displayed size
    // Note: clientWidth can be 0 if image hidden, so handle that
    if (sourceImg.clientWidth === 0 || sourceImg.clientHeight === 0) return undefined;

    const scaleX = sourceImg.naturalWidth / sourceImg.clientWidth;
    const scaleY = sourceImg.naturalHeight / sourceImg.clientHeight;

    ctx.drawImage(sourceImg, 0, 0);
    
    markings.forEach(marking => {
      if (!marking || !marking.points || marking.points.length < 2) return;
      const colorObj = MARKER_COLORS.find(c => c.id === marking.color);
      if (!colorObj) return;

      ctx.beginPath();
      ctx.strokeStyle = colorObj.hex + 'FF'; // Fully opaque for the model to see clearly
      ctx.lineWidth = 14 * scaleX; 
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      const firstPoint = marking.points[0];
      if (!firstPoint) return;

      ctx.moveTo(firstPoint.x * scaleX, firstPoint.y * scaleY);
      marking.points.forEach(p => {
        if (p) ctx.lineTo(p.x * scaleX, p.y * scaleY);
      });
      ctx.stroke();
    });
    return offCanvas.toDataURL('image/png');
  };

  const handleGenerate = async (isExpansion = false) => {
    if (!originalImage?.file) return;
    setStatus(AppStatus.LOADING);
    setErrorMsg(null);
    try {
      const markedBase64 = getMarkedImageBase64();
      const result = await editImageWithGemini(
        originalImage.file, 
        prompt || "Professional enhancement", 
        {
          markedImageBase64: markedBase64,
          referenceImages: referenceImages,
          isExpansion,
          toolType: markings.length > 0 ? 'Marking' : 'Global'
        }
      );
      if (result.imageUrl) {
        setGeneratedImage(result.imageUrl);
        setAnalysis(result.analysis);
        setHistory(prev => [{ url: result.imageUrl!, date: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }, ...prev].slice(0, 6));
        setStatus(AppStatus.SUCCESS);
      } else {
        setErrorMsg("Process incomplete. Please refine your request.");
        setStatus(AppStatus.ERROR);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred during processing.");
      setStatus(AppStatus.ERROR);
    }
  };

  return (
    <div className="h-screen bg-[#0B0C10] text-slate-300 flex flex-col font-sans overflow-hidden relative">
      {/* Ambient Lighting Background */}
      <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-900/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-cyan-900/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="h-16 border-b border-white/[0.06] bg-[#0B0C10]/80 backdrop-blur-xl px-6 flex items-center justify-between sticky top-0 z-50 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.3)]">
            <Zap className="w-5 h-5 text-white fill-white" />
          </div>
          <div>
            <h1 className="font-bold tracking-tight text-white text-base leading-none">CHR EDIT_AI</h1>
            <p className="text-[10px] text-cyan-400 font-medium tracking-wide mt-0.5">V2.5 PRO SUITE</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.05]">
             <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
             <span className="text-[10px] font-semibold text-slate-400">GEMINI FLASH ACTIVE</span>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative z-10">
        {/* Left Toolbar */}
        <aside className="w-72 bg-[#0E0F14]/60 backdrop-blur-xl border-r border-white/[0.06] flex flex-col shrink-0 transition-all">
          <div className="p-5 space-y-8 overflow-y-auto custom-scrollbar h-full">
            
            {/* Marking Tools */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <Pencil className="w-3.5 h-3.5" /> Markup
                </h3>
                {markings.length > 0 && (
                   <button onClick={() => setMarkings([])} className="text-[10px] text-red-400 hover:text-red-300 transition-colors flex items-center gap-1">
                     Reset
                   </button>
                )}
              </div>
              <div className="space-y-2">
                {MARKER_COLORS.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setActiveMarker(activeMarker === m.id ? null : m.id)}
                    className={`w-full group flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all duration-200
                      ${activeMarker === m.id 
                        ? 'bg-white/[0.08] border-white/20 shadow-sm' 
                        : 'bg-transparent border-transparent hover:bg-white/[0.03] hover:border-white/5'}
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full ring-2 ring-opacity-50 ring-offset-2 ring-offset-[#0E0F14]" style={{ backgroundColor: m.hex, boxShadow: `0 0 8px ${m.hex}40` }} />
                      <div className="flex flex-col items-start">
                        <span className={`text-xs font-medium ${activeMarker === m.id ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`}>{m.label}</span>
                        <span className="text-[9px] text-slate-500">{m.desc}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* AI Quick Actions */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Wand2 className="w-3.5 h-3.5" /> Enhancers
              </h3>
              <div className="grid grid-cols-1 gap-2">
                {QUICK_TOOLS.map(tool => (
                  <button
                    key={tool.id}
                    onClick={() => setPrompt(tool.prompt)}
                    className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:border-cyan-500/30 hover:bg-cyan-500/5 transition-all group text-left"
                  >
                    <div className="p-1.5 rounded-md bg-white/5 text-slate-400 group-hover:text-cyan-400 group-hover:bg-cyan-500/10 transition-colors">
                      <tool.icon className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-medium text-slate-400 group-hover:text-slate-200 transition-colors">{tool.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* History Grid */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <History className="w-3.5 h-3.5" /> Recent
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {history.length > 0 ? history.map((h, i) => (
                  <button key={i} className="aspect-square rounded-lg border border-white/5 overflow-hidden hover:border-cyan-500/50 hover:shadow-lg transition-all relative group" onClick={() => setGeneratedImage(h.url)}>
                    <img src={h.url} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-1">
                        <span className="text-[8px] text-white font-mono">{h.date}</span>
                    </div>
                  </button>
                )) : (
                  <div className="col-span-3 py-6 text-center border border-dashed border-white/5 rounded-lg bg-white/[0.01]">
                    <span className="text-[10px] text-slate-600 font-medium">No history yet</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </aside>

        {/* Main Canvas Area */}
        <section className="flex-1 flex flex-col bg-[#0B0C10] relative">
          {/* Dot Pattern Background */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.03]" 
               style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
          </div>

          <div className="flex-1 p-6 flex flex-col overflow-hidden z-10">
            {/* Canvas Container */}
            <div 
              onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
              onDragLeave={() => setIsDraggingOver(false)}
              onDrop={(e) => { e.preventDefault(); setIsDraggingOver(false); if(e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]); }}
              className={`relative flex-1 rounded-2xl transition-all duration-300 group/canvas flex items-center justify-center overflow-hidden
                ${originalImage 
                  ? 'bg-[#0E0F14] shadow-2xl ring-1 ring-white/10' 
                  : 'bg-white/[0.01] border-2 border-dashed border-white/10 hover:border-cyan-500/20 hover:bg-white/[0.02]'}
                ${isDraggingOver ? '!border-cyan-500 !bg-cyan-500/5 scale-[0.99]' : ''}
              `}
            >
              {originalImage ? (
                // CRITICAL FIX: Tightly wrap the image so canvas coordinates match exactly
                <div 
                  className="relative inline-block"
                  style={{ maxHeight: '100%', maxWidth: '100%' }}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                >
                  <img 
                    ref={imageRef}
                    id="source-img" src={originalImage.previewUrl!} alt="Source" 
                    className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-2xl select-none block" 
                    onLoad={(e) => {
                      const img = e.currentTarget;
                      if (canvasRef.current) {
                        canvasRef.current.width = img.clientWidth;
                        canvasRef.current.height = img.clientHeight;
                      }
                    }}
                  />
                  <canvas ref={canvasRef} className="absolute inset-0 w-full h-full cursor-crosshair" />
                  
                  {/* Floating Action Bar */}
                  <div className="absolute top-4 left-4 flex items-center gap-2 pointer-events-none opacity-0 group-hover/canvas:opacity-100 transition-opacity duration-300 z-20">
                     <div className="bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full text-[10px] font-bold border border-white/10 uppercase tracking-widest text-white shadow-lg">Source Layer</div>
                  </div>

                  <button 
                    onClick={(e) => { e.stopPropagation(); setOriginalImage(null); setGeneratedImage(null); setMarkings([]); }}
                    className="absolute top-4 right-4 p-2.5 bg-black/40 hover:bg-red-500/80 backdrop-blur-md rounded-xl text-white transition-all opacity-0 group-hover/canvas:opacity-100 border border-white/10 shadow-lg z-20"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center gap-6 cursor-pointer group text-center max-w-sm mx-auto">
                  <div className="relative">
                    <div className={`absolute inset-0 bg-gradient-to-tr from-cyan-500 to-blue-600 opacity-20 blur-[50px] rounded-full transition-all duration-500 ${isDraggingOver ? 'opacity-40 scale-125' : ''}`} />
                    <div className={`w-24 h-24 rounded-3xl bg-[#1A1C23] border border-white/10 flex items-center justify-center shadow-2xl transition-all duration-300 ${isDraggingOver ? 'scale-110 border-cyan-500/50' : 'group-hover:scale-105 group-hover:border-white/20'}`}>
                      <Upload className={`w-10 h-10 ${isDraggingOver ? 'text-cyan-400' : 'text-slate-400 group-hover:text-white'} transition-colors`} />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white mb-2">Import Visual Asset</h3>
                    <p className="text-sm text-slate-500">Drag and drop your image here, or click to browse files.</p>
                  </div>
                </div>
              )}

              {/* Loading Overlay */}
              {status === AppStatus.LOADING && (
                <div className="absolute inset-0 bg-[#0B0C10]/80 backdrop-blur-md z-50 flex flex-col items-center justify-center animate-in fade-in duration-300">
                  <div className="relative mb-6">
                    <div className="w-20 h-20 rounded-full border-4 border-white/5 border-t-cyan-500 animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Zap className="w-6 h-6 text-cyan-400 fill-cyan-400 animate-pulse" />
                    </div>
                  </div>
                  <h3 className="text-lg font-bold text-white tracking-wide">Processing...</h3>
                  <p className="text-xs text-cyan-400/80 font-mono mt-2">AI MULTIMODAL EDITING IN PROGRESS</p>
                </div>
              )}
            </div>

            {/* Prompt Bar (Command Center) */}
            <div className="mt-6 flex flex-col gap-4 shrink-0">
               <div className="flex gap-4 items-stretch p-1.5 bg-[#0E0F14] border border-white/10 rounded-2xl shadow-2xl">
                  <div className="flex-1 relative">
                    <textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="Describe your edits (e.g., 'Make the background blurred', 'Remove the cup')"
                      className="w-full h-full bg-transparent border-none rounded-xl p-4 text-sm text-white placeholder:text-slate-600 focus:ring-0 resize-none font-medium leading-relaxed"
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                     <Button 
                      onClick={() => handleGenerate(false)} isLoading={status === AppStatus.LOADING} disabled={!originalImage}
                      className="h-full px-8 shadow-cyan-900/20"
                     >
                      <Wand2 className="w-4 h-4 mr-2" /> GENERATE
                     </Button>
                     <Button 
                      onClick={() => handleGenerate(true)} variant="secondary" isLoading={status === AppStatus.LOADING} disabled={!originalImage}
                      className="h-full w-14 px-0"
                      title="Expand Image"
                     >
                      <Scaling className="w-5 h-5 text-slate-300" />
                     </Button>
                  </div>
               </div>
               {errorMsg && (
                <div className="px-4 py-3 bg-red-500/10 border border-red-500/10 rounded-xl flex items-center gap-3 text-xs text-red-300 animate-in slide-in-from-bottom-2">
                  <AlertCircle className="w-4 h-4" /> <span>{errorMsg}</span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Right Output Panel */}
        <aside className="w-80 bg-[#0E0F14]/60 backdrop-blur-xl border-l border-white/[0.06] flex flex-col shrink-0">
          <div className="p-5 flex flex-col h-full gap-4 overflow-y-auto custom-scrollbar">
            
            {/* 1. Result Section */}
            <div className="flex-1 min-h-[40%] flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> Result
                </h3>
                {generatedImage && <span className="text-[10px] text-green-400 font-mono">RENDER_OK</span>}
              </div>
              
              <div className={`relative flex-1 rounded-xl border border-white/10 bg-[#0B0C10] overflow-hidden flex items-center justify-center transition-all group
                ${generatedImage ? 'shadow-2xl ring-1 ring-cyan-500/20' : ''}
              `}>
                {generatedImage ? (
                  <>
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                    <img src={generatedImage} alt="Output" className="w-full h-full object-contain relative z-10" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col items-center justify-center gap-3 p-6 z-20 backdrop-blur-sm">
                      <Button 
                        onClick={() => { const l = document.createElement('a'); l.href = generatedImage; l.download = `CHR_${Date.now()}.png`; l.click(); }}
                        className="w-full"
                      >
                        <Download className="w-4 h-4 mr-2" /> Download
                      </Button>
                      <Button 
                        variant="secondary"
                        onClick={() => {
                          const fetchImage = async () => {
                            const res = await fetch(generatedImage!);
                            const blob = await res.blob();
                            const file = new File([blob], `edit.png`, { type: 'image/png' });
                            processFile(file);
                          };
                          fetchImage();
                        }}
                        className="w-full"
                      >
                        <RefreshCw className="w-4 h-4 mr-2" /> Edit This
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3 opacity-30 p-8 text-center">
                    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
                      <ImageIcon className="w-6 h-6 text-slate-400" />
                    </div>
                    <p className="text-xs text-slate-500 font-medium">Output will appear here</p>
                  </div>
                )}
              </div>
            </div>

            {/* 2. Multi-Reference Section */}
            <div className="shrink-0 h-[30%] border-t border-white/10 pt-4 flex flex-col gap-3">
               <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-blue-400" /> Reference
                  </h3>
                  <button onClick={() => refInputRef.current?.click()} className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1">
                    <Plus className="w-3 h-3" /> ADD
                  </button>
               </div>
               
               <div 
                 onClick={() => referenceImages.length === 0 && refInputRef.current?.click()}
                 className={`flex-1 rounded-xl border border-white/10 bg-[#0B0C10] overflow-hidden overflow-y-auto custom-scrollbar p-2 transition-all
                   ${referenceImages.length === 0 ? 'border-dashed border-blue-500/30 hover:bg-blue-500/5 cursor-pointer flex items-center justify-center' : ''}
                   ${referenceImages.length > 0 ? 'border-blue-500/30' : ''}
                 `}
               >
                  {referenceImages.length === 0 ? (
                    <div className="text-center opacity-40">
                      <span className="text-[10px] font-mono block">DROP REFERENCES</span>
                      <span className="text-[9px] block text-slate-500 mt-1">FOR STYLE / CONTENT</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {referenceImages.map((file, i) => (
                        <div key={i} className="relative aspect-square rounded-lg overflow-hidden group">
                           <img src={URL.createObjectURL(file)} className="w-full h-full object-cover" />
                           <button 
                            onClick={(e) => { e.stopPropagation(); removeRefImage(i); }}
                            className="absolute top-1 right-1 p-1 bg-black/60 rounded-md text-white opacity-0 group-hover:opacity-100 transition-opacity"
                           >
                             <X className="w-3 h-3" />
                           </button>
                        </div>
                      ))}
                      <button onClick={() => refInputRef.current?.click()} className="aspect-square rounded-lg border border-dashed border-white/10 flex items-center justify-center hover:bg-white/5 transition-colors">
                        <Plus className="w-4 h-4 text-slate-500" />
                      </button>
                    </div>
                  )}
               </div>
               <input type="file" ref={refInputRef} multiple onChange={handleRefImageUpload} className="hidden" accept="image/*" />
            </div>

            {/* Analysis Text */}
            {analysis && (
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 shrink-0">
                 <p className="text-[10px] text-slate-500 leading-snug font-mono line-clamp-3">{analysis}</p>
              </div>
            )}
          </div>
        </aside>
      </div>

      <input type="file" ref={fileInputRef} onChange={(e) => {if(e.target.files?.[0]) processFile(e.target.files[0])}} className="hidden" accept="image/*" />

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
        
        canvas { touch-action: none; }
        .cursor-crosshair { cursor: crosshair; }
      `}</style>
    </div>
  );
};

export default App;
