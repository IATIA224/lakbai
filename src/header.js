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

const StickyHeader = () => {
	const [activeTab, setActiveTab] = useState("Dashboard");
	const [profilePic, setProfilePic] = useState("/user.png");
	const [showAIPopup, setShowAIPopup] = useState(false);
	const navigate = useNavigate();
	const location = useLocation();

	useEffect(() => {
		const unsubscribe = onAuthStateChanged(auth, async (user) => {
			if (user) {
				const snap = await getDoc(doc(db, "users", user.uid));
				if (snap.exists() && snap.data().profilePicture) {
					setProfilePic(snap.data().profilePicture);
				} else if (user.photoURL) {
					setProfilePic(user.photoURL);
				} else {
					setProfilePic("/user.png");
				}
			} else {
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
		if (tab.path) {
			navigate(tab.path);
		}
	};

	return (
		<>
			<header className="sticky-header">
				<div className="header-left">
					<img src="/coconut-tree.png" alt="LakbAI Logo" className="logo-icon" />
					<span className="logo-text">LakbAI</span>
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
					<img
						src={profilePic}
						alt="User"
						className="user-icon"
						onClick={() => navigate("/profile")}
						style={{ cursor: "pointer" }}
					/>
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
		</>
	);
};

export default StickyHeader;