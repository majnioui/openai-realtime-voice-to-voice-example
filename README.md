# AI Voice Chat

A simple web application for real-time voice communication with OpenAI's GPT-4o Realtime model using WebRTC.

## Features

- Real-time voice communication with OpenAI's GPT-4o model
- Web-based user interface
- Secure handling of API keys using ephemeral tokens
- Visual feedback for microphone and connection status

## Prerequisites

- Node.js (v14 or higher)
- An OpenAI API key with access to GPT-4o Realtime model

## Installation

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file in the root directory with your OpenAI API key:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   PORT=3000
   ```

## Usage

1. Start the server:
   ```
   npm start
   ```
   or for development with auto-restart:
   ```
   npm run dev
   ```

2. Open your browser and go to `http://localhost:3000`

3. Click "Start Conversation" to begin talking with the AI

4. Your microphone audio will be sent to the OpenAI Realtime API, and the AI's responses will be played back through your speakers

5. Click "Stop Conversation" to end the session

## How It Works

This application uses:
- Express.js for the backend server
- WebRTC for real-time audio communication
- OpenAI's Realtime API for voice conversation

The backend server handles authentication with OpenAI and generates ephemeral API tokens for secure client-side communication. The frontend uses WebRTC to establish a peer connection with OpenAI's servers.

## Security Considerations

- Your OpenAI API key is only used on the server side
- Client connections use short-lived ephemeral tokens
- The application doesn't store any conversation data

## Troubleshooting

- If you encounter connection issues, ensure your OpenAI API key is valid and has access to the GPT-4o Realtime model
- Make sure to grant microphone permissions when prompted by your browser
- Check the browser console for detailed error messages

## License

ISC