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
        alignItems: "center"
      }}>
        <iframe
          src="https://www.chatbase.co/chatbot-iframe/GvAz1tvx4Nwihd7nqTKRZ"
          title="Chatbase AI Assistant"
          width="100%"
          style={{
            marginTop: "25px",
            height: "85%",
            width: "85%",
            minHeight: "650px",
            border: "none",
            borderRadius: "12px",
            boxShadow: "0 4px 24px rgba(0,0,0,0.08)"
          }}
          allow="clipboard-write"
        />
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
      background: "#6c63ff",
      borderRadius: "1px",
      boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
      width: "60vw",
      minWidth: "340px",
      maxWidth: "700px",
      minHeight: "500px",
      position: "relative",
      padding: "0"
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
          zIndex: 10
        }}
      >×</button>
      <div style={{
        width: "100%",
        minHeight: "700px",
        height: "100%",
        display: "flex",
        justifyContent: "center",
        alignItems: "center"
      }}>
        <iframe
          src="https://www.chatbase.co/chatbot-iframe/GvAz1tvx4Nwihd7nqTKRZ"
          title="Chatbase AI Assistant"
          width="100%"
          style={{
            marginTop: "25px",
            height: "85%",
            width: "85%",
            minHeight: "650px",
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