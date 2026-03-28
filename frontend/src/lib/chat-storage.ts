// Chat conversation persistence using localStorage

const STORAGE_KEY = 'shopingy-kai-conversations';
const MAX_CONVERSATIONS = 30;

export interface ToolStep {
  id: string;
  name: string;
  description: string;
  state: 'running' | 'completed' | 'error';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  toolSteps?: ToolStep[];
}

export interface ChatConversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function loadConversations(): ChatConversation[] {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed as ChatConversation[];
  } catch {
    return [];
  }
}

export function saveConversation(conversation: ChatConversation): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    const conversations = loadConversations();
    const existingIndex = conversations.findIndex((c) => c.id === conversation.id);

    if (existingIndex >= 0) {
      conversations[existingIndex] = conversation;
    } else {
      conversations.unshift(conversation);
    }

    // Enforce max conversations limit -- remove oldest first
    const trimmed = conversations
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, MAX_CONVERSATIONS);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage may be full or unavailable -- silently ignore
  }
}

export function deleteConversation(conversationId: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    const conversations = loadConversations();
    const filtered = conversations.filter((c) => c.id !== conversationId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch {
    // silently ignore
  }
}

export function getConversation(conversationId: string): ChatConversation | null {
  const conversations = loadConversations();
  return conversations.find((c) => c.id === conversationId) ?? null;
}

export function createConversation(firstMessage: string): ChatConversation {
  const now = new Date().toISOString();
  const title = firstMessage.length > 60 ? firstMessage.slice(0, 57) + '...' : firstMessage;
  return {
    id: generateId(),
    title,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}
