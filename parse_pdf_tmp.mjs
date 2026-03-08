import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import fs from 'fs';

const buffer = fs.readFileSync('/tmp/fraunhofer.pdf');
const data = await pdfParse(buffer);
console.log(JSON.stringify(data.text));
