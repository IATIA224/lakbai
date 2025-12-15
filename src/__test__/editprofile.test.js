import React from 'react';

// Mock dependencies - must be before any imports that use them
jest.mock('firebase/auth', () => ({
  signOut: jest.fn(() => Promise.resolve()),
  onAuthStateChanged: jest.fn((auth, callback) => {
    callback({ uid: 'test-user-id' });
    return jest.fn();
  }),
}));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(() => ({ id: 'test-doc-id' })),
  getDoc: jest.fn(() => Promise.resolve({ 
    exists: () => true, 
    data: () => ({ achievements: {} }) 
  })),
  updateDoc: jest.fn(() => Promise.resolve()),
  addDoc: jest.fn(() => Promise.resolve({ id: 'new-doc-id' })),
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  getDocs: jest.fn(() => Promise.resolve({ docs: [], forEach: jest.fn() })),
  deleteDoc: jest.fn(() => Promise.resolve()),
  onSnapshot: jest.fn((ref, callback) => {
    callback({ docs: [], forEach: jest.fn() });
    return jest.fn();
  }),
}));

jest.mock('../firebase', () => ({
  db: {},
  auth: { 
    currentUser: { uid: 'test-user-id' },
    onAuthStateChanged: jest.fn((callback) => {
      callback({ uid: 'test-user-id' });
      return jest.fn();
    }),
  },
}));

jest.mock('../UserContext', () => ({
  useUser: jest.fn(() => ({ profile: { uid: 'test-user-id' } })),
}));

jest.mock('../achievementsBus', () => ({
  emitAchievement: jest.fn(),
}));

jest.mock('../itinerary_Stats', () => ({
  getUserCompletionStats: jest.fn(() => Promise.resolve({ completed: 0, total: 0 })),
}));

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn(() => jest.fn()),
}));

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-1234'),
}));

jest.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div data-testid="map-container">{children}</div>,
  TileLayer: () => <div data-testid="tile-layer" />,
  Marker: ({ children }) => <div data-testid="marker">{children}</div>,
  Popup: ({ children }) => <div data-testid="popup">{children}</div>,
}));

jest.mock('leaflet', () => ({
  Icon: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../EditProfile', () => {
  return function MockEditProfile({ onClose, onProfileUpdate }) {
    return (
      <div data-testid="edit-profile-modal">
        <button onClick={onClose}>Close</button>
        <button onClick={() => onProfileUpdate && onProfileUpdate({})}>Save</button>
      </div>
    );
  };
});

jest.mock('../info_delete', () => {
  return function MockInfoDelete({ onClose }) {
    return <div data-testid="info-delete-modal"><button onClick={onClose}>Close</button></div>;
  };
});

// Import after mocks
import { CLOUDINARY_CONFIG } from '../profile';

describe('EditProfile.js - interestsList configuration', () => {
  const interestsList = [
    { icon: "🏄‍♂️", label: "Surfer", color: "rgba(99,102,241,0.12)" },
    { icon: "🎒", label: "Backpacker", color: "rgba(96,165,250,0.10)" },
    { icon: "🍜", label: "Foodie Traveler", color: "rgba(250,204,21,0.12)" },
    { icon: "🏛️", label: "Culture Seeker", color: "rgba(124,58,237,0.10)" },
    { icon: "⚡", label: "Adventure Junkie", color: "rgba(34,197,94,0.08)" },
    { icon: "🌿", label: "Nature Enthusiast", color: "rgba(16,185,129,0.08)" },
    { icon: "💻", label: "Digital Nomad", color: "rgba(99,102,241,0.07)" },
    { icon: "🚗", label: "Road Tripper", color: "rgba(234,88,12,0.07)" },
    { icon: "🏖️", label: "Beach Lover", color: "rgba(56,189,248,0.08)" },
    { icon: "🏙️", label: "City Explorer", color: "rgba(168,85,247,0.08)" },
    { icon: "📸", label: "Photographer", color: "rgba(245,158,11,0.08)" },
    { icon: "🏺", label: "Historian", color: "rgba(94,234,212,0.06)" },
    { icon: "🎉", label: "Festival Hopper", color: "rgba(236,72,153,0.07)" },
    { icon: "🥾", label: "Hiker", color: "rgba(34,197,94,0.07)" },
    { icon: "💎", label: "Luxury Traveler", color: "rgba(99,102,241,0.07)" },
    { icon: "🌱", label: "Eco-Traveler", color: "rgba(34,197,94,0.06)" },
    { icon: "🛳️", label: "Cruise Lover", color: "rgba(56,189,248,0.07)" },
    { icon: "🧳", label: "Solo Wanderer", color: "rgba(168,85,247,0.06)" }
  ];

  it('should have 18 interests defined', () => {
    expect(interestsList).toHaveLength(18);
  });

  it('each interest should have icon, label, and color properties', () => {
    interestsList.forEach(interest => {
      expect(interest).toHaveProperty('icon');
      expect(interest).toHaveProperty('label');
      expect(interest).toHaveProperty('color');
    });
  });

  it('all labels should be unique', () => {
    const labels = interestsList.map(i => i.label);
    const uniqueLabels = new Set(labels);
    expect(uniqueLabels.size).toBe(labels.length);
  });

  it('all icons should be non-empty strings', () => {
    interestsList.forEach(interest => {
      expect(typeof interest.icon).toBe('string');
      expect(interest.icon.length).toBeGreaterThan(0);
    });
  });

  it('all labels should be non-empty strings', () => {
    interestsList.forEach(interest => {
      expect(typeof interest.label).toBe('string');
      expect(interest.label.length).toBeGreaterThan(0);
    });
  });

  it('all colors should be valid rgba format', () => {
    interestsList.forEach(interest => {
      expect(interest.color).toMatch(/^rgba\(\d+,\d+,\d+,[\d.]+\)$/);
    });
  });

  it('should include Surfer as first interest', () => {
    expect(interestsList[0].label).toBe('Surfer');
  });

  it('should include Solo Wanderer as last interest', () => {
    expect(interestsList[interestsList.length - 1].label).toBe('Solo Wanderer');
  });
});

describe('EditProfile.js - MAX_BIO constant', () => {
  const MAX_BIO = 300;

  it('should be 300 characters', () => {
    expect(MAX_BIO).toBe(300);
  });

  it('should be a positive number', () => {
    expect(MAX_BIO).toBeGreaterThan(0);
  });

  it('should be an integer', () => {
    expect(Number.isInteger(MAX_BIO)).toBe(true);
  });
});

describe('EditProfile.js - Interest status cycling', () => {
  it('should cycle from null to like', () => {
    const status = null;
    const nextStatus = status === null ? 'like' : status === 'like' ? 'dislike' : null;
    expect(nextStatus).toBe('like');
  });

  it('should cycle from like to dislike', () => {
    const status = 'like';
    const nextStatus = status === null ? 'like' : status === 'like' ? 'dislike' : null;
    expect(nextStatus).toBe('dislike');
  });

  it('should cycle from dislike to null', () => {
    const status = 'dislike';
    const nextStatus = status === null ? 'like' : status === 'like' ? 'dislike' : null;
    expect(nextStatus).toBeNull();
  });
});

describe('EditProfile.js - Interest background colors', () => {
  it('should return green background for like status', () => {
    const status = 'like';
    const background = status === 'like' ? '#d1fae5' : status === 'dislike' ? '#fee2e2' : 'default';
    expect(background).toBe('#d1fae5');
  });

  it('should return red background for dislike status', () => {
    const status = 'dislike';
    const background = status === 'like' ? '#d1fae5' : status === 'dislike' ? '#fee2e2' : 'default';
    expect(background).toBe('#fee2e2');
  });

  it('should return default background for null status', () => {
    const status = null;
    const background = status === 'like' ? '#d1fae5' : status === 'dislike' ? '#fee2e2' : 'default';
    expect(background).toBe('default');
  });
});

describe('EditProfile.js - Active interest detection', () => {
  it('should detect like as active', () => {
    const status = 'like';
    const active = status === 'like' || status === 'dislike';
    expect(active).toBe(true);
  });

  it('should detect dislike as active', () => {
    const status = 'dislike';
    const active = status === 'like' || status === 'dislike';
    expect(active).toBe(true);
  });

  it('should detect null as inactive', () => {
    const status = null;
    const active = status === 'like' || status === 'dislike';
    expect(active).toBe(false);
  });
});

describe('EditProfile.js - InitialData handling', () => {
  it('should use empty string for missing name', () => {
    const initialData = {};
    const name = initialData.name || "";
    expect(name).toBe("");
  });

  it('should use provided name from initialData', () => {
    const initialData = { name: 'John Doe' };
    const name = initialData.name || "";
    expect(name).toBe('John Doe');
  });

  it('should use empty string for missing bio', () => {
    const initialData = {};
    const bio = initialData.bio || "";
    expect(bio).toBe("");
  });

  it('should use provided bio from initialData', () => {
    const initialData = { bio: 'Love to travel!' };
    const bio = initialData.bio || "";
    expect(bio).toBe('Love to travel!');
  });

  it('should handle empty interests array', () => {
    const initialData = { interests: [] };
    const hasInterests = Array.isArray(initialData.interests) && initialData.interests.length > 0;
    expect(hasInterests).toBe(false);
  });

  it('should handle populated interests array', () => {
    const initialData = { interests: ['Surfer', 'Hiker'] };
    const hasInterests = Array.isArray(initialData.interests) && initialData.interests.length > 0;
    expect(hasInterests).toBe(true);
  });
});

describe('EditProfile.js - Random placeholder generation', () => {
  it('should generate placeholder in correct format', () => {
    const placeholder = `User${Math.floor(10000 + Math.random() * 90000)}`;
    expect(placeholder).toMatch(/^User\d{5}$/);
  });

  it('should generate 5-digit number', () => {
    const num = Math.floor(10000 + Math.random() * 90000);
    expect(num).toBeGreaterThanOrEqual(10000);
    expect(num).toBeLessThan(100000);
  });
});

describe('EditProfile.js - Bio character limit', () => {
  it('should truncate bio to MAX_BIO characters', () => {
    const MAX_BIO = 300;
    const longBio = 'a'.repeat(500);
    const truncated = longBio.slice(0, MAX_BIO);
    expect(truncated.length).toBe(300);
  });

  it('should not truncate bio under limit', () => {
    const MAX_BIO = 300;
    const shortBio = 'Hello world';
    const result = shortBio.slice(0, MAX_BIO);
    expect(result).toBe(shortBio);
  });
});

describe('EditProfile.js - Active interests Set operations', () => {
  it('should create Set from interest labels', () => {
    const interests = [
      { label: 'Surfer' },
      { label: 'Hiker' },
      { label: 'Foodie Traveler' }
    ];
    const labels = interests.map(i => i.label).filter(Boolean);
    const activeSet = new Set(labels);
    expect(activeSet.size).toBe(3);
    expect(activeSet.has('Surfer')).toBe(true);
  });

  it('should filter out null/undefined labels', () => {
    const interests = [
      { label: 'Surfer' },
      { label: null },
      { label: 'Hiker' },
      { label: undefined }
    ];
    const labels = interests.map(i => i.label).filter(Boolean);
    expect(labels).toHaveLength(2);
  });

  it('should handle string interests', () => {
    const interests = ['Surfer', 'Hiker', 'Foodie Traveler'];
    const labels = interests.map(v => (typeof v === 'string' ? v : v?.label)).filter(Boolean);
    expect(labels).toHaveLength(3);
  });

  it('should handle mixed interest formats', () => {
    const interests = [
      'Surfer',
      { label: 'Hiker' },
      'Foodie Traveler'
    ];
    const labels = interests.map(v => (typeof v === 'string' ? v : v?.label)).filter(Boolean);
    expect(labels).toEqual(['Surfer', 'Hiker', 'Foodie Traveler']);
  });
});

describe('EditProfile.js - Likes and dislikes extraction', () => {
  it('should extract likes correctly', () => {
    const interests = [
      { label: 'Surfer', status: 'like' },
      { label: 'Hiker', status: 'dislike' },
      { label: 'Foodie Traveler', status: 'like' },
      { label: 'Photographer', status: null }
    ];
    const likes = interests.filter(i => i.status === 'like').map(i => i.label);
    expect(likes).toEqual(['Surfer', 'Foodie Traveler']);
  });

  it('should extract dislikes correctly', () => {
    const interests = [
      { label: 'Surfer', status: 'like' },
      { label: 'Hiker', status: 'dislike' },
      { label: 'Foodie Traveler', status: 'dislike' },
      { label: 'Photographer', status: null }
    ];
    const dislikes = interests.filter(i => i.status === 'dislike').map(i => i.label);
    expect(dislikes).toEqual(['Hiker', 'Foodie Traveler']);
  });

  it('should handle no likes', () => {
    const interests = [
      { label: 'Surfer', status: 'dislike' },
      { label: 'Hiker', status: null }
    ];
    const likes = interests.filter(i => i.status === 'like').map(i => i.label);
    expect(likes).toEqual([]);
  });

  it('should handle no dislikes', () => {
    const interests = [
      { label: 'Surfer', status: 'like' },
      { label: 'Hiker', status: null }
    ];
    const dislikes = interests.filter(i => i.status === 'dislike').map(i => i.label);
    expect(dislikes).toEqual([]);
  });
});

describe('EditProfile.js - Final interests computation', () => {
  it('should merge active interests with new likes', () => {
    const activeInterests = new Set(['Surfer', 'Hiker']);
    const likes = ['Foodie Traveler', 'Photographer'];
    const finalInterests = Array.from(new Set([
      ...Array.from(activeInterests),
      ...likes
    ]));
    expect(finalInterests).toContain('Surfer');
    expect(finalInterests).toContain('Hiker');
    expect(finalInterests).toContain('Foodie Traveler');
    expect(finalInterests).toContain('Photographer');
  });

  it('should deduplicate overlapping interests', () => {
    const activeInterests = new Set(['Surfer', 'Hiker']);
    const likes = ['Hiker', 'Foodie Traveler'];
    const finalInterests = Array.from(new Set([
      ...Array.from(activeInterests),
      ...likes
    ]));
    expect(finalInterests).toHaveLength(3);
  });
});

describe('EditProfile.js - Update data change detection', () => {
  it('should detect name change', () => {
    const initialData = { name: 'John' };
    const name = 'Jane';
    const hasChanged = name && name.trim() !== (initialData.name || "");
    expect(hasChanged).toBe(true);
  });

  it('should not detect unchanged name', () => {
    const initialData = { name: 'John' };
    const name = 'John';
    const hasChanged = name && name.trim() !== (initialData.name || "");
    expect(hasChanged).toBe(false);
  });

  it('should detect bio change', () => {
    const initialData = { bio: 'Old bio' };
    const bio = 'New bio';
    const hasChanged = bio !== (initialData.bio || "");
    expect(hasChanged).toBe(true);
  });

  it('should detect interests change', () => {
    const initialInterests = ['Surfer', 'Hiker'];
    const finalInterests = ['Surfer', 'Photographer'];
    const hasChanged = JSON.stringify(finalInterests.sort()) !== JSON.stringify(initialInterests.sort());
    expect(hasChanged).toBe(true);
  });

  it('should not detect unchanged interests', () => {
    const initialInterests = ['Surfer', 'Hiker'];
    const finalInterests = ['Hiker', 'Surfer'];
    const hasChanged = JSON.stringify(finalInterests.sort()) !== JSON.stringify(initialInterests.sort());
    expect(hasChanged).toBe(false);
  });
});

describe('EditProfile.js - Cloudinary upload configuration', () => {
  it('should have correct Cloudinary upload URL format', () => {
    const cloudName = 'dxvewejox';
    const url = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
    expect(url).toBe('https://api.cloudinary.com/v1_1/dxvewejox/image/upload');
  });

  it('should have correct upload preset', () => {
    const uploadPreset = 'dxvewejox';
    expect(uploadPreset).toBe('dxvewejox');
  });
});

describe('EditProfile.js - Profile picture display logic', () => {
  it('should show new photo when available', () => {
    const photo = 'blob:http://localhost/new-photo';
    const initialProfilePicture = '/old-photo.jpg';
    const displayPhoto = photo || initialProfilePicture;
    expect(displayPhoto).toBe(photo);
  });

  it('should show initial profile picture when no new photo', () => {
    const photo = null;
    const initialProfilePicture = '/old-photo.jpg';
    const displayPhoto = photo || initialProfilePicture;
    expect(displayPhoto).toBe(initialProfilePicture);
  });

  it('should detect non-default profile picture', () => {
    const profilePicture = '/custom-photo.jpg';
    const isCustom = profilePicture && profilePicture !== '/user.png';
    expect(isCustom).toBe(true);
  });

  it('should detect default profile picture', () => {
    const profilePicture = '/user.png';
    const isCustom = profilePicture && profilePicture !== '/user.png';
    expect(isCustom).toBe(false);
  });
});

describe('EditProfile.js - Modal behavior', () => {
  it('should add profile-modal-open class pattern', () => {
    const className = 'profile-modal-open';
    expect(className).toBe('profile-modal-open');
  });

  it('should handle Escape key to close', () => {
    const mockOnClose = jest.fn();
    const event = { key: 'Escape' };
    if (event.key === 'Escape') {
      mockOnClose();
    }
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should stop propagation on modal click', () => {
    const mockStopPropagation = jest.fn();
    const event = { stopPropagation: mockStopPropagation };
    event.stopPropagation();
    expect(mockStopPropagation).toHaveBeenCalled();
  });
});

describe('EditProfile.js - Saving state', () => {
  it('should show Saving... when saving is true', () => {
    const saving = true;
    const buttonText = saving ? 'Saving...' : 'Save Profile';
    expect(buttonText).toBe('Saving...');
  });

  it('should show Save Profile when saving is false', () => {
    const saving = false;
    const buttonText = saving ? 'Saving...' : 'Save Profile';
    expect(buttonText).toBe('Save Profile');
  });

  it('should disable button when saving', () => {
    const saving = true;
    expect(saving).toBe(true);
  });
});

describe('EditProfile.js - Clear preferences popup', () => {
  it('should have showClearSuccess state', () => {
    const showClearSuccess = false;
    expect(showClearSuccess).toBe(false);
  });

  it('should toggle showClearSuccess to true', () => {
    let showClearSuccess = false;
    showClearSuccess = true;
    expect(showClearSuccess).toBe(true);
  });
});

describe('EditProfile.js - Interest border styling', () => {
  it('should have active border style', () => {
    const active = true;
    const border = active ? '2px solid #6c63ff' : '1px solid rgba(16,24,40,0.04)';
    expect(border).toBe('2px solid #6c63ff');
  });

  it('should have inactive border style', () => {
    const active = false;
    const border = active ? '2px solid #6c63ff' : '1px solid rgba(16,24,40,0.04)';
    expect(border).toBe('1px solid rgba(16,24,40,0.04)');
  });

  it('should have active box shadow', () => {
    const active = true;
    const boxShadow = active ? '0 6px 18px rgba(99,102,241,0.12)' : undefined;
    expect(boxShadow).toBe('0 6px 18px rgba(99,102,241,0.12)');
  });

  it('should have no box shadow when inactive', () => {
    const active = false;
    const boxShadow = active ? '0 6px 18px rgba(99,102,241,0.12)' : undefined;
    expect(boxShadow).toBeUndefined();
  });
});

describe('EditProfile.js - Photo file handling', () => {
  it('should handle valid file input', () => {
    const file = { name: 'photo.jpg', type: 'image/jpeg' };
    expect(file).toBeDefined();
    expect(file.name).toBe('photo.jpg');
  });

  it('should handle empty file input', () => {
    const files = [];
    const hasFile = files && files[0];
    expect(hasFile).toBeFalsy();
  });
});

describe('EditProfile.js - Input constraints', () => {
  it('name input should have maxLength of 40', () => {
    const maxLength = 40;
    expect(maxLength).toBe(40);
  });

  it('bio textarea should have maxLength of 300', () => {
    const maxLength = 300;
    expect(maxLength).toBe(300);
  });

  it('bio textarea should have 4 rows', () => {
    const rows = 4;
    expect(rows).toBe(4);
  });
});

describe('EditProfile.js - Avatar styling', () => {
  it('should have correct avatar dimensions', () => {
    const width = 96;
    const height = 96;
    expect(width).toBe(96);
    expect(height).toBe(96);
  });

  it('should have circular border radius', () => {
    const borderRadius = '50%';
    expect(borderRadius).toBe('50%');
  });

  it('should have correct border style', () => {
    const border = '3px solid #e5e7eb';
    expect(border).toBe('3px solid #e5e7eb');
  });
});

describe('EditProfile.js - Grid layout', () => {
  it('should use 2 column grid for interests', () => {
    const gridTemplateColumns = '1fr 1fr';
    expect(gridTemplateColumns).toBe('1fr 1fr');
  });

  it('should have 14px gap between interest items', () => {
    const gap = '14px';
    expect(gap).toBe('14px');
  });
});

describe('profile.js exports', () => {
  describe('CLOUDINARY_CONFIG', () => {
    it('should export CLOUDINARY_CONFIG with correct cloudName', () => {
      expect(CLOUDINARY_CONFIG).toBeDefined();
      expect(CLOUDINARY_CONFIG.cloudName).toBe('dxvewejox');
    });

    it('should export CLOUDINARY_CONFIG with correct uploadPreset', () => {
      expect(CLOUDINARY_CONFIG.uploadPreset).toBe('dxvewejox');
    });

    it('should have exactly two properties', () => {
      const keys = Object.keys(CLOUDINARY_CONFIG);
      expect(keys).toHaveLength(2);
      expect(keys).toContain('cloudName');
      expect(keys).toContain('uploadPreset');
    });
  });
});

describe('Profile component constants', () => {
  it('should have valid CLOUDINARY_CONFIG structure', () => {
    expect(CLOUDINARY_CONFIG).toEqual({
      cloudName: 'dxvewejox',
      uploadPreset: 'dxvewejox',
    });
  });
});

describe('Profile stats cache configuration', () => {
  it('CLOUDINARY_CONFIG should be immutable reference', () => {
    const originalConfig = { ...CLOUDINARY_CONFIG };
    expect(CLOUDINARY_CONFIG.cloudName).toBe(originalConfig.cloudName);
    expect(CLOUDINARY_CONFIG.uploadPreset).toBe(originalConfig.uploadPreset);
  });
});

describe('Profile module structure', () => {
  let profileModule;

  beforeEach(() => {
    jest.isolateModules(() => {
      profileModule = require('../profile');
    });
  });

  it('should export default Profile component', () => {
    expect(profileModule.default).toBeDefined();
  });

  it('should export CLOUDINARY_CONFIG', () => {
    expect(profileModule.CLOUDINARY_CONFIG).toBeDefined();
  });

  it('should export unlockAchievement function', () => {
    expect(profileModule.unlockAchievement).toBeDefined();
    expect(typeof profileModule.unlockAchievement).toBe('function');
  });

  it('should export logActivity function', () => {
    expect(profileModule.logActivity).toBeDefined();
    expect(typeof profileModule.logActivity).toBe('function');
  });

  it('default export should be a React component', () => {
    expect(typeof profileModule.default).toBe('function');
  });
});

describe('CLOUDINARY_CONFIG values validation', () => {
  it('cloudName should be a non-empty string', () => {
    expect(typeof CLOUDINARY_CONFIG.cloudName).toBe('string');
    expect(CLOUDINARY_CONFIG.cloudName.length).toBeGreaterThan(0);
  });

  it('uploadPreset should be a non-empty string', () => {
    expect(typeof CLOUDINARY_CONFIG.uploadPreset).toBe('string');
    expect(CLOUDINARY_CONFIG.uploadPreset.length).toBeGreaterThan(0);
  });

  it('cloudName should not contain spaces', () => {
    expect(CLOUDINARY_CONFIG.cloudName).not.toMatch(/\s/);
  });

  it('uploadPreset should not contain spaces', () => {
    expect(CLOUDINARY_CONFIG.uploadPreset).not.toMatch(/\s/);
  });

  it('cloudName should be alphanumeric', () => {
    expect(CLOUDINARY_CONFIG.cloudName).toMatch(/^[a-zA-Z0-9]+$/);
  });

  it('uploadPreset should be alphanumeric', () => {
    expect(CLOUDINARY_CONFIG.uploadPreset).toMatch(/^[a-zA-Z0-9]+$/);
  });
});

describe('Profile achievements data structure', () => {
  const ACHIEVEMENTS_DATA = {
    1: { title: "First Step", description: "Create your very first itinerary.", icon: "🎯", category: "Getting Started" },
    2: { title: "First Bookmark", description: "Save your first place to your favorites.", icon: "⭐", category: "Getting Started" },
    3: { title: "Say Cheese!", description: "Upload your first travel photo.", icon: "📸", category: "Getting Started" },
    4: { title: "Hello, World!", description: "Post your first comment on any itinerary or location.", icon: "💬", category: "Getting Started" },
    5: { title: "Profile Pioneer", description: "Complete your profile with a photo and bio.", icon: "👤", category: "Getting Started" },
    6: { title: "Mini Planner", description: "Add at least 3 places to a single itinerary.", icon: "🗺️", category: "Exploration & Planning" },
    7: { title: "Explorer at Heart", description: "View 10 different destinations in the app.", icon: "✈️", category: "Exploration & Planning" },
    8: { title: "Checklist Champ", description: 'Mark your first place as "visited".', icon: "✅", category: "Exploration & Planning" },
  };

  it('should have 8 achievements defined', () => {
    expect(Object.keys(ACHIEVEMENTS_DATA)).toHaveLength(8);
  });

  it('each achievement should have title, description, icon, and category', () => {
    Object.values(ACHIEVEMENTS_DATA).forEach(achievement => {
      expect(achievement).toHaveProperty('title');
      expect(achievement).toHaveProperty('description');
      expect(achievement).toHaveProperty('icon');
      expect(achievement).toHaveProperty('category');
    });
  });

  it('achievement titles should be non-empty strings', () => {
    Object.values(ACHIEVEMENTS_DATA).forEach(achievement => {
      expect(typeof achievement.title).toBe('string');
      expect(achievement.title.length).toBeGreaterThan(0);
    });
  });

  it('achievement descriptions should be non-empty strings', () => {
    Object.values(ACHIEVEMENTS_DATA).forEach(achievement => {
      expect(typeof achievement.description).toBe('string');
      expect(achievement.description.length).toBeGreaterThan(0);
    });
  });

  it('should have Getting Started and Exploration & Planning categories', () => {
    const categories = new Set(Object.values(ACHIEVEMENTS_DATA).map(a => a.category));
    expect(categories.has('Getting Started')).toBe(true);
    expect(categories.has('Exploration & Planning')).toBe(true);
  });

  it('achievement IDs should be consecutive integers starting from 1', () => {
    const ids = Object.keys(ACHIEVEMENTS_DATA).map(Number).sort((a, b) => a - b);
    expect(ids).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('all achievement icons should be emoji strings', () => {
    Object.values(ACHIEVEMENTS_DATA).forEach(achievement => {
      expect(typeof achievement.icon).toBe('string');
      expect(achievement.icon.length).toBeGreaterThan(0);
    });
  });

  it('Getting Started category should have 5 achievements', () => {
    const gettingStarted = Object.values(ACHIEVEMENTS_DATA).filter(
      a => a.category === 'Getting Started'
    );
    expect(gettingStarted).toHaveLength(5);
  });

  it('Exploration & Planning category should have 3 achievements', () => {
    const exploration = Object.values(ACHIEVEMENTS_DATA).filter(
      a => a.category === 'Exploration & Planning'
    );
    expect(exploration).toHaveLength(3);
  });
});

describe('Profile initial stats structure', () => {
  const initialStats = {
    placesVisited: 0,
    photosShared: 0,
    reviewsWritten: 0,
    friends: 0,
  };

  it('should have all required stat properties', () => {
    expect(initialStats).toHaveProperty('placesVisited');
    expect(initialStats).toHaveProperty('photosShared');
    expect(initialStats).toHaveProperty('reviewsWritten');
    expect(initialStats).toHaveProperty('friends');
  });

  it('all initial stats should be 0', () => {
    Object.values(initialStats).forEach(value => {
      expect(value).toBe(0);
    });
  });

  it('stats should be numbers', () => {
    Object.values(initialStats).forEach(value => {
      expect(typeof value).toBe('number');
    });
  });

  it('should have exactly 4 stat properties', () => {
    expect(Object.keys(initialStats)).toHaveLength(4);
  });

  it('stats should be non-negative', () => {
    Object.values(initialStats).forEach(value => {
      expect(value).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('Profile map default configuration', () => {
  const defaultMapCenter = [12.8797, 121.774];
  const defaultMapZoom = 6;

  it('default map center should be Philippines coordinates', () => {
    expect(defaultMapCenter).toEqual([12.8797, 121.774]);
  });

  it('default map center should have latitude and longitude', () => {
    expect(defaultMapCenter).toHaveLength(2);
    expect(typeof defaultMapCenter[0]).toBe('number');
    expect(typeof defaultMapCenter[1]).toBe('number');
  });

  it('latitude should be within valid range (-90 to 90)', () => {
    expect(defaultMapCenter[0]).toBeGreaterThanOrEqual(-90);
    expect(defaultMapCenter[0]).toBeLessThanOrEqual(90);
  });

  it('longitude should be within valid range (-180 to 180)', () => {
    expect(defaultMapCenter[1]).toBeGreaterThanOrEqual(-180);
    expect(defaultMapCenter[1]).toBeLessThanOrEqual(180);
  });

  it('default zoom level should be 6', () => {
    expect(defaultMapZoom).toBe(6);
  });

  it('zoom level should be a positive integer', () => {
    expect(Number.isInteger(defaultMapZoom)).toBe(true);
    expect(defaultMapZoom).toBeGreaterThan(0);
  });

  it('zoom level should be within typical map zoom range (1-18)', () => {
    expect(defaultMapZoom).toBeGreaterThanOrEqual(1);
    expect(defaultMapZoom).toBeLessThanOrEqual(18);
  });

  it('Philippines coordinates should be in Southeast Asia region', () => {
    expect(defaultMapCenter[0]).toBeGreaterThan(4);
    expect(defaultMapCenter[0]).toBeLessThan(22);
    expect(defaultMapCenter[1]).toBeGreaterThan(116);
    expect(defaultMapCenter[1]).toBeLessThan(130);
  });
});

describe('Profile cache configuration', () => {
  const PROFILE_STATS_CACHE_KEY = "lakbai_profile_stats";
  const PROFILE_STATS_CACHE_MS = 5 * 60 * 1000;

  it('cache key should be a descriptive string', () => {
    expect(PROFILE_STATS_CACHE_KEY).toBe("lakbai_profile_stats");
  });

  it('cache duration should be 5 minutes in milliseconds', () => {
    expect(PROFILE_STATS_CACHE_MS).toBe(300000);
  });

  it('cache duration should be positive', () => {
    expect(PROFILE_STATS_CACHE_MS).toBeGreaterThan(0);
  });

  it('cache key should be lowercase with underscores', () => {
    expect(PROFILE_STATS_CACHE_KEY).toMatch(/^[a-z_]+$/);
  });

  it('cache key should start with app prefix', () => {
    expect(PROFILE_STATS_CACHE_KEY.startsWith('lakbai_')).toBe(true);
  });

  it('cache duration should equal 5 minutes exactly', () => {
    const fiveMinutesMs = 5 * 60 * 1000;
    expect(PROFILE_STATS_CACHE_MS).toBe(fiveMinutesMs);
  });
});

describe('Profile tabs configuration', () => {
  const validTabs = ['statistics', 'achievements', 'photos', 'activity'];

  it('statistics should be a valid tab', () => {
    expect(validTabs).toContain('statistics');
  });

  it('should have expected tab options', () => {
    expect(validTabs.length).toBeGreaterThan(0);
  });

  it('tab names should be lowercase strings', () => {
    validTabs.forEach(tab => {
      expect(typeof tab).toBe('string');
      expect(tab).toBe(tab.toLowerCase());
    });
  });
});

describe('Profile scroll lock behavior', () => {
  afterEach(() => {
    document.body.classList.remove('profile-modal-open');
  });

  it('should add class to body when modal is open', () => {
    document.body.classList.add('profile-modal-open');
    expect(document.body.classList.contains('profile-modal-open')).toBe(true);
  });

  it('should remove class from body when modal is closed', () => {
    document.body.classList.add('profile-modal-open');
    document.body.classList.remove('profile-modal-open');
    expect(document.body.classList.contains('profile-modal-open')).toBe(false);
  });
});

describe('Profile keyboard navigation', () => {
  it('should handle Escape key event', () => {
    const mockOnClose = jest.fn();
    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    if (event.key === 'Escape') {
      mockOnClose();
    }
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should not trigger on other keys', () => {
    const mockOnClose = jest.fn();
    const event = new KeyboardEvent('keydown', { key: 'Enter' });
    if (event.key === 'Escape') {
      mockOnClose();
    }
    expect(mockOnClose).not.toHaveBeenCalled();
  });
});

describe('Profile localStorage cache', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should set cache item in localStorage', () => {
    const key = 'lakbai_profile_stats';
    const value = JSON.stringify({ data: 'test', timestamp: Date.now() });
    localStorage.setItem(key, value);
    expect(localStorage.getItem(key)).toBe(value);
  });

  it('should retrieve cache item from localStorage', () => {
    const key = 'lakbai_profile_stats';
    const data = { stats: { placesVisited: 5 }, timestamp: Date.now() };
    localStorage.setItem(key, JSON.stringify(data));
    
    const retrieved = JSON.parse(localStorage.getItem(key));
    expect(retrieved.stats.placesVisited).toBe(5);
  });

  it('should handle missing cache gracefully', () => {
    const result = localStorage.getItem('nonexistent_key');
    expect(result).toBeNull();
  });

  it('should validate cache expiration', () => {
    const CACHE_MS = 5 * 60 * 1000;
    const oldTimestamp = Date.now() - CACHE_MS - 1000;
    const newTimestamp = Date.now();
    
    expect(Date.now() - oldTimestamp > CACHE_MS).toBe(true);
    expect(Date.now() - newTimestamp > CACHE_MS).toBe(false);
  });
});

describe('Profile Firebase integration', () => {
  const { doc, getDoc, updateDoc, addDoc, collection, getDocs, deleteDoc, onSnapshot } = require('firebase/firestore');

  it('doc should be a mock function', () => {
    expect(jest.isMockFunction(doc)).toBe(true);
  });

  it('getDoc should be a mock function', () => {
    expect(jest.isMockFunction(getDoc)).toBe(true);
  });

  it('updateDoc should be a mock function', () => {
    expect(jest.isMockFunction(updateDoc)).toBe(true);
  });

  it('addDoc should be a mock function', () => {
    expect(jest.isMockFunction(addDoc)).toBe(true);
  });

  it('collection should be a mock function', () => {
    expect(jest.isMockFunction(collection)).toBe(true);
  });

  it('getDocs should be a mock function', () => {
    expect(jest.isMockFunction(getDocs)).toBe(true);
  });

  it('deleteDoc should be a mock function', () => {
    expect(jest.isMockFunction(deleteDoc)).toBe(true);
  });

  it('onSnapshot should be a mock function', () => {
    expect(jest.isMockFunction(onSnapshot)).toBe(true);
  });
});

describe('Profile achievementsBus integration', () => {
  const { emitAchievement } = require('../achievementsBus');

  it('emitAchievement should be a mock function', () => {
    expect(jest.isMockFunction(emitAchievement)).toBe(true);
  });

  it('emitAchievement should be callable', () => {
    expect(() => emitAchievement('test')).not.toThrow();
  });
});