import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, useNavigate, useLocation } from "react-router-dom";
import StickyHeader from "../header";

// Mock react-router-dom hooks
jest.mock("react-router-dom", () => ({
...jest.requireActual("react-router-dom"),
useNavigate: jest.fn(),
useLocation: jest.fn(),
}));

describe("StickyHeader", () => {
beforeEach(() => {
    // Reset mocks before each test
    require("react-router-dom").useNavigate.mockReturnValue(jest.fn());
    require("react-router-dom").useLocation.mockReturnValue({ pathname: "/dashboard" });
});

it("renders logo and navigation tabs", () => {
    render(
    <MemoryRouter>
        <StickyHeader setShowAIModal={jest.fn()} />
    </MemoryRouter>
    );
    expect(screen.getByText("LakbAI")).toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Destinations")).toBeInTheDocument();
    expect(screen.getByText("Bookmarks")).toBeInTheDocument();
    expect(screen.getByText("My Trips")).toBeInTheDocument();
    expect(screen.getByText("Community")).toBeInTheDocument();
});

it("calls setShowAIModal when AI Assistant button is clicked", () => {
    const setShowAIModal = jest.fn();
    render(
    <MemoryRouter>
        <StickyHeader setShowAIModal={setShowAIModal} />
    </MemoryRouter>
    );
    fireEvent.click(screen.getByText(/AI Assistant/i));
    expect(setShowAIModal).toHaveBeenCalledWith(true);
});

it("navigates to profile when user icon is clicked", () => {
    const mockNavigate = jest.fn();
    require("react-router-dom").useNavigate.mockReturnValue(mockNavigate);
    render(
    <MemoryRouter>
        <StickyHeader setShowAIModal={jest.fn()} />
    </MemoryRouter>
    );
    fireEvent.click(screen.getByAltText("User"));
    expect(mockNavigate).toHaveBeenCalledWith("/profile");
});

it("highlights the active tab", () => {
    require("react-router-dom").useLocation.mockReturnValue({ pathname: "/bookmark" });
    render(
    <MemoryRouter>
        <StickyHeader setShowAIModal={jest.fn()} />
    </MemoryRouter>
    );
    const activeTab = screen.getByText("Bookmarks");
    expect(activeTab).toHaveClass("nav-tab active");
});
});