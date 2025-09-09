import React from "react";
import StickyHeader from './header';

/**
 * Chatbase AI Assistant React Interface
 */
const ChatbaseAI = () => {
  return (
    <>
      <StickyHeader />
      <div style={{
        width: "100%",
        minHeight: "700px",
        height: "100%",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "linear-gradient(120deg, #e0e7ff 0%, #f3f4f6 100%)",
        padding: "48px 0"
      }}>
        <div style={{
          background: "#fff",
          borderRadius: "18px",
          boxShadow: "0 8px 32px rgba(60,60,120,0.12)",
          padding: "32px",
          width: "900px",
          maxWidth: "96vw",
          minHeight: "650px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          position: "relative"
        }}>
          <div style={{
            fontSize: "2rem",
            fontWeight: "700",
            color: "#6c63ff",
            marginBottom: "12px",
            letterSpacing: "0.5px"
          }}>
            LakbAI Assistant
          </div>
          <div style={{
            fontSize: "1.08rem",
            color: "#444",
            marginBottom: "24px",
            textAlign: "center",
            maxWidth: "600px"
          }}>
            Ask anything about travel planning, destinations, or get personalized tips for your next adventure in the Philippines!
          </div>
          <iframe
            src="https://www.chatbase.co/chatbot-iframe/GvAz1tvx4Nwihd7nqTKRZ"
            title="Chatbase AI Assistant"
            width="100%"
            style={{
              height: "500px",
              width: "100%",
              minHeight: "500px",
              border: "none",
              borderRadius: "12px",
              boxShadow: "0 4px 24px rgba(0,0,0,0.08)"
            }}
            allow="clipboard-write"
          />
        </div>
      </div>
    </>
  );
};

const ChatbaseAIModal = ({ onClose }) => (
  <div style={{
    position: "fixed",
    top: 0, left: 0, right: 0, bottom: 0,
    background: "rgba(0,0,0,0.25)",
    zIndex: 2000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  }}>
    <div style={{
      background: "#fff",
      borderRadius: "18px",
      boxShadow: "0 8px 32px rgba(60,60,120,0.18)",
      width: "60vw",
      minWidth: "340px",
      maxWidth: "700px",
      minHeight: "700px",
      position: "relative",
      padding: "32px"
    }}>
      <button
        onClick={onClose}
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          background: "#6c63ff",
          color: "#fff",
          border: "none",
          borderRadius: "50%",
          width: "32px",
          height: "32px",
          fontSize: "1.2rem",
          cursor: "pointer",
          zIndex: 10,
          boxShadow: "0 2px 8px rgba(60,60,120,0.12)"
        }}
        aria-label="Close"
      >×</button>
      <div style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center"
      }}>
        <div style={{
          fontSize: "1.5rem",
          fontWeight: "700",
          color: "#6c63ff",
          marginBottom: "10px"
        }}>
          LakbAI Assistant
        </div>
        <div style={{
          fontSize: "1rem",
          color: "#444",
          marginBottom: "18px",
          textAlign: "center",
          maxWidth: "400px"
        }}>
          Get instant travel help and recommendations!
        </div>
        <iframe
          src="https://www.chatbase.co/chatbot-iframe/GvAz1tvx4Nwihd7nqTKRZ"
          title="Chatbase AI Assistant"
          width="100%"
          style={{
            height: "550px",
            width: "100%",
            minHeight: "350px",
            border: "none",
            borderRadius: "12px",
            boxShadow: "0 4px 24px rgba(0,0,0,0.08)"
          }}
          allow="clipboard-write"
        />
      </div>
    </div>
  </div>
);

export { ChatbaseAI, ChatbaseAIModal };
export default ChatbaseAI;