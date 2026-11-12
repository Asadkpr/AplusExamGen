import React, { useEffect, useState, useRef } from 'react';
import { BubbleSheetPosition, InstituteProfile, PaperPatternSection, Question } from '../types';

interface PrintablePaperProps {
  instituteProfile?: InstituteProfile;
  classLevel: string;
  subject: string;
  totalMarks: number;
  sections: PaperPatternSection[];
  questions: Question[];
  layoutMode: 1 | 2 | 3 | 4;
  medium?: 'English' | 'Urdu' | 'Both';
  showAnswerKey?: boolean;
  baseFontSize?: number;
  lineSpacing?: number; // 0-10 scale
  timeAllowed?: string;
  paperCode?: string;
  chaptersDisplay?: string;
  headerStyle?: 'default' | 'sba' | 'layout3' | 'layout4' | 'layout5' | 'layout6' | 'layout7' | 'layout8';
  pageBreakAfterMCQ?: boolean;
  bubbleSheetPosition?: BubbleSheetPosition;
  watermarkOpacity?: number;
  papersPerSheet?: 1 | 2;
}

declare global {
  interface Window {
    MathJax: any;
  }
}

// Utility to detect if text contains Urdu characters
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
  qquad: '\u00A0\u00A0\u00A0\u00A0'
};

// Extract balanced {...} argument starting at index `start` (where str[start] === '{')
const extractBraceGroup = (str: string, start: number): { content: string; nextIndex: number } => {
  if (str[start] !== '{') {
    return { content: str[start] || '', nextIndex: start + 1 };
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
        return { content: str.slice(start + 1, i), nextIndex: i + 1 };
      }
    }
    i++;
  }
  return { content: str.slice(start + 1), nextIndex: str.length };
};

// Native HTML/React renderer for LaTeX math expressions so html2canvas and print never break or shift baselines
const renderMathNodes = (expr: string, keyPrefix: string = 'm'): React.ReactNode[] => {
  const nodes: React.ReactNode[] = [];
  let i = 0;
  let textBuf = '';
  let nodeIdx = 0;

  const flushBuf = () => {
    if (textBuf) {
      nodes.push(textBuf);
      textBuf = '';
    }
  };

  // Pre-clean common degree patterns like ^\circ or ^{\circ}
  const src = expr
    .replace(/\^\{\s*\\circ\s*\}/g, '°')
    .replace(/\^\\circ\b/g, '°')
    .replace(/\^\{\s*\\degree\s*\}/g, '°')
    .replace(/\^\\degree\b/g, '°');

  while (i < src.length) {
    // Handle \begin{...matrix} ... \end{...matrix}
    if (src.startsWith('\\begin{', i)) {
      const endEnvName = src.indexOf('}', i + 7);
      if (endEnvName !== -1) {
        const envName = src.slice(i + 7, endEnvName);
        const endTag = `\\end{${envName}}`;
        const endPos = src.indexOf(endTag, endEnvName + 1);
        if (endPos !== -1) {
          flushBuf();
          const body = src.slice(endEnvName + 1, endPos).trim();
          const rows = body.split(/\\\\/).map(r => r.trim()).filter(Boolean);
          const leftDelim = envName === 'pmatrix' ? '(' : envName === 'bmatrix' ? '[' : envName === 'vmatrix' ? '|' : envName === 'Bmatrix' ? '{' : '';
          const rightDelim = envName === 'pmatrix' ? ')' : envName === 'bmatrix' ? ']' : envName === 'vmatrix' ? '|' : envName === 'Bmatrix' ? '}' : '';
          nodes.push(
            <span key={`${keyPrefix}-mat-${nodeIdx++}`} className="inline-flex items-center align-middle mx-0.5" dir="ltr">
              {leftDelim && <span className="font-normal px-0.5 text-[1.15em] leading-none">{leftDelim}</span>}
              <span className="inline-table border-collapse align-middle">
                {rows.map((row, rIdx) => (
                  <span key={rIdx} className="table-row">
                    {row.split('&').map((cell, cIdx) => (
                      <span key={cIdx} className="table-cell px-1 py-0 text-center leading-tight">
                        {renderMathNodes(cell.trim(), `${keyPrefix}-m-${rIdx}-${cIdx}`)}
                      </span>
                    ))}
                  </span>
                ))}
              </span>
              {rightDelim && <span className="font-normal px-0.5 text-[1.15em] leading-none">{rightDelim}</span>}
            </span>
          );
          i = endPos + endTag.length;
          continue;
        }
      }
    }

    const ch = src[i];

    if (ch === '\\') {
      // Escaped single symbol like \%, \&, \{, \}, \_, \, , \; , \!
      const nextCh = src[i + 1];
      if (!nextCh) {
        i++;
        continue;
      }
      if (['%', '&', '#', '_', '{', '}'].includes(nextCh)) {
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

      // Read command name
      const cmdMatch = src.slice(i + 1).match(/^[a-zA-Z]+/);
      if (!cmdMatch) {
        textBuf += nextCh;
        i += 2;
        continue;
      }
      const cmd = cmdMatch[0];
      i += 1 + cmd.length;
      // Skip optional spaces after command before arguments
      while (i < src.length && src[i] === ' ') i++;

      if (cmd === 'left' || cmd === 'right' || cmd === 'displaystyle' || cmd === 'textstyle') {
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
            <span className="border-b border-black px-0.5 pb-[1px] text-[0.86em] leading-none">
              {renderMathNodes(numGroup.content, `${keyPrefix}-fn-${nodeIdx}`)}
            </span>
            <span className="px-0.5 pt-[1px] text-[0.86em] leading-none">
              {renderMathNodes(denGroup.content, `${keyPrefix}-fd-${nodeIdx}`)}
            </span>
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
            {rootContent && <sup className="text-[0.65em] mr-[1px]">{renderMathNodes(rootContent, `${keyPrefix}-sr-${nodeIdx}`)}</sup>}
            <span className="text-[1.02em] leading-none">√</span>
            <span className="border-t border-black px-[2px] pt-[1px] leading-none">
              {renderMathNodes(argGroup.content, `${keyPrefix}-sa-${nodeIdx}`)}
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
            {grp.content}
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
            {renderMathNodes(grp.content, `${keyPrefix}-bfc-${nodeIdx}`)}
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
            {renderMathNodes(grp.content, `${keyPrefix}-itc-${nodeIdx}`)}
          </em>
        );
        continue;
      }

      if (cmd === 'overline' || cmd === 'bar') {
        flushBuf();
        const grp = extractBraceGroup(src, i);
        i = grp.nextIndex;
        nodes.push(
          <span key={`${keyPrefix}-bar-${nodeIdx++}`} className="border-t border-black inline-block leading-none pt-[1px]">
            {renderMathNodes(grp.content, `${keyPrefix}-barc-${nodeIdx}`)}
          </span>
        );
        continue;
      }

      if (cmd === 'underline') {
        flushBuf();
        const grp = extractBraceGroup(src, i);
        i = grp.nextIndex;
        nodes.push(
          <span key={`${keyPrefix}-ul-${nodeIdx++}`} className="border-b border-black inline-block leading-none pb-[1px]">
            {renderMathNodes(grp.content, `${keyPrefix}-ulc-${nodeIdx}`)}
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
            {renderMathNodes(grp.content, `${keyPrefix}-vecc-${nodeIdx}`)}&#8407;
          </span>
        );
        continue;
      }

      if (cmd === 'hat') {
        flushBuf();
        const grp = extractBraceGroup(src, i);
        i = grp.nextIndex;
        nodes.push(
          <span key={`${keyPrefix}-hat-${nodeIdx++}`} className="inline-block">
            {renderMathNodes(grp.content, `${keyPrefix}-hatc-${nodeIdx}`)}&#770;
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
            {renderMathNodes(grpContent, `${keyPrefix}-supc-${nodeIdx}`)}
          </sup>
        );
      } else {
        nodes.push(
          <sub key={`${keyPrefix}-sub-${nodeIdx++}`} className="text-[0.74em] leading-none">
            {renderMathNodes(grpContent, `${keyPrefix}-subc-${nodeIdx}`)}
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

// Utility to render text with support for LaTeX ($...$, $$...$$, \(...\), \[...\]), *bold*, **bold**, <b>bold</b> and :underline:
const renderFormattedText = (text: string) => {
  if (!text) return null;

  const hasUrdu = isUrduText(text);

  // Split out LaTeX math segments first so asterisks/colons inside math aren't treated as markdown
  const mathRegex = /(\$\$[\s\S]+?\$\$|\$[^$]+\$|\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\])/g;
  const segments = text.split(mathRegex);

  return segments.map((segment, segIdx) => {
    if (!segment) return null;

    const isDisplayDollar = segment.startsWith('$$') && segment.endsWith('$$') && segment.length > 4;
    const isInlineDollar = !isDisplayDollar && segment.startsWith('$') && segment.endsWith('$') && segment.length > 2;
    const isInlineParen = segment.startsWith('\\(') && segment.endsWith('\\)');
    const isDisplayBracket = segment.startsWith('\\[') && segment.endsWith('\\]');

    if (isDisplayDollar || isInlineDollar || isInlineParen || isDisplayBracket) {
      const innerMath = (isDisplayDollar || isInlineParen || isDisplayBracket)
        ? segment.slice(2, -2).trim()
        : segment.slice(1, -1).trim();

      return (
        <span
          key={`math-${segIdx}`}
          dir="ltr"
          style={{ fontFamily: "'Times New Roman', serif", unicodeBidi: 'isolate', lineHeight: 1.15 }}
          className="inline-block align-baseline mx-[1.5px] whitespace-nowrap"
        >
          {renderMathNodes(innerMath, `m-${segIdx}`)}
        </span>
      );
    }

    // Standardize bold (*, **, <b>) and underline (:text:)
    const normalized = segment
      .replace(/<\/?b>/gi, '@@')
      .replace(/\*\*([^*]+)\*\*/g, '@@$1@@')
      .replace(/\*([^*]+)\*/g, '@@$1@@')
      .replace(/:([^:]+):/g, '##$1##')
      .replace(/@@/g, '**')
      .replace(/##/g, '++');

    const parts = normalized.split(/(\*\*.*?\*\*|\+\+.*?\+\+)/g);

    const renderPlainSegment = (plain: string, keyBase: string) => {
      if (!hasUrdu) return plain;
      // Inside Urdu text, isolate embedded LTR phrases (numbers with English units/symbols like "1 Pa", "20 cm", "92.5°F")
      const ltrChunks = plain.split(/([A-Za-z0-9][A-Za-z0-9\s.,°/%+\-=×÷()^]*[A-Za-z0-9°%)]|[A-Za-z]+|\d+(?:\.\d+)?)/g);
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
            return <strong key={i} className="font-bold">{renderPlainSegment(part.slice(2, -2), `b-${segIdx}-${i}`)}</strong>;
          }
          if (part.startsWith('++') && part.endsWith('++')) {
            return <span key={i} className="border-b border-black inline-block leading-tight pb-[0.5px]">{renderPlainSegment(part.slice(2, -2), `u-${segIdx}-${i}`)}</span>;
          }
          return <React.Fragment key={i}>{renderPlainSegment(part, `p-${segIdx}-${i}`)}</React.Fragment>;
        })}
      </React.Fragment>
    );
  });
};

// Helper to convert numbers to lowercase Roman numerals (e.g., i, ii, iii)
const toRoman = (num: number): string => {
  const romanMap: [string, number][] = [
    ['x', 10], ['ix', 9], ['v', 5], ['iv', 4], ['i', 1]
  ];
  let result = '';
  let n = num;
  for (const [str, val] of romanMap) {
    while (n >= val) {
      result += str;
      n -= val;
    }
  }
  return result;
};

// Translate common section headings to Urdu
const translateHeadingToUrdu = (heading: string) => {
  if (!heading) return '';
  const h = heading.toUpperCase().replace(/–/g, '-').trim();
  if (h.includes('SECTION - IV') || h.includes('SECTION IV')) return 'حصہ چہارم';
  if (h.includes('SECTION - III') || h.includes('SECTION III')) return 'حصہ سوم';
  if (h.includes('SECTION - II') || h.includes('SECTION II')) return 'حصہ دوم';
  if (h.includes('SECTION - I') || h.includes('SECTION I')) return 'حصہ اول';
  if (h.includes('SECTION A') || h.includes('SECTION - A') || h === 'PART I' || h === 'PART A') return 'حصہ الف';
  if (h.includes('SECTION B') || h.includes('SECTION - B') || h === 'PART II' || h === 'PART B') return 'حصہ ب';
  if (h.includes('SECTION C') || h.includes('SECTION - C') || h === 'PART III' || h === 'PART C') return 'حصہ ج';
  if (h.includes('SECTION D') || h.includes('SECTION - D') || h === 'PART IV' || h === 'PART D') return 'حصہ د';
  if (h.includes('OBJECTIVE')) return 'معروضی حصہ';
  if (h.includes('SUBJECTIVE')) return 'انشائیہ حصہ';
  return '';
};

const formatPageEndLabel = (pageNum: number): string => {
  if (pageNum === 1) return 'First Page End';
  if (pageNum === 2) return '2nd Page End';
  if (pageNum === 3) return '3rd Page End';
  return `${pageNum}th Page End`;
};

const PageBoundaryBanner: React.FC<{ endedPage: number; nextPage: number; isManual?: boolean }> = ({ endedPage }) => (
  <div className="page-boundary-marker my-2 select-none print:hidden col-span-full w-full flex items-center gap-2" dir="ltr">
    <div className="flex-grow border-t-2 border-dashed border-red-500/70" />
    <span className="px-3 py-0.5 bg-red-50 border border-red-400 text-red-700 rounded text-[10px] font-black uppercase tracking-wider whitespace-nowrap">
      {formatPageEndLabel(endedPage)}
    </span>
    <div className="flex-grow border-t-2 border-dashed border-red-500/70" />
  </div>
);

export const PrintablePaper: React.FC<PrintablePaperProps> = ({
  instituteProfile,
  classLevel,
  subject = '',
  totalMarks,
  sections = [],
  questions = [],
  layoutMode,
  medium = 'English',
  showAnswerKey = false,
  baseFontSize = 13,
  lineSpacing = 0,
  timeAllowed = '2:00 Hours',
  paperCode,
  chaptersDisplay,
  headerStyle = 'default',
  pageBreakAfterMCQ = false,
  bubbleSheetPosition = 'above_mcq',
  watermarkOpacity,
  papersPerSheet = 1
}) => {
  const isTwoPerSheet = papersPerSheet === 2 || layoutMode === 2;

  const containerRef = useRef<HTMLDivElement>(null);
  const [pageBreakMap, setPageBreakMap] = useState<Record<string, { endedPage: number; nextPage: number; isManual?: boolean }>>({});
  const [pageSummary, setPageSummary] = useState<{ totalPages: number; lastPageUsedPercent: number }>({ totalPages: 1, lastPageUsedPercent: 45 });
  const [anchorLayouts, setAnchorLayouts] = useState<Record<string, { centerOffset: number; wmSize: number }>>({});
  const [bwLogoUrl, setBwLogoUrl] = useState<string>('');
  const [watermarkLogoUrl, setWatermarkLogoUrl] = useState<string>('');

  const normalizeWatermarkLevel = (val?: number): number => {
    if (val === undefined || val === null || Number.isNaN(Number(val))) return 3;
    const n = Number(val);
    if (n > 10) {
      return Math.max(0, Math.min(10, Math.round((n - 6) / 2)));
    }
    return Math.max(0, Math.min(10, Math.round(n)));
  };

  const watermarkLevel =
    watermarkOpacity !== undefined
      ? normalizeWatermarkLevel(watermarkOpacity)
      : normalizeWatermarkLevel(instituteProfile?.watermarkOpacity);

  // Level 0 on the control starts at 6% visibility (0.06 opacity) and scales up to Level 10
  const effectiveWatermarkPercent =
    instituteProfile?.showWatermarkOnPapers === false && watermarkOpacity === undefined
      ? 0
      : 6 + watermarkLevel * 2;

  useEffect(() => {
    const rawLogo = instituteProfile?.logoUrl;
    if (!rawLogo) {
      setBwLogoUrl('');
      setWatermarkLogoUrl('');
      return;
    }

    let cancelled = false;
    const img = new Image();
    if (!rawLogo.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      if (cancelled) return;
      try {
        const w = img.naturalWidth || img.width || 240;
        const h = img.naturalHeight || img.height || 240;

        // 1. Header B&W Logo (preserves original background/alpha)
        const c1 = document.createElement('canvas');
        c1.width = w;
        c1.height = h;
        const ctx1 = c1.getContext('2d');
        if (ctx1) {
          ctx1.drawImage(img, 0, 0, w, h);
          const imgData1 = ctx1.getImageData(0, 0, w, h);
          const d1 = imgData1.data;
          for (let i = 0; i < d1.length; i += 4) {
            const gray = Math.round(0.299 * d1[i] + 0.587 * d1[i + 1] + 0.114 * d1[i + 2]);
            d1[i] = gray;
            d1[i + 1] = gray;
            d1[i + 2] = gray;
          }
          ctx1.putImageData(imgData1, 0, 0);
          setBwLogoUrl(c1.toDataURL('image/png'));
        } else {
          setBwLogoUrl(rawLogo);
        }

        // 2. Watermark B&W Logo (also strips pure white backgrounds so JPG logos blend cleanly)
        const c2 = document.createElement('canvas');
        c2.width = w;
        c2.height = h;
        const ctx2 = c2.getContext('2d');
        if (ctx2) {
          ctx2.drawImage(img, 0, 0, w, h);
          const imgData2 = ctx2.getImageData(0, 0, w, h);
          const d2 = imgData2.data;
          for (let i = 0; i < d2.length; i += 4) {
            const gray = Math.round(0.299 * d2[i] + 0.587 * d2[i + 1] + 0.114 * d2[i + 2]);
            d2[i] = gray;
            d2[i + 1] = gray;
            d2[i + 2] = gray;
            if (gray >= 248) {
              d2[i + 3] = 0;
            }
          }
          ctx2.putImageData(imgData2, 0, 0);
          setWatermarkLogoUrl(c2.toDataURL('image/png'));
        } else {
          setWatermarkLogoUrl(rawLogo);
        }
      } catch {
        setBwLogoUrl(rawLogo);
        setWatermarkLogoUrl(rawLogo);
      }
    };
    img.onerror = () => {
      if (!cancelled) {
        setBwLogoUrl(rawLogo);
        setWatermarkLogoUrl(rawLogo);
      }
    };
    img.src = rawLogo;
    return () => {
      cancelled = true;
    };
  }, [instituteProfile?.logoUrl]);

  const displayLogoUrl = bwLogoUrl || instituteProfile?.logoUrl || '';
  const displayWatermarkUrl = watermarkLogoUrl || displayLogoUrl;

  const measureWatermarkAnchors = React.useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    if (containerRect.width === 0) return;

    const scaleRatio = containerRect.width / (container.offsetWidth || 794);
    const anchorEls = Array.from(container.querySelectorAll('[data-page-anchor]')) as HTMLElement[];
    const boundaryEls = Array.from(container.querySelectorAll('.page-boundary-marker, [data-cut-line="true"]')) as HTMLElement[];
    const boundaryTops = boundaryEls
      .map(b => (b.getBoundingClientRect().top - containerRect.top) / scaleRatio)
      .sort((a, b) => a - b);

    const nextLayouts: Record<string, { centerOffset: number; wmSize: number }> = {};
    for (const anchorEl of anchorEls) {
      const anchorId = anchorEl.getAttribute('data-page-anchor') || '';
      if (!anchorId) continue;
      const anchorTop = (anchorEl.getBoundingClientRect().top - containerRect.top) / scaleRatio;
      const nextBoundaryTop = boundaryTops.find(bt => bt > anchorTop + 40) ?? (containerRect.height / scaleRatio);
      const regionHeight = Math.max(200, nextBoundaryTop - anchorTop);
      const centerOffset = Math.round(regionHeight / 2);
      const wmSize = Math.min(260, Math.max(120, Math.round(regionHeight * 0.42)));
      nextLayouts[anchorId] = { centerOffset, wmSize };
    }

    setAnchorLayouts(prev => {
      const pKeys = Object.keys(prev);
      const nKeys = Object.keys(nextLayouts);
      if (
        pKeys.length === nKeys.length &&
        nKeys.every(
          k =>
            prev[k] &&
            Math.abs(prev[k].centerOffset - nextLayouts[k].centerOffset) <= 3 &&
            Math.abs(prev[k].wmSize - nextLayouts[k].wmSize) <= 3
        )
      ) {
        return prev;
      }
      return nextLayouts;
    });
  }, []);

  useEffect(() => {
    const calculatePagination = () => {
      const container = containerRef.current;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      if (containerRect.width === 0) return;

      // Scale-invariant safe A4 printable height (252mm content height for 202mm width so browser print never spills before .page-break-before)
      const scaleRatio = containerRect.width / (container.offsetWidth || 794);
      const a4PageHeightPx = (containerRect.width / 202) * 252;
      const minTopOffsetPx = 40 * scaleRatio;

      // Subtract both screen-only page boundary banners AND repeated page headers so virtual coordinates are 100% pure content
      const injectedEls = Array.from(container.querySelectorAll('.page-boundary-marker, .repeated-page-header')) as HTMLElement[];
      const injectedRects = injectedEls.map(m => {
        const r = m.getBoundingClientRect();
        const style = window.getComputedStyle(m);
        const mt = (parseFloat(style.marginTop || '0') || 0) * scaleRatio;
        const mb = (parseFloat(style.marginBottom || '0') || 0) * scaleRatio;
        return {
          top: r.top - containerRect.top,
          totalHeight: r.height + mt + mb
        };
      });

      const getVirtualY = (screenY: number) => {
        let virtualY = screenY;
        for (const m of injectedRects) {
          if (m.top < screenY - 1) {
            virtualY -= m.totalHeight;
          }
        }
        return Math.max(0, virtualY);
      };

      const mainHeaderEl = container.querySelector('[data-main-paper-header="true"]') as HTMLElement | null;
      const mainHeaderHeightPx = mainHeaderEl
        ? mainHeaderEl.getBoundingClientRect().height
        : 95 * scaleRatio;

      const copy1El = container.querySelector('[data-copy-wrapper="0"]') as HTMLElement | null;
      const copy1PureHeight = copy1El
        ? Math.max(
            0,
            getVirtualY(copy1El.getBoundingClientRect().bottom - containerRect.top) -
              getVirtualY(copy1El.getBoundingClientRect().top - containerRect.top)
          )
        : 0;

      const items = Array.from(container.querySelectorAll('[data-block-id]')) as HTMLElement[];
      const newBreakMap: Record<string, { endedPage: number; nextPage: number; isManual?: boolean }> = {};

      let currentPage = 1;
      let currentPageStartY = 0;
      let maxVirtualBottom = 0;

      for (const item of items) {
        const blockId = item.getAttribute('data-block-id');
        if (!blockId) continue;

        const isManualBreak = item.getAttribute('data-manual-break') === 'true';
        const rect = item.getBoundingClientRect();
        const vTop = getVirtualY(rect.top - containerRect.top);
        const vBottom = getVirtualY(rect.bottom - containerRect.top);
        if (vBottom > maxVirtualBottom) maxVirtualBottom = vBottom;

        if (blockId === 'copy2-root-start') {
          const fitsBothOnOnePage =
            currentPage === 1 &&
            !pageBreakAfterMCQ &&
            copy1PureHeight > 0 &&
            copy1PureHeight * 2 + 36 * scaleRatio <= a4PageHeightPx;

          if (!fitsBothOnOnePage) {
            newBreakMap[blockId] = {
              endedPage: currentPage,
              nextPage: currentPage + 1,
              isManual: true
            };
            currentPage += 1;
            currentPageStartY = vTop;
          }
          continue;
        }

        const secKey = item.getAttribute('data-section-header-for');
        if (secKey) {
          const firstQEl = container.querySelector(`[data-first-q-of="${secKey}"]`) as HTMLElement | null;
          const checkBottom = firstQEl
            ? Math.max(vBottom, getVirtualY(firstQEl.getBoundingClientRect().bottom - containerRect.top))
            : vBottom;

          if (isManualBreak) {
            newBreakMap[blockId] = {
              endedPage: currentPage,
              nextPage: currentPage + 1,
              isManual: true
            };
            currentPage += 1;
            currentPageStartY = vTop - mainHeaderHeightPx;
            continue;
          }

          if (checkBottom - currentPageStartY > a4PageHeightPx && vTop - currentPageStartY > minTopOffsetPx) {
            newBreakMap[blockId] = {
              endedPage: currentPage,
              nextPage: currentPage + 1,
              isManual: false
            };
            currentPage += 1;
            currentPageStartY = vTop - mainHeaderHeightPx;
          }
          continue;
        }

        // First question of a section is already checked together with its section header above
        if (item.hasAttribute('data-first-q-of')) {
          continue;
        }

        if (isManualBreak) {
          newBreakMap[blockId] = {
            endedPage: currentPage,
            nextPage: currentPage + 1,
            isManual: true
          };
          currentPage += 1;
          currentPageStartY = vTop - mainHeaderHeightPx;
          continue;
        }

        if (vBottom - currentPageStartY > a4PageHeightPx && vTop - currentPageStartY > minTopOffsetPx) {
          newBreakMap[blockId] = {
            endedPage: currentPage,
            nextPage: currentPage + 1,
            isManual: false
          };
          currentPage += 1;
          currentPageStartY = vTop - mainHeaderHeightPx;
        }
      }

      const lastPageHeight = Math.max(0, maxVirtualBottom - currentPageStartY);
      const usedPercent = Math.min(100, Math.max(5, Math.round((lastPageHeight / a4PageHeightPx) * 100)));

      setPageBreakMap(prev => {
        const prevKeys = Object.keys(prev);
        const nextKeys = Object.keys(newBreakMap);
        if (
          prevKeys.length === nextKeys.length &&
          prevKeys.every(k => prev[k]?.endedPage === newBreakMap[k]?.endedPage && prev[k]?.isManual === newBreakMap[k]?.isManual)
        ) {
          return prev;
        }
        return newBreakMap;
      });

      setPageSummary(prev => {
        if (prev.totalPages === currentPage && Math.abs(prev.lastPageUsedPercent - usedPercent) <= 1) {
          return prev;
        }
        return { totalPages: currentPage, lastPageUsedPercent: usedPercent };
      });

      measureWatermarkAnchors();
    };

    const t1 = setTimeout(calculatePagination, 40);
    const t2 = setTimeout(calculatePagination, 180);
    window.addEventListener('resize', calculatePagination);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('resize', calculatePagination);
    };
  }, [questions, sections, baseFontSize, lineSpacing, medium, showAnswerKey, headerStyle, pageBreakAfterMCQ, bubbleSheetPosition, classLevel, subject, timeAllowed, paperCode, isTwoPerSheet, measureWatermarkAnchors]);

  useEffect(() => {
    const t = setTimeout(measureWatermarkAnchors, 25);
    return () => clearTimeout(t);
  }, [pageBreakMap, pageSummary.totalPages, isTwoPerSheet, measureWatermarkAnchors]);

  const getLayoutStyles = (mode: number, baseSize: number) => {
    // Flexible baseSize scaling between 8px and 20px
    const safeBaseSize = Math.max(8, Math.min(baseSize || 13, 20));
    const scale = safeBaseSize / 12;

    switch (mode) {
      case 2:
        return {
          headerTitle: '14px',
          headerInfo: '10px',
          sectionTitle: `9px`,
          questionText: `${Math.round(10 * scale)}px`,
          optionText: `${Math.round(9 * scale)}px`,
          spacing: 'space-y-0',
          logoSize: 'w-8 h-8',
          mcqGap: 'gap-y-0',
          optionGrid: 'grid-cols-2 gap-x-6 gap-y-1'
        };
      default:
        return {
          headerTitle: '18px',
          headerInfo: '11px',
          sectionTitle: `9px`,
          questionText: `${safeBaseSize}px`,
          optionText: `${Math.round(12 * scale)}px`,
          spacing: 'space-y-0',
          logoSize: 'w-14 h-14',
          mcqGap: 'gap-y-0',
          optionGrid: 'grid-cols-2 gap-x-8 gap-y-1.5'
        };
    }
  };

  const urduFontStack = "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif";
  const englishFontStack = "'Times New Roman', serif";

  const styles = getLayoutStyles(isTwoPerSheet ? 2 : layoutMode, baseFontSize);
  const fontFamily = englishFontStack;
  
  // Dynamic Spacing Calculation (-10 to 10 scale, 0 is compact default — NEVER negative margins so questions/lines never overlap)
  const questionPaddingBottom = '0px';
  const questionMarginBottom = lineSpacing > 0
    ? `${(lineSpacing * 1.5).toFixed(1)}px`
    : '0px';

  const subPartMarginBottom = lineSpacing > 0
    ? `${(lineSpacing * 1.0).toFixed(1)}px`
    : '0px';

  const mcqPaddingBottom = '1px';
  const mcqMarginBottom = lineSpacing > 0
    ? `${(lineSpacing * 1.2).toFixed(1)}px`
    : '1px';

  const mcqGapValue = lineSpacing > 0 ? `${(lineSpacing * 0.5).toFixed(1)}px` : '1px';
  const sectionMarginBottom = lineSpacing > 0 ? `${(1.5 + lineSpacing * 1.2).toFixed(1)}px` : '1px';

  const dynamicLineHeight = (lineSpacing >= 0)
    ? (1.18 + lineSpacing * 0.035).toFixed(2)
    : Math.max(1.08, 1.18 + lineSpacing * 0.01).toFixed(2);

  const dynamicUrduLineHeight = (lineSpacing >= 0)
    ? (1.38 + lineSpacing * 0.045).toFixed(2)
    : Math.max(1.24, 1.38 + lineSpacing * 0.012).toFixed(2);

  // CRITICAL: baseDir follows MEDIUM, not SUBJECT. 
  const baseDir = (medium === 'Urdu') ? 'rtl' : 'ltr';

  const cleanText = (val?: string) => (val || '').replace(/\r\n/g, '\n').replace(/\n{2,}/g, '\n').trim();

  const renderQuestionText = (q: Question, counter?: any, textOverride?: string, urduOverride?: string, hideCounter: boolean = false, centerAlign: boolean = false) => {
    const mainText = cleanText(textOverride || q.text || q.textUrdu || '');
    const urduText = cleanText(urduOverride || q.textUrdu || q.text || '');
    
    const isDualCounter = counter && typeof counter === 'object' && 'eng' in counter && 'urdu' in counter;
    const cEng = isDualCounter ? counter.eng : counter;
    const cUrdu = isDualCounter ? counter.urdu : counter;
    
    const suffixEng = (typeof cEng === 'number') ? '.' : '';
    const suffixUrdu = (typeof cUrdu === 'number') ? '.' : '';
    
    const isParaphrase = q.type === 'Paraphrase' || (q as any).isParaphrase;
    
    let containerClass = "flex gap-1.5 w-full";
    let counterClass = "font-bold whitespace-nowrap text-black shrink-0";

    if (isParaphrase) {
      containerClass += " flex-col items-center text-center";
      counterClass += " mb-0.5";
    } else if (centerAlign) {
      containerClass += " flex-row justify-center items-baseline text-center";
      counterClass += " self-baseline";
    } else {
      containerClass += " items-baseline";
      counterClass += " self-baseline";
    }

    // Forced Urdu detection for single medium papers
    if (medium === 'Urdu' || (medium === 'English' && isUrduText(mainText))) {
      const displayContent = medium === 'Urdu' ? urduText : mainText;
      const counterHasUrdu = typeof cUrdu === 'string' && isUrduText(cUrdu);
      return (
        <div className={containerClass} style={{ lineHeight: dynamicUrduLineHeight }} dir="rtl">
          {!hideCounter && (
            <span
              className={counterClass}
              dir="ltr"
              style={{
                fontFamily: counterHasUrdu ? urduFontStack : englishFontStack,
                lineHeight: dynamicUrduLineHeight,
                unicodeBidi: 'isolate'
              }}
            >
              {cUrdu}{suffixUrdu}
            </span>
          )}
          <span style={{ fontFamily: urduFontStack, lineHeight: dynamicUrduLineHeight }} className="text-black whitespace-pre-wrap block flex-1 min-w-0">{renderFormattedText(displayContent)}</span>
        </div>
      );
    }
    
    if (medium === 'Both') {
      return (
        <div className="grid grid-cols-2 gap-3 w-full items-start" dir="ltr">
          <div className={containerClass} style={{ fontFamily: englishFontStack, lineHeight: dynamicLineHeight }}>
            {!hideCounter && <span className={counterClass} style={{ lineHeight: dynamicLineHeight }}>{cEng}{suffixEng}</span>}
            <span className="text-black whitespace-pre-wrap block flex-1 min-w-0" style={{ lineHeight: dynamicLineHeight }}>{renderFormattedText(mainText)}</span>
          </div>
          {urduText && (
            <div 
              className={containerClass.replace('flex-row justify-center', 'justify-start')} 
              style={{ fontFamily: urduFontStack, lineHeight: dynamicUrduLineHeight }} 
              dir="rtl"
            >
              {!hideCounter && <span className={counterClass} dir="ltr" style={{ fontFamily: englishFontStack, lineHeight: dynamicUrduLineHeight, unicodeBidi: 'isolate' }}>{cUrdu}{suffixUrdu}</span>}
              <span className="text-black whitespace-pre-wrap block flex-1 min-w-0" style={{ fontFamily: urduFontStack, lineHeight: dynamicUrduLineHeight }}>{renderFormattedText(urduText)}</span>
            </div>
          )}
        </div>
      );
    }

    // Default LTR
    return (
      <div className={containerClass} style={{ lineHeight: dynamicLineHeight }} dir="ltr">
        {!hideCounter && <span className={counterClass} style={{ lineHeight: dynamicLineHeight }}>{cEng}{suffixEng}</span>}
        <span 
          style={{ fontFamily: englishFontStack, lineHeight: dynamicLineHeight }} 
          className={`text-black flex-1 min-w-0 ${isParaphrase ? 'italic whitespace-pre-line max-w-[80%] border-l border-r border-black/10 px-8 py-1' : 'whitespace-pre-wrap block'}`}
        >
          {renderFormattedText(mainText)}
        </span>
      </div>
    );
  };

  const renderOptionContent = (q: Question, oIdx: number) => {
    const optEng = cleanText((q.options && q.options[oIdx]) ? q.options[oIdx] : (q.optionsUrdu ? q.optionsUrdu[oIdx] : ''));
    const optUrdu = cleanText((q.optionsUrdu && q.optionsUrdu[oIdx]) ? q.optionsUrdu[oIdx] : (q.options ? q.options[oIdx] : ''));

    if (medium === 'Urdu' || (medium === 'English' && isUrduText(optEng))) {
      const display = medium === 'Urdu' ? (optUrdu || optEng) : optEng;
      const hasUrdu = isUrduText(display);
      return (
        <span
          style={{
            fontFamily: hasUrdu ? urduFontStack : englishFontStack,
            lineHeight: hasUrdu ? dynamicUrduLineHeight : dynamicLineHeight,
            unicodeBidi: 'isolate'
          }}
          dir={hasUrdu ? 'rtl' : 'ltr'}
          className={`text-black inline-block ${hasUrdu ? 'text-right' : 'text-left'} whitespace-pre-wrap`}
        >
          {renderFormattedText(display)}
        </span>
      );
    }

    if (medium === 'Both') {
      const hasUrduOpt = isUrduText(optUrdu);
      return (
        <div className="inline-flex items-baseline gap-6" dir="ltr">
          <span className="text-left text-black whitespace-pre-wrap inline-block" style={{ fontFamily: englishFontStack, lineHeight: dynamicLineHeight }}>{renderFormattedText(optEng)}</span>
          {optUrdu && (
            <span
              className="text-right text-[0.9em] text-black whitespace-pre-wrap inline-block"
              style={{
                fontFamily: hasUrduOpt ? urduFontStack : englishFontStack,
                lineHeight: hasUrduOpt ? dynamicUrduLineHeight : dynamicLineHeight,
                unicodeBidi: 'isolate'
              }}
              dir={hasUrduOpt ? 'rtl' : 'ltr'}
            >
              {renderFormattedText(optUrdu)}
            </span>
          )}
        </div>
      );
    }

    return <span className="text-black whitespace-pre-wrap inline-block" style={{ fontFamily: englishFontStack, lineHeight: dynamicLineHeight }}>{renderFormattedText(optEng)}</span>;
  };

  // Helper to generate marks calculation string
  const getMarksCalc = (section: PaperPatternSection, isUrduLayout: boolean) => {
    if (section.hideSectionMarks) return '';
    const total = section.attemptCount * section.marksPerQuestion;
    if (isUrduLayout) {
      return `(${total} = ${section.marksPerQuestion} × ${section.attemptCount})`;
    }
    return `(${section.attemptCount} x ${section.marksPerQuestion} = ${total})`;
  };

  const hasQuestions = questions && questions.length > 0;

  // Collect ordered MCQ questions and locate first/last MCQ sections
  let firstMCQSectionId: string | null = null;
  let lastMCQSectionId: string | null = null;
  const orderedMCQQuestions: Question[] = [];
  sections.forEach(sec => {
    if ((sec.type || '').toUpperCase() !== 'MCQ') return;
    const secQs = questions.filter(
      q =>
        q.targetSectionId === sec.id ||
        (!q.targetSectionId && (q.type === sec.type || q.type?.toUpperCase() === sec.type?.toUpperCase()))
    );
    if (secQs.length === 0) return;
    if (!firstMCQSectionId) firstMCQSectionId = sec.id;
    lastMCQSectionId = sec.id;

    if (sec.subParts && sec.subParts.length > 0) {
      sec.subParts.forEach((part, pIdx) => {
        const start = sec.subParts!.slice(0, pIdx).reduce((sAcc, p) => sAcc + (p.questionCount || 0), 0);
        const partQs = secQs.slice(start, start + (part.questionCount || 0));
        orderedMCQQuestions.push(...partQs);
      });
    } else {
      orderedMCQQuestions.push(...secQs);
    }
  });
  const totalMCQCount = orderedMCQQuestions.length;

  // Determine if there is any MCQ section with questions
  const hasMCQWithQuestions = totalMCQCount > 0;

  const getCorrectBubbleLetter = (q: Question): 'A' | 'B' | 'C' | 'D' | null => {
    const raw = (q.correctAnswer || (q as any).answer || '').toString().trim();
    if (!raw) return null;
    const upper = raw.toUpperCase();
    if (['A', 'B', 'C', 'D'].includes(upper)) return upper as 'A' | 'B' | 'C' | 'D';
    const parenMatch = upper.match(/^[\(\[\s]*([ABCD])[\)\]\.\:\-\s]*$/);
    if (parenMatch) return parenMatch[1] as 'A' | 'B' | 'C' | 'D';
    const optMatch = upper.match(/^(?:OPTION|OPT|ANS|ANSWER)\s*[\(\[\:\-\s]*([ABCD])[\)\]\.\s]*$/);
    if (optMatch) return optMatch[1] as 'A' | 'B' | 'C' | 'D';
    if (['1', '2', '3', '4'].includes(raw)) {
      return (['A', 'B', 'C', 'D'][parseInt(raw, 10) - 1]) as 'A' | 'B' | 'C' | 'D';
    }
    const urduMap: Record<string, 'A' | 'B' | 'C' | 'D'> = {
      'الف': 'A',
      'ا': 'A',
      'ب': 'B',
      'ج': 'C',
      'د': 'D'
    };
    const cleanUrdu = raw.replace(/[\(\)\[\]\.\-\s]/g, '');
    if (urduMap[cleanUrdu]) return urduMap[cleanUrdu];
    const norm = raw.toLowerCase();
    if (q.options && q.options.length > 0) {
      const idx = q.options.findIndex(o => (o || '').trim().toLowerCase() === norm);
      if (idx >= 0 && idx < 4) return (['A', 'B', 'C', 'D'][idx]) as 'A' | 'B' | 'C' | 'D';
    }
    if (q.optionsUrdu && q.optionsUrdu.length > 0) {
      const idx = q.optionsUrdu.findIndex(o => (o || '').trim().toLowerCase() === norm);
      if (idx >= 0 && idx < 4) return (['A', 'B', 'C', 'D'][idx]) as 'A' | 'B' | 'C' | 'D';
    }
    return null;
  };

  // Find the first non-MCQ section that has questions and occurs after an MCQ section
  let firstSubjectiveSectionId: string | null = null;
  if (hasMCQWithQuestions) {
    let foundMCQ = false;
    for (const s of sections) {
      const hasQ = questions.some(q => q.targetSectionId === s.id || (!q.targetSectionId && (q.type === s.type || q.type?.toUpperCase() === s.type?.toUpperCase())));
      if (!hasQ) continue;
      if ((s.type || '').toUpperCase() === 'MCQ') {
        foundMCQ = true;
      } else if (foundMCQ && (s.type || '').toUpperCase() !== 'MCQ') {
        firstSubjectiveSectionId = s.id;
        break;
      }
    }
  }

  const renderPageWatermark = (anchorId: string) => {
    if (!displayWatermarkUrl || effectiveWatermarkPercent <= 0) return null;
    const layout = anchorLayouts[anchorId];
    const wmSize = layout?.wmSize ?? (isTwoPerSheet ? 160 : 230);
    const centerOffset = layout?.centerOffset ?? (isTwoPerSheet ? 220 : 440);
    const isSamePageHalfSheet = isTwoPerSheet && !pageBreakMap['copy2-root-start'];

    return (
      <div
        data-page-anchor={anchorId}
        className="relative w-full h-0 overflow-visible pointer-events-none select-none z-0"
        dir="ltr"
        aria-hidden="true"
      >
        <div
          style={{
            position: 'absolute',
            top: `${centerOffset}px`,
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: `${wmSize}px`,
            height: `${wmSize}px`,
            opacity: effectiveWatermarkPercent / 100,
            pointerEvents: 'none'
          }}
          className={`flex items-center justify-center ${isSamePageHalfSheet ? 'watermark-half-page' : 'watermark-full-page'}`}
        >
          <img
            src={displayWatermarkUrl}
            alt=""
            className="w-full h-full object-contain grayscale"
            style={{ filter: 'grayscale(100%)' }}
          />
        </div>
      </div>
    );
  };

  const renderPaperHeader = () => {
    const showLogo = Boolean(displayLogoUrl && instituteProfile?.showLogoOnPapers);
    if (headerStyle === 'sba') {
      return (
        <div className="border border-black p-1.5 mb-2 relative z-10" style={{ borderColor: '#000000', fontFamily: englishFontStack, lineHeight: '1.35' }} dir="ltr">
          <div className="flex items-start justify-between border-b border-black pb-1.5 mb-1.5">
            {showLogo ? (
              <div className="w-16 h-16 flex-shrink-0 border border-black p-0.5 bg-white">
                <img src={displayLogoUrl} alt="Logo" style={{ filter: 'grayscale(100%)' }} className="w-full h-full object-contain grayscale" />
              </div>
            ) : (
              <div className="w-16 h-16 flex-shrink-0 invisible" />
            )}
            <div className="flex-grow text-center px-2 flex flex-col justify-center items-center" style={{ lineHeight: '1.3' }}>
              <h1 style={{ fontSize: '15px' }} className="font-bold uppercase text-black m-0">School Base Assessment (SBA)</h1>
              <h2 style={{ fontSize: '14px' }} className="font-bold text-black mt-0.5 m-0">GRADE-{classLevel.replace(/\D/g,'') || '8'}</h2>
              <h2 style={{ fontSize: '14px' }} className="font-bold text-black uppercase mt-0.5 m-0">SUBJECT: {subject}</h2>
              <p style={{ fontSize: '11px' }} className="font-bold mt-0.5 mb-0 text-black">[{sections.map((s, i) => `Part ${String.fromCharCode(65+i)}: ${s.attemptCount * s.marksPerQuestion} Marks`).join(' ')} Total: {totalMarks} Marks]</p>
            </div>
            <div className="w-16 h-16 flex-shrink-0 flex flex-col justify-between">
               <div className="w-14 h-14 border border-black p-0.5 ml-auto"><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkAQMAAABKLAcXAAAABlBMVEX///8AAABVwtN+AAAACXBIWXMAAA7EAAAOxAGVKw4bAAABPElEQVQ4jZXUMY6EIBQG4Ecs7OACRq9BYeKVsNtK6KabuRLJFF7DiRfAjsLw73Nnd7NTLCNUfomE5/sfEr0sCwhP3Zw6YMnKUK3ugbc0JPIacRFwDz81w1YodXcimjOi3iaa3oork72C/63zpPjbZW8e8/WnE//q2ca2Tn+aekYWF+wm6XGdZV5qoY1zQOgiV5bTuD9zEGvkE85LwW2cw5G0zIuPEndH2lRzyMuu7shhAI7KCsQzsSvMVxoCZcWjg90KLysvSzQCmzeLJqpDXlMVQ8+PqYs8SzmZxgqEVqtd874C0QcNLtVYtMxrXGpZuS4qRJ66nHhJso8oaSjS11yrVKfm2ev/xXeFE2tpIm5UgY5bvBvghpjey3NuoZqxvNUx/lzh975zOv5Z4O7eVsi8+H1Wqw3pUKKX9QnB/E40GAtouwAAAABJRU5ErkJggg==" alt="QR Code" className="w-full h-full object-contain" /></div>
            </div>
          </div>
          
          <div style={{ fontSize: '12px', lineHeight: '1.4' }} className="flex flex-col gap-1.5 font-bold px-1 text-black">
            <div className="flex items-end gap-2">
              <span className="whitespace-nowrap shrink-0">School Name:</span>
              <div className="flex-grow border-b border-black text-left pb-0.5 min-h-[18px]">{instituteProfile?.instituteName || ""}</div>
            </div>
            <div className="flex items-end gap-3">
              <span className="whitespace-nowrap shrink-0">Student Name :</span>
              <div className="flex-grow border-b border-black min-h-[16px]"></div>
              <span className="whitespace-nowrap shrink-0">Roll Number :</span>
              <div className="w-28 border-b border-black min-h-[16px]"></div>
              <span className="whitespace-nowrap shrink-0">Section :</span>
              <div className="w-24 border-b border-black min-h-[16px]"></div>
            </div>
          </div>
        </div>
      );
    }

    if (headerStyle === 'layout3') {
      return (
        <div className="mb-2 relative z-10" style={{ fontFamily: englishFontStack, lineHeight: '1.35' }} dir="ltr">
          <div className="flex items-center justify-center mb-1.5 text-black border-b-[3px] border-black pb-1.5 gap-4">
             {showLogo && (
                <div className="w-20 h-12 flex-shrink-0"><img src={displayLogoUrl} alt="Logo" style={{ filter: 'grayscale(100%)' }} className="w-full h-full object-contain grayscale" /></div>
             )}
             <h1 style={{ fontSize: '22px', lineHeight: '1.2' }} className="font-black uppercase tracking-tighter m-0">{instituteProfile?.instituteName || "STEP ACADEMY"}</h1>
          </div>
          
          <table className="w-full border-collapse border border-black text-black" style={{ fontSize: '11px', lineHeight: '1.35' }}>
            <tbody>
              <tr>
                <td className="border border-black font-bold p-1 bg-black/5 w-16">Name</td>
                <td colSpan={2} className="border border-black p-1 w-1/3"></td>
                <td className="border border-black font-bold p-1 bg-black/5 w-16">Batch</td>
                <td className="border border-black p-1"></td>
                <td className="border border-black font-bold p-1 bg-black/5 w-16">Date</td>
                <td colSpan={2} className="border border-black p-1 w-24"></td>
              </tr>
              <tr>
                <td className="border border-black font-bold p-1 bg-black/5">Class</td>
                <td className="border border-black p-1 font-bold text-center">{classLevel}</td>
                <td className="border border-black font-bold p-1 bg-black/5 text-center w-16">Roll #</td>
                <td className="border border-black p-1"></td>
                <td className="border border-black font-bold p-1 bg-black/5">Subject</td>
                <td className="border border-black p-1 font-bold text-center uppercase">{subject}</td>
                <td className="border border-black font-bold p-1 bg-black/5">T. Marks</td>
                <td className="border border-black p-1 font-bold text-center">{totalMarks}</td>
              </tr>
              <tr>
                <td className="border border-black font-bold p-1 bg-black/5">Syllabus</td>
                <td colSpan={5} className="border border-black p-1">{chaptersDisplay || ''}</td>
                <td className="border border-black font-bold p-1 bg-black/5">Time</td>
                <td className="border border-black p-1 font-bold text-center">{timeAllowed}</td>
              </tr>
            </tbody>
          </table>
        </div>
      );
    }

    if (headerStyle === 'layout4') {
      return (
        <div className="border-[1.5px] border-black mb-2 relative z-10" style={{ fontFamily: englishFontStack, lineHeight: '1.35' }} dir="ltr">
          <div className="text-center text-black border-b-[1.5px] border-black p-1.5">
            <h1 style={{ fontSize: '18px', lineHeight: '1.25' }} className="font-black uppercase m-0">{instituteProfile?.instituteName || "APLUS ACADEMY"}</h1>
            <p style={{ fontSize: '10px', lineHeight: '1.3' }} className="font-bold m-0 mt-0.5">{instituteProfile?.address || ""}</p>
          </div>
          
          <div className="flex">
            <div className="w-[35%] flex flex-col border-r-[1.5px] border-black">
              <div className="flex border-b-[1.5px] border-black h-1/3">
                <div className="w-1/2 p-1 font-bold text-[11px] border-r-[1.5px] border-black flex items-center text-black">Student Name:</div>
                <div className="w-1/2 p-1"></div>
              </div>
              <div className="flex border-b-[1.5px] border-black h-1/3">
                <div className="w-1/2 p-1 font-bold text-[11px] border-r-[1.5px] border-black flex items-center text-black">Paper Type:</div>
                <div className="w-1/2 p-1 text-[11px] font-bold flex items-center text-black">Subjective</div>
              </div>
              <div className="flex h-1/3">
                <div className="w-1/2 p-1 font-bold text-[11px] border-r-[1.5px] border-black flex items-center text-black">Paper Date:</div>
                <div className="w-1/2 p-1"></div>
              </div>
            </div>
            
            <div className="w-[30%] flex items-center justify-center border-r-[1.5px] border-black p-1">
               {showLogo ? (
                  <img src={displayLogoUrl} alt="Logo" style={{ filter: 'grayscale(100%)' }} className="w-16 h-16 object-contain grayscale" />
               ) : (
                  <div className="text-[10px] font-bold text-black/30">LOGO</div>
               )}
            </div>
            
            <div className="w-[35%] flex flex-col">
              <div className="flex border-b-[1.5px] border-black h-1/3">
                <div className="w-[45%] p-1 font-bold text-[11px] border-r-[1.5px] border-black flex items-center text-black">Class:</div>
                <div className="w-[55%] p-1 text-[11px] font-bold flex items-center text-black pl-2">{classLevel}</div>
              </div>
              <div className="flex border-b-[1.5px] border-black h-1/3">
                <div className="w-[45%] p-1 font-bold text-[11px] border-r-[1.5px] border-black flex items-center text-black">Subject:</div>
                <div className="w-[55%] p-1 text-[11px] font-bold flex items-center text-black pl-2">{subject}</div>
              </div>
              <div className="flex h-1/3">
                <div className="w-[45%] p-1 font-bold text-[10px] leading-tight border-r-[1.5px] border-black flex items-center text-black">Maximum Marks:</div>
                <div className="w-[55%] p-1 text-[11px] font-bold flex items-center text-black pl-2">{totalMarks}</div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (headerStyle === 'layout5') {
      return (
        <div className="border border-black mb-2 relative z-10" style={{ fontFamily: englishFontStack, lineHeight: '1.35' }} dir="ltr">
           <div className="flex border-b border-black">
              <div className="w-[20%] p-1.5 flex items-center justify-center border-r border-black">
                 {showLogo ? (
                    <img src={displayLogoUrl} alt="Logo" style={{ filter: 'grayscale(100%)' }} className="w-16 h-12 object-contain grayscale" />
                 ) : (
                    <div className="text-[10px] font-bold text-black/30">LOGO</div>
                 )}
              </div>
              <div className="w-[80%] text-center p-1.5 flex flex-col justify-center items-center text-black">
                 <h1 style={{ fontSize: '18px', lineHeight: '1.25' }} className="font-bold m-0">{instituteProfile?.instituteName || "ACADEMY NAME"}</h1>
                 <p style={{ fontSize: '10px', lineHeight: '1.3' }} className="font-bold m-0 mt-0.5">{instituteProfile?.address || ""}</p>
                 {instituteProfile?.showContactOnPapers && <p style={{ fontSize: '10px', lineHeight: '1.3' }} className="font-bold m-0">{instituteProfile?.contactNumber}</p>}
              </div>
           </div>
           
           <table className="w-full border-collapse text-black" style={{ fontSize: '11px', lineHeight: '1.35' }}>
              <tbody>
                 <tr className="border-b border-black">
                    <td className="p-1 border-r border-black w-1/4">Name:</td>
                    <td className="p-1 border-r border-black w-1/4">Roll:</td>
                    <td className="p-1 border-r border-black w-1/4">Section:</td>
                    <td className="p-1 w-1/4">Time: <span className="font-bold ml-1">{timeAllowed}</span></td>
                 </tr>
                 <tr>
                    <td className="p-1 border-r border-black w-1/4">Date:</td>
                    <td className="p-1 border-r border-black w-1/4">Paper: <span className="font-bold ml-1">{subject}</span></td>
                    <td className="p-1 border-r border-black w-1/4">Syllabus:</td>
                    <td className="p-1 w-1/4">Obt Marks:</td>
                 </tr>
              </tbody>
           </table>
        </div>
      );
    }

    if (headerStyle === 'layout6') {
      return (
        <div className="border-[2px] border-black p-2 mb-2 relative z-10" style={{ fontFamily: englishFontStack, lineHeight: '1.35' }} dir="ltr">
           <div className="flex items-center justify-center mb-1.5 text-black pb-1 gap-4">
              {showLogo && (
                 <div className="w-16 h-16 flex-shrink-0 border border-black p-1"><img src={displayLogoUrl} alt="Logo" style={{ filter: 'grayscale(100%)' }} className="w-full h-full object-contain grayscale" /></div>
              )}
              <div className="flex flex-col items-center">
                 <h1 style={{ fontSize: '20px', lineHeight: '1.2' }} className="font-black uppercase m-0 tracking-wider">{instituteProfile?.instituteName || "INSTITUTE NAME"}</h1>
                 <p style={{ fontSize: '11px', lineHeight: '1.3' }} className="font-bold m-0 mt-1">{instituteProfile?.address || ""}</p>
              </div>
           </div>
           <div style={{ fontSize: '11px', lineHeight: '1.35' }} className="flex justify-between border-t-[2px] border-black pt-1.5 font-bold text-black uppercase">
              <span>Class: {classLevel}</span>
              <span>Subject: {subject}</span>
              <span>Time: {timeAllowed}</span>
              <span>Marks: {totalMarks}</span>
           </div>
        </div>
      );
    }

    if (headerStyle === 'layout7') {
      return (
        <div className="mb-2 relative z-10" style={{ fontFamily: englishFontStack, lineHeight: '1.35' }} dir="ltr">
           <div className="flex justify-between items-end border-b-2 border-black pb-1.5 text-black">
              <div className="flex flex-col">
                 <h1 style={{ fontSize: '22px', lineHeight: '1.2' }} className="font-black uppercase m-0">{instituteProfile?.instituteName || "ACADEMY NAME"}</h1>
                 <p style={{ fontSize: '12px', lineHeight: '1.3' }} className="font-bold m-0 mt-1 tracking-wide">{instituteProfile?.address || "Address of the institute"}</p>
              </div>
              {showLogo && (
                 <div className="w-14 h-14 flex-shrink-0"><img src={displayLogoUrl} alt="Logo" style={{ filter: 'grayscale(100%)' }} className="w-full h-full object-contain grayscale" /></div>
              )}
           </div>
           <div style={{ fontSize: '12px', lineHeight: '1.4' }} className="grid grid-cols-[auto_1fr_auto_1fr] gap-x-4 gap-y-2 pt-2 font-bold text-black items-end">
              <div>Name:</div><div className="border-b border-black min-h-[18px]"></div>
              <div>Class:</div><div className="border-b border-black flex items-center pb-0.5 min-h-[18px]">{classLevel}</div>
              <div>Subject:</div><div className="border-b border-black flex items-center uppercase pb-0.5 min-h-[18px]">{subject}</div>
              <div>Date:</div><div className="border-b border-black min-h-[18px]"></div>
           </div>
        </div>
      );
    }

    if (headerStyle === 'layout8') {
      return (
        <div className="mb-3 relative z-10 border border-black rounded-xl overflow-hidden" style={{ fontFamily: englishFontStack, lineHeight: '1.35' }} dir="ltr">
           <div className="bg-black text-white p-2 flex justify-between items-center">
              <div className="flex flex-col">
                 <h1 style={{ fontSize: '18px', lineHeight: '1.2' }} className="font-black uppercase m-0">{instituteProfile?.instituteName || "INSTITUTE"}</h1>
                 <p style={{ fontSize: '9px', lineHeight: '1.3' }} className="font-normal m-0 mt-0.5">{instituteProfile?.address || "Campus Address"}</p>
              </div>
              <div className="text-right flex flex-col">
                 <span style={{ fontSize: '14px', lineHeight: '1.25' }} className="font-bold uppercase">{subject}</span>
                 <span style={{ fontSize: '10px', lineHeight: '1.3' }}>Max Marks: {totalMarks}</span>
              </div>
           </div>
           <div style={{ fontSize: '11px', lineHeight: '1.35' }} className="p-2 bg-white text-black flex justify-between items-end font-bold">
              <span className="flex-1 flex items-end gap-2">Name: <span className="border-b border-black flex-1 mr-4 min-h-[16px]"></span></span>
              <span>Class: {classLevel}</span>
           </div>
        </div>
      );
    }

    return (
      <div className="border-b-2 pb-1 mb-1 z-10 relative print:mt-0" style={{ borderColor: '#000000', fontFamily: englishFontStack, lineHeight: '1.35' }} dir="ltr">
        <div className="flex items-center justify-between mb-1">
          {showLogo ? (
            <div className={`${styles.logoSize} flex-shrink-0`}><img src={displayLogoUrl} alt="Logo" style={{ filter: 'grayscale(100%)' }} className="w-full h-full object-contain grayscale" /></div>
          ) : (
            <div className={`${styles.logoSize} flex-shrink-0 invisible`} />
          )}
          <div className="flex-grow text-center px-1">
            <h1 style={{ fontSize: styles.headerTitle, lineHeight: '1.25' }} className="font-bold uppercase tracking-tight mb-0.5 text-black">{instituteProfile?.instituteName || "INSTITUTE NAME"}</h1>
            <p style={{ fontSize: styles.headerInfo, lineHeight: '1.3' }} className="flex items-center justify-center gap-2 opacity-80 text-black">
              <span>{instituteProfile?.address}</span>
              {instituteProfile?.showContactOnPapers && <><span className="opacity-30">|</span><span className="font-semibold">{instituteProfile?.contactNumber}</span></>}
            </p>
          </div>
          <div className={`${styles.logoSize} flex-shrink-0 invisible`} aria-hidden="true" />
        </div>
        
        <div style={{ fontSize: styles.headerInfo, borderTop: '1px solid #000000', lineHeight: '1.35' }} className="flex justify-between items-center font-bold py-1 px-1 uppercase tracking-tighter text-black">
          <span>Class: <span className="font-normal">{classLevel}</span></span>
          <span>Subject: <span className="font-normal">{subject}</span></span>
          <span>Time: <span className="font-normal">{timeAllowed}</span></span>
          <div className="flex gap-2 items-center">
            <span>Total Marks: <span className="font-normal">{totalMarks}</span></span>
            {paperCode && <span>Paper Code: <span className="font-bold border-2 px-1 py-0 rounded ml-0.5" style={{ borderColor: '#000000' }}>{paperCode}</span></span>}
          </div>
        </div>
        
        <div style={{ fontSize: styles.headerInfo, borderTop: '1px solid #000000', lineHeight: '1.35' }} className="flex justify-between items-center font-bold pt-1 px-1 text-black">
          <span>Student: __________________________</span>
          <div className="flex gap-4">
            <span>Roll No: ________</span>
            {chaptersDisplay && <span>CH: <span className="font-normal">{chaptersDisplay}</span></span>}
          </div>
        </div>
      </div>
    );
  };

  const renderBubbleSheet = (blockId: string) => {
    if (!hasMCQWithQuestions || totalMCQCount <= 0 || bubbleSheetPosition === 'none') return null;

    const bBreak = pageBreakMap[blockId];
    const colCount =
      totalMCQCount <= 6
        ? Math.max(totalMCQCount, 6)
        : totalMCQCount === 12
        ? 6
        : 7;

    return (
      <React.Fragment key={blockId}>
        {bBreak && (
          <PageBoundaryBanner
            endedPage={bBreak.endedPage}
            nextPage={bBreak.nextPage}
            isManual={bBreak.isManual}
          />
        )}
        <div
          style={bBreak ? { pageBreakBefore: 'always', breakBefore: 'page' } : undefined}
          className={bBreak ? 'page-break-before print:pt-2 w-full' : 'w-full'}
        >
          {bBreak && renderPageWatermark(`break-${blockId}`)}
          {bBreak && (
            <div className="repeated-page-header mb-1.5">
              {renderPaperHeader()}
            </div>
          )}
          <div
            data-block-id={blockId}
            dir="ltr"
            style={{ fontFamily: englishFontStack, lineHeight: '1.25' }}
            className="border-[1.5px] border-black rounded-sm px-1.5 py-1 my-1 bg-white text-black break-inside-avoid"
          >
            <div className="flex items-center justify-between border-b border-black pb-0.5 mb-1 gap-2">
              <div className="flex items-center gap-2">
                <span className="font-black uppercase tracking-wider text-[10px] text-black">
                  BUBBLE SHEET (MCQs: 1–{totalMCQCount})
                </span>
                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-black">
                  <span>Correct:</span>
                  <svg width="11" height="11" viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
                    <circle cx="6" cy="6" r="5" fill="#000000" stroke="#000000" strokeWidth="1" />
                  </svg>
                </span>
              </div>
              {medium === 'Urdu' || medium === 'Both' ? (
                <span
                  dir="rtl"
                  style={{ fontFamily: urduFontStack, lineHeight: '1.35' }}
                  className="text-[11px] font-bold text-black text-right"
                >
                  درست جواب کے دائرے کو نیلے یا کالے پین سے مکمل پر کریں۔
                </span>
              ) : (
                <span className="text-[9px] font-bold text-black">
                  Fill the correct circle completely with blue or black ink.
                </span>
              )}
            </div>

            <div
              className="grid gap-x-1 gap-y-1"
              style={{ gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))` }}
              dir="ltr"
            >
              {Array.from({ length: totalMCQCount }).map((_, idx) => {
                const qNum = idx + 1;
                return (
                  <div
                    key={qNum}
                    className="inline-flex items-center justify-start gap-1 border border-black/30 rounded-[2px] px-1 py-0.5 bg-white"
                  >
                    <span className="font-bold text-[9.5px] text-black shrink-0 text-left leading-none">
                      {qNum}.
                    </span>
                    <div className="inline-flex items-center gap-[2px] shrink-0">
                      {['A', 'B', 'C', 'D'].map(letter => (
                        <svg
                          key={letter}
                          width="12.5"
                          height="12.5"
                          viewBox="0 0 16 16"
                          xmlns="http://www.w3.org/2000/svg"
                          style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}
                        >
                          <circle cx="8" cy="8" r="6.8" fill="#ffffff" stroke="#000000" strokeWidth="1.25" />
                          <text
                            x="8"
                            y="8.4"
                            textAnchor="middle"
                            dominantBaseline="central"
                            fontSize="8.5"
                            fontWeight="bold"
                            fontFamily="Times New Roman, serif"
                            fill="#000000"
                          >
                            {letter}
                          </text>
                        </svg>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </React.Fragment>
    );
  };

  const renderAnswerKeyBubbleSheet = (idPrefix: string = '') => {
    if (!showAnswerKey || orderedMCQQuestions.length === 0) return null;

    const akBlockId = `${idPrefix}mcq-answer-key-block`;
    const akBreak = pageBreakMap[akBlockId];
    const colCount =
      totalMCQCount <= 6
        ? Math.max(totalMCQCount, 6)
        : totalMCQCount === 12
        ? 6
        : 7;

    return (
      <React.Fragment key={akBlockId}>
        {akBreak && (
          <PageBoundaryBanner
            endedPage={akBreak.endedPage}
            nextPage={akBreak.nextPage}
            isManual={akBreak.isManual}
          />
        )}
        <div
          style={akBreak ? { pageBreakBefore: 'always', breakBefore: 'page' } : undefined}
          className={akBreak ? 'page-break-before print:pt-2 w-full' : 'w-full'}
        >
          {akBreak && renderPageWatermark(`break-${akBlockId}`)}
          {akBreak && (
            <div className="repeated-page-header mb-1.5">
              {renderPaperHeader()}
            </div>
          )}
          <div
            data-block-id={akBlockId}
            dir="ltr"
            style={{ fontFamily: englishFontStack, lineHeight: '1.25' }}
            className="mt-1.5 border-[1.5px] border-black rounded-sm px-1.5 py-1 bg-white text-black break-inside-avoid z-10 relative"
          >
            <div className="flex items-center justify-between border-b border-black pb-0.5 mb-1 gap-2">
              <span className="font-black uppercase tracking-wider text-[10px] text-black">
                ANSWER KEY — BUBBLE SHEET (MCQs: 1–{totalMCQCount})
              </span>
              <span className="inline-flex items-center gap-1 text-[9px] font-bold text-black">
                <span>Correct Option:</span>
                <svg width="11" height="11" viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
                  <circle cx="6" cy="6" r="5" fill="#000000" stroke="#000000" strokeWidth="1" />
                </svg>
              </span>
            </div>

            <div
              className="grid gap-x-1 gap-y-1"
              style={{ gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))` }}
              dir="ltr"
            >
              {orderedMCQQuestions.map((mcq, idx) => {
                const qNum = idx + 1;
                const correctLetter = getCorrectBubbleLetter(mcq);
                return (
                  <div
                    key={`${idPrefix}key-${mcq.id}-${qNum}`}
                    className="inline-flex items-center justify-start gap-1 border border-black/30 rounded-[2px] px-1 py-0.5 bg-white"
                  >
                    <span className="font-bold text-[9.5px] text-black shrink-0 text-left leading-none">
                      {qNum}.
                    </span>
                    <div className="inline-flex items-center gap-[2px] shrink-0">
                      {(['A', 'B', 'C', 'D'] as const).map(letter => {
                        const isFilled = correctLetter === letter;
                        return (
                          <svg
                            key={letter}
                            width="12.5"
                            height="12.5"
                            viewBox="0 0 16 16"
                            xmlns="http://www.w3.org/2000/svg"
                            style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}
                          >
                            <circle
                              cx="8"
                              cy="8"
                              r="6.8"
                              fill={isFilled ? '#000000' : '#ffffff'}
                              stroke="#000000"
                              strokeWidth="1.25"
                            />
                            <text
                              x="8"
                              y="8.4"
                              textAnchor="middle"
                              dominantBaseline="central"
                              fontSize="8.5"
                              fontWeight="bold"
                              fontFamily="Times New Roman, serif"
                              fill={isFilled ? '#ffffff' : '#000000'}
                            >
                              {letter}
                            </text>
                          </svg>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </React.Fragment>
    );
  };

  const renderPaperCopy = (copyIndex: number) => {
    const idPrefix = copyIndex === 0 ? '' : `copy${copyIndex + 1}-`;
    const isSecondCopy = copyIndex === 1;
    const copy2Break = isSecondCopy ? pageBreakMap['copy2-root-start'] : undefined;
    let runningMCQCounter = 0;

    return (
      <div
        data-copy-wrapper={copyIndex}
        style={copy2Break ? { pageBreakBefore: 'always', breakBefore: 'page' } : undefined}
        className={`relative w-full ${copy2Break ? 'page-break-before print:pt-2' : ''}`}
      >
        {/* FIRST PAGE OF THIS COPY WATERMARK */}
        {renderPageWatermark(`copy${copyIndex}-page1`)}

        {/* HEADER BLOCK */}
        <div
          data-block-id={isSecondCopy ? 'copy2-root-start' : 'copy1-root-start'}
          data-main-paper-header={copyIndex === 0 ? 'true' : undefined}
        >
          {renderPaperHeader()}
        </div>

        {/* QUESTIONS ENGINE */}
        <div className="z-10 relative mt-0.5" dir={baseDir}>
          {!hasQuestions ? (
            <div className="flex items-center justify-center h-24 text-gray-400 border border-dashed border-gray-300 rounded m-1"><p className="font-bold text-sm">No questions selected.</p></div>
          ) : (
            sections.map((section, idx) => {
              const sectionQuestions = questions.filter(q => 
                q.targetSectionId === section.id || 
                (!q.targetSectionId && (q.type === section.type || q.type?.toUpperCase() === section.type?.toUpperCase()))
              );
              if (sectionQuestions.length === 0) return null;
              
              let localQuestionCounter = 0;
              const actualHeading = section.heading === 'None'
                  ? ''
                  : (section.heading ? section.heading : `Section ${String.fromCharCode(65 + idx)}`);
                  
              const prevActualHeading = idx > 0 
                  ? (sections[idx - 1].heading === 'None' ? '' : (sections[idx - 1].heading ? sections[idx - 1].heading : `Section ${String.fromCharCode(65 + idx - 1)}`)) 
                  : null;
                  
              const showHeading = Boolean(actualHeading) && actualHeading !== prevActualHeading;
              
              const isIdioms = section.type === 'Idioms';
              const isSentences = section.type === 'Sentences';
              const isVoice = section.type === 'Voice';
              const isGridSection = isIdioms || isSentences || isVoice;
              
              // 🔹 Detect if primary section content is Urdu (for single-medium English/Urdu papers)
              const containsUrdu = sectionQuestions.some(q => isUrduText(q.text));
              const gridDir = (medium === 'Urdu' || (medium === 'English' && containsUrdu)) ? 'rtl' : 'ltr';

              const gridCols = isIdioms ? 'grid-cols-4' : ((isSentences || isVoice) ? 'grid-cols-3' : ''); 

              const skipNumbering = (section as any).hideMainNumbering || Boolean(section.title && section.title.match(/^[Q|سوال]/));

              // 🔹 DYNAMIC FONT SIZE RESOLUTION
              const customTitleSize = section.titleFontSize ? `${section.titleFontSize}px` : styles.sectionTitle;
              const isBreakSection = Boolean(pageBreakAfterMCQ && section.id === firstSubjectiveSectionId);
              const secIdKey = `${idPrefix}sec-${idx}`;
              const secHeaderBlockId = `${idPrefix}sec-header-${idx}`;
              const secHeaderBreak = pageBreakMap[secHeaderBlockId] || (isBreakSection ? { endedPage: 1, nextPage: 2, isManual: true } : undefined);

              // Build flat list of question items for this section so mid-section page breaks close the border box cleanly and repeat the header on the new page
              const questionItems: {
                qBlockId: string;
                qBreak?: { endedPage: number; nextPage: number; isManual?: boolean };
                node: React.ReactNode;
              }[] = [];

              if (section.type === 'MCQ') {
                if (section.subParts && section.subParts.length > 0) {
                  let secMcqIndex = 0;
                  section.subParts.forEach((part, pIdx) => {
                    const start = section.subParts!.slice(0, pIdx).reduce((acc, p) => acc + (p.questionCount || 0), 0);
                    const partQuestions = sectionQuestions.slice(start, start + (part.questionCount || 0));
                    if (partQuestions.length === 0) return;
                    const isPartUrdu = isUrduText(part.label);

                    partQuestions.forEach((q, pqIdx) => {
                      runningMCQCounter++;
                      const isFirstInSec = secMcqIndex === 0;
                      secMcqIndex++;
                      const qBlockId = `${idPrefix}mcq-${idx}-${pIdx}-${q.id}-${runningMCQCounter}`;
                      const qBreak = isFirstInSec ? undefined : pageBreakMap[qBlockId];
                      const isLastInPart = pqIdx === partQuestions.length - 1;
                      const activeOptions = (q.options && q.options.length > 0) ? q.options : (q.optionsUrdu || []);
                      const hasLongOption = activeOptions.some((opt, oIdx) => {
                        const engLen = cleanText(q.options?.[oIdx] || opt).length;
                        const urdLen = cleanText(q.optionsUrdu?.[oIdx] || opt).length;
                        const activeLen = medium === 'Urdu' ? (urdLen || engLen) : (engLen || urdLen);
                        return activeLen > 24;
                      });
                      const singleMediumLayoutClass = hasLongOption
                        ? 'flex flex-wrap items-baseline gap-x-12 gap-y-1'
                        : 'grid grid-cols-4 gap-x-6 gap-y-1 w-full';

                      questionItems.push({
                        qBlockId,
                        qBreak,
                        node: (
                          <div
                            key={qBlockId}
                            data-block-id={qBlockId}
                            data-first-q-of={isFirstInSec ? secIdKey : undefined}
                            style={{
                              fontSize: styles.questionText,
                              paddingBottom: isLastInPart ? '0px' : mcqPaddingBottom,
                              marginBottom: isLastInPart ? '0px' : mcqMarginBottom
                            }}
                            className="break-inside-avoid"
                          >
                            {pqIdx === 0 && Boolean(part.label) && (
                              <div
                                style={{ fontSize: styles.questionText }}
                                className={`font-bold italic mb-1 mt-0.5 opacity-90 border-l-4 border-black pl-2 text-black ${
                                  isPartUrdu ? 'font-urdu text-right border-l-0 border-r-4 pr-2' : ''
                                }`}
                                dir={isPartUrdu ? 'rtl' : 'ltr'}
                              >
                                {renderFormattedText(part.label)}
                              </div>
                            )}
                            <div className="font-semibold w-full text-black">{renderQuestionText(q, runningMCQCounter)}</div>
                            <div
                              className={`${medium === 'Both' ? `grid ${styles.optionGrid}` : singleMediumLayoutClass} ${
                                baseDir === 'rtl' ? 'pr-4' : 'pl-4'
                              } mt-0.5`}
                              dir={baseDir}
                            >
                              {activeOptions.map((_, oIdx) => (
                                <div key={oIdx} style={{ fontSize: styles.optionText }} className="inline-flex items-baseline gap-1.5">
                                  <span
                                    className="font-bold text-black shrink-0 inline-block"
                                    dir="ltr"
                                    style={{ fontFamily: englishFontStack, unicodeBidi: 'isolate' }}
                                  >
                                    ({String.fromCharCode(65 + oIdx)})
                                  </span>
                                  <div className="inline-block">{renderOptionContent(q, oIdx)}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      });
                    });
                  });
                } else {
                  sectionQuestions.forEach((q, mqIdx) => {
                    runningMCQCounter++;
                    const isFirstInSec = mqIdx === 0;
                    const qBlockId = `${idPrefix}mcq-${idx}-${q.id}-${runningMCQCounter}`;
                    const qBreak = isFirstInSec ? undefined : pageBreakMap[qBlockId];
                    const isLastMCQ = mqIdx === sectionQuestions.length - 1;
                    const activeOptions = (q.options && q.options.length > 0) ? q.options : (q.optionsUrdu || []);
                    const hasLongOption = activeOptions.some((opt, oIdx) => {
                      const engLen = cleanText(q.options?.[oIdx] || opt).length;
                      const urdLen = cleanText(q.optionsUrdu?.[oIdx] || opt).length;
                      const activeLen = medium === 'Urdu' ? (urdLen || engLen) : (engLen || urdLen);
                      return activeLen > 24;
                    });
                    const singleMediumLayoutClass = hasLongOption
                      ? 'flex flex-wrap items-baseline gap-x-12 gap-y-1'
                      : 'grid grid-cols-4 gap-x-6 gap-y-1 w-full';

                    questionItems.push({
                      qBlockId,
                      qBreak,
                      node: (
                        <div
                          key={qBlockId}
                          data-block-id={qBlockId}
                          data-first-q-of={isFirstInSec ? secIdKey : undefined}
                          style={{
                            fontSize: styles.questionText,
                            paddingBottom: isLastMCQ ? '0px' : mcqPaddingBottom,
                            marginBottom: isLastMCQ ? '0px' : mcqMarginBottom
                          }}
                          className="break-inside-avoid"
                        >
                          <div className="font-semibold w-full text-black">{renderQuestionText(q, runningMCQCounter)}</div>
                          <div
                            className={`${medium === 'Both' ? `grid ${styles.optionGrid}` : singleMediumLayoutClass} ${
                              baseDir === 'rtl' ? 'pr-4' : 'pl-4'
                            } mt-0.5`}
                            dir={baseDir}
                          >
                            {activeOptions.map((_, oIdx) => (
                              <div key={oIdx} style={{ fontSize: styles.optionText }} className="inline-flex items-baseline gap-1.5">
                                <span
                                  className="font-bold text-black shrink-0 inline-block"
                                  dir="ltr"
                                  style={{ fontFamily: englishFontStack, unicodeBidi: 'isolate' }}
                                >
                                  ({String.fromCharCode(65 + oIdx)})
                                </span>
                                <div className="inline-block">{renderOptionContent(q, oIdx)}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    });
                  });
                }
              } else {
                const partsPerQuestion = (section.subParts && section.subParts.length > 0) ? section.subParts.length : 1;
                const totalUnits = Math.floor(sectionQuestions.length / partsPerQuestion);
                Array.from({ length: totalUnits }).forEach((_, qIdx) => {
                  localQuestionCounter++;
                  const isFirstInSec = qIdx === 0;
                  const startIndex = qIdx * partsPerQuestion;
                  const isLastUnit = qIdx === totalUnits - 1;

                  const counterLabel = isIdioms
                    ? `${toRoman(localQuestionCounter)}.`
                    : (isSentences || isVoice)
                    ? `(${toRoman(localQuestionCounter)})`
                    : localQuestionCounter;

                  const qBlockId = `${idPrefix}q-${idx}-${qIdx}`;
                  const qBreak = isFirstInSec ? undefined : pageBreakMap[qBlockId];

                  questionItems.push({
                    qBlockId,
                    qBreak,
                    node: (
                      <div
                        key={qBlockId}
                        data-block-id={qBlockId}
                        data-first-q-of={isFirstInSec ? secIdKey : undefined}
                        className="break-inside-avoid"
                        style={{
                          paddingBottom: (isGridSection || isLastUnit) ? '0px' : questionPaddingBottom,
                          marginBottom: (isGridSection || isLastUnit) ? '0px' : questionMarginBottom
                        }}
                      >
                        {section.subParts && section.subParts.length > 0 ? (
                          <div className="space-y-0">
                            {!skipNumbering && section.type.toUpperCase() !== 'LONG' && (
                              <div className="font-bold text-black" style={{ fontSize: styles.questionText, lineHeight: dynamicLineHeight }}>
                                {localQuestionCounter}.
                              </div>
                            )}

                            {section.type === 'Passage' && (
                              <div className="font-bold underline ml-4 mb-1 mt-1 text-[0.9em] text-black" style={{ fontSize: styles.questionText }}>
                                Questions:
                              </div>
                            )}

                            <div className={`${(skipNumbering || baseDir === 'rtl' || gridDir === 'rtl') ? 'pr-0' : 'pl-3'} space-y-0`}>
                              {section.subParts.map((part, pIdx) => {
                                const qPart = sectionQuestions[startIndex + pIdx];
                                if (!qPart) return null;

                                const isParaphrase = part.type === 'Paraphrase';
                                const qWithMeta = { ...qPart, isParaphrase } as any;

                                const isLong = section.type.toUpperCase() === 'LONG';
                                const subLabel = (section as any).hideSubPartNumbering ? '' : part.label;
                                const isLastSubPart = pIdx === section.subParts!.length - 1;

                                let counter: any = subLabel;
                                if (isLong) {
                                  const titleStr = section.titleUrdu || section.title || '';
                                  const titleMatch = titleStr.match(/(?:Q\.?\s*|سوال نمبر\s*|سوال\s*)(\d+)/i);
                                  const qNum = titleMatch ? parseInt(titleMatch[1], 10) + localQuestionCounter - 1 : idx + localQuestionCounter;
                                  const prefixEng = `Q${qNum}. `;
                                  const prefixUrdu = `سوال ${qNum}: `;

                                  if (pIdx === 0) {
                                    counter = {
                                      eng: <span className="flex gap-1 font-bold"><span>{prefixEng}</span><span>{subLabel}</span></span>,
                                      urdu: <span className="flex gap-1 font-bold"><span>{prefixUrdu}</span><span>{subLabel}</span></span>
                                    };
                                  } else {
                                    counter = {
                                      eng: <span className="flex gap-1 font-bold"><span className="invisible">{prefixEng}</span><span>{subLabel}</span></span>,
                                      urdu: <span className="flex gap-1 font-bold"><span className="invisible">{prefixUrdu}</span><span>{subLabel}</span></span>
                                    };
                                  }
                                }

                                return (
                                  <React.Fragment key={pIdx}>
                                    {part.isAlternative && pIdx > 0 && (
                                      <div
                                        className="w-full text-center my-1 font-black italic uppercase tracking-[0.4em] text-black"
                                        style={{ fontSize: `calc(${styles.questionText} * 0.95)`, lineHeight: '1.15' }}
                                      >
                                        (OR)
                                      </div>
                                    )}
                                    <div
                                      style={{
                                        fontSize: styles.questionText,
                                        marginBottom: isLastSubPart ? '0px' : subPartMarginBottom
                                      }}
                                      className={`flex gap-1.5 items-start ${part.isAlternative ? 'mt-0.5' : ''}`}
                                    >
                                      <div className="flex-grow min-w-0">
                                        {renderQuestionText(
                                          qWithMeta,
                                          part.isAlternative ? '' : counter,
                                          undefined,
                                          undefined,
                                          part.isAlternative || (section as any).hideSubPartNumbering,
                                          isGridSection
                                        )}
                                      </div>
                                      {!section.hideSubPartMarks && (
                                        <span className="text-[0.8em] font-bold whitespace-nowrap ml-2 text-black shrink-0" style={{ lineHeight: dynamicLineHeight }}>
                                          ({part.marks})
                                        </span>
                                      )}
                                    </div>
                                  </React.Fragment>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <div style={{ fontSize: styles.questionText }} className="w-full flex justify-between items-start">
                            <div className="flex-grow min-w-0">
                              {renderQuestionText(sectionQuestions[startIndex], counterLabel, undefined, undefined, false, isGridSection)}
                            </div>
                            {!section.hideSubPartMarks && (subject || '').toLowerCase().includes('english') && !isGridSection && (
                              <span className="text-[0.8em] font-bold ml-2 text-black shrink-0" style={{ lineHeight: dynamicLineHeight }}>
                                ({section.marksPerQuestion})
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  });
                });
              }

              const chunks: typeof questionItems[] = [];
              questionItems.forEach((item, itemIdx) => {
                if (itemIdx === 0 || !item.qBreak) {
                  if (chunks.length === 0) chunks.push([]);
                  chunks[chunks.length - 1].push(item);
                } else {
                  chunks.push([item]);
                }
              });

              const questionsWrapperClass =
                section.type === 'MCQ'
                  ? 'grid grid-cols-1 text-black'
                  : isGridSection
                  ? `grid ${gridCols} gap-x-4 gap-y-0.5`
                  : 'text-black';
              const questionsWrapperStyle = section.type === 'MCQ' ? { gap: mcqGapValue } : undefined;
              const questionsWrapperDir = section.type === 'MCQ' ? baseDir : gridDir;

              return (
                <React.Fragment key={`${idPrefix}${section.id || idx}`}>
                  {secHeaderBreak && (
                    <PageBoundaryBanner
                      endedPage={secHeaderBreak.endedPage}
                      nextPage={secHeaderBreak.nextPage}
                      isManual={secHeaderBreak.isManual}
                    />
                  )}
                  <div
                    style={{
                      marginBottom: idx < sections.length - 1 ? sectionMarginBottom : '0px',
                      ...(secHeaderBreak ? { pageBreakBefore: 'always', breakBefore: 'page' } : {})
                    }}
                    className={secHeaderBreak ? 'page-break-before print:pt-2' : ''}
                  >
                    {secHeaderBreak && renderPageWatermark(`break-${secHeaderBlockId}`)}
                    {secHeaderBreak && (
                      <div className="repeated-page-header mb-1.5">
                        {renderPaperHeader()}
                      </div>
                    )}
                    <div
                      data-block-id={secHeaderBlockId}
                      data-section-header-for={secIdKey}
                      data-manual-break={isBreakSection ? 'true' : 'false'}
                    >
                      {showHeading && (
                        <div
                          className={`text-center mt-0.5 mb-0.5 font-bold tracking-widest py-0.5 text-black ${
                            isUrduText(actualHeading) ? 'font-urdu' : ''
                          }`}
                          style={{
                            fontSize: styles.sectionTitle,
                            lineHeight: '1.3',
                            fontFamily: isUrduText(actualHeading) ? urduFontStack : englishFontStack
                          }}
                          dir={isUrduText(actualHeading) ? 'rtl' : 'ltr'}
                        >
                          ( {renderFormattedText(actualHeading)}{' '}
                          {medium === 'Both' && translateHeadingToUrdu(actualHeading) ? `/ ${translateHeadingToUrdu(actualHeading)}` : ''} )
                        </div>
                      )}
                    </div>

                    {bubbleSheetPosition === 'above_mcq' && section.id === firstMCQSectionId && renderBubbleSheet(`${idPrefix}mcq-bubble-sheet-above`)}

                    {/* First page chunk of this section */}
                    <div className="border-[1.5px] border-black px-2 py-1 rounded-sm">
                      {Boolean(section.title?.trim() || section.titleUrdu?.trim()) && (
                        <div
                          style={{ fontSize: customTitleSize, lineHeight: '1.45' }}
                          className="font-bold mb-1 border-b-[1.5px] border-black pt-0.5 pb-1 text-black"
                        >
                          {medium === 'Both' && section.titleUrdu ? (
                            <div className="flex flex-col w-full">
                              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                                <div className="text-left" dir="ltr" style={{ fontFamily: englishFontStack, lineHeight: '1.35' }}>
                                  <h3 className="uppercase whitespace-pre-wrap m-0">{renderFormattedText(section.title?.trim())}</h3>
                                </div>
                                <div className="text-center font-bold whitespace-nowrap px-2" dir="ltr" style={{ fontFamily: englishFontStack, lineHeight: '1.35' }}>
                                  {getMarksCalc(section, false)}
                                </div>
                                <div className="text-right font-urdu whitespace-pre-wrap" style={{ fontFamily: urduFontStack, lineHeight: '1.5' }} dir="rtl">
                                  {renderFormattedText(section.titleUrdu?.trim())}
                                </div>
                              </div>
                            </div>
                          ) : medium === 'Urdu' ? (
                            <div className="flex justify-between items-center font-urdu" style={{ fontFamily: urduFontStack, lineHeight: '1.5' }} dir="rtl">
                              <h3 className="uppercase whitespace-pre-wrap m-0">{renderFormattedText((section.titleUrdu || section.title)?.trim())}</h3>
                              <div className="font-bold whitespace-nowrap" dir="ltr" style={{ fontFamily: englishFontStack, lineHeight: '1.35' }}>
                                {getMarksCalc(section, true)}
                              </div>
                            </div>
                          ) : (
                            <div className="flex justify-between items-center" style={{ fontFamily: englishFontStack, lineHeight: '1.35' }} dir="ltr">
                              <h3 className="uppercase whitespace-pre-wrap m-0">{renderFormattedText(section.title?.trim())}</h3>
                              <div className="font-bold whitespace-nowrap">
                                {getMarksCalc(section, false)}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      <div className={questionsWrapperClass} style={questionsWrapperStyle} dir={questionsWrapperDir}>
                        {(chunks[0] || []).map(it => it.node)}
                      </div>
                    </div>

                    {/* Subsequent page chunks when a section spans across pages */}
                    {chunks.slice(1).map((chunk, chunkIdx) => {
                      const firstItem = chunk[0];
                      const qBreak = firstItem?.qBreak;
                      if (!firstItem || !qBreak) return null;
                      return (
                        <React.Fragment key={`${secIdKey}-chunk-${chunkIdx + 1}`}>
                          <PageBoundaryBanner
                            endedPage={qBreak.endedPage}
                            nextPage={qBreak.nextPage}
                            isManual={qBreak.isManual}
                          />
                          <div
                            style={{ pageBreakBefore: 'always', breakBefore: 'page' }}
                            className="page-break-before print:pt-2 mt-1 w-full"
                          >
                            {renderPageWatermark(`break-${firstItem.qBlockId}`)}
                            <div className="repeated-page-header mb-1.5">
                              {renderPaperHeader()}
                            </div>
                            <div className="border-[1.5px] border-black px-2 py-1 rounded-sm">
                              <div className={questionsWrapperClass} style={questionsWrapperStyle} dir={questionsWrapperDir}>
                                {chunk.map(it => it.node)}
                              </div>
                            </div>
                          </div>
                        </React.Fragment>
                      );
                    })}

                    {bubbleSheetPosition === 'below_mcq' && section.id === lastMCQSectionId && renderBubbleSheet(`${idPrefix}mcq-bubble-sheet-below`)}
                  </div>
                </React.Fragment>
              );
            })
          )}
          {hasQuestions && bubbleSheetPosition === 'paper_end' && renderBubbleSheet(`${idPrefix}mcq-bubble-sheet-end`)}
        </div>

        {/* MCQ-ONLY BUBBLE SHEET ANSWER KEY */}
        {renderAnswerKeyBubbleSheet(idPrefix)}

        <div data-block-id={`${idPrefix}paper-footer-block`} className="pt-1 border-t border-gray-200 mt-2 z-10 relative" dir="ltr">
          <div className="flex justify-between text-[6px] text-gray-400 uppercase font-bold mb-0.5">
            <span>Aplus ExamGen • v1.0.3</span>
            <span>By: Nauman Ali</span>
          </div>
          <div className="text-center text-[8px] text-gray-500 font-medium">
            Generated by <a href="https://aplusexamgen.netlify.app" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline decoration-blue-600/30">https://aplusexamgen.netlify.app</a>
          </div>
        </div>
      </div>
    );
  };

  const copy2BreakInfo = isTwoPerSheet ? pageBreakMap['copy2-root-start'] : undefined;

  return (
    <div className="print-container">
      <style>{`
        .pdf-exporting .print\\:hidden,
        .pdf-exporting .page-boundary-marker {
          display: none !important;
        }
      `}</style>
      <div 
        id="printable-section"
        ref={containerRef}
        className="p-3 tex2jax_ignore relative overflow-visible" 
        style={{ 
          backgroundColor: '#ffffff', 
          color: '#000000',           
          fontFamily: fontFamily, 
          lineHeight: dynamicLineHeight, 
          boxSizing: 'border-box', 
          paddingBottom: '3mm', 
          width: '100%', 
          margin: '0 auto' 
        }}
        dir="ltr"
      >
        {renderPaperCopy(0)}

        {isTwoPerSheet && (
          <>
            {copy2BreakInfo ? (
              <PageBoundaryBanner
                endedPage={copy2BreakInfo.endedPage}
                nextPage={copy2BreakInfo.nextPage}
                isManual={copy2BreakInfo.isManual}
              />
            ) : (
              <div data-cut-line="true" className="my-2.5 py-0.5 flex items-center gap-2 text-black select-none z-10 relative" dir="ltr">
                <span className="text-[11px] leading-none font-bold">✂</span>
                <div className="flex-grow border-t-[1.5px] border-dashed border-black" />
                <span className="text-[8px] font-black uppercase tracking-widest">Cut Here (2nd Test Copy)</span>
                <div className="flex-grow border-t-[1.5px] border-dashed border-black" />
              </div>
            )}
            {renderPaperCopy(1)}
          </>
        )}

        {/* END OF LAST PAGE INDICATOR (Screen Only) */}
        <div className="page-boundary-marker mt-2 select-none print:hidden w-full flex items-center gap-2" dir="ltr">
          <div className="flex-grow border-t-2 border-dashed border-red-500/70" />
          <span className="px-3 py-0.5 bg-red-50 border border-red-400 text-red-700 rounded text-[10px] font-black uppercase tracking-wider whitespace-nowrap">
            {formatPageEndLabel(pageSummary.totalPages)}
          </span>
          <div className="flex-grow border-t-2 border-dashed border-red-500/70" />
        </div>
      </div>
    </div>
  );
};