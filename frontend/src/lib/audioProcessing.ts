// Speech-to-text using Web Audio API + Gemini API
export async function recordAndTranscribe(
  durationMs: number = 5000
): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      const chunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: "audio/webm" });
        
        // Send to backend for transcription
        try {
          const formData = new FormData();
          formData.append("audio", blob);
          
          const response = await fetch("http://localhost:3001/transcribe", {
            method: "POST",
            body: formData
          });

          if (!response.ok) {
            reject(new Error(`Transcription failed: ${response.status}`));
            return;
          }

          const data = await response.json();
          resolve(data.text || "");
        } catch (err) {
          reject(err);
        }
      };

      mediaRecorder.start();
      setTimeout(() => {
        if (mediaRecorder.state !== "inactive") {
          mediaRecorder.stop();
        }
      }, durationMs);
    } catch (err) {
      reject(err);
    }
  });
}

// Play audio with streaming support
export async function playAudioStream(
  audioChunks: ArrayBuffer[],
  onChunkPlayed?: (chunk: ArrayBuffer) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const offlineContext = new OfflineAudioContext(1, 44100 * 2, 44100);

      let currentTime = 0;
      let processed = 0;

      const processChunks = async () => {
        for (const chunk of audioChunks) {
          try {
            const audioBuffer = await audioContext.decodeAudioData(chunk);
            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContext.destination);
            source.start(currentTime);
            currentTime += audioBuffer.duration;
            onChunkPlayed?.(chunk);
          } catch (err) {
            console.error("Failed to decode audio chunk:", err);
          }
        }

        setTimeout(() => resolve(), (currentTime + 1) * 1000);
      };

      processChunks();
    } catch (err) {
      reject(err);
    }
  });
}