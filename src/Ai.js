import React, { useEffect, useRef, useState } from "react";
import './Ai.css';
import { db, auth } from './firebase';
import { collection, doc, setDoc, serverTimestamp, updateDoc, getDocs, query, orderBy, onSnapshot, addDoc, getDoc } from 'firebase/firestore';
import { addTripForCurrentUser } from './Itinerary';
import { Client } from "@gradio/client";

// --- RAG helpers: load dataset from public CSV and cache it ---
let _csvCache = null;
async function loadCsvData() {
  if (_csvCache) return _csvCache;
  try {
    const res = await fetch('/data/ai/data-main-data-main.csv-2.csv');
    if (!res.ok) throw new Error('Failed to fetch CSV');
    const text = await res.text();
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length === 0) {
      _csvCache = { header: [], rows: [] };
      return _csvCache;
    }
    const header = parseCsvLine(lines[0]).map(h => h.trim().toLowerCase());
    const rows = lines.slice(1).map(line => {
      const vals = parseCsvLine(line);
      const obj = {};
      for (let i = 0; i < header.length; i++) {
        obj[header[i]] = (vals[i] || '').trim();
      }
      return obj;
    });
    _csvCache = { header, rows };
    return _csvCache;
  } catch (e) {
    console.error('Failed to load CSV for RAG:', e);
    _csvCache = { header: [], rows: [] };
    return _csvCache;
  }
}

function parseCsvLine(line) {
  const res = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i+1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      res.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  res.push(cur);
  return res;
}

function mapCategoryKeyword(text) {
  const t = (text || '').toLowerCase();
  if (/\b(beach|beaches|coast|seaside|shore)\b/.test(t)) return 'beach';
  if (/\b(mountain|mountains|peak|hike|hill)\b/.test(t)) return 'mountain';
  if (/\b(history|historical|heritage|old town|church|fort|site)\b/.test(t)) return 'historical';
  return null;
}

async function getRagBlockForCategory(categoryKey, limit = 10) {
  if (!categoryKey) return '';
  const data = await loadCsvData();
  if (!data || !data.rows || data.rows.length === 0) return '';
  const header = data.header;
  const rows = data.rows;
  const categoryCols = ['category','type','tags','classification','group'];
  const nameCols = ['name','title','place','destination','location'];
  const descCols = ['description','desc','notes','summary'];
  const catCol = header.find(h => categoryCols.includes(h)) || null;
  const nameCol = header.find(h => nameCols.includes(h)) || header[0] || null;
  const descCol = header.find(h => descCols.includes(h)) || null;
  const matches = rows.filter(r => {
    if (catCol && r[catCol]) return r[catCol].toLowerCase().includes(categoryKey);
    return Object.values(r).some(v => (v || '').toLowerCase().includes(categoryKey));
  }).slice(0, limit);
  if (matches.length === 0) return '';
  const lines = matches.map(m => {
    const name = (nameCol && m[nameCol]) ? m[nameCol] : Object.values(m)[0];
    const desc = (descCol && m[descCol]) ? m[descCol] : '';
    const region = m.region || m.location || '';
    return `- ${name}${region ? ` (${region})` : ''}${desc ? ` - ${desc}` : ''}`;
  });
  return `Relevant dataset items (${categoryKey}):\n` + lines.join('\n');
}


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
  }, [messages]);

  // Load chat history on mount
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const chatsRef = collection(db, 'users', user.uid, 'aiChats');
    const q = query(chatsRef, orderBy('updatedAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setChatHistory(chats);

      // If no current chat, create a new one
      if (!currentChatId) {
        if (chats.length === 0) {
          createNewChat();
        } else {
          loadChat(chats[0].id);
        }
      }
    });

    return () => unsubscribe();
  }, [currentChatId]);

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

  function handleScroll() {
    const el = chatRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    shouldScrollRef.current = atBottom;
  }

  // Strip common model-added scope/refusal banners while preserving legitimate refusals
  function sanitizeModelResponse(text) {
    if (!text) return text;
    let t = String(text).replace(/\r/g, '').trim();
    // Remove any HTML tags
    t = t.replace(/<[^>]*>/g, '').trim();

    const lines = t.split(/\n+/).map(l => l.trim()).filter(Boolean);
    if (!lines.length) return t;

    // Patterns that commonly appear as model-hosted boilerplate/disclaimer lines
    // We intentionally avoid matching short, explicit refusals authored by our app
    const BOILERPLATE_REGEX = /\b(this assistant only|only provides|please ask about|please ask|only assists|this assistant is|this bot only|this model is|for safety reasons|scope:|note:|disclaimer|usage:|usage note)\b/i;

    // Remove any lines that match the boilerplate regex or are horizontal separators
    const filtered = lines.filter(l => {
      if (!l) return false;
      if (/^[-*_]{3,}$/.test(l)) return false;
      // Drop lines that look like boilerplate/disclaimer
      if (BOILERPLATE_REGEX.test(l)) return false;
      return true;
    });

    const remaining = filtered.join('\n').trim();
    // If removing boilerplate would leave nothing, fall back to original text
    return remaining || t;
  }

  async function sendToGradio(messagesPayload) {
    // Use Chuxia-sys/Qwen_lora and call /predict with a composed prompt
    try {
      const latest = messagesPayload[messagesPayload.length - 1]?.content || '';
      

      // Compose prompt: recent conversation
      let convo = '';
      for (const m of messagesPayload) {
        const label = m.role === 'user' ? 'User' : 'Assistant';
        convo += `${label}: ${m.content}\n`;
      }
  // System instruction: encourage the model to use destinations across the whole Philippines
  const systemInstruction = `You are an expert Philippine travel planner. When suggesting places, use destinations from across the entire Philippines — Luzon, Visayas, and Mindanao — and do not limit recommendations to Cebu, Bohol, or Palawan. Provide balanced suggestions from different regions when appropriate.`;

  // If the user asked for a category (beach, mountain, historical), augment prompt with dataset hits
      const categoryKey = mapCategoryKeyword(latest);
      let ragBlock = '';
      if (categoryKey) {
        try {
          ragBlock = await getRagBlockForCategory(categoryKey, 12);
        } catch (e) {
          console.warn('RAG block build failed', e);
        }
      }

  const prompt = `${systemInstruction}\n\n${ragBlock ? ragBlock + '\n\n' : ''}\n${convo}Assistant:`;

      const client = await Client.connect("Chuxia-sys/Qwen_lora");

      // Try multiple predict signatures for compatibility
      let result = null;
      const attempts = [
        async () => await client.predict('/predict', { prompt }),
        async () => await client.predict('/predict', prompt),
        async () => await client.predict('/predict', [prompt]),
      ];

      for (const fn of attempts) {
        try {
          result = await fn();
          if (result != null) break;
        } catch (err) {
          console.warn('predict pattern failed:', err?.message || err);
        }
      }

      console.log('Qwen_lora result:', result);

      // Robust parsing (same as before)
      if (result && typeof result === 'object') {
        if (Array.isArray(result.data)) {
          const first = result.data[0];
          if (Array.isArray(first)) {
            const assistantEntries = first.filter(m => m && m.role === 'assistant' && m.content).map(m => m.content);
            if (assistantEntries.length) {
              let response = assistantEntries[assistantEntries.length - 1].trim();
              const prevAssistantTexts = messagesPayload.filter(m => m.role === 'assistant').map(m => m.content || '');
              for (const prev of prevAssistantTexts) {
                if (prev && response.endsWith(prev)) {
                  response = response.slice(0, -prev.length).trim();
                }
              }
              if (!response) response = assistantEntries[assistantEntries.length - 1].trim();
              return sanitizeModelResponse(response);
            }
          } else if (typeof first === 'string') {
            return sanitizeModelResponse(String(first).trim());
          }
        }
        if (result?.content) return sanitizeModelResponse(String(result.content).trim());
        if (result?.text) return sanitizeModelResponse(String(result.text).trim());
      }
      if (typeof result === 'string') return sanitizeModelResponse(result.trim());
      return 'Debug: Could not parse response. Check console for structure.';
    } catch (e) {
      console.error('Gradio (Qwen_lora) send failed', e);
      return `Error: ${e?.message || e}`;
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