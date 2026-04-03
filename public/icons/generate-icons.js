// Generate simple SVG-based PNG icons for PWA
const fs = require('fs');
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

const svg = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${size * 0.15}" fill="#7C3AED"/>
  <text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle"
    font-family="system-ui,sans-serif" font-weight="800" font-size="${size * 0.35}" fill="white">CC</text>
</svg>`;

sizes.forEach(s => {
  fs.writeFileSync(`icon-${s}.svg`, svg(s));
});
console.log('SVG icons generated. Convert to PNG for production.');
