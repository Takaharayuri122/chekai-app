/**
 * Funções utilitárias para os hooks Cursor-Langfuse.
 */

export async function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => {
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject(new Error(`Failed to parse JSON from stdin: ${e.message}`));
      }
    });
    process.stdin.on('error', reject);
  });
}

export function generateTraceName(prompt, model) {
  if (!prompt) {
    return `Cursor ${model || 'Agent'}`;
  }
  const cleaned = prompt.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  const maxLength = 50;
  if (cleaned.length <= maxLength) {
    return cleaned;
  }
  const truncated = cleaned.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > 30) {
    return truncated.substring(0, lastSpace) + '...';
  }
  return truncated + '...';
}

export function generateSessionId(workspaceRoots) {
  if (!workspaceRoots || workspaceRoots.length === 0) {
    return 'cursor-default-session';
  }
  const root = workspaceRoots[0];
  const folderName = root.split('/').pop() || root;
  return `cursor-${folderName}`;
}

export function generateTags(hookName, input, existingTags = new Set()) {
  const tags = new Set(existingTags);
  tags.add('cursor');

  if (hookName.includes('Tab')) {
    tags.add('tab');
  } else {
    tags.add('agent');
  }

  if (input.model) {
    const modelTag = input.model
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 30);
    tags.add(modelTag);
  }

  switch (hookName) {
    case 'beforeShellExecution':
    case 'afterShellExecution':
      tags.add('shell');
      break;
    case 'beforeMCPExecution':
    case 'afterMCPExecution':
      tags.add('mcp');
      if (input.tool_name) {
        tags.add(`mcp-${input.tool_name.toLowerCase().substring(0, 20)}`);
      }
      break;
    case 'beforeReadFile':
    case 'afterFileEdit':
    case 'beforeTabFileRead':
    case 'afterTabFileEdit':
      tags.add('file-ops');
      break;
    case 'afterAgentThought':
      tags.add('thinking');
      break;
  }

  return Array.from(tags);
}

export function determineLevel(status, isBlocked = false) {
  if (isBlocked) return 'WARNING';
  switch (status) {
    case 'error':
      return 'ERROR';
    case 'aborted':
      return 'WARNING';
    case 'completed':
    default:
      return 'DEFAULT';
  }
}

export function calculateEditStats(edits) {
  if (!edits || !Array.isArray(edits)) {
    return { editCount: 0, linesAdded: 0, linesRemoved: 0 };
  }
  let linesAdded = 0;
  let linesRemoved = 0;
  for (const edit of edits) {
    const oldLines = (edit.old_string || '').split('\n').length;
    const newLines = (edit.new_string || '').split('\n').length;
    if (newLines > oldLines) {
      linesAdded += newLines - oldLines;
    } else if (oldLines > newLines) {
      linesRemoved += oldLines - newLines;
    }
  }
  return {
    editCount: edits.length,
    linesAdded,
    linesRemoved,
    netChange: linesAdded - linesRemoved,
  };
}

export function getFileExtension(filePath) {
  if (!filePath) return 'unknown';
  const parts = filePath.split('.');
  if (parts.length < 2) return 'unknown';
  return parts.pop().toLowerCase();
}

export function formatDuration(ms) {
  if (!ms || ms < 0) return '0ms';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}m ${seconds}s`;
}
