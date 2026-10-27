import React, { useEffect, useState, useRef } from 'react';
import { InstituteProfile, PaperPatternSection, Question } from '../types';

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
}

declare global {
  interface Window {
    MathJax: any;
  }
}

// Utility to detect if text contains Urdu characters
const isUrduText = (text: string) => /[\u0600-\u06FF]/.test(text || '');

// Utility to render text with support for *bold*, **bold**, <b>bold</b> and :underline:
const renderFormattedText = (text: string) => {
  if (!text) return null;
  
  // Standardize: 
  // 1. Convert bold markers (*, **, <b>) to a unified **marker**
  // 2. Convert colon markers (:text:) to a unified ++marker++
  const normalized = text
    .replace(/<\/?b>/gi, '@@')             // Handle <b> tags
    .replace(/\*\*([^*]+)\*\*/g, '@@$1@@') // Handle double asterisks
    .replace(/\*([^*]+)\*/g, '@@$1@@')     // Handle single asterisks
    .replace(/:([^:]+):/g, '##$1##')       // Handle colons for underlining
    .replace(/@@/g, '**')                  // Convert back to double for splitting
    .replace(/##/g, '++');                 // Convert back to double plus for splitting
  
  // Split by bold (**...**) or underline (++...++) markers
  const parts = normalized.split(/(\*\*.*?\*\*|\+\+.*?\+\+)/g);
  
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-bold">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('++') && part.endsWith('++')) {
      return <u key={i} className="underline">{part.slice(2, -2)}</u>;
    }
    return part;
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
  lineSpacing = 2,
  timeAllowed = '2:00 Hours',
  paperCode,
  chaptersDisplay,
  headerStyle = 'default',
  pageBreakAfterMCQ = false
}) => {

  const containerRef = useRef<HTMLDivElement>(null);
  const [pageBreakMap, setPageBreakMap] = useState<Record<string, { endedPage: number; nextPage: number; isManual?: boolean }>>({});
  const [pageSummary, setPageSummary] = useState<{ totalPages: number; lastPageUsedPercent: number }>({ totalPages: 1, lastPageUsedPercent: 45 });

  useEffect(() => {
    // Re-run MathJax whenever questions, subject, or font size changes
    const s = (subject || '').toLowerCase();
    if (s.includes('math') || s.includes('hisab')) {
      if (window.MathJax && window.MathJax.typesetPromise) {
        window.MathJax.typesetPromise();
      }
    }
  }, [questions, subject, showAnswerKey, medium, baseFontSize]);

  useEffect(() => {
    const calculatePagination = () => {
      const container = containerRef.current;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      if (containerRect.width === 0) return;

      // Standard A4 printable height: 280mm out of 297mm height for 210mm width
      const a4PageHeightPx = Math.max(960, (containerRect.width / 210) * 280);

      // Measure existing screen-only page boundary banners so we subtract their height
      const markers = Array.from(container.querySelectorAll('.page-boundary-marker')) as HTMLElement[];
      const markerRects = markers.map(m => {
        const r = m.getBoundingClientRect();
        const style = window.getComputedStyle(m);
        const mt = parseFloat(style.marginTop || '0') || 0;
        const mb = parseFloat(style.marginBottom || '0') || 0;
        return {
          top: r.top - containerRect.top,
          totalHeight: r.height + mt + mb
        };
      });

      const getVirtualY = (screenY: number) => {
        let virtualY = screenY;
        for (const m of markerRects) {
          if (m.top < screenY - 1) {
            virtualY -= m.totalHeight;
          }
        }
        return Math.max(0, virtualY);
      };

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

        if (isManualBreak) {
          newBreakMap[blockId] = {
            endedPage: currentPage,
            nextPage: currentPage + 1,
            isManual: true
          };
          currentPage += 1;
          currentPageStartY = vTop;
          continue;
        }

        if (vBottom - currentPageStartY > a4PageHeightPx && vTop - currentPageStartY > 40) {
          newBreakMap[blockId] = {
            endedPage: currentPage,
            nextPage: currentPage + 1,
            isManual: false
          };
          currentPage += 1;
          currentPageStartY = vTop;
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
    };

    const t1 = setTimeout(calculatePagination, 50);
    const t2 = setTimeout(calculatePagination, 250);
    window.addEventListener('resize', calculatePagination);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('resize', calculatePagination);
    };
  }, [questions, sections, baseFontSize, lineSpacing, medium, showAnswerKey, headerStyle, pageBreakAfterMCQ, classLevel, subject, timeAllowed, paperCode]);

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
          optionGrid: 'grid-cols-2 gap-x-2 gap-y-0.5'
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
          optionGrid: 'grid-cols-2 gap-x-4 gap-y-1'
        };
    }
  };

  const urduFontStack = "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif";

  const getFontFamily = (subj: string) => {
    const s = (subj || '').toLowerCase();
    // Only use Urdu font as default if the medium is Urdu
    if (medium === 'Urdu') return urduFontStack;
    
    if (s.includes('math') || s.includes('calc')) {
      return "'Cambria Math', 'Times New Roman', serif";
    }
    return "'Times New Roman', serif";
  };

  const styles = getLayoutStyles(layoutMode, baseFontSize);
  const fontFamily = getFontFamily(subject);
  
  // Dynamic Spacing Calculation (mapped from -10 to 10 scale)
  const questionPaddingBottom = lineSpacing > 0 ? `${Math.min(8, lineSpacing * 2)}px` : '0px';
  const questionMarginBottom = lineSpacing > 0 
    ? `${(lineSpacing * 0.08).toFixed(3)}rem` 
    : `${lineSpacing * 2.5}px`;

  const mcqPaddingBottom = lineSpacing > 0 ? `${Math.min(6, lineSpacing * 1.5)}px` : '0px';
  const mcqMarginBottom = lineSpacing > 0 
    ? `${(lineSpacing * 0.05).toFixed(3)}rem` 
    : `${lineSpacing * 2}px`;

  const mcqGapValue = lineSpacing > 0 ? `${(lineSpacing * 0.05).toFixed(3)}rem` : '0px';
  const sectionMarginBottom = lineSpacing >= 0 ? `${(lineSpacing * 0.08) + 0.05}rem` : '0.02rem';

  const dynamicLineHeight = (lineSpacing >= 0) 
    ? (1.1 + lineSpacing * 0.06).toFixed(2) 
    : Math.max(0.85, 1.1 + lineSpacing * 0.05).toFixed(2);

  const dynamicUrduLineHeight = (lineSpacing >= 0)
    ? (1.55 + lineSpacing * 0.07).toFixed(2)
    : Math.max(1.15, 1.55 + lineSpacing * 0.08).toFixed(2);

  // CRITICAL: baseDir follows MEDIUM, not SUBJECT. 
  const baseDir = (medium === 'Urdu') ? 'rtl' : 'ltr';

  const renderQuestionText = (q: Question, counter?: any, textOverride?: string, urduOverride?: string, hideCounter: boolean = false, centerAlign: boolean = false) => {
    const mainText = textOverride || q.text || '';
    const urduText = urduOverride || q.textUrdu || q.text || '';
    
    const isDualCounter = counter && typeof counter === 'object' && 'eng' in counter && 'urdu' in counter;
    const cEng = isDualCounter ? counter.eng : counter;
    const cUrdu = isDualCounter ? counter.urdu : counter;
    
    const suffixEng = (typeof cEng === 'number') ? '.' : '';
    const suffixUrdu = (typeof cUrdu === 'number') ? '.' : '';
    
    const isParaphrase = q.type === 'Paraphrase' || (q as any).isParaphrase;
    
    let containerClass = "flex gap-1.5 w-full";
    let counterClass = "font-bold whitespace-nowrap text-black";

    if (isParaphrase) {
      containerClass += " flex-col items-center text-center";
      counterClass += " mb-1";
    } else if (centerAlign) {
      containerClass += " flex-row justify-center items-baseline text-center";
      counterClass += " self-baseline";
    } else {
      containerClass += " items-start";
      containerClass += " self-start";
    }

    // Forced Urdu detection for single medium papers
    if (medium === 'Urdu' || (medium === 'English' && isUrduText(mainText))) {
      const displayContent = medium === 'Urdu' ? urduText : mainText;
      return (
        <div className={containerClass} dir="rtl">
          {!hideCounter && <span className={counterClass} style={{ fontFamily: urduFontStack }}>{cUrdu}{suffixUrdu}</span>}
          <span style={{ fontFamily: urduFontStack, lineHeight: dynamicUrduLineHeight }} className="text-black whitespace-pre-wrap block">{renderFormattedText(displayContent)}</span>
        </div>
      );
    }
    
    if (medium === 'Both') {
      return (
        <div className="grid grid-cols-2 gap-4 w-full" dir="ltr">
          <div className={containerClass} style={{ fontFamily: "'Times New Roman', serif" }}>
            {!hideCounter && <span className={counterClass}>{cEng}{suffixEng}</span>}
            <span className="pt-[0.15rem] text-black whitespace-pre-wrap block" style={{ lineHeight: dynamicLineHeight }}>{renderFormattedText(mainText)}</span>
          </div>
          {urduText && (
            <div 
              className={containerClass.replace('flex-row justify-center', 'justify-start')} 
              style={{ fontFamily: urduFontStack, lineHeight: dynamicUrduLineHeight }} 
              dir="rtl"
            >
              {!hideCounter && <span className={counterClass}>{cUrdu}{suffixUrdu}</span>}
              <span className="text-black whitespace-pre-wrap block">{renderFormattedText(urduText)}</span>
            </div>
          )}
        </div>
      );
    }

    // Default LTR
    return (
      <div className={containerClass} dir="ltr">
        {!hideCounter && <span className={counterClass}>{cEng}{suffixEng}</span>}
        <span 
          style={{ fontFamily: "'Times New Roman', serif", lineHeight: dynamicLineHeight }} 
          className={`text-black ${isParaphrase ? 'italic whitespace-pre-line max-w-[80%] border-l border-r border-black/10 px-8 py-2' : 'whitespace-pre-wrap'}`}
        >
          {renderFormattedText(mainText)}
        </span>
      </div>
    );
  };

  const renderOptionContent = (q: Question, oIdx: number) => {
    const optEng = q.options ? q.options[oIdx] : '';
    const optUrdu = q.optionsUrdu ? q.optionsUrdu[oIdx] : '';

    if (medium === 'Urdu' || (medium === 'English' && isUrduText(optEng))) {
        const display = medium === 'Urdu' ? (optUrdu || optEng) : optEng;
        return <span style={{ fontFamily: urduFontStack }} dir="rtl" className="text-black block text-right whitespace-pre-wrap">{renderFormattedText(display)}</span>;
    }

    if (medium === 'Both') {
      return (
        <div className="flex items-baseline gap-4" dir="ltr">
          <span className="text-left leading-[1.1] text-black whitespace-pre-wrap block">{renderFormattedText(optEng)}</span>
          {optUrdu && <span className="text-right text-[0.85em] text-black whitespace-pre-wrap block" style={{ fontFamily: urduFontStack, lineHeight: '1.6' }} dir="rtl">{renderFormattedText(optUrdu)}</span>}
        </div>
      );
    }

    return <span className="text-black whitespace-pre-wrap block">{renderFormattedText(optEng)}</span>;
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
  let runningMCQCounter = 0;

  // Determine if there is any MCQ section with questions
  const hasMCQWithQuestions = sections.some(s => 
    (s.type || '').toUpperCase() === 'MCQ' && 
    questions.some(q => q.targetSectionId === s.id || (!q.targetSectionId && q.type === s.type))
  );

  // Find the first non-MCQ section that has questions and occurs after an MCQ section
  let firstSubjectiveSectionId: string | null = null;
  if (hasMCQWithQuestions) {
    let foundMCQ = false;
    for (const s of sections) {
      const hasQ = questions.some(q => q.targetSectionId === s.id || (!q.targetSectionId && q.type === s.type));
      if (!hasQ) continue;
      if ((s.type || '').toUpperCase() === 'MCQ') {
        foundMCQ = true;
      } else if (foundMCQ && (s.type || '').toUpperCase() !== 'MCQ') {
        firstSubjectiveSectionId = s.id;
        break;
      }
    }
  }

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
        className="p-2 md:p-3 tex2jax_process relative overflow-visible" 
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
        {/* HEADER BLOCK */}
        {headerStyle === 'sba' ? (
          <div className="border border-black p-1 mb-2 relative z-10" style={{ borderColor: '#000000' }} dir="ltr">
            <div className="flex items-start justify-between border-b border-black pb-1 mb-1">
              {instituteProfile?.logoUrl && instituteProfile.showLogoOnPapers ? (
                <div className="w-16 h-16 flex-shrink-0 border border-black p-0.5 bg-white"><img src={instituteProfile.logoUrl} alt="Logo" className="w-full h-full object-contain" /></div>
              ) : (
                <div className="w-16 h-16 flex-shrink-0 invisible" />
              )}
              <div className="flex-grow text-center px-2 flex flex-col justify-center items-center">
                <h1 style={{ fontSize: '16px' }} className="font-bold uppercase text-black">FIRST TERM SCHOOL-BASED ASSESSMENT (SBA) 2026-27</h1>
                <h2 style={{ fontSize: '15px' }} className="font-bold text-black mt-1">GRADE-{classLevel.replace(/\D/g,'') || '8'}</h2>
                <h2 style={{ fontSize: '15px' }} className="font-bold text-black uppercase mt-1">SUBJECT: {subject}</h2>
                <p style={{ fontSize: '11px' }} className="font-bold mt-1 text-black">[{sections.map((s, i) => `Part ${String.fromCharCode(65+i)}: ${s.attemptCount * s.marksPerQuestion} Marks`).join(' ')} Total: {totalMarks} Marks]</p>
              </div>
              <div className="w-16 h-16 flex-shrink-0 flex flex-col justify-between">
                 <div className="w-14 h-14 border border-black p-0.5 ml-auto"><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkAQMAAABKLAcXAAAABlBMVEX///8AAABVwtN+AAAACXBIWXMAAA7EAAAOxAGVKw4bAAABPElEQVQ4jZXUMY6EIBQG4Ecs7OACRq9BYeKVsNtK6KabuRLJFF7DiRfAjsLw73Nnd7NTLCNUfomE5/sfEr0sCwhP3Zw6YMnKUK3ugbc0JPIacRFwDz81w1YodXcimjOi3iaa3oork72C/63zpPjbZW8e8/WnE//q2ca2Tn+aekYWF+wm6XGdZV5qoY1zQOgiV5bTuD9zEGvkE85LwW2cw5G0zIuPEndH2lRzyMuu7shhAI7KCsQzsSvMVxoCZcWjg90KLysvSzQCmzeLJqpDXlMVQ8+PqYs8SzmZxgqEVqtd874C0QcNLtVYtMxrXGpZuS4qRJ66nHhJso8oaSjS11yrVKfm2ev/xXeFE2tpIm5UgY5bvBvghpjey3NuoZqxvNUx/lzh975zOv5Z4O7eVsi8+H1Wqw3pUKKX9QnB/E40GAtouwAAAABJRU5ErkJggg==" alt="QR Code" className="w-full h-full object-contain" /></div>
              </div>
            </div>
            
            <div style={{ fontSize: '12px' }} className="grid grid-cols-[100px_1fr] gap-y-1 gap-x-2 font-bold px-1 text-black">
              <div className="text-left">School Name:</div>
              <div className="border-b border-black text-left">{instituteProfile?.instituteName || "_________________"}</div>
              <div className="text-left">Student Name :</div>
              <div className="flex gap-4">
                 <div className="flex-grow border-b border-black"></div>
                 <div className="whitespace-nowrap">Roll Number :</div>
                 <div className="w-32 border-b border-black"></div>
                 <div className="whitespace-nowrap">Section :</div>
                 <div className="w-24 border-b border-black"></div>
              </div>
            </div>
          </div>
        ) : headerStyle === 'layout3' ? (
          <div className="mb-2 relative z-10" dir="ltr">
            <div className="flex items-center justify-center mb-1 text-black border-b-[3px] border-black pb-1 gap-4">
               {instituteProfile?.logoUrl && instituteProfile.showLogoOnPapers && (
                  <div className="w-20 h-12 flex-shrink-0"><img src={instituteProfile.logoUrl} alt="Logo" className="w-full h-full object-contain" /></div>
               )}
               <h1 style={{ fontSize: '24px' }} className="font-black uppercase tracking-tighter m-0 leading-none">{instituteProfile?.instituteName || "STEP ACADEMY"}</h1>
            </div>
            
            <table className="w-full border-collapse border border-black text-black" style={{ fontSize: '11px' }}>
              <tbody>
                <tr>
                  <td className="border border-black font-bold p-1 bg-black/5 w-16">Name</td>
                  <td colSpan={2} className="border border-black p-1 w-1/3"></td>
                  <td className="border border-black font-bold p-1 bg-black/5 w-16">Batch</td>
                  <td className="border border-black p-1"></td>
                  <td className="border border-black font-bold p-1 bg-black/5 w-16">Date</td>
                  <td className="border border-black p-1 w-24"></td>
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
        ) : headerStyle === 'layout4' ? (
          <div className="border-[1.5px] border-black mb-2 relative z-10" dir="ltr">
            <div className="text-center text-black border-b-[1.5px] border-black p-1">
              <h1 style={{ fontSize: '18px' }} className="font-black uppercase m-0 leading-tight">{instituteProfile?.instituteName || "APLUS ACADEMY"}</h1>
              <p style={{ fontSize: '10px' }} className="font-bold m-0 mt-0.5">{instituteProfile?.address || ""}</p>
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
                 {instituteProfile?.logoUrl && instituteProfile.showLogoOnPapers ? (
                    <img src={instituteProfile.logoUrl} alt="Logo" className="w-16 h-16 object-contain" />
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
        ) : headerStyle === 'layout5' ? (
          <div className="border border-black mb-2 relative z-10" dir="ltr">
             <div className="flex border-b border-black">
                <div className="w-[20%] p-1 flex items-center justify-center border-r border-black">
                   {instituteProfile?.logoUrl && instituteProfile.showLogoOnPapers ? (
                      <img src={instituteProfile.logoUrl} alt="Logo" className="w-16 h-12 object-contain" />
                   ) : (
                      <div className="text-[10px] font-bold text-black/30">LOGO</div>
                   )}
                </div>
                <div className="w-[80%] text-center p-1 flex flex-col justify-center items-center text-black">
                   <h1 style={{ fontSize: '18px' }} className="font-bold m-0 leading-tight">{instituteProfile?.instituteName || "ACADEMY NAME"}</h1>
                   <p style={{ fontSize: '10px' }} className="font-bold m-0 mt-0.5">{instituteProfile?.address || ""}</p>
                   {instituteProfile?.showContactOnPapers && <p style={{ fontSize: '10px' }} className="font-bold m-0">{instituteProfile?.contactNumber}</p>}
                </div>
             </div>
             
             <table className="w-full border-collapse text-black" style={{ fontSize: '11px' }}>
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
        ) : headerStyle === 'layout6' ? (
          <div className="border-[2px] border-black p-2 mb-2 relative z-10" dir="ltr">
             <div className="flex items-center justify-center mb-1 text-black pb-1 gap-4">
                {instituteProfile?.logoUrl && instituteProfile.showLogoOnPapers && (
                   <div className="w-16 h-16 flex-shrink-0 border border-black p-1"><img src={instituteProfile.logoUrl} alt="Logo" className="w-full h-full object-contain" /></div>
                )}
                <div className="flex flex-col items-center">
                   <h1 style={{ fontSize: '20px' }} className="font-black uppercase m-0 leading-none tracking-wider">{instituteProfile?.instituteName || "INSTITUTE NAME"}</h1>
                   <p style={{ fontSize: '11px' }} className="font-bold m-0 mt-1">{instituteProfile?.address || ""}</p>
                </div>
             </div>
             <div style={{ fontSize: '11px' }} className="flex justify-between border-t-[2px] border-black pt-1 font-bold text-black uppercase">
                <span>Class: {classLevel}</span>
                <span>Subject: {subject}</span>
                <span>Time: {timeAllowed}</span>
                <span>Marks: {totalMarks}</span>
             </div>
          </div>
        ) : headerStyle === 'layout7' ? (
          <div className="mb-2 relative z-10" dir="ltr">
             <div className="flex justify-between items-end border-b-2 border-black pb-1 text-black">
                <div className="flex flex-col">
                   <h1 style={{ fontSize: '22px' }} className="font-black uppercase m-0 leading-none">{instituteProfile?.instituteName || "ACADEMY NAME"}</h1>
                   <p style={{ fontSize: '12px' }} className="font-bold m-0 mt-1 tracking-wide">{instituteProfile?.address || "Address of the institute"}</p>
                </div>
                {instituteProfile?.logoUrl && instituteProfile.showLogoOnPapers && (
                   <div className="w-14 h-14 flex-shrink-0"><img src={instituteProfile.logoUrl} alt="Logo" className="w-full h-full object-contain" /></div>
                )}
             </div>
             <div style={{ fontSize: '12px' }} className="grid grid-cols-[auto_1fr_auto_1fr] gap-x-4 gap-y-2 pt-2 font-bold text-black">
                <div>Name:</div><div className="border-b border-black"></div>
                <div>Class:</div><div className="border-b border-black flex items-center">{classLevel}</div>
                <div>Subject:</div><div className="border-b border-black flex items-center uppercase">{subject}</div>
                <div>Date:</div><div className="border-b border-black"></div>
             </div>
          </div>
        ) : headerStyle === 'layout8' ? (
          <div className="mb-3 relative z-10 border border-black rounded-xl overflow-hidden" dir="ltr">
             <div className="bg-black text-white p-2 flex justify-between items-center">
                <div className="flex flex-col">
                   <h1 style={{ fontSize: '18px' }} className="font-black uppercase m-0 leading-none">{instituteProfile?.instituteName || "INSTITUTE"}</h1>
                   <p style={{ fontSize: '9px' }} className="font-normal m-0 mt-0.5">{instituteProfile?.address || "Campus Address"}</p>
                </div>
                <div className="text-right flex flex-col">
                   <span style={{ fontSize: '14px' }} className="font-bold uppercase">{subject}</span>
                   <span style={{ fontSize: '10px' }}>Max Marks: {totalMarks}</span>
                </div>
             </div>
             <div style={{ fontSize: '11px' }} className="p-2 bg-white text-black flex justify-between font-bold">
                <span className="flex-1 flex gap-2">Name: <span className="border-b border-black flex-1 mr-4"></span></span>
                <span>Class: {classLevel}</span>
             </div>
          </div>
        ) : (
          <div className="border-b-2 pb-0.5 z-10 relative print:mt-0" style={{ borderColor: '#000000' }} dir="ltr">
            <div className="flex items-center justify-between mb-0.5">
              {instituteProfile?.logoUrl && instituteProfile.showLogoOnPapers ? (
                <div className={`${styles.logoSize} flex-shrink-0`}><img src={instituteProfile.logoUrl} alt="Logo" className="w-full h-full object-contain" /></div>
              ) : (
                <div className={`${styles.logoSize} flex-shrink-0 invisible`} />
              )}
              <div className="flex-grow text-center px-1">
                <h1 style={{ fontSize: styles.headerTitle }} className="font-bold uppercase tracking-tight leading-none mb-0.5 text-black">{instituteProfile?.instituteName || "INSTITUTE NAME"}</h1>
                <p style={{ fontSize: styles.headerInfo }} className="flex items-center justify-center gap-2 leading-none opacity-80 text-black">
                  <span>{instituteProfile?.address}</span>
                  {instituteProfile?.showContactOnPapers && <><span className="opacity-30">|</span><span className="font-semibold">{instituteProfile?.contactNumber}</span></>}
                </p>
              </div>
              <div className={`${styles.logoSize} flex-shrink-0 invisible`} aria-hidden="true" />
            </div>
            
            <div style={{ fontSize: styles.headerInfo, borderTop: '1px solid #000000' }} className="flex justify-between items-center font-bold pt-0.5 px-1 uppercase tracking-tighter text-black">
              <span>Class: <span className="font-normal">{classLevel}</span></span>
              <span>Subject: <span className="font-normal">{subject}</span></span>
              <span>Time: <span className="font-normal">{timeAllowed}</span></span>
              <div className="flex gap-2">
                <span>Total Marks: <span className="font-normal">{totalMarks}</span></span>
                {paperCode && <span>Paper Code: <span className="font-bold border-2 px-1 py-0 rounded ml-0.5" style={{ borderColor: '#000000' }}>{paperCode}</span></span>}
              </div>
            </div>
            
            <div style={{ fontSize: styles.headerInfo, borderTop: '1px solid #000000' }} className="flex justify-between items-center font-bold mt-0.5 pt-0.5 px-1 text-black">
              <span>Student: __________________________</span>
              <div className="flex gap-4">
                <span>Roll No: ________</span>
                {chaptersDisplay && <span>CH: <span className="font-normal">{chaptersDisplay}</span></span>}
              </div>
            </div>
          </div>
        )}

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
              const actualHeading = section.heading && section.heading !== 'None' 
                  ? section.heading 
                  : `Section ${String.fromCharCode(65 + idx)}`;
                  
              const prevActualHeading = idx > 0 
                  ? (sections[idx-1].heading && sections[idx-1].heading !== 'None' ? sections[idx-1].heading : `Section ${String.fromCharCode(65 + idx - 1)}`) 
                  : null;
                  
              const showHeading = actualHeading !== prevActualHeading;
              
              const isIdioms = section.type === 'Idioms';
              const isSentences = section.type === 'Sentences';
              const isVoice = section.type === 'Voice';
              const isGridSection = isIdioms || isSentences || isVoice;
              
              // 🔹 Detect if section content is Urdu for English papers
              const containsUrdu = sectionQuestions.some(q => isUrduText(q.text) || (q.textUrdu && isUrduText(q.textUrdu)));
              const gridDir = (medium === 'Urdu' || containsUrdu) ? 'rtl' : 'ltr';

              const gridCols = isIdioms ? 'grid-cols-4' : ((isSentences || isVoice) ? 'grid-cols-3' : ''); 

              const skipNumbering = (section as any).hideMainNumbering || Boolean(section.title && section.title.match(/^[Q|سوال]/));

              // 🔹 DYNAMIC FONT SIZE RESOLUTION
              const customTitleSize = section.titleFontSize ? `${section.titleFontSize}px` : styles.sectionTitle;
              const isBreakSection = Boolean(pageBreakAfterMCQ && section.id === firstSubjectiveSectionId);
              const secHeaderBlockId = `sec-header-${idx}`;
              const secHeaderBreak = pageBreakMap[secHeaderBlockId];

              return (
                <React.Fragment key={section.id || idx}>
                  {secHeaderBreak && (
                    <PageBoundaryBanner
                      endedPage={secHeaderBreak.endedPage}
                      nextPage={secHeaderBreak.nextPage}
                      isManual={secHeaderBreak.isManual}
                    />
                  )}
                  <div 
                    style={{ 
                      marginBottom: sectionMarginBottom,
                      ...(isBreakSection ? { pageBreakBefore: 'always', breakBefore: 'page' } : {})
                    }}
                    className={isBreakSection ? 'page-break-before print:pt-4' : ''}
                  >
                    <div
                      data-block-id={secHeaderBlockId}
                      data-manual-break={isBreakSection ? 'true' : 'false'}
                    >
                      {showHeading && (
                        <div className={`text-center mt-3 mb-1 font-bold tracking-widest py-0.5 text-black ${isUrduText(actualHeading) ? 'font-urdu' : ''}`} style={{ fontSize: `calc(${styles.sectionTitle} * 1.2)` }} dir={isUrduText(actualHeading) ? "rtl" : "ltr"}>
                          ( {renderFormattedText(actualHeading)} {medium === 'Both' && translateHeadingToUrdu(actualHeading) ? `/ ${translateHeadingToUrdu(actualHeading)}` : ''} )
                        </div>
                      )}
                    </div>
                  
                  <div className="border-[1.5px] border-black p-1 rounded-sm">
                    {/* 🔹 LANGUAGE-AWARE SECTION HEADING WITH AUTO MARKS */}
                    {Boolean(section.title?.trim() || section.titleUrdu?.trim()) && (
                    <div style={{ fontSize: customTitleSize }} className="font-bold mb-1 border-b-[1.5px] border-black pb-0 text-black">
                       {medium === 'Both' && section.titleUrdu ? (
                        <div className="flex flex-col w-full">
                           {/* 🔹 3-COLUMN GRID: English (Left) | Marks (Center) | Urdu (Right) */}
                           <div className="grid grid-cols-[1fr_auto_1fr] items-end border-b border-gray-100 pb-0.5 gap-2">
                              <div className="text-left" dir="ltr">
                                 <h3 className="uppercase whitespace-pre-wrap">{renderFormattedText(section.title)}</h3>
                              </div>
                              <div className="text-center font-bold whitespace-nowrap px-2" dir="ltr">
                                 {getMarksCalc(section, false)}
                              </div>
                              <div className="text-right font-urdu whitespace-pre-wrap" dir="rtl">
                                 {renderFormattedText(section.titleUrdu)}
                              </div>
                           </div>
                        </div>
                     ) : medium === 'Urdu' ? (
                        <div className="flex justify-between items-end font-urdu" dir="rtl">
                          <h3 className="uppercase whitespace-pre-wrap">{renderFormattedText(section.titleUrdu || section.title)}</h3>
                          <div className="font-sans font-bold" dir="ltr">
                            {getMarksCalc(section, true)}
                          </div>
                        </div>
                     ) : (
                        <div className="flex justify-between items-end" dir="ltr">
                          <h3 className="uppercase whitespace-pre-wrap">{renderFormattedText(section.title)}</h3>
                          <div className="font-bold">
                            {getMarksCalc(section, false)}
                          </div>
                        </div>
                     )}
                  </div>
                  )}
                  
                  {section.type === 'MCQ' ? (
                    <div className="grid grid-cols-1 text-black" style={{ gap: mcqGapValue }}>
                      {section.subParts && section.subParts.length > 0 ? (
                        section.subParts.map((part, pIdx) => {
                           const start = section.subParts!.slice(0, pIdx).reduce((acc, p) => acc + (p.questionCount || 0), 0);
                           const partQuestions = sectionQuestions.slice(start, start + (part.questionCount || 0));
                           if (partQuestions.length === 0) return null;
                           const isPartUrdu = isUrduText(part.label);
                           return (
                             <div key={pIdx} className="mb-4">
                                <div style={{ fontSize: styles.questionText }} className={`font-bold italic mb-2 opacity-90 border-l-4 border-black pl-2 text-black ${isPartUrdu ? 'font-urdu text-right border-l-0 border-r-4 pr-2' : ''}`} dir={isPartUrdu ? 'rtl' : 'ltr'}>{renderFormattedText(part.label)}</div>
                                {partQuestions.map((q) => {
                                  runningMCQCounter++;
                                  const qBlockId = `mcq-${idx}-${pIdx}-${q.id}-${runningMCQCounter}`;
                                  const qBreak = pageBreakMap[qBlockId];
                                  return (
                                    <React.Fragment key={q.id}>
                                      {qBreak && (
                                        <PageBoundaryBanner
                                          endedPage={qBreak.endedPage}
                                          nextPage={qBreak.nextPage}
                                          isManual={qBreak.isManual}
                                        />
                                      )}
                                      <div data-block-id={qBlockId} style={{ fontSize: styles.questionText, paddingBottom: mcqPaddingBottom, marginBottom: mcqMarginBottom }} className="break-inside-avoid">
                                        <div className="font-semibold w-full text-black">{renderQuestionText(q, runningMCQCounter)}</div>
                                        {/* 🔹 DYNAMIC OPTIONS LAYOUT: ONE LINE FOR SINGLE MEDIUM */}
                                        <div 
                                          className={`${medium === 'Both' ? `grid ${styles.optionGrid}` : 'flex flex-wrap gap-x-8'} ${baseDir === 'rtl' ? 'pr-4' : 'pl-4'} mt-0`} 
                                          dir={baseDir}
                                        >
                                          {q.options?.map((_, oIdx) => (
                                            <div key={oIdx} style={{ fontSize: styles.optionText }} className="flex items-start gap-1">
                                              <span className="font-bold text-black">({String.fromCharCode(97 + oIdx)})</span> 
                                              <div className="flex-grow">{renderOptionContent(q, oIdx)}</div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </React.Fragment>
                                  );
                                })}
                             </div>
                           );
                        })
                      ) : (
                        sectionQuestions.map((q) => {
                          runningMCQCounter++;
                          const qBlockId = `mcq-${idx}-${q.id}-${runningMCQCounter}`;
                          const qBreak = pageBreakMap[qBlockId];
                          return (
                            <React.Fragment key={q.id}>
                              {qBreak && (
                                <PageBoundaryBanner
                                  endedPage={qBreak.endedPage}
                                  nextPage={qBreak.nextPage}
                                  isManual={qBreak.isManual}
                                />
                              )}
                              <div data-block-id={qBlockId} style={{ fontSize: styles.questionText, paddingBottom: mcqPaddingBottom, marginBottom: mcqMarginBottom }} className="break-inside-avoid">
                                <div className="font-semibold w-full text-black">{renderQuestionText(q, runningMCQCounter)}</div>
                                {/* 🔹 DYNAMIC OPTIONS LAYOUT: ONE LINE FOR SINGLE MEDIUM */}
                                <div 
                                  className={`${medium === 'Both' ? `grid ${styles.optionGrid}` : 'flex flex-wrap gap-x-8'} ${baseDir === 'rtl' ? 'pr-4' : 'pl-4'} mt-0`} 
                                  dir={baseDir}
                                >
                                  {q.options?.map((_, oIdx) => (
                                    <div key={oIdx} style={{ fontSize: styles.optionText }} className="flex items-start gap-1">
                                      <span className="font-bold text-black">({String.fromCharCode(97 + oIdx)})</span> 
                                      <div className="flex-grow">{renderOptionContent(q, oIdx)}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </React.Fragment>
                          );
                        })
                      )}
                    </div>
                  ) : (
                    <div className={isGridSection ? `grid ${gridCols} gap-x-4 gap-y-1` : 'text-black'} dir={gridDir}>
                      {Array.from({ length: Math.floor(sectionQuestions.length / ((section.subParts && section.subParts.length > 0) ? section.subParts.length : 1)) }).map((_, qIdx) => {
                        localQuestionCounter++;
                        const partsPerQuestion = (section.subParts && section.subParts.length > 0) ? section.subParts.length : 1;
                        const startIndex = qIdx * partsPerQuestion;
                        
                        const counterLabel = isIdioms 
                          ? `${toRoman(localQuestionCounter)}.` 
                          : ((isSentences || isVoice) ? `(${toRoman(localQuestionCounter)})` : localQuestionCounter);

                        const qBlockId = `q-${idx}-${qIdx}`;
                        const qBreak = pageBreakMap[qBlockId];

                        return (
                          <React.Fragment key={qIdx}>
                            {qBreak && (
                              <PageBoundaryBanner
                                endedPage={qBreak.endedPage}
                                nextPage={qBreak.nextPage}
                                isManual={qBreak.isManual}
                              />
                            )}
                            <div 
                              data-block-id={qBlockId}
                              className="break-inside-avoid" 
                              style={{ 
                                paddingBottom: isGridSection ? '0px' : questionPaddingBottom, 
                                marginBottom: isGridSection ? '0px' : questionMarginBottom 
                              }}
                            >
                            {section.subParts && section.subParts.length > 0 ? (
                               <div className="space-y-0">
                                  {!skipNumbering && section.type.toUpperCase() !== 'LONG' && <div className="font-bold text-black" style={{ fontSize: styles.questionText }}>{localQuestionCounter}.</div>}
                                  
                                  {section.type === 'Passage' && (
                                     <div className="font-bold underline ml-4 mb-2 mt-4 text-[0.9em] text-black" style={{ fontSize: styles.questionText }}>Questions:</div>
                                  )}

                                  <div className={`${(skipNumbering || baseDir === 'rtl' || gridDir === 'rtl') ? 'pr-0' : 'pl-4'} space-y-0`}>
                                    {section.subParts.map((part, pIdx) => {
                                      const qPart = sectionQuestions[startIndex + pIdx];
                                      if (!qPart) return null;
                                      
                                      const isParaphrase = part.type === 'Paraphrase';
                                      const qWithMeta = { ...qPart, isParaphrase } as any;

                                      const isLong = section.type.toUpperCase() === 'LONG';
                                      const subLabel = (section as any).hideSubPartNumbering ? "" : part.label;
                                      
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
                                            <div className="w-full text-center my-3 font-black italic uppercase tracking-[0.4em] text-black" style={{ fontSize: `calc(${styles.questionText} * 0.95)` }}>(OR)</div>
                                          )}
                                          <div style={{ fontSize: styles.questionText, marginBottom: lineSpacing < 0 ? `${lineSpacing * 1.5}px` : undefined }} className={`flex gap-1.5 items-start ${part.isAlternative ? 'mt-1' : 'opacity-90'}`}>
                                             <div className="flex-grow">
                                                {renderQuestionText(qWithMeta, part.isAlternative ? "" : counter, undefined, undefined, part.isAlternative || (section as any).hideSubPartNumbering, isGridSection)}
                                             </div>
                                             {!section.hideSubPartMarks && <span className="text-[0.8em] font-bold whitespace-nowrap ml-4 text-black">({part.marks})</span>}
                                          </div>
                                        </React.Fragment>
                                      );
                                    })}
                                  </div>
                               </div>
                            ) : (
                               <div style={{ fontSize: styles.questionText }} className="w-full flex justify-between items-start">
                                 <div className="flex-grow">
                                   {renderQuestionText(sectionQuestions[startIndex], counterLabel, undefined, undefined, false, isGridSection)}
                                 </div>
                                 {!section.hideSubPartMarks && (subject || '').toLowerCase().includes('english') && !isGridSection && <span className="text-[0.8em] font-bold ml-4 text-black">({section.marksPerQuestion})</span>}
                               </div>
                            )}
                          </div>
                          </React.Fragment>
                        );
                      })}
                    </div>
                  )}
                  </div>
                </div>
              </React.Fragment>
            );
          })
          )}
        </div>

        {showAnswerKey && hasQuestions && (
          <div className="mt-1 border-t border-dashed border-gray-400 pt-0.5 break-inside-avoid z-10 relative page-break-before text-black" dir="ltr">
            <div className="text-center mb-0.5"><h3 className="font-extrabold text-xs uppercase border-b inline-block px-2 text-black" style={{ borderColor: '#000000' }}>Key</h3></div>
            <div className="grid grid-cols-6 sm:grid-cols-10 gap-1 text-[8px]">
              {questions.map((q, qKeyIdx) => (
                <div key={q.id} className="flex items-center justify-between border-b border-gray-100 py-0 px-0.5">
                  <span className="font-bold text-black">Q.{qKeyIdx + 1}</span>
                  <span className="font-mono font-bold text-black">[{q.correctAnswer || '-'}]</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div data-block-id="paper-footer-block" className="pt-1 border-t border-gray-200 mt-4 z-10 relative" dir="ltr">
          <div className="flex justify-between text-[6px] text-gray-400 uppercase font-bold mb-1">
            <span>Aplus ExamGen • v1.0.3</span>
            <span>By: Nauman Ali</span>
          </div>
          <div className="text-center text-[9px] text-gray-500 font-medium">
            Generated by <a href="https://aplusexamgen.netlify.app" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline decoration-blue-600/30">https://aplusexamgen.netlify.app</a>
          </div>
        </div>

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