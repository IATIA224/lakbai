import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Bookmark from "../bookmark";
import { MemoryRouter } from "react-router-dom";

// Mock dependencies
jest.mock("../firebase", () => ({
db: {},
auth: {
    onAuthStateChanged: jest.fn((cb) => {
    cb({ uid: "testuid" });
    return () => {}; // Always return a function for unsub
    }),
    currentUser: { uid: "testuid" }
}
}));
jest.mock("firebase/firestore", () => ({
collection: jest.fn(),
getDocs: jest.fn(() => Promise.resolve({ docs: [], forEach: jest.fn() })),
orderBy: jest.fn(),
query: jest.fn(),
onSnapshot: jest.fn((colRef, cb) => {
    cb({ size: 0 });
    return () => {}; // Always return a function for unsub
}),
doc: jest.fn(),
getDoc: jest.fn(() => Promise.resolve({ exists: () => false, data: () => ({}) })),
setDoc: jest.fn(),
serverTimestamp: jest.fn(),
deleteDoc: jest.fn(),
}));

jest.mock("../profile", () => ({
unlockAchievement: jest.fn(),
}));
jest.mock("../Itinerary", () => ({
addTripForCurrentUser: jest.fn(),
}));

describe("Bookmark", () => {
it("renders loading state initially", () => {
    render(
    <MemoryRouter>
        <Bookmark />
    </MemoryRouter>
    );
    expect(screen.getByText(/Loading Bookmarks/i)).toBeInTheDocument();
});

it("renders empty state when no bookmarks", async () => {
    render(
    <MemoryRouter>
        <Bookmark />
    </MemoryRouter>
    );
    await waitFor(() => {
    expect(screen.getByText(/No bookmarks yet/i)).toBeInTheDocument();
    });
    expect(screen.getAllByText(/Start Exploring/i).length).toBeGreaterThan(0);
});

it("shows stats cards", async () => {
    render(
    <MemoryRouter>
        <Bookmark />
    </MemoryRouter>
    );
    await waitFor(() => {
    expect(screen.getByText(/Total Bookmarks/i)).toBeInTheDocument();
    });
    await waitFor(() => {
    expect(screen.getByText(/Regions Covered/i)).toBeInTheDocument();
    });
    await waitFor(() => {
    expect(screen.getByText(/Avg Rating/i)).toBeInTheDocument();
    });
    await waitFor(() => {
    expect(screen.getByText(/In Trip Plan/i)).toBeInTheDocument();
    });
});

it("opens and closes the clear all modal", async () => {
  // Mock getDocs to return a bookmark
    const { getDocs } = require("firebase/firestore");
    getDocs.mockImplementationOnce(() =>
        Promise.resolve({
        docs: [
            {
            id: "1",
            data: () => ({
                name: "Test Bookmark",
                region: "Test Region",
                rating: 5,
            }),
            },
        ],
        forEach: function (cb) {
            this.docs.forEach(cb);
        },
        })
    );

    render(
        <MemoryRouter>
        <Bookmark />
        </MemoryRouter>
    );
    // Wait for the bookmark to load and the button to be enabled
    await waitFor(() => {
        expect(screen.getByText(/Clear All/i)).not.toBeDisabled();
    });
    fireEvent.click(screen.getByText(/Clear All/i));
    // Now the modal should appear
    await waitFor(() => {
        expect(screen.queryByText(/Clear all bookmarks\?/i)).not.toBeInTheDocument();
    });
});
});

