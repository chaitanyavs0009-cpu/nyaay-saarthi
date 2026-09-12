import { ChatSession, ChatMessage } from '../types.ts';

// In-memory data store with structured operations
const conversationsDb = new Map<string, ChatSession>();

// Seed initial default welcome chat session
const DEFAULT_WELCOME_SESSION: ChatSession = {
  id: 'conv_welcome_default',
  userId: 'default',
  title: 'Welcome to Nyaay Sarthi Legal Assistant',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  messages: [
    {
      id: 'msg_welcome',
      sender: 'assistant',
      text: 'Namaste! I am **Nyaay Sarthi Assistant**, your dedicated legal-information guide for Indian citizens. \n\nI can explain Indian laws, legal procedures, rights under BNS/BNSS/BSA, consumer disputes, cyber frauds, tenancy issues, and how to access free legal aid through NALSA.\n\n*Please note: I provide general legal information, not formal legal advice. For case-specific legal counsel, consider consulting a verified advocate.*',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isAiGenerated: true,
      suggestions: [
        'Landlord is withholding my security deposit',
        'Cyber fraud: unauthorized UPI deduction from bank',
        'Defective laptop delivered & e-commerce refusing return',
        'Police refused to file my complaint (Zero FIR)'
      ]
    }
  ]
};

conversationsDb.set(DEFAULT_WELCOME_SESSION.id, DEFAULT_WELCOME_SESSION);

export class ConversationStore {
  static getConversationsForUser(userId: string): ChatSession[] {
    const list: ChatSession[] = [];
    for (const session of conversationsDb.values()) {
      if (session.userId === userId || session.userId === 'default') {
        list.push(session);
      }
    }
    // Sort by updatedAt descending
    return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  static getConversationById(id: string, userId?: string): ChatSession | null {
    const session = conversationsDb.get(id);
    if (!session) return null;
    if (userId && session.userId !== 'default' && session.userId !== userId) {
      return null;
    }
    return session;
  }

  static createOrUpdateConversation(session: ChatSession): ChatSession {
    const existing = conversationsDb.get(session.id);
    const updated: ChatSession = {
      ...session,
      updatedAt: new Date().toISOString(),
      createdAt: existing?.createdAt || session.createdAt || new Date().toISOString()
    };
    conversationsDb.set(session.id, updated);
    return updated;
  }

  static appendMessageToConversation(
    conversationId: string, 
    userId: string, 
    message: ChatMessage,
    sessionTitle?: string
  ): ChatSession {
    let session = conversationsDb.get(conversationId);
    
    if (!session) {
      // Auto-create new session
      const title = sessionTitle || (message.text.length > 40 ? `${message.text.slice(0, 40)}...` : message.text);
      session = {
        id: conversationId,
        userId,
        title: title || 'New Legal Consultation',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: [message],
        isFlaggedEmergency: message.flaggedEmergency || false,
        emergencyCategory: message.emergencyCategory
      };
    } else {
      // Append message
      session.messages.push(message);
      session.updatedAt = new Date().toISOString();
      if (message.flaggedEmergency) {
        session.isFlaggedEmergency = true;
        session.emergencyCategory = message.emergencyCategory;
      }
      if (!session.title || session.title === 'New Legal Consultation') {
        if (message.sender === 'user') {
          session.title = message.text.length > 40 ? `${message.text.slice(0, 40)}...` : message.text;
        }
      }
    }

    conversationsDb.set(conversationId, session);
    return session;
  }

  static deleteConversation(id: string, userId?: string): boolean {
    const session = conversationsDb.get(id);
    if (!session) return false;
    if (userId && session.userId !== 'default' && session.userId !== userId) {
      return false;
    }
    return conversationsDb.delete(id);
  }
}
