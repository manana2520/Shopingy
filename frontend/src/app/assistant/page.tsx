'use client';

import KaiChat from '@/components/kai/KaiChat';

export default function AssistantPage() {
  return (
    <div style={{ height: 'calc(100vh - 64px)' }} className="flex flex-col">
      <div className="px-2 pt-2 pb-4">
        <h1 className="text-2xl font-bold" style={{ color: '#1A1A2E' }}>
          AI Assistant
        </h1>
        <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>
          Ask anything about the Czech retail market
        </p>
      </div>
      <div
        className="flex-1 border rounded-xl overflow-hidden"
        style={{
          borderColor: '#E5EAF0',
          minHeight: 0,
        }}
      >
        <KaiChat fullPage />
      </div>
    </div>
  );
}
