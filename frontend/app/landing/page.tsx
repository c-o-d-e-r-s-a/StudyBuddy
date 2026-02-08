"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

export default function LandingPage() {
  const router = useRouter();
  const [expandedCard, setExpandedCard] = useState(null);

  const features = [
    {
      id: 1,
      title: "Google Gemini API",
      shortDesc: "Focus Detection",
      fullDesc: "We’re using the Gemini API to give our app access to Google’s AI models so it can understand user input and generate helpful responses (like tutoring, summaries, or Q&A). Basically, it’s the “brain” that powers the smart, conversational features in the project."
    },
    {
      id: 2,
      title: "Eleven Labs",
      shortDesc: "Instant Help",
      fullDesc: "We’re using Eleven Labs to generate realistic text-to-speech audio so our app can speak responses out loud in a natural voice. Basically, it adds a voice feature that makes the experience more interactive and accessible."
    },
    {
      id: 3,
      title: "OpenCV",
      shortDesc: "Quick Progress",
      fullDesc: "We’re using OpenCV to analyze live video of the person in front of the camera to detect if they are looking away or appear confused. Basically, it helps the app respond in real time by asking something like, “Why do you look so confused?”"
    }
  ];

  return (
    <div style={{
      minHeight: "100vh",
      width: "100vw",
      backgroundColor: "#1e40af",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "system-ui, -apple-system, sans-serif",
      margin: "0",
      padding: "0",
      overflow: "hidden",
      position: "relative"
    }}>
      
      {/* Animated gradient background circles */}
      <div style={{
        position: "absolute",
        top: "-100px",
        right: "-100px",
        width: "300px",
        height: "300px",
        backgroundColor: "rgba(255, 255, 255, 0.15)",
        borderRadius: "50%",
        filter: "blur(40px)",
        animation: "float 6s ease-in-out infinite"
      }}></div>

      <div style={{
        position: "absolute",
        bottom: "-150px",
        left: "-150px",
        width: "400px",
        height: "400px",
        backgroundColor: "rgba(59, 130, 246, 0.2)",
        borderRadius: "50%",
        filter: "blur(50px)",
        animation: "float 8s ease-in-out infinite reverse"
      }}></div>

      <div style={{
        position: "absolute",
        top: "50px",
        left: "50px",
        width: "150px",
        height: "150px",
        backgroundColor: "rgba(255, 255, 255, 0.12)",
        borderRadius: "50%",
        filter: "blur(30px)"
      }}></div>

      {/* Top right accent */}
      <div style={{
        position: "absolute",
        top: "20px",
        right: "40px",
        width: "100px",
        height: "100px",
        backgroundColor: "rgba(34, 197, 94, 0.15)",
        borderRadius: "20px",
        transform: "rotate(45deg)",
        filter: "blur(25px)"
      }}></div>

      {/* Bottom right accent */}
      <div style={{
        position: "absolute",
        bottom: "30px",
        right: "50px",
        width: "120px",
        height: "120px",
        backgroundColor: "rgba(249, 115, 22, 0.12)",
        borderRadius: "30px",
        filter: "blur(35px)"
      }}></div>

      {/* CSS Animation */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(30px); }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(255, 255, 255, 0.3); }
          50% { box-shadow: 0 0 40px rgba(255, 255, 255, 0.5); }
        }
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scale-in {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>

      {/* Main Content */}
      <div style={{ textAlign: "center", zIndex: "10", animation: "slide-up 0.8s ease-out" }}>
        {/* Logo/Icon */}
        <div style={{
          fontSize: "80px",
          marginBottom: "20px",
          animation: "float 4s ease-in-out infinite"
        }}>
          📚
        </div>

        <h1 style={{
          fontSize: "100px",
          fontWeight: "900",
          color: "white",
          margin: "0 0 20px 0",
          textShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
          letterSpacing: "-2px"
        }}>
          Study Buddy
        </h1>

        <p style={{
          fontSize: "20px",
          color: "rgba(255, 255, 255, 0.8)",
          margin: "0 0 50px 0",
          fontWeight: "300",
          letterSpacing: "1px"
        }}>
          AI-Powered Learning Experience
        </p>

        {/* Welcome Button with modern styling */}
        <button
          onClick={() => router.push("/study")}
          style={{
            fontSize: "48px",
            color: "white",
            fontWeight: "700",
            backgroundColor: "rgba(255, 255, 255, 0.12)",
            border: "2px solid rgba(255, 255, 255, 0.3)",
            cursor: "pointer",
            padding: "24px 80px",
            borderRadius: "20px",
            transition: "all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
            position: "relative",
            backdropFilter: "blur(10px)",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.1)",
            overflow: "hidden"
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = "rgba(255, 255, 255, 0.25)";
            e.target.style.transform = "translateY(-3px) scale(1.05)";
            e.target.style.boxShadow = "0 15px 40px rgba(255, 255, 255, 0.2)";
            e.target.style.borderColor = "rgba(255, 255, 255, 0.5)";
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = "rgba(255, 255, 255, 0.12)";
            e.target.style.transform = "translateY(0) scale(1)";
            e.target.style.boxShadow = "0 8px 32px rgba(0, 0, 0, 0.1)";
            e.target.style.borderColor = "rgba(255, 255, 255, 0.3)";
          }}
        >
          Welcome
        </button>

        {/* Feature tags */}
        <div style={{
          display: "flex",
          gap: "20px",
          justifyContent: "center",
          marginTop: "60px",
          flexWrap: "wrap"
        }}>
          {features.map((feature) => (
            <button
              key={feature.id}
              onClick={() => setExpandedCard(expandedCard === feature.id ? null : feature.id)}
              style={{
                padding: "12px 24px",
                backgroundColor: "rgba(255, 255, 255, 0.08)",
                borderRadius: "12px",
                color: "rgba(255, 255, 255, 0.9)",
                fontSize: "14px",
                fontWeight: "600",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                backdropFilter: "blur(10px)",
                cursor: "pointer",
                transition: "all 0.3s ease",
                position: "relative"
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = "rgba(255, 255, 255, 0.15)";
                e.target.style.transform = "translateY(-2px)";
                e.target.style.boxShadow = "0 8px 20px rgba(255, 255, 255, 0.15)";
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = "rgba(255, 255, 255, 0.08)";
                e.target.style.transform = "translateY(0)";
                e.target.style.boxShadow = "none";
              }}
            >
              {feature.title}
            </button>
          ))}
        </div>
      </div>

      {/* Expanded Card Modal */}
      {expandedCard !== null && (
        <div
          style={{
            position: "fixed",
            top: "0",
            left: "0",
            right: "0",
            bottom: "0",
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: "1000",
            backdropFilter: "blur(5px)",
            animation: "scale-in 0.3s ease-out"
          }}
          onClick={() => setExpandedCard(null)}
        >
          <div
            style={{
              backgroundColor: "#1e40af",
              borderRadius: "25px",
              padding: "40px",
              maxWidth: "500px",
              width: "90%",
              border: "2px solid rgba(255, 255, 255, 0.2)",
              boxShadow: "0 20px 60px rgba(0, 0, 0, 0.4)",
              animation: "scale-in 0.3s ease-out",
              position: "relative"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setExpandedCard(null)}
              style={{
                position: "absolute",
                top: "20px",
                right: "20px",
                backgroundColor: "rgba(255, 255, 255, 0.1)",
                border: "none",
                color: "white",
                fontSize: "24px",
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.3s ease"
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = "rgba(255, 255, 255, 0.2)";
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
              }}
            >
              ✕
            </button>

            {/* Card Content */}
            <div style={{ textAlign: "center" }}>
              <h2 style={{
                fontSize: "36px",
                color: "white",
                margin: "0 0 20px 0",
                fontWeight: "700"
              }}>
                {features.find(f => f.id === expandedCard)?.title}
              </h2>

              <p style={{
                fontSize: "16px",
                color: "rgba(255, 255, 255, 0.9)",
                lineHeight: "1.8",
                margin: "0"
              }}>
                {features.find(f => f.id === expandedCard)?.fullDesc}
              </p>

              {/* Bottom accent line */}
              <div style={{
                marginTop: "30px",
                height: "2px",
                background: "linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent)"
              }}></div>

              <p style={{
                fontSize: "12px",
                color: "rgba(255, 255, 255, 0.6)",
                marginTop: "20px"
              }}>
                Click anywhere to close
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Animated bottom line */}
      <div style={{
        position: "absolute",
        bottom: "0",
        left: "0",
        right: "0",
        height: "3px",
        background: "linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent)",
        animation: "pulse-glow 3s ease-in-out infinite"
      }}></div>

      {/* Corner accent - top left */}
      <div style={{
        position: "absolute",
        top: "0",
        left: "0",
        width: "200px",
        height: "200px",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        borderRight: "none",
        borderBottom: "none",
        borderTopLeftRadius: "20px"
      }}></div>

      {/* Corner accent - bottom right */}
      <div style={{
        position: "absolute",
        bottom: "0",
        right: "0",
        width: "200px",
        height: "200px",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        borderLeft: "none",
        borderTop: "none",
        borderBottomRightRadius: "20px"
      }}></div>
    </div>
  );
}