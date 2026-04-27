// list-printers.js
const res = await fetch("http://localhost:9100/available");
const data = await res.json();
console.log("Available printers:");
data.printer.forEach(p => console.log(" -", p.name));
