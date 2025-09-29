/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { act } from "react-dom/test-utils";
import AddFromCsvCMS from "../addfromcsv-cms.js";

// --- Mocks ---
// declare with var so jest.mock hoisting can close over them
var mockSetDoc = jest.fn();
var mockDoc = jest.fn();
var mockGetDocs = jest.fn();
var mockCollection = jest.fn();
var mockServerTimestamp = jest.fn(() => new Date());

jest.mock("firebase/firestore", () => ({
  setDoc: (...args) => mockSetDoc(...args),
  doc: (...args) => mockDoc(...args),
  getDocs: (...args) => mockGetDocs(...args),
  collection: (...args) => mockCollection(...args),
  serverTimestamp: mockServerTimestamp,
}));

jest.mock("../firebase", () => ({
  db: {},
}));

// Silence CSS import
jest.mock("../addfromcsv-cms.css", () => ({}));

describe("AddFromCsvCMS", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // default behaviors
    mockSetDoc.mockResolvedValue(undefined);
    mockCollection.mockReturnValue("destinations-collection");
    mockGetDocs.mockResolvedValue({
      docs: [],
      forEach(cb) {
        this.docs.forEach(cb);
      },
    });

    // defensive DOM restores in case a test mocks them
    if (document.createElement && document.createElement._isMock) {
      document.createElement = document.createElement._orig || document.createElement;
    }
    if (global.URL) {
      delete global.URL.createObjectURL;
      delete global.URL.revokeObjectURL;
    }
    window.alert = undefined;
    window.confirm = undefined;
  });

  const openModal = (props = {}) =>
    render(<AddFromCsvCMS open={true} onClose={jest.fn()} onImported={jest.fn()} {...props} />);

  it("renders modal when open", () => {
    openModal();
    expect(screen.getByText(/Add Destinations from CSV\/Excel/i)).toBeInTheDocument();
    expect(screen.getByText(/Download Template/i)).toBeInTheDocument();
  });

  it("closes modal when Cancel is clicked", () => {
    const onClose = jest.fn();
    render(<AddFromCsvCMS open={true} onClose={onClose} />);
    fireEvent.click(screen.getByText(/Cancel/i));
    expect(onClose).toHaveBeenCalled();
  });

  it("shows error for invalid file", async () => {
    const { container } = openModal();
    const file = new File([""], "empty.csv", { type: "text/csv" });

    const fileInput = container.querySelector('input[type="file"]');
    if (!fileInput) throw new Error("file input not found in component");
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(await screen.findByText(/No data found in file/i)).toBeInTheDocument();
  });

  it("shows missing columns warning", async () => {
    const { container } = openModal();
    const csv = "OnlyHeader\nvalue";
    const file = new File([csv], "test.csv", { type: "text/csv" });

    const fileInput = container.querySelector('input[type="file"]');
    if (!fileInput) throw new Error("file input not found in component");
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(await screen.findByText(/Missing required column/i)).toBeInTheDocument();
  });

  it("shows preview and imports valid CSV", async () => {
    const onImported = jest.fn();
    const { container } = render(<AddFromCsvCMS open={true} onClose={jest.fn()} onImported={onImported} />);
    const csv =
      "Destination Name,Region,Category,Description,Tags,Location,Price,Best Time to Visit\n" +
      "Boracay,Visayas,Beach,White Beach,beach,Aklan,1500,Dec-May";
    const file = new File([csv], "test.csv", { type: "text/csv" });

    await act(async () => {
      const fileInput = container.querySelector('input[type="file"]');
      if (!fileInput) throw new Error("file input not found in component");
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    expect(await screen.findByText(/Preview \(1 row\)/i)).toBeInTheDocument();
    expect(screen.getByText("Boracay")).toBeInTheDocument();

    fireEvent.click(screen.getByText(/Import 1 row/i));
    await waitFor(() => expect(mockSetDoc).toHaveBeenCalled());
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/Imported\s+1\s+destination/i);
    expect(onImported).toHaveBeenCalled();
  });

  it("disables Import button if missing columns", async () => {
    const { container } = openModal();
    const csv = "Name\nvalue";
    const file = new File([csv], "test.csv", { type: "text/csv" });

    await act(async () => {
      const fileInput = container.querySelector('input[type="file"]');
      if (!fileInput) throw new Error("file input not found in component");
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    // The Import button label may be "Import 1 row" or similar; find button by role and disabled state
    const importBtn = screen.getByRole("button", { name: /Import/i });
    expect(importBtn).toBeDisabled();
  });

  it("shows error if importNow fails", async () => {
    mockSetDoc.mockRejectedValueOnce(new Error("fail"));
    const { container } = render(<AddFromCsvCMS open={true} onClose={jest.fn()} />);
    const csv =
      'Destination Name,Region,Categories,Description,Content,Tags,Location,Price,Best Time to Visit,Image URL\n' + // UPDATED (Price column)
      'Boracay,Aklan,"Beach","White sand beach","<p>Paradise</p>","beach, island",Aklan,1500,Dec-May,5,https://res.cloudinary.com/.../boracay.jpg,https://.../1.jpg';
    const file = new File([csv], "test.csv", { type: "text/csv" });

    await act(async () => {
      const fileInput = container.querySelector('input[type="file"]');
      if (!fileInput) throw new Error("file input not found in component");
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    fireEvent.click(screen.getByText(/Import 1 row/i));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/No rows were imported/i);
  });

  it("downloads template when Download Template is clicked", () => {
    openModal();
    const createObjectURL = jest.fn(() => "blob:url");
    const revokeObjectURL = jest.fn();
    global.URL.createObjectURL = createObjectURL;
    global.URL.revokeObjectURL = revokeObjectURL;

    const origCreateElement = document.createElement;
    const click = jest.fn();

    // Ensure we return a real DOM Node so appendChild works
    const spy = jest.spyOn(document, "createElement").mockImplementation((tagName) => {
      const el = origCreateElement.call(document, tagName);
      // provide props used by the code under test
      try {
        el.click = click;
      } catch (e) {}
      Object.defineProperty(el, "href", { writable: true, value: el.href });
      Object.defineProperty(el, "download", { writable: true, value: el.download });
      // mark so we can defensively restore if needed
      el._isMockNode = true;
      return el;
    });

    fireEvent.click(screen.getByText(/Download Template/i));
    expect(createObjectURL).toHaveBeenCalled();

    // restore
    spy.mockRestore();
    global.URL.createObjectURL = undefined;
    global.URL.revokeObjectURL = undefined;
  });

  it("closes on Esc key", () => {
    const onClose = jest.fn();
    openModal({ onClose });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
