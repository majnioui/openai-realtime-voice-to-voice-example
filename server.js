import express from 'express';
import dotenv from 'dotenv';
import { OpenAI } from 'openai';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

// Setup for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Add an endpoint to check available models
app.get("/models", async (req, res) => {
  try {
    const models = await openai.models.list();
    res.json(models.data);
  } catch (error) {
    console.error("Error fetching models:", error);
    res.status(500).json({ error: "Failed to fetch models", details: error.message });
  }
});

// Endpoint to get an ephemeral token
app.get("/session", async (req, res) => {
  try {
    console.log("Creating a session...");
    // Using correct format for Realtime API with VAD configuration
    const response = await openai.beta.realtime.sessions.create({
      model: "gpt-4o-mini-realtime-preview-2024-12-17",
      voice: "echo",
      turn_detection: {
        type: "semantic_vad",
        eagerness: "auto",
        create_response: true,
        interrupt_response: true
      },
      input_audio_noise_reduction: {
        type: "near_field"
      },
      input_audio_format: "pcm16"
    });

    console.log("Session created successfully:", response);
    res.json(response);
  } catch (error) {
    console.error("Error generating ephemeral token:", error);
    res.status(500).json({
      error: "Failed to generate token",
      details: error.message,
      stack: error.stack
    });
  }
});

// Serve the frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
app.listen(port, '0.0.0.0', () => {
  console.log(`Server running at http://localhost:${port}`);
});