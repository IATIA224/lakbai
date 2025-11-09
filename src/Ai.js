import React, { useEffect, useRef, useState } from "react";
import './Ai.css';
import { db, auth } from './firebase';
import { collection, doc, setDoc, serverTimestamp, updateDoc, getDocs, query, orderBy, onSnapshot, addDoc, getDoc } from 'firebase/firestore';
import { addTripForCurrentUser } from './Itinerary';
import { Client } from "@gradio/client";

// --- RAG helpers: load dataset from public CSV and cache it ---
let _csvCache = null;

// === Place + Keyword Lists ===
const PHILIPPINE_PLACES = [
  "philippines", "palawan", "cebu", "bohol", "baguio", "manila", "ilocos",
  "sagada", "siargao", "davao", "vigan", "boracay", "tagaytay", "subic",
  "bacolod", "dumaguete", "camiguin", "bataan", "batangas", "zambales",
  "bicol", "naga", "la union", "pampanga", "pangasinan", "antipolo",
  "rizal", "isabela", "surigao", "tarlac", "bukidnon", "cagayan de oro",
  "coron", "el nido", "panglao", "mactan"
];

const TRAVEL_CATEGORIES = [
  "mountain", "mountains", "beach", "beaches", "waterfall", "falls",
  "historical", "heritage", "museum", "cultural", "festival", "church",
  "temple", "park", "lake", "river", "island", "dive", "snorkel", "hike"
];

const FORBIDDEN_KEYWORDS = [
  "sex", "porn", "violence", "politic", "drugs", "weapon", "crime", "war",
  "killing", "fight", "murder", "gun", "nude", "terror", "death", "suicide",
  "religion", "church", "president", "senator", "election", "vote"
];

const FOREIGN_PLACES = [
  "japan", "tokyo", "osaka", "kyoto", "china", "beijing", "shanghai", "hong kong",
  "singapore", "thailand", "bangkok", "malaysia", "kuala lumpur", "vietnam", "hanoi", "ho chi minh",
  "indonesia", "bali", "jakarta", "korea", "seoul", "busan", "taiwan", "taipei",
  "australia", "sydney", "melbourne", "usa", "america", "new york", "los angeles",
  "canada", "toronto", "vancouver", "uk", "england", "london", "paris", "france",
  "italy", "rome", "venice", "spain", "barcelona", "madrid", "germany", "berlin",
  "dubai", "saudi", "qatar", "india", "mumbai", "delhi", "nepal", "sri lanka",
  "russia", "moscow", "brazil", "mexico", "argentina", "peru", "egypt", "cairo",
  "turkey", "istanbul", "greece", "athens", "switzerland", "zurich", "norway", "finland",
  "sweden", "denmark", "netherlands", "amsterdam"
];

const NON_TRAVEL_TOPICS = [
  "math", "science", "history of", "coding", "python", "ai", "chatgpt", "recipe",
  "movie", "music", "lyrics", "song", "story", "joke", "essay",
  "love", "relationship", "study", "school", "exam", "finance", "stock", "crypto",
  "news", "sports", "basketball", "nba", "football", "tiktok", "facebook", "instagram",
  "youtube", "technology", "programming", "hacking", "politics", "business", "apple", "tv",
  "netflix", "stream", "force"
];

// Reusable matcher for lists
function escapeRegex(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function matchesAnyGlobal(text, list) {
  const t = String(text || '');
  for (const item of list) {
    const pat = new RegExp('\\b' + escapeRegex(item) + '\\b', 'i');
    if (pat.test(t)) return true;
  }
  return false;
}

// --- Simple client-side limits for repeated out-of-scope requests ---
const LIMIT_THRESHOLD = 3; // number of allowed infractions before blocking
let _limitState = { forbidden: 0, foreign: 0, nontravel: 0, blocked: false };

function checkAndIncrementLimit(type) {
  if (_limitState.blocked) return { blocked: true, message: 'You have exceeded the allowed number of out-of-scope requests. Please start a new chat to continue.' };
  if (!['forbidden','foreign','nontravel'].includes(type)) type = 'nontravel';
  _limitState[type] = (_limitState[type] || 0) + 1;
  console.warn('Limit increment', type, _limitState[type]);
  if (_limitState[type] >= LIMIT_THRESHOLD) {
    _limitState.blocked = true;
    return { blocked: true, message: 'You have exceeded the allowed number of out-of-scope requests. Please start a new chat to continue.' };
  }
  // gentle refusal message
  if (type === 'forbidden') return { blocked: false, message: "Sorry, I can't assist with that." };
  return { blocked: false, message: "sorry im only focus on travel planning for philippines only and i cant answer unrelated to that" };
}

function resetLimits() {
  _limitState = { forbidden: 0, foreign: 0, nontravel: 0, blocked: false };
}

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

function parseRequestedLocationAndDays(text) {
  const s = (text || '').toLowerCase();
  let days = null;
  const daysMatch = s.match(/(\b\d{1,2}\b)\s*-?\s*(day|days)\b/);
  if (daysMatch) days = parseInt(daysMatch[1], 10);
  else {
    const words = s.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\b\s*(day|days)/);
    if (words) {
      const map = { one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10 };
      days = map[words[1]] || null;
    }
  }

  let location = null;
  for (const p of PHILIPPINE_PLACES) if (s.indexOf(p) !== -1) { location = p; break; }
  if (!location) {
    const toMatch = s.match(/\b(?:to|in)\s+([a-z\- ]{2,40})\b/);
    if (toMatch) {
      location = toMatch[1].trim().split(/\s+/)[0];
    }
  }
  return { location, days };
}

function responseMatchesRequest(responseText, request) {
  if (!responseText) return false;
  const r = (responseText || '').toLowerCase();
  if (!request) return false;
  const { location, days } = request;
  if (location) {
    if (r.indexOf(location.toLowerCase()) === -1) return false;
  }
  if (days) {
    const pat = new RegExp('\\b' + String(days) + '\\s*-?\\s*(day|days|day)\\b', 'i');
    if (!pat.test(responseText)) {
      const alt = new RegExp(String(days) + '[^\n\d]{0,3}day', 'i');
      if (!alt.test(responseText)) return false;
    }
  }
  return true;
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
  const shouldScrollRef = useRef(true);

  const [chatHistory, setChatHistory] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      fetchUserProfile(user.uid).then(setProfile);
    }
  }, []);

  useEffect(() => {
    if (shouldScrollRef.current && chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const chatsRef = collection(db, 'users', user.uid, 'aiChats');
    const q = query(chatsRef, orderBy('updatedAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setChatHistory(chats);

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
  // Reset client-side out-of-scope limits for the new chat
  try { resetLimits(); } catch (e) { /* ignore */ }
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

  function sanitizeModelResponse(text) {
    if (!text) return text;
    let t = String(text).replace(/\r/g, '').trim();
    t = t.replace(/<[^>]*>/g, '').trim();

    const lines = t.split(/\n+/).map(l => l.trim()).filter(Boolean);
    if (!lines.length) return t;

    const BOILERPLATE_REGEX = /\b(this assistant only|only provides|please ask about|please ask|only assists|this assistant is|this bot only|this model is|for safety reasons|scope:|note:|disclaimer|usage:|usage note)\b/i;

    const filtered = lines.filter(l => {
      if (!l) return false;
      if (/^[-*_]{3,}$/.test(l)) return false;
      if (BOILERPLATE_REGEX.test(l)) return false;
      return true;
    });

    const remaining = filtered.join('\n').trim();
    return remaining || t;
  }

  function extractRawModelText(result) {
    try {
      if (!result && result !== '') return undefined;
      if (typeof result === 'string') return result;

      if (result?.content) return result.content;
      if (result?.text) return result.text;
      if (result?.generated_text) return result.generated_text;

      if (Array.isArray(result.data) && result.data.length > 0) {
        const first = result.data[0];
        if (typeof first === 'string') return first;
        if (Array.isArray(first)) {
          for (let i = first.length - 1; i >= 0; i--) {
            const it = first[i];
            if (!it) continue;
            if (typeof it === 'string') return it;
            if (typeof it === 'object') {
              if (it.content) return it.content;
              if (it.text) return it.text;
              if (it.generated_text) return it.generated_text;
            }
          }
        }
        if (typeof first === 'object') {
          if (first.data) return first.data;
          if (first.content) return first.content;
          if (first.text) return first.text;
        }
      }

      if (Array.isArray(result.outputs) && result.outputs.length) {
        const o = result.outputs[0];
        if (typeof o === 'string') return o;
        if (o && typeof o === 'object') {
          if (o.data) return o.data;
          if (o.text) return o.text;
        }
      }
      if (Array.isArray(result.predictions) && result.predictions.length) {
        const p = result.predictions[0];
        if (typeof p === 'string') return p;
        if (p && typeof p === 'object') {
          if (p.generated_text) return p.generated_text;
          if (p.text) return p.text;
        }
      }

      const scalarFields = ['output','message','answer','reply'];
      for (const f of scalarFields) if (result[f]) return result[f];
    } catch (err) {
      console.warn('extractRawModelText failed', err);
    }
    return undefined;
  }

  async function sendToGradio(messagesPayload) {
    let connectedModel = null;
    try {
      const latest = messagesPayload[messagesPayload.length - 1]?.content || '';
      const lower = String(latest).toLowerCase();

      const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const matchesAny = (text, list) => {
        for (const item of list) {
          const pat = new RegExp('\\b' + escapeRegex(item) + '\\b', 'i');
          if (pat.test(text)) return true;
        }
        return false;
      };

      if (matchesAny(lower, FORBIDDEN_KEYWORDS)) {
        const res = checkAndIncrementLimit('forbidden');
        return res.message;
      }

      const travelIntent = /\b(plan|create|generate|make|itinerary|trip|vacation|days|nights|budget|travel|visit)\b/i.test(latest);
      const mentionsPhil = matchesAny(lower, PHILIPPINE_PLACES);
      const mentionsForeign = matchesAny(lower, FOREIGN_PLACES);
      const mentionsTravelCategory = matchesAny(lower, TRAVEL_CATEGORIES);

      if (matchesAny(lower, NON_TRAVEL_TOPICS) && !travelIntent && !mentionsPhil && !mentionsTravelCategory) {
        const res = checkAndIncrementLimit('nontravel');
        return res.message;
      }

      if (travelIntent && mentionsForeign && !mentionsPhil) {
        const res = checkAndIncrementLimit('foreign');
        return res.message;
      }

      let convo = '';
      for (const m of messagesPayload) {
        const label = m.role === 'user' ? 'User' : 'Assistant';
        convo += `${label}: ${m.content}\n`;
      }

      const systemInstruction = `You are an expert Philippine travel planner. When suggesting places, use destinations from across the entire Philippines — Luzon, Visayas, and Mindanao — and do not limit recommendations to Cebu, Bohol, or Palawan. Provide balanced suggestions from different regions when appropriate.`;

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

      const modelCandidates = ["Chuxia-sys/gemma-lora"];
      let client = null;
      let lastConnectError = null;

      for (const m of modelCandidates) {
        try {
          client = await Client.connect(m);
          connectedModel = m;
          break;
        } catch (err) {
          console.warn('Gradio connect failed for', m, err?.message || err);
          lastConnectError = err;
        }
      }

      if (!client) {
        const msg = 'Error: Could not load model space metadata. Check model name, network/CORS, or that the model is public.';
        console.error(msg, lastConnectError);
        return `${msg} (${lastConnectError?.message || lastConnectError})`;
      }

      // FIX: Use the correct parameter format for the Gradio predict endpoint
      let result = null;
      try {
        // Try the standard predict call with prompt as a positional argument
        result = await client.predict("/predict", [prompt]);
      } catch (err) {
        console.warn('First predict attempt failed:', err?.message || err);
        
        // Try alternative formats
        const attempts = [
          async () => await client.predict("/predict", { prompt: prompt }),
          async () => await client.predict("/predict", { data: [prompt] }),
        ];

        for (const fn of attempts) {
          try {
            result = await fn();
            if (result != null) break;
          } catch (e) {
            console.warn('Alternative predict attempt failed:', e?.message || e);
          }
        }
      }

      console.log(`${connectedModel || 'gemma-lora'} result:`, result);

      const raw = extractRawModelText(result);
      let chosenText = undefined;

      if (typeof raw === 'string' && raw.length > 0) {
        chosenText = raw;
      } else {
        console.warn('No parseable model text found in result', result);
        return 'Debug: Could not parse response. Check console for structure.';
      }

      const latestUser = messagesPayload[messagesPayload.length - 1]?.content || '';
      const req = parseRequestedLocationAndDays(latestUser);
      const ok = responseMatchesRequest(chosenText, req);

      if (!ok && (req.location || req.days)) {
        console.warn('Response did not match request, attempting automatic regeneration', { req, chosenText });
        let regenInstr = `Please ignore your previous answer and rewrite strictly to the user's request.`;
        if (req.days) regenInstr += ` The user asked for a ${req.days}-day trip.`;
        if (req.location) regenInstr += ` The destination must be ${req.location}.`;
        regenInstr += ` Return only the revised itinerary and make it a ${req.days || 'appropriate-length'} trip to ${req.location || 'the requested destination'}. Provide a day-by-day plan, suggested activities, approximate budget estimates, and short travel tips.`;

        const regenPrompt = `${systemInstruction}\n${ragBlock ? ragBlock + '\n\n' : ''}\nUser: ${latestUser}\nAssistant: ${chosenText}\n\nREWRITE: ${regenInstr}`;

        try {
          const regenResult = await client.predict("/predict", [regenPrompt]);
          if (regenResult != null) {
            const raw2 = extractRawModelText(regenResult);
            if (typeof raw2 === 'string' && raw2.length > 0) return raw2;
          }
        } catch (e) {
          console.warn('Regeneration attempt failed', e);
        }
      }

      return sanitizeModelResponse(chosenText);
    } catch (e) {
      console.error(`Gradio (${connectedModel || 'gemma-lora'}) send failed`, e);
      return `Error: ${e?.message || e}`;
    }
  }

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;

    // Quick client-side limits & scope checks before sending to model
    // If blocked globally, return immediate block message
    if (_limitState.blocked) {
      addMessage(text, 'user');
      addMessage('You have exceeded the allowed number of out-of-scope requests. Please start a new chat to continue.', 'assistant');
      setInput('');
      return;
    }

    // Forbidden keywords
    if (matchesAnyGlobal(text, FORBIDDEN_KEYWORDS)) {
      const res = checkAndIncrementLimit('forbidden');
      addMessage(text, 'user');
      addMessage(res.message, 'assistant');
      setInput('');
      return;
    }

    // Non-travel topics (unless travel intent or mentions PH)
    const travelIntent = /\b(plan|create|generate|make|itinerary|trip|vacation|days|nights|budget|travel|visit)\b/i.test(text);
    const mentionsPhil = matchesAnyGlobal(text, PHILIPPINE_PLACES);
    const mentionsTravelCategory = matchesAnyGlobal(text, TRAVEL_CATEGORIES);
    if (matchesAnyGlobal(text, NON_TRAVEL_TOPICS) && !travelIntent && !mentionsPhil && !mentionsTravelCategory) {
      const res = checkAndIncrementLimit('nontravel');
      addMessage(text, 'user');
      addMessage(res.message, 'assistant');
      setInput('');
      return;
    }

    // Travel intent but mentions only foreign places
    const mentionsForeign = matchesAnyGlobal(text, FOREIGN_PLACES);
    if (travelIntent && mentionsForeign && !mentionsPhil) {
      const res = checkAndIncrementLimit('foreign');
      addMessage(text, 'user');
      addMessage(res.message, 'assistant');
      setInput('');
      return;
    }

    // Passed quick checks; proceed to call model
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

  useEffect(() => {
    window.dispatchEvent(new Event('lakbai:open-ai'));
  }, []);

  return (
    <>
      <div className="ai-popup-overlay" onClick={onClose}>
        <div className="ai-card" onClick={e => e.stopPropagation()}>
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