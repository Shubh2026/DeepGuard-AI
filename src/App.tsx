/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  ShieldCheck,
  ShieldAlert,
  FileVideo,
  FileImage,
  Loader2,
  Info,
  ChevronRight,
  RefreshCcw,
  AlertCircle,
  Home,
  Search,
  History as HistoryIcon,
  HelpCircle,
  Settings,
  ArrowUp,
  Zap,
  Lock,
  Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const DEFAULT_OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'google/gemini-2.5-pro';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';
const APP_TITLE = 'DeepGuard';

const MODEL_OPTIONS = [
  {
    id: 'google/gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    provider: 'Google',
    description: 'Strong multimodal analysis for images and video.',
  },
  {
    id: 'openai/gpt-4o',
    label: 'GPT-4o',
    provider: 'OpenAI',
    description: 'Fast multimodal vision model for image-heavy checks.',
  },
  {
    id: 'openai/gpt-4.1',
    label: 'GPT-4.1',
    provider: 'OpenAI',
    description: 'Higher-end reasoning plus vision support for deeper reviews.',
  },
] as const;

type SupportedModel = (typeof MODEL_OPTIONS)[number]['id'];

type OpenRouterMessageContent =
  | string
  | Array<
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string } }
      | { type: 'video_url'; video_url: { url: string } }
    >;

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: OpenRouterMessageContent;
    };
  }>;
  error?: {
    message?: string;
    code?: number | string;
    metadata?: {
      raw?: string;
    };
  };
};

const extractResponseText = (content?: OpenRouterMessageContent): string => {
  if (!content) return '';
  if (typeof content === 'string') return content;

  return content
    .map((part) => ('text' in part ? part.text : ''))
    .filter(Boolean)
    .join('\n');
};

type DetectionResult = {
  verdict: 'AI' | 'Real' | 'Inconclusive';
  confidence: number;
  reasoning: string;
  artifacts: string[];
  timestamp: number;
  fileName: string;
  fileType: string;
};

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [retryStatus, setRetryStatus] = useState<string | null>(null);
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<DetectionResult[]>([]);
  const [activeTab, setActiveTab] = useState('Home');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [highPrecisionMode, setHighPrecisionMode] = useState(true);
  const [autoSaveHistory, setAutoSaveHistory] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [selectedNode, setSelectedNode] = useState('Global-Alpha');
  const [selectedModel, setSelectedModel] = useState<SupportedModel>(DEFAULT_OPENROUTER_MODEL as SupportedModel);
  const [showModal, setShowModal] = useState<{ type: 'clear-history' | 'reset-data' | 'manage-plan' | null }>({ type: null });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [analysisPhase, setAnalysisPhase] = useState(0);

  const analysisPhases = [
    `Initializing ${selectedNode} connection...`,
    "Scanning pixel noise patterns...",
    "Analyzing metadata signatures...",
    "Checking temporal consistency...",
    "Verifying anatomical geometry...",
    "Calculating final confidence score..."
  ];

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isAnalyzing) {
      setAnalysisPhase(0);
      interval = setInterval(() => {
        setAnalysisPhase(prev => (prev + 1) % analysisPhases.length);
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [isAnalyzing]);

  // Load settings from localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem('deepguard_history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to load history", e);
      }
    }

    const savedHighPrecision = localStorage.getItem('deepguard_high_precision');
    if (savedHighPrecision !== null) {
      setHighPrecisionMode(JSON.parse(savedHighPrecision));
    }

    const savedAutoSave = localStorage.getItem('deepguard_auto_save');
    if (savedAutoSave !== null) {
      setAutoSaveHistory(JSON.parse(savedAutoSave));
    }

    const savedNotifications = localStorage.getItem('deepguard_notifications');
    if (savedNotifications !== null) {
      setNotificationsEnabled(JSON.parse(savedNotifications));
    }

    const savedNode = localStorage.getItem('deepguard_node');
    if (savedNode) {
      setSelectedNode(savedNode);
    }

    const savedModel = localStorage.getItem('deepguard_model');
    if (savedModel && MODEL_OPTIONS.some((model) => model.id === savedModel)) {
      setSelectedModel(savedModel as SupportedModel);
    }
  }, []);

  // Save history to localStorage
  useEffect(() => {
    localStorage.setItem('deepguard_history', JSON.stringify(history));
  }, [history]);

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem('deepguard_high_precision', JSON.stringify(highPrecisionMode));
  }, [highPrecisionMode]);

  useEffect(() => {
    localStorage.setItem('deepguard_auto_save', JSON.stringify(autoSaveHistory));
  }, [autoSaveHistory]);

  useEffect(() => {
    localStorage.setItem('deepguard_notifications', JSON.stringify(notificationsEnabled));
  }, [notificationsEnabled]);

  useEffect(() => {
    localStorage.setItem('deepguard_node', selectedNode);
  }, [selectedNode]);

  useEffect(() => {
    localStorage.setItem('deepguard_model', selectedModel);
  }, [selectedModel]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  const processFile = (selectedFile: File) => {
    if (!selectedFile.type.startsWith('image/') && !selectedFile.type.startsWith('video/')) {
      setError('Please upload an image or video file.');
      return;
    }

    if (selectedFile.size > 20 * 1024 * 1024) {
      setError('File size too large. Please upload a file under 20MB.');
      return;
    }

    setFile(selectedFile);
    setError(null);
    setResult(null);

    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      processFile(droppedFile);
    }
  };

  const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const analyzeContent = async () => {
    if (!file) return;

    setIsAnalyzing(true);
    setError(null);
    setRetryStatus(null);

    let retries = 0;
    const maxRetries = 3;
    const baseDelay = 4000;

    while (retries <= maxRetries) {
      try {
        if (!OPENROUTER_API_KEY || OPENROUTER_API_KEY === 'MY_OPENROUTER_API_KEY') {
          throw new Error('OpenRouter API key is missing. Add OPENROUTER_API_KEY to your .env file.');
        }

        const fileDataUrl = await fileToDataUrl(file);
        const mediaPart = file.type.startsWith('video/')
          ? { type: 'video_url' as const, video_url: { url: fileDataUrl } }
          : { type: 'image_url' as const, image_url: { url: fileDataUrl } };

        const prompt = `
          Analyze this ${file.type.startsWith('video/') ? 'video' : 'image'} to determine if it is real (captured by a camera) or AI-generated.
          ${highPrecisionMode ? 'PERFORM A DEEP NEURAL SCAN: Look for minute pixel-level inconsistencies, frequency domain artifacts, and subtle anatomical errors that might be missed in standard mode.' : ''}
          
          Look for common AI artifacts:
          - Images: Unnatural textures, lighting inconsistencies, anatomical errors (fingers, eyes), warped backgrounds, overly smooth skin, or strange blending.
          - Videos: Temporal inconsistencies (things changing shape between frames), "melting" backgrounds, unnatural movement, or audio-visual desync if applicable.
          
          Provide your response in JSON format with the following structure:
          {
            "verdict": "AI" | "Real" | "Inconclusive",
            "confidence": number (0-100),
            "reasoning": "Detailed explanation of why you reached this verdict",
            "artifacts": ["list", "of", "specific", "artifacts", "found"]
          }
        `;

        const response = await fetch(OPENROUTER_API_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': APP_URL,
            'X-Title': APP_TITLE,
          },
          body: JSON.stringify({
            model: selectedModel,
            max_tokens: 800,
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: prompt.trim() },
                  mediaPart,
                ],
              },
            ],
          }),
        });

        const responseBody = (await response.json()) as OpenRouterResponse;
        if (!response.ok) {
          const apiError =
            responseBody.error?.message ||
            responseBody.error?.metadata?.raw ||
            `OpenRouter request failed with status ${response.status}.`;
          const error = new Error(apiError) as Error & { status?: number };
          error.status = response.status;
          throw error;
        }

        const responseText = extractResponseText(responseBody.choices?.[0]?.message?.content);
        if (!responseText) throw new Error("No response from AI.");

        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsedResult = JSON.parse(jsonMatch[0]);
          const finalResult: DetectionResult = {
            ...parsedResult,
            timestamp: Date.now(),
            fileName: file.name,
            fileType: file.type
          };
          setResult(finalResult);
          if (autoSaveHistory) {
            setHistory(prev => [finalResult, ...prev].slice(0, 20)); // Keep last 20
          }
          setIsAnalyzing(false);
          return;
        } else {
          throw new Error("Failed to parse analysis results.");
        }
      } catch (err: any) {
        console.error(`Analysis attempt ${retries + 1} failed:`, err);

        const isRateLimit =
          err.message?.includes('429') ||
          err.status === 429 ||
          err.message?.toLowerCase().includes('quota') ||
          err.message?.toLowerCase().includes('rate limit');

        if (isRateLimit && retries < maxRetries) {
          retries++;
          const delay = baseDelay * Math.pow(2, retries - 1);
          setRetryStatus(`Rate limit reached. Retrying in ${Math.round(delay / 1000)}s... (Attempt ${retries}/${maxRetries})`);
          console.log(`Rate limit hit. Retrying in ${delay}ms...`);
          await sleep(delay);
          setRetryStatus(null);
          continue;
        }

        if (isRateLimit) {
          setError("The AI service is currently at maximum capacity. Please try again in 1-2 minutes.");
        } else {
          setError(err.message || "An error occurred during analysis.");
        }
        break;
      }
    }
    setIsAnalyzing(false);
    setRetryStatus(null);
  };

  const reset = () => {
    setFile(null);
    setPreviewUrl(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const navItems = [
    { name: 'Home', icon: Home },
    { name: 'Analyze', icon: Search },
    { name: 'History', icon: HistoryIcon },
    { name: 'How It Works', icon: HelpCircle },
    { name: 'Settings', icon: Settings },
  ];

  const Modal = ({ isOpen, onClose, title, children, actionLabel, onAction, actionVariant = 'primary' }: any) => (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-md glass-panel rounded-[40px] p-10 overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-purple/10 blur-[60px] -translate-y-1/2 translate-x-1/2" />
            <div className="relative z-10 space-y-8">
              <div className="space-y-2">
                <h3 className="text-2xl font-display font-bold tracking-tight">{title}</h3>
                <div className="text-gray-400 text-sm leading-relaxed">{children}</div>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={onClose}
                  className="flex-1 py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => { onAction(); onClose(); }}
                  className={`flex-1 py-3.5 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all shadow-xl ${actionVariant === 'danger'
                    ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/20'
                    : 'bg-brand-purple hover:bg-brand-neon text-white shadow-brand-purple/20'
                    }`}
                >
                  {actionLabel}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return (
    <div className="min-h-screen bg-bg-deep text-white font-sans selection:bg-brand-purple/30 flex overflow-hidden relative">
      <Modal
        isOpen={showModal.type === 'clear-history'}
        onClose={() => setShowModal({ type: null })}
        title="Clear History"
        actionLabel="Clear All"
        actionVariant="danger"
        onAction={() => {
          setHistory([]);
          localStorage.removeItem('deepguard_history');
        }}
      >
        Are you sure you want to delete all forensic scan history? This action cannot be undone.
      </Modal>

      <Modal
        isOpen={showModal.type === 'reset-data'}
        onClose={() => setShowModal({ type: null })}
        title="Reset All Data"
        actionLabel="Reset Platform"
        actionVariant="danger"
        onAction={() => {
          setHistory([]);
          localStorage.clear();
          window.location.reload();
        }}
      >
        This will wipe all local settings, history, and preferences. The platform will be restored to its default state.
      </Modal>

      <Modal
        isOpen={showModal.type === 'manage-plan'}
        onClose={() => setShowModal({ type: null })}
        title="Enterprise Portal"
        actionLabel="Go to Portal"
        onAction={() => { }}
      >
        DeepGuard Pro features are managed through your organization's central security portal. Please contact your system administrator for plan modifications.
      </Modal>
      {/* Mobile Menu Toggle */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="lg:hidden fixed top-6 right-6 z-50 p-3 bg-panel-bg backdrop-blur-xl border border-white/10 rounded-2xl text-white shadow-2xl"
      >
        <Activity className={`w-6 h-6 transition-transform ${isMobileMenuOpen ? 'rotate-90' : ''}`} />
      </button>

      {/* Sidebar */}
      <aside className={`w-72 bg-panel-bg backdrop-blur-2xl border-r border-white/5 flex flex-col p-8 shrink-0 z-40 fixed h-full transition-transform duration-500 lg:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center gap-4 mb-12">
          <div className="w-12 h-12 bg-gradient-to-br from-brand-purple to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-brand-purple/20">
            <Lock className="text-white w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-[0.3em] text-brand-neon uppercase glow-text-purple">DeepGuard</p>
            <h1 className="font-display font-bold text-lg leading-tight">AI Platform</h1>
          </div>
        </div>

        <nav className="space-y-3 flex-1">
          {navItems.map((item) => (
            <button
              key={item.name}
              onClick={() => {
                setActiveTab(item.name);
                setIsMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-4 px-5 py-3.5 rounded-2xl transition-all duration-300 group relative overflow-hidden ${activeTab === item.name
                ? 'bg-brand-purple/10 text-brand-neon border border-brand-purple/20 glow-purple'
                : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}
            >
              {activeTab === item.name && (
                <motion.div
                  layoutId="active-pill"
                  className="absolute left-0 w-1 h-6 bg-brand-purple rounded-full"
                />
              )}
              <item.icon className={`w-5 h-5 transition-transform group-hover:scale-110 ${activeTab === item.name ? 'text-brand-neon' : 'text-gray-500'}`} />
              <span className="font-semibold text-sm tracking-wide">{item.name}</span>
            </button>
          ))}
        </nav>

        <div className="mt-auto pt-8 border-t border-white/5 space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">System Status</span>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-bold text-emerald-500 uppercase">Live</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-medium text-gray-400">
                <span>Neural Load</span>
                <span>24%</span>
              </div>
              <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: "24%" }}
                  className="h-full bg-brand-purple"
                />
              </div>
            </div>
          </div>

          <div className="p-4 bg-white/[0.02] rounded-2xl border border-white/5">
            <p className="text-[10px] text-gray-500 leading-relaxed">
              <span className="text-brand-neon font-bold">Pro Tip:</span> Video analysis takes longer due to frame-by-frame neural scanning.
            </p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative lg:ml-72">
        {/* Background Gradients */}
        <div className="absolute top-0 right-0 w-[1000px] h-[1000px] bg-brand-purple/10 blur-[150px] rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-[800px] h-[800px] bg-indigo-600/5 blur-[120px] rounded-full translate-y-1/2 -translate-x-1/4 pointer-events-none"></div>

        <div className="max-w-6xl mx-auto px-6 lg:px-12 py-12 lg:py-20 relative z-10">
          {activeTab === 'Home' ? (
            <div className="space-y-24">
              {/* Hero Section */}
              <div className="space-y-8">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md"
                >
                  <ShieldCheck className="w-3 h-3 text-brand-neon" />
                  <span className="text-[10px] font-bold tracking-[0.3em] text-brand-neon uppercase">v2.4 Neural Engine Active</span>
                </motion.div>
                <motion.h2
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: 0.6 }}
                  className="text-5xl lg:text-8xl font-display font-bold tracking-tight leading-[1.05]"
                >
                  The gold standard in <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-neon via-indigo-400 to-brand-neon glow-text-purple">media verification.</span>
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-gray-400 text-lg lg:text-xl max-w-2xl font-light tracking-wide leading-relaxed"
                >
                  DeepGuard provides enterprise-grade AI detection for images and videos,
                  protecting organizations from synthetic media threats and misinformation.
                </motion.p>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="flex flex-wrap gap-6 pt-4"
                >
                  <button
                    onClick={() => setActiveTab('Analyze')}
                    className="bg-white text-black px-10 py-4 rounded-full font-bold text-sm hover:bg-gray-200 transition-all shadow-xl hover:scale-105 active:scale-95 flex items-center gap-3"
                  >
                    Start Analysis
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setActiveTab('How It Works')}
                    className="bg-white/5 text-white border border-white/10 px-10 py-4 rounded-full font-bold text-sm hover:bg-white/10 transition-all backdrop-blur-md"
                  >
                    View Documentation
                  </button>
                </motion.div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { label: 'Detection Accuracy', value: '99.4%', icon: Zap, color: 'text-brand-neon' },
                  { label: 'Neural Parameters', value: '1.2T+', icon: Activity, color: 'text-indigo-400' },
                  { label: 'Response Time', value: '< 2.5s', icon: RefreshCcw, color: 'text-amber-400' },
                ].map((stat, i) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 + i * 0.1 }}
                    className="glass-panel p-8 rounded-[32px] group hover:border-brand-purple/30 transition-all"
                  >
                    <div className="flex items-center gap-4 mb-4">
                      <div className={`p-3 bg-white/5 rounded-2xl ${stat.color}`}>
                        <stat.icon className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{stat.label}</span>
                    </div>
                    <p className="text-4xl font-display font-bold tracking-tight">{stat.value}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          ) : activeTab === 'Analyze' ? (
            <>
              {/* Hero Section */}
              <div className="mb-24 space-y-6">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md"
                >
                  <Activity className="w-3 h-3 text-brand-neon" />
                  <span className="text-[10px] font-bold tracking-[0.3em] text-brand-neon uppercase">Deepfake Detection Suite</span>
                </motion.div>
                <motion.h2
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: 0.6 }}
                  className="text-7xl font-display font-bold tracking-tight leading-[1.05]"
                >
                  Detect synthetic media with<br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-neon via-indigo-400 to-brand-neon glow-text-purple">real-time AI forensics.</span>
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-gray-400 text-lg max-w-2xl font-light tracking-wide"
                >
                  Advanced neural analysis for verifying media authenticity in a world of generative content.
                </motion.p>
              </div>

              {/* Action Cards */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                {/* Upload Studio */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="lg:col-span-7 glass-panel rounded-[32px] p-10 flex flex-col min-h-[500px]"
                >
                  <div className="mb-10 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold tracking-[0.2em] text-brand-neon uppercase mb-2">Upload Studio</p>
                      <h3 className="text-2xl font-display font-bold">Analyze your media</h3>
                    </div>
                    <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center border border-white/5">
                      <Upload className="w-5 h-5 text-gray-400" />
                    </div>
                  </div>

                  {!file ? (
                    <div
                      onDragOver={onDragOver}
                      onDrop={onDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-1 border-2 border-dashed border-white/10 rounded-[24px] p-12 bg-white/[0.02] hover:bg-white/[0.05] hover:border-brand-purple/40 transition-all cursor-pointer group flex flex-col items-center justify-center text-center space-y-8"
                    >
                      <div className="w-24 h-24 bg-gradient-to-br from-brand-purple to-indigo-600 rounded-[28px] flex items-center justify-center shadow-2xl shadow-brand-purple/30 group-hover:scale-110 transition-transform duration-500">
                        <ArrowUp className="text-white w-10 h-10" />
                      </div>
                      <div className="space-y-3">
                        <p className="text-2xl font-display font-bold tracking-tight">Drag & drop media</p>
                        <p className="text-gray-500 text-sm font-medium tracking-wide leading-relaxed">Images and videos up to 20MB.<br />Supported: PNG, JPG, MP4, MOV</p>
                      </div>
                      <button className="bg-white text-black px-10 py-3.5 rounded-full font-bold text-sm hover:bg-gray-200 transition-all shadow-xl hover:scale-105 active:scale-95">
                        Choose file
                      </button>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="image/*,video/*"
                        className="hidden"
                      />
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col space-y-8">
                      <div className="relative rounded-[24px] overflow-hidden bg-black/60 aspect-video flex items-center justify-center border border-white/10 group shadow-inner">
                        {file.type.startsWith('image/') ? (
                          <img
                            src={previewUrl!}
                            alt="Preview"
                            className="max-w-full max-h-full object-contain"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <video
                            src={previewUrl!}
                            controls
                            className="max-w-full max-h-full"
                          />
                        )}

                        {/* Scanning Animation Overlay */}
                        {isAnalyzing && (
                          <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden">
                            <motion.div
                              initial={{ top: '-10%' }}
                              animate={{ top: '110%' }}
                              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                              className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-brand-neon to-transparent shadow-[0_0_15px_rgba(167,139,250,0.8)]"
                            />
                            <div className="absolute inset-0 bg-brand-purple/5 backdrop-blur-[1px]"></div>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="w-full h-full opacity-20 bg-[radial-gradient(circle_at_center,_var(--color-brand-purple)_0%,_transparent_70%)] animate-pulse"></div>
                            </div>
                          </div>
                        )}

                        <button
                          onClick={reset}
                          className="absolute top-6 right-6 p-3.5 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white transition-all opacity-0 group-hover:opacity-100 hover:rotate-180 z-20"
                        >
                          <RefreshCcw className="w-5 h-5" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between p-6 bg-white/5 rounded-2xl border border-white/5">
                        <div className="flex items-center gap-5">
                          <div className="w-14 h-14 bg-brand-purple/10 rounded-2xl flex items-center justify-center border border-brand-purple/20">
                            {file.type.startsWith('image/') ? <FileImage className="text-brand-neon w-7 h-7" /> : <FileVideo className="text-brand-neon w-7 h-7" />}
                          </div>
                          <div>
                            <p className="font-bold text-base tracking-tight truncate max-w-[220px]">{file.name}</p>
                            <p className="text-xs text-gray-500 font-medium">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                          </div>
                        </div>
                        {!result && !isAnalyzing && (
                          <button
                            onClick={analyzeContent}
                            className="bg-brand-purple hover:bg-brand-neon text-white px-10 py-3.5 rounded-full font-bold text-sm transition-all shadow-lg shadow-brand-purple/30 flex items-center gap-3 hover:scale-105 active:scale-95"
                          >
                            Run Analysis
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-8 p-5 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-4 text-red-400"
                    >
                      <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                      <p className="text-sm font-semibold tracking-wide">{error}</p>
                    </motion.div>
                  )}
                </motion.div>

                {/* Analysis Results */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="lg:col-span-5 glass-panel rounded-[32px] p-10 flex flex-col"
                >
                  <div className="mb-10">
                    <p className="text-[10px] font-bold tracking-[0.2em] text-brand-neon uppercase mb-2">Analysis Results</p>
                    <h3 className="text-2xl font-display font-bold">Detection insights</h3>
                  </div>

                  <div className="flex-1 flex flex-col">
                    <AnimatePresence mode="wait">
                      {isAnalyzing ? (
                        <motion.div
                          key="analyzing"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="flex-1 flex flex-col items-center justify-center text-center space-y-12 py-10"
                        >
                          <div className="relative w-48 h-48 flex items-center justify-center">
                            {/* Outer Pulsing Rings */}
                            <motion.div
                              animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.3, 0.1] }}
                              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                              className="absolute w-full h-full border border-brand-purple/30 rounded-full"
                            />
                            <motion.div
                              animate={{ scale: [1.2, 1, 1.2], opacity: [0.05, 0.2, 0.05] }}
                              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                              className="absolute w-[140%] h-[140%] border border-indigo-500/10 rounded-full"
                            />

                            {/* Rotating Data Stream */}
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                              className="absolute w-full h-full"
                            >
                              {[...Array(8)].map((_, i) => (
                                <div
                                  key={i}
                                  className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-brand-neon rounded-full shadow-[0_0_10px_#A78BFA]"
                                  style={{ transform: `rotate(${i * 45}deg) translateY(-24px)` }}
                                />
                              ))}
                            </motion.div>

                            {/* Core Neural Node */}
                            <div className="relative w-24 h-24 bg-brand-purple/10 rounded-3xl border border-brand-purple/20 flex items-center justify-center backdrop-blur-xl shadow-[0_0_30px_rgba(139,92,246,0.2)]">
                              <motion.div
                                animate={{
                                  scale: [1, 1.1, 1],
                                  boxShadow: [
                                    "0 0 0px rgba(167,139,250,0)",
                                    "0 0 20px rgba(167,139,250,0.4)",
                                    "0 0 0px rgba(167,139,250,0)"
                                  ]
                                }}
                                transition={{ duration: 2, repeat: Infinity }}
                                className="w-12 h-12 bg-brand-purple rounded-2xl flex items-center justify-center"
                              >
                                <Zap className="w-6 h-6 text-white" />
                              </motion.div>

                              {/* Scanning Line */}
                              <motion.div
                                animate={{ top: ['0%', '100%', '0%'] }}
                                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                                className="absolute left-0 right-0 h-0.5 bg-brand-neon/50 z-10"
                              />
                            </div>

                            {/* Floating Particles */}
                            {[...Array(12)].map((_, i) => (
                              <motion.div
                                key={i}
                                initial={{ opacity: 0, scale: 0 }}
                                animate={{
                                  opacity: [0, 1, 0],
                                  scale: [0, 1, 0],
                                  x: (Math.random() - 0.5) * 200,
                                  y: (Math.random() - 0.5) * 200
                                }}
                                transition={{
                                  duration: 2 + Math.random() * 2,
                                  repeat: Infinity,
                                  delay: Math.random() * 2
                                }}
                                className="absolute w-1 h-1 bg-brand-neon/40 rounded-full"
                              />
                            ))}
                          </div>

                          <div className="space-y-6">
                            <div className="h-8 flex items-center justify-center">
                              <AnimatePresence mode="wait">
                                <motion.p
                                  key={analysisPhase}
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -10 }}
                                  className="text-brand-neon font-display font-bold text-lg tracking-wider"
                                >
                                  {retryStatus || analysisPhases[analysisPhase]}
                                </motion.p>
                              </AnimatePresence>
                            </div>
                            <div className="flex flex-col items-center gap-3">
                              <div className="w-64 h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                                <motion.div
                                  initial={{ width: "0%" }}
                                  animate={{ width: "100%" }}
                                  transition={{ duration: 12, ease: "linear" }}
                                  className="h-full bg-gradient-to-r from-brand-purple to-brand-neon"
                                />
                              </div>
                              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.3em]">Neural Processing in Progress</p>
                            </div>
                          </div>
                        </motion.div>
                      ) : result ? (
                        <motion.div
                          key="result"
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="flex-1 flex flex-col"
                        >
                          <div className={`p-10 rounded-[28px] text-center space-y-8 mb-10 relative overflow-hidden ${result.verdict === 'AI' ? 'bg-red-500/10 border border-red-500/20' :
                            result.verdict === 'Real' ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-white/5 border border-white/10'
                            }`}>
                            {highPrecisionMode && (
                              <div className="absolute top-4 right-4 flex items-center gap-1.5 px-2.5 py-1 bg-brand-purple/20 rounded-lg border border-brand-purple/30">
                                <Zap className="w-3 h-3 text-brand-neon" />
                                <span className="text-[8px] font-black text-brand-neon uppercase tracking-widest">Deep Scan</span>
                              </div>
                            )}
                            <div className="flex justify-center">
                              {result.verdict === 'AI' ? (
                                <div className="w-24 h-24 bg-red-500/20 rounded-[32px] flex items-center justify-center text-red-500 shadow-lg shadow-red-500/10">
                                  <ShieldAlert className="w-12 h-12" />
                                </div>
                              ) : result.verdict === 'Real' ? (
                                <div className="w-24 h-24 bg-emerald-500/20 rounded-[32px] flex items-center justify-center text-emerald-500 shadow-lg shadow-emerald-500/10">
                                  <ShieldCheck className="w-12 h-12" />
                                </div>
                              ) : (
                                <div className="w-24 h-24 bg-white/10 rounded-[32px] flex items-center justify-center text-gray-400">
                                  <Info className="w-12 h-12" />
                                </div>
                              )}
                            </div>

                            <div className="space-y-3">
                              <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-gray-500">Verdict</p>
                              <h3 className={`text-5xl font-display font-black tracking-tight ${result.verdict === 'AI' ? 'text-red-500' :
                                result.verdict === 'Real' ? 'text-emerald-500' : 'text-gray-400'
                                }`}>
                                {result.verdict === 'AI' ? 'AI DETECTED' :
                                  result.verdict === 'Real' ? 'REAL MEDIA' : 'UNCERTAIN'}
                              </h3>
                            </div>

                            <div className="flex flex-col items-center gap-4">
                              <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden">
                                <motion.div
                                  className={`h-full ${result.verdict === 'AI' ? 'bg-red-500' :
                                    result.verdict === 'Real' ? 'bg-emerald-500' : 'bg-gray-500'
                                    }`}
                                  initial={{ width: 0 }}
                                  animate={{ width: `${result.confidence}%` }}
                                  transition={{ duration: 1.2, ease: "easeOut" }}
                                />
                              </div>
                              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">{result.confidence}% Confidence Score</span>
                            </div>
                          </div>

                          <div className="space-y-8">
                            <div className="space-y-4">
                              <h4 className="font-bold text-[10px] uppercase tracking-[0.3em] text-brand-neon">Forensic Reasoning</h4>
                              <p className="text-gray-400 text-sm leading-relaxed font-medium">
                                {result.reasoning}
                              </p>
                            </div>

                            {result.artifacts.length > 0 && (
                              <div className="space-y-4">
                                <h4 className="font-bold text-[10px] uppercase tracking-[0.3em] text-brand-neon">Detected Artifacts</h4>
                                <div className="flex flex-wrap gap-2.5">
                                  {result.artifacts.map((artifact, i) => (
                                    <span key={i} className="px-5 py-2 bg-white/5 text-gray-300 rounded-xl text-[10px] font-bold border border-white/5 tracking-wide">
                                      {artifact}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="pt-6">
                              <button
                                onClick={() => {
                                  const report = `DeepGuard Forensic Report\n\nFile: ${result.fileName}\nVerdict: ${result.verdict}\nConfidence: ${result.confidence}%\nReasoning: ${result.reasoning}\nArtifacts: ${result.artifacts.join(', ')}\nTimestamp: ${new Date(result.timestamp).toLocaleString()}`;
                                  const blob = new Blob([report], { type: 'text/plain' });
                                  const url = URL.createObjectURL(blob);
                                  const a = document.createElement('a');
                                  a.href = url;
                                  a.download = `DeepGuard_Report_${result.fileName}.txt`;
                                  a.click();
                                }}
                                className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-3"
                              >
                                <ArrowUp className="w-4 h-4 rotate-180" />
                                Download Forensic Report
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-12 border border-dashed border-white/5 rounded-[32px] bg-white/[0.01]">
                          <div className="w-20 h-20 bg-white/[0.03] rounded-[28px] flex items-center justify-center mb-8">
                            <Info className="text-gray-700 w-10 h-10" />
                          </div>
                          <h3 className="text-2xl font-display font-bold text-gray-600 mb-3 tracking-tight">Waiting for data</h3>
                          <p className="text-gray-600 text-sm max-w-[260px] leading-relaxed font-medium">
                            Upload a file and run analysis to view the detection results and confidence scores.
                          </p>
                        </div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              </div>
            </>
          ) : activeTab === 'History' ? (
            <div className="space-y-12">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <h2 className="text-5xl font-display font-bold tracking-tight">Detection History</h2>
                  <p className="text-gray-500 font-medium">Review and manage your previous forensic scans.</p>
                </div>
                <button
                  onClick={() => setShowModal({ type: 'clear-history' })}
                  className="px-6 py-2.5 bg-red-500/10 text-red-400 rounded-full text-xs font-bold border border-red-500/20 hover:bg-red-500/20 transition-all"
                >
                  Clear All History
                </button>
              </div>

              {history.length === 0 ? (
                <div className="h-[500px] flex flex-col items-center justify-center text-center glass-panel rounded-[40px]">
                  <HistoryIcon className="w-16 h-16 text-gray-700 mb-6" />
                  <h3 className="text-2xl font-display font-bold text-gray-600">No history found</h3>
                  <p className="text-gray-600 text-sm mt-3 font-medium">Your recent forensic scans will appear here.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6">
                  {history.map((item, i) => (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      key={item.timestamp}
                      className="glass-panel rounded-[28px] p-8 flex items-center justify-between hover:border-brand-purple/30 transition-all group cursor-pointer"
                    >
                      <div className="flex items-center gap-8">
                        <div className={`w-16 h-16 rounded-[20px] flex items-center justify-center border transition-all group-hover:scale-110 ${item.verdict === 'AI' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                          item.verdict === 'Real' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-white/5 text-gray-400 border-white/10'
                          }`}>
                          {item.verdict === 'AI' ? <ShieldAlert className="w-8 h-8" /> : <ShieldCheck className="w-8 h-8" />}
                        </div>
                        <div>
                          <p className="font-display font-bold text-xl mb-1 tracking-tight">{item.fileName}</p>
                          <div className="flex items-center gap-3 text-gray-500 text-xs font-medium">
                            <span>{new Date(item.timestamp).toLocaleDateString()}</span>
                            <span className="w-1 h-1 bg-gray-700 rounded-full"></span>
                            <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right space-y-1">
                        <p className={`text-xs font-black uppercase tracking-[0.2em] ${item.verdict === 'AI' ? 'text-red-500' :
                          item.verdict === 'Real' ? 'text-emerald-500' : 'text-gray-400'
                          }`}>
                          {item.verdict === 'AI' ? 'AI Detected' : 'Real Media'}
                        </p>
                        <p className="text-sm font-bold text-gray-500 tracking-tight">{item.confidence}% Confidence</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          ) : activeTab === 'How It Works' ? (
            <div className="space-y-16">
              <div className="space-y-4">
                <h2 className="text-5xl font-display font-bold tracking-tight">How It Works</h2>
                <p className="text-gray-400 text-lg font-light max-w-2xl">
                  DeepGuard utilizes a multi-layered neural network architecture to identify synthetic media artifacts.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-8">
                  <div className="glass-panel p-10 rounded-[32px] space-y-6">
                    <div className="w-12 h-12 bg-brand-purple/10 rounded-2xl flex items-center justify-center border border-brand-purple/20">
                      <Search className="w-6 h-6 text-brand-neon" />
                    </div>
                    <h3 className="text-2xl font-display font-bold">Pixel-Level Analysis</h3>
                    <p className="text-gray-500 font-medium leading-relaxed">
                      AI generators often leave subtle noise patterns and compression artifacts that are invisible to the human eye.
                      Our engine scans for these mathematical inconsistencies in the underlying data.
                    </p>
                  </div>
                  <div className="glass-panel p-10 rounded-[32px] space-y-6">
                    <div className="w-12 h-12 bg-brand-purple/10 rounded-2xl flex items-center justify-center border border-brand-purple/20">
                      <Activity className="w-6 h-6 text-brand-neon" />
                    </div>
                    <h3 className="text-2xl font-display font-bold">Temporal Consistency</h3>
                    <p className="text-gray-500 font-medium leading-relaxed">
                      For videos, we analyze the relationship between frames. AI often struggles with "temporal coherence,"
                      causing objects to slightly morph or backgrounds to shift in ways that defy physics.
                    </p>
                  </div>
                </div>
                <div className="space-y-8">
                  <div className="glass-panel p-10 rounded-[32px] space-y-6">
                    <div className="w-12 h-12 bg-brand-purple/10 rounded-2xl flex items-center justify-center border border-brand-purple/20">
                      <ShieldCheck className="w-6 h-6 text-brand-neon" />
                    </div>
                    <h3 className="text-2xl font-display font-bold">Anatomical Verification</h3>
                    <p className="text-gray-500 font-medium leading-relaxed">
                      Our specialized models are trained to detect common generative errors in human anatomy,
                      such as irregular eye reflections, unnatural skin textures, and hand geometry.
                    </p>
                  </div>
                  <div className="glass-panel p-10 rounded-[32px] space-y-6">
                    <div className="w-12 h-12 bg-brand-purple/10 rounded-2xl flex items-center justify-center border border-brand-purple/20">
                      <Zap className="w-6 h-6 text-brand-neon" />
                    </div>
                    <h3 className="text-2xl font-display font-bold">Lighting & Shadows</h3>
                    <p className="text-gray-500 font-medium leading-relaxed">
                      Generative AI often fails to perfectly calculate global illumination. We track light sources
                      and shadow casting to ensure they align with the 3D geometry of the scene.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : activeTab === 'Settings' ? (
            <div className="space-y-16">
              <div className="space-y-4">
                <h2 className="text-5xl font-display font-bold tracking-tight">Settings</h2>
                <p className="text-gray-400 text-lg font-light max-w-2xl">
                  Configure your DeepGuard experience and manage your account preferences.
                </p>
              </div>

              <div className="max-w-3xl space-y-8">
                <div className="glass-panel rounded-[32px] overflow-hidden">
                  <div className="p-8 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center">
                        <Activity className="w-5 h-5 text-gray-400" />
                      </div>
                      <div>
                        <p className="font-bold">System Status</p>
                        <p className="text-xs text-gray-500 font-medium">All neural nodes operational</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                      <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Active</span>
                    </div>
                  </div>
                  <div className="p-8 space-y-8">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold">High Precision Mode</p>
                        <p className="text-xs text-gray-500 font-medium">Increases analysis depth at the cost of speed</p>
                      </div>
                      <button
                        onClick={() => setHighPrecisionMode(!highPrecisionMode)}
                        className={`w-12 h-6 rounded-full relative p-1 transition-all duration-300 ${highPrecisionMode ? 'bg-brand-purple' : 'bg-white/10'}`}
                      >
                        <motion.div
                          animate={{ x: highPrecisionMode ? 24 : 0 }}
                          className="w-4 h-4 bg-white rounded-full"
                        />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold">Auto-Save to History</p>
                        <p className="text-xs text-gray-500 font-medium">Automatically store all analysis results locally</p>
                      </div>
                      <button
                        onClick={() => setAutoSaveHistory(!autoSaveHistory)}
                        className={`w-12 h-6 rounded-full relative p-1 transition-all duration-300 ${autoSaveHistory ? 'bg-brand-purple' : 'bg-white/10'}`}
                      >
                        <motion.div
                          animate={{ x: autoSaveHistory ? 24 : 0 }}
                          className="w-4 h-4 bg-white rounded-full"
                        />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold">Push Notifications</p>
                        <p className="text-xs text-gray-500 font-medium">Receive alerts for high-threat synthetic detections</p>
                      </div>
                      <button
                        onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                        className={`w-12 h-6 rounded-full relative p-1 transition-all duration-300 ${notificationsEnabled ? 'bg-brand-purple' : 'bg-white/10'}`}
                      >
                        <motion.div
                          animate={{ x: notificationsEnabled ? 24 : 0 }}
                          className="w-4 h-4 bg-white rounded-full"
                        />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="glass-panel rounded-[32px] p-8 space-y-8">
                  <div className="space-y-2">
                    <h3 className="text-xl font-display font-bold">Vision Model Selection</h3>
                    <p className="text-xs text-gray-500 font-medium">Choose which OpenRouter vision model powers your forensic scan.</p>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    {MODEL_OPTIONS.map((model) => (
                      <button
                        key={model.id}
                        onClick={() => setSelectedModel(model.id)}
                        className={`p-5 rounded-2xl border transition-all text-left space-y-2 ${selectedModel === model.id
                          ? 'bg-brand-purple/10 border-brand-purple/40 text-white'
                          : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10'
                          }`}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="font-bold tracking-tight">{model.label}</p>
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-neon/80">{model.provider}</p>
                          </div>
                          <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${selectedModel === model.id
                            ? 'bg-brand-purple/20 text-brand-neon border border-brand-purple/30'
                            : 'bg-white/5 text-gray-500 border border-white/5'
                            }`}>
                            {selectedModel === model.id ? 'Active' : 'Available'}
                          </div>
                        </div>
                        <p className="text-xs leading-relaxed text-gray-500">{model.description}</p>
                        <p className="text-[10px] text-gray-600 font-mono">{model.id}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="glass-panel rounded-[32px] p-8 space-y-8">
                  <div className="space-y-2">
                    <h3 className="text-xl font-display font-bold">Neural Node Selection</h3>
                    <p className="text-xs text-gray-500 font-medium">Choose the processing cluster for your forensic scans</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {['Global-Alpha', 'Euro-Beta', 'Asia-Gamma', 'US-Delta'].map((node) => (
                      <button
                        key={node}
                        onClick={() => setSelectedNode(node)}
                        className={`p-4 rounded-2xl border transition-all text-left space-y-1 ${selectedNode === node
                          ? 'bg-brand-purple/10 border-brand-purple/40 text-brand-neon'
                          : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10'
                          }`}
                      >
                        <p className="text-xs font-bold uppercase tracking-widest">{node}</p>
                        <p className="text-[10px] opacity-60">Latency: {Math.floor(Math.random() * 50) + 10}ms</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="glass-panel rounded-[32px] p-8 space-y-6">
                  <h3 className="text-xl font-display font-bold">Data Management</h3>
                  <div className="flex items-center justify-between p-6 bg-white/5 rounded-2xl border border-white/5">
                    <div>
                      <p className="font-bold">Local Storage Usage</p>
                      <p className="text-xs text-gray-500 font-medium">{(JSON.stringify(history).length / 1024).toFixed(2)} KB used for history</p>
                    </div>
                    <button
                      onClick={() => setShowModal({ type: 'reset-data' })}
                      className="px-6 py-2.5 bg-red-500/10 text-red-400 rounded-xl text-xs font-bold border border-red-500/20 hover:bg-red-500/20 transition-all"
                    >
                      Reset All Data
                    </button>
                  </div>
                </div>

                <div className="p-8 bg-brand-purple/5 rounded-[32px] border border-brand-purple/10 flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <div className="w-14 h-14 bg-brand-purple/20 rounded-2xl flex items-center justify-center border border-brand-purple/30">
                      <Zap className="w-7 h-7 text-brand-neon" />
                    </div>
                    <div>
                      <h4 className="font-display font-bold text-xl">DeepGuard Pro</h4>
                      <p className="text-sm text-gray-400 font-medium">You are currently on the enterprise tier.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowModal({ type: 'manage-plan' })}
                    className="px-8 py-3 bg-white text-black rounded-full font-bold text-sm hover:bg-gray-200 transition-all"
                  >
                    Manage Plan
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-[600px] flex flex-col items-center justify-center text-center">
              <Loader2 className="w-14 h-14 text-brand-purple animate-spin mb-8" />
              <h3 className="text-3xl font-display font-bold mb-3 tracking-tight">{activeTab} Section</h3>
              <p className="text-gray-500 font-medium">This module is currently under development.</p>
            </div>
          )}
        </div>

        <footer className="relative z-10 px-6 lg:px-12 pb-10">
          <div className="max-w-6xl mx-auto border-t border-white/5 pt-6 text-center text-sm text-gray-500">
            Made with ❤️ & AI
          </div>
        </footer>
      </main>
    </div>
  );
}
