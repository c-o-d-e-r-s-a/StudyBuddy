// Speech-to-text using Web Audio API + Gemini API
export async function recordAndTranscribe(
  durationMs: number = 5000
): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      console.log("🎤 Requesting microphone access...");
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      const chunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (e) => {
        console.log("📦 Audio chunk received:", e.data.size, "bytes");
        chunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        console.log("⏹️ Recording stopped, processing...");
        stream.getTracks().forEach((t) => {
          t.stop();
          console.log("🔇 Track stopped");
        });

        const blob = new Blob(chunks, { type: "audio/webm" });
        console.log("📝 Audio blob created:", blob.size, "bytes");

        // Send to backend for transcription
        try {
          const formData = new FormData();
          formData.append("audio", blob, "recording.webm");

          console.log("📤 Uploading to /transcribe...");
          
          const response = await fetch("http://localhost:3001/transcribe", {
            method: "POST",
            body: formData
          });

          console.log("📥 Response status:", response.status);

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error("❌ Transcription failed:", response.status, errorData);
            reject(new Error(`Transcription failed: ${response.status} - ${errorData.error || response.statusText}`));
            return;
          }

          const data = await response.json();
          console.log("✅ Transcription success:", data.text.slice(0, 50) + "...");
          resolve(data.text || "");
        } catch (err) {
          console.error("❌ Fetch error:", err);
          reject(err);
        }
      };

      mediaRecorder.onerror = (e) => {
        console.error("❌ MediaRecorder error:", e.error);
        reject(new Error("Recording failed: " + e.error));
      };

      console.log("🔴 Recording started for", durationMs, "ms");
      mediaRecorder.start();

      setTimeout(() => {
        if (mediaRecorder.state !== "inactive") {
          console.log("⏱️ Time limit reached, stopping recording...");
          mediaRecorder.stop();
        }
      }, durationMs);
    } catch (err) {
      console.error("❌ recordAndTranscribe error:", err);
      reject(err);
    }
  });
}