const fs = require("fs");
const path = require("path");
const glob = require("glob");
const { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType } = require("docx");

const TEST_DIR = path.join(__dirname, "src", "__test__");
const OUTPUT = path.join(__dirname, "TestCases.docx");

// Helper to extract test cases from a file
function extractTestCases(fileContent) {
    const regex = /(it|test)\s*\(\s*['"`](.+?)['"`],/g;
    const cases = [];
    let match;
    while ((match = regex.exec(fileContent))) {
        cases.push(match[2]);
    }
    return cases;
}

// Helper to prettify module name
function moduleNameFromFile(file) {
    return path.basename(file).replace(/\.test\.js$/, "").replace(/([A-Z])/g, " $1").replace(/^\w/, c => c.toUpperCase()).trim();
}

// Table headers
const headers = [
    "Test Case ID",
    "Test Case Name",
    "Module Name",
    "Precondition",
    "Test Steps",
    "Test Data",
    "Expected Result",
    "Actual Result",
    "Status",
    "Ticket # (If proven issue)"
];

// Find all .test.js files
const files = glob.sync(path.join(TEST_DIR, "*.test.js"));

let rows = [
    new TableRow({
        children: headers.map(h =>
            new TableCell({
                children: [new Paragraph({ text: h, bold: true })],
                width: { size: 15, type: WidthType.PERCENTAGE }
            })
        )
    })
];

let tcCounter = 1;

files.forEach(file => {
    const content = fs.readFileSync(file, "utf8");
    const testCases = extractTestCases(content);
    const moduleName = moduleNameFromFile(file);

    testCases.forEach(tc => {
        rows.push(
            new TableRow({
                children: [
                    new TableCell({ children: [new Paragraph(`TC${tcCounter.toString().padStart(3, "0")}`)] }),
                    new TableCell({ children: [new Paragraph(tc)] }),
                    new TableCell({ children: [new Paragraph(moduleName)] }),
                    new TableCell({ children: [new Paragraph("")] }), // Precondition
                    new TableCell({ children: [new Paragraph("")] }), // Test Steps
                    new TableCell({ children: [new Paragraph("")] }), // Test Data
                    new TableCell({ children: [new Paragraph("")] }), // Expected Result
                    new TableCell({ children: [new Paragraph("")] }), // Actual Result
                    new TableCell({ children: [new Paragraph("")] }), // Status
                    new TableCell({ children: [new Paragraph("")] })  // Ticket #
                ]
            })
        );
        tcCounter++;
    });
});

const table = new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE }
});

const doc = new Document({
    sections: [
        {
            properties: {},
            children: [
                new Paragraph({
                    children: [new TextRun({ text: "Test Case Table", bold: true, size: 32 })],
                    spacing: { after: 300 }
                }),
                table
            ]
        }
    ]
});

Packer.toBuffer(doc).then(buffer => {
    fs.writeFileSync(OUTPUT, buffer);
    console.log(`Test case document generated: ${OUTPUT}`);
});