import express from "express";

const app = express();
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
  const res = await fetch(`${BASE}/available`);
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

function largeLabel({ lotId, customerName, destructionType }) {
  return `
^XA
^PW812
^LL1218
^FO600,50^A0R,150,150^FD${lotId}^FS
^FO540,50^BCR,80,N,N,N^FD${lotId}^FS
^FO420,50^A0R,35,35^FDCustomer^FS
^FO350,50^A0R,60,60^FD${customerName}^FS
^FO250,50^A0R,35,35^FDDestruction Method^FS
^FO180,50^A0R,60,60^FD${destructionType}^FS
^XZ
  `.trim();
}

function smallLabel({ lotId, customerName, destructionType }) {
  return `
^XA
^PW609
^LL812
^FO40,40^A0N,90,90^FD${lotId}^FS
^FO40,120^BCN,60,N,N,N^FD${lotId}^FS
^FO40,240^A0N,28,28^FDCustomer^FS
^FO40,275^A0N,45,45^FD${customerName}^FS
^FO40,365^A0N,28,28^FDDestruction Method^FS
^FO40,400^A0N,45,45^FD${destructionType}^FS
^XZ
  `.trim();
}
function narrowLabel({ lotId }) {
  return `
^XA
^PW203
^LL1319
^FO600,20^A0R,40,40^FD${lotId}^FS
^FO480,20^BCR,60,N,N,N^FD${lotId}^FS
^XZ
  `.trim();
}

// -- Routes --

app.post("/print/large", async (req, res) => {
  const { lotId, customerName, destructionType } = req.body;
  if (!lotId || !customerName || !destructionType)
    return res.status(400).json({ error: "lotId, customerName, and destructionType are required" });

  try {
    await printZPL(PRINTERS['large'], largeLabel({ lotId, customerName, destructionType }));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/print/small", async (req, res) => {
  const { lotId, customerName, destructionType } = req.body;
  if (!lotId || !customerName || !destructionType)
    return res.status(400).json({ error: "lotId, customerName, and destructionType are required" });

  try {
    await printZPL(PRINTERS['small'], smallLabel({ lotId, customerName, destructionType }));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/print/narrow", async (req, res) => {
  const { lotId } = req.body;
  if (!lotId) return res.status(400).json({ error: "lotId is required" });

  try {
    await printZPL(PRINTERS['narrow'], narrowLabel({ lotId }));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => console.log("Print server running on http://localhost:3000"));
