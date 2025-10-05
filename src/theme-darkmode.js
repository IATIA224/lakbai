import { useEffect, useState } from "react";

// Dark mode theme colors
export const DARK_THEME = {
background: "#18181b",
card: "#23232a",
border: "#27272a",
text: "#e5e7eb",
accent: "#6366f1",
inputBg: "#27272a",
inputText: "#e5e7eb",
badgeBg: "#334155",
badgeFg: "#a3e635",
tableRow: "#23232a",
tableRowAlt: "#18181b",
tableHover: "#1e293b",
headerBg: "linear-gradient(90deg,#0f172a,#1e3a8a)",
headerText: "#fff"
};

// Hook to toggle dark mode and apply theme to <body>
export function useDarkMode() {
const [dark, setDark] = useState(() => {
    // Try to load preference from localStorage
    const stored = localStorage.getItem("darkMode");
    return stored ? stored === "true" : window.matchMedia("(prefers-color-scheme: dark)").matches;
});

useEffect(() => {
    if (dark) {
    document.body.classList.add("dark-mode");
    localStorage.setItem("darkMode", "true");
    } else {
    document.body.classList.remove("dark-mode");
    localStorage.setItem("darkMode", "false");
    }
}, [dark]);

return [dark, setDark];
}

// Utility to get theme colors based on mode
export function getTheme(dark) {
return dark ? DARK_THEME : {};
}

// Example: Add this CSS to your global stylesheet for dark mode
// .dark-mode {
//   background: #18181b;
//   color: #e5e7eb;
// }
// .dark-mode input, .dark-mode select {
//   background: #27272a;
//   color: #e5e7eb;
//   border-color: #27272a;
// }
// .dark-mode .card {
//   background: #23232a;
//   border-color: #27272a;
// }
// .dark-mode .badge {
//   background: #334155;
//   color: #a3e635;
// }