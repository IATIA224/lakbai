/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import Achievements from "../achievements";

describe("Achievements modal", () => {
const baseAchievements = [
    {
    id: 1,
    title: "First Trip",
    description: "Visited your first destination",
    category: "Milestones",
    unlocked: true,
    icon: "🌏",
    },
    {
    id: 2,
    title: "Photo Uploader",
    description: "Uploaded a photo",
    category: "Photos",
    unlocked: false,
    icon: "📷",
    },
    {
    id: 3,
    title: "Explorer",
    description: "Visited 10 destinations",
    category: "Milestones",
    unlocked: false,
    icon: "🧭",
    },
];

it("renders nothing when open is false", () => {
    render(<Achievements open={false} achievements={baseAchievements} />);
    expect(screen.queryByText(/All Achievements/i)).not.toBeInTheDocument();
});

it("renders modal and groups achievements by category", () => {
    render(<Achievements open={true} achievements={baseAchievements} />);
    expect(screen.getByText(/All Achievements/i)).toBeInTheDocument();
    expect(screen.getByText("Milestones")).toBeInTheDocument();
    expect(screen.getByText("Photos")).toBeInTheDocument();
    expect(screen.getByText("First Trip")).toBeInTheDocument();
    expect(screen.getByText("Photo Uploader")).toBeInTheDocument();
    expect(screen.getByText("Explorer")).toBeInTheDocument();
    // Unlocked/Locked badges
    expect(screen.getAllByText("Unlocked").length).toBe(1);
    expect(screen.getAllByText("Locked").length).toBe(2);
});

it("renders 'No achievements to display.' if achievements is empty", () => {
    render(<Achievements open={true} achievements={[]} />);
    expect(screen.getByText(/No achievements to display/i)).toBeInTheDocument();
});

it("renders 'No achievements to display.' if achievements is not provided", () => {
    render(<Achievements open={true} />);
    expect(screen.getByText(/No achievements to display/i)).toBeInTheDocument();
});

it("calls onClose when backdrop or close button is clicked", () => {
    const onClose = jest.fn();
    render(<Achievements open={true} achievements={baseAchievements} onClose={onClose} />);
    // Click backdrop
    fireEvent.click(screen.getByTestId("achievements-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(1);
    // Click close button
    fireEvent.click(screen.getByLabelText(/close achievements/i));
    expect(onClose).toHaveBeenCalledTimes(2);
});

it("calls onClose when Escape key is pressed", () => {
    const onClose = jest.fn();
    render(<Achievements open={true} achievements={baseAchievements} onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
});

it("closes the modal when clicking outside of it", () => {
    const onClose = jest.fn();
    render(<Achievements open={true} achievements={baseAchievements} onClose={onClose} />);
    // Use test id to select the backdrop instead of parentElement
    const backdrop = screen.getByTestId("achievements-backdrop");
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
});
});