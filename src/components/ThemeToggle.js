import React from "react";
import { useDarkMode } from "../theme-darkmode";
import { setSetting } from "../settings";

// Simple toggle switch for dark/light mode
export default function ThemeToggle() {
const [dark, setDark] = useDarkMode();

const handleToggle = () => {
setDark(!dark);
setSetting("darkMode", !dark);
};

return (
<label style={{
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 15,
    color: dark ? "#e5e7eb" : "#334155"
}}>
    <span>{dark ? "Dark Mode" : "Light Mode"}</span>
    <span style={{
    width: 44,
    height: 24,
    borderRadius: 12,
    background: dark ? "#334155" : "#e5e7eb",
    display: "inline-flex",
    alignItems: "center",
    position: "relative",
    transition: "background .2s"
    }}>
    <input
        type="checkbox"
        checked={dark}
        onChange={handleToggle}
        style={{
        width: "100%",
        height: "100%",
        opacity: 0,
        position: "absolute",
        left: 0,
        top: 0,
        cursor: "pointer"
        }}
    />
    <span style={{
        position: "absolute",
        left: dark ? 22 : 4,
        top: 4,
        width: 16,
        height: 16,
        borderRadius: "50%",
        background: dark ? "#a3e635" : "#6366f1",
        transition: "left .2s, background .2s"
    }} />
    </span>
</label>
);
}