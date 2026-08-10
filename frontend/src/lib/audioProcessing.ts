/**
 * Audio input/output utilities
 */

export async function recordAndTranscribe(
  durationMs: number = 5000
): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      console.log("🎤 Requesting microphone...");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      const chunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: "audio/webm" });

        console.log(`📤 Sending audio blob (${blob.size} bytes) to transcribe...`);

        try {
          const formData = new FormData();
          formData.append("audio", blob);

          // ✅ ENSURE THIS URL MATCHES YOUR BACKEND PORT
          const response = await fetch("http://localhost:3001/transcribe", {
            method: "POST",
            body: formData,
            // ⚠️ DO NOT set Content-Type header - browser will set it with boundary
          });

          console.log(`📥 Transcription response status: ${response.status}`);

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ HTTP ${response.status}: ${errorText}`);
            reject(
              new Error(
                `Transcription failed: ${response.status} ${response.statusText}`
              )
            );
            return;
          }

          const data = await response.json();
          const transcript = data.text || "";

          if (!transcript.trim()) {
            reject(new Error("No speech detected in audio"));
            return;
          }

          console.log(`✅ Transcription: "${transcript}"`);
          resolve(transcript);
        } catch (err: any) {
          console.error("❌ Transcription network error:", err);
          reject(err);
        }
      };

      mediaRecorder.start();
      console.log(`⏱️ Recording for ${durationMs}ms...`);

      setTimeout(() => {
        if (mediaRecorder.state !== "inactive") {
          console.log("⏹️ Recording timeout, stopping...");
          mediaRecorder.stop();
        }
      }, durationMs);
    } catch (err: any) {
      console.error("❌ Microphone access error:", err);
      reject(err);
    }
  });
}