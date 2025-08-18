import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./header.css";

const navTabs = [
	{ label: "Dashboard", path: "/dashboard" },
	{ label: "Destinations", path: "/bookmarks2" },
	{ label: "Bookmarks", path: "/bookmark" },
	{ label: "My Trips" }, // No path, so it's just text and not a link
	{ label: "Community", path: "/community" },
];

const StickyHeader = ({ setShowAIModal }) => {
	const [messages, setMessages] = useState([]);
	const [inputMessage, setInputMessage] = useState("");
	const [activeTab, setActiveTab] = useState("Dashboard");
	const navigate = useNavigate();
	const location = useLocation();

	useEffect(() => {
		const currentTab = navTabs.find((tab) => tab.path === location.pathname);
		if (currentTab) {
			setActiveTab(currentTab.label);
		}
	}, [location.pathname]);

	const handleSendMessage = () => {
		if (inputMessage.trim()) {
			setMessages([
				...messages,
				{ type: "user", text: inputMessage },
				{ type: "ai", text: "Hello! I'm your AI assistant. How can I help you today?" },
			]);
			setInputMessage("");
		}
	};

	const handleTabClick = (tab) => {
		if (tab.path) {
			navigate(tab.path);
		}
		// If no path, do nothing (still clickable)
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
							style={{
								cursor: "pointer",
								borderBottom: activeTab === tab.label ? "3px solid #2962ff" : "none",
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
						onClick={() => setShowAIModal && setShowAIModal(true)}
					>
						<span className="dot"></span> AI Assistant
					</button>
					<img
						src="/user.png"
						alt="User"
						className="user-icon"
						onClick={() => navigate("/profile")}
						style={{ cursor: "pointer" }}
					/>
				</div>
			</header>
			{/* Chatbox code is commented out for now */}
		</>
	);
};

export default StickyHeader;