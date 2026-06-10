const fs = require('fs');
const path = require('path');

const stylePath = path.join(__dirname, '1rumah-biz-id', 'style.css');
if (!fs.existsSync(stylePath)) {
    console.error('style.css not found at: ' + stylePath);
    process.exit(1);
}

let content = fs.readFileSync(stylePath, 'utf8');

// The WordPress header comment we want at the absolute top
const wpHeader = `/*
Theme Name: 1rumah.biz.id
Theme URI: https://1rumah.biz.id
Author: Antigravity AI
Description: Premium & SEO Friendly Property Portal Theme for WordPress
Version: 1.0.0
License: GNU General Public License v2 or later
License URI: http://www.gnu.org/licenses/gpl-2.0.html
Text Domain: 1rumah-biz-id
*/
`;

// Remove any tailwind license comment at the top if present
content = content.replace(/^\/\*\! tailwindcss v[0-9.]* \| MIT License \| https:\/\/tailwindcss\.com \*\/\r?\n?/, '');

// Remove our own temporary comment from tailwind compilation output to prevent duplication
content = content.replace(/\/\*\![\s\S]*?Theme Name: 1rumah\.biz\.id[\s\S]*?\*\//, '');

// Prepend the clean WP header to the top
const finalContent = wpHeader + content.trim();

fs.writeFileSync(stylePath, finalContent, 'utf8');
console.log('style.css formatted successfully for WordPress!');
