const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, '../../dist/index.html');
const destDir = path.join(__dirname, '../lib');
const destPath = path.join(destDir, 'index.html');

// Create functions/lib folder if it doesn't exist yet
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

try {
  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, destPath);
    console.log('Successfully copied dist/index.html to functions/lib/index.html');
  } else {
    // If dist/index.html doesn't exist, fall back to project root index.html
    const fallbackPath = path.join(__dirname, '../../index.html');
    if (fs.existsSync(fallbackPath)) {
      fs.copyFileSync(fallbackPath, destPath);
      console.log('Fallback: copied root index.html to functions/lib/index.html');
    } else {
      console.error('Could not find index.html to copy');
      process.exit(1);
    }
  }
} catch (err) {
  console.error('Error copying template index.html:', err);
  process.exit(1);
}
