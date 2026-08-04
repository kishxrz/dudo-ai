import { ImageResponse } from "next/og";
import { SEO_CONFIG } from "@/lib/seo/config";

export const runtime = "edge";
export const alt = "Dudo - AI Employee for WhatsApp & Telegram";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#FFF8F0",
          backgroundImage: "linear-gradient(135deg, #FFF8F0 0%, #FFFFFF 50%, #FFE7B5 100%)",
          fontFamily: "sans-serif",
          padding: "80px",
          boxSizing: "border-box",
          position: "relative",
        }}
      >
        {/* Background glow effects */}
        <div
          style={{
            position: "absolute",
            top: "-200px",
            right: "-200px",
            width: "600px",
            height: "600px",
            borderRadius: "50%",
            backgroundColor: "rgba(34, 87, 122, 0.08)",
            filter: "blur(120px)",
          }}
        />

        {/* Brand Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            marginBottom: "40px",
          }}
        >
          {/* Node logo drawing in SVG */}
          <svg
            width="60"
            height="60"
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="50" cy="50" r="18" fill="#DBA11A" />
            <circle cx="24" cy="24" r="10" fill="#DBA11A" />
            <circle cx="76" cy="24" r="10" fill="#DBA11A" />
            <circle cx="15" cy="52" r="10" fill="#DBA11A" />
            <circle cx="85" cy="52" r="10" fill="#DBA11A" />
            <circle cx="43" cy="85" r="10" fill="#DBA11A" />
            <line x1="24" y1="24" x2="50" y2="50" stroke="#DBA11A" strokeWidth="4" />
            <line x1="76" y1="24" x2="50" y2="50" stroke="#DBA11A" strokeWidth="4" />
            <line x1="15" y1="52" x2="50" y2="50" stroke="#DBA11A" strokeWidth="4" />
            <line x1="85" y1="52" x2="50" y2="50" stroke="#DBA11A" strokeWidth="4" />
            <line x1="43" y1="85" x2="50" y2="50" stroke="#DBA11A" strokeWidth="4" />
          </svg>
          <span
            style={{
              fontSize: "48px",
              fontWeight: "900",
              color: "#22577A",
              letterSpacing: "-0.05em",
            }}
          >
            {SEO_CONFIG.siteName}
          </span>
        </div>

        {/* Headline */}
        <div
          style={{
            fontSize: "64px",
            fontWeight: "900",
            color: "#22577A",
            textAlign: "center",
            lineHeight: 1.15,
            marginBottom: "24px",
            maxWidth: "900px",
            letterSpacing: "-0.03em",
          }}
        >
          Launch your AI employee in 60 seconds
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: "26px",
            fontWeight: "600",
            color: "#52525B",
            textAlign: "center",
            marginBottom: "48px",
            maxWidth: "800px",
            lineHeight: 1.4,
          }}
        >
          An AI assistant that answers every customer in your voice 24/7. Connects to WhatsApp & Telegram.
        </div>

        {/* Badges / Tech Pills */}
        <div
          style={{
            display: "flex",
            gap: "16px",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              backgroundColor: "#25D366",
              color: "white",
              padding: "10px 24px",
              borderRadius: "50px",
              fontSize: "18px",
              fontWeight: "bold",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            }}
          >
            WhatsApp Bot
          </div>
          <div
            style={{
              backgroundColor: "#0088cc",
              color: "white",
              padding: "10px 24px",
              borderRadius: "50px",
              fontSize: "18px",
              fontWeight: "bold",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            }}
          >
            Telegram Agent
          </div>
          <div
            style={{
              backgroundColor: "#FFF3E5",
              color: "#22577A",
              border: "1px solid #EED9B4",
              padding: "10px 24px",
              borderRadius: "50px",
              fontSize: "18px",
              fontWeight: "bold",
            }}
          >
            Tamil · Hindi · English
          </div>
          <div
            style={{
              backgroundColor: "#22577A",
              color: "white",
              padding: "10px 24px",
              borderRadius: "50px",
              fontSize: "18px",
              fontWeight: "bold",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            }}
          >
            BYOK AI Key
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
