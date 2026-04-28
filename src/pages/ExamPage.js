import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { examAPI } from '../utils/api';
import {
  FiClock, FiAlertTriangle, FiSend, FiChevronLeft,
  FiChevronRight, FiChevronsRight, FiChevronsLeft, FiShield
} from 'react-icons/fi';

const EXAM_DURATION = 40 * 60;
const MAX_WARNINGS  = 3;
const ALERT_AT      = 5 * 60;

function playBeep(frequency = 880, duration = 0.6, volume = 0.6) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(volume, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    gainNode.connect(ctx.destination);
    [frequency, frequency * 1.25].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.15);
      osc.connect(gainNode);
      osc.start(ctx.currentTime + i * 0.15);
      osc.stop(ctx.currentTime + duration);
    });
  } catch (_) {}
}

function playUrgentAlarm() {
  [0, 0.35, 0.7].forEach(delay => {
    setTimeout(() => playBeep(880, 0.28, 0.7), delay * 1000);
  });
}

export default function ExamPage() {
  const navigate = useNavigate();

  const [questions,       setQuestions]       = useState([]);
  const [answers,         setAnswers]         = useState({});
  const [currentIndex,    setCurrentIndex]    = useState(0);
  const [timeLeft,        setTimeLeft]        = useState(EXAM_DURATION);
  const [loading,         setLoading]         = useState(true);
  const [submitting,      setSubmitting]      = useState(false);
  const [warningMsg,      setWarningMsg]      = useState('');
  const [warningCount,    setWarningCount]    = useState(0);
  const [terminated,      setTerminated]      = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [sidebarOpen,     setSidebarOpen]     = useState(true);
  const [fiveMinAlert,    setFiveMinAlert]    = useState(false);

  const timerRef        = useRef(null);
  const warningRef      = useRef(0);
  const tabSwitchRef    = useRef(0);
  const isSubmittingRef = useRef(false);
  const answersRef      = useRef({});
  const fiveMinFiredRef = useRef(false);

  // ── Load exam ──
  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await examAPI.start();
        setQuestions(data.questions);
        const remaining = data.remainingTime;
        setTimeLeft(remaining);
        if (remaining <= ALERT_AT) {
          setFiveMinAlert(true);
          fiveMinFiredRef.current = true;
        }
        setLoading(false);
        document.documentElement.requestFullscreen?.().catch(() => {});
      } catch (err) {
        alert(err.response?.data?.message || 'Failed to load exam');
        navigate('/dashboard');
      }
    };
    load();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [navigate]);

  // ── doSubmit — reads answersRef, never stale ──
  const doSubmit = useCallback(async (type = 'manual') => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setSubmitting(true);

    if (timerRef.current) clearInterval(timerRef.current);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    if (type === 'terminated') setTerminated(true);

    const answersArray = Object.entries(answersRef.current).map(([qId, sel]) => ({
      questionId: parseInt(qId, 10),
      selectedOption: sel,
    }));

    try {
      await examAPI.submit({
        answers:          answersArray,
        tabSwitchCount:   tabSwitchRef.current,
        cheatingWarnings: warningRef.current,
        submissionType:   type,
      });
    } catch (err) {
      console.error('Submit error:', err);
    }
    navigate('/result');
  }, [navigate]);

  // ── Countdown timer ──
  useEffect(() => {
    if (loading || terminated) return;

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        const next = prev - 1;

        if (next === ALERT_AT && !fiveMinFiredRef.current) {
          fiveMinFiredRef.current = true;
          setFiveMinAlert(true);
          playUrgentAlarm();
        }

        if (next < ALERT_AT && next > 0 && next % 30 === 0) {
          playBeep(660, 0.25, 0.5);
        }

        if (next <= 10 && next > 0) {
          playBeep(440, 0.1, 0.4);
        }

        if (next <= 0) {
          clearInterval(timerRef.current);
          doSubmit('time_expired');
          return 0;
        }

        return next;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [loading, terminated, doSubmit]);

  // ── Anti-cheat: right-click ──
  useEffect(() => {
    const block = (e) => e.preventDefault();
    document.addEventListener('contextmenu', block);
    return () => document.removeEventListener('contextmenu', block);
  }, []);

  // ── Anti-cheat: copy / paste / cut ──
  useEffect(() => {
    const block = (e) => e.preventDefault();
    ['copy', 'paste', 'cut'].forEach(ev => document.addEventListener(ev, block));
    return () => ['copy', 'paste', 'cut'].forEach(ev => document.removeEventListener(ev, block));
  }, []);

  // ── Anti-cheat: keyboard shortcuts ──
  useEffect(() => {
    const handle = (e) => {
      if (
        (e.ctrlKey && ['c','v','x','a','u','s','p'].includes(e.key.toLowerCase())) ||
        (e.ctrlKey && e.shiftKey && ['i','j','c'].includes(e.key.toLowerCase())) ||
        e.key === 'F12' ||
        e.key === 'PrintScreen'
      ) e.preventDefault();
    };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, []);

  // ── triggerWarning ──
  const triggerWarning = useCallback(async (eventType, message) => {
    if (isSubmittingRef.current || terminated) return;
    warningRef.current += 1;
    setWarningCount(warningRef.current);
    setWarningMsg(message);
    playBeep(520, 0.3, 0.5);
    setTimeout(() => setWarningMsg(''), 4000);
    try {
      const { data } = await examAPI.reportCheat({ eventType, count: warningRef.current });
      if (data.action === 'terminate' || warningRef.current >= MAX_WARNINGS) doSubmit('terminated');
    } catch {
      if (warningRef.current >= MAX_WARNINGS) doSubmit('terminated');
    }
  }, [terminated, doSubmit]);

  // ── Anti-cheat: tab switch / visibility ──
  useEffect(() => {
    if (loading || terminated) return;
    const onVisibility = () => {
      if (document.hidden) {
        tabSwitchRef.current += 1;
        triggerWarning('tab_switch', `Tab switch detected! Warning ${tabSwitchRef.current}/${MAX_WARNINGS}`);
      }
    };
    const onBlur = () => {
      if (!document.hidden) triggerWarning('window_blur', 'Window focus lost! Return to the exam window.');
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
    };
  }, [loading, terminated, triggerWarning]);

  // ── Anti-cheat: fullscreen ──
  useEffect(() => {
    if (loading || terminated) return;
    const onFsChange = () => {
      if (!document.fullscreenElement) {
        triggerWarning('fullscreen_exit', 'Fullscreen exited! Returning to fullscreen...');
        setTimeout(() => {
          if (!document.fullscreenElement)
            document.documentElement.requestFullscreen?.().catch(() => {});
        }, 1500);
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, [loading, terminated, triggerWarning]);

  // ── Select answer — updates ref AND state ──
  const selectAnswer = (questionId, optionIdx) => {
    const updated = { ...answersRef.current, [questionId]: optionIdx };
    answersRef.current = updated;
    setAnswers(updated);
  };

  // ── Helpers ──
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const answered   = Object.keys(answers).length;
  const unanswered = questions.length - answered;
  const isUrgent   = timeLeft <= ALERT_AT;
  const isCritical = timeLeft <= 60;
  const q          = questions[currentIndex];
  const topicColors = { HTML: '#d97706', CSS: '#0891b2', JavaScript: '#7c3aed', React: '#16a34a' };

  // ── Loading screen ──
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'white' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 16px' }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Preparing your exam…</p>
        </div>
      </div>
    );
  }

  // ── Terminated screen ──
  if (terminated) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'white' }}>
        <div className="card" style={{ maxWidth: 440, textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--red-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <FiAlertTriangle size={28} color="var(--red)" />
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', color: 'var(--red)', marginBottom: 10 }}>Exam Terminated</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Your exam was terminated due to {warningRef.current} policy violation(s). Submitting your responses…
          </p>
        </div>
      </div>
    );
  }

  // ── Main exam UI ──
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'white', userSelect: 'none' }}>

      {/* Top Bar */}
      <div style={{ height: 56, background: 'white', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', boxShadow: 'var(--shadow-sm)', flexShrink: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, background: 'var(--accent)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FiShield size={14} color="white" />
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
            PixelWind <span style={{ color: 'var(--accent)' }}>SecureAssess</span>
          </span>
        </div>

        {/* Timer */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '7px 18px', borderRadius: 8,
          background:   isCritical ? 'var(--red-light)'  : isUrgent ? 'var(--yellow-light)' : 'var(--bg-secondary)',
          border: `1.5px solid ${isCritical ? '#fecaca' : isUrgent ? '#fde68a'              : 'var(--border)'}`,
        }}>
          <FiClock size={16} color={isCritical ? 'var(--red)' : isUrgent ? 'var(--yellow)' : 'var(--accent)'} />
          <span style={{
            fontFamily: 'monospace', fontWeight: 800, fontSize: '1.3rem',
            color: isCritical ? 'var(--red)' : isUrgent ? 'var(--yellow)' : 'var(--text-primary)',
            animation: isCritical ? 'blink 1s infinite' : 'none',
          }}>
            {formatTime(timeLeft)}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: '0.8rem', display: 'flex', gap: 14 }}>
            <span style={{ color: 'var(--green)', fontWeight: 600 }}>{answered} answered</span>
            <span style={{ color: warningCount > 0 ? 'var(--red)' : 'var(--text-muted)', fontWeight: 600 }}>
              <FiAlertTriangle size={12} style={{ marginRight: 3 }} />
              {warningCount}/{MAX_WARNINGS} warnings
            </span>
          </div>
          <button className="btn btn-success" style={{ padding: '7px 16px', fontSize: '0.8rem', gap: 6 }} onClick={() => setShowSubmitModal(true)}>
            <FiSend size={14} /> Submit
          </button>
        </div>
      </div>

      {/* 5-minute alert banner */}
      {fiveMinAlert && !isCritical && (
        <div style={{ background: '#fffbeb', borderBottom: '1px solid #fde68a', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 10, color: '#92400e', fontSize: '0.85rem', fontWeight: 600, flexShrink: 0 }}>
          <FiClock size={16} color="#d97706" />
          ⚠️ Only 5 minutes remaining! Please review your answers and submit before time runs out.
          <button style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#92400e', fontSize: '1rem', lineHeight: 1 }} onClick={() => setFiveMinAlert(false)}>✕</button>
        </div>
      )}

      {/* Anti-cheat warning banner */}
      {warningMsg && (
        <div style={{ background: '#fef2f2', borderBottom: '1px solid #fecaca', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 8, color: '#991b1b', fontSize: '0.85rem', fontWeight: 600, flexShrink: 0 }}>
          <FiAlertTriangle size={16} />
          {warningMsg}
        </div>
      )}

      {/* Progress bar */}
      <div style={{ height: 3, background: 'var(--border)', flexShrink: 0 }}>
        <div style={{ height: '100%', width: `${questions.length > 0 ? (answered / questions.length) * 100 : 0}%`, background: 'var(--accent)', transition: 'width 0.3s ease' }} />
      </div>

      {/* Main layout */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Question area — LEFT */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '28px 36px' }}>

          {/* Topic badge + position */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', background: `${topicColors[q?.topic] || 'var(--accent)'}18`, color: topicColors[q?.topic] || 'var(--accent)', border: `1px solid ${topicColors[q?.topic] || 'var(--accent)'}40` }}>
              {q?.topic}
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              Question {currentIndex + 1} of {questions.length}
            </span>
          </div>

          {/* Question text */}
          <h2 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.75, marginBottom: 28, textAlign: 'left' }}>
            {q?.question}
          </h2>

          {/* Options */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginBottom: 36 }}>
            {q?.options.map((opt, idx) => {
              const isSelected = answers[q.id] === idx;
              return (
                <button
                  key={idx}
                  onClick={() => selectAnswer(q.id, idx)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14, padding: '13px 18px',
                    background: isSelected ? 'var(--accent-light)' : 'white',
                    border: `1.5px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                    color: isSelected ? 'var(--accent-hover)' : 'var(--text-primary)',
                    transition: 'all 0.15s ease', fontFamily: 'var(--font)', fontSize: '0.9rem',
                    fontWeight: isSelected ? 600 : 400,
                    boxShadow: isSelected ? '0 0 0 3px rgba(26,86,219,0.08)' : 'none',
                  }}
                >
                  <span style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isSelected ? 'var(--accent)' : 'var(--bg-secondary)', color: isSelected ? 'white' : 'var(--text-secondary)', fontSize: '0.78rem', fontWeight: 700, flexShrink: 0, border: `1.5px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}` }}>
                    {String.fromCharCode(65 + idx)}
                  </span>
                  {opt}
                </button>
              );
            })}
          </div>

          {/* Navigation */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-outline" onClick={() => setCurrentIndex(i => Math.max(0, i - 1))} disabled={currentIndex === 0}>
              <FiChevronLeft size={16} /> Previous
            </button>
            <button className="btn btn-outline" onClick={() => setCurrentIndex(i => Math.min(questions.length - 1, i + 1))} disabled={currentIndex === questions.length - 1}>
              Next <FiChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Sidebar — RIGHT, collapsible */}
        <div style={{ display: 'flex', flexShrink: 0 }}>

          {/* Toggle strip */}
          <div
            style={{ width: 28, background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 20, cursor: 'pointer' }}
            onClick={() => setSidebarOpen(o => !o)}
          >
            <button style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 5px', cursor: 'pointer', display: 'flex', color: 'var(--text-secondary)', boxShadow: 'var(--shadow-sm)' }}>
              {sidebarOpen ? <FiChevronsRight size={14} /> : <FiChevronsLeft size={14} />}
            </button>
          </div>

          {/* Panel */}
          {sidebarOpen && (
            <div style={{ width: 240, background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border)', overflowY: 'auto', padding: '16px 14px' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
                Question Navigator
              </div>

              {/* Legend */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 14, fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--green)' }} /> Answered
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--red-light)', border: '1px solid var(--red)' }} /> Not Answered
                </div>
              </div>

              {/* Summary counters */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <div style={{ flex: 1, padding: '8px 10px', background: 'var(--green-light)', border: '1px solid var(--green-border)', borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--green)' }}>{answered}</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--green)', fontWeight: 600 }}>Answered</div>
                </div>
                <div style={{ flex: 1, padding: '8px 10px', background: 'var(--red-light)', border: '1px solid var(--red-border)', borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--red)' }}>{unanswered}</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--red)', fontWeight: 600 }}>Remaining</div>
                </div>
              </div>

              {/* Question number grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 5 }}>
                {questions.map((qs, i) => {
                  const isAns = answers[qs.id] !== undefined;
                  const isCur = i === currentIndex;
                  return (
                    <button
                      key={i}
                      onClick={() => setCurrentIndex(i)}
                      style={{
                        aspectRatio: '1',
                        border: `2px solid ${isCur ? 'var(--accent)' : isAns ? 'var(--green)' : 'var(--red)'}`,
                        borderRadius: 6,
                        background: isCur ? 'var(--accent)' : isAns ? 'var(--green-light)' : 'var(--red-light)',
                        color: isCur ? 'white' : isAns ? 'var(--green)' : 'var(--red)',
                        fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.12s',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Submit confirm modal */}
      {showSubmitModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
          <div className="card" style={{ maxWidth: 420, width: '100%', boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FiSend size={20} color="var(--accent)" />
              </div>
              <div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.1rem' }}>Submit Exam?</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>This action cannot be undone</p>
              </div>
            </div>

            <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '14px 16px', marginBottom: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 800, fontSize: '1.5rem', color: 'var(--green)' }}>{answered}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Answered</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 800, fontSize: '1.5rem', color: 'var(--red)' }}>{unanswered}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Unanswered</div>
              </div>
            </div>

            {unanswered > 0 && (
              <div className="alert alert-warning" style={{ marginBottom: 20 }}>
                <FiAlertTriangle size={15} style={{ flexShrink: 0 }} />
                <span>{unanswered} unanswered questions will be marked as skipped.</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-outline btn-full" onClick={() => setShowSubmitModal(false)} disabled={submitting}>Cancel</button>
              <button className="btn btn-success btn-full" onClick={() => doSubmit('manual')} disabled={submitting}>
                {submitting ? 'Submitting…' : 'Confirm Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes blink { 0%,100% { opacity:1; } 50% { opacity:0.35; } }
      `}</style>
    </div>
  );
}
