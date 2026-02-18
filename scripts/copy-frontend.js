const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'frontend', 'dist');
const dest = path.join(__dirname, '..', 'backend', 'public');

if (!fs.existsSync(src)) {
  console.error('Сначала выполните: npm run build:frontend');
  process.exit(1);
}

try {
  fs.rmSync(dest, { recursive: true });
} catch (e) {}
fs.mkdirSync(dest, { recursive: true });

function copyDir(s, d) {
  fs.readdirSync(s).forEach((f) => {
    const a = path.join(s, f);
    const b = path.join(d, f);
    if (fs.statSync(a).isDirectory()) {
      fs.mkdirSync(b, { recursive: true });
      copyDir(a, b);
    } else {
      fs.copyFileSync(a, b);
    }
  });
}

copyDir(src, dest);
console.log('frontend/dist скопирован в backend/public');
