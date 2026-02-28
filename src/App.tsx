/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, 
  Mic, 
  MicOff, 
  Send, 
  Image as ImageIcon, 
  X, 
  Settings, 
  Info, 
  CheckCircle2, 
  XCircle,
  Smartphone,
  Languages,
  Loader2,
  ChevronRight,
  History,
  Pencil,
  Volume2,
  VolumeX,
  Globe
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { getMobileSolution, transcribeAudio, translateText } from './services/geminiService';
import { cn } from './lib/utils';

type Language = 'English' | 'Tamil' | 'Hindi';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  image?: string;
  timestamp: Date;
}

export default function App() {
  const [view, setView] = useState<'home' | 'chat'>('home');
  const [platform, setPlatform] = useState<'Android' | 'iOS'>('Android');
  const [mobileModel, setMobileModel] = useState('');
  const [problem, setProblem] = useState('');
  const [language, setLanguage] = useState<Language>('English');
  const [image, setImage] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [isSpeaking, setIsSpeaking] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState<Record<string, 'yes' | 'no'>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const startRecording = async (e?: React.MouseEvent | React.TouchEvent) => {
    e?.preventDefault();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Audio = (reader.result as string).split(',')[1];
          setIsLoading(true);
          const transcription = await transcribeAudio(base64Audio);
          if (transcription) {
            setProblem(prev => prev + (prev ? ' ' : '') + transcription);
          }
          setIsLoading(false);
        };
        reader.readAsDataURL(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err: any) {
      console.error('Error accessing microphone:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDismissedError') {
        alert('Microphone permission was denied or dismissed. Please enable it in your browser settings to use voice features.');
      } else {
        alert('Could not access microphone. Please check your device settings.');
      }
    }
  };

  const stopRecording = (e?: React.MouseEvent | React.TouchEvent) => {
    e?.preventDefault();
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!problem && !image) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: problem,
      image: image || undefined,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setProblem('');
    setImage(null);
    setIsLoading(true);

    try {
      const solution = await getMobileSolution(userMessage.content, language, platform, mobileModel, userMessage.image);
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: solution,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFeedback = (messageId: string, value: 'yes' | 'no') => {
    setFeedbackGiven(prev => ({ ...prev, [messageId]: value }));
  };

  const handleEdit = (msg: Message) => {
    setEditingMessageId(msg.id);
    setEditContent(msg.content);
  };

  const handleSaveEdit = async (id: string) => {
    if (!editContent.trim()) return;

    setMessages(prev => prev.map(m => m.id === id ? { ...m, content: editContent } : m));
    setEditingMessageId(null);
    setEditContent('');

    // If it's the last user message, we might want to re-generate the solution
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    if (lastUserMsg && lastUserMsg.id === id) {
      // Find the assistant message that follows it and remove it
      const msgIndex = messages.findIndex(m => m.id === id);
      const nextMsg = messages[msgIndex + 1];
      if (nextMsg && nextMsg.role === 'assistant') {
        setMessages(prev => prev.filter(m => m.id !== nextMsg.id));
      }
      
      // Re-trigger submission with the new content
      setIsLoading(true);
      try {
        const solution = await getMobileSolution(editContent, language, platform, mobileModel, lastUserMsg.image);
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: solution,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, assistantMessage]);
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleTranslate = async (messageId: string, targetLang: Language) => {
    const msg = messages.find(m => m.id === messageId);
    if (!msg) return;

    setIsLoading(true);
    try {
      const translated = await translateText(msg.content, targetLang);
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content: translated } : m));
    } catch (error) {
      console.error('Translation error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSpeech = (messageId: string, text: string) => {
    if (isSpeaking === messageId) {
      window.speechSynthesis.cancel();
      setIsSpeaking(null);
    } else {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Try to find a voice for the current language
      const voices = window.speechSynthesis.getVoices();
      const langCode = language === 'English' ? 'en' : language === 'Tamil' ? 'ta' : 'hi';
      const voice = voices.find(v => v.lang.startsWith(langCode));
      if (voice) utterance.voice = voice;

      utterance.onend = () => setIsSpeaking(null);
      utterance.onerror = () => setIsSpeaking(null);
      
      setIsSpeaking(messageId);
      window.speechSynthesis.speak(utterance);
    }
  };

  const translations = {
    English: {
      title: 'MobiFix',
      subtitle: 'Your AI Mobile Technician',
      placeholder: 'Describe your mobile problem...',
      send: 'Send',
      solved: 'Did this solve your problem?',
      yes: 'Yes',
      no: 'No',
      about: 'About MobiFix',
      aboutDesc: 'MobiFix is an AI-powered platform designed to help you solve mobile software issues instantly. We support English, Tamil, and Hindi to ensure everyone gets the help they need.',
      version: 'Version 1.0.0',
      settings: 'Settings',
      language: 'Language',
      history: 'History',
      clearHistory: 'Clear History',
      edit: 'Edit',
      save: 'Save',
      cancel: 'Cancel',
      listen: 'Listen',
      stop: 'Stop',
      translate: 'Translate',
      platform: 'Platform',
      model: 'Mobile Model',
      modelPlaceholder: 'e.g. Samsung S24, iPhone 15...',
      home: {
        heroTitle: 'MOBILE FIXING',
        heroSubtitle: 'REDEFINED BY AI',
        description: 'Instant solutions for any mobile software problem. Upload, speak, or type—we fix it all in your language.',
        cta: 'Start Fixing Now',
        features: [
          { title: 'AI Powered', desc: 'Advanced diagnostics for instant results.' },
          { title: 'Multilingual', desc: 'Support for English, Tamil, and Hindi.' },
          { title: 'Multi-modal', desc: 'Voice, Image, and Text input support.' }
        ]
      }
    },
    Tamil: {
      title: 'மோபிஃபிக்ஸ்',
      subtitle: 'உங்கள் AI மொபைல் தொழில்நுட்ப வல்லுநர்',
      placeholder: 'உங்கள் மொபைல் பிரச்சனையை விவரிக்கவும்...',
      send: 'அனுப்பு',
      solved: 'இது உங்கள் பிரச்சனையை தீர்த்ததா?',
      yes: 'ஆம்',
      no: 'இல்லை',
      about: 'மோபிஃபிக்ஸ் பற்றி',
      aboutDesc: 'மோபிஃபிக்ஸ் என்பது உங்கள் மொபைல் மென்பொருள் சிக்கல்களை உடனடியாகத் தீர்க்க உதவும் ஒரு AI தளம். அனைவரும் தங்களுக்குத் தேவையான உதவியைப் பெறுவதை உறுதிசெய்ய ஆங்கிலம், தமிழ் மற்றும் இந்தி மொழிகளை நாங்கள் ஆதரிக்கிறோம்.',
      version: 'பதிப்பு 1.0.0',
      settings: 'அமைப்புகள்',
      language: 'மொழி',
      history: 'வரலாறு',
      clearHistory: 'வரலாற்றை அழி',
      edit: 'திருத்து',
      save: 'சேமி',
      cancel: 'ரத்து செய்',
      listen: 'கேளுங்கள்',
      stop: 'நிறுத்து',
      translate: 'மொழிபெயர்க்க',
      platform: 'இயங்குதளம்',
      model: 'மொபைல் மாடல்',
      modelPlaceholder: 'எ.கா. சாம்சங் S24, ஐபோன் 15...',
      home: {
        heroTitle: 'மொபைல் சரிசெய்தல்',
        heroSubtitle: 'AI மூலம் மறுவரையறை',
        description: 'எந்தவொரு மொபைல் மென்பொருள் சிக்கலுக்கும் உடனடி தீர்வுகள். பதிவேற்றவும், பேசவும் அல்லது தட்டச்சு செய்யவும்—நாங்கள் அனைத்தையும் உங்கள் மொழியில் சரிசெய்கிறோம்.',
        cta: 'இப்போதே தொடங்கவும்',
        features: [
          { title: 'AI ஆற்றல்', desc: 'உடனடி முடிவுகளுக்கான மேம்பட்ட கண்டறிதல்.' },
          { title: 'பல்மொழி', desc: 'ஆங்கிலம், தமிழ் மற்றும் இந்தி ஆதரவு.' },
          { title: 'பல முறை', desc: 'குரல், படம் மற்றும் உரை உள்ளீடு ஆதரவு.' }
        ]
      }
    },
    Hindi: {
      title: 'मोबीफिक्स',
      subtitle: 'आपका AI मोबाइल तकनीशियन',
      placeholder: 'अपनी मोबाइल समस्या का वर्णन करें...',
      send: 'भेजें',
      solved: 'क्या इससे आपकी समस्या हल हो गई?',
      yes: 'हाँ',
      no: 'नहीं',
      about: 'मोबीफिक्स के बारे में',
      aboutDesc: 'मोबीफिक्स एक AI-संचालित प्लेटफ़ॉर्म है जिसे मोबाइल सॉफ़्टवेयर समस्याओं को तुरंत हल करने में आपकी मदद करने के लिए डिज़ाइन किया गया है। हम अंग्रेजी, तमिल और हिंदी का समर्थन करते हैं ताकि यह सुनिश्चित हो सके कि सभी को उनकी ज़रूरत की मदद मिले।',
      version: 'संस्करण 1.0.0',
      settings: 'सेटिंग्स',
      language: 'भाषा',
      history: 'इतिहास',
      clearHistory: 'इतिहास मिटाएं',
      edit: 'संपादित करें',
      save: 'सहेजें',
      cancel: 'रद्द करें',
      listen: 'सुनें',
      stop: 'रोकें',
      translate: 'अनुवाद करें',
      platform: 'प्लेटफार्म',
      model: 'मोबाइल मॉडल',
      modelPlaceholder: 'जैसे सैमसंग S24, आईफोन 15...',
      home: {
        heroTitle: 'मोबाइल फिक्सिंग',
        heroSubtitle: 'AI द्वारा पुनर्परिभाषित',
        description: 'किसी भी मोबाइल सॉफ़्टवेयर समस्या का त्वरित समाधान। अपलोड करें, बोलें या टाइप करें—हम आपकी भाषा में सब कुछ ठीक करते हैं।',
        cta: 'अभी शुरू करें',
        features: [
          { title: 'AI संचालित', desc: 'त्वरित परिणामों के लिए उन्नत निदान।' },
          { title: 'बहुभाषी', desc: 'अंग्रेजी, तमिल और हिंदी के लिए समर्थन।' },
          { title: 'बहु-मोडल', desc: 'आवाज, छवि और टेक्स्ट इनपुट समर्थन।' }
        ]
      }
    }
  };

  const t = translations[language];

  if (view === 'home') {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans overflow-x-hidden">
        {/* Home Header */}
        <header className="flex items-center justify-between px-6 py-6 border-b border-zinc-900/50 bg-zinc-950/50 backdrop-blur-xl fixed top-0 w-full z-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500 rounded-xl">
              <Smartphone className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">{t.title}</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex bg-zinc-900 p-1 rounded-lg">
              {(['English', 'Tamil', 'Hindi'] as Language[]).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setLanguage(lang)}
                  className={cn(
                    "px-3 py-1 text-xs font-semibold rounded-md transition-all",
                    language === lang 
                      ? "bg-zinc-800 text-white" 
                      : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  {lang === 'English' ? 'EN' : lang === 'Tamil' ? 'தமிழ்' : 'हिन्दी'}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <main className="pt-32 pb-20 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col items-center text-center space-y-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="space-y-2"
              >
                <span className="text-emerald-500 font-mono text-sm tracking-[0.3em] uppercase font-bold">
                  {t.home.heroSubtitle}
                </span>
                <h2 className="text-[12vw] md:text-[8vw] font-black leading-[0.85] tracking-tighter uppercase">
                  {t.home.heroTitle}
                </h2>
              </motion.div>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.6 }}
                className="max-w-2xl text-zinc-400 text-lg md:text-xl leading-relaxed"
              >
                {t.home.description}
              </motion.p>

              {/* Device Info Section on Home Screen */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.6 }}
                className="w-full max-w-2xl bg-zinc-900/30 border border-zinc-800 rounded-3xl p-6 space-y-6 shadow-2xl backdrop-blur-sm"
              >
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="flex-1 space-y-3">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-[0.2em] block text-left ml-1">
                      {t.platform}
                    </label>
                    <div className="flex bg-zinc-950 p-1.5 rounded-2xl border border-zinc-800">
                      {(['Android', 'iOS'] as const).map((p) => (
                        <button
                          key={p}
                          onClick={() => setPlatform(p)}
                          className={cn(
                            "flex-1 py-3 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2",
                            platform === p 
                              ? "bg-zinc-800 text-white shadow-lg" 
                              : "text-zinc-500 hover:text-zinc-300"
                          )}
                        >
                          <Smartphone className={cn("w-4 h-4", p === 'Android' ? "text-emerald-500" : "text-blue-500")} />
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex-[1.5] space-y-3">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-[0.2em] block text-left ml-1">
                      {t.model}
                    </label>
                    <input
                      type="text"
                      value={mobileModel}
                      onChange={(e) => setMobileModel(e.target.value)}
                      placeholder={t.modelPlaceholder}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-sm text-zinc-200 focus:border-emerald-500/50 focus:ring-0 transition-all placeholder:text-zinc-700"
                    />
                  </div>
                </div>
              </motion.div>

              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5, duration: 0.4 }}
                onClick={() => setView('chat')}
                className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold text-lg shadow-2xl shadow-emerald-500/20 transition-all hover:scale-105 flex items-center gap-3 group"
              >
                {t.home.cta}
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </motion.button>
            </div>

            {/* Features Grid */}
            <div className="mt-32 grid grid-cols-1 md:grid-cols-3 gap-6">
              {t.home.features.map((feature, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 + i * 0.1 }}
                  className="p-8 bg-zinc-900/50 border border-zinc-900 rounded-3xl hover:border-zinc-800 transition-colors"
                >
                  <div className="w-12 h-12 bg-zinc-950 rounded-2xl flex items-center justify-center mb-6 border border-zinc-800">
                    {i === 0 ? <Loader2 className="w-6 h-6 text-emerald-500" /> : i === 1 ? <Languages className="w-6 h-6 text-emerald-500" /> : <Mic className="w-6 h-6 text-emerald-500" />}
                  </div>
                  <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
                  <p className="text-zinc-500 leading-relaxed">{feature.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="py-12 border-t border-zinc-900 text-center">
          <p className="text-zinc-600 text-sm font-mono tracking-widest uppercase">
            © 2026 MobiFix AI • Professional Grade Diagnostics
          </p>
        </footer>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100 font-sans overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setView('home')}
            className="p-2 -ml-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-white"
            title="Back to Home"
          >
            <ChevronRight className="w-5 h-5 rotate-180" />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500 rounded-xl shadow-lg shadow-emerald-500/20">
              <Smartphone className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">{t.title}</h1>
              <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">{t.subtitle}</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex bg-zinc-800 p-1 rounded-lg">
            {(['English', 'Tamil', 'Hindi'] as Language[]).map((lang) => (
              <button
                key={lang}
                onClick={() => setLanguage(lang)}
                className={cn(
                  "px-3 py-1 text-xs font-semibold rounded-md transition-all",
                  language === lang 
                    ? "bg-zinc-700 text-white shadow-sm" 
                    : "text-zinc-400 hover:text-zinc-200"
                )}
              >
                {lang === 'English' ? 'EN' : lang === 'Tamil' ? 'தமிழ்' : 'हिन्दी'}
              </button>
            ))}
          </div>
          <button 
            onClick={() => setShowSettings(true)}
            className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-white"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scrollbar-thin scrollbar-thumb-zinc-800">
        {messages.length === 0 && !isLoading && (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-6">
            <div className="w-20 h-20 bg-zinc-900 rounded-3xl flex items-center justify-center border border-zinc-800">
              <Languages className="w-10 h-10 text-emerald-500" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">{language === 'English' ? 'How can I help you today?' : language === 'Tamil' ? 'இன்று நான் உங்களுக்கு எப்படி உதவ முடியும்?' : 'आज मैं आपकी कैसे मदद कर सकता हूँ?'}</h2>
              <p className="text-zinc-500">
                {language === 'English' 
                  ? 'Describe your mobile software issue, upload a screenshot, or use voice command.' 
                  : language === 'Tamil' 
                  ? 'உங்கள் மொபைல் மென்பொருள் சிக்கலை விவரிக்கவும், ஸ்கிரீன்ஷாட்டைப் பதிவேற்றவும் அல்லது குரல் கட்டளையைப் பயன்படுத்தவும்.' 
                  : 'अपनी मोबाइल सॉफ़्टवेयर समस्या का वर्णन करें, स्क्रीनशॉट अपलोड करें, या वॉयस कमांड का उपयोग करें।'}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full">
              {[
                { en: 'Phone is hanging', ta: 'போன் ஹேங் ஆகிறது', hi: 'फोन हैंग हो रहा है' },
                { en: 'App keeps crashing', ta: 'ஆப் அடிக்கடி செயலிழக்கிறது', hi: 'ऐप बार-बार क्रैश हो रहा है' },
                { en: 'Battery draining fast', ta: 'பேட்டரி வேகமாக குறைகிறது', hi: 'बैटरी जल्दी खत्म हो रही है' },
                { en: 'Software update error', ta: 'மென்பொருள் புதுப்பிப்பு பிழை', hi: 'सॉफ्टवेयर अपडेट एरर' }
              ].map((item, i) => (
                <button
                  key={i}
                  onClick={() => setProblem(item[language === 'English' ? 'en' : language === 'Tamil' ? 'ta' : 'hi'])}
                  className="p-3 text-sm text-left bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl transition-colors group flex items-center justify-between"
                >
                  <span>{item[language === 'English' ? 'en' : language === 'Tamil' ? 'ta' : 'hi']}</span>
                  <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-emerald-500 transition-colors" />
                </button>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "flex flex-col max-w-[85%] md:max-w-[70%] group",
                msg.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
              )}
            >
              <div className={cn(
                "relative p-4 rounded-2xl shadow-sm",
                msg.role === 'user' 
                  ? "bg-emerald-600 text-white rounded-tr-none" 
                  : "bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-tl-none"
              )}>
                {msg.role === 'user' && editingMessageId !== msg.id && (
                  <button
                    onClick={() => handleEdit(msg)}
                    className="absolute -left-10 top-2 p-2 text-zinc-600 hover:text-emerald-500 opacity-0 group-hover:opacity-100 transition-all"
                    title={t.edit}
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                )}

                {msg.image && (
                  <img 
                    src={msg.image} 
                    alt="Problem" 
                    className="rounded-lg mb-3 max-h-64 object-contain bg-black/20" 
                    referrerPolicy="no-referrer"
                  />
                )}
                
                {editingMessageId === msg.id ? (
                  <div className="space-y-3 min-w-[200px]">
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-3 text-sm text-white focus:border-white focus:ring-0 resize-none"
                      rows={3}
                      autoFocus
                    />
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setEditingMessageId(null)}
                        className="px-3 py-1.5 text-xs font-bold text-zinc-300 hover:text-white transition-colors"
                      >
                        {t.cancel}
                      </button>
                      <button
                        onClick={() => handleSaveEdit(msg.id)}
                        className="px-4 py-1.5 text-xs font-bold bg-white text-black rounded-lg hover:bg-zinc-200 transition-colors"
                      >
                        {t.save}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {msg.content && (
                      <div className={cn("markdown-body prose prose-invert max-w-none", msg.role === 'user' && "text-white")}>
                        <Markdown>{msg.content}</Markdown>
                      </div>
                    )}
                    
                    {msg.role === 'assistant' && (
                      <div className="mt-4 pt-4 border-t border-zinc-800 flex flex-wrap gap-2">
                        <button
                          onClick={() => toggleSpeech(msg.id, msg.content)}
                          className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs font-bold transition-colors text-zinc-300"
                        >
                          {isSpeaking === msg.id ? (
                            <><VolumeX className="w-3.5 h-3.5" /> {t.stop}</>
                          ) : (
                            <><Volume2 className="w-3.5 h-3.5" /> {t.listen}</>
                          )}
                        </button>
                        
                        <div className="relative group/translate">
                          <button className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs font-bold transition-colors text-zinc-300">
                            <Globe className="w-3.5 h-3.5" /> {t.translate}
                          </button>
                          <div className="absolute bottom-full left-0 mb-2 hidden group-hover/translate:flex flex-col bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden z-20 min-w-[120px]">
                            {(['English', 'Tamil', 'Hindi'] as Language[]).map((lang) => (
                              <button
                                key={lang}
                                onClick={() => handleTranslate(msg.id, lang)}
                                className="px-4 py-2 text-xs text-left hover:bg-zinc-800 transition-colors border-b border-zinc-800 last:border-0"
                              >
                                {lang}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
              
              <span className="text-[10px] text-zinc-600 mt-1 px-1 font-mono">
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>

              {msg.role === 'assistant' && (
                <div className="mt-4 p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl w-full">
                  <p className="text-xs font-semibold text-zinc-400 mb-3 flex items-center gap-2">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    {t.solved}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleFeedback(msg.id, 'yes')}
                      className={cn(
                        "flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 border",
                        feedbackGiven[msg.id] === 'yes'
                          ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                          : "bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700"
                      )}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {t.yes}
                    </button>
                    <button
                      onClick={() => handleFeedback(msg.id, 'no')}
                      className={cn(
                        "flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 border",
                        feedbackGiven[msg.id] === 'no'
                          ? "bg-red-500/20 border-red-500 text-red-400"
                          : "bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700"
                      )}
                    >
                      <XCircle className="w-4 h-4" />
                      {t.no}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {isLoading && (
          <div className="flex items-center gap-3 text-zinc-500 animate-pulse">
            <div className="p-2 bg-zinc-900 rounded-full border border-zinc-800">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
            <span className="text-sm font-medium">
              {language === 'English' ? 'MobiFix is thinking...' : language === 'Tamil' ? 'மோபிஃபிக்ஸ் சிந்திக்கிறது...' : 'मोबीफिक्स सोच रहा है...'}
            </span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* Input Area */}
      <footer className="p-4 md:p-6 border-t border-zinc-800 bg-zinc-950">
        <div className="max-w-4xl mx-auto space-y-4">
          {image && (
            <div className="relative inline-block">
              <img 
                src={image} 
                alt="Upload preview" 
                className="w-20 h-20 object-cover rounded-xl border-2 border-emerald-500 shadow-lg" 
                referrerPolicy="no-referrer"
              />
              <button 
                onClick={() => setImage(null)}
                className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full shadow-md hover:bg-red-600 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="relative flex items-end gap-2">
            <div className="flex-1 relative bg-zinc-900 border border-zinc-800 rounded-2xl focus-within:border-emerald-500/50 transition-all shadow-xl">
              <textarea
                value={problem}
                onChange={(e) => setProblem(e.target.value)}
                placeholder={t.placeholder}
                rows={1}
                className="w-full bg-transparent border-none focus:ring-0 p-4 pr-24 resize-none text-zinc-200 placeholder-zinc-600 min-h-[56px] max-h-32"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
              />
              
              <div className="absolute right-2 bottom-2 flex items-center gap-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  ref={fileInputRef}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 text-zinc-500 hover:text-emerald-500 hover:bg-zinc-800 rounded-xl transition-all"
                >
                  <ImageIcon className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onMouseDown={startRecording}
                  onMouseUp={stopRecording}
                  onMouseLeave={stopRecording}
                  onTouchStart={startRecording}
                  onTouchEnd={stopRecording}
                  title="Hold to record"
                  className={cn(
                    "p-2 rounded-xl transition-all touch-none relative group/mic",
                    isRecording 
                      ? "bg-red-500 text-white animate-pulse" 
                      : "text-zinc-500 hover:text-emerald-500 hover:bg-zinc-800"
                  )}
                >
                  {isRecording ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                  {!isRecording && (
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-zinc-800 text-[10px] text-white rounded opacity-0 group-hover/mic:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-zinc-700">
                      Hold to record
                    </span>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || (!problem && !image)}
              className="p-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:hover:bg-emerald-600 text-white rounded-2xl transition-all shadow-lg shadow-emerald-900/20"
            >
              <Send className="w-6 h-6" />
            </button>
          </form>
          <p className="text-[10px] text-center text-zinc-600 font-medium uppercase tracking-widest">
            {language === 'English' ? 'AI can make mistakes. Verify important steps.' : language === 'Tamil' ? 'AI தவறுகளைச் செய்யலாம். முக்கியமான படிகளைச் சரிபார்க்கவும்.' : 'एआई गलतियां कर सकता है। महत्वपूर्ण चरणों को सत्यापित करें।'}
          </p>
        </div>
      </footer>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowSettings(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
                <div className="flex items-center gap-3">
                  <Settings className="w-5 h-5 text-emerald-500" />
                  <h2 className="text-lg font-bold">{t.settings}</h2>
                </div>
                <button 
                  onClick={() => setShowSettings(false)}
                  className="p-2 hover:bg-zinc-800 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-8">
                <section className="space-y-4">
                  <div className="flex items-center gap-2 text-zinc-400">
                    <Info className="w-4 h-4" />
                    <h3 className="text-sm font-bold uppercase tracking-wider">{t.about}</h3>
                  </div>
                  <div className="p-4 bg-zinc-950 rounded-2xl border border-zinc-800 space-y-3">
                    <p className="text-sm text-zinc-400 leading-relaxed">
                      {t.aboutDesc}
                    </p>
                    <div className="pt-3 border-t border-zinc-800 flex justify-between items-center">
                      <span className="text-xs font-mono text-zinc-600">{t.version}</span>
                      <span className="text-xs font-bold text-emerald-500 uppercase tracking-widest">Stable</span>
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  <div className="flex items-center gap-2 text-zinc-400">
                    <History className="w-4 h-4" />
                    <h3 className="text-sm font-bold uppercase tracking-wider">{t.history}</h3>
                  </div>
                  <button
                    onClick={() => {
                      setMessages([]);
                      setShowSettings(false);
                    }}
                    className="w-full p-4 bg-zinc-950 hover:bg-red-500/10 border border-zinc-800 hover:border-red-500/50 rounded-2xl text-sm font-medium text-zinc-400 hover:text-red-400 transition-all flex items-center justify-center gap-2"
                  >
                    <XCircle className="w-4 h-4" />
                    {t.clearHistory}
                  </button>
                </section>
              </div>

              <div className="p-6 bg-zinc-950 border-t border-zinc-800 text-center">
                <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-[0.2em]">
                  Crafted for Mobile Solutions
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
