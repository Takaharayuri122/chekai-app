const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'node_modules/react-joyride/dist/index.mjs');
let content = fs.readFileSync(filePath, 'utf8');

// Remover a linha problemática
content = content.replace(
  /ReactDOM\.unmountComponentAtNode\(this\.node\);/g,
  '// React 19: unmountComponentAtNode removed, this code only runs for React < 16 so safe to remove'
);

// Corrigir renderReact16 se estiver quebrado
const renderReact16Pattern = /renderReact16\(\)\s*\{/;
if (!renderReact16Pattern.test(content)) {
  // Se renderReact16 não existe, vamos procurar onde deveria estar
  const afterRenderReact15 = content.indexOf('renderReact15()');
  if (afterRenderReact15 > -1) {
    const renderReact15End = content.indexOf('  }\n  render()', afterRenderReact15);
    if (renderReact15End > -1) {
      const beforeRender = content.substring(0, renderReact15End + 3);
      const afterRender = content.substring(renderReact15End + 3);
      
      // Verificar se já tem renderReact16
      if (!afterRender.trim().startsWith('renderReact16')) {
        // Inserir renderReact16 corretamente
        const corrected = beforeRender + 
          '  renderReact16() {\n' +
          '    if (!canUseDOM() || !isReact16) {\n' +
          '      return null;\n' +
          '    }\n' +
          '    const { children } = this.props;\n' +
          '    if (!this.node) {\n' +
          '      return null;\n' +
          '    }\n' +
          '    return ReactDOM.createPortal(children, this.node);\n' +
          '  }\n';
        
        content = corrected + afterRender.replace(/^\s*if \(!canUseDOM\(\) \|\| !isReact16\) \{[^}]*\}\s*\}\s*return null;\s*/m, '');
      }
    }
  }
}

// Limpar código duplicado ou incorreto
content = content.replace(
  /\s*if \(!canUseDOM\(\) \|\| !isReact16\) \{\s*return null;\s*\}\s*\}\s*return null;\s*/g,
  ''
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Arquivo corrigido com sucesso!');
