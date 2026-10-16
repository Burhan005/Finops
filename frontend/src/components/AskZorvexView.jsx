import React, { useState, useEffect } from 'react';
import { 
  Bot, Send, Sparkles, ShieldCheck, CheckCircle2, MessageSquare, 
  ArrowRight, Database, Terminal, Clock, CornerDownLeft
} from 'lucide-react';
import { api } from '../services/api';

const QUICK_PROMPTS = [
  "Why did AWS spending increase this month?",
  "Which services contributed most to the variance?",
  "Which 3 recommendations offer the strongest evidence?",
  "What is the projected month-end spend?",
  "Which commitments appear underutilized?",
  "Which recommendations remain unimplemented?"
];

export default function AskZorvexView() {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      sender: 'zorvex',
      text: "Greetings. I am **ZORVEX**, your Autonomous Cloud Financial Intelligence Analyst.\n\nAll my responses are **100% grounded** in your authoritative AWS Cost & Usage Reports (CUR). Ask me anything regarding cost anomalies, workload drivers, commitment yield, or run-rate projections.",
      data_references: [],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    api.getAiHistory()
      .then(h => setHistory(h || []))
      .catch(() => {});
  }, []);

  const handleSend = async (textToSend = query) => {
    const q = textToSend.trim();
    if (!q || loading) return;

    const userMsg = {
      id: Date.now().toString(),
      sender: 'user',
      text: q,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setQuery('');
    setLoading(true);

    try {
      const res = await api.askAiAnalyst(q);
      const botMsg = {
        id: (Date.now() + 1).toString(),
        sender: 'zorvex',
        text: res.answer,
        data_references: res.data_references || [],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      const errMsg = {
        id: (Date.now() + 1).toString(),
        sender: 'zorvex',
        text: "Could not execute analysis. Please ensure the backend CUR engine is active.",
        data_references: [],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      
      {/* Top Banner */}
      <div className="clay-card p-5 border border-zorvex-forest/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-zorvex-forest-soft dark:bg-zorvex-forest-dark-soft border border-zorvex-forest/30 text-zorvex-forest dark:text-zorvex-forest-highlight flex items-center justify-center flex-shrink-0">
            <Bot className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-zorvex-text dark:text-zorvex-dark-text tracking-tight">
                Ask ZORVEX — FinOps AI Analyst
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-zorvex-forest-soft dark:bg-zorvex-forest-dark-soft text-zorvex-forest dark:text-zorvex-forest-highlight border border-zorvex-forest/30">
                100% Deterministic CUR Math
              </span>
            </div>
            <p className="text-xs text-zorvex-text-muted dark:text-zorvex-dark-text-muted mt-0.5">
              Natural language investigation grounded in your actual cloud billing telemetry. Zero hallucinations.
            </p>
          </div>
        </div>
      </div>

      {/* Quick Prompts Carousel */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <span className="text-[11px] font-bold text-zorvex-text-muted dark:text-zorvex-dark-text-muted whitespace-nowrap flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-zorvex-forest dark:text-zorvex-forest-highlight" />
          <span>Suggested:</span>
        </span>
        {QUICK_PROMPTS.map((p, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(p)}
            className="px-3 py-1.5 rounded-clay-pill text-xs font-semibold whitespace-nowrap clay-button hover:border-zorvex-forest text-zorvex-text dark:text-zorvex-dark-text transition-all cursor-pointer"
          >
            {p}
          </button>
        ))}
      </div>

      {/* Chat Terminal Feed */}
      <div className="clay-card p-6 min-h-[420px] max-h-[560px] overflow-y-auto space-y-6 flex flex-col">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex gap-3 max-w-3xl ${
              m.sender === 'user' ? 'ml-auto flex-row-reverse' : ''
            }`}
          >
            {/* Avatar */}
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
              m.sender === 'user'
                ? 'bg-zorvex-secondary dark:bg-zorvex-dark-secondary text-zorvex-text dark:text-zorvex-dark-text font-bold text-xs'
                : 'bg-zorvex-forest text-white font-bold shadow-clay-sm'
            }`}>
              {m.sender === 'user' ? 'YOU' : <Bot className="w-4 h-4" />}
            </div>

            {/* Bubble */}
            <div className={`p-4 rounded-2xl text-xs space-y-2 leading-relaxed ${
              m.sender === 'user'
                ? 'bg-gradient-to-r from-zorvex-forest to-zorvex-forest-hover text-white font-semibold shadow-clay-sm rounded-tr-none'
                : 'bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border dark:border-zorvex-dark-border text-zorvex-text dark:text-zorvex-dark-text shadow-clay-sm rounded-tl-none'
            }`}>
              <div className="whitespace-pre-wrap">{m.text}</div>

              {/* Data References Badges */}
              {m.data_references && m.data_references.length > 0 && (
                <div className="pt-2 border-t border-zorvex-border dark:border-zorvex-dark-border flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-bold text-zorvex-text-muted dark:text-zorvex-dark-text-muted uppercase tracking-wider">
                    Authoritative Citations:
                  </span>
                  {m.data_references.map((ref, i) => (
                    <span 
                      key={i} 
                      className="px-2 py-0.5 rounded-md bg-zorvex-forest-soft dark:bg-zorvex-forest-dark-soft text-[10px] font-mono font-bold text-zorvex-forest dark:text-zorvex-forest-highlight border border-zorvex-forest/25"
                    >
                      {ref.title || ref.service || ref.type || ref.id}
                    </span>
                  ))}
                </div>
              )}

              <div className={`text-[9px] font-mono ${
                m.sender === 'user' ? 'text-white/80 text-right' : 'text-zorvex-text-muted dark:text-zorvex-dark-text-muted'
              }`}>
                {m.timestamp}
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 max-w-md">
            <div className="w-8 h-8 rounded-xl bg-zorvex-forest text-white flex items-center justify-center flex-shrink-0 animate-pulse">
              <Bot className="w-4 h-4" />
            </div>
            <div className="p-4 rounded-2xl bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border dark:border-zorvex-dark-border text-xs font-semibold text-zorvex-text-muted dark:text-zorvex-dark-text-muted flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-zorvex-forest animate-ping" />
              <span>Analyzing authoritative CUR records & computing variances...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input Bar */}
      <div className="relative">
        <textarea
          id="ai-prompt-input"
          name="aiPrompt"
          aria-label="FinOps AI Analyst query prompt"
          rows={2}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask ZORVEX about your AWS spend, commitment coverage, or waste drivers... (Press Enter to submit)"
          className="w-full px-4 py-3 pr-24 rounded-2xl bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border dark:border-zorvex-dark-border focus:border-zorvex-forest dark:focus:border-zorvex-forest-highlight outline-none text-xs text-zorvex-text dark:text-zorvex-dark-text resize-none shadow-clay transition-all"
        />

        <div className="absolute right-3 bottom-3 flex items-center gap-2">
          <button
            onClick={() => handleSend()}
            disabled={!query.trim() || loading}
            className="clay-button-primary flex items-center gap-1.5 px-4 py-2 rounded-xl disabled:opacity-50 text-white font-black text-xs cursor-pointer"
          >
            <span>Ask</span>
            <CornerDownLeft className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

    </div>
  );
}
