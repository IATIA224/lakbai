import React from "react";
import StickyHeader from "./header";

/**
 * Chatbase AI Assistant React Interface
 */
const ChatbaseAI = () => {
  return (
    <div>
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
            width: "50%",
            minHeight: "650px",
            border: "none",
            borderRadius: "12px",
            boxShadow: "0 4px 24px rgba(0,0,0,0.08)"
          }}
          allow="clipboard-write"
        />
      </div>
    </div>
  );
};

export default ChatbaseAI;