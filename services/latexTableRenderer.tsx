import React from 'react';

export interface LatexValidationError {
  row?: number;
  field?: string;
  message: string;
  snippet?: string;
}

export interface RenderLatexOptions {
  variant?: 'paper' | 'preview';
  isUrduContext?: boolean;
}

const isUrduText = (text: string) => /[\u0600-\u06FF]/.test(text || '');

const LATEX_SYMBOLS: Record<string, string> = {
  circ: '°',
  degree: '°',
  times: '×',
  div: '÷',
  pm: '±',
  mp: '∓',
  cdot: '·',
  ast: '*',
  star: '⋆',
  leq: '≤',
  le: '≤',
  geq: '≥',
  ge: '≥',
  neq: '≠',
  ne: '≠',
  approx: '≈',
  sim: '∼',
  simeq: '≃',
  cong: '≅',
  equiv: '≡',
  propto: '∝',
  infty: '∞',
  partial: '∂',
  nabla: '∇',
  forall: '∀',
  exists: '∃',
  emptyset: '∅',
  varnothing: '∅',
  in: '∈',
  notin: '∉',
  ni: '∋',
  subset: '⊂',
  supset: '⊃',
  subseteq: '⊆',
  supseteq: '⊇',
  cup: '∪',
  cap: '∩',
  setminus: '∖',
  rightarrow: '→',
  to: '→',
  longrightarrow: '→',
  leftarrow: '←',
  gets: '←',
  leftrightarrow: '↔',
  Rightarrow: '⇒',
  implies: '⇒',
  Leftarrow: '⇐',
  Leftrightarrow: '⇔',
  iff: '⇔',
  uparrow: '↑',
  downarrow: '↓',
  rightleftharpoons: '⇌',
  alpha: 'α',
  beta: 'β',
  gamma: 'γ',
  delta: 'δ',
  epsilon: 'ε',
  varepsilon: 'ε',
  zeta: 'ζ',
  eta: 'η',
  theta: 'θ',
  vartheta: 'θ',
  iota: 'ι',
  kappa: 'κ',
  lambda: 'λ',
  mu: 'μ',
  nu: 'ν',
  xi: 'ξ',
  pi: 'π',
  rho: 'ρ',
  sigma: 'σ',
  varsigma: 'ς',
  tau: 'τ',
  upsilon: 'υ',
  phi: 'φ',
  varphi: 'φ',
  chi: 'χ',
  psi: 'ψ',
  omega: 'ω',
  Gamma: 'Γ',
  Delta: 'Δ',
  Theta: 'Θ',
  Lambda: 'Λ',
  Xi: 'Ξ',
  Pi: 'Π',
  Sigma: 'Σ',
  Upsilon: 'Υ',
  Phi: 'Φ',
  Psi: 'Ψ',
  Omega: 'Ω',
  int: '∫',
  sum: '∑',
  prod: '∏',
  therefore: '∴',
  because: '∵',
  angle: '∠',
  triangle: '△',
  perp: '⊥',
  parallel: '∥',
  prime: '′',
  sin: 'sin',
  cos: 'cos',
  tan: 'tan',
  cot: 'cot',
  sec: 'sec',
  csc: 'csc',
  log: 'log',
  ln: 'ln',
  lim: 'lim',
  max: 'max',
  min: 'min',
  det: 'det',
  exp: 'exp',
  quad: '\u00A0\u00A0',
  qquad: '\u00A0\u00A0\u00A0\u00A0',
  dots: '…',
  cdots: '⋯',
  ldots: '…',
  vdots: '⋮',
  ddots: '⋱'
};

// Extract balanced {...} argument starting at index `start` (where str[start] === '{')
export const extractBraceGroup = (
  str: string,
  start: number
): { content: string; nextIndex: number; closed: boolean } => {
  if (start >= str.length || str[start] !== '{') {
    return { content: str[start] || '', nextIndex: Math.min(str.length, start + 1), closed: false };
  }
  let depth = 0;
  let i = start;
  while (i < str.length) {
    if (str[i] === '\\') {
      i += 2;
      continue;
    }
    if (str[i] === '{') depth++;
    else if (str[i] === '}') {
      depth--;
      if (depth === 0) {
        return { content: str.slice(start + 1, i), nextIndex: i + 1, closed: true };
      }
    }
    i++;
  }
  return { content: str.slice(start + 1), nextIndex: str.length, closed: false };
};

// Find matching \end{envName} accounting for nested \begin{envName}
const findMatchingEndEnv = (
  src: string,
  searchStart: number,
  envName: string
): { endPos: number; afterEndPos: number } | null => {
  const beginTag = `\\begin{${envName}}`;
  const endTag = `\\end{${envName}}`;
  let depth = 1;
  let i = searchStart;
  while (i < src.length) {
    if (src.startsWith(beginTag, i)) {
      depth++;
      i += beginTag.length;
      continue;
    }
    if (src.startsWith(endTag, i)) {
      depth--;
      if (depth === 0) {
        return { endPos: i, afterEndPos: i + endTag.length };
      }
      i += endTag.length;
      continue;
    }
    i++;
  }
  return null;
};

interface ParsedColumnSpec {
  alignments: ('left' | 'center' | 'right')[];
  leftBorders: boolean[];
  rightBorder: boolean;
  hasVerticalBorders: boolean;
}

const expandStarRepeatSpec = (spec: string): string => {
  let result = '';
  let i = 0;
  while (i < spec.length) {
    if (spec[i] === '*') {
      let j = i + 1;
      while (j < spec.length && spec[j] === ' ') j++;
      if (spec[j] === '{') {
        const countGrp = extractBraceGroup(spec, j);
        j = countGrp.nextIndex;
        while (j < spec.length && spec[j] === ' ') j++;
        if (spec[j] === '{') {
          const patGrp = extractBraceGroup(spec, j);
          const count = Math.min(50, Math.max(0, parseInt(countGrp.content.trim(), 10) || 0));
          result += patGrp.content.repeat(count);
          i = patGrp.nextIndex;
          continue;
        }
      }
    }
    result += spec[i];
    i++;
  }
  return result;
};

const parseColumnSpec = (rawSpec: string): ParsedColumnSpec => {
  const spec = expandStarRepeatSpec(rawSpec.trim());
  const alignments: ('left' | 'center' | 'right')[] = [];
  const leftBorders: boolean[] = [];
  let pendingPipe = false;
  let hasVerticalBorders = false;

  let i = 0;
  while (i < spec.length) {
    const ch = spec[i];
    if (ch === '|') {
      pendingPipe = true;
      hasVerticalBorders = true;
      i++;
      continue;
    }
    if (ch === 'l' || ch === 'c' || ch === 'r' || ch === 'p' || ch === 'm' || ch === 'b') {
      const align = ch === 'l' ? 'left' : ch === 'r' ? 'right' : 'center';
      alignments.push(align);
      leftBorders.push(pendingPipe);
      pendingPipe = false;
      i++;
      // Skip optional width group for p{...}, m{...}, b{...}
      while (i < spec.length && spec[i] === ' ') i++;
      if ((ch === 'p' || ch === 'm' || ch === 'b') && spec[i] === '{') {
        const grp = extractBraceGroup(spec, i);
        i = grp.nextIndex;
      }
      continue;
    }
    if (ch === '{') {
      const grp = extractBraceGroup(spec, i);
      i = grp.nextIndex;
      continue;
    }
    i++;
  }

  return {
    alignments,
    leftBorders,
    rightBorder: pendingPipe,
    hasVerticalBorders
  };
};

// Split string by row separator `\\` or `\tabularnewline` at brace/env depth 0
const splitLatexRows = (body: string): string[] => {
  const rows: string[] = [];
  let current = '';
  let braceDepth = 0;
  let envDepth = 0;
  let i = 0;

  while (i < body.length) {
    if (body.startsWith('\\begin{', i)) {
      const endEnv = body.indexOf('}', i + 7);
      if (endEnv !== -1) {
        envDepth++;
        current += body.slice(i, endEnv + 1);
        i = endEnv + 1;
        continue;
      }
    }
    if (body.startsWith('\\end{', i)) {
      const endEnv = body.indexOf('}', i + 5);
      if (endEnv !== -1) {
        envDepth = Math.max(0, envDepth - 1);
        current += body.slice(i, endEnv + 1);
        i = endEnv + 1;
        continue;
      }
    }

    if (body[i] === '\\') {
      const next = body[i + 1];
      if (next === '\\' && braceDepth === 0 && envDepth === 0) {
        rows.push(current);
        current = '';
        i += 2;
        // Skip optional `*` and `[...]` after `\\`
        while (i < body.length && body[i] === ' ') i++;
        if (body[i] === '*') i++;
        while (i < body.length && body[i] === ' ') i++;
        if (body[i] === '[') {
          const closeBracket = body.indexOf(']', i + 1);
          if (closeBracket !== -1) {
            i = closeBracket + 1;
          }
        }
        continue;
      }
      if (body.startsWith('\\tabularnewline', i) && braceDepth === 0 && envDepth === 0) {
        rows.push(current);
        current = '';
        i += '\\tabularnewline'.length;
        continue;
      }
      // Escaped char like \{, \}, \&
      if (next) {
        current += body[i] + next;
        i += 2;
        continue;
      }
    }

    if (body[i] === '{') braceDepth++;
    else if (body[i] === '}') braceDepth = Math.max(0, braceDepth - 1);

    current += body[i];
    i++;
  }

  if (current.trim()) {
    rows.push(current);
  }
  return rows;
};

// Split a single row by `&` at brace/env depth 0
const splitLatexCells = (rowStr: string): string[] => {
  const cells: string[] = [];
  let current = '';
  let braceDepth = 0;
  let envDepth = 0;
  let i = 0;

  while (i < rowStr.length) {
    if (rowStr.startsWith('\\begin{', i)) {
      const endEnv = rowStr.indexOf('}', i + 7);
      if (endEnv !== -1) {
        envDepth++;
        current += rowStr.slice(i, endEnv + 1);
        i = endEnv + 1;
        continue;
      }
    }
    if (rowStr.startsWith('\\end{', i)) {
      const endEnv = rowStr.indexOf('}', i + 5);
      if (endEnv !== -1) {
        envDepth = Math.max(0, envDepth - 1);
        current += rowStr.slice(i, endEnv + 1);
        i = endEnv + 1;
        continue;
      }
    }

    if (rowStr[i] === '\\' && i + 1 < rowStr.length) {
      current += rowStr[i] + rowStr[i + 1];
      i += 2;
      continue;
    }

    if (rowStr[i] === '{') braceDepth++;
    else if (rowStr[i] === '}') braceDepth = Math.max(0, braceDepth - 1);
    else if (rowStr[i] === '&' && braceDepth === 0 && envDepth === 0) {
      cells.push(current.trim());
      current = '';
      i++;
      continue;
    }

    current += rowStr[i];
    i++;
  }

  cells.push(current.trim());
  return cells;
};

interface ParsedCell {
  content: string;
  colSpan: number;
  align?: 'left' | 'center' | 'right';
  hasLeftBorder?: boolean;
  hasRightBorder?: boolean;
}

const parseMulticolumnCell = (cellRaw: string): ParsedCell => {
  const trimmed = cellRaw.trim();
  if (!trimmed.startsWith('\\multicolumn')) {
    return { content: trimmed, colSpan: 1 };
  }

  let i = '\\multicolumn'.length;
  while (i < trimmed.length && /\s/.test(trimmed[i])) i++;
  if (trimmed[i] !== '{') {
    return { content: trimmed, colSpan: 1 };
  }
  const colsGrp = extractBraceGroup(trimmed, i);
  i = colsGrp.nextIndex;
  while (i < trimmed.length && /\s/.test(trimmed[i])) i++;
  if (trimmed[i] !== '{') {
    return { content: trimmed, colSpan: 1 };
  }
  const alignGrp = extractBraceGroup(trimmed, i);
  i = alignGrp.nextIndex;
  while (i < trimmed.length && /\s/.test(trimmed[i])) i++;
  if (trimmed[i] !== '{') {
    return { content: trimmed, colSpan: 1 };
  }
  const contentGrp = extractBraceGroup(trimmed, i);
  const rest = trimmed.slice(contentGrp.nextIndex).trim();

  const colSpan = Math.max(1, parseInt(colsGrp.content.trim(), 10) || 1);
  const alignSpec = parseColumnSpec(alignGrp.content);
  const align = alignSpec.alignments[0] || 'center';

  return {
    content: (contentGrp.content + (rest ? ' ' + rest : '')).trim(),
    colSpan,
    align,
    hasLeftBorder: alignSpec.leftBorders[0],
    hasRightBorder: alignSpec.rightBorder
  };
};

interface ParsedTableRow {
  cells: ParsedCell[];
  borderTop: boolean;
  borderBottom: boolean;
}

const parseTableRowsWithHlines = (body: string): { rows: ParsedTableRow[]; hasAnyHline: boolean } => {
  const rawSegments = splitLatexRows(body);
  const rows: ParsedTableRow[] = [];
  let carryBorderTop = false;
  let hasAnyHline = false;

  const hlinePattern = /^(?:\s*(?:\\hline|\\toprule|\\midrule|\\bottomrule|\\cline\s*\{[^}]*\})\s*)+/;
  const trailingHlinePattern = /(?:\s*(?:\\hline|\\toprule|\\midrule|\\bottomrule|\\cline\s*\{[^}]*\})\s*)+$/;

  for (const rawSeg of rawSegments) {
    let s = rawSeg.trim();
    if (!s) continue;

    let rowBorderTop = carryBorderTop;
    carryBorderTop = false;

    const leadMatch = s.match(hlinePattern);
    if (leadMatch) {
      rowBorderTop = true;
      hasAnyHline = true;
      s = s.slice(leadMatch[0].length).trim();
    }

    // If the segment was ONLY \hline(s) (for instance after the final `\\`)
    if (!s) {
      if (rows.length > 0) {
        rows[rows.length - 1].borderBottom = true;
      } else {
        carryBorderTop = true;
      }
      continue;
    }

    let rowBorderBottom = false;
    const trailMatch = s.match(trailingHlinePattern);
    if (trailMatch) {
      rowBorderBottom = true;
      hasAnyHline = true;
      s = s.slice(0, s.length - trailMatch[0].length).trim();
    }

    if (!s) {
      if (rows.length > 0) {
        rows[rows.length - 1].borderBottom = true;
      } else {
        carryBorderTop = true;
      }
      continue;
    }

    const rawCells = splitLatexCells(s);
    const parsedCells = rawCells.map(c => {
      const cleanedCell = c
        .replace(hlinePattern, '')
        .replace(trailingHlinePattern, '')
        .trim();
      return parseMulticolumnCell(cleanedCell);
    });

    if (rowBorderTop && rows.length > 0) {
      rows[rows.length - 1].borderBottom = true;
    }

    rows.push({
      cells: parsedCells,
      borderTop: rowBorderTop,
      borderBottom: rowBorderBottom
    });
  }

  return { rows, hasAnyHline };
};

/**
 * Validates a single LaTeX/text string for malformed LaTeX syntax.
 * Returns null if valid, or a descriptive error message if malformed.
 */
export const validateLatexString = (rawText: string): string | null => {
  if (!rawText || !rawText.trim()) return null;
  const text = rawText.trim();

  // Quick check: if there are no backslashes, braces, or dollar signs, it is plain text
  if (!/[\\{}$]/.test(text)) return null;

  // 1. Validate balanced curly braces (ignoring escaped \{ and \})
  let braceDepth = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\\') {
      i++;
      continue;
    }
    if (text[i] === '{') braceDepth++;
    else if (text[i] === '}') {
      braceDepth--;
      if (braceDepth < 0) {
        return "Unbalanced curly braces: found closing '}' without a matching opening '{'.";
      }
    }
  }
  if (braceDepth > 0) {
    return `Unbalanced curly braces: ${braceDepth} opening '{' ${braceDepth === 1 ? 'is' : 'are'} missing a closing '}'.`;
  }

  // 2. Validate \[ ... \] and \( ... \) delimiters
  let displayBracketDepth = 0;
  let inlineParenDepth = 0;
  for (let i = 0; i < text.length; i++) {
    if (text.startsWith('\\[', i)) {
      displayBracketDepth++;
      i++;
    } else if (text.startsWith('\\]', i)) {
      displayBracketDepth--;
      if (displayBracketDepth < 0) {
        return "Mismatched math delimiter: found '\\]' without a matching '\\['.";
      }
      i++;
    } else if (text.startsWith('\\(', i)) {
      inlineParenDepth++;
      i++;
    } else if (text.startsWith('\\)', i)) {
      inlineParenDepth--;
      if (inlineParenDepth < 0) {
        return "Mismatched math delimiter: found '\\)' without a matching '\\('.";
      }
      i++;
    } else if (text[i] === '\\') {
      i++;
    }
  }
  if (displayBracketDepth !== 0) {
    return "Unclosed display math delimiter '\\[' (missing matching '\\]').";
  }
  if (inlineParenDepth !== 0) {
    return "Unclosed inline math delimiter '\\(' (missing matching '\\)').";
  }

  // 3. Validate $ and $$ delimiters (ignoring escaped \$)
  let singleDollarCount = 0;
  let doubleDollarCount = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\\') {
      i++;
      continue;
    }
    if (text[i] === '$') {
      if (text[i + 1] === '$') {
        doubleDollarCount++;
        i++;
      } else {
        singleDollarCount++;
      }
    }
  }
  if (doubleDollarCount % 2 !== 0) {
    return "Unclosed display math delimiter '$$' (must appear in opening and closing pairs).";
  }
  if (singleDollarCount % 2 !== 0) {
    return "Unclosed inline math delimiter '$' (odd number of '$' symbols found).";
  }

  // 4. Validate \begin{...} and \end{...} environments
  const envStack: { name: string; index: number }[] = [];
  let idx = 0;
  while (idx < text.length) {
    if (text[idx] === '\\') {
      const rest = text.slice(idx);
      const cmdMatch = rest.match(/^\\([a-zA-Z]+)/);
      if (cmdMatch) {
        const cmd = cmdMatch[1];
        const afterCmdIdx = idx + 1 + cmd.length;
        let ptr = afterCmdIdx;
        while (ptr < text.length && /\s/.test(text[ptr])) ptr++;

        if (cmd === 'begin') {
          if (text[ptr] !== '{') {
            return "Malformed '\\begin' command: missing environment name in braces (e.g. \\begin{array}{|c|c|}).";
          }
          const envGrp = extractBraceGroup(text, ptr);
          const envName = envGrp.content.trim();
          if (!envName) {
            return "Empty environment name in '\\begin{}'.";
          }
          envStack.push({ name: envName, index: idx });
          ptr = envGrp.nextIndex;

          // If envName is array or tabular, validate its column specification right away
          if (envName === 'array' || envName === 'tabular') {
            while (ptr < text.length && /\s/.test(text[ptr])) ptr++;
            // Skip optional [t], [c], [b] alignment
            if (text[ptr] === '[') {
              const closeB = text.indexOf(']', ptr + 1);
              if (closeB === -1) {
                return `Unclosed optional bracket '[' after \\begin{${envName}}.`;
              }
              ptr = closeB + 1;
              while (ptr < text.length && /\s/.test(text[ptr])) ptr++;
            }
            if (text[ptr] !== '{') {
              return `Missing column specification after \\begin{${envName}} (expected e.g. \\begin{${envName}}{|c|c|c|}).`;
            }
            const colSpecGrp = extractBraceGroup(text, ptr);
            const parsedSpec = parseColumnSpec(colSpecGrp.content);
            if (parsedSpec.alignments.length === 0) {
              return `Invalid column specification '{${colSpecGrp.content}}' in \\begin{${envName}}: must contain at least one alignment column ('l', 'c', 'r', or 'p{...}').`;
            }

            // Also validate the body of this array/tabular if matching \end exists
            const endMatch = findMatchingEndEnv(text, colSpecGrp.nextIndex, envName);
            if (endMatch) {
              const tableBody = text.slice(colSpecGrp.nextIndex, endMatch.endPos);
              const { rows } = parseTableRowsWithHlines(tableBody);
              const maxDefinedCols = parsedSpec.alignments.length;

              if (rows.length === 0) {
                return `Empty table body inside \\begin{${envName}}...\\end{${envName}}.`;
              }

              for (let rIdx = 0; rIdx < rows.length; rIdx++) {
                const row = rows[rIdx];
                let rowColSum = 0;
                for (const cell of row.cells) {
                  rowColSum += cell.colSpan;
                }
                if (rowColSum > maxDefinedCols) {
                  return `Table row ${rIdx + 1} has ${rowColSum} columns, which exceeds the ${maxDefinedCols} columns defined in \\begin{${envName}}{${colSpecGrp.content}}.`;
                }
              }

              if (
                maxDefinedCols > 1 &&
                rows.every(r => r.cells.length === 1 && r.cells[0].colSpan === 1)
              ) {
                return `Malformed table inside \\begin{${envName}}{${colSpecGrp.content}}: ${maxDefinedCols} columns were defined, but no '&' column separators were found in any row.`;
              }
            }
          }
          idx = ptr;
          continue;
        }

        if (cmd === 'end') {
          if (text[ptr] !== '{') {
            return "Malformed '\\end' command: missing environment name in braces (e.g. \\end{array}).";
          }
          const envGrp = extractBraceGroup(text, ptr);
          const envName = envGrp.content.trim();
          if (envStack.length === 0) {
            return `Unexpected '\\end{${envName}}' without a matching '\\begin{${envName}}'.`;
          }
          const top = envStack.pop()!;
          if (top.name !== envName) {
            return `Mismatched LaTeX environment: found '\\end{${envName}}' but expected '\\end{${top.name}}'.`;
          }
          idx = envGrp.nextIndex;
          continue;
        }

        if (cmd === 'multicolumn') {
          if (text[ptr] !== '{') {
            return "Malformed '\\multicolumn' command: expected \\multicolumn{numCols}{align}{content}.";
          }
          const grp1 = extractBraceGroup(text, ptr);
          const numCols = parseInt(grp1.content.trim(), 10);
          if (isNaN(numCols) || numCols < 1) {
            return `Invalid column span '${grp1.content}' in \\multicolumn: first argument must be a positive integer.`;
          }
          let p2 = grp1.nextIndex;
          while (p2 < text.length && /\s/.test(text[p2])) p2++;
          if (text[p2] !== '{') {
            return "Malformed '\\multicolumn' command: missing second argument {alignment} (e.g. {|c|}).";
          }
          const grp2 = extractBraceGroup(text, p2);
          const mcSpec = parseColumnSpec(grp2.content);
          if (mcSpec.alignments.length === 0) {
            return `Invalid alignment '${grp2.content}' in \\multicolumn: must include 'l', 'c', or 'r'.`;
          }
          let p3 = grp2.nextIndex;
          while (p3 < text.length && /\s/.test(text[p3])) p3++;
          if (text[p3] !== '{') {
            return "Malformed '\\multicolumn' command: missing third argument {content}.";
          }
          idx = afterCmdIdx;
          continue;
        }

        if (cmd === 'frac' || cmd === 'dfrac' || cmd === 'tfrac') {
          if (text[ptr] !== '{') {
            return `Malformed '\\${cmd}' command: expected \\${cmd}{numerator}{denominator}.`;
          }
          const numGrp = extractBraceGroup(text, ptr);
          let p2 = numGrp.nextIndex;
          while (p2 < text.length && /\s/.test(text[p2])) p2++;
          if (text[p2] !== '{') {
            return `Incomplete '\\${cmd}' command: missing denominator brace group {denominator}.`;
          }
          idx = afterCmdIdx;
          continue;
        }

        if (cmd === 'sqrt') {
          if (text[ptr] === '[') {
            const closeB = text.indexOf(']', ptr + 1);
            if (closeB === -1) {
              return "Unclosed optional root bracket '[' in \\sqrt[...]{...}.";
            }
            ptr = closeB + 1;
            while (ptr < text.length && /\s/.test(text[ptr])) ptr++;
          }
          if (ptr >= text.length) {
            return "Incomplete '\\sqrt' command: missing expression argument.";
          }
          idx = afterCmdIdx;
          continue;
        }

        idx = afterCmdIdx;
        continue;
      }
      idx += 2;
      continue;
    }
    idx++;
  }

  if (envStack.length > 0) {
    const unclosed = envStack[envStack.length - 1];
    return `Unclosed LaTeX environment: '\\begin{${unclosed.name}}' is missing its matching '\\end{${unclosed.name}}'.`;
  }

  return null;
};

/**
 * Validates all text/option fields of a question row and returns any LaTeX validation errors.
 */
export const validateQuestionLatex = (
  q: { text?: string; textUrdu?: string; options?: string[]; optionsUrdu?: string[] },
  rowNumber?: number
): LatexValidationError[] => {
  const errors: LatexValidationError[] = [];

  const checkField = (val: string | undefined, fieldLabel: string) => {
    if (!val) return;
    const err = validateLatexString(val);
    if (err) {
      errors.push({
        row: rowNumber,
        field: fieldLabel,
        message: err,
        snippet: val.length > 90 ? val.slice(0, 90) + '…' : val
      });
    }
  };

  checkField(q.text, 'Question(Eng)');
  checkField(q.textUrdu, 'Question(Urdu)');

  if (q.options && q.options.length > 0) {
    q.options.forEach((opt, idx) => {
      checkField(opt, `Opt${String.fromCharCode(65 + idx)}(Eng)`);
    });
  }
  if (q.optionsUrdu && q.optionsUrdu.length > 0) {
    q.optionsUrdu.forEach((opt, idx) => {
      checkField(opt, `Opt${String.fromCharCode(65 + idx)}(Urdu)`);
    });
  }

  return errors;
};

/**
 * Renders a LaTeX array/tabular/matrix environment as a semantic HTML table (or inline matrix)
 * that automatically adjusts width, prevents page overflow, and preserves formatting in Preview, Print, PDF, and Word.
 */
const renderLatexArrayOrMatrix = (
  envName: string,
  afterBeginContent: string,
  key: string,
  options: RenderLatexOptions = {}
): React.ReactNode => {
  try {
    const isPaper = options.variant !== 'preview';
    const borderColor = isPaper ? '#000000' : 'currentColor';

    let ptr = 0;
    while (ptr < afterBeginContent.length && /\s/.test(afterBeginContent[ptr])) ptr++;

    // Optional [t], [c], [b]
    if (afterBeginContent[ptr] === '[') {
      const closeB = afterBeginContent.indexOf(']', ptr + 1);
      if (closeB !== -1) {
        ptr = closeB + 1;
        while (ptr < afterBeginContent.length && /\s/.test(afterBeginContent[ptr])) ptr++;
      }
    }

    const isTableEnv = envName === 'array' || envName === 'tabular';
    let colSpec: ParsedColumnSpec = {
      alignments: [],
      leftBorders: [],
      rightBorder: false,
      hasVerticalBorders: false
    };

    if (isTableEnv && afterBeginContent[ptr] === '{') {
      const specGrp = extractBraceGroup(afterBeginContent, ptr);
      colSpec = parseColumnSpec(specGrp.content);
      ptr = specGrp.nextIndex;
    }

    const body = afterBeginContent.slice(ptr).trim();
    const { rows, hasAnyHline } = parseTableRowsWithHlines(body);

    const maxRowCols = rows.reduce((max, r) => {
      const sum = r.cells.reduce((acc, c) => acc + c.colSpan, 0);
      return Math.max(max, sum);
    }, colSpec.alignments.length || 1);

    const numCols = Math.max(1, maxRowCols);
    const isBorderedTable = isTableEnv && (colSpec.hasVerticalBorders || hasAnyHline);

    // Matrix delimiters for pmatrix, bmatrix, vmatrix, Bmatrix
    if (!isTableEnv) {
      const leftDelim =
        envName === 'pmatrix' ? '(' : envName === 'bmatrix' ? '[' : envName === 'vmatrix' ? '|' : envName === 'Bmatrix' ? '{' : '';
      const rightDelim =
        envName === 'pmatrix' ? ')' : envName === 'bmatrix' ? ']' : envName === 'vmatrix' ? '|' : envName === 'Bmatrix' ? '}' : '';

      return (
        <span key={key} className="inline-flex items-center align-middle mx-1 my-0.5" dir="ltr">
          {leftDelim && <span className="font-normal px-0.5 text-[1.2em] leading-none">{leftDelim}</span>}
          <span className="inline-table border-collapse align-middle">
            {rows.map((row, rIdx) => (
              <span key={rIdx} className="table-row">
                {row.cells.map((cell, cIdx) => (
                  <span key={cIdx} className="table-cell px-1.5 py-0.5 text-center leading-tight">
                    {renderLatexCellContent(cell.content, `${key}-mc-${rIdx}-${cIdx}`, options)}
                  </span>
                ))}
              </span>
            ))}
          </span>
          {rightDelim && <span className="font-normal px-0.5 text-[1.2em] leading-none">{rightDelim}</span>}
        </span>
      );
    }

    // Responsive padding & font scaling based on column count so wide tables never overflow margins
    const cellPadding =
      numCols >= 10 ? '2px 3px' : numCols >= 8 ? '2px 5px' : numCols >= 6 ? '3px 6px' : '3px 8px';
    const tableFontSize =
      numCols >= 10 ? '0.82em' : numCols >= 8 ? '0.88em' : numCols >= 6 ? '0.93em' : '0.98em';

    return (
      <div
        key={key}
        dir="ltr"
        className="latex-table-container my-1.5 w-full max-w-full overflow-x-auto print:overflow-visible break-inside-avoid"
        style={{
          maxWidth: '100%',
          boxSizing: 'border-box',
          display: 'block',
          whiteSpace: 'normal'
        }}
      >
        <table
          border={isBorderedTable ? 1 : 0}
          cellSpacing={0}
          cellPadding={3}
          className="latex-array-table border-collapse"
          style={{
            borderCollapse: 'collapse',
            width: numCols >= 6 ? '100%' : 'auto',
            maxWidth: '100%',
            tableLayout: 'auto',
            fontSize: tableFontSize,
            lineHeight: 1.25,
            fontFamily: "'Times New Roman', serif",
            color: isPaper ? '#000000' : 'inherit',
            border: isBorderedTable ? `1px solid ${borderColor}` : 'none',
            margin: options.isUrduContext ? '4px 0 4px auto' : '4px 0'
          }}
        >
          <tbody>
            {rows.map((row, rIdx) => {
              let colCursor = 0;
              const isFirstRow = rIdx === 0;
              const isLastRow = rIdx === rows.length - 1;

              return (
                <tr key={rIdx} className="break-inside-avoid">
                  {row.cells.map((cell, cIdx) => {
                    const startCol = colCursor;
                    const endCol = colCursor + cell.colSpan - 1;
                    colCursor += cell.colSpan;

                    const colAlign =
                      cell.align || colSpec.alignments[startCol] || 'center';

                    const showTop =
                      isBorderedTable && (row.borderTop || isFirstRow || hasAnyHline);
                    const showBottom =
                      isBorderedTable && (row.borderBottom || isLastRow || hasAnyHline);
                    const showLeft =
                      isBorderedTable &&
                      (cell.hasLeftBorder ??
                        colSpec.leftBorders[startCol] ??
                        true);
                    const showRight =
                      isBorderedTable &&
                      (cell.hasRightBorder ??
                        (endCol === numCols - 1
                          ? colSpec.rightBorder || colSpec.hasVerticalBorders || hasAnyHline
                          : colSpec.leftBorders[endCol + 1] ?? true));

                    return (
                      <td
                        key={cIdx}
                        colSpan={cell.colSpan > 1 ? cell.colSpan : undefined}
                        align={colAlign}
                        style={{
                          textAlign: colAlign,
                          padding: cellPadding,
                          verticalAlign: 'middle',
                          borderTop: showTop ? `1px solid ${borderColor}` : 'none',
                          borderBottom: showBottom ? `1px solid ${borderColor}` : 'none',
                          borderLeft: showLeft ? `1px solid ${borderColor}` : 'none',
                          borderRight: showRight ? `1px solid ${borderColor}` : 'none',
                          wordBreak: 'break-word',
                          overflowWrap: 'anywhere'
                        }}
                      >
                        {renderLatexCellContent(cell.content, `${key}-c-${rIdx}-${cIdx}`, options)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  } catch {
    return (
      <span key={key} className="text-red-500 text-xs font-mono">
        [Invalid LaTeX Table]
      </span>
    );
  }
};

/**
 * Renders the content inside a table cell (supporting math expressions, \text{}, *bold*, :underline:, and Urdu text).
 */
const renderLatexCellContent = (
  rawCell: string,
  keyPrefix: string,
  options: RenderLatexOptions = {}
): React.ReactNode => {
  if (!rawCell) return '\u00A0';
  let cell = rawCell.trim();
  if (!cell) return '\u00A0';

  if (cell.startsWith('$$') && cell.endsWith('$$') && cell.length > 4) {
    cell = cell.slice(2, -2).trim();
  } else if (
    cell.startsWith('$') &&
    cell.endsWith('$') &&
    cell.length > 2 &&
    !cell.slice(1, -1).includes('$')
  ) {
    cell = cell.slice(1, -1).trim();
  }

  const hasUrdu = isUrduText(cell);
  if (hasUrdu) {
    const urduFontStack = "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif";
    const unwrappedUrdu = cell.replace(/\\(?:text|textbf|mathrm)\{([^}]*)\}/g, '$1');
    // Split Urdu portions vs math/LTR portions
    const parts = unwrappedUrdu.split(/(\$[^$]+\$|\\[a-zA-Z]+(?:\{[^}]*\})*|[A-Za-z0-9_^+\-=×÷/().,]+)/g);
    return (
      <span
        dir="rtl"
        style={{ fontFamily: urduFontStack, lineHeight: 1.45, display: 'inline-block' }}
      >
        {parts.map((part, pIdx) => {
          if (!part) return null;
          if (isUrduText(part)) {
            return <React.Fragment key={pIdx}>{part}</React.Fragment>;
          }
          if (part.trim()) {
            const cleanPart = part.replace(/^\$|\$$/g, '');
            return (
              <span
                key={pIdx}
                dir="ltr"
                style={{ fontFamily: "'Times New Roman', serif", unicodeBidi: 'isolate' }}
                className="inline-block align-baseline mx-[1px]"
              >
                {renderMathNodes(cleanPart, `${keyPrefix}-u-${pIdx}`, options)}
              </span>
            );
          }
          return part;
        })}
      </span>
    );
  }

  if (/(\*[^*]+\*|:[^:]+:)/.test(cell) && !cell.includes('\\')) {
    return renderFormattedTextWithLatex(cell, options);
  }

  const cleanedMathCell = cell.replace(/\$/g, '');
  return renderMathNodes(cleanedMathCell, keyPrefix, options);
};

/**
 * Native HTML/React renderer for LaTeX math expressions so html2canvas, print, and Word export never shift baselines.
 */
export const renderMathNodes = (
  expr: string,
  keyPrefix: string = 'm',
  options: RenderLatexOptions = {}
): React.ReactNode[] => {
  const nodes: React.ReactNode[] = [];
  let i = 0;
  let textBuf = '';
  let nodeIdx = 0;
  const isPaper = options.variant !== 'preview';
  const lineColorClass = isPaper ? 'border-black' : 'border-current';

  const flushBuf = () => {
    if (textBuf) {
      nodes.push(textBuf);
      textBuf = '';
    }
  };

  const src = (expr || '')
    .replace(/\^\{\s*\\circ\s*\}/g, '°')
    .replace(/\^\\circ\b/g, '°')
    .replace(/\^\{\s*\\degree\s*\}/g, '°')
    .replace(/\^\\degree\b/g, '°');

  while (i < src.length) {
    // Handle \begin{array|tabular|...matrix} ... \end{...}
    if (src.startsWith('\\begin{', i)) {
      const endEnvName = src.indexOf('}', i + 7);
      if (endEnvName !== -1) {
        const envName = src.slice(i + 7, endEnvName).trim();
        const matchEnd = findMatchingEndEnv(src, endEnvName + 1, envName);
        if (matchEnd) {
          flushBuf();
          const inner = src.slice(endEnvName + 1, matchEnd.endPos);
          nodes.push(
            renderLatexArrayOrMatrix(envName, inner, `${keyPrefix}-env-${nodeIdx++}`, options)
          );
          i = matchEnd.afterEndPos;
          continue;
        }
      }
    }

    const ch = src[i];

    if (ch === '\\') {
      const nextCh = src[i + 1];
      if (!nextCh) {
        i++;
        continue;
      }
      if (['%', '&', '#', '_', '{', '}', '$'].includes(nextCh)) {
        textBuf += nextCh;
        i += 2;
        continue;
      }
      if ([',', ';', ':'].includes(nextCh)) {
        textBuf += '\u00A0';
        i += 2;
        continue;
      }
      if (nextCh === '!' || nextCh === ' ') {
        if (nextCh === ' ') textBuf += ' ';
        i += 2;
        continue;
      }
      if (nextCh === '\\') {
        flushBuf();
        nodes.push(<br key={`${keyPrefix}-br-${nodeIdx++}`} />);
        i += 2;
        continue;
      }

      const cmdMatch = src.slice(i + 1).match(/^[a-zA-Z]+/);
      if (!cmdMatch) {
        textBuf += nextCh;
        i += 2;
        continue;
      }
      const cmd = cmdMatch[0];
      i += 1 + cmd.length;
      while (i < src.length && src[i] === ' ') i++;

      if (
        cmd === 'left' ||
        cmd === 'right' ||
        cmd === 'displaystyle' ||
        cmd === 'textstyle' ||
        cmd === 'scriptstyle' ||
        cmd === 'limits' ||
        cmd === 'nolimits'
      ) {
        continue;
      }

      if (cmd === 'frac' || cmd === 'dfrac' || cmd === 'tfrac') {
        flushBuf();
        const numGroup = extractBraceGroup(src, i);
        i = numGroup.nextIndex;
        while (i < src.length && src[i] === ' ') i++;
        const denGroup = extractBraceGroup(src, i);
        i = denGroup.nextIndex;
        nodes.push(
          <span
            key={`${keyPrefix}-frac-${nodeIdx++}`}
            className="inline-flex flex-col items-center justify-center align-middle mx-0.5"
            style={{ verticalAlign: 'middle', lineHeight: 1 }}
          >
            <span className={`border-b ${lineColorClass} px-0.5 pb-[1px] text-[0.86em] leading-none`}>
              {renderMathNodes(numGroup.content, `${keyPrefix}-fn-${nodeIdx}`, options)}
            </span>
            <span className="px-0.5 pt-[1px] text-[0.86em] leading-none">
              {renderMathNodes(denGroup.content, `${keyPrefix}-fd-${nodeIdx}`, options)}
            </span>
          </span>
        );
        continue;
      }

      if (cmd === 'binom') {
        flushBuf();
        const topGroup = extractBraceGroup(src, i);
        i = topGroup.nextIndex;
        while (i < src.length && src[i] === ' ') i++;
        const botGroup = extractBraceGroup(src, i);
        i = botGroup.nextIndex;
        nodes.push(
          <span
            key={`${keyPrefix}-binom-${nodeIdx++}`}
            className="inline-flex items-center align-middle mx-0.5"
          >
            <span className="text-[1.15em] leading-none">(</span>
            <span className="inline-flex flex-col items-center justify-center px-0.5 text-[0.85em] leading-tight">
              <span>{renderMathNodes(topGroup.content, `${keyPrefix}-bt-${nodeIdx}`, options)}</span>
              <span>{renderMathNodes(botGroup.content, `${keyPrefix}-bb-${nodeIdx}`, options)}</span>
            </span>
            <span className="text-[1.15em] leading-none">)</span>
          </span>
        );
        continue;
      }

      if (cmd === 'sqrt') {
        flushBuf();
        let rootContent = '';
        if (src[i] === '[') {
          const closeBracket = src.indexOf(']', i + 1);
          if (closeBracket !== -1) {
            rootContent = src.slice(i + 1, closeBracket);
            i = closeBracket + 1;
          }
        }
        while (i < src.length && src[i] === ' ') i++;
        const argGroup = extractBraceGroup(src, i);
        i = argGroup.nextIndex;
        nodes.push(
          <span key={`${keyPrefix}-sqrt-${nodeIdx++}`} className="inline-flex items-baseline align-baseline mx-[1px]">
            {rootContent && (
              <sup className="text-[0.65em] mr-[1px]">
                {renderMathNodes(rootContent, `${keyPrefix}-sr-${nodeIdx}`, options)}
              </sup>
            )}
            <span className="text-[1.02em] leading-none">√</span>
            <span className={`border-t ${lineColorClass} px-[2px] pt-[1px] leading-none`}>
              {renderMathNodes(argGroup.content, `${keyPrefix}-sa-${nodeIdx}`, options)}
            </span>
          </span>
        );
        continue;
      }

      if (['text', 'textrm', 'mathrm', 'mbox', 'operatorname'].includes(cmd)) {
        flushBuf();
        const grp = extractBraceGroup(src, i);
        i = grp.nextIndex;
        nodes.push(
          <span key={`${keyPrefix}-txt-${nodeIdx++}`} className="font-normal">
            {renderMathNodes(grp.content, `${keyPrefix}-txtc-${nodeIdx}`, options)}
          </span>
        );
        continue;
      }

      if (['textbf', 'mathbf', 'boldsymbol'].includes(cmd)) {
        flushBuf();
        const grp = extractBraceGroup(src, i);
        i = grp.nextIndex;
        nodes.push(
          <strong key={`${keyPrefix}-bf-${nodeIdx++}`} className="font-bold">
            {renderMathNodes(grp.content, `${keyPrefix}-bfc-${nodeIdx}`, options)}
          </strong>
        );
        continue;
      }

      if (['textit', 'mathit'].includes(cmd)) {
        flushBuf();
        const grp = extractBraceGroup(src, i);
        i = grp.nextIndex;
        nodes.push(
          <em key={`${keyPrefix}-it-${nodeIdx++}`} className="italic">
            {renderMathNodes(grp.content, `${keyPrefix}-itc-${nodeIdx}`, options)}
          </em>
        );
        continue;
      }

      if (cmd === 'overline' || cmd === 'bar') {
        flushBuf();
        const grp = extractBraceGroup(src, i);
        i = grp.nextIndex;
        nodes.push(
          <span key={`${keyPrefix}-bar-${nodeIdx++}`} className={`border-t ${lineColorClass} inline-block leading-none pt-[1px]`}>
            {renderMathNodes(grp.content, `${keyPrefix}-barc-${nodeIdx}`, options)}
          </span>
        );
        continue;
      }

      if (cmd === 'underline') {
        flushBuf();
        const grp = extractBraceGroup(src, i);
        i = grp.nextIndex;
        nodes.push(
          <span key={`${keyPrefix}-ul-${nodeIdx++}`} className={`border-b ${lineColorClass} inline-block leading-none pb-[1px]`}>
            {renderMathNodes(grp.content, `${keyPrefix}-ulc-${nodeIdx}`, options)}
          </span>
        );
        continue;
      }

      if (cmd === 'vec' || cmd === 'overrightarrow') {
        flushBuf();
        const grp = extractBraceGroup(src, i);
        i = grp.nextIndex;
        nodes.push(
          <span key={`${keyPrefix}-vec-${nodeIdx++}`} className="inline-block">
            {renderMathNodes(grp.content, `${keyPrefix}-vecc-${nodeIdx}`, options)}&#8407;
          </span>
        );
        continue;
      }

      if (cmd === 'hat' || cmd === 'widehat') {
        flushBuf();
        const grp = extractBraceGroup(src, i);
        i = grp.nextIndex;
        nodes.push(
          <span key={`${keyPrefix}-hat-${nodeIdx++}`} className="inline-block">
            {renderMathNodes(grp.content, `${keyPrefix}-hatc-${nodeIdx}`, options)}&#770;
          </span>
        );
        continue;
      }

      if (cmd === 'tilde' || cmd === 'widetilde') {
        flushBuf();
        const grp = extractBraceGroup(src, i);
        i = grp.nextIndex;
        nodes.push(
          <span key={`${keyPrefix}-tilde-${nodeIdx++}`} className="inline-block">
            {renderMathNodes(grp.content, `${keyPrefix}-tildec-${nodeIdx}`, options)}&#771;
          </span>
        );
        continue;
      }

      if (LATEX_SYMBOLS[cmd]) {
        textBuf += LATEX_SYMBOLS[cmd];
        continue;
      }

      textBuf += cmd;
      continue;
    }

    if (ch === '^' || ch === '_') {
      flushBuf();
      const isSup = ch === '^';
      i++;
      while (i < src.length && src[i] === ' ') i++;
      let grpContent = '';
      if (src[i] === '{') {
        const grp = extractBraceGroup(src, i);
        grpContent = grp.content;
        i = grp.nextIndex;
      } else if (src[i] === '\\') {
        const cmdMatch = src.slice(i + 1).match(/^[a-zA-Z]+/);
        if (cmdMatch) {
          grpContent = '\\' + cmdMatch[0];
          i += 1 + cmdMatch[0].length;
        } else {
          grpContent = src[i + 1] || '';
          i += 2;
        }
      } else {
        grpContent = src[i] || '';
        i++;
      }

      if (isSup && (grpContent === '\\circ' || grpContent === '°')) {
        textBuf += '°';
        continue;
      }

      if (isSup) {
        nodes.push(
          <sup key={`${keyPrefix}-sup-${nodeIdx++}`} className="text-[0.74em] leading-none">
            {renderMathNodes(grpContent, `${keyPrefix}-supc-${nodeIdx}`, options)}
          </sup>
        );
      } else {
        nodes.push(
          <sub key={`${keyPrefix}-sub-${nodeIdx++}`} className="text-[0.74em] leading-none">
            {renderMathNodes(grpContent, `${keyPrefix}-subc-${nodeIdx}`, options)}
          </sub>
        );
      }
      continue;
    }

    if (ch === '{' || ch === '}') {
      i++;
      continue;
    }

    textBuf += ch;
    i++;
  }

  flushBuf();
  return nodes;
};

type TopSegment =
  | { type: 'text'; content: string }
  | { type: 'math'; content: string; display: boolean }
  | { type: 'table'; envName: string; inner: string };

/**
 * Tokenizes a question string into ordinary text, inline/display math, and LaTeX array/tabular environments.
 * Properly handles \begin{array}...\end{array} both standalone and wrapped inside $...$ or $$...$$.
 */
const tokenizeQuestionContent = (text: string): TopSegment[] => {
  const segments: TopSegment[] = [];
  let buf = '';
  let i = 0;

  const flushText = () => {
    if (buf) {
      segments.push({ type: 'text', content: buf });
      buf = '';
    }
  };

  while (i < text.length) {
    // 1. Standalone \begin{array|tabular|...matrix}
    if (text.startsWith('\\begin{', i)) {
      const closeBrace = text.indexOf('}', i + 7);
      if (closeBrace !== -1) {
        const envName = text.slice(i + 7, closeBrace).trim();
        const matchEnd = findMatchingEndEnv(text, closeBrace + 1, envName);
        if (matchEnd) {
          flushText();
          const inner = text.slice(closeBrace + 1, matchEnd.endPos);
          segments.push({ type: 'table', envName, inner });
          i = matchEnd.afterEndPos;
          continue;
        }
      }
    }

    // 2. Display math $$ ... $$
    if (text.startsWith('$$', i)) {
      const endDollar = text.indexOf('$$', i + 2);
      if (endDollar !== -1) {
        flushText();
        segments.push({
          type: 'math',
          content: text.slice(i + 2, endDollar).trim(),
          display: true
        });
        i = endDollar + 2;
        continue;
      }
    }

    // 3. Display math \[ ... \]
    if (text.startsWith('\\[', i)) {
      const endBracket = text.indexOf('\\]', i + 2);
      if (endBracket !== -1) {
        flushText();
        segments.push({
          type: 'math',
          content: text.slice(i + 2, endBracket).trim(),
          display: true
        });
        i = endBracket + 2;
        continue;
      }
    }

    // 4. Inline math \( ... \)
    if (text.startsWith('\\(', i)) {
      const endParen = text.indexOf('\\)', i + 2);
      if (endParen !== -1) {
        flushText();
        segments.push({
          type: 'math',
          content: text.slice(i + 2, endParen).trim(),
          display: false
        });
        i = endParen + 2;
        continue;
      }
    }

    // 5. Inline math $ ... $ (environment-aware so $ inside \begin{array}...\end{array} doesn't prematurely close)
    if (text[i] === '$' && (i === 0 || text[i - 1] !== '\\')) {
      let j = i + 1;
      let envDepth = 0;
      let foundClose = -1;
      while (j < text.length) {
        if (text[j] === '\\') {
          if (text.startsWith('\\begin{', j)) {
            envDepth++;
          } else if (text.startsWith('\\end{', j)) {
            envDepth = Math.max(0, envDepth - 1);
          }
          j += 2;
          continue;
        }
        if (text[j] === '$' && envDepth === 0) {
          foundClose = j;
          break;
        }
        j++;
      }
      if (foundClose !== -1 && foundClose > i + 1) {
        flushText();
        segments.push({
          type: 'math',
          content: text.slice(i + 1, foundClose).trim(),
          display: false
        });
        i = foundClose + 1;
        continue;
      }
    }

    // 6. Standalone LaTeX commands outside $...$ (e.g. \frac{a}{b}, \sqrt{x}, \overline{X}, \bar{x})
    if (text[i] === '\\') {
      const cmdMatch = text.slice(i + 1).match(/^(frac|dfrac|tfrac|sqrt|overline|bar|vec|hat|binom)\b/);
      if (cmdMatch) {
        const cmd = cmdMatch[1];
        let ptr = i + 1 + cmd.length;
        while (ptr < text.length && text[ptr] === ' ') ptr++;
        if (cmd === 'sqrt' && text[ptr] === '[') {
          const closeB = text.indexOf(']', ptr + 1);
          if (closeB !== -1) ptr = closeB + 1;
          while (ptr < text.length && text[ptr] === ' ') ptr++;
        }
        if (text[ptr] === '{') {
          const g1 = extractBraceGroup(text, ptr);
          ptr = g1.nextIndex;
          if (cmd === 'frac' || cmd === 'dfrac' || cmd === 'tfrac' || cmd === 'binom') {
            while (ptr < text.length && text[ptr] === ' ') ptr++;
            if (text[ptr] === '{') {
              const g2 = extractBraceGroup(text, ptr);
              ptr = g2.nextIndex;
            }
          }
          flushText();
          segments.push({
            type: 'math',
            content: text.slice(i, ptr),
            display: false
          });
          i = ptr;
          continue;
        }
      }
    }

    buf += text[i];
    i++;
  }

  flushText();
  return segments;
};

/**
 * Main entry point to render question text containing ordinary text, *bold*, :underline:,
 * LaTeX equations ($...$, $$...$$, \(...\), \[...\]), and LaTeX tables (\begin{array}...\end{array}).
 */
export const renderFormattedTextWithLatex = (
  text: string,
  options: RenderLatexOptions = {}
): React.ReactNode => {
  if (!text) return null;

  const isPaper = options.variant !== 'preview';
  const hasUrdu = options.isUrduContext ?? isUrduText(text);
  const rawSegments = tokenizeQuestionContent(text);

  const isBlockTableSegment = (seg: TopSegment) =>
    seg.type === 'table' ||
    (seg.type === 'math' && /\\begin\{(?:array|tabular)\}/.test(seg.content));

  const segments = rawSegments.map((seg, idx) => {
    if (seg.type !== 'text') return seg;
    let c = seg.content;
    if (idx > 0 && isBlockTableSegment(rawSegments[idx - 1])) {
      c = c.replace(/^\r?\n/, '');
    }
    if (idx < rawSegments.length - 1 && isBlockTableSegment(rawSegments[idx + 1])) {
      c = c.replace(/\r?\n$/, '');
    }
    return { ...seg, content: c };
  });

  return segments.map((segment, segIdx) => {
    if (segment.type === 'table') {
      return renderLatexArrayOrMatrix(
        segment.envName,
        segment.inner,
        `tbl-${segIdx}`,
        { ...options, isUrduContext: hasUrdu }
      );
    }

    if (segment.type === 'math') {
      const innerMath = segment.content;
      const containsBlockTable = /\\begin\{(?:array|tabular)\}/.test(innerMath);

      if (containsBlockTable) {
        return (
          <div
            key={`math-block-${segIdx}`}
            dir="ltr"
            style={{ fontFamily: "'Times New Roman', serif", unicodeBidi: 'isolate', whiteSpace: 'normal' }}
            className="my-1 w-full max-w-full overflow-x-auto print:overflow-visible break-inside-avoid"
          >
            {renderMathNodes(innerMath, `m-${segIdx}`, { ...options, isUrduContext: hasUrdu })}
          </div>
        );
      }

      return (
        <span
          key={`math-${segIdx}`}
          dir="ltr"
          style={{ fontFamily: "'Times New Roman', serif", unicodeBidi: 'isolate', lineHeight: 1.15 }}
          className="inline-block align-baseline mx-[1.5px]"
        >
          {renderMathNodes(innerMath, `m-${segIdx}`, { ...options, isUrduContext: hasUrdu })}
        </span>
      );
    }

    // Plain/formatted text segment (*bold*, **bold**, <b>bold</b>, :underline:)
    const normalized = segment.content
      .replace(/<\/?b>/gi, '@@')
      .replace(/\*\*([^*]+)\*\*/g, '@@$1@@')
      .replace(/\*([^*]+)\*/g, '@@$1@@')
      .replace(/:([^:]+):/g, '##$1##')
      .replace(/@@/g, '**')
      .replace(/##/g, '++');

    const parts = normalized.split(/(\*\*.*?\*\*|\+\+.*?\+\+)/g);

    const renderPlainSegment = (plain: string, keyBase: string) => {
      if (!hasUrdu) return plain;
      const ltrChunks = plain.split(
        /([A-Za-z0-9][A-Za-z0-9\s.,°/%+\-=×÷()^]*[A-Za-z0-9°%)]|[A-Za-z]+|\d+(?:\.\d+)?)/g
      );
      return ltrChunks.map((chunk, cIdx) => {
        if (!chunk) return null;
        if (/^[A-Za-z0-9]/.test(chunk)) {
          return (
            <span
              key={`${keyBase}-ltr-${cIdx}`}
              dir="ltr"
              style={{ fontFamily: "'Times New Roman', serif", unicodeBidi: 'isolate' }}
              className="inline-block align-baseline mx-[1px]"
            >
              {chunk}
            </span>
          );
        }
        return chunk;
      });
    };

    return (
      <React.Fragment key={`seg-${segIdx}`}>
        {parts.map((part, i) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return (
              <strong
                key={i}
                className={
                  isPaper
                    ? 'font-bold'
                    : 'text-gold-500 font-bold [.light-theme_&]:text-gold-700'
                }
              >
                {renderPlainSegment(part.slice(2, -2), `b-${segIdx}-${i}`)}
              </strong>
            );
          }
          if (part.startsWith('++') && part.endsWith('++')) {
            return isPaper ? (
              <span
                key={i}
                className="border-b border-black inline-block leading-tight pb-[0.5px]"
              >
                {renderPlainSegment(part.slice(2, -2), `u-${segIdx}-${i}`)}
              </span>
            ) : (
              <u
                key={i}
                className="underline decoration-gold-500/50 [.light-theme_&]:decoration-gold-500/70"
              >
                {renderPlainSegment(part.slice(2, -2), `u-${segIdx}-${i}`)}
              </u>
            );
          }
          return (
            <React.Fragment key={i}>
              {renderPlainSegment(part, `p-${segIdx}-${i}`)}
            </React.Fragment>
          );
        })}
      </React.Fragment>
    );
  });
};
