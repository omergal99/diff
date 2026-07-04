/**
 * File utilities — FileReader wrappers, encoding detection, drag-and-drop.
 */

/**
 * Read a File object as a UTF-8 string.
 * @param {File} file
 * @returns {Promise<string>}
 */
export function readAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
    reader.readAsText(file, 'utf-8');
  });
}

/**
 * Read a File object as ArrayBuffer.
 * @param {File} file
 * @returns {Promise<ArrayBuffer>}
 */
export function readAsBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Read a File as a data URL (for images).
 * @param {File} file
 * @returns {Promise<string>}
 */
export function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
    reader.readAsDataURL(file);
  });
}

/**
 * Open a native file picker and return the chosen File(s).
 * @param {object} [opts]
 * @param {boolean} [opts.multiple=false]
 * @param {string}  [opts.accept='*']
 * @returns {Promise<File[]>}
 */
export function pickFiles({ multiple = false, accept = '*' } = {}) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type     = 'file';
    input.multiple = multiple;
    input.accept   = accept;
    input.style.display = 'none';
    document.body.appendChild(input);
    input.onchange = () => {
      resolve([...input.files]);
      document.body.removeChild(input);
    };
    input.oncancel = () => {
      resolve([]);
      document.body.removeChild(input);
    };
    input.click();
  });
}

/**
 * Attach drag-and-drop handlers to an element.
 * @param {HTMLElement} target
 * @param {function(File[]): void} onDrop
 */
export function setupDropZone(target, onDrop) {
  const prevent = (e) => { e.preventDefault(); e.stopPropagation(); };

  target.addEventListener('dragenter', (e) => { prevent(e); target.classList.add('drag-over'); });
  target.addEventListener('dragover',  (e) => { prevent(e); target.classList.add('drag-over'); });
  target.addEventListener('dragleave', (e) => { prevent(e); target.classList.remove('drag-over'); });
  target.addEventListener('drop',      (e) => {
    prevent(e);
    target.classList.remove('drag-over');
    const files = [...(e.dataTransfer?.files || [])];
    if (files.length) onDrop(files);
  });
}

/** Guess the language/type from a filename for syntax highlighting hints. */
export function detectLanguage(filename) {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const map = {
    js:   'javascript', mjs: 'javascript', cjs: 'javascript',
    ts:   'typescript', tsx: 'typescript',
    jsx:  'jsx',
    py:   'python',
    rb:   'ruby',
    go:   'go',
    rs:   'rust',
    java: 'java',
    c:    'c',   h: 'c',
    cpp:  'cpp', cc: 'cpp',
    cs:   'csharp',
    php:  'php',
    html: 'html', htm: 'html',
    css:  'css', scss: 'scss', less: 'less',
    json: 'json', jsonc: 'json',
    yaml: 'yaml', yml: 'yaml',
    toml: 'toml',
    md:   'markdown', mdx: 'markdown',
    sh:   'bash', bash: 'bash', zsh: 'bash',
    sql:  'sql',
    xml:  'xml',
    dockerfile: 'dockerfile',
  };
  return map[ext] ?? 'plaintext';
}

/** Format file size from bytes. */
export function humanSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(2)} MB`;
}
