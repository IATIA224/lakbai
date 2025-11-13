import React, { useEffect, useRef, useState } from "react";
import './Ai.css';
import './Styles/ai-modal.css';
import { db, auth } from './firebase';
import { collection, doc, setDoc, serverTimestamp, updateDoc, getDocs, query, orderBy, onSnapshot, addDoc, getDoc } from 'firebase/firestore';
import { addTripForCurrentUser } from './Itinerary';
import { emitAchievement } from './achievementsBus';

const MODEL_API_BASE = (typeof window !== 'undefined' && window.LAKBAI_MODEL_API_BASE) || 'https://chuxia-sys-gemma-tuned.hf.space';


let _csvCache = null;

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
  "math equations", "science experiments", "computer coding", "python programming", "chatgpt",  
  "recipe cooking", "song lyrics", "movie review", "jokes", "essay writing",
  "love advice", "relationship advice", "school homework", "exam help", "stock market",
  "sports scores", "nba games", "football matches", "social media", "computer hacking",
  "politics news", "business finance", "streaming movies", "gaming"
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

function ChatModal({ open, onClose, content, onAddToItinerary, confirmation }) {
  if (!open) return null;
  return (
     <div className="ai-modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
       <div className="ai-modal-content" onClick={(e) => e.stopPropagation()}>
        {confirmation ? (
          <div className="ai-modal-confirmation">
            ✅ {confirmation}
          </div>
        ) : null}
         <button onClick={onClose} className="ai-modal-close" aria-label="Close">×</button>
         <div className="ai-modal-header">
           <span className="ai-modal-icon">✨</span>
           <h3>LakbAI Response</h3>
         </div>
        <div className="ai-modal-body">
          {content}
        </div>
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
  const [modalConfirmation, setModalConfirmation] = useState('');
  const chatRef = useRef(null);
  const shouldScrollRef = useRef(true);

  const [chatHistory, setChatHistory] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [profile, setProfile] = useState(null);

  // Add this near the top of the component, after the state declarations
  const abortControllerRef = useRef(null);

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
    // ADD THIS - Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

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
      setLoading(false); // ADD THIS - Stop the loading state
      resetLimits();
      setModalContent('');
      setModalConfirmation('');
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
      // Log the raw response for debugging
      console.debug('Raw model response:', result);

      // Handle null/undefined
      if (!result && result !== '') {
        console.warn('Received null/undefined response');
        return undefined;
      }

      // Direct string response
      if (typeof result === 'string') {
        return result;
      }

      // Handle array responses (most common for Hugging Face Inference API)
      if (Array.isArray(result)) {
        console.debug('Handling array response');
        // Standard HF format: [{ generated_text: "..." }]
        for (const item of result) {
          if (typeof item === 'string' && item.trim()) {
            return item;
          }
          if (item && typeof item === 'object') {
            // Check for generated_text first (HF standard)
            if (item.generated_text) {
              console.debug('Found generated_text in array item');
              return item.generated_text;
            }
            const extracted = extractRawModelText(item); // Recursive check
            if (extracted) return extracted;
          }
        }
      }

      // Common response fields (direct access)
      const directFields = [
        'response',        // Custom API response field
        'generated_text',  // Hugging Face standard
        'text',
        'content',
        'output',
        'message',
        'answer',
        'reply'
      ];

      for (const field of directFields) {
        if (result[field]) {
          console.debug(`Found direct field: ${field}`);
          return result[field];
        }
      }

      // Common nested structures
      const nestedPaths = [
        ['data', 0],
        ['outputs', 0],
        ['predictions', 0],
        ['results', 0],
        ['choices', 0, 'text'],
        ['choices', 0, 'message', 'content'],
        ['data', 0, 'content'],
        ['data', 0, 'text']
      ];

      for (const path of nestedPaths) {
        let current = result;
        for (const key of path) {
          if (!current) break;
          current = current[key];
        }
        if (current) {
          if (typeof current === 'string') {
            console.debug(`Found nested string at path: ${path.join('.')}`);
            return current;
          }
          if (typeof current === 'object') {
            const extracted = extractRawModelText(current); // Recursive check
            if (extracted) return extracted;
          }
        }
      }

      // Handle streaming response format
      if (result.data && Array.isArray(result.data)) {
        console.debug('Handling streaming response format');
        // Join multiple chunks if they're strings
        const chunks = result.data
          .map(chunk => {
            if (typeof chunk === 'string') return chunk;
            if (chunk && typeof chunk === 'object') {
              return extractRawModelText(chunk);
            }
            return null;
          })
          .filter(Boolean);
        
        if (chunks.length > 0) {
          return chunks.join('');
        }
      }

      // Final fallback: try to extract any string content
      console.warn('No standard fields found, attempting deep string extraction');
      const extractedStrings = [];
      
      function extractStrings(obj, depth = 0) {
        if (depth > 5) return; // Prevent infinite recursion
        if (!obj) return;
        
        if (typeof obj === 'string' && obj.trim()) {
          extractedStrings.push(obj.trim());
        } else if (typeof obj === 'object') {
          for (const key in obj) {
            extractStrings(obj[key], depth + 1);
          }
        } else if (Array.isArray(obj)) {
          obj.forEach(item => extractStrings(item, depth + 1));
        }
      }
      
      extractStrings(result);
      
      if (extractedStrings.length > 0) {
        console.debug('Found strings through deep extraction:', extractedStrings);
        return extractedStrings[0]; // Return the first non-empty string found
      }

    } catch (err) {
      console.error('Error extracting model text:', err);
    }

    console.warn('Could not extract text from model response');
    return undefined;
  }

  /**
   * Main function to send user messages to the AI model API.
   * 
   * Flow:
   * 1. Validates input against scope filters (forbidden keywords, foreign places, non-travel topics)
   * 2. Builds prompt with system instruction, RAG data from CSV, and conversation history
   * 3. Sends request to the model API with retry logic
   * 4. Parses model response and validates it matches user request
   * 5. If mismatch, automatically attempts regeneration with corrected instructions
   * 
   * @param {Array} messagesPayload - Array of {role, content} message objects
   * @returns {Promise<string>} - Model response text or error message
   */
  async function sendToModelAPI(messagesPayload) {
    let usedEndpoint = null;
    try {
      // Create new abort controller for this request
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      const latest = messagesPayload[messagesPayload.length - 1]?.content || '';
      const lower = String(latest).toLowerCase();
      console.debug('Processing input:', latest);

      const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const matchesAny = (text, list) => {
        for (const item of list) {
          const pat = new RegExp('\\b' + escapeRegex(item) + '\\b', 'i');
          if (pat.test(text)) {
            console.debug(`Matched term "${item}" in list:`, list.slice(0, 3).join(', ') + '...');
            return true;
          }
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

      console.debug('Input analysis:', {
        hasTravel: travelIntent,
        mentionsPhilippines: mentionsPhil,
        mentionsForeign: mentionsForeign,
        hasTravelCategory: mentionsTravelCategory
      });

      // If it's clearly about non-travel topics and has no travel indicators
      if (matchesAny(lower, NON_TRAVEL_TOPICS) && 
          !travelIntent && 
          !mentionsPhil && 
          !mentionsTravelCategory &&
          !lower.includes('travel') &&
          !lower.includes('trip') &&
          !lower.includes('tour') &&
          !lower.includes('visit')) {
        console.debug('Rejected: Non-travel topic without travel context');
        const res = checkAndIncrementLimit('nontravel');
        return res.message;
      }

      // If it's specifically about foreign travel without Philippine context
      if (mentionsForeign && !mentionsPhil && 
          (travelIntent || lower.includes('travel') || lower.includes('trip'))) {
        console.debug('Rejected: Foreign travel without Philippine context');
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

      // Build a clean, direct user request (don't include system instruction in the message)
      const userMessage = latest; // Just the user's actual question
      
      const prompt = `${systemInstruction}\n\n${ragBlock ? ragBlock + '\n\n' : ''}\n${convo}Assistant:`;

      // Primary endpoint: /generate (standard Gradio inference endpoint)
      const GENERATE_ENDPOINT = `${MODEL_API_BASE}/generate`;
      
      let result = null;
      const MAX_ATTEMPTS = 3;
      const RETRY_DELAY = 2000;
      let lastError = null;

      // Try the /generate endpoint with retries
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
          console.log(`🔄 Calling ${GENERATE_ENDPOINT} (attempt ${attempt}/${MAX_ATTEMPTS})`);
          console.log(`📝 Sending prompt:`, userMessage);
          
          const response = await fetch(GENERATE_ENDPOINT, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            signal: signal, // ADD THIS LINE
            body: JSON.stringify({
              prompt: userMessage
            })
          });
          
          console.log(`📡 Response status: ${response.status} ${response.statusText}`);
          
          if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            console.error(`❌ Error response: ${errorText}`);
            throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
          }
          
          result = await response.json();
          console.log('✅ API response received:', result);
          usedEndpoint = GENERATE_ENDPOINT;
          break; // Success, exit retry loop
          
        } catch (err) {
          // Check if error is from abort
          if (err.name === 'AbortError') {
            console.log('Request was cancelled');
            setLoading(false);
            return 'Request cancelled.';
          }
          console.error(`❌ Attempt ${attempt} failed:`, err?.message || err);
          lastError = err;
          
          if (attempt < MAX_ATTEMPTS) {
            console.log(`⏳ Retrying in ${RETRY_DELAY}ms...`);
            await new Promise(r => setTimeout(r, RETRY_DELAY));
          }
        }
      }

      if (!result) {
        const errorMsg = `The AI model is currently unavailable. Please try again later.\n\nTechnical details:\n- Endpoint: ${GENERATE_ENDPOINT}\n- Error: ${lastError?.message || 'Connection failed'}\n- Attempts: ${MAX_ATTEMPTS}\n\nPlease check if the Hugging Face Space is running and accessible.`;
        console.error('🚫 All attempts failed:', errorMsg);
        return errorMsg;
      }

      console.log('✅ Successfully received model result:', result);

      const raw = extractRawModelText(result);
      let chosenText = undefined;

      if (typeof raw === 'string' && raw.length > 0) {
        chosenText = raw;
        console.log('✅ Extracted response text:', chosenText.substring(0, 200) + '...');
      } else {
        console.warn('No parseable model text found in result', result);
        return 'Debug: Could not parse response. Check console for structure.';
      }

      // Return the response directly - no regeneration validation
      // This ensures the API's generated answer is always displayed
      return sanitizeModelResponse(chosenText);
    } catch (e) {
      console.error(`Model send failed`, e);
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
    const lower = text.toLowerCase();
    // Only block clear non-travel topics without any travel context
    if (matchesAnyGlobal(text, NON_TRAVEL_TOPICS) && 
        !travelIntent && 
        !mentionsPhil && 
        !mentionsTravelCategory &&
        !lower.includes('travel') &&
        !lower.includes('trip') &&
        !lower.includes('tour') &&
        !lower.includes('visit')) {
      console.debug('Blocked: Non-travel topic without travel context');
      const res = checkAndIncrementLimit('nontravel');
      addMessage(text, 'user');
      addMessage(res.message, 'assistant');
      setInput('');
      return;
    }

    // Only block if specifically about foreign travel
    const mentionsForeign = matchesAnyGlobal(text, FOREIGN_PLACES);
    if (mentionsForeign && !mentionsPhil && 
        (travelIntent || lower.includes('travel') || lower.includes('trip'))) {
      console.debug('Blocked: Foreign travel without Philippine context');
      const res = checkAndIncrementLimit('foreign');
      addMessage(text, 'user');
      addMessage(res.message, 'assistant');
      setInput('');
      return;
    }

    // Passed quick checks; proceed to call model
  // A valid input should reset previous infractions so one refusal doesn't block valid follow-ups
  try { resetLimits(); } catch (e) { /* ignore */ }
  setInput('');
    addMessage(text, 'user');
    setLoading(true);
    const payload = [...messages.map(m => ({ role: m.role, content: m.text })), { role: 'user', content: text }];
    const reply = await sendToModelAPI(payload);
    addMessage(reply, 'assistant');
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
      // Use the app's toast/notification system for consistent UI
      try { emitAchievement('Added to your itinerary. Open My Trips to edit details.'); } catch (e) { console.log('emitAchievement failed', e); }
      // Show confirmation in the AI modal too
      try { setModalConfirmation('Added to your itinerary. Open My Trips to edit details.'); setTimeout(() => setModalConfirmation(''), 4000); } catch (e) {}
    } catch (e) {
      console.error('Add to itinerary failed', e);
      try { emitAchievement('Failed to add to itinerary. Please try again.'); } catch (err) { console.log('emitAchievement failed', err); }
      try { setModalConfirmation('Failed to add to itinerary. Please try again.'); setTimeout(() => setModalConfirmation(''), 4000); } catch (e) {}
    }
  };

  // Add this useEffect to handle page unload/navigation
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        setLoading(false);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

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
              <div className="ai-header-icon">
                <img src="/coconut-tree.png" alt="LakbAI" style={{ width: 48, height: 48, objectFit: 'contain' }} />
              </div>
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
                      : <img src="/coconut-tree.png" alt="LakbAI" style={{ width: 40, height: 40, objectFit: 'contain' }} />}
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
                <div className="ai-message-avatar">
                  <img src="/coconut-tree.png" alt="LakbAI" style={{ width: 40, height: 40, objectFit: 'contain' }} />
                </div>
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
                {loading ? '⏳' : '➤'}
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
        confirmation={modalConfirmation}
      />
    </>
  );
}

export { ChatbaseAI, ChatModal };
export { ChatModal as ChatbaseAIModal };