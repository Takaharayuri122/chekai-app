const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'node_modules/react-joyride/dist/index.mjs');
let content = fs.readFileSync(filePath, 'utf8');

// Substituir apenas a linha específica do unmountComponentAtNode
const lines = content.split('\n');
const newLines = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Substituir a linha que contém ReactDOM.unmountComponentAtNode
  if (line.includes('ReactDOM.unmountComponentAtNode(this.node);')) {
    newLines.push(line.replace(
      'ReactDOM.unmountComponentAtNode(this.node);',
      '// React 19: unmountComponentAtNode removed, this code only runs for React < 16 so safe to remove'
    ));
  } else {
    newLines.push(line);
  }
}

fs.writeFileSync(filePath, newLines.join('\n'), 'utf8');
console.log('✅ Correção aplicada com sucesso!');
