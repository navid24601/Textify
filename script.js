// --- STATE MANAGEMENT ---
let currentFileName = "document.txt";
let currentFileExt = ".txt";

// --- DOM ELEMENTS ---
const inputArea = document.getElementById('inputText');
const outputArea = document.getElementById('outputText');
const inputStats = document.getElementById('inputStats');
const outputStats = document.getElementById('outputStats');
const fileInput = document.getElementById('fileInput');

// --- EVENT LISTENERS ---
inputArea.addEventListener('input', () => updateStats('input'));
outputArea.addEventListener('input', () => updateStats('output'));

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Save filename logic
    currentFileName = file.name;
    const lastDot = currentFileName.lastIndexOf('.');
    if (lastDot !== -1) {
        currentFileExt = currentFileName.substring(lastDot);
    } else {
        currentFileExt = ".txt";
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        inputArea.value = e.target.result;
        updateStats('input');
        showToast(`Loaded ${file.name}`);
    };
    reader.readAsText(file);
    // Reset so same file can be selected again
    fileInput.value = '';
});

// --- CORE FUNCTIONS ---

function updateStats(type) {
    const el = type === 'input' ? inputArea : outputArea;
    const statEl = type === 'input' ? inputStats : outputStats;
    const text = el.value;
    
    // Simple word count: split by whitespace, filter empty strings
    const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
    const chars = text.length;

    statEl.textContent = `${words} words | ${chars} characters`;
}

function clearInput() {
    inputArea.value = '';
    updateStats('input');
    currentFileName = "document.txt";
    currentFileExt = ".txt";
}

function copyToClipboard(type) {
    const el = type === 'input' ? inputArea : outputArea;
    el.select();
    document.execCommand('copy');
    window.getSelection().removeAllRanges();
    showToast('Copied to clipboard!');
}

function saveFile(type) {
    const el = type === 'input' ? inputArea : outputArea;
    const text = el.value;
    const blob = new Blob([text], { type: 'text/plain' });
    const a = document.createElement('a');
    
    let dlName = currentFileName;
    // If output, maybe append _processed, but req says keep format
    if (type === 'output') {
            // ensure we don't double extension if it's already there
            const base = currentFileName.substring(0, currentFileName.lastIndexOf('.')) || currentFileName;
            dlName = `${base}_output${currentFileExt}`;
    }

    a.href = URL.createObjectURL(blob);
    a.download = dlName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
}

function showToast(msg) {
    const t = document.getElementById('toast');
    t.innerText = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}

function setOutput(text) {
    outputArea.value = text;
    updateStats('output');
}

// --- TRANSFORMATIONS ---

function transform(action) {
    const text = inputArea.value;
    if (!text && action !== 'ntlm' && action !== 'b64encode') { // Allow some actions on empty strings? No, usually not.
            // Do nothing if empty
    }

    let result = text;

    try {
        switch(action) {
            // Minifiers
            case 'stripAll':
                result = text.replace(/\s+/g, '');
                break;
            case 'removeEmptyLines':
                result = text.split('\n').filter(line => line.trim() !== '').join('\n');
                break;
            case 'oneLine':
                result = text.replace(/[\r\n]+/g, ' ');
                break;
            case 'trimLines':
                result = text.split('\n').map(l => l.trim()).join('\n');
                break;

            // Case
            case 'upper':
                result = text.toUpperCase();
                break;
            case 'lower':
                result = text.toLowerCase();
                break;
            case 'reverse':
                result = text.split('').reverse().join('');
                break;
            case 'title':
                result = text.toLowerCase().split(' ').map(function(word) {
                    return (word.charAt(0).toUpperCase() + word.slice(1));
                }).join(' ');
                break;
            case 'sentence':
                result = text.toLowerCase().replace(/(^\s*\w|[\.\!\?]\s*\w)/g, function(c) {
                    return c.toUpperCase();
                });
                break;
            case 'camel':
                result = toCamelCase(text);
                break;
            case 'pascal':
                const camel = toCamelCase(text);
                result = camel.charAt(0).toUpperCase() + camel.slice(1);
                break;
            case 'snake':
                result = text.match(/[A-Z]{2,}(?=[A-Z][a-z]+[0-9]*|\b)|[A-Z]?[a-z]+[0-9]*|[A-Z]|[0-9]+/g)
                            .map(x => x.toLowerCase())
                            .join('_');
                break;

            // Encoders
            case 'b64encode':
                result = btoa(unescape(encodeURIComponent(text))); // Handle UTF-8 safely
                break;
            case 'b64decode':
                result = decodeURIComponent(escape(atob(text)));
                break;
            
            // Crypto (Sync)
            case 'ntlm':
                result = ntlmHash(text);
                break;
        }
        setOutput(result);
        if(action !== 'ntlm') showToast('Action applied!'); // NTLM is specific
    } catch (e) {
        console.error(e);
        showToast('Error: ' + e.message);
    }
}

// --- HELPER FUNCTIONS ---

function toCamelCase(str) {
    return str.replace(/(?:^\w|[A-Z]|\b\w)/g, function(word, index) {
        return index === 0 ? word.toLowerCase() : word.toUpperCase();
    }).replace(/\s+/g, '');
}

// --- NTLM IMPLEMENTATION (MD4) ---
// NTLM = MD4(UTF-16LE(password))

function ntlmHash(password) {
    // 1. Convert string to UTF-16LE bytes
    const buffer = new ArrayBuffer(password.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < password.length; i++) {
        view.setUint16(i * 2, password.charCodeAt(i), true); // true for little-endian
    }
    
    // 2. MD4 Hash
    // Adapted from a compact JS MD4 implementation
    const hash = md4(new Uint8Array(buffer));
    return hash;
}

/* * MD4 Implementation 
    * Based on RFC 1320
    */
function md4(message) {
    function F(x, y, z) { return (x & y) | ((~x) & z); }
    function G(x, y, z) { return (x & y) | (x & z) | (y & z); }
    function H(x, y, z) { return x ^ y ^ z; }
    function rol(v, s) { return (v << s) | (v >>> (32 - s)); }

    // Setup
    let a = 0x67452301;
    let b = 0xefcdab89;
    let c = 0x98badcfe;
    let d = 0x10325476;

    // Padding
    const originalLength = message.length;
    const paddingLength = (message.length % 64 < 56) ? 
                            56 - (message.length % 64) : 
                            120 - (message.length % 64);
    
    const padded = new Uint8Array(originalLength + paddingLength + 8);
    padded.set(message);
    padded[originalLength] = 0x80;
    
    // Length in bits (little endian)
    const view = new DataView(padded.buffer);
    view.setUint32(padded.length - 8, (originalLength * 8) & 0xFFFFFFFF, true);
    view.setUint32(padded.length - 4, Math.floor((originalLength * 8) / 0x100000000), true);

    // Process in 64-byte chunks
    for (let i = 0; i < padded.length; i += 64) {
        const X = new Uint32Array(16);
        for(let j=0; j<16; j++) {
            X[j] = padded[i + j*4] | (padded[i + j*4 + 1] << 8) | (padded[i + j*4 + 2] << 16) | (padded[i + j*4 + 3] << 24);
        }

        let AA = a, BB = b, CC = c, DD = d;

        // Round 1
        const r1 = (a,b,c,d,k,s) => { return rol(a + F(b,c,d) + X[k], s); }
        a = r1(a,b,c,d, 0, 3); d = r1(d,a,b,c, 1, 7); c = r1(c,d,a,b, 2,11); b = r1(b,c,d,a, 3,19);
        a = r1(a,b,c,d, 4, 3); d = r1(d,a,b,c, 5, 7); c = r1(c,d,a,b, 6,11); b = r1(b,c,d,a, 7,19);
        a = r1(a,b,c,d, 8, 3); d = r1(d,a,b,c, 9, 7); c = r1(c,d,a,b,10,11); b = r1(b,c,d,a,11,19);
        a = r1(a,b,c,d,12, 3); d = r1(d,a,b,c,13, 7); c = r1(c,d,a,b,14,11); b = r1(b,c,d,a,15,19);

        // Round 2
        const r2 = (a,b,c,d,k,s) => { return rol(a + G(b,c,d) + X[k] + 0x5a827999, s); }
        a = r2(a,b,c,d, 0, 3); d = r2(d,a,b,c, 4, 5); c = r2(c,d,a,b, 8, 9); b = r2(b,c,d,a,12,13);
        a = r2(a,b,c,d, 1, 3); d = r2(d,a,b,c, 5, 5); c = r2(c,d,a,b, 9, 9); b = r2(b,c,d,a,13,13);
        a = r2(a,b,c,d, 2, 3); d = r2(d,a,b,c, 6, 5); c = r2(c,d,a,b,10, 9); b = r2(b,c,d,a,14,13);
        a = r2(a,b,c,d, 3, 3); d = r2(d,a,b,c, 7, 5); c = r2(c,d,a,b,11, 9); b = r2(b,c,d,a,15,13);

        // Round 3
        const r3 = (a,b,c,d,k,s) => { return rol(a + H(b,c,d) + X[k] + 0x6ed9eba1, s); }
        a = r3(a,b,c,d, 0, 3); d = r3(d,a,b,c, 8, 9); c = r3(c,d,a,b, 4,11); b = r3(b,c,d,a,12,15);
        a = r3(a,b,c,d, 2, 3); d = r3(d,a,b,c,10, 9); c = r3(c,d,a,b, 6,11); b = r3(b,c,d,a,14,15);
        a = r3(a,b,c,d, 1, 3); d = r3(d,a,b,c, 9, 9); c = r3(c,d,a,b, 5,11); b = r3(b,c,d,a,13,15);
        a = r3(a,b,c,d, 3, 3); d = r3(d,a,b,c,11, 9); c = r3(c,d,a,b, 7,11); b = r3(b,c,d,a,15,15);

        a = (a + AA) >>> 0;
        b = (b + BB) >>> 0;
        c = (c + CC) >>> 0;
        d = (d + DD) >>> 0;
    }

    const hex = [a, b, c, d].map(val => {
        // Little endian hex conversion for NTLM output
        let h = '';
        h += ((val & 0xFF).toString(16).padStart(2, '0'));
        h += (((val >> 8) & 0xFF).toString(16).padStart(2, '0'));
        h += (((val >> 16) & 0xFF).toString(16).padStart(2, '0'));
        h += (((val >> 24) & 0xFF).toString(16).padStart(2, '0'));
        return h;
    }).join('');
    
    return hex;
}


// --- AES IMPLEMENTATION (Web Crypto API) ---
// Uses PBKDF2 for key derivation and AES-GCM for encryption

async function handleAES(mode) {
    const text = inputArea.value;
    const password = document.getElementById('aesKey').value;

    if (!text) { showToast('Please enter text to process.'); return; }
    if (!password) { showToast('Please enter a secret key.'); return; }

    try {
        if (mode === 'encrypt') {
            await aesEncrypt(text, password);
        } else {
            await aesDecrypt(text, password);
        }
    } catch (e) {
        console.error(e);
        showToast('AES Error: Invalid key or data.');
        setOutput('Error processing AES. Ensure Key is correct and data is valid.');
    }
}

async function aesEncrypt(plainText, password) {
    const enc = new TextEncoder();
    const ptBytes = enc.encode(plainText);
    
    // 1. Generate Key from Password
    const keyMaterial = await window.crypto.subtle.importKey(
        "raw", enc.encode(password), {name: "PBKDF2"}, false, ["deriveKey"]
    );
    
    // Random salt for key derivation? For simplicity in this offline tool (so user only needs password), 
    // we will use a static salt or derive it? 
    // Best practice: Random salt, preprend to output. 
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    
    const key = await window.crypto.subtle.deriveKey(
        { "name": "PBKDF2", salt: salt, "iterations": 100000, "hash": "SHA-256" },
        keyMaterial,
        { "name": "AES-GCM", "length": 256 },
        true,
        [ "encrypt", "decrypt" ]
    );

    // 2. Generate IV
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    // 3. Encrypt
    const encryptedContent = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        key,
        ptBytes
    );

    // 4. Pack Salt + IV + Ciphertext
    const combined = new Uint8Array(salt.length + iv.length + encryptedContent.byteLength);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(new Uint8Array(encryptedContent), salt.length + iv.length);

    // 5. Convert to Base64 for display
    const b64 = btoa(String.fromCharCode(...combined));
    setOutput(b64);
    showToast('Text Encrypted!');
}

async function aesDecrypt(cipherTextB64, password) {
    try {
        const enc = new TextEncoder();
        
        // 1. Decode Base64
        const combinedStr = atob(cipherTextB64);
        const combined = new Uint8Array(combinedStr.length);
        for(let i=0; i<combinedStr.length; i++) combined[i] = combinedStr.charCodeAt(i);

        // 2. Extract parts
        const salt = combined.slice(0, 16);
        const iv = combined.slice(16, 28);
        const data = combined.slice(28);

        // 3. Derive Key (Same parameters)
        const keyMaterial = await window.crypto.subtle.importKey(
            "raw", enc.encode(password), {name: "PBKDF2"}, false, ["deriveKey"]
        );
        
        const key = await window.crypto.subtle.deriveKey(
            { "name": "PBKDF2", salt: salt, "iterations": 100000, "hash": "SHA-256" },
            keyMaterial,
            { "name": "AES-GCM", "length": 256 },
            true,
            [ "encrypt", "decrypt" ]
        );

        // 4. Decrypt
        const decryptedContent = await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv: iv },
            key,
            data
        );

        const dec = new TextDecoder();
        setOutput(dec.decode(decryptedContent));
        showToast('Text Decrypted!');
    } catch(e) {
        throw new Error("Decryption failed");
    }
}