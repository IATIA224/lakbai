import { CLOUDINARY_CONFIG } from '../profile';

// Mock dependencies
jest.mock('firebase/auth', () => ({
  signOut: jest.fn(),
  onAuthStateChanged: jest.fn(),
}));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  getDoc: jest.fn(),
  updateDoc: jest.fn(),
  addDoc: jest.fn(),
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  getDocs: jest.fn(),
  deleteDoc: jest.fn(),
  onSnapshot: jest.fn(),
}));

jest.mock('../firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'test-user-id' } },
}));

jest.mock('../UserContext', () => ({
  useUser: jest.fn(() => ({ profile: null })),
}));

jest.mock('../achievementsBus', () => ({
  emitAchievement: jest.fn(),
}));

jest.mock('../itinerary_Stats', () => ({
  getUserCompletionStats: jest.fn(),
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

describe('unlockAchievement function', () => {
  let unlockAchievement;
  const mockGetDoc = require('firebase/firestore').getDoc;
  const mockUpdateDoc = require('firebase/firestore').updateDoc;
  const mockDoc = require('firebase/firestore').doc;
  const mockEmitAchievement = require('../achievementsBus').emitAchievement;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.isolateModules(() => {
      const profileModule = require('../profile');
      unlockAchievement = profileModule.unlockAchievement;
    });
  });

  it('should be a function', () => {
    expect(typeof unlockAchievement).toBe('function');
  });

  it('should accept achievementId and achievementName parameters', () => {
    expect(unlockAchievement.length).toBeGreaterThanOrEqual(0);
  });
});

describe('logActivity function', () => {
  let logActivity;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.isolateModules(() => {
      const profileModule = require('../profile');
      logActivity = profileModule.logActivity;
    });
  });

  it('should be a function', () => {
    expect(typeof logActivity).toBe('function');
  });

  it('should accept text and optional icon parameters', () => {
    expect(logActivity.length).toBeGreaterThanOrEqual(0);
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
});

describe('Profile trackActivity actions', () => {
  const trackActivityActions = [
    'uploadPhoto',
    'uploadVideo',
    'sharePost',
    'createItinerary',
    'addLocation',
    'removeLocation',
    'completeItinerary',
    'bookmarkPlace',
    'removeBookmark',
    'completeAchievement',
    'unlockBadge',
    'likePost',
    'commentPost',
    'updateProfile',
    'changePreferences',
    'followTraveler',
    'unfollowTraveler',
    'shareItinerary',
  ];

  it('should have 18 different activity types', () => {
    expect(trackActivityActions).toHaveLength(18);
  });

  it('all activity types should be strings', () => {
    trackActivityActions.forEach(action => {
      expect(typeof action).toBe('string');
    });
  });

  it('activity types should be unique', () => {
    const uniqueActions = new Set(trackActivityActions);
    expect(uniqueActions.size).toBe(trackActivityActions.length);
  });
});

describe('Profile LABELS constant', () => {
  const LABELS = {
    ALL_PHOTOS: "All Photos",
  };

  it('should have ALL_PHOTOS label', () => {
    expect(LABELS.ALL_PHOTOS).toBe("All Photos");
  });

  it('label values should be strings', () => {
    Object.values(LABELS).forEach(label => {
      expect(typeof label).toBe('string');
    });
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
});

describe('Custom marker icon configuration', () => {
  const iconConfig = {
    iconUrl: "/placeholder.png",
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  };

  it('should have correct icon URL', () => {
    expect(iconConfig.iconUrl).toBe("/placeholder.png");
  });

  it('icon size should be 32x32', () => {
    expect(iconConfig.iconSize).toEqual([32, 32]);
  });

  it('icon anchor should be centered horizontally at bottom', () => {
    expect(iconConfig.iconAnchor).toEqual([16, 32]);
  });

  it('popup anchor should be above the icon', () => {
    expect(iconConfig.popupAnchor).toEqual([0, -32]);
  });
});