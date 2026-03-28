'use client';

import { useState, useEffect } from 'react';
import { MessageCircle, X } from 'lucide-react';
import KaiChat from './KaiChat';

export default function KaiWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Handle animation: mount first, then animate in
  useEffect(() => {
    if (isOpen) {
      // Small delay to trigger CSS transition after mount
      const timer = setTimeout(() => setIsVisible(true), 10);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  return (
    <>
      {/* Chat panel */}
      {isOpen && (
        <div
          className="fixed z-50 flex flex-col"
          style={{
            bottom: '80px',
            right: '24px',
            width: '480px',
            height: '640px',
            maxHeight: 'calc(100vh - 120px)',
            maxWidth: 'calc(100vw - 48px)',
            background: '#FFFFFF',
            borderRadius: '16px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08)',
            transform: isVisible ? 'scale(1)' : 'scale(0.95)',
            opacity: isVisible ? 1 : 0,
            transition: 'transform 0.2s ease, opacity 0.2s ease',
            transformOrigin: 'bottom right',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 border-b"
            style={{ borderColor: '#E5EAF0' }}
          >
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(62, 168, 255, 0.1)' }}
              >
                <MessageCircle size={14} style={{ color: '#3EA8FF' }} />
              </div>
              <div>
                <h3 className="text-sm font-semibold" style={{ color: '#1A1A2E' }}>
                  Kai - AI Assistant
                </h3>
                <p className="text-xs" style={{ color: '#94A3B8' }}>
                  Shopingy Intelligence
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-md transition-colors hover:bg-gray-100"
              title="Close chat"
            >
              <X size={16} style={{ color: '#64748B' }} />
            </button>
          </div>

          {/* Chat body */}
          <div className="flex-1" style={{ minHeight: 0 }}>
            <KaiChat />
          </div>
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed z-50 flex items-center justify-center w-14 h-14 rounded-full transition-all hover:scale-105 active:scale-95"
        style={{
          bottom: '24px',
          right: '24px',
          background: '#3EA8FF',
          boxShadow: '0 4px 16px rgba(62, 168, 255, 0.4)',
        }}
        title={isOpen ? 'Close chat' : 'Open Kai AI Assistant'}
      >
        {isOpen ? (
          <X size={22} color="#FFFFFF" />
        ) : (
          <MessageCircle size={22} color="#FFFFFF" />
        )}
      </button>
    </>
  );
}
