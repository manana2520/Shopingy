'use client';

import { useState, useMemo } from 'react';
import { Check, Copy, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import type { ChatMessage as ChatMessageType, ToolStep } from '@/lib/chat-storage';

interface ChatMessageProps {
  message: ChatMessageType;
}

function ToolStepDisplay({ step }: { step: ToolStep }) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs"
      style={{ background: '#F1F5F9', color: '#475569' }}
    >
      {step.state === 'running' && (
        <Loader2 size={12} className="animate-spin" style={{ color: '#3EA8FF' }} />
      )}
      {step.state === 'completed' && (
        <CheckCircle2 size={12} style={{ color: '#22C55E' }} />
      )}
      {step.state === 'error' && (
        <AlertCircle size={12} style={{ color: '#EF4444' }} />
      )}
      <span>{step.description || step.name}</span>
    </div>
  );
}

function renderMarkdown(text: string): string {
  let html = text;

  // Escape HTML
  html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Code blocks (triple backtick)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, _lang, code) => {
    return `<pre style="background:#1E293B;color:#E2E8F0;padding:12px;border-radius:8px;overflow-x:auto;font-size:13px;margin:8px 0"><code>${code.trim()}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code style="background:#F1F5F9;padding:2px 6px;border-radius:4px;font-size:13px">$1</code>');

  // Bold
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Italic
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // Headers
  html = html.replace(/^### (.+)$/gm, '<h4 style="font-weight:600;margin:8px 0 4px">$1</h4>');
  html = html.replace(/^## (.+)$/gm, '<h3 style="font-weight:700;margin:10px 0 4px">$1</h3>');
  html = html.replace(/^# (.+)$/gm, '<h2 style="font-weight:700;margin:12px 0 4px">$1</h2>');

  // Tables
  html = html.replace(/^\|(.+)\|\s*\n\|[-| :]+\|\s*\n((?:\|.+\|\s*\n?)*)/gm, (_match, header, body) => {
    const headerCells = header.split('|').map((c: string) => c.trim()).filter(Boolean);
    const rows = body.trim().split('\n').map((row: string) =>
      row.split('|').map((c: string) => c.trim()).filter(Boolean)
    );
    let table = '<table style="border-collapse:collapse;width:100%;margin:8px 0;font-size:13px">';
    table += '<thead><tr>';
    for (const cell of headerCells) {
      table += `<th style="border:1px solid #E2E8F0;padding:6px 10px;background:#F8FAFC;text-align:left;font-weight:600">${cell}</th>`;
    }
    table += '</tr></thead><tbody>';
    for (const row of rows) {
      table += '<tr>';
      for (const cell of row) {
        table += `<td style="border:1px solid #E2E8F0;padding:6px 10px">${cell}</td>`;
      }
      table += '</tr>';
    }
    table += '</tbody></table>';
    return table;
  });

  // Unordered lists
  html = html.replace(/^- (.+)$/gm, '<li style="margin-left:16px;list-style:disc">$1</li>');

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li style="margin-left:16px;list-style:decimal">$1</li>');

  // Paragraphs (double newlines)
  html = html.replace(/\n\n/g, '<br/><br/>');

  // Single newlines
  html = html.replace(/\n/g, '<br/>');

  return html;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const renderedContent = useMemo(
    () => (isUser ? message.content : renderMarkdown(message.content)),
    [message.content, isUser],
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may not be available
    }
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3 group`}>
      <div
        className="max-w-[85%] relative"
        style={{
          background: isUser ? '#3EA8FF' : '#F8FAFE',
          color: isUser ? '#FFFFFF' : '#1A1A2E',
          padding: '10px 14px',
          borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
          fontSize: '14px',
          lineHeight: '1.6',
        }}
      >
        {/* Tool steps */}
        {!isUser && message.toolSteps && message.toolSteps.length > 0 && (
          <div className="flex flex-col gap-1 mb-2">
            {message.toolSteps.map((step) => (
              <ToolStepDisplay key={step.id} step={step} />
            ))}
          </div>
        )}

        {/* Message content */}
        {isUser ? (
          <span style={{ whiteSpace: 'pre-wrap' }}>{message.content}</span>
        ) : (
          <div
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: renderedContent }}
          />
        )}

        {/* Copy button for assistant messages */}
        {!isUser && message.content && (
          <button
            onClick={handleCopy}
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded"
            style={{ background: '#E2E8F0' }}
            title="Copy message"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
          </button>
        )}
      </div>
    </div>
  );
}
