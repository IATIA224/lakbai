import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Community from "../community";
import { MemoryRouter } from "react-router-dom";

// --- Mocks ---
var mockOnSnapshot = jest.fn();
var mockGetDoc = jest.fn();
var mockSetDoc = jest.fn();
var mockDeleteDoc = jest.fn();
var mockGetDocs = jest.fn();
var mockCollection = jest.fn();
var mockDoc = jest.fn();
var mockServerTimestamp = jest.fn(() => new Date());
var mockArrayUnion = jest.fn();
var mockArrayRemove = jest.fn();
var mockAddDoc = jest.fn();
var mockUpdateDoc = jest.fn();
var mockIncrement = jest.fn();

jest.mock("../Styles/community.css", () => ({}));
jest.mock("../firebase", () => ({
db: {},
auth: {
    currentUser: { uid: "user1", displayName: "Test User" },
    onAuthStateChanged: jest.fn(),
},
}));
jest.mock("../profile", () => ({
CLOUDINARY_CONFIG: { cloudName: "demo", uploadPreset: "test" },
}));
jest.mock("../friend", () => () => <div>FriendPopup</div>);
jest.mock("../achievementsBus", () => ({
emitAchievement: jest.fn(),
}));

jest.mock("firebase/firestore", () => ({
collection: (...args) => mockCollection(...args),
serverTimestamp: mockServerTimestamp,
setDoc: (...args) => mockSetDoc(...args),
doc: (...args) => mockDoc(...args),
getDoc: (...args) => mockGetDoc(...args),
getDocs: (...args) => mockGetDocs(...args),
onSnapshot: (...args) => mockOnSnapshot(...args),
arrayUnion: mockArrayUnion,
arrayRemove: mockArrayRemove,
addDoc: (...args) => mockAddDoc(...args),
updateDoc: (...args) => mockUpdateDoc(...args),
increment: mockIncrement,
query: jest.fn(),
where: jest.fn(),
}));

jest.mock("firebase/auth", () => ({
onAuthStateChanged: (auth, cb) => {
    cb({ uid: "user1", displayName: "Test User" });
    return jest.fn();
},
}));

// --- Helpers ---
function setupFirestoreMocks({ posts = [], users = [], friends = [] } = {}) {
// getDocs for posts
mockGetDocs.mockImplementation((q) => {
    if (typeof q === "object" && q._queryType === "friends") {
    return Promise.resolve({
        docs: friends.map((f) => ({ id: f.uid })),
    });
    }
    return Promise.resolve({
    docs: posts.map((p) => ({
        id: p.id,
        data: () => p,
    })),
    });
});
// getDoc for user profiles
mockGetDoc.mockImplementation((ref) => {
    const id = typeof ref === "object" && ref.id ? ref.id : "user1";
    const user = users.find((u) => u.uid === id);
    return Promise.resolve({
    exists: () => !!user,
    data: () => user || {},
    });
});
mockAddDoc.mockResolvedValue({});
mockUpdateDoc.mockResolvedValue({});
mockSetDoc.mockResolvedValue({});
mockDeleteDoc.mockResolvedValue({});
}

// --- Tests ---
describe("Community", () => {
beforeEach(() => {
    jest.clearAllMocks();
});

it("renders loading UI initially", async () => {
    setupFirestoreMocks();
    render(
    <MemoryRouter>
        <Community />
    </MemoryRouter>
    );
    expect(screen.getByText(/Loading community feed/i)).toBeInTheDocument();
    await waitFor(() => expect(mockGetDocs).toHaveBeenCalled());
});

it("renders empty state if no posts", async () => {
    setupFirestoreMocks({ posts: [] });
    render(
    <MemoryRouter>
        <Community />
    </MemoryRouter>
    );
    await screen.findByText(/No trips yet/i);
    expect(screen.getByText(/Be the first to inspire others/i)).toBeInTheDocument();
});

it("renders posts after loading", async () => {
    setupFirestoreMocks({
    posts: [
        {
        id: "p1",
        authorId: "user1",
        author: { name: "Test User" },
        title: "Trip to Cebu",
        details: "It was fun!",
        location: "Cebu",
        likes: 2,
        comments: 1,
        visibility: "Public",
        },
    ],
    users: [
        { uid: "user1", profilePicture: "/pic1.png" },
    ],
    });
    render(
    <MemoryRouter>
        <Community />
    </MemoryRouter>
    );
    expect(await screen.findByText("Trip to Cebu")).toBeInTheDocument();
    expect(
        screen.getAllByText((content, node) => node.textContent && node.textContent.includes("Cebu")).length
    ).toBeGreaterThan(0);
    expect(screen.getByText("It was fun!")).toBeInTheDocument();
    expect(
        screen.getAllByText((content, node) => node.textContent && node.textContent.includes("❤️") && node.textContent.includes("2")).length
    ).toBeGreaterThan(0);
    expect(
        screen.getAllByText((content, node) => node.textContent && node.textContent.includes("💬") && node.textContent.includes("1")).length
    ).toBeGreaterThan(0);
});

it("opens share trip modal when clicking Share Trip", async () => {
    setupFirestoreMocks();
    render(
    <MemoryRouter>
        <Community />
    </MemoryRouter>
    );
    fireEvent.click(screen.getByText(/\+ Share Trip/i));
    expect(await screen.findByText(/Share Your Philippines Adventure/i)).toBeInTheDocument();
});

it("opens friend popup when clicking Add Friend", async () => {
    setupFirestoreMocks();
    render(
    <MemoryRouter>
        <Community />
    </MemoryRouter>
    );
    fireEvent.click(screen.getByText(/\+ Add Friend/i));
    expect(await screen.findByText(/FriendPopup/i)).toBeInTheDocument();
});

it("opens report modal when clicking Report", async () => {
    setupFirestoreMocks({
    posts: [
        {
        id: "p1",
        authorId: "user1",
        author: { name: "Test User" },
        title: "Trip to Cebu",
        details: "It was fun!",
        location: "Cebu",
        likes: 2,
        comments: 1,
        visibility: "Public",
        },
    ],
    users: [
        { uid: "user1", profilePicture: "/pic1.png" },
    ],
    });
    render(
    <MemoryRouter>
        <Community />
    </MemoryRouter>
    );
    await screen.findByText("Trip to Cebu");
    fireEvent.click(screen.getByText(/Report/i));
    expect(await screen.findByText(/Report Post/i)).toBeInTheDocument();
});

it("opens comment modal when clicking comment button", async () => {
    setupFirestoreMocks({
        posts: [
            {
                id: "p1",
                authorId: "user1",
                author: { name: "Test User" },
                title: "Trip to Cebu",
                details: "It was fun!",
                location: "Cebu",
                likes: 2,
                comments: 1,
                visibility: "Public",
            },
        ],
        users: [
            { uid: "user1", profilePicture: "/pic1.png" },
        ],
    });
    render(
        <MemoryRouter>
            <Community />
        </MemoryRouter>
    );
    await screen.findByText("Trip to Cebu");
    fireEvent.click(
        screen.getAllByText((content, node) => node.textContent.includes("💬 1"))[0]
    );
    await waitFor(() => {
        expect(screen.getByTestId("comments-icon")).toBeInTheDocument();
    });
});
});