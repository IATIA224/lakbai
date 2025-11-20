import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export async function exportItineraryToPDF(items) {
  console.log("[ExportPDFButton] called with items:", items.map(i => i.name));
  if (!Array.isArray(items) || items.length === 0) {
    alert("No destinations selected for export.");
    return;
  }

  try {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let y = 40;
    let pageIndex = 1;
    const logoText = "My Travel Itinerary";
    const genDate = new Date().toLocaleString();

    function drawHeader() {
      doc.setFillColor(59, 130, 246);
      doc.rect(0, 0, pageWidth, 56, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont(undefined, "bold");
      doc.text(logoText, 40, 36);
      doc.setFontSize(10);
      doc.setFont(undefined, "normal");
      doc.text(`Generated: ${genDate}`, pageWidth - 40, 36, { align: "right" });
      doc.setDrawColor(234, 88, 12);
      doc.setLineWidth(1.5);
      doc.line(40, 58, pageWidth - 40, 58);
      y = 80;
    }

    function drawFooter() {
      doc.setFontSize(10);
      doc.setTextColor(120, 120, 120);
      doc.text(`Page ${pageIndex}`, pageWidth - 40, pageHeight - 30, { align: "right" });
      pageIndex++;
    }

    // Replace previous table helpers with plain text rendering helpers
    function ensurePageSpace(needed = 120) {
      if (y > pageHeight - needed) {
        drawFooter();
        doc.addPage();
        drawHeader();
      }
    }

    function drawSectionTitle(title) {
      if (y > pageHeight - 100) {
        drawFooter();
        doc.addPage();
        drawHeader();
      }
      doc.setFont(undefined, "bold");
      doc.setFontSize(13);
      doc.setTextColor(20, 30, 48);
      doc.text(title, 40, y);
      y += 8;
      // removed green accent — use a subtle neutral separator instead
      doc.setDrawColor(229, 231, 235);
      doc.setLineWidth(0.6);
      doc.line(40, y, pageWidth - 40, y);
      y += 12;
    }

    // Print rows of key/value pairs as plain text, no table
    function drawKeyValueText(rows) {
      if (!rows || rows.length === 0) return;
      const keyX = 50;
      const valX = 170;
      for (const [key, val] of rows) {
        ensurePageSpace(80);
        doc.setFontSize(10);
        doc.setFont(undefined, "bold");
        doc.setTextColor(51, 65, 85);
        doc.text(`${key}`, keyX, y);
        doc.setFont(undefined, "normal");
        const valLines = doc.splitTextToSize(String(val || ""), pageWidth - valX - 40);
        doc.text(valLines, valX, y);
        y += valLines.length * 12 + 8;
      }
      y += 6;
    }

    // Print a single paragraph block (for longer details)
    function drawParagraph(title, text) {
      if (!text) return;
      drawSectionTitle(title);
      ensurePageSpace(100);
      doc.setFontSize(10);
      doc.setFont(undefined, "normal");
      doc.setTextColor(51, 65, 85);
      const lines = doc.splitTextToSize(String(text), pageWidth - 80);
      doc.text(lines, 50, y);
      y += lines.length * 12 + 12;
    }

    // Print bullet/numbered lists
    function drawList(title, itemsList) {
      if (!itemsList || itemsList.length === 0) return;
      drawSectionTitle(title);
      doc.setFontSize(10);
      doc.setFont(undefined, "normal");
      doc.setTextColor(51, 65, 85);
      for (let i = 0; i < itemsList.length; i++) {
        ensurePageSpace(60);
        const text = `${i + 1}. ${itemsList[i]}`;
        const lines = doc.splitTextToSize(text, pageWidth - 100);
        doc.text(lines, 60, y);
        y += lines.length * 12 + 6;
      }
      y += 8;
    }

    drawHeader();

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      if (y > pageHeight - 160) {
        drawFooter();
        doc.addPage();
        drawHeader();
      }

      // ========== DESTINATION HEADER ==========
      doc.setFontSize(16);
      doc.setFont(undefined, "bold");
      doc.setTextColor(20, 30, 48);
      doc.text(`${i + 1}. ${item.name}`, 40, y);
      y += 20;

      // Region & Location
      doc.setFontSize(10);
      doc.setFont(undefined, "normal");
      doc.setTextColor(95, 110, 131);
      if (item.region) {
        doc.text(`Region: ${item.region}`, 40, y);
        y += 12;
      }
      if (item.location) {
        const splitLoc = doc.splitTextToSize(`Location: ${item.location}`, pageWidth - 120);
        doc.text(splitLoc, 40, y);
        y += splitLoc.length * 10 + 4;
      }
      y += 8;

      // ========== TRAVEL DATES / STATUS (plain text)
      const days =
        item.arrival && item.departure
          ? Math.max(1, Math.ceil(
              (new Date(item.departure).getTime() - new Date(item.arrival).getTime()) /
                (1000 * 60 * 60 * 24)
            ))
          : 0;

      const dateDetails = [];
      if (item.arrival) dateDetails.push(["Arrival", item.arrival]);
      if (item.departure) dateDetails.push(["Departure", item.departure]);
      if (days > 0) dateDetails.push(["Duration", `${days} day${days !== 1 ? "s" : ""}`]);
      if (item.status) dateDetails.push(["Status", item.status]);
      if (dateDetails.length > 0) {
        drawSectionTitle("Trip Details");
        drawKeyValueText(dateDetails);
      }

      // ========== BUDGET & EXPENDITURE ==========
      if (item.estimatedExpenditure > 0) {
        drawSectionTitle("Budget");
        doc.setFontSize(11);
        doc.setFont(undefined, "normal");
        doc.setTextColor(15, 23, 42);
        doc.text(`Estimated Total: PHP ${Number(item.estimatedExpenditure).toLocaleString()}`, 50, y);
        y += 18;
      }

      // ========== ACCOMMODATION (plain key/value)
      if (item.accomName || item.accomType || item.accomNotes) {
        drawSectionTitle("Accommodation");
        const accomDetails = [];
        if (item.accomType) accomDetails.push(["Type", item.accomType]);
        if (item.accomName) accomDetails.push(["Name", item.accomName]);
        if (item.accomNotes) accomDetails.push(["Details", item.accomNotes]);
        drawKeyValueText(accomDetails);
      }

      // ========== TRANSPORTATION (plain key/value)
      if (item.transport || item.transportNotes) {
        drawSectionTitle("Transportation");
        const transDetails = [];
        if (item.transport) transDetails.push(["Mode", item.transport]);
        if (item.transportNotes) transDetails.push(["Notes", item.transportNotes]);
        drawKeyValueText(transDetails);
      }

      // ========== TRAVEL AGENCY (plain paragraph)
      if (item.agency) {
        drawParagraph("Travel Agency", item.agency);
      }

      // ========== ACTIVITIES ==========
      drawList("Activities & Things to Do", item.activities || []);

      // ========== PACKING SUGGESTIONS ==========
      drawList("Packing Suggestions", item.packingSuggestions || []);

      // ========== NOTES ==========
      drawParagraph("Additional Notes", item.notes);

      // Separator between items
      if (i < items.length - 1) {
        y += 16;
        doc.setDrawColor(229, 231, 235);
        doc.setLineWidth(0.5);
        doc.line(40, y, pageWidth - 40, y);
        y += 16;
      }
    }

    // Final footer
    drawFooter();

    // Save PDF
    doc.save("itinerary-export.pdf");
    console.log("[ExportPDFButton] PDF saved successfully");

    // Fallback: create blob and open in new tab
    try {
      await new Promise((res) => setTimeout(res, 100));
      const blob = doc.output("blob");
      if (blob && blob.size) {
        const url = URL.createObjectURL(blob);
        console.log("[ExportPDFButton] Opening PDF in new tab");
        window.open(url, "_blank");
        setTimeout(() => URL.revokeObjectURL(url), 30000);
      }
    } catch (fallbackErr) {
      console.warn("[ExportPDFButton] Fallback failed:", fallbackErr);
    }
  } catch (err) {
    console.error("[ExportPDFButton] Export to PDF failed:", err);
    alert("Export to PDF failed. Check console for details.");
    throw err;
  }
}