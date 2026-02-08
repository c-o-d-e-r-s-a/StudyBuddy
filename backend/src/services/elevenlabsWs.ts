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
    voiceId = "9IzcwKmvwJcw58h3KnlH", 
    modelId = "eleven_turbo_v2_5"
  } = options;

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    onError("ELEVENLABS_API_KEY not set");
    return null;
  }

  // ElevenLabs WebSocket URL
  const wsUrl = `wss://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream-input?model_id=${modelId}`;

  let ws: WebSocket | null = null;
  let isOpen = false;
  let textBuffer = "";

  try {
    ws = new WebSocket(wsUrl, {
      headers: {
        "xi-api-key": apiKey
      }
    });

    ws.on("open", () => {
      console.log("🔊 ElevenLabs WebSocket connected");
      isOpen = true;

      // Send initial config with optimized settings
      ws!.send(JSON.stringify({
        text: " ",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75
        }
      }));
    });

    ws.on("message", (data: Buffer | string) => {
      try {
        // Handle binary or text data
        const str = typeof data === "string" ? data : data.toString();
        
        try {
          const response = JSON.parse(str);
          
          if (response.audio) {
            // Decode base64 audio to Buffer
            const audioBuffer = Buffer.from(response.audio, "base64");
            console.log(`📦 Received audio chunk: ${audioBuffer.length} bytes`);
            onAudioChunk(audioBuffer);
          }

          if (response.isFinal) {
            console.log("✅ ElevenLabs stream marked as final");
            onFinal();
          }
        } catch (parseErr) {
          // Raw binary audio data
          console.log(`📦 Received binary audio: ${data.length} bytes`);
          onAudioChunk(Buffer.isBuffer(data) ? data : Buffer.from(data));
        }
      } catch (err) {
        console.error("❌ Message parsing error:", err);
      }
    });

    ws.on("error", (error) => {
      console.error("❌ ElevenLabs WebSocket error:", error);
      onError(`WebSocket error: ${error.message}`);
    });

    ws.on("close", () => {
      console.log("🔌 ElevenLabs WebSocket closed");
      isOpen = false;
    });

  } catch (err: any) {
    onError(`Failed to connect to ElevenLabs: ${err.message}`);
    return null;
  }

  // Return interface for sending text and managing stream
  return {
    sendTextChunk: (text: string) => {
      if (!ws || !isOpen) {
        console.warn("⚠️  WebSocket not ready, buffering text");
        textBuffer += text;
        return;
      }

      // Flush any buffered text
      if (textBuffer) {
        text = textBuffer + text;
        textBuffer = "";
      }

      try {
        ws.send(JSON.stringify({
          text: text,
          try_trigger_generation: true
        }));
        console.log(`📤 Sent to ElevenLabs: "${text.slice(0, 40)}..."`);
      } catch (err) {
        console.error("❌ Failed to send text chunk:", err);
      }
    },

    end: () => {
      if (ws && isOpen) {
        try {
          // Send final empty text to flush
          ws.send(JSON.stringify({ text: "" }));
          
          // Close connection after short delay
          setTimeout(() => {
            try {
              ws!.close();
            } catch (err) {
              console.error("Error closing WebSocket:", err);
            }
          }, 500);
        } catch (err) {
          console.error("Error sending end signal:", err);
        }
      }
    },

    close: () => {
      if (ws) {
        try {
          ws.close();
        } catch (err) {
          console.error("Error force-closing WebSocket:", err);
        }
      }
    }
  };
}