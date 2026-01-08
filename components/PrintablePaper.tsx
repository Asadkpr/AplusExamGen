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
  baseFontSize = 12,
  timeAllowed = '2:00 Hours'
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
    const scale = baseSize / 12;

    switch (mode) {
      case 2:
        return {
          headerTitle: '16px',
          headerInfo: '11px',
          sectionTitle: `${Math.round(11 * scale)}px`,
          questionText: `${Math.round(10 * scale)}px`,
          optionText: `${Math.round(9 * scale)}px`,
          spacing: 'space-y-0',
          logoSize: 'w-10 h-10',
          mcqGap: 'gap-y-0',
          optionGrid: 'grid-cols-2 gap-0'
        };
      default:
        return {
          headerTitle: '22px',
          headerInfo: '13px',
          sectionTitle: `${Math.round(18 * scale)}px`,
          questionText: `${baseSize}px`,
          optionText: `${Math.round(14 * scale)}px`,
          spacing: 'space-y-0.5',
          logoSize: 'w-20 h-20',
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
        <div className="flex w-full items-start gap-8" dir="ltr">
          {/* English Side */}
          <div className="flex-1 text-left flex gap-2" style={{ fontFamily: "'Times New Roman', serif" }}>
            <span className="font-bold whitespace-nowrap">{counter}{suffix}</span>
            <span>{mainText}</span>
          </div>
          {/* Urdu Side */}
          {urduText && (
            <div 
              className="flex-1 text-right flex gap-2 justify-start items-start" 
              style={{ fontFamily: urduFontStack, lineHeight: '2' }} 
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
      <div className="flex gap-2 items-start" dir="ltr">
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
        <div className="flex w-full items-start justify-between gap-3" dir="ltr">
          <span className="flex-1 text-left" style={{ fontFamily: "'Times New Roman', serif" }}>{optEng}</span>
          {optUrdu && (
            <span 
              className="flex-1 text-right text-[0.9em]" 
              style={{ fontFamily: urduFontStack, lineHeight: '1.8' }} 
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
            className="w-2/3 max-w-[400px] object-contain opacity-[0.07] grayscale"
          />
        ) : (
          <div className="text-watermark">
            {instituteProfile?.instituteName || "APLUS EXAMGEN"}
          </div>
        )}
      </div>

      <div 
        id="printable-section"
        className={`${styles.spacing} p-6 md:p-10 tex2jax_process relative overflow-visible`} 
        style={{ 
          backgroundColor: '#ffffff', 
          color: '#000000', 
          fontFamily: fontFamily,
          lineHeight: (medium === 'Urdu') ? '1.8' : '1.1',
          boxSizing: 'border-box',
          paddingBottom: '15mm',
          width: '100%',
          margin: '0 auto'
        }}
        dir="ltr"
      >
        {/* 🔹 LOGO WATERMARK FOR PREVIEW (Sticky Implementation - Fixes it within paper boundaries) */}
        <div 
          className="absolute inset-0 pointer-events-none z-0 print:hidden overflow-hidden"
          style={{ opacity: 0.05 }}
        >
          <div className="sticky top-1/2 left-0 w-full flex items-center justify-center -translate-y-1/2 h-[50vh]">
             {instituteProfile?.logoUrl ? (
                <img 
                  src={instituteProfile.logoUrl} 
                  alt="Preview Watermark" 
                  className="w-2/3 max-w-[500px] object-contain filter grayscale"
                />
              ) : (
                <div className="text-6xl font-black uppercase tracking-tighter -rotate-45 text-gray-400 opacity-20 text-center whitespace-nowrap">
                  {instituteProfile?.instituteName || "APLUS EXAMGEN"}
                </div>
              )}
          </div>
        </div>

        <div className="border-b-2 border-black pb-1 z-10 relative print:mt-0" dir="ltr">
          <div className="flex items-center justify-between mb-1">
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

            <div className="flex-grow text-center px-4">
              <h1 style={{ fontSize: styles.headerTitle }} className="font-bold uppercase tracking-wide leading-tight">
                {instituteProfile?.instituteName || "INSTITUTE NAME"}
              </h1>
              <p style={{ fontSize: styles.headerInfo }} className="flex items-center justify-center gap-4">
                <span>{instituteProfile?.address}</span>
                {instituteProfile?.showContactOnPapers && (
                  <>
                    <span className="opacity-50">|</span>
                    <span className="font-semibold">Contact: {instituteProfile?.contactNumber}</span>
                  </>
                )}
              </p>
            </div>
            <div className={`${styles.logoSize} flex-shrink-0 invisible`} aria-hidden="true" />
          </div>
          
          <div style={{ fontSize: styles.headerInfo }} className="flex justify-between items-center font-semibold border-t-2 border-black pt-1 px-2">
            <span>Class: <span className="font-normal">{classLevel}</span></span>
            <span>Subject: <span className="font-normal">{subject}</span></span>
            <span>Time: <span className="font-normal">{timeAllowed}</span></span>
            <span>Total Marks: <span className="font-normal">{totalMarks}</span></span>
          </div>
          
          <div style={{ fontSize: styles.headerInfo }} className="flex justify-between items-center font-semibold border-t border-black mt-1 pt-1 px-2">
            <span>Student: __________________________</span>
            <span>Roll No: ________</span>
          </div>
        </div>

        <div className="z-10 relative mt-2" dir={baseDir}>
          {!hasQuestions ? (
            <div className="flex items-center justify-center h-48 text-gray-400 border-2 border-dashed border-gray-300 rounded-lg m-4">
                <div className="text-center">
                  <p className="font-bold">No questions selected for this paper.</p>
                  <p className="text-xs mt-1">Please select questions in Step 5.</p>
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
                <div key={idx} className="mb-4 break-inside-avoid">
                  <div style={{ fontSize: styles.sectionTitle }} className="font-bold mb-1 flex justify-between items-baseline border-b border-gray-300 pb-0" dir={baseDir}>
                    <h3 className="uppercase">{section.title}</h3>
                    <span style={{ fontSize: styles.headerInfo }} className="font-normal">Marks: {section.attemptCount * section.marksPerQuestion}</span>
                  </div>
                  {section.type === 'MCQ' ? (
                    <div className={`grid grid-cols-1 ${styles.mcqGap}`}>
                      {sectionQuestions.map((q) => {
                        localQuestionCounter++;
                        return (
                          <div key={q.id} style={{ fontSize: styles.questionText }} className="break-inside-avoid mb-1">
                            <div className="font-semibold w-full">
                              {renderQuestionText(q, localQuestionCounter)}
                            </div>
                            <div className={`grid ${medium === 'Both' ? 'grid-cols-2 gap-x-2' : styles.optionGrid} ${baseDir === 'rtl' ? 'pr-5' : 'pl-5'} mt-1`} dir={baseDir}>
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
                      {/* Group questions into units if sub-parts exist */}
                      {Array.from({ length: completeQuestionsCount }).map((_, qIdx) => {
                        localQuestionCounter++;
                        const startIndex = qIdx * partsPerQuestion;
                        
                        return (
                          <div key={qIdx} className="mb-2 break-inside-avoid">
                            {section.subParts && section.subParts.length > 0 ? (
                               /* Render as Grouped Unit */
                               <div className="space-y-1">
                                  <div className="font-bold" style={{ fontSize: styles.questionText }}>
                                    {medium === 'Both' ? (
                                      <div className="flex w-full items-start gap-8" dir="ltr">
                                        <div className="flex-1 text-left font-bold" dir="ltr">{localQuestionCounter}.</div>
                                        <div className="flex-1 text-right font-bold" dir="rtl">{localQuestionCounter}.</div>
                                      </div>
                                    ) : (
                                      <span dir="ltr">{localQuestionCounter}.</span>
                                    )}
                                  </div>
                                  <div className={`${baseDir === 'rtl' ? 'pr-6' : 'pl-6'} space-y-1`}>
                                    {section.subParts.map((part, pIdx) => {
                                      const qPart = sectionQuestions[startIndex + pIdx];
                                      return qPart ? (
                                        <div key={pIdx} style={{ fontSize: styles.questionText }} className="flex gap-2 items-start italic opacity-90">
                                           <div className="flex-grow">
                                              {renderQuestionText(qPart, part.label)}
                                           </div>
                                           <span className="text-[0.8em] font-bold">[{part.marks}]</span>
                                        </div>
                                      ) : null;
                                    })}
                                  </div>
                               </div>
                            ) : (
                               /* Render as Individual Question */
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
          <div className="mt-8 border-t border-dashed border-gray-400 pt-4 break-inside-avoid z-10 relative page-break-before" dir="ltr">
            <div className="text-center mb-2">
              <h3 className="font-extrabold text-base uppercase border-b border-black inline-block px-4 tracking-tighter">Answer Key</h3>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-x-3 gap-y-1">
              {questions.map((q) => {
                if (!q.correctAnswer && q.type !== 'MCQ') return null;
                globalAnswerKeyCounter++;
                return (
                  <div key={q.id} className="flex items-center justify-between border-b border-gray-100 py-1 px-1 text-[10px]">
                    <span className="font-bold text-gray-700">Q.{globalAnswerKeyCounter}</span>
                    <span className="font-mono bg-gray-50 px-1.5 rounded font-bold border border-gray-100">{q.correctAnswer || '-'}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="pt-2 border-t border-gray-200 text-center text-[7px] text-gray-400 mt-10 z-10 relative flex justify-between uppercase font-bold tracking-widest" dir="ltr">
          <span>Aplus ExamGen</span>
          <span>Paper Generated Successfully</span>
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
              margin: 0 !important; 
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
              padding: 10mm !important; 
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
              width: 65% !important;
              max-width: 500px !important;
              filter: grayscale(100%) !important;
              opacity: 0.07 !important;
            }

            .text-watermark {
              font-size: 80px !important;
              font-weight: 900 !important;
              transform: rotate(-45deg) !important;
              opacity: 0.06 !important;
              white-space: nowrap !important;
            }
          }
        `}
      </style>
    </div>
  );
};