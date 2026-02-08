import axios from "axios";
import { Readable } from "stream";

// Keep your test function
export async function testTTS() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY is not set in environment variables");
  }

  try {
    const response = await axios.post(
      "https://api.elevenlabs.io/v1/text-to-speech/EXAVITQu4vr4xnSDxMaL",
      {
        text: "Hello, this is StudyBuddy speaking.",
        model_id: "eleven_turbo_v2_5"
      },
      {
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json"
        },
        responseType: "arraybuffer"
      }
    );

    return response.data;
  } catch (error: any) {
    console.error("ElevenLabs API Error Details:");
    console.error("- Status:", error.response?.status);
    console.error("- Data:", error.response?.data?.toString());
    throw error;
  }
}

// Streaming audio generation
interface ElevenLabsStreamOptions {
  text: string;
  onAudioChunk: (audioData: Buffer) => void;
  onFinal: () => void;
  onError: (error: string) => void;
  voiceId?: string;
  modelId?: string;
}

export async function startElevenLabsStream(options: ElevenLabsStreamOptions) {
  const {
    text,
    onAudioChunk,
    onFinal,
    onError,
    voiceId = "9IzcwKmvwJcw58h3KnlH",
    modelId = "eleven_turbo_v2_5"
  } = options;

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    onError("ELEVENLABS_API_KEY not set");
    return;
  }

  try {
    const response = await axios({
      method: "POST",
      url: `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      responseType: "arraybuffer",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json"
      },
      data: {
        text,
        model_id: modelId,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75
        }
      }
    });

    // Send audio in chunks for smooth playback
    const audioBuffer = Buffer.from(response.data);
    const CHUNK_SIZE = 1000000000;
    
    for (let i = 0; i < audioBuffer.length; i += CHUNK_SIZE) {
      const chunk = audioBuffer.slice(i, i + CHUNK_SIZE);
      onAudioChunk(chunk);
    }

    onFinal();

  } catch (err: any) {
    onError("ElevenLabs request failed: " + err.message);
  }
}