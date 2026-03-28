'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import {
  type ChatMessage,
  type ToolStep,
  type ChatConversation,
  generateId,
  saveConversation,
  createConversation,
} from './chat-storage';

const SYSTEM_CONTEXT = `[Context: Shopingy Retail Intelligence Dashboard.
325 malls, 15,509 stores, 1,340 brands, 129 cities, 17 operators in Czech Republic.
Top categories: Apparel (2600), Restaurants & Cafes (2204), Health & Beauty (1644), Services (1606), Food (1510).

DATA SCHEMA -- query these tables directly using BigQuery SQL:
- \`in_c_shopingy\`.\`malls\` -- 325 malls. Cols: id, name, brands_count, stores_count, gla, type, city, zip, country, operator, last_update, latitude, longitude
- \`in_c_shopingy\`.\`stores\` -- 15,509 stores. Cols: id, store_name, store_type, store_brands, major_category, additional_categories, store_tags, shopping_mall, mall_type, city, zip, country, store_sqm, store_size, opened_date, closed_date, latitude, longitude
- \`in_c_shopingy\`.\`brands\` -- 1,340 brands. Cols: brand_name, category, primary_category, website, brand_tags, monobrand_Austria...monobrand_USA, multibrand_Austria...multibrand_USA
- \`in_c_shopingy\`.\`brand_country_matrix\` -- 48,240 rows. Cols: brand_name, country, monobrand_stores, multibrand_stores
- \`in_c_shopingy\`.\`store_index\` -- 4,419 unique stores. Cols: id, store_name, total_locations, store_type, major_category, city, country

IMPORTANT: Skip table search/discovery -- query directly using the schema above.
Always use backticks for BigQuery identifiers.
End every response with 2-3 follow-up suggestions.]`;

const DEFAULT_SUGGESTIONS = [
  'Which malls have the most stores?',
  'Show me top 10 brands by store count',
  "What's the trend of store openings?",
  'Compare Prague vs Brno malls',
];

interface KaiChatState {
  messages: ChatMessage[];
  isStreaming: boolean;
  toolSteps: ToolStep[];
  input: string;
  conversationId: string;
  suggestions: string[];
  sendMessage: (content: string) => void;
  stopStreaming: () => void;
  setInput: (value: string) => void;
  clearChat: () => void;
}

const KaiChatContext = createContext<KaiChatState | null>(null);

function getWebSocketUrl(): string {
  if (typeof window === 'undefined') {
    return 'ws://localhost:8000/api/chat/ws';
  }
  const isDev =
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (isDev) {
    return 'ws://localhost:8000/api/chat/ws';
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/api/chat/ws`;
}

export function KaiChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [toolSteps, setToolSteps] = useState<ToolStep[]>([]);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState(() => generateId());
  const [suggestions, setSuggestions] = useState<string[]>(DEFAULT_SUGGESTIONS);

  const wsRef = useRef<WebSocket | null>(null);
  const conversationRef = useRef<ChatConversation | null>(null);
  const accumulatedTextRef = useRef('');

  const persistConversation = useCallback(
    (msgs: ChatMessage[]) => {
      if (!conversationRef.current) {
        return;
      }
      conversationRef.current.messages = msgs;
      conversationRef.current.updatedAt = new Date().toISOString();
      saveConversation(conversationRef.current);
    },
    [],
  );

  const stopStreaming = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const sendMessage = useCallback(
    (content: string) => {
      if (!content.trim() || isStreaming) {
        return;
      }

      // Initialize conversation if first message
      if (!conversationRef.current) {
        conversationRef.current = createConversation(content);
        conversationRef.current.id = conversationId;
      }

      const userMessage: ChatMessage = {
        id: generateId(),
        role: 'user',
        content: content.trim(),
        timestamp: new Date().toISOString(),
      };

      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      setInput('');
      setIsStreaming(true);
      setToolSteps([]);
      accumulatedTextRef.current = '';

      // Build the message payload
      const isFirstMessage = messages.length === 0;
      const messageContent = isFirstMessage
        ? `${SYSTEM_CONTEXT}\n\nUser question: ${content.trim()}`
        : content.trim();

      // Create assistant placeholder
      const assistantMessageId = generateId();
      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
        toolSteps: [],
      };

      const messagesWithAssistant = [...updatedMessages, assistantMessage];
      setMessages(messagesWithAssistant);

      try {
        const ws = new WebSocket(getWebSocketUrl());
        wsRef.current = ws;

        ws.onopen = () => {
          // Kai expects this format (matching profitline pattern)
          ws.send(
            JSON.stringify({
              id: conversationId,
              message: {
                id: generateId(),
                role: 'user',
                parts: [{ type: 'text', text: messageContent }],
              },
              selectedChatModel: 'chat-model',
              selectedVisibilityType: 'private',
            }),
          );
        };

        ws.onmessage = (event) => {
          // Check for error/done JSON from our backend proxy
          try {
            const directJson = JSON.parse(event.data);
            if (directJson.error) {
              accumulatedTextRef.current += `\n\n**Error:** ${directJson.error}`;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMessageId
                    ? { ...m, content: accumulatedTextRef.current }
                    : m,
                ),
              );
              setIsStreaming(false);
              wsRef.current = null;
              return;
            }
            if (directJson.done) {
              setIsStreaming(false);
              wsRef.current = null;
              setMessages((prev) => {
                persistConversation(prev);
                return prev;
              });
              return;
            }
          } catch {
            // Not a direct JSON message, parse as SSE
          }

          const lines = event.data.split('\n');
          let currentEvent = '';

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              currentEvent = line.slice(7).trim();
              continue;
            }
            if (line.startsWith('data: ')) {
              const dataStr = line.slice(6);
              try {
                const data = JSON.parse(dataStr);

                switch (currentEvent) {
                  case 'text-delta': {
                    const delta = data.textDelta ?? data.text ?? '';
                    accumulatedTextRef.current += delta;
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantMessageId
                          ? { ...m, content: accumulatedTextRef.current }
                          : m,
                      ),
                    );
                    break;
                  }
                  case 'tool-call-streaming-start': {
                    const step: ToolStep = {
                      id: data.toolCallId ?? generateId(),
                      name: data.toolName ?? 'tool',
                      description: data.description ?? `Running ${data.toolName ?? 'tool'}...`,
                      state: 'running',
                    };
                    setToolSteps((prev) => [...prev, step]);
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantMessageId
                          ? { ...m, toolSteps: [...(m.toolSteps ?? []), step] }
                          : m,
                      ),
                    );
                    break;
                  }
                  case 'tool-result': {
                    const toolId = data.toolCallId;
                    setToolSteps((prev) =>
                      prev.map((s) =>
                        s.id === toolId ? { ...s, state: 'completed' } : s,
                      ),
                    );
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantMessageId
                          ? {
                              ...m,
                              toolSteps: (m.toolSteps ?? []).map((s) =>
                                s.id === toolId ? { ...s, state: 'completed' } : s,
                              ),
                            }
                          : m,
                      ),
                    );
                    break;
                  }
                  case 'finish': {
                    setIsStreaming(false);
                    wsRef.current = null;
                    // Extract suggestions from the final message if present
                    const finalText = accumulatedTextRef.current;
                    const suggestionLines = finalText
                      .split('\n')
                      .filter(
                        (l) =>
                          l.trim().startsWith('- ') &&
                          l.trim().endsWith('?'),
                      )
                      .map((l) => l.trim().replace(/^- /, ''));
                    if (suggestionLines.length >= 2) {
                      setSuggestions(suggestionLines.slice(0, 4));
                    }
                    // Persist
                    setMessages((prev) => {
                      persistConversation(prev);
                      return prev;
                    });
                    break;
                  }
                  case 'error': {
                    const errorText = data.message ?? 'An error occurred';
                    accumulatedTextRef.current += `\n\n**Error:** ${errorText}`;
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantMessageId
                          ? { ...m, content: accumulatedTextRef.current }
                          : m,
                      ),
                    );
                    setIsStreaming(false);
                    wsRef.current = null;
                    break;
                  }
                }
              } catch {
                // Non-JSON data line, skip
              }
            }
          }
        };

        ws.onerror = () => {
          accumulatedTextRef.current +=
            '\n\n**Connection error.** Please check that the backend server is running and try again.';
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessageId
                ? { ...m, content: accumulatedTextRef.current }
                : m,
            ),
          );
          setIsStreaming(false);
          wsRef.current = null;
        };

        ws.onclose = () => {
          if (isStreaming) {
            setIsStreaming(false);
          }
          wsRef.current = null;
          // Persist on close
          setMessages((prev) => {
            persistConversation(prev);
            return prev;
          });
        };
      } catch {
        accumulatedTextRef.current =
          '**Connection failed.** Please check that the backend server is running.';
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessageId
              ? { ...m, content: accumulatedTextRef.current }
              : m,
          ),
        );
        setIsStreaming(false);
      }
    },
    [messages, isStreaming, conversationId, persistConversation],
  );

  const clearChat = useCallback(() => {
    stopStreaming();
    setMessages([]);
    setToolSteps([]);
    setInput('');
    setSuggestions(DEFAULT_SUGGESTIONS);
    const newId = generateId();
    setConversationId(newId);
    conversationRef.current = null;
  }, [stopStreaming]);

  const value: KaiChatState = {
    messages,
    isStreaming,
    toolSteps,
    input,
    conversationId,
    suggestions,
    sendMessage,
    stopStreaming,
    setInput,
    clearChat,
  };

  return <KaiChatContext.Provider value={value}>{children}</KaiChatContext.Provider>;
}

export function useKaiChat(): KaiChatState {
  const ctx = useContext(KaiChatContext);
  if (!ctx) {
    throw new Error('useKaiChat must be used within a KaiChatProvider');
  }
  return ctx;
}
