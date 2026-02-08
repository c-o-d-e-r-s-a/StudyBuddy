"use client";

import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  return (
    <div style={{ 
      display: "flex", 
      alignItems: "center", 
      justifyContent: "center", 
      minHeight: "100vh",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      fontFamily: "system-ui, -apple-system, sans-serif"
    }}>
      <div style={{
        textAlign: "center",
        backgroundColor: "white",
        padding: "60px 40px",
        borderRadius: "20px",
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        maxWidth: "500px"
      }}>
        <h1 style={{ 
          fontSize: "48px", 
          marginBottom: "20px",
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          backgroundClip: "text",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          fontWeight: "bold"
        }}>
          📚 StudyBuddy
        </h1>
        
        <p style={{ 
          fontSize: "18px", 
          color: "#666", 
          marginBottom: "40px",
          lineHeight: "1.6"
        }}>
          Your AI-powered study companion. Get personalized assistance with real-time attention monitoring.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
          <button
            onClick={() => router.push("/landing")}
            style={{
              padding: "16px 32px",
              fontSize: "18px",
              fontWeight: "bold",
              color: "white",
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              border: "none",
              borderRadius: "12px",
              cursor: "pointer",
              transition: "transform 0.3s, box-shadow 0.3s",
              boxShadow: "0 10px 25px rgba(102, 126, 234, 0.4)"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-3px)";
              e.currentTarget.style.boxShadow = "0 15px 35px rgba(102, 126, 234, 0.6)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 10px 25px rgba(102, 126, 234, 0.4)";
            }}
          >
            🌐 Visit Landing Page
          </button>

          <button
            onClick={() => router.push("/study")}
            style={{
              padding: "16px 32px",
              fontSize: "18px",
              fontWeight: "bold",
              color: "#667eea",
              background: "white",
              border: "2px solid #667eea",
              borderRadius: "12px",
              cursor: "pointer",
              transition: "transform 0.3s, background 0.3s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-3px)";
              e.currentTarget.style.background = "#f0f4ff";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.background = "white";
            }}
          >
            📖 Go to Study
          </button>
        </div>

        <div style={{
          marginTop: "40px",
          paddingTop: "30px",
          borderTop: "1px solid #eee",
          fontSize: "14px",
          color: "#999"
        }}>
          <p>Choose where you want to go:</p>
          <p style={{ fontSize: "12px", marginTop: "10px" }}>
            🌐 Landing Page - Learn about StudyBuddy features<br/>
            📖 Study Page - Start your study session
          </p>
        </div>
      </div>
    </div>
  );
}