import WebSocket from "ws";

interface ElevenLabsStreamOptions {
  onAudioChunk: (audioData: Buffer) => void;
  onFinal: () => void;
  onError: (error: string) => void;
  voiceId?: string;
  modelId?: string;
}

export function startElevenLabsStream(options: ElevenLabsStreamOptions) {
  const {
    onAudioChunk,
    onFinal,
    onError,
    voiceId = "9IzcwKmvwJcw58h3KnlH", // Default voice (Rachel)
    modelId = "eleven_turbo_v2_5"
  } = options;

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    onError("ELEVENLABS_API_KEY not set");
    return null;
  }

  // ElevenLabs WebSocket URL
  const wsUrl = `wss://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream-input?model_id=${modelId}`;

  const ws = new WebSocket(wsUrl, {
    headers: {
      "xi-api-key": apiKey
    }
  });

  let isOpen = false;
  let textBuffer = "";

  ws.on("open", () => {
    console.log("🔊 ElevenLabs WebSocket connected");
    isOpen = true;

    // Send initial config
    ws.send(JSON.stringify({
      text: " ",
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75
      }
    }));
  });

  ws.on("message", (data: Buffer) => {
    try {
      const response = JSON.parse(data.toString());
      
      if (response.audio) {
        // Decode base64 audio
        const audioBuffer = Buffer.from(response.audio, "base64");
        onAudioChunk(audioBuffer);
      }

      if (response.isFinal) {
        console.log("🎵 ElevenLabs stream completed");
        onFinal();
      }
    } catch (e) {
      // Raw audio data
      onAudioChunk(data);
    }
  });

  ws.on("error", (error) => {
    console.error("❌ ElevenLabs WebSocket error:", error);
    onError("ElevenLabs connection failed");
  });

  ws.on("close", () => {
    console.log("🔌 ElevenLabs WebSocket closed");
  });

  return {
    sendTextChunk: (text: string) => {
      if (!isOpen) {
        console.warn("⚠️ WebSocket not open, buffering text");
        textBuffer += text;
        return;
      }

      // Flush any buffered text
      if (textBuffer) {
        text = textBuffer + text;
        textBuffer = "";
      }

      // Send text chunk to ElevenLabs
      ws.send(JSON.stringify({
        text: text,
        try_trigger_generation: true
      }));
    },

    end: () => {
      if (isOpen) {
        // Send empty string to flush remaining audio
        ws.send(JSON.stringify({
          text: ""
        }));
        
        setTimeout(() => {
          ws.close();
        }, 1000);
      }
    },

    close: () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    }
  };
}