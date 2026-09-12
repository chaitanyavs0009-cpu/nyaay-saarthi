import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { 
  handleChatMessage,
  handleChatStream,
  handleAiChat, 
  handleAiSummarize, 
  handleAiSuggestions,
  handleEmergencyCheck,
  handleGetConversations,
  handleGetConversationById,
  handleSaveConversation,
  handleDeleteConversation
} from './src/server/apiHandler.ts';
import { rateLimiterMiddleware } from './src/server/rateLimiter.ts';
import { getModelConfig } from './src/server/geminiService.ts';
import { initDatabase, getPool } from './src/server/db.ts';
import {
  handleRegister,
  handleLogin,
  handleGetUser,
  handleUpdateUser,
  handleChangePassword,
  handleGetAdvocates,
  handleGetAdvocateById,
  handleGetAdvocateProfile,
  handleUpdateAdvocateProfile,
  handleGetAppointments,
  handleCreateAppointment,
  handleUpdateAppointmentStatus,
  handleGetApplications,
  handleCreateApplication,
  handleUpdateApplicationStatus
} from './src/server/dbHandler.ts';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize PostgreSQL database schema safely in the background
  if (process.env.DATABASE_URL) {
    initDatabase().catch(err => {
      console.error('[PostgreSQL] Background initialization error:', err.message);
    });
  }

  app.use(express.json({ limit: '10mb' }));

  // Authentication & Account Persistence Endpoints
  app.post('/api/auth/register', handleRegister);
  app.post('/api/register', handleRegister);
  app.post('/api/auth/login', handleLogin);
  app.post('/api/login', handleLogin);

  // User Profile Endpoints
  app.get('/api/users/:id', handleGetUser);
  app.put('/api/users/:id', handleUpdateUser);
  app.put('/api/users/:id/password', handleChangePassword);

  // Authenticated Advocate Profile Endpoints (PostgreSQL backed by user_id)
  app.get('/api/advocate/profile', handleGetAdvocateProfile);
  app.get('/api/advocate/profile/:userId', handleGetAdvocateProfile);
  app.get('/api/advocates/profile', handleGetAdvocateProfile);
  app.get('/api/advocates/profile/:userId', handleGetAdvocateProfile);
  app.put('/api/advocate/profile', handleUpdateAdvocateProfile);
  app.put('/api/advocate/profile/:userId', handleUpdateAdvocateProfile);
  app.put('/api/advocates/profile', handleUpdateAdvocateProfile);
  app.put('/api/advocates/profile/:userId', handleUpdateAdvocateProfile);

  // Advocates Directory & Discovery Endpoints
  app.get('/api/advocates', handleGetAdvocates);
  app.get('/api/advocates/:id', handleGetAdvocateById);

  // Appointments Endpoints
  app.get('/api/appointments', handleGetAppointments);
  app.post('/api/appointments', handleCreateAppointment);
  app.patch('/api/appointments/:id/status', handleUpdateAppointmentStatus);

  // Applications Endpoints
  app.get('/api/applications', handleGetApplications);
  app.post('/api/applications', handleCreateApplication);
  app.patch('/api/applications/:id/status', handleUpdateApplicationStatus);

  // Apply rate limiting to all AI / Chat endpoints
  app.use('/api/chat', rateLimiterMiddleware);
  app.use('/api/ai', rateLimiterMiddleware);

  // Dedicated Chat & Streaming Endpoints
  app.post('/api/chat/stream', handleChatStream);
  app.post('/api/chat/message', handleChatMessage);
  app.post('/api/chat/emergency-check', handleEmergencyCheck);

  // Conversation Sessions & History Endpoints
  app.get('/api/chat/conversations', handleGetConversations);
  app.get('/api/chat/conversations/:id', handleGetConversationById);
  app.post('/api/chat/conversations', handleSaveConversation);
  app.delete('/api/chat/conversations/:id', handleDeleteConversation);

  // Rich AI & Analysis Endpoints
  app.post('/api/ai/chat', handleAiChat);
  app.post('/api/ai/summarize', handleAiSummarize);
  app.post('/api/ai/suggestions', handleAiSuggestions);

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    const config = getModelConfig();
    res.json({ 
      status: 'ok', 
      time: new Date().toISOString(),
      model: config.model,
      temperature: config.temperature,
      hasKey: Boolean(process.env.GEMINI_API_KEY),
      hasDatabase: Boolean(process.env.DATABASE_URL)
    });
  });

  // Vite middleware for development vs static files in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

