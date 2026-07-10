const fs = require('fs');
const path = require('path');

function replaceInFile(filePath) {
  // Exclude styles configuration files
  if (filePath.endsWith('globals.css') || filePath.endsWith('tailwind.config.ts')) {
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // Replace hardcoded color values with variables
  content = content.replace(/#16130f/g, 'var(--ink)');
  content = content.replace(/#efece3/g, 'var(--surface)');
  content = content.replace(/#f4f1ea/g, 'var(--background)');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated: ${filePath}`);
  }
}

function traverseDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== '.next') {
        traverseDirectory(fullPath);
      }
    } else if (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.css')) {
      replaceInFile(fullPath);
    }
  }
}

traverseDirectory(path.join(__dirname, '../components'));
traverseDirectory(path.join(__dirname, '../app'));
console.log('Migration complete.');
