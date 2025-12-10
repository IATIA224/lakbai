import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { auth, db } from "./firebase";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import "./header.css";
import { ChatbaseAI } from "./Ai"; // Import the chatbot

const navTabs = [
	{ label: "Dashboard", path: "/dashboard" },
	{ label: "Destinations", path: "/bookmarks2" },
	{ label: "Bookmarks", path: "/bookmark" },
	{ label: "My Trips", path: "/itinerary" },
	{ label: "Community", path: "/community" },
];

const protectedPaths = ["/bookmark", "/community", "/profile", "/itinerary", "/ai"];

const StickyHeader = () => {
    const [activeTab, setActiveTab] = useState("Dashboard");
    const [profilePic, setProfilePic] = useState("/user.png");
    const [showAIPopup, setShowAIPopup] = useState(false);
    const [showLoginPrompt, setShowLoginPrompt] = useState(false);
    const [pendingTab, setPendingTab] = useState(null);
	const [isLoggedIn, setIsLoggedIn] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
				setIsLoggedIn(true);
				// optional: keep token in sync if your app still needs it
				try {
					const t = await user.getIdToken();
					localStorage.setItem("token", t);
				} catch {}
                const snap = await getDoc(doc(db, "users", user.uid));
                if (snap.exists() && snap.data().profilePicture) {
                    setProfilePic(snap.data().profilePicture);
                } else if (user.photoURL) {
                    setProfilePic(user.photoURL);
                } else {
                    setProfilePic("/user.png");
                }
            } else {
				setIsLoggedIn(false);
				localStorage.removeItem("token"); // optional cleanup
                setProfilePic("/user.png");
            }
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const currentTab = navTabs.find((tab) => tab.path === location.pathname);
        if (currentTab) {
            setActiveTab(currentTab.label);
        }
    }, [location.pathname]);

    const handleTabClick = (tab) => {
		if (protectedPaths.includes(tab.path) && !isLoggedIn) {
            setPendingTab(tab);
            setShowLoginPrompt(true);
            return;
        }
        if (tab.path) {
            navigate(tab.path);
        }
    };

    return (
		<>
			<header className="sticky-header">
				<div className="header-left">
					<img src="/coconut-tree.png" alt="LakbAI Logo" className="logo-icon" />
					<div className="logo-brand">
						<span className="logo-text">LakbAI</span>
						<div className="logo-subtitle">AI-Driven Itinerary <br/>Travel Itinerary Planner</div>
					</div>
				</div>
				<nav className="header-nav">
					{navTabs.map((tab) => (
						<span
							key={tab.label}
							onClick={() => handleTabClick(tab)}
							className={`nav-tab${
								location.pathname === tab.path ? " active" : ""
							}`}
							style={{
								cursor: "pointer",
								color: activeTab === tab.label ? "#2962ff" : "inherit",
								paddingBottom: "4px",
								marginRight: "18px",
								fontWeight: activeTab === tab.label ? "bold" : "normal",
							}}
						>
							{tab.label}
						</span>
					))}
				</nav>
				<div className="header-right">
                    <button
                        className="ai-assistant-btn"
                        onClick={() => setShowAIPopup(true)}
                    >
                        <span className="dot"></span> AI Assistant
                    </button>
                    {isLoggedIn ? (
							<img
								src={profilePic}
								alt="User"
								className="user-icon"
								onClick={() => navigate("/profile")}
								style={{ cursor: "pointer" }}
							/>
                    ) : (
                        <button
                            className="sign-in-btn"
                            onClick={() => setShowLoginPrompt(true)}
                            style={{
                                marginLeft: 12,
                                background: "#fff",
                                color: "#1976d2",
                                borderRadius: "10px",
								border: 0,
                                padding: "7px 20px",
                                fontWeight: 600,
                                fontSize: 16,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: 5,
								height: "38px",
                            }}
                        >
                            Sign in
                        </button>
                    )}
                </div>
			</header>
			{/* AI Chatbot Popup */}
			{showAIPopup && (
				<div style={{ position: "fixed", inset: 0, zIndex: 99999 }}>
					<ChatbaseAI onClose={() => setShowAIPopup(false)} />
					{/* Close overlay when clicking outside the chatbot */}
					<div
						style={{
							position: "fixed",
							inset: 0,
							zIndex: 99998,
							background: "transparent",
						}}
						onClick={() => setShowAIPopup(false)}
					/>
				</div>
			)}
			{/* Login Prompt Modal */}
			<LoginPromptModal
				open={showLoginPrompt}
				onAccept={() => {
					setShowLoginPrompt(false);
					navigate("/login");
				}}
				onReject={() => {
					setShowLoginPrompt(false);
					setPendingTab(null);
				}}
			/>
		</>
	);
};

export default StickyHeader;

function LoginPromptModal({ open, onAccept, onReject }) {
	if (!open) return null;
	return (
		<div style={{
		position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh",
		background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999
		}}>
		<div style={{
			background: "#fff", borderRadius: 8, padding: 32, minWidth: 320, boxShadow: "0 2px 16px rgba(0,0,0,0.15)",
			display: "flex", flexDirection: "column", alignItems: "center"
		}}>
			<div style={{ fontSize: 22, fontWeight: 600, marginBottom: 16 }}>Please login first</div>
			<div style={{ marginBottom: 24, color: "#555" }}>You need to be logged in to access this page.</div>
			<div style={{ display: "flex", gap: 16 }}>
			<button
				style={{
				background: "#1976d2", color: "#fff", border: "none", borderRadius: 4, padding: "8px 20px", fontSize: 16, cursor: "pointer"
				}}
				onClick={onAccept}
			>
				Login
			</button>
			<button
				style={{
				background: "#eee", color: "#333", border: "none", borderRadius: 4, padding: "8px 20px", fontSize: 16, cursor: "pointer"
				}}
				onClick={onReject}
			>
				Cancel
			</button>
			</div>
		</div>
		</div>
	);
}
