const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    AlignmentType, BorderStyle, WidthType, VerticalAlign, ShadingType
} = require('docx');

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    status: "Backend radi",
    endpoints: [
      "/login",
      "/admin/users",
      "/admin/submission/:type/:email",
      "/generate-all/:type"
    ]
  });
});

const KORISNICI_PATH = path.join(__dirname, 'src', 'korisnici.json');
const PLANOVI_PATH = path.join(__dirname, 'planovi.json');
const IZVESTAJI_PATH = path.join(__dirname, 'izvestaji.json');

function loadKorisnici() { return JSON.parse(fs.readFileSync(KORISNICI_PATH, 'utf8')); }
function load(p) { if (!fs.existsSync(p)) return {}; return JSON.parse(fs.readFileSync(p, 'utf8')); }
function save(p, d) {
  try {
    fs.writeFileSync(p, JSON.stringify(d, null, 2));
  } catch (err) {
    console.error("Save error:", err.message);
  }
}

function toCyrillic(text) {
    if (!text) return text;
    const digraphs = [
        ["Lj", "Љ"], ["LJ", "Љ"], ["lj", "љ"], ["Nj", "Њ"], ["NJ", "Њ"], ["nj", "њ"],
        ["Dž", "Џ"], ["DŽ", "Џ"], ["dž", "џ"], ["Dz", "Ѕ"], ["DZ", "Ѕ"], ["dz", "ѕ"],
        ["Dj", "Ђ"], ["DJ", "Ђ"], ["dj", "ђ"], ["Sh", "Ш"], ["SH", "Ш"], ["sh", "ш"],
        ["Š", "Ш"], ["š", "ш"], ["Ch", "Ч"], ["CH", "Ч"], ["ch", "ч"],
        ["Č", "Ч"], ["č", "ч"], ["Ć", "Ћ"], ["ć", "ћ"], ["Zh", "Ж"], ["ZH", "Ж"], ["zh", "ж"],
    ];
    const singles = {
        "A": "А", "B": "Б", "C": "Ц", "D": "Д", "E": "Е", "F": "Ф", "G": "Г", "H": "Х",
        "I": "И", "J": "Ј", "K": "К", "L": "Л", "M": "М", "N": "Н", "O": "О", "P": "П",
        "R": "Р", "S": "С", "T": "Т", "U": "У", "V": "В", "Z": "З",
        "a": "а", "b": "б", "c": "ц", "d": "д", "e": "е", "f": "ф", "g": "г", "h": "х",
        "i": "и", "j": "ј", "k": "к", "l": "л", "m": "м", "n": "н", "o": "о", "p": "п",
        "r": "р", "s": "с", "t": "т", "u": "у", "v": "в", "z": "з",
    };
    let result = "", i = 0;
    while (i < text.length) {
        let matched = false;
        for (const [latin, cyr] of digraphs) {
            if (text.substr(i, latin.length) === latin) { result += cyr; i += latin.length; matched = true; break; }
        }
        if (!matched) { result += singles[text[i]] ?? text[i]; i++; }
    }
    return result;
}

const TNR = "Times New Roman";
const LANG = { id: "sr-Cyrl-RS" };
const border = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
const borders = { top: border, bottom: border, left: border, right: border };
const cellMargins = { top: 80, bottom: 80, left: 100, right: 100 };
const PAGE_PROPS = { page: { size: { width: 11906, height: 16838 }, margin: { top: 1417, right: 1417, bottom: 1417, left: 1417 } } };

function cell(text, w) {
    return new TableCell({
        borders, width: { size: w, type: WidthType.DXA }, margins: cellMargins, verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: text || "", font: TNR, size: 24, language: LANG })] })]
    });
}
function headerCell(text, w) {
    return new TableCell({
        borders, width: { size: w, type: WidthType.DXA }, margins: cellMargins, verticalAlign: VerticalAlign.CENTER,
        shading: { fill: "D9D9D9", type: ShadingType.CLEAR },
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text, font: TNR, size: 22, bold: true, language: LANG })] })]
    });
}
function centeredBold(text, size = 24, underline = false, spacing = {}) {
    return new Paragraph({
        alignment: AlignmentType.CENTER, spacing,
        children: [new TextRun({ text, font: TNR, size, bold: true, underline: underline ? {} : undefined, language: LANG })]
    });
}
function normalPara(runs, spacing = {}) { return new Paragraph({ spacing, children: runs }); }

// Plan — Section 2 has NO date column
function buildPlanChildren(ime, outside, inside) {
    const ow = [3539, 1559, 1985, 1979];
    const iw = [3256, 2538, 1412];
    const imeCyr = toCyrillic(ime);
    return [
        centeredBold("ПЛАН СТРУЧНОГ УСАВРШАВАЊА ЗА 2025/2026. ГОДИНУ", 28, false, { after: 200 }),
        normalPara([
            new TextRun({ text: "Ime и презиме запосленог: ", font: TNR, size: 24, language: LANG }),
            new TextRun({ text: imeCyr, font: TNR, size: 24, bold: true, language: LANG }),
        ], { after: 200 }),
        centeredBold("АКТИВНОСТИ СТРУЧНОГ УСАВРШАВАЊА", 24, false, { after: 0 }),
        centeredBold("ВАН УСТАНОВЕ", 24, true, { after: 120 }),
        new Table({
            width: { size: ow.reduce((a, b) => a + b, 0), type: WidthType.DXA }, columnWidths: ow,
            rows: [
                new TableRow({ children: [headerCell("Назив акредитованог семинара - програма", ow[0]), headerCell("Каталошки број", ow[1]), headerCell("Број бодова/сати", ow[2]), headerCell("Компетенције", ow[3])] }),
                ...outside.map(r => new TableRow({ children: [cell(r.naziv, ow[0]), cell(r.kataloski, ow[1]), cell(r.bodovi, ow[2]), cell(r.kompetencije, ow[3])] }))
            ]
        }),
        normalPara([
            new TextRun({ text: "Планирано је укупно ", font: TNR, size: 24, language: LANG }),
            new TextRun({ text: String(outside.reduce((s, r) => s + (parseFloat(r.bodovi) || 0), 0)), font: TNR, size: 24, bold: true, language: LANG }),
            new TextRun({ text: " бодова акредитованих програма ", font: TNR, size: 24, language: LANG }),
            new TextRun({ text: "ван установе.", font: TNR, size: 24, bold: true, language: LANG }),
        ], { before: 160, after: 240 }),
        centeredBold("АКТИВНОСТИ СТРУЧНОГ УСАВРШАВАЊА", 24, false, { after: 0 }),
        centeredBold("У УСТАНОВИ", 24, true, { after: 120 }),
        new Table({
            width: { size: iw.reduce((a, b) => a + b, 0), type: WidthType.DXA }, columnWidths: iw,
            rows: [
                new TableRow({ children: [headerCell("Активност", iw[0]), headerCell("Начин учествовања", iw[1]), headerCell("Број бодова", iw[2])] }),
                ...inside.map(r => new TableRow({ children: [cell(r.aktivnost, iw[0]), cell(r.nacin, iw[1]), cell(r.bodovi, iw[2])] }))
            ]
        }),
        normalPara([
            new TextRun({ text: "Планирано је укупно ", font: TNR, size: 24, language: LANG }),
            new TextRun({ text: String(inside.reduce((s, r) => s + (parseFloat(r.bodovi) || 0), 0)), font: TNR, size: 24, bold: true, language: LANG }),
            new TextRun({ text: " бодова стручног усавршавања ", font: TNR, size: 24, language: LANG }),
            new TextRun({ text: "у установи.", font: TNR, size: 24, bold: true, language: LANG }),
        ], { before: 160 }),
    ];
}

// Izvestaj — Section 2 HAS date column and naziv column
function buildIzvestajChildren(ime, outside, inside) {
    const ow = [3539, 1559, 1985, 1979];
    const iw = [2200, 2000, 2000, 1800, 1062];
    const imeCyr = toCyrillic(ime);

    return [
        centeredBold("ИЗВЕШТАЈ О СТРУЧНОМ УСАВРШАВАЊУ ЗА 2024/2025. ГОДИНУ", 28, false, { after: 200 }),
        normalPara([
            new TextRun({ text: "Ime и презиме запосленог: ", font: TNR, size: 24, language: LANG }),
            new TextRun({ text: imeCyr, font: TNR, size: 24, bold: true, language: LANG }),
        ], { after: 200 }),
        centeredBold("АКТИВНОСТИ СТРУЧНОГ УСАВРШАВАЊА", 24, false, { after: 0 }),
        centeredBold("ВАН УСТАНОВЕ", 24, true, { after: 120 }),
        new Table({
            width: { size: ow.reduce((a, b) => a + b, 0), type: WidthType.DXA }, columnWidths: ow,
            rows: [
                new TableRow({ children: [
                    headerCell("Назив акредитованог семинара - програма", ow[0]),
                    headerCell("Каталошки број", ow[1]),
                    headerCell("Број бодова/сати", ow[2]),
                    headerCell("Компетенције", ow[3])
                ] }),
                ...outside.map(r => new TableRow({ children: [
                    cell(r.naziv, ow[0]),
                    cell(r.kataloski, ow[1]),
                    cell(r.bodovi, ow[2]),
                    cell(r.kompetencije, ow[3])
                ] }))
            ]
        }),
        normalPara([
            new TextRun({ text: "Наставник/стручни сарадник је остварио укупно ", font: TNR, size: 24, language: LANG }),
            new TextRun({ text: String(outside.reduce((s, r) => s + (parseFloat(r.bodovi) || 0), 0)), font: TNR, size: 24, bold: true, language: LANG }),
            new TextRun({ text: " бодова акредитованих програма ", font: TNR, size: 24, language: LANG }),
            new TextRun({ text: "ван установе.", font: TNR, size: 24, bold: true, language: LANG }),
        ], { before: 160, after: 240 }),
        centeredBold("АКТИВНОСТИ СТРУЧНОГ УСАВРШАВАЊА", 24, false, { after: 0 }),
        centeredBold("У УСТАНОВИ", 24, true, { after: 120 }),

        new Table({
            width: { size: iw.reduce((a, b) => a + b, 0), type: WidthType.DXA },
            columnWidths: iw,
            rows: [
                new TableRow({
                    children: [
                        headerCell("Активност", iw[0]),
                        headerCell("Назив", iw[1]),
                        headerCell("Начин учествовања", iw[2]),
                        headerCell("Датум реализације", iw[3]),
                        headerCell("Број бодова", iw[4])
                    ]
                }),
                ...inside.map(r => new TableRow({
                    children: [
                        cell(r.aktivnost, iw[0]),
                        cell(r.naziv, iw[1]),
                        cell(r.nacin, iw[2]),
                        cell(r.datum, iw[3]),
                        cell(r.bodovi, iw[4])
                    ]
                }))
            ]
        }),

        normalPara([
            new TextRun({ text: "Наставник/стручни сарадник је остварио укупно ", font: TNR, size: 24, language: LANG }),
            new TextRun({ text: String(inside.reduce((s, r) => s + (parseFloat(r.bodovi) || 0), 0)), font: TNR, size: 24, bold: true, language: LANG }),
            new TextRun({ text: " бодова стручног усавршавања ", font: TNR, size: 24, language: LANG }),
            new TextRun({ text: "у установи.", font: TNR, size: 24, bold: true, language: LANG }),
        ], { before: 160 }),
    ];
}

async function buildSingle(type, ime, outside, inside) {
    const children = type === 'izvestaj' ? buildIzvestajChildren(ime, outside, inside) : buildPlanChildren(ime, outside, inside);
    return Packer.toBuffer(new Document({ sections: [{ properties: PAGE_PROPS, children }] }));
}

async function buildCombined(type, entries) {
    return Packer.toBuffer(new Document({
        sections: entries.map(({ ime, outside, inside }) => ({
            properties: PAGE_PROPS,
            children: type === 'izvestaj' ? buildIzvestajChildren(ime, outside, inside) : buildPlanChildren(ime, outside, inside)
        }))
    }));
}

// ── ROUTES ────────────────────────────────────────────────────

app.post('/login', (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email je obavezan" });
    const k = loadKorisnici().find(k => k.email.toLowerCase() === email.toLowerCase().trim());
    if (!k) return res.status(401).json({ error: "Email nije pronađen" });
    res.json({ ime: k.ime, email: k.email, admin: k.admin || false });
});

app.post('/submit/:type', (req, res) => {
    const { email, ime, outside, inside } = req.body;
    if (!email) return res.status(400).json({ error: "Email je obavezan" });
    const file = req.params.type === 'izvestaj' ? IZVESTAJI_PATH : PLANOVI_PATH;
    const data = load(file);
    data[email] = { ime, outside, inside, submittedAt: new Date().toISOString() };
    save(file, data);
    res.json({ success: true });
});

app.get('/admin/users', (req, res) => {
    const planovi = load(PLANOVI_PATH);
    const izvestaji = load(IZVESTAJI_PATH);
    res.json(loadKorisnici().map(k => ({
        email: k.email, ime: k.ime, admin: k.admin || false,
        planSubmitted: !!planovi[k.email],
        planSubmittedAt: planovi[k.email]?.submittedAt || null,
        izvestajSubmitted: !!izvestaji[k.email],
        izvestajSubmittedAt: izvestaji[k.email]?.submittedAt || null,
    })));
});

app.get('/admin/submission/:type/:email', (req, res) => {
    const file = req.params.type === 'izvestaj' ? IZVESTAJI_PATH : PLANOVI_PATH;
    const sub = load(file)[req.params.email];
    if (!sub) return res.status(404).json({ error: "Нема предате документације" });
    res.json(sub);
});

app.post('/generate/:type', async (req, res) => {
    const { ime, outside, inside } = req.body;
    const type = req.params.type;
    const buffer = await buildSingle(type, ime, outside, inside);
    const prefix = type === 'izvestaj' ? 'Izvestaj' : 'Plan';
    res.setHeader('Content-Disposition', `attachment; filename="${prefix}_strucnog_usavrsavanja_${ime.replace(/\s+/g, '_')}.docx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.send(buffer);
});

app.get('/generate-all/:type', async (req, res) => {
    const type = req.params.type;
    const file = type === 'izvestaj' ? IZVESTAJI_PATH : PLANOVI_PATH;
    const entries = Object.values(load(file));
    if (entries.length === 0) return res.status(404).json({ error: "Нема предатих докумената" });
    const buffer = await buildCombined(type, entries);
    const prefix = type === 'izvestaj' ? 'Svi_izvestaji' : 'Svi_planovi';
    res.setHeader('Content-Disposition', `attachment; filename="${prefix}_strucnog_usavrsavanja.docx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.send(buffer);
});

const PORT = process.env.PORT || 3001;

const PORT = process.env.PORT || 10000;

app.listen(PORT, "0.0.0.0", () => {
  console.log("Server running on port", PORT);
});
