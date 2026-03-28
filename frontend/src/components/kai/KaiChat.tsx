'use client';

import { useRef, useEffect } from 'react';
import { Send, Square, Loader2, Sparkles } from 'lucide-react';
import { useKaiChat } from '@/lib/kai-context';
import ChatMessage from './ChatMessage';

interface KaiChatProps {
  fullPage?: boolean;
}

function LoadingDots() {
  return (
    <div className="flex items-center gap-1 px-4 py-2">
      <span
        className="w-2 h-2 rounded-full animate-bounce"
        style={{ background: '#3EA8FF', animationDelay: '0ms' }}
      />
      <span
        className="w-2 h-2 rounded-full animate-bounce"
        style={{ background: '#3EA8FF', animationDelay: '150ms' }}
      />
      <span
        className="w-2 h-2 rounded-full animate-bounce"
        style={{ background: '#3EA8FF', animationDelay: '300ms' }}
      />
    </div>
  );
}

export default function KaiChat({ fullPage = false }: KaiChatProps) {
  const {
    messages,
    isStreaming,
    input,
    suggestions,
    sendMessage,
    stopStreaming,
    setInput,
  } = useKaiChat();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      sendMessage(input.trim());
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    sendMessage(suggestion);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim()) {
        sendMessage(input.trim());
      }
    }
  };

  const isEmpty = messages.length === 0;

  return (
    <div
      className="flex flex-col"
      style={{
        height: fullPage ? '100%' : '100%',
        background: '#FFFFFF',
        borderRadius: fullPage ? '12px' : '0',
        overflow: 'hidden',
      }}
    >
      {/* Messages area */}
      <div
        className="flex-1 overflow-y-auto px-4 py-3"
        style={{ minHeight: 0 }}
      >
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
              style={{ background: 'rgba(62, 168, 255, 0.1)' }}
            >
              <Sparkles size={24} style={{ color: '#3EA8FF' }} />
            </div>
            <h3 className="text-base font-semibold mb-1" style={{ color: '#1A1A2E' }}>
              Ask me anything about Czech retail market
            </h3>
            <p className="text-sm mb-4" style={{ color: '#94A3B8' }}>
              I can query data about malls, stores, brands, and trends.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="text-xs px-3 py-1.5 rounded-full border transition-colors hover:border-blue-300"
                  style={{
                    background: '#F8FAFE',
                    borderColor: '#E5EAF0',
                    color: '#475569',
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
            {isStreaming &&
              messages.length > 0 &&
              messages[messages.length - 1].role === 'assistant' &&
              !messages[messages.length - 1].content && <LoadingDots />}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input area */}
      <div
        className="border-t px-3 py-2"
        style={{ borderColor: '#E5EAF0' }}
      >
        {/* Suggestion pills when there are messages */}
        {!isEmpty && suggestions.length > 0 && !isStreaming && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {suggestions.slice(0, 3).map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => handleSuggestionClick(suggestion)}
                className="text-xs px-2.5 py-1 rounded-full border transition-colors hover:border-blue-300"
                style={{
                  background: '#F8FAFE',
                  borderColor: '#E5EAF0',
                  color: '#475569',
                }}
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about malls, brands, trends..."
            disabled={isStreaming}
            className="flex-1 text-sm px-3 py-2 rounded-lg border outline-none transition-colors focus:border-blue-400"
            style={{
              borderColor: '#E5EAF0',
              background: '#FAFBFD',
              color: '#1A1A2E',
            }}
          />
          {isStreaming ? (
            <button
              type="button"
              onClick={stopStreaming}
              className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
              style={{ background: '#EF4444' }}
              title="Stop generating"
            >
              <Square size={14} color="#FFFFFF" fill="#FFFFFF" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors disabled:opacity-40"
              style={{ background: '#3EA8FF' }}
              title="Send message"
            >
              {input.trim() ? (
                <Send size={14} color="#FFFFFF" />
              ) : (
                <Loader2 size={14} color="#FFFFFF" className="opacity-40" />
              )}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
