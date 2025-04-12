import express from 'express';
import dotenv from 'dotenv';
import { OpenAI } from 'openai';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Setup for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Configuration constants
const CONFIG = {
  port: process.env.PORT || 3000,
  aiModel: "gpt-4o-mini-realtime-preview-2024-12-17",
  aiVoice: "echo",
  noiseReduction: "far_field",
  audioFormat: "pcm16",
  instructionsPath: path.join(__dirname, 'config', 'ai-instructions.txt')
};

// Load AI instructions from file
const loadAIInstructions = () => {
  try {
    return fs.readFileSync(CONFIG.instructionsPath, 'utf8');
  } catch (error) {
    console.error(`Error loading AI instructions: ${error.message}`);
    // Return empty instructions if file not found
    return '';
  }
};

// Initialize Express app
const app = express();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Error handler middleware
const errorHandler = (err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Server error',
    message: err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
};

// Setup middleware
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// API Controllers
const apiControllers = {
  /**
   * Create a new AI voice session
   */
  async createSession(req, res, next) {
    try {
      const aiInstructions = loadAIInstructions();

      if (!aiInstructions) {
        throw new Error('AI instructions file not found or empty');
      }

      const response = await openai.beta.realtime.sessions.create({
        model: CONFIG.aiModel,
        voice: CONFIG.aiVoice,
        turn_detection: {
          type: "semantic_vad",
          eagerness: "auto",
          create_response: true,
          interrupt_response: false
        },
        input_audio_noise_reduction: {
          type: CONFIG.noiseReduction
        },
        input_audio_format: CONFIG.audioFormat,
        instructions: aiInstructions
      });

      res.json(response);
    } catch (error) {
      console.error("Error generating ephemeral token:", error);
      res.status(500).json({
        error: "Failed to generate token",
        details: error.message,
        ...(process.env.NODE_ENV !== 'production' && { stack: error.stack })
      });
    }
  }
};

// Route definitions
const setupRoutes = (app) => {
  // API routes
  app.get("/session", apiControllers.createSession);

  // Frontend route
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  // Error handler (should be last)
  app.use(errorHandler);
};

// Initialize routes
setupRoutes(app);

// Start the server
const startServer = async () => {
  // Ensure config directory exists
  const configDir = path.join(__dirname, 'config');
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  app.listen(CONFIG.port, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${CONFIG.port}`);
  });
};

// Run the server
startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});