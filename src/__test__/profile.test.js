/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { act } from "react";
import { MemoryRouter } from "react-router-dom";

// --- Hoisted mock variables (use var so jest.mock factory can access) ---
var mockDoc = jest.fn();
var mockGetDoc = jest.fn();
var mockUpdateDoc = jest.fn();
var mockAddDoc = jest.fn();
var mockCollection = jest.fn();
var mockQuery = jest.fn();
var mockWhere = jest.fn();
var mockGetDocs = jest.fn();
var mockDeleteDoc = jest.fn();
var mockOnSnapshot = jest.fn();

// Mock firebase modules before importing component
jest.mock("../firebase", () => ({
db: {},
auth: {},
}));

jest.mock("firebase/firestore", () => ({
doc: (...args) => mockDoc(...args),
getDoc: (...args) => mockGetDoc(...args),
updateDoc: (...args) => mockUpdateDoc(...args),
addDoc: (...args) => mockAddDoc(...args),
collection: (...args) => mockCollection(...args),
query: (...args) => mockQuery(...args),
where: (...args) => mockWhere(...args),
getDocs: (...args) => mockGetDocs(...args),
deleteDoc: (...args) => mockDeleteDoc(...args),
onSnapshot: (...args) => mockOnSnapshot(...args),
}));

jest.mock("firebase/auth", () => ({
onAuthStateChanged: (auth, cb) => {
    // simulate logged-in user immediately
    setTimeout(() => cb({ uid: "user1", displayName: "Test User", metadata: { creationTime: new Date().toISOString() } }), 0);
    return () => {};
},
}));

// Mock react-leaflet components to avoid heavy DOM/map libs
jest.mock("react-leaflet", () => ({
MapContainer: ({ children }) => <div data-testid="map">{children}</div>,
TileLayer: () => <div data-testid="tilelayer" />,
Marker: ({ children }) => <div data-testid="marker">{children}</div>,
Popup: ({ children }) => <div data-testid="popup">{children}</div>,
}));

// Mock uuid to stable value
jest.mock("uuid", () => ({ v4: () => "fixed-uuid" }));

// Mock child components that are not under test
jest.mock("../EditProfile", () => () => <div data-testid="edit-profile">EditProfile</div>);
jest.mock("../info_delete", () => () => <div data-testid="info-delete">InfoDelete</div>);
jest.mock("../achievementsBus", () => ({ emitAchievement: jest.fn() }));

// Mock UserContext
jest.mock("../UserContext", () => ({
useUser: () => ({ profile: { name: "Ctx Name", profilePicture: "/ctx.png" } }),
}));

// Now import the module under test
import Profile, { unlockAchievement } from "../profile";
import { emitAchievement } from "../achievementsBus";

// helper to render with router
function renderWithRouter(ui) {
return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("Profile component", () => {
beforeEach(() => {
    jest.clearAllMocks();

    // Default getDoc for user profile
    mockGetDoc.mockResolvedValue({
    exists: () => true,
    data: () => ({
        travelerName: "Traveler Test",
        bio: "Bio text",
        profilePicture: "/pic.png",
        stats: { placesVisited: 2, photosShared: 1, reviewsWritten: 0 },
        friends: ["a", "b"],
        achievements: { "3": true },
        shareCode: "SHARE123",
    }),
    });

    // photos query
    mockGetDocs.mockImplementation(async (q) => {
    const coll = q; // ignored
    return {
        docs: [
        { id: "p1", data: () => ({ url: "/p1.png", timestamp: new Date().toISOString() }) },
        ],
    };
    });

    // travel_map query
    mockGetDocs.mockImplementationOnce(async () => ({
    docs: [
        { id: "loc1", data: () => ({ id: "loc1", latitude: 11.0, longitude: 122.0, name: "Place" }) },
    ],
    }))
    // activities query (second call in Promise.all)
    .mockImplementationOnce(async () => ({
    docs: [
        { id: "a1", data: () => ({ text: "You did X", timestamp: new Date().toISOString() }) },
    ],
    }))
    // fallback for other calls
    .mockImplementation(async () => ({ docs: [] }));
});

it("renders profile header and stats from firestore", async () => {
    renderWithRouter(<Profile />);

    // Wait for name from getDoc to appear
    expect(await screen.findByText(/Traveler Test|Ctx Name/)).toBeInTheDocument();
    expect(screen.getByText(/Bio text/)).toBeInTheDocument();

    // Stats rendered
    expect(screen.getByText("Places Visited")).toBeInTheDocument();
    expect(screen.getByText("Photos Shared")).toBeInTheDocument();
});

it("calls nominatim fetch when searching and pressing Enter", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
    ok: true,
    json: async () => [{ lat: "12.34", lon: "56.78", display_name: "Test Place, PH" }],
    });

    renderWithRouter(<Profile />);

    const input = screen.getByPlaceholderText(/Search for a destination/i);
    fireEvent.change(input, { target: { value: "Test Place" } });
    fireEvent.keyPress(input, { key: "Enter", code: "Enter", charCode: 13 });

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(global.fetch.mock.calls[0][0]).toMatch(/nominatim.openstreetmap.org/);
    global.fetch.mockRestore && global.fetch.mockRestore();
});

it("uploads photo handler performs expected firestore calls (mocked)", async () => {
    // mock uploadToCloudinary via window.fetch used in component's uploadToCloudinary
    const fakeResponse = { secure_url: "/uploaded.png" };
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => fakeResponse });

    mockAddDoc.mockResolvedValue({ id: "newphoto" });
    mockUpdateDoc.mockResolvedValue();

    renderWithRouter(<Profile />);

    // find hidden file input and trigger change
    const fileInput = screen.getByLabelText("Upload Photo");
    // create a File and dispatch change
    const file = new File(["binarydata"], "photo.png", { type: "image/png" });

    if (!fileInput) throw new Error("photo input not found");
    fireEvent.change(fileInput, { target: { files: [file] } });
    // ensure addDoc called to save photo
    await waitFor(() => expect(mockAddDoc).toHaveBeenCalled());
    global.fetch.mockRestore && global.fetch.mockRestore();
});
});

describe("unlockAchievement helper", () => {
beforeEach(() => {
    jest.clearAllMocks();
    mockGetDoc.mockResolvedValue({ exists: () => false, data: () => ({}) });
    mockUpdateDoc.mockResolvedValue();
});

it("updates firestore and emits achievement when not already unlocked", async () => {
    // simulate logged in user
    const origAuth = require("../firebase").auth;
    // call unlockAchievement directly; it reads auth.currentUser
    require("../firebase").auth.currentUser = { uid: "user1" };

    await unlockAchievement(99, "Test Achv");

    expect(mockGetDoc).toHaveBeenCalled();
    expect(mockUpdateDoc).toHaveBeenCalled();
    expect(emitAchievement).toHaveBeenCalledWith(expect.stringMatching(/Test Achv/));

    // restore
    require("../firebase").auth.currentUser = undefined;
});
});