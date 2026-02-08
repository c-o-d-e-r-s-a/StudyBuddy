"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Home page - redirects to study
 */
export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to study page
    router.push("/study");
  }, [router]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <h1>✨ StudyBuddy</h1>
        <p>Redirecting to study...</p>
      </div>
    </div>
  );
}