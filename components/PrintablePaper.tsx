import React, { useEffect } from 'react';
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
  chaptersDisplay
}) => {

  useEffect(() => {
    // Re-run MathJax whenever questions, subject, or font size changes
    const s = (subject || '').toLowerCase();
    if (s.includes('math') || s.includes('hisab')) {
      if (window.MathJax && window.MathJax.typesetPromise) {
        window.MathJax.typesetPromise();
      }
    }
  }, [questions, subject, showAnswerKey, medium, baseFontSize]);

  const getLayoutStyles = (mode: number, baseSize: number) => {
    // Clamp baseSize to maximum 13 for safety in print logic
    const safeBaseSize = Math.min(baseSize || 13, 13);
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
  
  // Dynamic Spacing Calculation (mapped from 0-10 scale)
  const verticalMargin = `${(lineSpacing * 0.1) + 0.05}rem`;
  const mcqGapValue = `${(lineSpacing * 0.05)}rem`;

  // CRITICAL: baseDir follows MEDIUM, not SUBJECT. 
  const baseDir = (medium === 'Urdu') ? 'rtl' : 'ltr';

  const renderQuestionText = (q: Question, counter?: string | number, textOverride?: string, urduOverride?: string, hideCounter: boolean = false, centerAlign: boolean = false) => {
    const mainText = textOverride || q.text || '';
    const urduText = urduOverride || q.textUrdu || q.text || '';
    const suffix = counter ? (typeof counter === 'number' ? '.' : '') : '';
    
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
          {!hideCounter && <span className={counterClass} style={{ fontFamily: urduFontStack }}>{counter}{suffix}</span>}
          <span style={{ fontFamily: urduFontStack }} className="text-black whitespace-pre-wrap block">{renderFormattedText(displayContent)}</span>
        </div>
      );
    }
    
    if (medium === 'Both') {
      return (
        <div className="grid grid-cols-2 gap-4 w-full" dir="ltr">
          <div className={containerClass} style={{ fontFamily: "'Times New Roman', serif" }}>
            {!hideCounter && <span className={counterClass}>{counter}{suffix}</span>}
            <span className="pt-[0.15rem] leading-[1.1] text-black whitespace-pre-wrap block">{renderFormattedText(mainText)}</span>
          </div>
          {urduText && (
            <div 
              className={containerClass.replace('flex-row justify-center', 'justify-start')} 
              style={{ fontFamily: urduFontStack, lineHeight: '1.8' }} 
              dir="rtl"
            >
              {!hideCounter && <span className={counterClass}>{counter}{suffix}</span>}
              <span className="text-black whitespace-pre-wrap block">{renderFormattedText(urduText)}</span>
            </div>
          )}
        </div>
      );
    }

    // Default LTR
    return (
      <div className={containerClass} dir="ltr">
        {!hideCounter && <span className={counterClass}>{counter}{suffix}</span>}
        <span 
          style={{ fontFamily: "'Times New Roman', serif" }} 
          className={`text-black ${isParaphrase ? 'italic whitespace-pre-line leading-relaxed max-w-[80%] border-l border-r border-black/10 px-8 py-2' : 'whitespace-pre-wrap'}`}
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
        <div className="grid grid-cols-2 gap-2 w-full" dir="ltr">
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

  return (
    <div className="print-container">
      <div 
        id="printable-section"
        className="p-2 md:p-3 tex2jax_process relative overflow-visible" 
        style={{ 
          backgroundColor: '#ffffff', 
          color: '#000000',           
          fontFamily: fontFamily, 
          lineHeight: (medium === 'Urdu') ? '1.7' : '1.1', 
          boxSizing: 'border-box', 
          paddingBottom: '3mm', 
          width: '100%', 
          margin: '0 auto' 
        }}
        dir="ltr"
      >
        {/* HEADER BLOCK */}
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

        {/* QUESTIONS ENGINE */}
        <div className="z-10 relative mt-0.5" dir={baseDir}>
          {!hasQuestions ? (
            <div className="flex items-center justify-center h-24 text-gray-400 border border-dashed border-gray-300 rounded m-1"><p className="font-bold text-sm">No questions selected.</p></div>
          ) : (
            sections.map((section, idx) => {
              const sectionQuestions = questions.filter(q => q.targetSectionId === section.id || (!q.targetSectionId && q.type === section.type));
              if (sectionQuestions.length === 0) return null;
              
              let localQuestionCounter = 0;
              const prevHeading = idx > 0 ? sections[idx-1].heading : null;
              const showHeading = section.heading && section.heading !== 'None' && prevHeading !== section.heading;
              
              const isIdioms = section.type === 'Idioms';
              const isSentences = section.type === 'Sentences';
              const isVoice = section.type === 'Voice';
              const isGridSection = isIdioms || isSentences || isVoice;
              
              // 🔹 Detect if section content is Urdu for English papers
              const containsUrdu = sectionQuestions.some(q => isUrduText(q.text) || (q.textUrdu && isUrduText(q.textUrdu)));
              const gridDir = (medium === 'Urdu' || containsUrdu) ? 'rtl' : 'ltr';

              const gridCols = isIdioms ? 'grid-cols-4' : ((isSentences || isVoice) ? 'grid-cols-3' : ''); 

              const skipNumbering = (section as any).hideMainNumbering || section.title.match(/^[Q|سوال]/);

              // 🔹 DYNAMIC FONT SIZE RESOLUTION
              const customTitleSize = section.titleFontSize ? `${section.titleFontSize}px` : styles.sectionTitle;

              return (
                <div key={idx} className="break-inside-avoid" style={{ marginBottom: verticalMargin }}>
                  {showHeading && (
                    <div className={`text-center mt-3 mb-2 font-bold uppercase tracking-[0.3em] py-0.5 text-black border-t border-b border-black/10 ${isUrduText(section.heading!) ? 'font-urdu' : ''}`} style={{ fontSize: `calc(${styles.sectionTitle} * 0.9)` }} dir={isUrduText(section.heading!) ? "rtl" : "ltr"}>
                      {renderFormattedText(section.heading!)}
                    </div>
                  )}
                  
                  {/* 🔹 LANGUAGE-AWARE SECTION HEADING WITH AUTO MARKS */}
                  <div style={{ fontSize: customTitleSize }} className="font-bold mb-1 border-b border-gray-300 pb-0 text-black">
                     {medium === 'Both' && section.titleUrdu ? (
                        <div className="flex flex-col w-full">
                           {/* 🔹 3-COLUMN GRID: English (Left) | Marks (Center) | Urdu (Right) */}
                           <div className="grid grid-cols-[1fr_auto_1fr] items-end border-b border-gray-100 pb-0.5 gap-2">
                              <div className="text-left" dir="ltr">
                                 <h3 className="uppercase">{renderFormattedText(section.title)}</h3>
                              </div>
                              <div className="text-center font-bold whitespace-nowrap px-2" dir="ltr">
                                 {getMarksCalc(section, false)}
                              </div>
                              <div className="text-right font-urdu" dir="rtl">
                                 {renderFormattedText(section.titleUrdu)}
                              </div>
                           </div>
                        </div>
                     ) : medium === 'Urdu' ? (
                        <div className="flex justify-between items-end font-urdu" dir="rtl">
                          <h3 className="uppercase">{renderFormattedText(section.titleUrdu || section.title)}</h3>
                          <div className="font-sans font-bold" dir="ltr">
                            {getMarksCalc(section, true)}
                          </div>
                        </div>
                     ) : (
                        <div className="flex justify-between items-end" dir="ltr">
                          <h3 className="uppercase">{renderFormattedText(section.title)}</h3>
                          <div className="font-bold">
                            {getMarksCalc(section, false)}
                          </div>
                        </div>
                     )}
                  </div>
                  
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
                                  return (
                                    <div key={q.id} style={{ fontSize: styles.questionText, marginBottom: mcqGapValue }} className="break-inside-avoid">
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
                                  );
                                })}
                             </div>
                           );
                        })
                      ) : (
                        sectionQuestions.map((q) => {
                          runningMCQCounter++;
                          return (
                            <div key={q.id} style={{ fontSize: styles.questionText, marginBottom: mcqGapValue }} className="break-inside-avoid">
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

                        return (
                          <div key={qIdx} className="break-inside-avoid" style={{ marginBottom: isGridSection ? '0' : verticalMargin }}>
                            {section.subParts && section.subParts.length > 0 ? (
                               <div className="space-y-0">
                                  {!skipNumbering && <div className="font-bold text-black" style={{ fontSize: styles.questionText }}>{localQuestionCounter}.</div>}
                                  
                                  {section.type === 'Passage' && (
                                     <div className="font-bold underline ml-4 mb-2 mt-4 text-[0.9em] text-black" style={{ fontSize: styles.questionText }}>Questions:</div>
                                  )}

                                  <div className={`${(skipNumbering || baseDir === 'rtl' || gridDir === 'rtl') ? 'pr-0' : 'pl-4'} space-y-0`}>
                                    {section.subParts.map((part, pIdx) => {
                                      const qPart = sectionQuestions[startIndex + pIdx];
                                      if (!qPart) return null;
                                      
                                      const isParaphrase = part.type === 'Paraphrase';
                                      const qWithMeta = { ...qPart, isParaphrase } as any;

                                      return (
                                        <React.Fragment key={pIdx}>
                                          {part.isAlternative && pIdx > 0 && (
                                            <div className="w-full text-center my-3 font-black italic uppercase tracking-[0.4em] text-black" style={{ fontSize: `calc(${styles.questionText} * 0.95)` }}>(OR)</div>
                                          )}
                                          <div style={{ fontSize: styles.questionText }} className={`flex gap-1.5 items-start ${part.isAlternative ? 'mt-1' : 'opacity-90'}`}>
                                             <div className="flex-grow">
                                                {renderQuestionText(qWithMeta, part.isAlternative ? "" : ((section as any).hideSubPartNumbering ? "" : renderFormattedText(part.label) as unknown as string), undefined, undefined, part.isAlternative || (section as any).hideSubPartNumbering, isGridSection)}
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
                        );
                      })}
                    </div>
                  )}
                </div>
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

        <div className="pt-0.5 border-t border-gray-200 text-center text-[6px] text-gray-400 mt-2 z-10 relative flex justify-between uppercase font-bold" dir="ltr">
          <span>Aplus ExamGen • v1.0.3</span>
          <span>By: Nauman Ali</span>
        </div>
      </div>
    </div>
  );
};