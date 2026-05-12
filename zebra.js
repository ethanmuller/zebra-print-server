import https from 'https';
import fs from 'fs';
import express from "express";
import cors from 'cors';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));


const app = express();
app.use(cors({
  origin: [
    'https://cmserp-sandbox.assetsbycms.com',
    'https://cmserp-prod.assetsbycms.com',
  ],
}));
app.use(express.json());

const BASE = "http://localhost:9100";

// -- Config: map label types to Zebra Browser Print printer names --
// Run `node list-printers.js` to see available printer names
const PRINTERS = {
  large:  "52j132100305",
  small:  "52j132100305",
  narrow: "52j132100305",
};

// -- Zebra helpers --

async function getPrinters() {
  let res;
  try {
    res = await fetch(`${BASE}/available`);
  } catch (err) {
    throw new Error(
      `Could not reach Zebra Browser Print at ${BASE}. ` +
      `Make sure the Zebra Browser Print app is running on this machine. (${err.message})`
    );
  }
  const data = await res.json();
  return data.printer ?? [];
}

async function printZPL(printerName, zpl) {
  const printers = await getPrinters();
  const printer = printers.find(p => p.name === printerName);
  if (!printer) throw new Error(`Printer "${printerName}" not found. Available: ${printers.map(p => p.name).join(", ")}`);

  const res = await fetch(`${BASE}/write`, {
    method: "POST",
    body: JSON.stringify({ device: printer, data: zpl }),
    headers: { "Content-Type": "application/json" },
  });

  const result = await res.text();
  if (!res.ok) throw new Error(`Print failed: ${result}`);
}

// -- ZPL templates --
// All dimensions @ 203dpi
// large:  4x6"  = 1218h x 812w dots
// small:  3x4"  = 609w x 812h dots
// narrow: 1x6.5"= 203w x 1319h dots

function largeLabel({ lotId, destructionType }) {
  return `
^XA
^PW812
^LL1218
^FO500,50^A0R,220,220^FD${lotId}^FS
^FO440,50^BCR,80,N,N,N^FD${lotId}^FS
^FO320,50^A0R,35,35^FDDestruction Method^FS
^FO250,50^A0R,60,60^FD${destructionType}^FS
^XZ
  `.trim();
}

function largeLabelCustom({ text }) {
  return `
^XA
^PW812
^LL1218
^FO50,50^A0R,80,80^TB R,1100,730^FD${text}^FS
^XZ
  `.trim();
}

function smallLabel({ lotId, destructionType }) {
  return `
^XA
^PW812
^LL609
^FO40,40^A0N,90,90^FD${lotId}^FS
^FO40,120^BCN,60,N,N,N^FD${lotId}^FS
^FO40,240^A0N,28,28^FDDestruction Method^FS
^FO40,275^A0N,45,45^FD${destructionType}^FS
^XZ
  `.trim();
}

function smallLabelCustom({ text }) {
  return `
^XA
^PW812
^LL609
^FO40,40^A0N,80,80^TB N,730,560^FD${text}^FS
^XZ
  `.trim();
}
function narrowLabel({ lotId }) {
  // note: this is printing two per label, since these stickers are so long
  return `
^XA
^PW203
^LL1319
^FO0,40^A0R,90,90^FD${lotId}^FS
^FO120,40^BCR,60,N,N,N^FD${lotId}^FS
^XZ
  `.trim();
}

function narrowLabelCustom({ text }) {
  // single block, no duplication unlike the lotId version
  return `
^XA
^PW203
^LL1319
^FO0,40^A0N,80,80^TB R,569,170^FD${text}^FS
^XZ
  `.trim();
}

// -- Routes --

app.post("/print/large", async (req, res) => {
  const { lotId, destructionType, text } = req.body;
  if (!text && (!lotId || !destructionType))
    return res.status(400).json({ error: "lotId and destructionType are required, or provide text" });

  try {
    const zpl = text
      ? largeLabelCustom({ text })
      : largeLabel({ lotId, destructionType });
    await printZPL(PRINTERS['large'], zpl);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/print/small", async (req, res) => {
  const { lotId, destructionType, text } = req.body;
  if (!text && (!lotId || !destructionType))
    return res.status(400).json({ error: "lotId and destructionType are required, or provide text" });

  try {
    const zpl = text
      ? smallLabelCustom({ text })
      : smallLabel({ lotId, destructionType });
    await printZPL(PRINTERS['small'], zpl);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/print/narrow", async (req, res) => {
  const { lotId, text } = req.body;
  if (!text && !lotId)
    return res.status(400).json({ error: "lotId is required, or provide text" });

  try {
    const zpl = text
      ? narrowLabelCustom({ text })
      : narrowLabel({ lotId });
    await printZPL(PRINTERS['narrow'], zpl);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


const options = {
  key: fs.readFileSync(`${__dirname}/localhost-key.pem`),
  cert: fs.readFileSync(`${__dirname}/localhost.pem`),
};

https.createServer(options, app).listen(3000, () => {
  console.log('Listening on https://localhost:3000');
});
