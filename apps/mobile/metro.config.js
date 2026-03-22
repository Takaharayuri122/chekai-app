const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Monorepo: watch packages/ directory (merge with Expo defaults)
config.watchFolders = [...(config.watchFolders ?? []), workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Expo's Metro sets only ['require', 'import'] as package export conditions,
// so axios would resolve to dist/node/axios.cjs (requires http/https which
// don't exist in RN) → "Requiring unknown module 'undefined'".
// Force axios to its browser build to avoid Node.js built-in dependencies.
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  axios: path.resolve(workspaceRoot, 'node_modules/axios/dist/browser/axios.cjs'),
};

// Force singleton React/RN — prevents dual-version crash when root has React 19
// while apps/mobile has React 18. resolveRequest handles all sub-paths (jsx-runtime, etc.)
const resolveFromApp = (moduleName) =>
  require.resolve(moduleName, { paths: [projectRoot] });

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Force React 18 (apps/mobile) to prevent dual-version crash with root React 19.
  // Only intercept react and react sub-paths — react-dom is not installed in RN.
  if (moduleName === 'react' || moduleName.startsWith('react/')) {
    return { filePath: resolveFromApp(moduleName), type: 'sourceFile' };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './src/global.css' });
