import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { breakdown, category } from "../../rules";
import { HotelSuggestion, AgencySuggestion } from "../../ItinerarySuggestion";
import { db, auth } from "../../firebase"; // ADD THIS IMPORT
import { doc, updateDoc } from "firebase/firestore"; // ADD THIS IMPORT
import "./ItineraryCard.css";


export default function ItineraryCard({
  item,
  index,
  onEdit,
  onRemove,
  onShowPriceBadge,
  onHidePriceBadge,
  isShared = false,        // ADD THIS
  sharedId = null,         // ADD THIS
}) {
  // Modal + UX state
  const [isOpen, setIsOpen] = useState(false);
  const [showAllActivities, setShowAllActivities] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // New: Breakdown editing state
  const [isEditingBreakdown, setIsEditingBreakdown] = useState(false);
  const [breakdownEditItems, setBreakdownEditItems] = useState([]); // {label, amount} objects


  // Small inline editor and section editing states
  const [dateFrom, setDateFrom] = useState("");
  const [dateUntil, setDateUntil] = useState("");
  const [isEditingAccommodation, setIsEditingAccommodation] = useState(false);
  const [accomTypeValue, setAccomTypeValue] = useState("");
  const [accomNameValue, setAccomNameValue] = useState("");
  const [accomNotesValue, setAccomNotesValue] = useState("");
  const [isEditingAgency, setIsEditingAgency] = useState(false);
  const [agencyValue, setAgencyValue] = useState("");
  const [agencyDetailsValue, setAgencyDetailsValue] = useState("");
  const [packingSelected, setPackingSelected] = useState([]);


  // Add local state for editing Activities and Notes
  const [customPackingItem, setCustomPackingItem] = useState("");
  const [isAddingPackingItem, setIsAddingPackingItem] = useState(false);


  // Full edit form local state
  const [nameValue, setNameValue] = useState("");
  const [locationValue, setLocationValue] = useState("");
  const [descriptionValue, setDescriptionValue] = useState("");
  const [estValue, setEstValue] = useState("");
  const [activitiesValue, setActivitiesValue] = useState("");
  const [arrivalValue, setArrivalValue] = useState("");
  const [departureValue, setDepartureValue] = useState("");


  // Add local state for editing Activities and Notes
  const [isEditingActivities, setIsEditingActivities] = useState(false);
  const [activitiesEditValue, setActivitiesEditValue] = useState("");
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesEditValue, setNotesEditValue] = useState("");


  // Add state for accommodation suggestions
  const [accomSuggestions, setAccomSuggestions] = useState([]);
  const [loadingAccom, setLoadingAccom] = useState(false);


  // Loading and error state
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setError] = useState(null);

  // AI UI removed for a fresh start
  
  const deleteRef = useRef(null);

  // NOTE: don't early-return here — hooks below must run in every render.
  // if (!item) return null;


  // Firebase save handler
  const saveToFirebase = async (updatedItem) => {
    if (!auth.currentUser || !item.id) {
      console.error("Missing user or item ID");
      return false;
    }

    setIsSaving(true);
    setError(null);

    try {
      let ref;
      
      // Determine the correct path based on whether it's shared
      if (isShared && sharedId) {
        // Save to shared itinerary
        ref = doc(db, "sharedItineraries", sharedId, "items", item.id);
      } else {
        // Save to personal itinerary
        ref = doc(db, "itinerary", auth.currentUser.uid, "items", item.id);
      }
      
      await updateDoc(ref, {
        ...updatedItem,
        updatedAt: new Date(),
      });
      setIsSaving(false);
      return true;
    } catch (err) {
      console.error("Error saving to Firebase:", err);
      setError(err.message);
      setIsSaving(false);
      return false;
    }
  };


  // Helpers: breakdown & packing
  const getBreakdownFromRules = (price) => {
    if (!price) return [];
    const priceStr = String(price).replace(/[^\d]/g, "");
    const key = `P${priceStr}`;
    return breakdown[key] || [];
  };


  const breakdownItems =
    item?.breakdown && Array.isArray(item.breakdown) && item.breakdown.length > 0
      ? item.breakdown
      : getBreakdownFromRules(item?.estimatedExpenditure || item?.price || item?.budget);


  const getPackingFromCategory = (it = item) => {
    if (it?.packingSuggestions) return it.packingSuggestions;
    if (!it?.categories || it.categories.length === 0) return [];
    const cat = it.categories[0];
    if (!cat) return [];
    const catLower = String(cat).toLowerCase().trim();
    if (category[catLower]) return category[catLower];
    const singular = catLower.endsWith("s") ? catLower.slice(0, -1) : catLower;
    if (category[singular]) return category[singular];
    const normalized = catLower.replace(/[^a-z0-9]/g, "");
    const matchedKey = Object.keys(category).find(
      (key) => key.replace(/[^a-z0-9]/g, "") === normalized
    );
    return matchedKey ? category[matchedKey] : [];
  };


  const packingSuggestions = useMemo(() => {
    const val = getPackingFromCategory(item);
    return Array.isArray(val)
      ? val
      : String(val).split("\n").map((s) => s.trim()).filter(Boolean);
  }, [item]);


  // parse price lines - returns {label, amount}
  const parseBreakdown = (line) => {
    if (typeof line !== "string") return { label: String(line), amount: "" };
    const amt = line.match(/(~?\s*₱[\d,.\s]+)/i);
    if (amt) {
      const amount = amt[0].trim();
      const label = line.replace(amt[0], "").replace(/[-–—:]+$/g, "").trim();
      return { label: label || "Item", amount };
    }
    const parts = line.split(/[:–—-]/);
    if (parts.length > 1) {
      return {
        label: parts[0].trim(),
        amount: parts.slice(1).join("").trim(),
      };
    }
    return { label: line.trim(), amount: "" };
  };

  // Convert amount string to a number (₱1,200 -> 1200)
  const parseAmountValue = (amt) => {
    if (!amt && amt !== 0) return 0;
    const cleaned = String(amt).replace(/[^\d.-]/g, "");
    const n = Number(cleaned);
    return isNaN(n) ? 0 : n;
  };

  // Helper: map lines -> {label, amount}
  const getBreakdownEditItemsFromLines = (lines) => {
    if (!lines || !Array.isArray(lines)) return [];
    return lines.map((l) => {
      const { label, amount } = parseBreakdown(l);
      return { label: label || "", amount: amount || "" };
    });
  };

  const priceBadge = item?.estimatedExpenditure || item?.price;


  // activities: normalize to array and compute showToggle
  const activities = useMemo(() => {
    if (!item) return [];
    if (Array.isArray(item.activities)) return item.activities.filter(Boolean);
    if (!item.activities) return [];
    // support comma-separated strings and multi-line strings
    return String(item.activities)
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }, [item]);


  const showToggle = activities.length > 6;


  // compact date summary
  const formatDatePretty = (d) => {
    if (!d) return "";
    try {
      const t = new Date(d);
      return t.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    } catch {
      return d;
    }
  };
  const dateSummary = useMemo(() => {
    if (!item?.dateFrom && !item?.dateUntil) return "";
    const f = formatDatePretty(item?.dateFrom);
    const u = formatDatePretty(item?.dateUntil);
    if (f && u) return `${f} — ${u}`;
    return f || u || "";
  }, [item?.dateFrom, item?.dateUntil]);


  // close handlers & body scroll lock
  const closeModal = () => {
    setIsOpen(false);
    setShowAllActivities(false);
    document.body.classList.remove("itn-modal-open");
    if (onHidePriceBadge && priceBadge) onHidePriceBadge(priceBadge);
  };
  const handleOpen = () => {
    setIsOpen(true);
    document.body.classList.add("itn-modal-open");
    if (onShowPriceBadge && priceBadge) onShowPriceBadge(priceBadge);
  };


  // Save handlers
  const saveAccommodation = async () => {
    if (!onEdit) {
      setIsEditingAccommodation(false);
      return;
    }


    const updated = {
      ...item,
      accomType: accomTypeValue,
      accomName: accomNameValue,
      accomNotes: accomNotesValue,
    };


    const success = await saveToFirebase(updated);
    if (success) {
      onEdit(updated);
      setIsEditingAccommodation(false);
    }
  };


  const saveAgency = async () => {
    if (!onEdit) {
      setIsEditingAgency(false);
      return;
    }


    const updated = {
      ...item,
      agency: agencyValue,
      agencyDetails: agencyDetailsValue,
    };


    const success = await saveToFirebase(updated);
    if (success) {
      onEdit(updated);
      setIsEditingAgency(false);
    }
  };


  const saveDates = async () => {
    if (!onEdit) return;


    const updated = {
      ...item,
      dateFrom: dateFrom || undefined,
      dateUntil: dateUntil || undefined,
    };


    await saveToFirebase(updated);
    onEdit(updated);
  };


  const saveActivities = async () => {
    if (!onEdit) {
      setIsEditingActivities(false);
      return;
    }


    const updated = {
      ...item,
      activities: activitiesEditValue
        ? activitiesEditValue.split(",").map(a => a.trim()).filter(Boolean)
        : [],
    };


    const success = await saveToFirebase(updated);
    if (success) {
      onEdit(updated);
      setIsEditingActivities(false);
    }
  };


  const saveNotes = async () => {
    if (!onEdit) {
      setIsEditingNotes(false);
      return;
    }


    const updated = {
      ...item,
      notes: notesEditValue,
    };


    const success = await saveToFirebase(updated);
    if (success) {
      onEdit(updated);
      setIsEditingNotes(false);
    }
  };


  const togglePacking = async (p) => {
    const next = packingSelected.includes(p)
      ? packingSelected.filter((x) => x !== p)
      : [...packingSelected, p];
    setPackingSelected(next);
   
    if (!onEdit) return;
   
    const updated = { ...item, packingSelected: next };
    await saveToFirebase(updated);
    onEdit(updated);
  };


  // Add custom packing item
  const addCustomPackingItem = async () => {
    if (!customPackingItem.trim()) return;


    const newItem = customPackingItem.trim();
    const next = [...packingSelected, newItem];
    setPackingSelected(next);
    setCustomPackingItem("");
    setIsAddingPackingItem(false);
   
    if (!onEdit) return;
   
    const updated = { ...item, packingSelected: next };
    await saveToFirebase(updated);
    onEdit(updated);
  };


  // Remove custom packing item
  const removePackingItem = async (item_to_remove) => {
    const next = packingSelected.filter(p => p !== item_to_remove);
    setPackingSelected(next);
   
    if (!onEdit) return;
   
    const updated = { ...item, packingSelected: next };
    await saveToFirebase(updated);
    onEdit(updated);
  };

  // Add / Remove breakdown lines (fix runtime error)
  const addBreakdownLine = () => {
    setBreakdownEditItems((s) => [...s, { label: "", amount: "" }]);
  };

  const removeBreakdownLine = (idx) => {
    setBreakdownEditItems((s) => s.filter((_, i) => i !== idx));
  };

  // Cancel edit and restore original breakdown
  const cancelBreakdownEdit = () => {
    const lines =
      item.breakdown && Array.isArray(item.breakdown) && item.breakdown.length > 0
        ? item.breakdown
        : getBreakdownFromRules(item.estimatedExpenditure || item.price || item.budget);
    setBreakdownEditItems(getBreakdownEditItemsFromLines(lines));
    setIsEditingBreakdown(false);
  };

  // Save breakdown and update estimatedExpenditure
  const saveBreakdown = async () => {
    if (!onEdit) {
      setIsEditingBreakdown(false);
      return;
    }

    const cleanedLines = breakdownEditItems
      .filter((b) => (b.label && b.label.trim()) || (b.amount && String(b.amount).trim()))
      .map(({ label, amount }) => {
        const lbl = (label || "").trim() || "Item";
        const amtNum = parseAmountValue(amount);
        const amountStr = amtNum ? `₱${amtNum.toLocaleString()}` : "";
        return amountStr ? `${lbl}: ${amountStr}` : lbl;
      });

    const total = breakdownEditItems.reduce((sum, { amount }) => sum + parseAmountValue(amount), 0);

    const updated = {
      ...item,
      breakdown: cleanedLines,
      estimatedExpenditure: total || undefined,
    };

    setIsSaving(true);
    setError(null);
    const success = await saveToFirebase(updated);
    if (success) {
      onEdit(updated);
      setIsEditingBreakdown(false);
    }
  };


  // Helpers: format item for display
  const formatItemForDisplay = (item) => {
    if (!item) return "";
    if (typeof item === "string") return item;
    if (Array.isArray(item)) return item.filter(Boolean).join(", ");
    return Object.values(item).filter(Boolean).join(", ");
  };


  // sync local edit state from item when modal opens
  useEffect(() => {
    if (!item) return;
    setDateFrom(item.dateFrom || "");
    setDateUntil(item.dateUntil || "");
    setAccomTypeValue(item.accomType || "");
    setAccomNameValue(item.accomName || "");
    setAccomNotesValue(item.accomNotes || "");
    setAgencyValue(item.agency || "");
    setAgencyDetailsValue(item.agencyDetails || "");
    const initialSelected = Array.isArray(item.packingSelected)
      ? item.packingSelected
      : Array.isArray(item.packingSuggestions)
      ? item.packingSuggestions.filter(Boolean)
      : [];
    setPackingSelected(initialSelected);


    setNameValue(item.name || "");
    setLocationValue(item.location || "");
    setDescriptionValue(item.description || "");
    setEstValue(item.estimatedExpenditure ? String(item.estimatedExpenditure) : "");
    setActivitiesValue(Array.isArray(item.activities) ? item.activities.join(", ") : (item.activities || ""));
    setArrivalValue(item.arrival || "");
    setDepartureValue(item.departure || "");


    setActivitiesEditValue(Array.isArray(item.activities) ? item.activities.join(", ") : (item.activities || ""));
    setNotesEditValue(item.notes || "");
    setCustomPackingItem("");
    setIsAddingPackingItem(false);
    setItemStatus(item.status || "");

    // New: breakdown edit state
    const lines =
      item.breakdown && Array.isArray(item.breakdown) && item.breakdown.length > 0
        ? item.breakdown
        : getBreakdownFromRules(item.estimatedExpenditure || item.price || item.budget);
    setBreakdownEditItems(getBreakdownEditItemsFromLines(lines));
  }, [item, isOpen]);


  // Close delete modal on ESC
  useEffect(() => {
    if (!showDeleteConfirm) return;
    const onKey = (e) => {
      if (e.key === "Escape") setShowDeleteConfirm(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showDeleteConfirm]);


  // Close on ESC (modal)
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => e.key === "Escape" && closeModal();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);


  // Handle hotel selection from suggestions
  const handleSelectHotel = (hotelRow) => {
    setAccomTypeValue(hotelRow.type || "Hotel");
    setAccomNameValue(hotelRow.name || "");
    const details = [
      hotelRow.address ? `Address: ${hotelRow.address}` : "",
      hotelRow.phone ? `Phone: ${hotelRow.phone}` : "",
      hotelRow.email ? `Email: ${hotelRow.email}` : "",
      hotelRow.website ? `Website: ${hotelRow.website}` : "",
      hotelRow.price ? `Price: ${hotelRow.price}` : "",
      hotelRow.rating ? `Rating: ${hotelRow.rating}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    setAccomNotesValue(details);
  };


  // Handle agency selection from suggestions
  const handleSelectAgency = (agencyRow) => {
    setAgencyValue(agencyRow.name || "");
   
    const details = [
      agencyRow.type ? `Type: ${agencyRow.type}` : "",
      agencyRow.location ? `Location: ${agencyRow.location}` : "",
      agencyRow.address ? `Address: ${agencyRow.address}` : "",
      agencyRow.phone ? `Phone: ${agencyRow.phone}` : "",
      agencyRow.email ? `Email: ${agencyRow.email}` : "",
      agencyRow.website ? `Website: ${agencyRow.website}` : "",
      agencyRow.validUntil ? `Valid Until: ${agencyRow.validUntil}` : "",
    ]
      .filter(Boolean)
      .join("\n");
   
    setAgencyDetailsValue(details);
  };


  // Add status toggle state (moved up so hooks aren't conditional)
  const [itemStatus, setItemStatus] = useState("");


  // Add status toggle handler
  const toggleStatus = async () => {
    if (!onEdit) return;

    const statusOptions = ["upcoming", "ongoing", "completed"];
    const currentIndex = statusOptions.indexOf((item?.status || "upcoming").toLowerCase());
    const nextIndex = (currentIndex + 1) % statusOptions.length;
    const nextStatus = statusOptions[nextIndex];

    const updated = {
      ...item,
      status: nextStatus,
    };

    const success = await saveToFirebase(updated);
    if (success) {
      onEdit(updated);
      setItemStatus(nextStatus);
    }
  };


  // Add status badge styling function
  const getStatusBadgeStyle = (status) => {
    const statusLower = (status || "upcoming").toLowerCase();
    switch (statusLower) {
      case "completed":
        return { background: "#d1fae5", color: "#065f46", border: "1px solid #a7f3d0" };
      case "ongoing":
        return { background: "#fef3c7", color: "#78350f", border: "1px solid #fcd34d" };
      case "upcoming":
      default:
        return { background: "#dbeafe", color: "#0c4a6e", border: "1px solid #bae6fd" };
    }
  };


  // -- final guard before rendering - after all hooks are established --
  if (!item) return null;
  return (
    <>
      {/* Compact row */}
      <div className="itn-row">
        <div className="itn-row-left">
          <span className="itn-row-step">{index + 1}</span>
          <span className="itn-row-name" title={item.name}>
            {item.name}
          </span>
        </div>
        <div className="itn-row-actions">
          {/* Add status toggle button */}
          {onEdit && (
            <button
              className="itn-btn"
              onClick={toggleStatus}
              style={{
                ...getStatusBadgeStyle(item.status),
                fontSize: "12px",
                fontWeight: 700,
                textTransform: "capitalize",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              title="Click to change status"
            >
              {item.status || "upcoming"}
            </button>
          )}

          <button className="itn-btn primary" onClick={handleOpen}>
            View details
          </button>


          {onRemove && (
            <button
              className="itn-btn danger sm"
              onClick={(e) => {
                e.stopPropagation();
                setShowDeleteConfirm(true);
              }}
              title="Remove"
            >
              🗑️
            </button>
          )}
        </div>
      </div>


      {/* Delete confirmation modal */}
      {showDeleteConfirm &&
        ReactDOM.createPortal(
          <div
            className="itn-delete-overlay"
            role="dialog"
            aria-modal="true"
            onClick={() => setShowDeleteConfirm(false)}
          >
            <div className="itn-delete-modal" ref={deleteRef} onClick={(e) => e.stopPropagation()}>
              <div className="itn-delete-title">Remove item</div>
              <div className="itn-delete-body">
                Remove <strong>{item.name}</strong> from itinerary?
              </div>
              <div className="itn-delete-actions">
                <button
                  className="itn-btn danger"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    if (onRemove) onRemove(item.id);
                  }}
                >
                  Delete
                </button>
                <button className="itn-btn ghost" onClick={() => setShowDeleteConfirm(false)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}


      {/* Detail modal */}
      {isOpen &&
        ReactDOM.createPortal(
          <div
            className="itn-modal-overlay"
            role="dialog"
            aria-modal="true"
            aria-label={`${item.name} details`}
            onClick={closeModal}
          >
            <div className="itn-modal" onClick={(e) => e.stopPropagation()}>
              {/* Hero */}
              <header className="itn-hero">
                <div className="itn-hero-top">
                  <div className="itn-chip-row">
                    {item.region && (
                      <span className="itn-chip muted">
                        {item.region}
                        {item.status ? " • " + String(item.status) : ""}
                      </span>
                    )}
                  </div>
                </div>


                <div className="itn-hero-content">
                  <h1 className="itn-hero-title">{item.name}</h1>


                  <div className="itn-hero-meta">
                    {item.location && (
                      <span className="itn-hero-meta-item">
                        <span className="itn-hero-icon">📍</span>
                        <span>{item.location}</span>
                      </span>
                    )}
                    {item.rating && (
                      <span className="itn-hero-meta-item">
                        <span className="itn-hero-icon">⭐</span>
                        <span>{item.rating}</span>
                      </span>
                    )}
                  </div>


                  {dateSummary && (
                    <div className="itn-hero-dates">
                      <div className="itn-hero-dates-icon">📅</div>
                      <div className="itn-hero-dates-content">
                        <span className="itn-hero-dates-label">Dates</span>
                        <span className="itn-hero-dates-value">{dateSummary}</span>
                      </div>
                    </div>
                  )}
                </div>


                <button className="itn-hero-close" onClick={closeModal} aria-label="Close">
                  ✕
                </button>
              </header>


              {/* Body */}
              <div className="itn-body">
                <div className="itn-body-grid">
                  {/* LEFT COLUMN: Main Details */}
                  <div className="itn-body-main">
                    {/* Description */}
                    {item.description && (
                      <section className="itn-section card">
                        <div className="itn-section-label">Description</div>
                        <p className="itn-section-text">{item.description}</p>
                      </section>
                    )}


                    {/* Activities */}
                    {activities.length > 0 && (
                      <section className="itn-section">
                        <div className="itn-title">
                          <span className="itn-title-accent" />
                          <span>🎯 Activities</span>
                        </div>
                        <div className="itn-tags">
                          {(showAllActivities ? activities : activities.slice(0, 6)).map((a, i) => (
                            <span key={i} className="itn-tag">
                              {a}
                            </span>
                          ))}
                        </div>
                        {showToggle && (
                          <button
                            className="itn-btn ghost sm"
                            onClick={() => setShowAllActivities((v) => !v)}
                          >
                            {showAllActivities ? "Show less" : `Show all (${activities.length})`}
                          </button>
                        )}
                      </section>
                    )}


                    {/* Dates */}
                    <section className="itn-section itn-section-grid">
                      <div className="itn-title">
                        <span className="itn-title-accent" />
                        <span>📅 Dates</span>
                      </div>
                      <div className="itn-field-grid">
                        <div className="itn-field">
                          <label className="itn-field-label">From</label>
                          <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                            onBlur={saveDates}
                          />
                        </div>
                        <div className="itn-field">
                          <label className="itn-field-label">Until</label>
                          <input
                            type="date"
                            value={dateUntil}
                            onChange={(e) => setDateUntil(e.target.value)}
                            onBlur={saveDates}
                          />
                        </div>
                      </div>
                    </section>


                    {/* Accommodation */}
                    <section className="itn-section card">
                      <div className="itn-section-label">🏨 Accommodation</div>
                      {!isEditingAccommodation ? (
                        <div className="itn-accom-display">
                          <div className="itn-accom-content">
                            {item.accomType && item.accomName ? (
                              <>
                                <div className="itn-accom-header">
                                  <div className="itn-accom-type-badge">{item.accomType}</div>
                                  <h4 className="itn-accom-name">{item.accomName}</h4>
                                </div>
                                {item.accomNotes && (
                                  <div className="itn-accom-details">
                                    {item.accomNotes.split('\n').map((line, idx) => (
                                      <div key={idx} className="itn-accom-detail-line">
                                        {line}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </>
                            ) : (
                              <div className="itn-empty-state">Not set</div>
                            )}
                          </div>
                          {onEdit && (
                            <button
                              className="itn-edit-icon-btn"
                              onClick={() => setIsEditingAccommodation(true)}
                              title="Edit Accommodation"
                              aria-label="Edit Accommodation"
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                              </svg>
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="itn-edit-modal-overlay itn-accom-overlay" onClick={() => setIsEditingAccommodation(false)}>
                          <div className="itn-edit-modal itn-accom-modal" onClick={(e) => e.stopPropagation()}>
                            <div className="itn-edit-modal-header">
                              <h3>🏨 Edit Accommodation</h3>
                              <button
                                className="itn-edit-modal-close"
                                onClick={() => setIsEditingAccommodation(false)}
                              >
                                ✕
                              </button>
                            </div>
                            <div className="itn-edit-modal-body itn-accom-body">
                              <div className="itn-accom-container">
                                {/* Left: Form */}
                                <div className="itn-accom-form">
                                  <h4 className="itn-accom-form-title">Accommodation Details</h4>
                                  <div className="itn-field">
                                    <label className="itn-field-label">Type</label>
                                    <input
                                      placeholder="e.g., Hotel, Resort, Hostel"
                                      value={accomTypeValue}
                                      onChange={(e) => setAccomTypeValue(e.target.value)}
                                    />
                                  </div>
                                  <div className="itn-field">
                                    <label className="itn-field-label">Name</label>
                                    <input
                                      placeholder="e.g., Sunshine Resort"
                                      value={accomNameValue}
                                      onChange={(e) => setAccomNameValue(e.target.value)}
                                    />
                                  </div>
                                  <div className="itn-field">
                                    <label className="itn-field-label">Details & Notes</label>
                                    <textarea
                                      placeholder="Address, Phone, Email, Website, Price, Rating, etc."
                                      value={accomNotesValue}
                                      onChange={(e) => setAccomNotesValue(e.target.value)}
                                      rows="8"
                                    />
                                  </div>
                                </div>


                                {/* Right: Hotel Suggestions */}
                                <div className="itn-accom-suggestions">
                                  <h4 className="itn-accom-suggestions-title">💡 Suggested Hotels</h4>
                                  <div className="itn-accom-suggestions-list">
                                    <HotelSuggestion
                                      details={item}
                                      onSelect={handleSelectHotel}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="itn-edit-modal-footer itn-edit-actions">
                              <button
                                className="itn-btn primary itn-save"
                                onClick={saveAccommodation}
                                disabled={isSaving}
                              >
                                {isSaving ? "Saving..." : "Save"}
                              </button>
                              <button
                                className="itn-btn ghost itn-cancel"
                                onClick={() => {
                                  setIsEditingAccommodation(false);
                                  setAccomTypeValue(item.accomType || "");
                                  setAccomNameValue(item.accomName || "");
                                  setAccomNotesValue(item.accomNotes || "");
                                }}
                                disabled={isSaving}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </section>


                    {/* Agency */}
                    <section className="itn-section card">
                      <div className="itn-section-label">🏢 Agency</div>
                      {!isEditingAgency ? (
                        <div className="itn-agency-display">
                          <div className="itn-agency-content">
                            {item.agency ? (
                              <>
                                <h4 className="itn-agency-name">{item.agency}</h4>
                                {item.agencyDetails && (
                                  <div className="itn-agency-details">
                                    {item.agencyDetails.split('\n').map((line, idx) => (
                                      <div key={idx} className="itn-agency-detail-line">
                                        {line}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </>
                            ) : (
                              <div className="itn-empty-state">Not set</div>
                            )}
                          </div>
                          {onEdit && (
                            <button
                              className="itn-edit-icon-btn"
                              onClick={() => setIsEditingAgency(true)}
                              title="Edit Agency"
                              aria-label="Edit Agency"
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                              </svg>
                            </button>
                          )}
                        </div>
                      ) : (
                        // Changed: use same modal popup style as Accommodation
                        <div className="itn-edit-modal-overlay itn-accom-overlay" onClick={() => setIsEditingAgency(false)}>
                          <div className="itn-edit-modal itn-accom-modal" onClick={(e) => e.stopPropagation()}>
                            <div className="itn-edit-modal-header">
                              <h3>🏢 Edit Agency</h3>
                              <button
                                className="itn-edit-modal-close"
                                onClick={() => setIsEditingAgency(false)}
                              >
                                ✕
                              </button>
                            </div>
                            <div className="itn-edit-modal-body itn-accom-body">
                              <div className="itn-accom-container">
                                {/* Left: Form (reuse accom styles) */}
                                <div className="itn-accom-form">
                                  <h4 className="itn-accom-form-title">Agency Details</h4>
                                  <div className="itn-field">
                                    <label className="itn-field-label">Agency Name</label>
                                    <input
                                      placeholder="e.g., Travel Co., Tour Operator"
                                      value={agencyValue}
                                      onChange={(e) => setAgencyValue(e.target.value)}
                                    />
                                  </div>
                                  <div className="itn-field">
                                    <label className="itn-field-label">Agency Information</label>
                                    <textarea
                                      placeholder="Type, Location, Address, Phone, Email, Website, Valid Until, etc."
                                      value={agencyDetailsValue}
                                      onChange={(e) => setAgencyDetailsValue(e.target.value)}
                                      rows="8"
                                    />
                                  </div>
                                </div>

                                {/* Right: Agency Suggestions (reuse accom suggestion layout) */}
                                <div className="itn-accom-suggestions">
                                  <h4 className="itn-accom-suggestions-title">💡 Suggested Agencies</h4>
                                  <div className="itn-accom-suggestions-list">
                                    <AgencySuggestion
                                      details={item}
                                      onSelect={handleSelectAgency}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="itn-edit-modal-footer itn-edit-actions">
                              <button
                                className="itn-btn primary itn-save"
                                onClick={saveAgency}
                                disabled={isSaving}
                              >
                                {isSaving ? "Saving..." : "Save"}
                              </button>
                              <button
                                className="itn-btn ghost itn-cancel"
                                onClick={() => {
                                  setAgencyValue(item.agency || "");
                                  setAgencyDetailsValue(item.agencyDetails || "");
                                  setIsEditingAgency(false);
                                }}
                                disabled={isSaving}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </section>


                    {/* Activities Section (Editable) */}
                    <section className="itn-section card">
                      <div className="itn-section-label">🎯 Activities</div>
                      {!isEditingActivities ? (
                        <div className="itn-activities-display">
                          <div className="itn-activities-content">
                            {activities.length > 0 ? (
                              <div className="itn-activities-list">
                                {activities.map((activity, idx) => (
                                  <div key={idx} className="itn-activity-item">
                                    <span className="itn-activity-dot">•</span>
                                    <span className="itn-activity-text">{activity}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="itn-empty-state">Not set</div>
                            )}
                          </div>
                          {onEdit && (
                            <button
                              className="itn-edit-icon-btn"
                              onClick={() => setIsEditingActivities(true)}
                              title="Edit Activities"
                              aria-label="Edit Activities"
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                              </svg>
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="itn-edit-modal-overlay" onClick={() => setIsEditingActivities(false)}>
                          <div className="itn-edit-modal" onClick={(e) => e.stopPropagation()}>
                            <div className="itn-edit-modal-header">
                              <h3>🎯 Edit Activities</h3>
                              <button
                                className="itn-edit-modal-close"
                                onClick={() => setIsEditingActivities(false)}
                              >
                                ✕
                              </button>
                            </div>
                            <div className="itn-edit-modal-body">
                              <div className="itn-field">
                                <label className="itn-field-label">Activities (comma separated)</label>
                                <textarea
                                  placeholder="e.g., Hiking, Swimming, Sightseeing"
                                  value={activitiesEditValue}
                                  onChange={(e) => setActivitiesEditValue(e.target.value)}
                                  rows="6"
                                />
                              </div>
                            </div>
                            <div className="itn-edit-modal-footer">
                              <button
                                className="itn-btn primary"
                                onClick={saveActivities}
                                disabled={isSaving}
                              >
                                {isSaving ? "Saving..." : "Save"}
                              </button>
                              <button
                                className="itn-btn ghost"
                                onClick={() => {
                                  setIsEditingActivities(false);
                                  setActivitiesEditValue(Array.isArray(item.activities) ? item.activities.join(", ") : (item.activities || ""));
                                }}
                                disabled={isSaving}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </section>


                    {/* Notes Section (Editable) */}
                    <section className="itn-section card">
                      <div className="itn-section-label">📝 Notes</div>
                      {!isEditingNotes ? (
                        <div className="itn-notes-display">
                          <div className="itn-notes-content">
                            {item.notes ? (
                              <p className="itn-notes-text">{item.notes}</p>
                            ) : (
                              <div className="itn-empty-state">Not set</div>
                            )}
                          </div>
                          {onEdit && (
                            <button
                              className="itn-edit-icon-btn"
                              onClick={() => setIsEditingNotes(true)}
                              title="Edit Notes"
                              aria-label="Edit Notes"
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                              </svg>
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="itn-edit-modal-overlay" onClick={() => setIsEditingNotes(false)}>
                          <div className="itn-edit-modal" onClick={(e) => e.stopPropagation()}>
                            <div className="itn-edit-modal-header">
                              <h3>📝 Edit Notes</h3>
                              <button
                                className="itn-edit-modal-close"
                                onClick={() => setIsEditingNotes(false)}
                              >
                                ✕
                              </button>
                            </div>
                            <div className="itn-edit-modal-body">
                              <div className="itn-field">
                                <label className="itn-field-label">Notes</label>
                                <textarea
                                  placeholder="Add your notes here..."
                                  value={notesEditValue}
                                  onChange={(e) => setNotesEditValue(e.target.value)}
                                  rows="6"
                                />
                              </div>
                            </div>
                            <div className="itn-edit-modal-footer">
                              <button
                                className="itn-btn primary"
                                onClick={saveNotes}
                                disabled={isSaving}
                              >
                                {isSaving ? "Saving..." : "Save"}
                              </button>
                              <button
                                className="itn-btn ghost"
                                onClick={() => {
                                  setIsEditingNotes(false);
                                  setNotesEditValue(item.notes || "");
                                }}
                                disabled={isSaving}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </section>

                    {/* AI itinerary display removed (start fresh) */}
                  </div>


                  {/* RIGHT COLUMN: Sticky Summary (Budget, Time, Packing) */}
                  <aside className="itn-body-side">
                    {/* 1. Estimated Expenditure */}
                    {item.estimatedExpenditure && (
                      <div className="itn-expenditure">
                        <div className="itn-exp-label">Estimated Expenditure</div>
                        <div className="itn-exp-value">₱{Number(item.estimatedExpenditure).toLocaleString()}</div>
                        <div className="itn-summary-note" style={{ opacity: 0.85, fontWeight: 600, fontSize: 13 }}>Quick total</div>
                      </div>
                    )}


                    {/* 2. Price Breakdown */}
                    {breakdownItems && breakdownItems.length > 0 && (
                      <section className="itn-section">
                        <div style={{display: "flex", alignItems: "center", justifyContent: "space-between"}}>
                          <div className="itn-title" style={{margin: 0}}>
                            <span className="itn-title-accent" />
                            <span>💰 Breakdown</span>
                          </div>
                          {/* Edit icon for Breakdown */}
                          {onEdit && (
                            <div style={{marginLeft: 8}}>
                              <button
                                className="itn-edit-icon-btn"
                                onClick={() => {
                                  setIsEditingBreakdown(true);
                                  // initialize editor with latest breakdown in case it changed
                                  const lines =
                                    item.breakdown && Array.isArray(item.breakdown) && item.breakdown.length > 0
                                      ? item.breakdown
                                      : getBreakdownFromRules(item.estimatedExpenditure || item.price || item.budget);
                                  setBreakdownEditItems(getBreakdownEditItemsFromLines(lines));
                                }}
                                title="Edit Breakdown"
                                aria-label="Edit Breakdown"
                              >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                </svg>
                              </button>
                            </div>
                          )}
                        </div>
                        <div className="itn-list-card compact">
                          {breakdownItems.map((line, i) => {
                            const { label, amount } = parseBreakdown(line);
                            return (
                              <div className="itn-list-row" key={i}>
                                <span className="itn-list-label">{label}</span>
                                <span className="itn-list-amount">{amount || ""}</span>
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    )}


                    {/* 3. Best Time */}
                    {item.bestTime && (
                      <section className="itn-section">
                        <div className="itn-band">
                          <div className="itn-band-label">Best Time to Visit</div>
                          <div className="itn-band-value">{item.bestTime}</div>
                        </div>
                      </section>
                    )}


                    {/* 4. Arrival / Departure */}
                    {(item.arrival || item.departure) && (
                      <section className="itn-section grid-2">
                        {item.arrival && (
                          <div className="itn-mini">
                            <div className="itn-mini-label">✈️ Arrival</div>
                            <div className="itn-mini-value">{item.arrival}</div>
                          </div>
                        )}
                        {item.departure && (
                          <div className="itn-mini">
                            <div className="itn-mini-label">🏠 Departure</div>
                            <div className="itn-mini-value">{item.departure}</div>
                          </div>
                        )}
                      </section>
                    )}


                    {/* 5. Packing */}
                    {packingSuggestions && packingSuggestions.length > 0 && (
                      <section className="itn-section itn-section-summary">
                        <div className="itn-title">
                          <span className="itn-title-accent" />
                          <span>🧳 Packing</span>
                        </div>
                        <div className="itn-pack-grid itn-pack-grid-chips compact">
                          {packingSuggestions.map((p, i) => {
                            const selected = packingSelected.includes(p);
                            return (
                              <button
                                key={i}
                                className={`itn-chip-pill ${selected ? "selected" : ""}`}
                                onClick={() => togglePacking(p)}
                                aria-pressed={selected}
                              >
                                {p}
                              </button>
                            );
                          })}


                          {/* Custom packing items */}
                          {packingSelected.filter(
                            p => !packingSuggestions.includes(p)
                          ).map((customItem, idx) => (
                            <div
                              key={`custom-${idx}`}
                              className="itn-chip-pill selected itn-custom-packing-item"
                            >
                              <span>{customItem}</span>
                              <button
                                className="itn-custom-packing-remove"
                                onClick={() => removePackingItem(customItem)}
                                title="Remove item"
                                aria-label="Remove custom packing item"
                              >
                                ✕
                              </button>
                            </div>
                          ))}


                          {/* Add custom item button */}
                          {!isAddingPackingItem ? (
                            <button
                              className="itn-chip-pill itn-add-packing-btn"
                              onClick={() => setIsAddingPackingItem(true)}
                              title="Add custom item"
                            >
                              Add item
                            </button>
                          ) : (
                            <div className="itn-add-packing-input-wrapper">
                              <input
                                type="text"
                                placeholder="Enter item..."
                                value={customPackingItem}
                                onChange={(e) => setCustomPackingItem(e.target.value)}
                                onKeyPress={(e) => {
                                  if (e.key === "Enter") addCustomPackingItem();
                                }}
                                autoFocus
                                className="itn-add-packing-input"
                              />
                              <button
                                className="itn-btn primary"
                                onClick={addCustomPackingItem}
                              >
                                Add
                              </button>
                              <button
                                className="itn-btn ghost"
                                onClick={() => {
                                  setIsAddingPackingItem(false);
                                  setCustomPackingItem("");
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </div>
                      </section>
                    )}
                  </aside>
                </div>
              </div>


              {/* Footer: Save + Close buttons */}
              <footer className="itn-modal-footer">
                <button className="itn-btn ghost" onClick={closeModal}>
                  Close
                </button>
                <button className="itn-btn primary" onClick={closeModal}>
                  Save
                </button>
              </footer>


              {/* Error notification */}
              {saveError && (
                <div style={{
                  position: "fixed",
                  top: "20px",
                  right: "20px",
                  background: "#fee2e2",
                  color: "#991b1b",
                  padding: "12px 16px",
                  borderRadius: "8px",
                  zIndex: 10001,
                }}>
                  Error: {saveError}
                </div>
              )}


              {/* Loading state */}
              {isSaving && (
                <div style={{
                  position: "fixed",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  background: "white",
                  padding: "20px 40px",
                  borderRadius: "8px",
                  boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                  zIndex: 10000,
                }}>
                  <p style={{ margin: 0 }}>Saving...</p>
                </div>
              )}
            </div>
          </div>,
          document.body
        )}


      {/* Breakdown Edit Modal */}
      {isEditingBreakdown &&
        ReactDOM.createPortal(
          <div
            className="itn-edit-modal-overlay itn-accom-overlay"
            role="dialog"
            aria-modal="true"
            onClick={() => cancelBreakdownEdit()}
          >
            <div className="itn-edit-modal itn-accom-modal" onClick={(e) => e.stopPropagation()} aria-label="Edit Breakdown">
              <div className="itn-edit-modal-header">
                <h3>💰 Edit Breakdown</h3>
                <button
                  className="itn-edit-modal-close"
                  onClick={() => cancelBreakdownEdit()}
                >
                  ✕
                </button>
              </div>
              <div className="itn-edit-modal-body itn-accom-body">
                <div style={{display: "flex", flexDirection: "column", gap: 12}}>
                  <p style={{margin: 0, color: "#475569"}}>Edit line items, amounts, add or remove rows. Amounts can include a ₱ symbol or be numeric.</p>
                  {breakdownEditItems.map((b, idx) => (
                    <div key={idx} style={{display: "flex", gap: 8, alignItems: "center"}}>
                      <input
                        className="itn-field"
                        style={{flex: 1, padding: "10px 12px", borderRadius: 8}}
                        placeholder="Label"
                        value={b.label}
                        onChange={(e) => {
                          const next = [...breakdownEditItems];
                          next[idx] = { ...b, label: e.target.value };
                          setBreakdownEditItems(next);
                        }}
                      />
                      <input
                        className="itn-field"
                        style={{width: 140, padding: "10px 12px", borderRadius: 8}}
                        placeholder="Amount (e.g., ₱1,200)"
                        value={b.amount}
                        onChange={(e) => {
                          const next = [...breakdownEditItems];
                          next[idx] = { ...b, amount: e.target.value };
                          setBreakdownEditItems(next);
                        }}
                      />
                      <button
                        className="itn-btn danger sm"
                        onClick={() => removeBreakdownLine(idx)}
                        title="Remove line"
                        aria-label="Remove line"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <div style={{display: "flex", gap: 8}}>
                    <button className="itn-btn ghost" onClick={addBreakdownLine}>+ Add line</button>
                    <div style={{flex: 1}} />
                    <div style={{alignSelf: "end"}}>
                      <div style={{color: "#6b7280", fontWeight: 700}}>
                        Total: ₱{breakdownEditItems.reduce((s, {amount}) => s + parseAmountValue(amount), 0).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="itn-edit-modal-footer itn-edit-actions">
                <button
                  className="itn-btn primary itn-save"
                  onClick={saveBreakdown}
                  disabled={isSaving}
                >
                  {isSaving ? "Saving..." : "Save"}
                </button>
                <button
                  className="itn-btn ghost itn-cancel"
                  onClick={() => cancelBreakdownEdit()}
                  disabled={isSaving}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* AI UI removed — starting fresh */}
    </>
  );
}

