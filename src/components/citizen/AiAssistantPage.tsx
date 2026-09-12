import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, Send, Sparkles, ShieldCheck, Scale, FileText, 
  ArrowRight, Copy, Check, RefreshCw, Bookmark, Calendar,
  AlertCircle, HelpCircle, ChevronRight, User, FileCode, X,
  Download, Volume2, VolumeX, ListChecks, Clock, Compass, FileCheck,
  Mic, MicOff, ShieldAlert, History, Plus, PhoneCall, Zap,
  AlertTriangle, RotateCcw
} from 'lucide-react';
import { 
  Language, AppRoute, ChatMessage, AuthUser, LegalRight, 
  AiCaseSummary, ChatSession, EmergencyHelpline 
} from '../../types';
import { 
  getStoredChatMessages, saveChatMessages, clearChatMessages, 
  toggleSavedResource 
} from '../../data/portalData';
import { 
  requestAiLegalGuidance, 
  requestAiCaseSummary, 
  streamChatMessage, 
  fetchUserConversations, 
  saveUserConversation, 
  deleteUserConversation 
} from '../../services/aiService';
import { LegalMarkdownViewer } from './LegalMarkdownViewer';
import { EmergencyHelplineCard } from './EmergencyHelplineCard';
import { ChatHistoryDrawer } from './ChatHistoryDrawer';

interface AiAssistantPageProps {
  user: AuthUser;
  language: Language;
  onNavigate: (route: AppRoute, params?: any) => void;
}

export function AiAssistantPage({
  user,
  language,
  onNavigate,
}: AiAssistantPageProps) {
  // Session State
  const [currentSessionId, setCurrentSessionId] = useState<string>(() => `session_${Date.now()}`);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);

  // Initial Welcome Message
  const getWelcomeMessage = (): ChatMessage => ({
    id: 'msg_welcome',
    sender: 'assistant',
    text: language === 'en'
      ? `### ⚖️ Namaste! I am Nyaay Sarthi AI Legal Assistant
Powered by **Google Gemini 3.7 Flash** with deep grounding in the **Constitution of India, BNS, BNSS, Consumer & Cyber Laws**.

---

### 🌟 How can I guide you today?
* 🏠 **Tenancy & Landlord Disputes** — Withholding security deposits, arbitrary rent hikes, illegal lockouts.
* 🛒 **Consumer Protection Act (2019)** — Defective items, delayed delivery refunds, e-Daakhil filing.
* 💳 **Cyber Crime & Financial Frauds** — Unauthorized UPI transfers, phishing scams, golden hour **1930** reporting.
* 🚔 **Police & Criminal Complaints** — Refusal of **Zero FIR**, bail procedures, Section 173 BNSS.
* 💼 **Labour & Employment Rights** — Unpaid wages, gratuity withholding, wrongful termination.
* 💡 **Free Legal Aid (NALSA 15100)** — Eligibility under Section 12 for court-assigned advocates.

---

💬 *Type or speak your legal inquiry below in simple English or Hindi!*`
      : `### ⚖️ नमस्ते! मैं न्याय सारथी AI कानूनी सहायक हूँ
मैं **Google Gemini 3.7 Flash** और **भारतीय कानूनी संहिताओं (BNS, BNSS, उपभोक्ता व साइबर कानून)** के आधार पर आपकी सहायता के लिए तैयार हूँ।

---

### 🌟 मैं आपकी किस प्रकार सहायता कर सकता हूँ?
* 🏠 **मकान मालिक व किरायेदारी विवाद** — सिक्योरिटी डिपॉजिट वापसी, अवैध बेदखली, किराया विवाद।
* 🛒 **उपभोक्ता संरक्षण अधिनियम (2019)** — ऑनलाइन फ्रॉड, खराब सामान, ई-दाखिल पोर्टल पर शिकायत।
* 💳 **साइबर फ्रॉड व बैंकिंग धोखाधड़ी** — अनधिकृत UPI ट्रांजेक्शन, OTP फ्रॉड, गोल्डन ऑवर **1930** हेल्पलाइन।
* 🚔 **पुलिस शिकायत व ज़ीरो FIR** — FIR दर्ज न होना, जमानत नियम, धारा 173 BNSS।
* 💼 **श्रम व नौकरी के अधिकार** — वेतन व ग्रेच्युटी रोकना, गलत निष्कासन।
* 💡 **नालसा निशुल्क विधिक सहायता (15100)** — धारा 12 के तहत सरकारी वकील सहायता।

---

💬 *अपनी कानूनी समस्या नीचे सरल हिंदी या अंग्रेजी में लिखें या बोलें!*`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    suggestions: language === 'en' ? [
      '🏠 Landlord is withholding my security deposit',
      '💳 Cyber fraud: unauthorized UPI deduction from bank',
      '🛒 Defective product delivered & seller refusing return',
      '🚔 Police refused to file my complaint (Zero FIR)'
    ] : [
      '🏠 मकान मालिक सिक्योरिटी डिपॉजिट वापस नहीं कर रहा',
      '💳 ऑनलाइन बैंक खाते से बिना अनुमति UPI पैसे कट गए',
      '🛒 ऑनलाइन मंगाया गया सामान खराब है और कंपनी बदल नहीं रही',
      '🚔 थाने में पुलिस ने शिकायत दर्ज करने से मना कर दिया'
    ]
  });

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = getStoredChatMessages();
    if (saved.length > 0) return saved;
    return [getWelcomeMessage()];
  });

  const [inputQuery, setInputQuery] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [streamedText, setStreamedText] = useState('');
  const [streamError, setStreamError] = useState<string | null>(null);

  // Active Emergency Alert State
  const [activeEmergency, setActiveEmergency] = useState<{
    isEmergency: boolean;
    category?: string;
    helplines: EmergencyHelpline[];
    alertBanner?: string;
  } | null>(null);

  // Mode: 'stream' (Real-time conversational streaming) vs 'deep' (Full statutory breakdown + Draft Notice)
  const [analysisMode, setAnalysisMode] = useState<'stream' | 'deep'>('stream');

  // Modals & UI States
  const [selectedDraftMessage, setSelectedDraftMessage] = useState<ChatMessage | null>(null);
  const [copiedDraft, setCopiedDraft] = useState(false);
  const [selectedSummary, setSelectedSummary] = useState<AiCaseSummary | null>(null);
  const [isSummarizingThread, setIsSummarizingThread] = useState(false);
  const [isSpeakingId, setIsSpeakingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const chatBottomRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Load Sessions for the current user
  useEffect(() => {
    const loadSessions = async () => {
      const userSessions = await fetchUserConversations(user?.id || 'default');
      setSessions(userSessions);
    };
    loadSessions();
  }, [user?.id]);

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = language === 'hi' ? 'hi-IN' : 'en-IN';

        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          if (transcript) {
            setInputQuery((prev) => (prev ? `${prev} ${transcript}` : transcript));
          }
          setIsListening(false);
        };

        recognition.onerror = () => setIsListening(false);
        recognition.onend = () => setIsListening(false);
        recognitionRef.current = recognition;
      }
    }
  }, [language]);

  const toggleVoiceInput = () => {
    if (!recognitionRef.current) {
      showToast(language === 'en' ? 'Voice recognition is not supported in your browser.' : 'आपके ब्राउज़र में वॉइस इनपुट उपलब्ध नहीं है।');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.error(err);
        setIsListening(false);
      }
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Messages container reference for contained scrolling
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // We do NOT auto-scroll the page/screen while the AI chat replies or streams
  // to give the user complete, undisturbed reading control over their view.

  // Sync conversation to current session
  const persistSession = (currentMessages: ChatMessage[]) => {
    const firstUserMsg = currentMessages.find(m => m.sender === 'user');
    const title = firstUserMsg ? firstUserMsg.text.slice(0, 45) + '...' : (language === 'en' ? 'Legal Consultation' : 'कानूनी परामर्श');

    const sessionData: ChatSession = {
      id: currentSessionId,
      userId: user?.id || 'default',
      title,
      summary: firstUserMsg?.text.slice(0, 100),
      messages: currentMessages,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    saveUserConversation(sessionData, user?.id || 'default');
    setSessions(prev => {
      const idx = prev.findIndex(s => s.id === currentSessionId);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = sessionData;
        return copy;
      }
      return [sessionData, ...prev];
    });
  };

  const quickPrompts = [
    { en: '🏠 Landlord deposit dispute', hi: '🏠 मकान मालिक डिपॉजिट विवाद' },
    { en: '🛒 Defective product refund', hi: '🛒 दोषपूर्ण सामान रिफंड' },
    { en: '💳 Unauthorized bank UPI fraud', hi: '💳 बैंक UPI फ्रॉड शिकायत' },
    { en: '💼 Wrongful employment termination', hi: '💼 नौकरी से गलत निष्कासन' },
    { en: '🚔 Police refusing Zero FIR', hi: '🚔 पुलिस जीरो FIR मना करना' },
    { en: '📜 Free Legal Aid (NALSA 15100)', hi: '📜 निशुल्क कानूनी सहायता' },
  ];

  // Send Message with Streaming or Deep Analysis Mode
  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputQuery;
    if (!text.trim() || isTyping) return;

    setStreamError(null);
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const userMsg: ChatMessage = {
      id: 'msg_user_' + Date.now(),
      sender: 'user',
      text: text.trim(),
      timestamp
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    saveChatMessages(newHistory);
    setInputQuery('');
    setIsTyping(true);
    setStreamedText('');

    if (analysisMode === 'stream') {
      // Real-time Token Streaming Mode
      let accumulated = '';
      const assistantMsgId = 'msg_ai_' + Date.now();

      try {
        await streamChatMessage({
          message: text.trim(),
          history: newHistory,
          language,
          user,
          conversationId: currentSessionId,
          onMetadata: (meta) => {
            if (meta.emergency) {
              setActiveEmergency({
                isEmergency: true,
                category: meta.category,
                helplines: meta.helplines,
                alertBanner: meta.alertBanner
              });
            }
          },
          onChunk: (chunk) => {
            accumulated += chunk;
            setStreamedText(accumulated);
          },
          onComplete: (fullText) => {
            const finalAiMsg: ChatMessage = {
              id: assistantMsgId,
              sender: 'assistant',
              text: fullText || accumulated,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              isAiGenerated: true,
              flaggedEmergency: activeEmergency?.isEmergency,
              emergencyHelplines: activeEmergency?.helplines,
              emergencyCategory: activeEmergency?.category
            };

            const finalizedList = [...newHistory, finalAiMsg];
            setMessages(finalizedList);
            saveChatMessages(finalizedList);
            persistSession(finalizedList);
            setStreamedText('');
            setIsTyping(false);
          },
          onError: (err) => {
            console.error('Stream error:', err);
            setStreamError(err.message || 'Stream connection failed');
            setIsTyping(false);
            setStreamedText('');
          }
        });
      } catch (err: any) {
        console.error('Streaming invocation failed:', err);
        setStreamError(err.message || 'Error communicating with Gemini');
        setIsTyping(false);
        setStreamedText('');
      }
    } else {
      // Deep Analysis Mode (Statutory grounds, notice draft, advocate matching)
      try {
        const aiResponse = await requestAiLegalGuidance({
          message: text.trim(),
          history: newHistory,
          language,
          user,
          conversationId: currentSessionId
        });

        if (aiResponse.flaggedEmergency) {
          setActiveEmergency({
            isEmergency: true,
            category: aiResponse.emergencyCategory,
            helplines: aiResponse.emergencyHelplines || []
          });
        }

        const updated = [...newHistory, aiResponse];
        setMessages(updated);
        saveChatMessages(updated);
        persistSession(updated);
      } catch (err: any) {
        console.error('Deep guidance error:', err);
        setStreamError(err.message || 'Failed to complete analysis.');
      } finally {
        setIsTyping(false);
      }
    }
  };

  const handleStartNewChat = () => {
    window.speechSynthesis?.cancel();
    setIsSpeakingId(null);
    const newSessionId = `session_${Date.now()}`;
    setCurrentSessionId(newSessionId);
    const welcome = [getWelcomeMessage()];
    setMessages(welcome);
    saveChatMessages(welcome);
    setActiveEmergency(null);
    setStreamError(null);
    showToast(language === 'en' ? 'New consultation thread started' : 'नया परामर्श सत्र शुरू हुआ');
  };

  const handleSelectSession = (sessionId: string) => {
    const found = sessions.find(s => s.id === sessionId);
    if (found) {
      setCurrentSessionId(sessionId);
      setMessages(found.messages.length > 0 ? found.messages : [getWelcomeMessage()]);
      saveChatMessages(found.messages);
      setActiveEmergency(null);
      showToast(language === 'en' ? 'Loaded conversation' : 'बातचीत लोड की गई');
    }
  };

  const handleDeleteSession = (sessionId: string) => {
    deleteUserConversation(sessionId, user?.id || 'default');
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    if (currentSessionId === sessionId) {
      handleStartNewChat();
    }
    showToast(language === 'en' ? 'Conversation deleted' : 'बातचीत हटाई गई');
  };

  const handleSaveToResources = (structuredData: NonNullable<ChatMessage['structuredData']>) => {
    const mockRight: LegalRight = {
      id: 'ai_right_' + Date.now(),
      category: (structuredData.legalArea as LegalRight['category']) || 'Consumer',
      name: structuredData.draftTitle || structuredData.legalArea || 'Legal Guidance',
      nameHi: structuredData.draftTitle || structuredData.legalArea || 'कानूनी परामर्श',
      shortDescription: structuredData.understanding || '',
      shortDescriptionHi: structuredData.understanding || '',
      whoItAppliesTo: 'Citizen facing ' + structuredData.legalArea,
      whoItAppliesToHi: 'नागरिक',
      legalSource: structuredData.rights?.[0] || 'Indian Statutory Law Provisions',
      exampleSituation: structuredData.understanding || '',
      exampleSituationHi: structuredData.understanding || '',
      possibleAction: structuredData.nextSteps?.[0] || 'Issue statutory notice',
      possibleActionHi: 'कानूनी नोटिस भेजें',
      relevantAuthority: structuredData.authority || 'District Legal Services Authority',
      requiredDocuments: structuredData.documents || [],
      advocateCategoryHint: structuredData.recommendedCategory || 'Civil Law'
    };
    toggleSavedResource(user.id, mockRight);
    showToast(language === 'en' ? 'Saved to your Saved Resources!' : 'सहेजे गए अधिकारों में जोड़ा गया!');
  };

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast(language === 'en' ? 'Copied to clipboard!' : 'क्लिपबोर्ड पर कॉपी किया गया!');
  };

  const handleCopyDraft = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedDraft(true);
    showToast(language === 'en' ? 'Notice draft copied to clipboard!' : 'नोटिस का ड्राफ्ट कॉपी कर लिया गया!');
    setTimeout(() => setCopiedDraft(false), 2000);
  };

  const handleDownloadDraft = (title: string, body: string) => {
    const element = document.createElement('a');
    const file = new Blob([body], { type: 'text/plain;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = `${title.replace(/\s+/g, '_')}_Draft.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    showToast(language === 'en' ? 'Draft downloaded successfully!' : 'ड्राफ्ट डाउनलोड हो गया!');
  };

  const handleSummarizeEntireThread = async () => {
    const userAndAiMsgs = messages.filter(m => m.id !== 'msg_welcome');
    if (userAndAiMsgs.length === 0) {
      showToast(language === 'en' ? 'Please ask a legal question first to generate a summary.' : 'कृपया पहले एक कानूनी प्रश्न पूछें।');
      return;
    }

    setIsSummarizingThread(true);
    try {
      const summary = await requestAiCaseSummary({
        messages: userAndAiMsgs,
        language
      });
      setSelectedSummary(summary);
    } catch (err) {
      console.error('Failed to summarize thread:', err);
      showToast(language === 'en' ? 'Failed to generate summary.' : 'सारांश बनाने में त्रुटि हुई।');
    } finally {
      setIsSummarizingThread(false);
    }
  };

  const handleSpeakText = (msgId: string, text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    if (isSpeakingId === msgId) {
      window.speechSynthesis.cancel();
      setIsSpeakingId(null);
      return;
    }

    window.speechSynthesis.cancel();
    // Clean markdown hashes and symbols for speech
    const cleanText = text.replace(/[#*`_\[\]]/g, ' ');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = language === 'hi' ? 'hi-IN' : 'en-IN';
    utterance.rate = 0.95;
    utterance.onend = () => setIsSpeakingId(null);
    utterance.onerror = () => setIsSpeakingId(null);
    setIsSpeakingId(msgId);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-12">
      
      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-slate-900/90 backdrop-blur-xl text-white text-xs font-semibold px-4 py-2.5 rounded-2xl shadow-[0_8px_32px_rgba(15,23,42,0.2)] border border-white/20 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Banner - Header & Mode Controller */}
      <div className="glass-panel bg-white/70 backdrop-blur-xl rounded-3xl p-5 sm:p-6 border border-white/85 shadow-[0_12px_40px_rgba(31,38,135,0.08)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-sky-900 uppercase tracking-wider">
            <Bot className="w-4 h-4 text-sky-600" />
            <span>{language === 'en' ? 'AI Legal Assistant • Powered by Gemini 3.7 Flash' : 'AI कानूनी सहायक • Gemini 3.7 Flash'}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {language === 'en' ? 'Nyaay Sarthi Legal Assistant' : 'न्याय सारथी AI सहायक'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 font-medium">
            {language === 'en'
              ? 'Real-time Indian law guidance, legal notice generator, and bar advocate matching.'
              : 'भारतीय कानूनों का रियल-टाइम विश्लेषण, नोटिस ड्राफ्ट व वकील सिफारिश।'}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          
          {/* Analysis Mode Toggle */}
          <div className="bg-slate-100/90 p-1 rounded-2xl flex items-center border border-slate-200 shadow-2xs">
            <button
              onClick={() => setAnalysisMode('stream')}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                analysisMode === 'stream'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Fast real-time conversational streaming response"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{language === 'en' ? 'Fast Stream' : 'तेज चैट'}</span>
            </button>

            <button
              onClick={() => setAnalysisMode('deep')}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                analysisMode === 'deep'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Deep analysis with legal sections, notice draft, and next steps"
            >
              <Scale className="w-3.5 h-3.5" />
              <span>{language === 'en' ? 'Deep Analysis' : 'विस्तृत विश्लेषण'}</span>
            </button>
          </div>

          {/* History Button */}
          <button
            onClick={() => setIsHistoryDrawerOpen(true)}
            className="glass-btn py-2 px-3 rounded-2xl border border-white/80 bg-white/60 hover:bg-white text-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer active:scale-97 transition-all shadow-xs"
          >
            <History className="w-3.5 h-3.5 text-sky-600" />
            <span>{language === 'en' ? 'History' : 'इतिहास'}</span>
            {sessions.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-sky-100 text-sky-800 text-[10px] flex items-center justify-center font-bold">
                {sessions.length}
              </span>
            )}
          </button>

          {/* New Chat Button */}
          <button
            onClick={handleStartNewChat}
            className="glass-btn-sky py-2 px-3 rounded-2xl border border-white/80 bg-sky-500/15 hover:bg-sky-500/25 text-sky-900 text-xs font-bold flex items-center gap-1.5 cursor-pointer active:scale-97 transition-all shadow-xs"
          >
            <Plus className="w-3.5 h-3.5 text-sky-600" />
            <span>{language === 'en' ? 'New Chat' : 'नई चैट'}</span>
          </button>

          {/* Case Summary */}
          <button
            onClick={handleSummarizeEntireThread}
            disabled={isSummarizingThread}
            className="glass-btn py-2 px-3 rounded-2xl bg-white/70 hover:bg-white text-amber-900 border border-amber-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-97 transition-all"
          >
            <Sparkles className={`w-3.5 h-3.5 text-amber-600 ${isSummarizingThread ? 'animate-spin' : ''}`} />
            <span>{isSummarizingThread ? (language === 'en' ? 'Summarizing...' : 'सारांश...') : (language === 'en' ? 'Summary' : 'सारांश')}</span>
          </button>
        </div>
      </div>

      {/* Persistent Disclaimer Banner */}
      <div className="bg-sky-500/10 backdrop-blur-md rounded-2xl p-3 border border-sky-300/40 flex items-start gap-2.5 text-xs text-sky-950 shadow-2xs">
        <Scale className="w-4 h-4 text-sky-700 shrink-0 mt-0.5" />
        <div className="space-y-0.5 flex-1">
          <span className="font-bold">
            {language === 'en' ? 'Legal Awareness Notice: ' : 'कानूनी सूचना: '}
          </span>
          <span className="text-sky-900 font-medium">
            {language === 'en'
              ? 'This assistant provides general legal information and statutory guidance, not formal legal representation. Always verify with a qualified advocate before filing pleadings in court.'
              : 'यह सहायक सामान्य कानूनी जानकारी व मार्गदर्शन प्रदान करता है, कानूनी सलाह नहीं। अदालत में याचिका दायर करने से पहले पंजीकृत वकील से परामर्श करें।'}
          </span>
        </div>
      </div>

      {/* Emergency Helpline Banner (if active) */}
      {activeEmergency && activeEmergency.isEmergency && (
        <EmergencyHelplineCard
          helplines={activeEmergency.helplines}
          category={activeEmergency.category}
          alertBanner={activeEmergency.alertBanner}
          language={language}
          onClose={() => setActiveEmergency(null)}
        />
      )}

      {/* Main Chat Box - Frosted Glass Container */}
      <div className="glass-panel bg-white/60 backdrop-blur-2xl rounded-3xl border border-white/80 shadow-[0_16px_48px_rgba(31,38,135,0.08)] overflow-hidden flex flex-col h-[650px]">
        
        {/* Messages Scroll Area */}
        <div ref={messagesContainerRef} className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-6 bg-transparent">
          
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';
            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-9 h-9 rounded-2xl bg-sky-600 text-white flex items-center justify-center font-bold shrink-0 mt-1 shadow-[0_4px_16px_rgba(37,99,235,0.3)] border border-white/40">
                    <Bot className="w-4.5 h-4.5" />
                  </div>
                )}

                <div className={`max-w-2xl space-y-3 ${isUser ? 'items-end' : 'items-start'}`}>
                  
                  {/* User Bubble */}
                  {isUser ? (
                    <div className="glass-btn-primary bg-gradient-to-r from-sky-500 via-sky-600 to-blue-600 text-white p-4 sm:p-5 rounded-3xl rounded-tr-none shadow-[0_6px_20px_rgba(37,99,235,0.25)] border border-white/30 text-[14px] sm:text-[15px] leading-relaxed">
                      <p className="font-medium">{msg.text}</p>
                      <span className="text-[11px] text-sky-100/90 block text-right mt-1.5 font-mono">
                        {msg.timestamp}
                      </span>
                    </div>
                  ) : (
                    /* Assistant Structured Bubble */
                    <div className="glass-card bg-white/90 backdrop-blur-xl border border-white/95 p-5 sm:p-7 rounded-3xl rounded-tl-none shadow-[0_6px_32px_rgba(31,38,135,0.07)] space-y-4 text-[14.5px] sm:text-[15.5px]">
                      
                      {/* Top Header with Gemini AI Badge & TTS Audio */}
                      <div className="flex items-center justify-between gap-2 pb-2 border-b border-sky-100/60">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-sky-900 bg-sky-500/15 px-2.5 py-0.5 rounded-full border border-sky-300/40">
                            <Sparkles className="w-3 h-3 text-sky-600 animate-pulse" />
                            {language === 'en' ? 'Gemini 3.7 Flash' : 'Gemini 3.7 Flash'}
                          </span>
                          <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-300/40 flex items-center gap-1">
                            <Check className="w-2.5 h-2.5 text-emerald-600" />
                            {language === 'en' ? 'Indian Law Grounded' : 'भारतीय कानून अनुसार'}
                          </span>
                          {msg.flaggedEmergency && (
                            <span className="text-[10px] font-bold text-rose-800 bg-rose-500/15 px-2 py-0.5 rounded-full border border-rose-300/40 flex items-center gap-1">
                              <ShieldAlert className="w-2.5 h-2.5 text-rose-600" />
                              {msg.emergencyCategory || 'Emergency'}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleCopyText(msg.text)}
                            title="Copy response"
                            className="p-1.5 text-slate-500 hover:text-sky-700 rounded-xl hover:bg-sky-500/15 cursor-pointer transition-colors"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleSpeakText(msg.id, msg.text)}
                            title="Listen to legal guidance"
                            className="p-1.5 text-slate-500 hover:text-sky-700 rounded-xl hover:bg-sky-500/15 cursor-pointer transition-colors"
                          >
                            {isSpeakingId === msg.id ? (
                              <VolumeX className="w-4 h-4 text-rose-500 animate-pulse" />
                            ) : (
                              <Volume2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Markdown Body */}
                      <LegalMarkdownViewer content={msg.text} />

                      {/* AI Executive Summary Box (if present) */}
                      {msg.summary && (
                        <div className="p-4 rounded-2xl bg-amber-500/10 backdrop-blur-md border border-amber-300/50 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-amber-950 font-bold text-xs">
                              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                              <span>{language === 'en' ? 'AI Case Brief & Executive Summary' : 'AI केस सारांश'}</span>
                            </div>
                            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                              msg.summary.riskLevel === 'Urgent' ? 'bg-rose-500/15 text-rose-900 border border-rose-300/40' :
                              msg.summary.riskLevel === 'High' ? 'bg-orange-500/15 text-orange-900 border border-orange-300/40' :
                              'bg-amber-500/15 text-amber-900 border border-amber-300/40'
                            }`}>
                              {msg.summary.riskLevel} Urgency
                            </span>
                          </div>
                          <p className="text-xs text-amber-950 font-medium leading-relaxed">
                            {msg.summary.overview}
                          </p>
                          <div className="pt-1 flex items-center justify-between">
                            <span className="text-[11px] text-amber-900 font-semibold">
                              ⏱ {msg.summary.timelineUrgency}
                            </span>
                            <button
                              onClick={() => setSelectedSummary(msg.summary!)}
                              className="text-xs font-bold text-amber-950 hover:text-sky-900 underline cursor-pointer"
                            >
                              {language === 'en' ? 'View Full Summary →' : 'विस्तृत सारांश देखें →'}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Structured Analysis Cards (in Deep Mode or when available) */}
                      {msg.structuredData && (
                        <div className="space-y-3 pt-2 border-t border-sky-100/60 text-xs">
                          
                          {/* 1. Core Legal Issue */}
                          <div className="p-3.5 rounded-2xl bg-white/60 backdrop-blur-md border border-white/80 space-y-1 shadow-2xs">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                              1. Core Legal Issue
                            </span>
                            <p className="text-slate-900 font-bold">{msg.structuredData.understanding}</p>
                          </div>

                          {/* 2. Key Statutory Provisions & 3. Legal Domain */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div className="p-3.5 rounded-2xl bg-sky-500/10 backdrop-blur-md border border-sky-300/40 space-y-1 shadow-2xs">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-900">
                                2. Statutory Sections
                              </span>
                              <ul className="list-disc list-inside space-y-0.5 text-slate-800">
                                {msg.structuredData.rights?.map((r, i) => (
                                  <li key={i} className="text-[11px] leading-tight font-medium">{r}</li>
                                ))}
                              </ul>
                            </div>

                            <div className="p-3.5 rounded-2xl bg-indigo-500/10 backdrop-blur-md border border-indigo-300/40 space-y-1 shadow-2xs">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-900">
                                3. Legal Domain
                              </span>
                              <p className="font-bold text-indigo-950 text-xs">{msg.structuredData.legalArea}</p>
                              <p className="text-[11px] text-indigo-900/90 pt-0.5 font-medium">
                                <strong>Assessment:</strong> {msg.structuredData.isActionable}
                              </p>
                            </div>
                          </div>

                          {/* 4. Authority & 5. Evidentiary Records */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div className="p-3.5 rounded-2xl bg-white/60 backdrop-blur-md border border-white/80 space-y-1 shadow-2xs">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                4. Competent Authority / Forum
                              </span>
                              <p className="font-bold text-slate-900 text-[11px]">{msg.structuredData.authority}</p>
                            </div>

                            <div className="p-3.5 rounded-2xl bg-white/60 backdrop-blur-md border border-white/80 space-y-1 shadow-2xs">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                5. Required Documents & Records
                              </span>
                              <ul className="list-disc list-inside space-y-0.5 text-slate-800 text-[11px] font-medium">
                                {msg.structuredData.documents?.map((d, i) => (
                                  <li key={i}>{d}</li>
                                ))}
                              </ul>
                            </div>
                          </div>

                          {/* 6. Action Steps */}
                          <div className="p-3.5 rounded-2xl bg-emerald-500/10 backdrop-blur-md border border-emerald-300/40 space-y-1 shadow-2xs">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-900">
                              6. Immediate Action Steps
                            </span>
                            <ol className="list-decimal list-inside space-y-1 text-slate-800 text-[11px]">
                              {msg.structuredData.nextSteps?.map((step, i) => (
                                <li key={i} className="font-semibold">{step}</li>
                              ))}
                            </ol>
                          </div>

                          {/* 7. Legal Aid Note */}
                          {msg.structuredData.legalAid && (
                            <div className="p-3 rounded-2xl bg-amber-500/10 backdrop-blur-md border border-amber-300/40 text-[11px] text-amber-950 flex items-start gap-2 shadow-2xs">
                              <Scale className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                              <span className="font-medium">{msg.structuredData.legalAid}</span>
                            </div>
                          )}

                          {/* Advocate Recommendation & Draft Card */}
                          <div className="p-5 rounded-3xl bg-slate-900/90 backdrop-blur-xl text-white space-y-3 shadow-[0_8px_32px_rgba(15,23,42,0.15)] border border-white/20">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <ShieldCheck className="w-4 h-4 text-sky-400" />
                                <span className="text-xs font-bold uppercase tracking-wider text-sky-300">
                                  Advocate Recommendation
                                </span>
                              </div>
                              <span className="text-[10px] font-bold text-sky-200 bg-white/10 px-2.5 py-0.5 rounded-full border border-white/20">
                                Bar Council Verified
                              </span>
                            </div>

                            <p className="text-xs text-slate-200 leading-relaxed font-medium">
                              An advocate experienced in{' '}
                              <strong className="text-white font-bold">{msg.structuredData.suggestedAdvocateSpecialty || msg.structuredData.legalArea}</strong>{' '}
                              can represent you before {msg.structuredData.authority}.
                            </p>

                            <div className="pt-1 flex flex-wrap items-center gap-2">
                              <button
                                onClick={() => onNavigate('appointments', { category: msg.structuredData?.recommendedCategory })}
                                className="glass-btn-primary py-2 px-4 rounded-xl text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-97 transition-all"
                              >
                                <span>Find Verified Advocates</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>

                              {msg.structuredData.draftBody && (
                                <button
                                  onClick={() => setSelectedDraftMessage(msg)}
                                  className="py-2 px-3.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 border border-white/20 cursor-pointer active:scale-97 transition-all"
                                >
                                  <FileCode className="w-3.5 h-3.5 text-sky-300" />
                                  <span>View Notice Draft</span>
                                </button>
                              )}

                              <button
                                onClick={() => handleSaveToResources(msg.structuredData!)}
                                className="py-2 px-3 rounded-xl text-slate-200 hover:text-white hover:bg-white/10 text-xs font-semibold flex items-center gap-1 cursor-pointer active:scale-97 transition-all"
                              >
                                <Bookmark className="w-3.5 h-3.5 text-sky-400" />
                                <span>Save</span>
                              </button>
                            </div>
                          </div>

                        </div>
                      )}

                      {/* Follow-up Suggestions Chips */}
                      {msg.suggestions && msg.suggestions.length > 0 && (
                        <div className="pt-3 border-t border-sky-100/60 space-y-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                            <Compass className="w-3 h-3 text-sky-600" />
                            {language === 'en' ? 'Suggested follow-up questions:' : 'सुझाए गए प्रश्न:'}
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {msg.suggestions.map((sug, i) => (
                              <button
                                key={i}
                                onClick={() => handleSendMessage(sug)}
                                className="py-1 px-3 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-950 border border-sky-300/40 text-[11px] font-semibold text-left transition-all active:scale-97 cursor-pointer"
                              >
                                💬 {sug}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <span className="text-[10px] text-slate-400 block font-mono">
                        {msg.timestamp}
                      </span>
                    </div>
                  )}

                </div>

                {isUser && (
                  <div className="w-9 h-9 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-bold shrink-0 mt-1 shadow-xs border border-white/20">
                    <User className="w-4.5 h-4.5" />
                  </div>
                )}
              </div>
            );
          })}

          {/* Active Streaming Chunk Display */}
          {isTyping && streamedText && (
            <div className="flex gap-3 justify-start animate-in fade-in duration-150">
              <div className="w-9 h-9 rounded-2xl bg-sky-600 text-white flex items-center justify-center font-bold shrink-0 mt-1 shadow-xs">
                <Bot className="w-4.5 h-4.5" />
              </div>
              <div className="max-w-2xl glass-card bg-white/90 backdrop-blur-xl border border-sky-300/60 p-5 sm:p-7 rounded-3xl rounded-tl-none shadow-lg space-y-3 text-[14.5px] sm:text-[15.5px]">
                <div className="flex items-center gap-2 text-[11px] font-bold text-sky-800 pb-2 border-b border-sky-100/70">
                  <Sparkles className="w-3.5 h-3.5 text-sky-600 animate-spin" />
                  <span>✨ Streaming Gemini 3.7 Flash Legal Guidance...</span>
                </div>
                <LegalMarkdownViewer content={streamedText} />
                <span className="inline-block w-2.5 h-4.5 bg-sky-600 animate-pulse align-middle ml-1 rounded-xs" />
              </div>
            </div>
          )}

          {/* Typing / Thinking Indicator */}
          {isTyping && !streamedText && (
            <div className="flex gap-3 items-center animate-in fade-in duration-200">
              <div className="w-9 h-9 rounded-2xl bg-sky-600 text-white flex items-center justify-center font-bold shrink-0 shadow-xs">
                <Bot className="w-4.5 h-4.5" />
              </div>
              <div className="glass-card bg-white/80 backdrop-blur-md border border-white/90 py-3 px-4 rounded-2xl text-xs font-semibold text-sky-900 flex items-center gap-2.5 shadow-xs">
                <Sparkles className="w-4 h-4 text-sky-600 animate-spin" />
                <span>
                  {language === 'en' 
                    ? 'Nyaay Sarthi is analyzing statutes and drafting response...' 
                    : 'न्याय सारथी AI कानूनी संहिताओं का विश्लेषण कर रहा है...'}
                </span>
              </div>
            </div>
          )}

          {/* Stream Error Box */}
          {streamError && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{streamError}</span>
              </div>
              <button
                onClick={() => handleSendMessage()}
                className="py-1 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer active:scale-95"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Retry</span>
              </button>
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="px-4 py-2.5 bg-white/45 backdrop-blur-md border-t border-white/70 overflow-x-auto flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0">
            {language === 'en' ? 'Quick Topics:' : 'त्वरित विषय:'}
          </span>
          {quickPrompts.map((qp, idx) => {
            const label = language === 'en' ? qp.en : qp.hi;
            return (
              <button
                key={idx}
                onClick={() => handleSendMessage(label)}
                disabled={isTyping}
                className="py-1 px-3 rounded-full bg-white/70 hover:bg-white text-slate-800 hover:text-sky-900 text-xs font-semibold border border-white/80 whitespace-nowrap cursor-pointer transition-all active:scale-95 shrink-0 disabled:opacity-50 shadow-2xs"
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Input Bar with Voice input & Send */}
        <div className="p-3 sm:p-4 bg-white/60 backdrop-blur-xl border-t border-white/80 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder={language === 'en'
                ? 'Describe your legal dispute or question in plain Hindi or English...'
                : 'अपनी कानूनी स्थिति या समस्या को यहां लिखें (हिंदी या अंग्रेजी)...'}
              disabled={isTyping}
              className="flex-1 py-3 px-4 rounded-2xl bg-white/70 backdrop-blur-md border border-white/80 text-xs sm:text-sm text-slate-900 focus:bg-white/95 focus:outline-none focus:ring-2 focus:ring-sky-500/25 focus:border-sky-400 font-medium disabled:opacity-60 shadow-inner"
            />

            <button
              type="button"
              onClick={toggleVoiceInput}
              title={isListening ? 'Stop listening' : 'Voice input'}
              className={`p-3 rounded-2xl border transition-all cursor-pointer active:scale-95 ${
                isListening
                  ? 'bg-rose-500 text-white border-rose-600 animate-pulse shadow-[0_0_18px_rgba(244,63,94,0.5)]'
                  : 'bg-white/70 text-slate-700 hover:text-sky-700 hover:bg-white border-white/80 shadow-xs'
              }`}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <button
              type="submit"
              disabled={!inputQuery.trim() || isTyping}
              className="glass-btn-primary py-3 px-5 rounded-2xl text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer shadow-[0_4px_16px_rgba(37,99,235,0.25)] transition-all active:scale-95 shrink-0 disabled:opacity-50"
            >
              <span>{language === 'en' ? 'Send' : 'भेजें'}</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>

      </div>

      {/* Chat History Drawer */}
      <ChatHistoryDrawer
        isOpen={isHistoryDrawerOpen}
        onClose={() => setIsHistoryDrawerOpen(false)}
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSelectSession={handleSelectSession}
        onNewSession={handleStartNewChat}
        onDeleteSession={handleDeleteSession}
        language={language}
      />

      {/* Draft Legal Notice Modal */}
      {selectedDraftMessage && selectedDraftMessage.structuredData && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white/95 backdrop-blur-2xl rounded-3xl p-6 sm:p-8 space-y-5 shadow-[0_24px_64px_rgba(31,38,135,0.2)] border border-white/85 animate-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-sky-100/60">
              <div className="flex items-center gap-2">
                <FileCode className="w-5 h-5 text-sky-600" />
                <h3 className="text-base font-bold text-slate-900">
                  {selectedDraftMessage.structuredData.draftTitle}
                </h3>
              </div>
              <button
                onClick={() => setSelectedDraftMessage(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 font-medium">
              {language === 'en'
                ? 'This formal legal notice draft is prepared according to Indian statutory practice. Fill in the bracketed placeholders [ ] with your specific transaction details.'
                : 'यह वैधानिक नोटिस प्रारूप तैयार है। कोष्ठक [ ] वाले स्थानों में अपनी सटीक जानकारी भरें।'}
            </p>

            <div className="flex-1 overflow-y-auto p-4 rounded-2xl bg-slate-900/90 text-slate-100 font-mono text-xs leading-relaxed whitespace-pre-wrap border border-white/20 shadow-inner">
              {selectedDraftMessage.structuredData.draftBody}
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-sky-100/60">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopyDraft(selectedDraftMessage.structuredData!.draftBody!)}
                  className="glass-btn-sky py-2 px-3.5 rounded-xl bg-white/80 text-sky-800 border border-white/80 text-xs font-bold hover:bg-white flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-97"
                >
                  {copiedDraft ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedDraft ? 'Copied!' : 'Copy Notice'}</span>
                </button>

                <button
                  onClick={() => handleDownloadDraft(
                    selectedDraftMessage.structuredData!.draftTitle || 'Legal_Notice',
                    selectedDraftMessage.structuredData!.draftBody!
                  )}
                  className="glass-btn py-2 px-3.5 rounded-xl bg-white/60 text-slate-700 border border-white/80 text-xs font-bold hover:bg-white flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-97"
                >
                  <Download className="w-4 h-4" />
                  <span>Download .txt</span>
                </button>
              </div>

              <button
                onClick={() => setSelectedDraftMessage(null)}
                className="py-2 px-5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer active:scale-97 shadow-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Case Summary & Executive Brief Modal */}
      {selectedSummary && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white/95 backdrop-blur-2xl rounded-3xl p-6 sm:p-8 space-y-5 shadow-[0_24px_64px_rgba(31,38,135,0.2)] border border-white/85 animate-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-sky-100/60">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-600" />
                <h3 className="text-base font-bold text-slate-900">
                  {selectedSummary.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedSummary(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              
              {/* Overview & Urgency */}
              <div className="p-4 rounded-2xl bg-white/60 backdrop-blur-md border border-white/80 space-y-2 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Executive Synopsis
                  </span>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                    selectedSummary.riskLevel === 'Urgent' ? 'bg-rose-500/15 text-rose-900 border border-rose-300/40' :
                    selectedSummary.riskLevel === 'High' ? 'bg-orange-500/15 text-orange-900 border border-orange-300/40' :
                    'bg-amber-500/15 text-amber-900 border border-amber-300/40'
                  }`}>
                    {selectedSummary.riskLevel} Risk & Urgency
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-800 font-medium leading-relaxed">
                  {selectedSummary.overview}
                </p>
                <p className="text-xs text-slate-600 pt-1 font-medium">
                  <strong>Statutory Window:</strong> {selectedSummary.timelineUrgency}
                </p>
              </div>

              {/* Key Grounds */}
              <div className="p-4 rounded-2xl bg-sky-500/10 backdrop-blur-md border border-sky-300/40 space-y-2 shadow-xs">
                <span className="text-[11px] font-bold text-sky-900 uppercase tracking-wider flex items-center gap-1.5">
                  <ListChecks className="w-4 h-4 text-sky-700" />
                  Key Legal Merits & Statutory Grounds
                </span>
                <ul className="space-y-1.5 text-xs text-slate-800 font-medium">
                  {selectedSummary.keyPoints.map((point, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-sky-600 font-bold">•</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* 48-Hour Checklist */}
              <div className="p-4 rounded-2xl bg-emerald-500/10 backdrop-blur-md border border-emerald-300/40 space-y-2 shadow-xs">
                <span className="text-[11px] font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-emerald-700" />
                  Immediate 48-Hour Citizen Checklist
                </span>
                <ul className="space-y-1.5 text-xs text-slate-800">
                  {selectedSummary.next48Hours.map((task, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <FileCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span className="font-semibold">{task}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Advocate Consultation Pitch / Brief */}
              <div className="p-4 rounded-2xl bg-slate-900/90 text-white space-y-2 border border-white/20 shadow-xs">
                <span className="text-[11px] font-bold text-sky-300 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-sky-400" />
                  What to Tell Your Advocate (Consultation Brief)
                </span>
                <p className="text-xs text-slate-200 leading-relaxed font-mono bg-white/5 p-3 rounded-xl border border-white/10">
                  "{selectedSummary.advocateBrief}"
                </p>
                <p className="text-[11px] text-sky-200 pt-1 font-medium">
                  <strong>Expected Relief / Remedy:</strong> {selectedSummary.estimatedRemedy}
                </p>
              </div>

            </div>

            <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-sky-100/60">
              <button
                onClick={() => {
                  const summaryText = `AI CASE SUMMARY - ${selectedSummary.title}\n\nOVERVIEW:\n${selectedSummary.overview}\n\nKEY MERITS:\n${selectedSummary.keyPoints.join('\n')}\n\nNEXT 48 HOURS:\n${selectedSummary.next48Hours.join('\n')}\n\nADVOCATE BRIEF:\n${selectedSummary.advocateBrief}\n\nESTIMATED REMEDY:\n${selectedSummary.estimatedRemedy}`;
                  handleDownloadDraft(selectedSummary.title, summaryText);
                }}
                className="glass-btn py-2 px-3.5 rounded-xl bg-white/70 hover:bg-white text-slate-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-97"
              >
                <Download className="w-4 h-4" />
                <span>Export Brief (.txt)</span>
              </button>

              <button
                onClick={() => setSelectedSummary(null)}
                className="py-2 px-5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer active:scale-97 shadow-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
