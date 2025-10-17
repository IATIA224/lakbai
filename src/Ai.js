import React, { useEffect, useRef, useState } from "react";
import StickyHeader from './header';
import { db, auth } from './firebase';
import { collection, doc, setDoc, serverTimestamp, arrayUnion, updateDoc, getDocs, query, orderBy, onSnapshot, addDoc } from 'firebase/firestore';
import { addTripForCurrentUser } from './Itinerary';
import { Client } from "@gradio/client";

function ChatModal({ open, onClose, content, onAddToItinerary }) {
  if (!open) return null;
  return (
    <div style={overlayStyle} role="dialog" aria-modal="true">
      <div style={modalStyle}>
        <button onClick={onClose} style={closeBtnStyle} aria-label="Close">×</button>
        <h3 style={{ color: '#6c63ff' }}>LakbAI Answer</h3>
        <div style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>{content}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
          <button className="btn-outline" onClick={onAddToItinerary}>Add to Itinerary</button>
          <button className="btn-primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default function ChatbaseAI() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState('');
  const chatRef = useRef(null);

  // Chat history state
  const [chatHistory, setChatHistory] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => { if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight; }, [messages]);

  // Load chat history on mount
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const chatsRef = collection(db, 'users', user.uid, 'aiChats');
    const q = query(chatsRef, orderBy('updatedAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chats = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setChatHistory(chats);
      
      // If no current chat, create a new one
      if (!currentChatId && chats.length === 0) {
        createNewChat();
      } else if (!currentChatId && chats.length > 0) {
        // Load the most recent chat
        loadChat(chats[0].id);
      }
    });

    return () => unsubscribe();
  }, []);

  // Save messages to Firestore whenever they change
  useEffect(() => {
    if (!currentChatId || messages.length === 0) return;
    
    const user = auth.currentUser;
    if (!user) return;

    const chatRef = doc(db, 'users', user.uid, 'aiChats', currentChatId);
    const firstUserMsg = messages.find(m => m.role === 'user');
    const title = firstUserMsg?.text?.substring(0, 50) || 'New Chat';

    setDoc(chatRef, {
      title,
      messages,
      updatedAt: serverTimestamp()
    }, { merge: true }).catch(err => console.error('Save chat failed:', err));
  }, [messages, currentChatId]);

  const createNewChat = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const chatsRef = collection(db, 'users', user.uid, 'aiChats');
      const newChatRef = await addDoc(chatsRef, {
        title: 'New Chat',
        messages: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      setCurrentChatId(newChatRef.id);
      setMessages([]);
      setModalContent('');
    } catch (e) {
      console.error('Create new chat failed:', e);
    }
  };

  const loadChat = async (chatId) => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const chatRef = doc(db, 'users', user.uid, 'aiChats', chatId);
      const snapshot = await getDocs(collection(db, 'users', user.uid, 'aiChats'));
      const chatDoc = snapshot.docs.find(d => d.id === chatId);
      
      if (chatDoc) {
        setCurrentChatId(chatId);
        setMessages(chatDoc.data().messages || []);
      }
    } catch (e) {
      console.error('Load chat failed:', e);
    }
  };

  function addMessage(text, role = 'assistant') {
    setMessages(prev => [...prev, { role, text, timestamp: new Date().toISOString() }]);
  }

  async function sendToGradio(messagesPayload) {
    try {
      const client = await Client.connect("Chuxia-sys/gemma-merged-v2");
      
      // Convert messagesPayload to Gradio history format
      // Gradio expects: [{"role":"user","metadata":null,"content":"...","options":null}, ...]
      const history = messagesPayload.slice(0, -1).map(m => ({
        role: m.role,
        metadata: null,
        content: m.content,
        options: null
      }));
      
      // Get the latest user message
      const latestMessage = messagesPayload[messagesPayload.length - 1];
      const message = latestMessage?.content || '';
      
      const result = await client.predict("/chat", { 
        message,
        history
      });
      
      console.log('Gradio full result:', JSON.stringify(result, null, 2));
      console.log('Gradio result.data:', result.data);
      
      // Extract the reply from result.data
      // Gradio returns: { data: [[{user_obj}, {assistant_obj}], ""] }
      // We want the assistant's content from the first array element
      if (result?.data && Array.isArray(result.data)) {
        const conversation = result.data[0];
        if (Array.isArray(conversation) && conversation.length > 1) {
          const assistantResponse = conversation[1];
          if (assistantResponse?.content) {
            return String(assistantResponse.content);
          }
        }
      }
      
      return `Debug: Could not parse response. Check console for structure.`;
    } catch (e) {
      console.error('Gradio send failed', e);
      return `Error: ${e.message}`;
    }
  }

  const handleSend = async () => {
    const text = input.trim(); if (!text) return;
    setInput(''); addMessage(text, 'user'); setLoading(true);
    const payload = [...messages.map(m => ({ role: m.role, content: m.text })), { role: 'user', content: text }];
    const reply = await sendToGradio(payload);
    // If the reply starts with 'Error:' show it but don't open modal
    addMessage(reply, 'assistant');
    if (!reply.toLowerCase().startsWith('error:')) {
      setModalContent(reply); setModalOpen(true);
    }
    setLoading(false);
  };

  const handleAddToItinerary = async () => {
    const user = auth.currentUser; if (!user) { alert('Please sign in to add to your itinerary'); return; }
    try {
      // Create a lightweight destination from the AI content
      const dest = {
        name: `AI Plan - ${new Date().toLocaleDateString()}`,
        region: '',
        location: '',
      };
      const id = await addTripForCurrentUser(dest);
      // Attach the full AI answer as notes
      const itemRef = doc(db, 'itinerary', user.uid, 'items', id);
      await updateDoc(itemRef, { notes: modalContent, updatedAt: serverTimestamp() });
      alert('Added to your itinerary. You can edit details in My Trips.');
    } catch (e) {
      console.error('Add to itinerary failed', e);
      alert('Failed to add to itinerary');
    }
  };

  // Dispatch the event on component mount
  useEffect(() => {
    window.dispatchEvent(new Event('lakbai:open-ai'));
  }, []);

  return (
    <>
      <div style={containerStyle}>
        {/* Chat History Sidebar */}
        {showHistory && (
          <div style={sidebarStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: '#6c63ff' }}>Chat History</h3>
              <button onClick={() => setShowHistory(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>×</button>
            </div>
            <button onClick={createNewChat} style={{ width: '100%', marginBottom: 12, padding: '8px 12px', background: '#6c63ff', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
              + New Chat
            </button>
            <div style={{ maxHeight: 500, overflowY: 'auto' }}>
              {chatHistory.map(chat => (
                <div
                  key={chat.id}
                  onClick={() => { loadChat(chat.id); setShowHistory(false); }}
                  style={{
                    padding: 10,
                    marginBottom: 8,
                    background: currentChatId === chat.id ? '#e0e7ff' : '#f9f9f9',
                    borderRadius: 6,
                    cursor: 'pointer',
                    border: currentChatId === chat.id ? '2px solid #6c63ff' : '1px solid #ddd'
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{chat.title}</div>
                  <div style={{ fontSize: 12, color: '#666' }}>
                    {chat.messages?.length || 0} messages
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 12 }}>
            <div>
              <h2 style={{ color: '#6c63ff', margin: 0 }}>LakbAI Assistant</h2>
              <p style={{ color: '#444', margin: '4px 0 0 0', fontSize: 14 }}>Ask anything about travel planning, destinations, or get personalized tips for your next adventure in the Philippines!</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowHistory(!showHistory)} style={{ padding: '8px 16px', background: '#6c63ff', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
                {showHistory ? 'Hide' : 'History'}
              </button>
              <button onClick={createNewChat} style={{ padding: '8px 16px', background: '#28a745', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
                New Chat
              </button>
            </div>
          </div>

          <div ref={chatRef} style={chatContainerStyle} aria-live="polite">
            {messages.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#999', padding: 40 }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>💬</div>
                <div>Start a conversation with LakbAI!</div>
              </div>
            ) : (
              messages.map((m,i) => (
                <div key={i} style={m.role === 'user' ? userMsgStyle : aiMsgStyle}>
                  <strong style={{ display: 'block', fontSize: 12 }}>{m.role === 'user' ? 'You' : 'AI'}</strong>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
                </div>
              ))
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())} rows={3} style={{ flex: 1 }} placeholder="Ask the AI..." />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button onClick={handleSend} disabled={loading} style={{ minWidth: 100 }}>{loading ? 'Sending...' : 'Send'}</button>
            </div>
          </div>
        </div>
      </div>

  <ChatModal open={modalOpen} onClose={() => setModalOpen(false)} content={modalContent} onAddToItinerary={handleAddToItinerary} />
    </>
  );
}

const containerStyle = { width: '100%', minHeight: '700px', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'linear-gradient(120deg, #e0e7ff 0%, #f3f4f6 100%)', padding: '48px 0', position: 'relative' };
const sidebarStyle = { position: 'absolute', left: 20, top: 60, background: '#fff', borderRadius: 12, boxShadow: '0 4px 24px rgba(60,60,120,0.15)', padding: 20, width: 280, maxHeight: 600, zIndex: 10 };
const cardStyle = { background: '#fff', borderRadius: 18, boxShadow: '0 8px 32px rgba(60,60,120,0.12)', padding: 32, width: 900, maxWidth: '96vw', minHeight: 650, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' };
const chatContainerStyle = { height: 320, overflow: 'auto', border: '1px solid #ddd', padding: 10, borderRadius: 6, background: '#fff', width: '100%' };
const userMsgStyle = { background: '#f1f1f8', padding: 10, borderRadius: 8, marginBottom: 8, alignSelf: 'flex-end' };
const aiMsgStyle = { background: '#eef6ff', padding: 10, borderRadius: 8, marginBottom: 8, alignSelf: 'flex-start' };
const overlayStyle = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.25)', zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center' };
const modalStyle = { background: '#fff', borderRadius: 18, boxShadow: '0 8px 32px rgba(60,60,120,0.18)', width: '60vw', minWidth: 340, maxWidth: 700, minHeight: 300, position: 'relative', padding: 24 };
const closeBtnStyle = { position: 'absolute', top: 12, right: 12, background: '#6c63ff', color: '#fff', border: 'none', borderRadius: '50%', width: 32, height: 32, fontSize: '1rem', cursor: 'pointer' };

export { ChatbaseAI, ChatModal };
// Backwards-compatible named export used by App.js
export { ChatModal as ChatbaseAIModal };