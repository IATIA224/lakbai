// App-wide settings and preferences

// Example: Default settings object
const settings = {
  darkMode: false, // default theme
  pageSize: 200,   // default page size for paginated views
  language: "en",  // default language
  notifications: true // enable/disable notifications
};

// Utility to get a setting
export function getSetting(key) {
  return settings[key];
}

// Utility to update a setting
export function setSetting(key, value) {
  settings[key] = value;
}

// Export the settings object
export default settings;