import React, { useEffect, useRef, useState } from "react";
import './Ai.css';
import { db, auth } from './firebase';
import { collection, doc, setDoc, serverTimestamp, updateDoc, getDocs, query, orderBy, onSnapshot, addDoc, getDoc } from 'firebase/firestore';
import { addTripForCurrentUser } from './Itinerary';
import { Client } from "@gradio/client";

// Helper to get user profile from Firestore
async function fetchUserProfile(uid) {
  if (!uid) return null;
  try {
    const docRef = doc(db, "users", uid);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data();
    }
  } catch (e) {
    console.error("Failed to fetch user profile:", e);
  }
  return null;
}

function ChatModal({ open, onClose, content, onAddToItinerary }) {
  if (!open) return null;
  return (
    <div className="ai-modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="ai-modal-content" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="ai-modal-close" aria-label="Close">×</button>
        <div className="ai-modal-header">
          <span className="ai-modal-icon">✨</span>
          <h3>LakbAI Response</h3>
        </div>
        <div className="ai-modal-body">{content}</div>
        <div className="ai-modal-footer">
          <button className="ai-btn ai-btn-outline" onClick={onAddToItinerary}>
            📋 Add to Itinerary
          </button>
          <button className="ai-btn ai-btn-primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default function ChatbaseAI({ onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState('');
  const chatRef = useRef(null);
  const shouldScrollRef = useRef(true); // Add this flag

  // Chat history state
  const [chatHistory, setChatHistory] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

  // User profile state
  const [profile, setProfile] = useState(null);

  // Fetch profile on mount
  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      fetchUserProfile(user.uid).then(setProfile);
    }
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (shouldScrollRef.current && chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Detect if user scrolled up manually
  const handleScroll = () => {
    if (!chatRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatRef.current;
    // If user is not at the bottom, disable auto-scroll
    shouldScrollRef.current = scrollHeight - scrollTop - clientHeight < 50;
  };

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
      const history = messagesPayload.slice(0, -1).map(m => ({
        role: m.role,
        metadata: null,
        content: m.content,
        options: null
      }));
      const latestMessage = messagesPayload[messagesPayload.length - 1];
      const message = latestMessage?.content || '';
      const result = await client.predict("/chat", { 
        message,
        history
      });
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
    const text = input.trim(); 
    if (!text) return;
    setInput(''); 
    addMessage(text, 'user'); 
    setLoading(true);
    const payload = [...messages.map(m => ({ role: m.role, content: m.text })), { role: 'user', content: text }];
    const reply = await sendToGradio(payload);
    addMessage(reply, 'assistant');
    if (!reply.toLowerCase().startsWith('error:')) {
      setModalContent(reply); 
      setModalOpen(true);
    }
    setLoading(false);
  };

  const handleAddToItinerary = async () => {
    const user = auth.currentUser; 
    if (!user) { 
      alert('Please sign in to add to your itinerary'); 
      return; 
    }
    try {
      const dest = {
        name: `AI Plan - ${new Date().toLocaleDateString()}`,
        region: '',
        location: '',
      };
      const id = await addTripForCurrentUser(dest);
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
      <div className="ai-popup-overlay" onClick={onClose}>
        <div className="ai-card" onClick={e => e.stopPropagation()}>
          {/* Chat History Sidebar */}
          {showHistory && (
            <div className="ai-sidebar">
              <div className="ai-sidebar-header">
                <h3>💬 Chat History</h3>
                <button onClick={() => setShowHistory(false)} className="ai-sidebar-close">×</button>
              </div>
              <button onClick={createNewChat} className="ai-btn ai-btn-new-chat">
                ✨ New Chat
              </button>
              <div className="ai-sidebar-chats">
                {chatHistory.map(chat => (
                  <div
                    key={chat.id}
                    onClick={() => { loadChat(chat.id); setShowHistory(false); }}
                    className={`ai-chat-item ${currentChatId === chat.id ? 'active' : ''}`}
                  >
                    <div className="ai-chat-title">{chat.title}</div>
                    <div className="ai-chat-meta">
                      {chat.messages?.length || 0} messages
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="ai-header">
            <div className="ai-header-content">
              <div className="ai-header-icon">🤖</div>
              <div>
                <h2 className="ai-title">LakbAI Assistant</h2>
                <p className="ai-subtitle">Ask anything about travel planning, destinations, or get personalized tips for your next adventure in the Philippines!</p>
              </div>
            </div>
            <div className="ai-header-actions">
              <button onClick={() => setShowHistory(!showHistory)} className="ai-btn ai-btn-secondary">
                📚 {showHistory ? 'Hide' : 'History'}
              </button>
              <button onClick={createNewChat} className="ai-btn ai-btn-success">
                ✨ New Chat
              </button>
            </div>
          </div>

          {/* Make chat scrollable with scroll handler */}
          <div 
            ref={chatRef} 
            className="ai-chat-container" 
            aria-live="polite" 
            style={{ maxHeight: '340px', overflowY: 'auto' }}
            onScroll={handleScroll}
          >
            {messages.length === 0 ? (
              <div className="ai-empty-state">
                <div className="ai-empty-icon">💬</div>
                <div className="ai-empty-text">Start a conversation with LakbAI!</div>
                <div className="ai-empty-suggestions">
                  <button className="ai-suggestion" onClick={() => setInput('What are the best beaches in the Philippines?')}>
                    🏖️ Best beaches
                  </button>
                  <button className="ai-suggestion" onClick={() => setInput('Plan a 3-day trip to Baguio')}>
                    🗺️ Trip planning
                  </button>
                  <button className="ai-suggestion" onClick={() => setInput('Budget-friendly destinations')}>
                    💰 Budget travel
                  </button>
                </div>
              </div>
            ) : (
              messages.map((m, i) => (
                <div key={i} className={`ai-message ${m.role === 'user' ? 'ai-message-user' : 'ai-message-assistant'}`}>
                  <div className="ai-message-avatar">
                    {m.role === 'user'
                      ? (profile?.profilePicture
                          ? <img src={profile.profilePicture} alt="User" style={{ width: 40, height: 40, borderRadius: '50%' }} />
                          : '👤')
                      : '🤖'}
                  </div>
                  <div className="ai-message-content">
                    <div className="ai-message-role">
                      {m.role === 'user'
                        ? (profile?.name || 'You')
                        : 'LakbAI'}
                    </div>
                    <div className="ai-message-text">{m.text}</div>
                  </div>
                </div>
              ))
            )}
            {loading && (
              <div className="ai-message ai-message-assistant">
                <div className="ai-message-avatar">🤖</div>
                <div className="ai-message-content">
                  <div className="ai-message-role">LakbAI</div>
                  <div className="ai-typing">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="ai-input-container">
            <div className="ai-input-wrapper">
              <button className="ai-input-icon" title="Attach file">📎</button>
              <textarea 
                value={input} 
                onChange={e => setInput(e.target.value)} 
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())} 
                className="ai-textarea"
                placeholder="Ask the AI..." 
                rows={1}
              />
              <button 
                onClick={handleSend} 
                disabled={loading || !input.trim()} 
                className="ai-send-btn"
                title="Send message"
              >
                {loading ? '⏳' : '🚀'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <ChatModal 
        open={modalOpen} 
        onClose={() => setModalOpen(false)} 
        content={modalContent} 
        onAddToItinerary={handleAddToItinerary} 
      />
    </>
  );
}

export { ChatbaseAI, ChatModal };
export { ChatModal as ChatbaseAIModal };