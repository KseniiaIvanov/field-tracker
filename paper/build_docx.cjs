// Converts MANUSCRIPT_MEE.md -> MANUSCRIPT_MEE.docx using docx-js
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, ImageRun,
  AlignmentType, HeadingLevel, LevelFormat, BorderStyle, PageNumber, Header, Footer,
  Table, TableRow, TableCell, WidthType, ShadingType, LineNumberRestartFormat,
} = require("docx");

// SUBMISSION=1 -> double line spacing + continuous line numbers, output *_submission.docx
const SUBMISSION = process.env.SUBMISSION === "1";
const OUT_NAME = SUBMISSION ? "MANUSCRIPT_MEE_submission.docx" : "MANUSCRIPT_MEE.docx";
const BODY_LINE = SUBMISSION ? 480 : 240; // 240 = single, 480 = double

const CONTENT_W = 9360; // US Letter, 1in margins
const cellBorder = { style: BorderStyle.SINGLE, size: 1, color: "BBBBBB" };
const cellBorders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };

const ROOT = __dirname; // manuscript materials live alongside this script (paper/)
const md = fs.readFileSync(path.join(ROOT, "MANUSCRIPT_MEE.md"), "utf8");
const lines = md.split("\n");

// ---- inline parser: **bold**, *italic*, `code` ----
function parseInline(text, base = {}) {
  const runs = [];
  // tokenize by markers
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0, m;
  function push(str, opts) {
    if (str === "") return;
    runs.push(new TextRun({ text: str, ...base, ...opts }));
  }
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) push(text.slice(last, m.index), {});
    const tok = m[0];
    if (tok.startsWith("**")) push(tok.slice(2, -2), { bold: true });
    else if (tok.startsWith("`")) push(tok.slice(1, -1), { font: "Consolas" });
    else push(tok.slice(1, -1), { italics: true });
    last = re.lastIndex;
  }
  if (last < text.length) push(text.slice(last), {});
  if (runs.length === 0) push(text, {});
  return runs;
}

const children = [];
const HR_BORDER = { bottom: { style: BorderStyle.SINGLE, size: 6, color: "999999", space: 6 } };

// figure embedding map: insert image after caption paragraphs that start with these markers
const figureFiles = {
  "Figure 1.": "figures/Figure1_application.png",
  "Figure 2.": "figures/Figure2_representativeness.png",
};

function imageParagraph(relPath) {
  const data = fs.readFileSync(path.join(ROOT, relPath));
  // constrain width to ~6.0 in (page content width). Read intrinsic size to keep aspect ratio.
  const dim = pngSize(data);
  const maxW = 600; // px target ~6.25in at 96dpi -> docx uses px as points-ish; use transformation
  const scale = Math.min(1, maxW / dim.w);
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 120, after: 120 },
    children: [new ImageRun({
      type: "png",
      data,
      transformation: { width: Math.round(dim.w * scale), height: Math.round(dim.h * scale) },
      altText: { title: relPath, description: relPath, name: relPath },
    })],
  });
}

function pngSize(buf) {
  // PNG IHDR width/height at bytes 16-23
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

function splitRow(line) {
  return line.replace(/^\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim());
}

function buildTable(rawRows) {
  // rawRows includes header, separator, then body
  const dataRows = rawRows.filter((r) => !/^\|?[\s:|-]+\|?$/.test(r) || /[A-Za-z0-9]/.test(r.replace(/[-:|\s]/g, "")));
  // simpler: header = row 0, separator = row 1 (skip), body = rest
  const header = splitRow(rawRows[0]);
  const bodyRows = rawRows.slice(2).map(splitRow);
  const nCols = header.length;
  const colW = Math.floor(CONTENT_W / nCols);
  const colWidths = Array(nCols).fill(colW);
  colWidths[nCols - 1] = CONTENT_W - colW * (nCols - 1);

  const makeCell = (text, idx, isHeader) => new TableCell({
    borders: cellBorders,
    width: { size: colWidths[idx], type: WidthType.DXA },
    shading: isHeader ? { fill: "E3DCF2", type: ShadingType.CLEAR } : undefined,
    margins: { top: 60, bottom: 60, left: 110, right: 110 },
    children: [new Paragraph({ spacing: { after: 0, line: 240, lineRule: "auto" }, children: parseInline(text, isHeader ? { bold: true } : {}) })],
  });

  const rows = [];
  rows.push(new TableRow({ tableHeader: true, children: header.map((c, idx) => makeCell(c, idx, true)) }));
  bodyRows.forEach((cells) => {
    const padded = Array.from({ length: nCols }, (_, idx) => cells[idx] || "");
    rows.push(new TableRow({ children: padded.map((c, idx) => makeCell(c, idx, false)) }));
  });

  return new Table({ width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: colWidths, rows });
}

let i = 0;
let inReferences = false;
while (i < lines.length) {
  let line = lines[i];
  const raw = line;
  line = line.replace(/\s+$/, "");

  // horizontal rule
  if (/^---\s*$/.test(line)) {
    children.push(new Paragraph({ border: HR_BORDER, spacing: { before: 60, after: 120 }, children: [] }));
    i++; continue;
  }

  // fenced code block
  if (/^```/.test(line)) {
    i++;
    const code = [];
    while (i < lines.length && !/^```/.test(lines[i])) { code.push(lines[i].replace(/\s+$/, "")); i++; }
    i++; // skip closing fence
    code.forEach((cl) => {
      children.push(new Paragraph({
        spacing: { after: 0, line: 240 },
        shading: { fill: "F2F2F2", type: ShadingType.CLEAR },
        children: [new TextRun({ text: cl || " ", font: "Consolas", size: 16 })],
      }));
    });
    children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
    continue;
  }

  // markdown table
  if (/^\|.*\|\s*$/.test(line)) {
    const rows = [];
    while (i < lines.length && /^\|.*\|\s*$/.test(lines[i].replace(/\s+$/, ""))) {
      rows.push(lines[i].replace(/\s+$/, "")); i++;
    }
    children.push(buildTable(rows));
    children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
    continue;
  }

  // blank
  if (line.trim() === "") { i++; continue; }

  // headings
  let mh = line.match(/^(#{1,6})\s+(.*)$/);
  if (mh) {
    const level = mh[1].length;
    const txt = mh[2];
    inReferences = /references/i.test(txt) && level === 2;
    const headingLevel = { 1: HeadingLevel.TITLE, 2: HeadingLevel.HEADING_1, 3: HeadingLevel.HEADING_2, 4: HeadingLevel.HEADING_3 }[level] || HeadingLevel.HEADING_4;
    children.push(new Paragraph({ heading: headingLevel, children: parseInline(txt) }));
    i++; continue;
  }

  // bullet / checkbox list
  let mb = line.match(/^(\s*)-\s+(.*)$/);
  if (mb) {
    let txt = mb[2];
    txt = txt.replace(/^\[\s\]\s*/, "☐ ").replace(/^\[x\]\s*/i, "☑ ");
    children.push(new Paragraph({
      numbering: { reference: "bullets", level: 0 },
      children: parseInline(txt),
    }));
    i++; continue;
  }

  // normal paragraph (a single line in this md)
  const para = new Paragraph({
    spacing: { after: 120 },
    alignment: inReferences ? AlignmentType.LEFT : AlignmentType.JUSTIFIED,
    children: parseInline(line),
  });
  // references: hanging indent
  if (inReferences) para.options ;
  children.push(para);

  // figure embedding: if this line is a figure caption, insert image AFTER it
  const capMatch = line.match(/^\*\*(Figure \d+\.)\*\*/);
  if (capMatch && figureFiles[capMatch[1]]) {
    try { children.push(imageParagraph(figureFiles[capMatch[1]])); }
    catch (e) { /* skip if missing */ }
  }

  i++;
}

const doc = new Document({
  creator: "Field Campaign Tracker",
  title: "Field Campaign Tracker manuscript",
  styles: {
    default: { document: { run: { font: "Arial", size: 22 }, paragraph: { spacing: { line: BODY_LINE, lineRule: "auto" } } } },
    paragraphStyles: [
      { id: "Title", name: "Title", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, font: "Arial" },
        paragraph: { spacing: { before: 240, after: 240 }, outlineLevel: 0 } },
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 30, bold: true, font: "Arial" },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, font: "Arial" },
        paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 23, bold: true, italics: true, font: "Arial" },
        paragraph: { spacing: { before: 160, after: 80 }, outlineLevel: 2 } },
    ],
  },
  numbering: {
    config: [{
      reference: "bullets",
      levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } } }],
    }],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
      },
      ...(SUBMISSION ? { lineNumbers: { countBy: 1, start: 1, restart: LineNumberRestartFormat.CONTINUOUS, distance: 360 } } : {}),
    },
    footers: {
      default: new Footer({ children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun("Page "), new TextRun({ children: [PageNumber.CURRENT] })],
      })] }),
    },
    children,
  }],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(path.join(ROOT, OUT_NAME), buf);
  console.log("Wrote " + OUT_NAME + " (" + buf.length + " bytes)" + (SUBMISSION ? " [double-spaced + line numbers]" : ""));
});
