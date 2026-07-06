const fs = require('fs');
const CSV_PATH = 'C:/Users/10ary/Documents/programming/IPL-Simulator/IPLMainGameDatabase.csv';
const rawLines = fs.readFileSync(CSV_PATH, 'utf-8').replace(/\r/g, '').split('\n');
const headers = rawLines[0].split(',');
const kohli = rawLines.find(l => l.includes("Virat Kohli")).split(',');

headers.forEach((h, i) => {
  console.log(`${i}: ${h} -> ${kohli[i]}`);
});
