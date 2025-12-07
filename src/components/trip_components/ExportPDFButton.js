import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/**
 * Export itinerary items to PDF with optional group information
 * @param {Array} items - Array of itinerary items
 * @param {Array} groups - Optional array of groups for organized export
 */
export async function exportItineraryToPDF(items, groups = []) {
  if (!items || items.length === 0) {
    throw new Error("No items to export");
  }

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let yPos = margin;

  // Helper function to add new page if needed
  const checkPageBreak = (requiredSpace = 40) => {
    if (yPos + requiredSpace > pageHeight - margin) {
      doc.addPage();
      yPos = margin;
      return true;
    }
    return false;
  };

  // Header
  doc.setFillColor(99, 102, 241); // Indigo
  doc.rect(0, 0, pageWidth, 35, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text("Travel Itinerary", margin, 18);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Generated on ${new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })}`, margin, 28);

  doc.text(`${items.length} destination${items.length !== 1 ? 's' : ''}`, pageWidth - margin - 40, 28);

  yPos = 45;

  // Calculate trip summary
  let totalBudget = 0;
  let totalDays = 0;
  const regions = new Set();
  const statuses = { Upcoming: 0, Ongoing: 0, Completed: 0 };

  items.forEach((item) => {
    totalBudget += Number(item.estimatedExpenditure) || Number(item.budget) || 0;
    regions.add(item.region || "Unknown");
    if (item.status) statuses[item.status] = (statuses[item.status] || 0) + 1;
    if (item.arrival && item.departure) {
      const days = Math.ceil(
        (new Date(item.departure) - new Date(item.arrival)) / (1000 * 60 * 60 * 24)
      );
      totalDays += Math.max(1, days);
    }
  });

  // Summary Box
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 25, 3, 3, "F");

  doc.setTextColor(71, 85, 105);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");

  const summaryY = yPos + 10;
  const colWidth = (pageWidth - 2 * margin) / 4;

  doc.text("TOTAL BUDGET", margin + 5, summaryY);
  doc.text("DESTINATIONS", margin + colWidth + 5, summaryY);
  doc.text("TOTAL DAYS", margin + colWidth * 2 + 5, summaryY);
  doc.text("REGIONS", margin + colWidth * 3 + 5, summaryY);

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(11);
  doc.text(`P${totalBudget.toLocaleString()}`, margin + 5, summaryY + 8);
  doc.text(`${items.length}`, margin + colWidth + 5, summaryY + 8);
  doc.text(`${totalDays}`, margin + colWidth * 2 + 5, summaryY + 8);
  doc.text(`${regions.size}`, margin + colWidth * 3 + 5, summaryY + 8);

  yPos += 35;

  // Check if we have groups to organize by
  const hasGroups = groups && groups.length > 0;
  
  if (hasGroups) {
    // Export organized by groups
    for (const group of groups) {
      checkPageBreak(60);

      // Group Header
      doc.setFillColor(99, 102, 241);
      doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 18, 3, 3, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(`${group.name || 'Trip Group'}`, margin + 5, yPos + 11);

      // Group date range
      if (group.startDate || group.endDate) {
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        const dateText = `${formatDateForPDF(group.startDate)} - ${formatDateForPDF(group.endDate)}`;
        doc.text(dateText, pageWidth - margin - 5 - doc.getTextWidth(dateText), yPos + 11);
      }

      yPos += 25;

      // Group description if available
      if (group.description) {
        doc.setTextColor(71, 85, 105);
        doc.setFontSize(9);
        doc.setFont("helvetica", "italic");
        const descLines = doc.splitTextToSize(group.description, pageWidth - 2 * margin - 10);
        doc.text(descLines, margin + 5, yPos);
        yPos += descLines.length * 5 + 5;
      }

      // Group budget if available
      if (group.totalBudget || group.budget) {
        doc.setTextColor(34, 197, 94);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(`Group Budget: P${Number(group.totalBudget || group.budget).toLocaleString()}`, margin + 5, yPos);
        yPos += 8;
      }

      // Get items for this group
      const groupItemIds = group.destinationIds || Object.keys(group.assignments || {});
      const groupItems = items.filter(item => groupItemIds.includes(item.id));

      // Sort by day if assignments exist
      if (group.assignments) {
        groupItems.sort((a, b) => {
          const dayA = group.assignments[a.id] || 999;
          const dayB = group.assignments[b.id] || 999;
          return dayA - dayB;
        });
      }

      // Export each item in the group
      for (const item of groupItems) {
        const dayNum = group.assignments?.[item.id];
        yPos = await exportSingleItem(doc, item, margin, pageWidth, yPos, checkPageBreak, dayNum);
      }

      if (groupItems.length === 0) {
        doc.setTextColor(148, 163, 184);
        doc.setFontSize(10);
        doc.text("No destinations in this group", margin + 5, yPos);
        yPos += 15;
      }

      yPos += 10;
    }

    // Export ungrouped items if any
    const groupedIds = new Set();
    groups.forEach(g => {
      const ids = g.destinationIds || Object.keys(g.assignments || {});
      ids.forEach(id => groupedIds.add(id));
    });
    const ungroupedItems = items.filter(item => !groupedIds.has(item.id));

    if (ungroupedItems.length > 0) {
      checkPageBreak(60);

      // Ungrouped Header
      doc.setFillColor(100, 116, 139);
      doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 18, 3, 3, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Other Destinations", margin + 5, yPos + 11);

      yPos += 25;

      for (const item of ungroupedItems) {
        yPos = await exportSingleItem(doc, item, margin, pageWidth, yPos, checkPageBreak);
      }
    }
  } else {
    // Export all items without grouping
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      yPos = await exportSingleItem(doc, item, margin, pageWidth, yPos, checkPageBreak, null, i + 1);
    }
  }

  // Footer on all pages
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const footerY = pageHeight - 10;
    doc.setFillColor(248, 250, 252);
    doc.rect(0, footerY - 5, pageWidth, 15, "F");

    doc.setTextColor(148, 163, 184);
    doc.setFontSize(8);
    doc.text("Generated by LakbAI Travel Planner", margin, footerY);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin - 25, footerY);
  }

  // Save the PDF
  const fileName = `travel-itinerary-${new Date().toISOString().split("T")[0]}.pdf`;
  doc.save(fileName);

  return fileName;
}

// Helper to format dates
function formatDateForPDF(dateString) {
  if (!dateString) return "-";
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  } catch {
    return dateString;
  }
}

// Helper function to export a single item with ALL details
async function exportSingleItem(doc, item, margin, pageWidth, yPos, checkPageBreak, dayNumber = null, itemIndex = null) {
  checkPageBreak(100);

  // Destination Card Header
  const headerColor = item.status === "Completed" ? [34, 197, 94] : 
                      item.status === "Ongoing" ? [245, 158, 11] : [59, 130, 246];
  
  doc.setFillColor(...headerColor);
  doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 14, 2, 2, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");

  let titlePrefix = "";
  if (dayNumber) titlePrefix = `Day ${dayNumber} - `;
  else if (itemIndex) titlePrefix = `${itemIndex}. `;

  const destinationName = item.name || item.display_name?.split(",")[0] || "Destination";
  doc.text(`${titlePrefix}${destinationName}`, margin + 4, yPos + 9);

  // Status badge
  doc.setFontSize(8);
  const statusText = item.status || "Upcoming";
  const statusWidth = doc.getTextWidth(statusText) + 8;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(pageWidth - margin - statusWidth - 4, yPos + 3, statusWidth, 8, 2, 2, "F");
  doc.setTextColor(...headerColor);
  doc.text(statusText, pageWidth - margin - statusWidth, yPos + 8.5);

  yPos += 18;

  // Build comprehensive details table
  const tableData = [];

  // Location Details Section
  if (item.region || item.location || item.display_name) {
    tableData.push([{ content: "LOCATION DETAILS", colSpan: 2, styles: { fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [51, 65, 85] } }]);
    
    if (item.region) {
      tableData.push(["Region", item.region]);
    }
    if (item.location) {
      tableData.push(["Address", item.location]);
    }
    if (item.display_name && item.display_name !== item.name) {
      tableData.push(["Full Name", item.display_name]);
    }
    if (item.lat && item.lon) {
      tableData.push(["Coordinates", `${item.lat}, ${item.lon}`]);
    }
  }

  // Travel Dates Section
  if (item.arrival || item.departure) {
    tableData.push([{ content: "TRAVEL DATES", colSpan: 2, styles: { fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [51, 65, 85] } }]);
    
    if (item.arrival) {
      tableData.push(["Arrival", formatDateForPDF(item.arrival)]);
    }
    if (item.departure) {
      tableData.push(["Departure", formatDateForPDF(item.departure)]);
    }
    if (item.arrival && item.departure) {
      const days = Math.max(1, Math.ceil((new Date(item.departure) - new Date(item.arrival)) / (1000 * 60 * 60 * 24)));
      tableData.push(["Duration", `${days} day${days > 1 ? 's' : ''}`]);
    }
    if (item.bestTime) {
      tableData.push(["Best Time to Visit", item.bestTime]);
    }
  }

  // Budget & Cost Section
  const hasBudgetInfo = item.estimatedExpenditure || item.budget || item.price || item.priceTier || (item.breakdown && item.breakdown.length > 0);
  if (hasBudgetInfo) {
    tableData.push([{ content: "BUDGET & COSTS", colSpan: 2, styles: { fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [51, 65, 85] } }]);
    
    if (item.estimatedExpenditure || item.budget) {
      tableData.push(["Estimated Budget", `P${Number(item.estimatedExpenditure || item.budget).toLocaleString()}`]);
    }
    if (item.price) {
      tableData.push(["Price Range", item.price]);
    }
    if (item.priceTier) {
      tableData.push(["Price Tier", item.priceTier]);
    }
    // Cost breakdown
    if (item.breakdown && item.breakdown.length > 0) {
      const breakdownText = item.breakdown.map(b => {
        if (typeof b === 'object') {
          return `${b.category || b.name || 'Item'}: P${Number(b.amount || b.cost || 0).toLocaleString()}`;
        }
        return String(b);
      }).join("; ");
      tableData.push(["Cost Breakdown", breakdownText]);
    }
  }

  // Accommodation Section
  const hasAccomInfo = item.accomType || item.accomName || item.accomNotes;
  if (hasAccomInfo) {
    tableData.push([{ content: "ACCOMMODATION", colSpan: 2, styles: { fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [51, 65, 85] } }]);
    
    if (item.accomType) {
      tableData.push(["Type", item.accomType]);
    }
    if (item.accomName) {
      tableData.push(["Name/Hotel", item.accomName]);
    }
    if (item.accomNotes) {
      tableData.push(["Accommodation Notes", item.accomNotes]);
    }
  }

  // Transportation Section
  const hasTransportInfo = item.transport || item.transportNotes || item.agency;
  if (hasTransportInfo) {
    tableData.push([{ content: "TRANSPORTATION", colSpan: 2, styles: { fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [51, 65, 85] } }]);
    
    if (item.transport) {
      tableData.push(["Transport Mode", item.transport]);
    }
    if (item.transportNotes) {
      tableData.push(["Transport Details", item.transportNotes]);
    }
    if (item.agency) {
      tableData.push(["Travel Agency", item.agency]);
    }
  }

  // Activities Section
  const activities = Array.isArray(item.activities) ? item.activities : 
                     (item.activities ? String(item.activities).split(",").map(a => a.trim()).filter(a => a) : []);
  if (activities.length > 0) {
    tableData.push([{ content: "PLANNED ACTIVITIES", colSpan: 2, styles: { fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [51, 65, 85] } }]);
    
    activities.forEach((activity, idx) => {
      tableData.push([`Activity ${idx + 1}`, activity]);
    });
  }

  // Packing Suggestions Section
  const packingSuggestions = Array.isArray(item.packingSuggestions) ? item.packingSuggestions :
                             (item.packingSuggestions ? String(item.packingSuggestions).split(",").map(p => p.trim()).filter(p => p) : []);
  if (packingSuggestions.length > 0 || item.packingCategory) {
    tableData.push([{ content: "PACKING LIST", colSpan: 2, styles: { fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [51, 65, 85] } }]);
    
    if (item.packingCategory) {
      tableData.push(["Category", item.packingCategory]);
    }
    if (packingSuggestions.length > 0) {
      // Group packing items - show up to 10 per row
      const packingText = packingSuggestions.join(", ");
      tableData.push(["Items to Pack", packingText]);
    }
  }

  // Tags & Categories Section
  const tags = Array.isArray(item.tags) ? item.tags : [];
  const categories = Array.isArray(item.categories) ? item.categories : [];
  if (tags.length > 0 || categories.length > 0) {
    tableData.push([{ content: "TAGS & CATEGORIES", colSpan: 2, styles: { fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [51, 65, 85] } }]);
    
    if (categories.length > 0) {
      tableData.push(["Categories", categories.join(", ")]);
    }
    if (tags.length > 0) {
      tableData.push(["Tags", tags.join(", ")]);
    }
  }

  // Additional Info Section
  const hasAdditionalInfo = item.description || item.notes || item.rating;
  if (hasAdditionalInfo) {
    tableData.push([{ content: "ADDITIONAL INFORMATION", colSpan: 2, styles: { fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [51, 65, 85] } }]);
    
    if (item.rating) {
      const ratingStars = "★".repeat(Math.floor(Number(item.rating))) + "☆".repeat(5 - Math.floor(Number(item.rating)));
      tableData.push(["Rating", `${item.rating}/5 ${ratingStars}`]);
    }
    if (item.description) {
      tableData.push(["Description", item.description]);
    }
    if (item.notes) {
      tableData.push(["Notes", item.notes]);
    }
  }

  // Render the table
  if (tableData.length > 0) {
    autoTable(doc, {
      startY: yPos,
      head: [],
      body: tableData,
      theme: "plain",
      margin: { left: margin, right: margin },
      styles: {
        fontSize: 9,
        cellPadding: 4,
        textColor: [51, 65, 85],
        overflow: "linebreak",
        lineWidth: 0.1,
        lineColor: [226, 232, 240],
      },
      columnStyles: {
        0: { 
          fontStyle: "bold", 
          cellWidth: 40,
          textColor: [71, 85, 105],
          fillColor: [255, 255, 255]
        },
        1: { 
          cellWidth: "auto",
          fillColor: [255, 255, 255]
        },
      },
      didParseCell: (data) => {
        // Style section headers
        if (data.cell.colSpan === 2) {
          data.cell.styles.halign = 'left';
          data.cell.styles.fontSize = 10;
        }
      },
      didDrawCell: (data) => {
        // Add subtle border
        if (data.row.index === tableData.length - 1) {
          doc.setDrawColor(226, 232, 240);
          doc.line(
            data.cell.x,
            data.cell.y + data.cell.height,
            data.cell.x + data.cell.width,
            data.cell.y + data.cell.height
          );
        }
      },
    });

    yPos = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 12 : yPos + 80;
  } else {
    // No details available
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(9);
    doc.text("No additional details available", margin + 5, yPos);
    yPos += 15;
  }

  return yPos;
}

export default exportItineraryToPDF;