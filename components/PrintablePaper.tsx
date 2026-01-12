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
  timeAllowed?: string;
  paperCode?: string;
}

declare global {
  interface Window {
    MathJax: any;
  }
}

export const PrintablePaper: React.FC<PrintablePaperProps> = ({
  instituteProfile,
  classLevel,
  subject,
  totalMarks,
  sections,
  questions,
  layoutMode,
  medium = 'English',
  showAnswerKey = false,
  baseFontSize = 13,
  timeAllowed = '2:00 Hours',
  paperCode
}) => {

  useEffect(() => {
    // Re-run MathJax whenever questions, subject, or font size changes
    if (subject.toLowerCase().includes('math') || subject.toLowerCase().includes('hisab')) {
      if (window.MathJax && window.MathJax.typesetPromise) {
        window.MathJax.typesetPromise();
      }
    }
  }, [questions, subject, showAnswerKey, medium, baseFontSize]);

  const getLayoutStyles = (mode: number, baseSize: number) => {
    // Clamp baseSize to maximum 13 for safety in print logic
    const safeBaseSize = Math.min(baseSize, 13);
    const scale = safeBaseSize / 12;

    switch (mode) {
      case 2:
        return {
          headerTitle: '14px',
          headerInfo: '10px',
          sectionTitle: `${Math.round(11 * scale)}px`,
          questionText: `${Math.round(10 * scale)}px`,
          optionText: `${Math.round(9 * scale)}px`,
          spacing: 'space-y-0',
          logoSize: 'w-8 h-8',
          mcqGap: 'gap-y-0',
          optionGrid: 'grid-cols-2 gap-0'
        };
      default:
        return {
          headerTitle: '18px',
          headerInfo: '11px',
          sectionTitle: `${Math.round(15 * scale)}px`,
          questionText: `${safeBaseSize}px`,
          optionText: `${Math.round(12 * scale)}px`,
          spacing: 'space-y-0',
          logoSize: 'w-14 h-14',
          mcqGap: 'gap-y-0',
          optionGrid: 'grid-cols-4 gap-1'
        };
    }
  };

  const urduFontStack = "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif";

  const getFontFamily = (subj: string) => {
    const s = subj.toLowerCase();
    // Only use Urdu font as default if the medium is Urdu
    if (medium === 'Urdu') return urduFontStack;
    
    if (s.includes('math') || s.includes('calc')) {
      return "'Cambria Math', 'Times New Roman', serif";
    }
    return "'Times New Roman', serif";
  };

  const styles = getLayoutStyles(layoutMode, baseFontSize);
  const fontFamily = getFontFamily(subject);
  
  // CRITICAL: baseDir follows MEDIUM, not SUBJECT. 
  const baseDir = (medium === 'Urdu') ? 'rtl' : 'ltr';

  const renderQuestionText = (q: Question, counter?: string | number, textOverride?: string, urduOverride?: string) => {
    const mainText = textOverride || q.text;
    const urduText = urduOverride || q.textUrdu || q.text;
    const suffix = counter ? (typeof counter === 'number' ? '.' : '') : '';

    if (medium === 'Urdu') {
      return (
        <div className="flex gap-2 items-start" dir="rtl">
          <span className="font-bold whitespace-nowrap">{counter}{suffix}</span>
          <span style={{ fontFamily: urduFontStack }}>{urduText}</span>
        </div>
      );
    }
    
    if (medium === 'Both') {
      return (
        <div className="flex w-full items-start gap-4" dir="ltr">
          {/* English Side */}
          <div className="flex-1 text-left flex gap-1.5" style={{ fontFamily: "'Times New Roman', serif" }}>
            <span className="font-bold whitespace-nowrap">{counter}{suffix}</span>
            <span>{mainText}</span>
          </div>
          {/* Urdu Side */}
          {urduText && (
            <div 
              className="flex-1 text-right flex gap-1.5 justify-start items-start" 
              style={{ fontFamily: urduFontStack, lineHeight: '1.8' }} 
              dir="rtl"
            >
              <span className="font-bold whitespace-nowrap">{counter}{suffix}</span>
              <span>{urduText}</span>
            </div>
          )}
        </div>
      );
    }

    // Default: English Medium
    return (
      <div className="flex gap-1.5 items-start" dir="ltr">
        <span className="font-bold whitespace-nowrap">{counter}{suffix}</span>
        <span style={{ fontFamily: "'Times New Roman', serif" }}>{mainText}</span>
      </div>
    );
  };

  const renderOptionContent = (q: Question, oIdx: number) => {
    const optEng = q.options ? q.options[oIdx] : '';
    const optUrdu = q.optionsUrdu ? q.optionsUrdu[oIdx] : '';

    if (medium === 'Urdu') {
      return <span style={{ fontFamily: urduFontStack }} dir="rtl">{optUrdu || optEng}</span>;
    }

    if (medium === 'Both') {
      return (
        <div className="flex w-full items-start justify-between gap-2" dir="ltr">
          <span className="flex-1 text-left" style={{ fontFamily: "'Times New Roman', serif" }}>{optEng}</span>
          {optUrdu && (
            <span 
              className="flex-1 text-right text-[0.85em]" 
              style={{ fontFamily: urduFontStack, lineHeight: '1.6' }} 
              dir="rtl"
            >
              {optUrdu}
            </span>
          )}
        </div>
      );
    }

    return <span style={{ fontFamily: "'Times New Roman', serif" }}>{optEng}</span>;
  };

  const hasQuestions = questions.length > 0;
  let globalAnswerKeyCounter = 0;

  return (
    <div className="print-container">
      {/* 🔹 LOGO WATERMARK FOR PRINT (Repeats on every page due to fixed positioning in CSS) */}
      <div className="print-watermark hidden print:flex">
        {instituteProfile?.logoUrl ? (
          <img 
            src={instituteProfile.logoUrl} 
            alt="Watermark" 
            className="w-2/3 max-w-[300px] object-contain opacity-[0.05] grayscale"
          />
        ) : (
          <div className="text-watermark">
            {instituteProfile?.instituteName || "APLUS EXAMGEN"}
          </div>
        )}
      </div>

      <div 
        id="printable-section"
        className={`${styles.spacing} p-2 md:p-3 tex2jax_process relative overflow-visible`} 
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
        {/* 🔹 LOGO WATERMARK FOR PREVIEW */}
        <div 
          className="absolute inset-0 pointer-events-none z-0 print:hidden overflow-hidden"
          style={{ opacity: 0.05 }}
        >
          <div className="sticky top-1/2 left-0 w-full flex items-center justify-center -translate-y-1/2 h-[50vh]">
             {instituteProfile?.logoUrl ? (
                <img 
                  src={instituteProfile.logoUrl} 
                  alt="Preview Watermark" 
                  className="w-2/3 max-w-[400px] object-contain filter grayscale"
                />
              ) : (
                <div className="text-5xl font-black uppercase tracking-tighter -rotate-45 text-gray-400 opacity-20 text-center whitespace-nowrap">
                  {instituteProfile?.instituteName || "APLUS EXAMGEN"}
                </div>
              )}
          </div>
        </div>

        {/* 🔹 EXTREMELY COMPACT HEADER */}
        <div className="border-b-2 border-black pb-0.5 z-10 relative print:mt-0" dir="ltr">
          <div className="flex items-center justify-between mb-0.5">
            {instituteProfile?.logoUrl && instituteProfile.showLogoOnPapers ? (
              <div className={`${styles.logoSize} flex-shrink-0`}>
                <img 
                  src={instituteProfile.logoUrl} 
                  alt="Logo" 
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div className={`${styles.logoSize} flex-shrink-0 invisible`} />
            )}

            <div className="flex-grow text-center px-1">
              <h1 style={{ fontSize: styles.headerTitle }} className="font-bold uppercase tracking-tight leading-none mb-0.5">
                {instituteProfile?.instituteName || "INSTITUTE NAME"}
              </h1>
              <p style={{ fontSize: styles.headerInfo }} className="flex items-center justify-center gap-2 leading-none opacity-80">
                <span>{instituteProfile?.address}</span>
                {instituteProfile?.showContactOnPapers && (
                  <>
                    <span className="opacity-30">|</span>
                    <span className="font-semibold">{instituteProfile?.contactNumber}</span>
                  </>
                )}
              </p>
            </div>
            <div className={`${styles.logoSize} flex-shrink-0 invisible`} aria-hidden="true" />
          </div>
          
          <div style={{ fontSize: styles.headerInfo }} className="flex justify-between items-center font-bold border-t border-black pt-0.5 px-1 uppercase tracking-tighter">
            <span>Class: <span className="font-normal">{classLevel}</span></span>
            <span>Subject: <span className="font-normal">{subject}</span></span>
            <span>Time: <span className="font-normal">{timeAllowed}</span></span>
            <span>Total Marks: <span className="font-normal">{totalMarks}</span></span>
          </div>
          
          <div style={{ fontSize: styles.headerInfo }} className="flex justify-between items-center font-bold border-t border-black mt-0.5 pt-0.5 px-1">
            <span>Student: __________________________</span>
            <div className="flex gap-3">
              <span>Roll No: ________</span>
              {paperCode && (
                <span>Paper Code: <span className="font-bold border-2 border-black px-1 py-0 rounded ml-0.5">{paperCode}</span></span>
              )}
            </div>
          </div>
        </div>

        {/* 🔹 QUESTIONS START IMMEDIATELY */}
        <div className="z-10 relative mt-0.5" dir={baseDir}>
          {!hasQuestions ? (
            <div className="flex items-center justify-center h-24 text-gray-400 border border-dashed border-gray-300 rounded m-1">
                <div className="text-center">
                  <p className="font-bold text-sm">No questions selected.</p>
                </div>
            </div>
          ) : (
            sections.map((section, idx) => {
              const sectionQuestions = questions.filter(q => q.targetSectionId === section.id || (!q.targetSectionId && q.type === section.type));
              if (sectionQuestions.length === 0) return null;
              
              const partsPerQuestion = (section.subParts && section.subParts.length > 0) ? section.subParts.length : 1;
              const completeQuestionsCount = Math.floor(sectionQuestions.length / partsPerQuestion);
              
              let localQuestionCounter = 0;

              return (
                <div key={idx} className="mb-0.5 break-inside-avoid">
                  {/* 🔹 REMOVED MARKS DISPLAY FROM SECTION HEADER */}
                  <div style={{ fontSize: styles.sectionTitle }} className="font-bold mb-0.5 border-b border-gray-300 pb-0" dir={baseDir}>
                    <h3 className="uppercase">{section.title}</h3>
                  </div>
                  {section.type === 'MCQ' ? (
                    <div className={`grid grid-cols-1 ${styles.mcqGap}`}>
                      {sectionQuestions.map((q) => {
                        localQuestionCounter++;
                        return (
                          <div key={q.id} style={{ fontSize: styles.questionText }} className="break-inside-avoid mb-0.5">
                            <div className="font-semibold w-full">
                              {renderQuestionText(q, localQuestionCounter)}
                            </div>
                            <div className={`grid ${medium === 'Both' ? 'grid-cols-2 gap-x-1.5' : styles.optionGrid} ${baseDir === 'rtl' ? 'pr-4' : 'pl-4'} mt-0`} dir={baseDir}>
                              {q.options?.map((_, oIdx) => (
                                <div key={oIdx} style={{ fontSize: styles.optionText }} className="flex items-start gap-1">
                                  <span className="font-bold">({String.fromCharCode(97 + oIdx)})</span> 
                                  <div className="flex-grow">{renderOptionContent(q, oIdx)}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className={`${styles.spacing}`}>
                      {Array.from({ length: completeQuestionsCount }).map((_, qIdx) => {
                        localQuestionCounter++;
                        const startIndex = qIdx * partsPerQuestion;
                        
                        return (
                          <div key={qIdx} className="mb-0.5 break-inside-avoid">
                            {section.subParts && section.subParts.length > 0 ? (
                               <div className="space-y-0">
                                  <div className="font-bold" style={{ fontSize: styles.questionText }}>
                                    {medium === 'Both' ? (
                                      <div className="flex w-full items-start gap-4" dir="ltr">
                                        <div className="flex-1 text-left font-bold" dir="ltr">{localQuestionCounter}.</div>
                                        <div className="flex-1 text-right font-bold" dir="rtl">{localQuestionCounter}.</div>
                                      </div>
                                    ) : (
                                      <span dir="ltr">{localQuestionCounter}.</span>
                                    )}
                                  </div>
                                  <div className={`${baseDir === 'rtl' ? 'pr-4' : 'pl-4'} space-y-0`}>
                                    {section.subParts.map((part, pIdx) => {
                                      const qPart = sectionQuestions[startIndex + pIdx];
                                      return qPart ? (
                                        <div key={pIdx} style={{ fontSize: styles.questionText }} className="flex gap-1.5 items-start opacity-90">
                                           <div className="flex-grow">
                                              {renderQuestionText(qPart, part.label)}
                                           </div>
                                           <span className="text-[0.75em] font-bold">[{part.marks}]</span>
                                        </div>
                                      ) : null;
                                    })}
                                  </div>
                               </div>
                            ) : (
                               <div style={{ fontSize: styles.questionText }} className="w-full">
                                 {renderQuestionText(sectionQuestions[startIndex], localQuestionCounter)}
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
          <div className="mt-1 border-t border-dashed border-gray-400 pt-0.5 break-inside-avoid z-10 relative page-break-before" dir="ltr">
            <div className="text-center mb-0.5">
              <h3 className="font-extrabold text-xs uppercase border-b border-black inline-block px-2 tracking-tighter">Key</h3>
            </div>
            <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-x-1.5 gap-y-0 text-[8px]">
              {questions.map((q) => {
                if (!q.correctAnswer && q.type !== 'MCQ') return null;
                globalAnswerKeyCounter++;
                return (
                  <div key={q.id} className="flex items-center justify-between border-b border-gray-100 py-0 px-0.5">
                    <span className="font-bold text-gray-700">Q.{globalAnswerKeyCounter}</span>
                    <span className="font-mono bg-gray-50 px-0.5 rounded font-bold border border-gray-100">{q.correctAnswer || '-'}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="pt-0.5 border-t border-gray-200 text-center text-[6px] text-gray-400 mt-1 z-10 relative flex justify-between uppercase font-bold tracking-widest" dir="ltr">
          <span>Aplus ExamGen</span>
          <span>Software by: Nauman Ali</span>
        </div>
      </div>

      <style>
        {`
          @media print {
            body, html {
              margin: 0 !important;
              padding: 0 !important;
              background-color: white !important;
              overflow: visible !important;
              height: auto !important;
            }

            @page {
              size: A4;
              margin: 5mm !important; 
            }

            .print-container {
              width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              position: static !important;
              display: block !important;
              page-break-before: avoid !important;
            }

            #printable-section {
              margin: 0 !important;
              padding: 1.5mm 3mm !important; 
              width: 100% !important;
              box-shadow: none !important;
              min-height: 297mm !important;
              position: relative !important; 
              top: 0 !important;
              left: 0 !important;
              display: block !important;
              break-before: avoid !important;
            }

            .print-watermark {
              position: fixed !important;
              top: 0 !important;
              left: 0 !important;
              width: 100% !important;
              height: 100% !important;
              display: flex !important;
              align-items: center !important;
              justify-content: center !important;
              pointer-events: none !important;
              z-index: 0 !important;
            }

            .print-watermark img {
              width: 40% !important;
              max-width: 300px !important;
              filter: grayscale(100%) !important;
              opacity: 0.5 !important;
            }

            .text-watermark {
              font-size: 50px !important;
              font-weight: 900 !important;
              transform: rotate(-45deg) !important;
              opacity: 0.5 !important;
              white-space: nowrap !important;
            }
          }
        `}
      </style>
    </div>
  );
};