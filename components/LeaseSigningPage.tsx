import React, { useCallback, useEffect, useRef, useState } from 'react';

const BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000';
// const BASE_URL = (import.meta as any).env?.VITE_API_URL || 'https://neela-backend-96ia.onrender.com';

// ─── Types ───────────────────────────────────────────────────────────────────
interface Field {
  id: string;
  type: string;
  label: string;
  required: boolean;
  page?: number;
  x?: number; y?: number; width?: number; height?: number;
}

interface TokenData {
  id: string;
  tenant_name: string;
  property_unit: string;
  type: string;
  status: string;
  generated_content: string;
  fields: Field[];
}

// ─── Signature Pad ───────────────────────────────────────────────────────────
interface SigPadProps {
  label: string;
  required?: boolean;
  value: string;
  onChange: (dataUrl: string) => void;
}

const SigPad: React.FC<SigPadProps> = ({ label, required, value, onChange }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [mode, setMode] = useState<'draw' | 'upload'>('draw');
  const [isOpen, setIsOpen] = useState(false);

  const dpr = () => Math.min(window.devicePixelRatio || 1, 2);

  const initCanvas = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    const d = dpr(); const rect = c.getBoundingClientRect();
    const w = Math.round(rect.width * d); const h = Math.round(rect.height * d);
    if (c.width !== w || c.height !== h) {
      c.width = w; c.height = h;
      const ctx = c.getContext('2d')!;
      ctx.scale(d, d);
      ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 2.5;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    }
  }, []);

  useEffect(() => { if (isOpen) setTimeout(initCanvas, 50); }, [isOpen, initCanvas]);

  const pos = (e: React.MouseEvent | React.TouchEvent) => {
    const c = canvasRef.current!; const r = c.getBoundingClientRect();
    if ('touches' in e) return { x: e.touches[0].clientX - r.left, y: e.touches[0].clientY - r.top };
    return { x: (e as React.MouseEvent).nativeEvent.offsetX, y: (e as React.MouseEvent).nativeEvent.offsetY };
  };

  const start = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault(); initCanvas();
    const ctx = canvasRef.current?.getContext('2d'); if (!ctx) return;
    drawing.current = true;
    const { x, y } = pos(e); ctx.beginPath(); ctx.moveTo(x, y);
  };
  const move = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault(); if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext('2d'); if (!ctx) return;
    const { x, y } = pos(e); ctx.lineTo(x, y); ctx.stroke();
  };
  const end = () => {
    if (!drawing.current) return; drawing.current = false;
    try { onChange(canvasRef.current!.toDataURL('image/png')); } catch { /**/ }
  };
  const clear = () => {
    const c = canvasRef.current; const ctx = c?.getContext('2d'); if (!c || !ctx) return;
    const r = c.getBoundingClientRect(); ctx.clearRect(0, 0, r.width, r.height); onChange('');
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const c = canvasRef.current; if (!c) return;
        const r = c.getBoundingClientRect();
        const off = document.createElement('canvas');
        off.width = Math.round(r.width); off.height = Math.round(r.height);
        const ctx = off.getContext('2d')!;
        const scale = Math.min(off.width / img.width, off.height / img.height);
        const w = img.width * scale; const h = img.height * scale;
        ctx.drawImage(img, (off.width - w) / 2, (off.height - h) / 2, w, h);
        try { onChange(off.toDataURL('image/png')); setIsOpen(false); } catch { /**/ }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file); e.target.value = '';
  };

  // Screen-only sign button
  const signButton = (
    <button type="button" onClick={() => setIsOpen(true)}
      className="no-print flex items-center gap-2 px-4 py-1.5 text-xs font-semibold border-2 border-dashed border-indigo-400 text-indigo-700 rounded-lg hover:bg-indigo-50 transition-colors">
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
      </svg>
      Click to sign{required && <span className="text-red-500">*</span>}
    </button>
  );

  return (
    <div className="w-full">
      {/* Label */}
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 print:text-black print:text-sm">
        {label}{required && <span className="text-red-500 ml-0.5 no-print">*</span>}
      </p>

      {/* Signed preview OR sign button */}
      {value ? (
        <div className="relative">
          {/* Signature image line */}
          <div className="border-b-2 border-slate-400 pb-1 flex items-end gap-2 print:border-black">
            <img src={value} alt={label} className="h-12 object-contain" />
            <button type="button" onClick={() => { clear(); setIsOpen(true); }}
              className="no-print text-xs text-slate-400 hover:text-red-500 mb-0.5">
              ✕ redo
            </button>
          </div>
        </div>
      ) : (
        <div className="border-b-2 border-slate-400 py-3 print:border-black">
          {signButton}
          {/* Print placeholder */}
          <div className="print-only h-8" />
        </div>
      )}

      {/* Drawer / modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 no-print" onClick={(e) => { if (e.target === e.currentTarget) setIsOpen(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold text-slate-900">{label}</h4>
              <div className="flex gap-1">
                <button type="button" onClick={() => setMode('draw')}
                  className={`text-xs px-3 py-1 rounded-lg ${mode === 'draw' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  Draw
                </button>
                <label className="text-xs px-3 py-1 rounded-lg bg-slate-100 text-slate-600 cursor-pointer hover:bg-slate-200">
                  Upload<input type="file" accept="image/png,image/jpeg" onChange={handleFile} className="sr-only" />
                </label>
              </div>
            </div>

            {mode === 'draw' && (
              <div className="border-2 border-slate-300 rounded-xl bg-slate-50 overflow-hidden" style={{ height: 140 }}>
                <canvas ref={canvasRef}
                  onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
                  onTouchStart={start} onTouchMove={move} onTouchEnd={end}
                  className="w-full h-full block touch-none"
                  style={{ width: '100%', height: '100%' }}
                />
              </div>
            )}
            {mode === 'upload' && (
              <label className="block border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 text-sm cursor-pointer hover:bg-slate-100"
                style={{ height: 140 }}>
                Click or drag an image here
                <input type="file" accept="image/png,image/jpeg" onChange={handleFile} className="sr-only" />
              </label>
            )}

            <div className="flex gap-2 mt-4">
              {mode === 'draw' && (
                <button type="button" onClick={clear}
                  className="flex-1 py-2 text-sm border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50">
                  Clear
                </button>
              )}
              <button type="button"
                onClick={() => {
                  if (mode === 'draw') {
                    try { onChange(canvasRef.current!.toDataURL('image/png')); } catch { /**/ }
                  }
                  setIsOpen(false);
                }}
                className="flex-1 py-2 text-sm bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700">
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Interactive inline field renderer ───────────────────────────────────────
// Converts blank fields (____) to text inputs and [ ] to checkboxes inline.

const renderLineInteractive = (
  line: string,
  keyPrefix: string,
  vals: Record<string, string | boolean>,
  updateFn: (id: string, val: string | boolean) => void
): React.ReactNode => {
  // Split line by 4+ underscores (blank fields) or unchecked checkbox markers [ ]
  const tokens = line.split(/(_{4,}|\[ \])/g);
  if (tokens.length === 1) return <>{tokens[0]}</>;

  return (
    <>
      {tokens.map((token, ti) => {
        const fid = `${keyPrefix}_t${ti}`;

        if (/^_{4,}$/.test(token)) {
          const v = (vals[fid] as string) ?? '';
          const w = Math.max(80, token.length * 7);
          return (
            <React.Fragment key={ti}>
              <input
                type="text"
                value={v}
                onChange={(e) => updateFn(fid, e.target.value)}
                className="no-print border-b border-indigo-400 bg-transparent focus:outline-none focus:border-indigo-600 text-[13px] text-slate-900 inline-block align-baseline leading-none px-0.5"
                style={{ width: w }}
                aria-label="fill in field"
              />
              <span
                className="print-only border-b border-black inline-block"
                style={{ minWidth: w }}
              >
                {v}
              </span>
            </React.Fragment>
          );
        }

        if (token === '[ ]') {
          const checked = !!vals[fid];
          return (
            <React.Fragment key={ti}>
              <label className="no-print inline-flex items-center cursor-pointer align-middle mx-0.5">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => updateFn(fid, e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-slate-400 text-indigo-600 focus:ring-indigo-500"
                />
              </label>
              <span className="print-only">{checked ? '[x]' : '[ ]'}</span>
            </React.Fragment>
          );
        }

        return <span key={ti}>{token}</span>;
      })}
    </>
  );
};

const renderInteractiveBody = (
  content: string,
  vals: Record<string, string | boolean>,
  updateFn: (id: string, val: string | boolean) => void
): React.ReactNode[] => {
  const paragraphs = content.split(/\n\n+/).filter(Boolean);
  return paragraphs.map((para, pi) => {
    const lines = para.split('\n').filter(Boolean);
    if (!lines.length) return null;
    const first = lines[0].trim();
    const isHeader =
      /^[A-Z][A-Z\s]{2,}$/.test(first) ||
      /^\d+\.\s+[A-Z]/.test(first);
    if (isHeader && lines.length === 1) {
      return (
        <h3 key={pi} className="font-bold text-slate-900 text-sm uppercase tracking-wide mt-7 mb-1.5 print:text-black">
          {first}
        </h3>
      );
    }
    return (
      <p key={pi} className="text-[13px] text-slate-800 leading-relaxed mb-3 print:text-black">
        {lines.map((line, li) => (
          <React.Fragment key={li}>
            {li > 0 && <br />}
            {renderLineInteractive(line, `p${pi}l${li}`, vals, updateFn)}
          </React.Fragment>
        ))}
      </p>
    );
  }).filter(Boolean) as React.ReactNode[];
};

// ─── Content renderer ─────────────────────────────────────────────────────────
// Returns { beforeSig, introText } — content split at the SIGNATURES section.
function splitAtSignatures(content: string): { body: string; sigIntro: string } {
  // We split the template text at the start of the "signature area"
  // so the HTML signing UI can render the signature blocks itself.
  //
  // Residential template commonly uses a `SIGNATURES` header.
  // Other templates use different headings like "Landlord's Signature" or
  // "Applicant's Signature", etc.
  const signatureStartPatterns: RegExp[] = [
    /^8\.\s*SIGNATURES\b/im,
    /^SIGNATURES\b/im,
    /^Applicant's Signature\b/im,
    /^Applicant Signature\b/im,
    /^Landlord's Signature\b/im,
    /^Landlord Signature\b/im,
    /^Tenant's Signature\b/im,
    /^Tenant Signature\b/im,
    /^Server Signature\b/im,
    /^Signature of Deliverer\b/im,
  ];

  let best: { index: number; match: RegExpExecArray } | null = null;
  for (const re of signatureStartPatterns) {
    const m = re.exec(content);
    if (!m || m.index === undefined) continue;
    if (!best || m.index < best.index) best = { index: m.index, match: m };
  }

  if (!best) return { body: content, sigIntro: '' };

  const body = content.slice(0, best.index).trim();
  // Grab the intro paragraph that follows the signature start marker (up to first blank line)
  const rest = content.slice(best.index + best.match[0].length).trim();
  const firstBlank = rest.search(/\n\n/);
  const sigIntro = firstBlank > -1 ? rest.slice(0, firstBlank).trim() : rest.trim();
  return { body, sigIntro };
}

// ─── Signature block ──────────────────────────────────────────────────────────
interface SigBlockProps {
  sigField: Field | undefined;
  dateFieldId: string;
  signerLabel: string;
  signerName: string;
  values: Record<string, string | boolean>;
  update: (id: string, val: string | boolean) => void;
}

const SigBlock: React.FC<SigBlockProps> = ({ sigField, dateFieldId, signerLabel, signerName, values, update }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-x-8 gap-y-3 items-end">
      {/* Signature pad — takes full width on mobile, left col on sm+ */}
      <div>
        {sigField && (
          <SigPad
            label={sigField.label}
            required={sigField.required}
            value={(values[sigField.id] as string) ?? ''}
            onChange={(v) => update(sigField.id, v)}
          />
        )}
        {!sigField && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{signerLabel}</p>
            <div className="border-b-2 border-slate-400 print:border-black h-8" />
          </div>
        )}
        <p className="text-xs text-slate-500 mt-1 print:text-black">{signerName}</p>
      </div>

      {/* Date — right col */}
      <div className="min-w-[160px]">
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 print:text-black">
          Date{sigField?.required && <span className="text-red-500 ml-0.5 no-print">*</span>}
        </label>
        <input
          type="date"
          value={(values[dateFieldId] as string) ?? ''}
          onChange={(e) => update(dateFieldId, e.target.value)}
          className="no-print w-full px-2 py-1.5 text-sm border-b-2 border-slate-400 bg-transparent focus:outline-none focus:border-indigo-500"
        />
        {/* Print view */}
        <div className="print-only border-b-2 border-black pb-1 min-h-[24px] text-sm">
          {(values[dateFieldId] as string) || ''}
        </div>
      </div>
    </div>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────
const LeaseSigningPage: React.FC = () => {
  const token = new URLSearchParams(window.location.search).get('token');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TokenData | null>(null);
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) { setError('No signing token found. Please use the link from your email.'); setLoading(false); return; }
    fetch(`${BASE_URL}/api/sign-lease/?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        if (!r.ok) { const b = await r.json().catch(() => ({})); throw new Error(b.error || 'Invalid or expired link.'); }
        return r.json();
      })
      .then((d: TokenData) => {
        setData(d);
        const init: Record<string, string | boolean> = {};
        (d.fields || []).forEach((f) => { init[f.id] = f.type === 'checkbox' ? false : ''; });
        setValues(init);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const update = useCallback((id: string, val: string | boolean) => {
    setValues((prev) => ({ ...prev, [id]: val }));
  }, []);

  const handleSubmit = async () => {
    if (!data || !token) return;
    setSubmitError(null);
    const missing = (data.fields || []).filter((f) => {
      if (!f.required) return false;
      const v = values[f.id];
      if (f.type === 'checkbox') return v !== true;
      return !v || (typeof v === 'string' && !v.trim());
    });
    if (missing.length > 0) {
      setSubmitError(`Please complete: ${missing.map((f) => f.label).join(', ')}`);
      return;
    }
    setSubmitting(true);
    try {
      const fieldsPayload = (data.fields || []).map((f) => ({
        id: f.id, type: f.type, page: f.page ?? 1,
        x: f.x ?? 0, y: f.y ?? 0, width: f.width ?? 0.1, height: f.height ?? 0.05,
      }));
      const res = await fetch(`${BASE_URL}/api/sign-lease/?token=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values, fields: fieldsPayload }),
      });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || 'Submission failed.'); }
      setDone(true);
    } catch (e: any) {
      setSubmitError(e.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading ──
  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-600 font-medium">Loading your lease…</p>
      </div>
    </div>
  );

  // ── Error ──
  if (error) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
        <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Link Not Valid</h2>
        <p className="text-slate-600 text-sm">{error}</p>
        <p className="text-slate-400 text-xs mt-4">Contact your property manager if you believe this is an error.</p>
      </div>
    </div>
  );

  // ── Done ──
  if (done) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
        <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Lease Signed!</h2>
        <p className="text-slate-600 text-sm mb-1">Thank you, <strong>{data?.tenant_name}</strong>.</p>
        <p className="text-slate-600 text-sm">Your signed lease for <strong>{data?.property_unit}</strong> has been submitted. You will receive a confirmation email shortly.</p>
        <button onClick={() => window.print()}
          className="mt-6 w-full py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 text-sm">
          Save / Print a Copy
        </button>
        <p className="text-slate-400 text-xs mt-4">
          To access your tenant portal, visit <a href="/tenant" className="text-indigo-600 underline">your login page</a>.
        </p>
      </div>
    </div>
  );

  // ── Helpers ──
  const fields = data?.fields ?? [];
  const checkboxFields = fields.filter((f) => f.type === 'checkbox');
  const initialsField = fields.find((f) => f.id === 'tenant_initials');
  const tenantSig = fields.find((f) => f.id === 'tenant_signature');
  const landlordSig = fields.find((f) => f.id === 'landlord_signature');

  const { body, sigIntro } = splitAtSignatures(data?.generated_content ?? '');
  const tenantName = data?.tenant_name ?? '';

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { background: white; }
          .lease-paper { box-shadow: none !important; border: none !important; max-width: 100% !important; }
        }
        @media screen { .print-only { display: none; } }
      `}</style>

      <div className="min-h-screen bg-slate-100 print:bg-white">
        {/* Top bar */}
        <div className="no-print sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm px-4 py-3 flex items-center justify-between">
          <div>
            <p className="font-bold text-slate-900 text-sm">Lease Agreement</p>
            {data && <p className="text-xs text-slate-500">{tenantName} · {data.property_unit}</p>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => window.print()}
              className="px-3 py-1.5 text-xs font-semibold border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Save / Print
            </button>
            <div className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
              Signature Required
            </div>
          </div>
        </div>

        {/* Document */}
        <div className="max-w-3xl mx-auto px-4 py-8 print:px-0 print:py-0">
          {/* Fill-in guidance banner */}
          <div className="no-print mb-4 flex items-start gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
            <svg className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z" />
            </svg>
            <span>
              Fields already filled from your application are shown as text. Blank underlined fields and checkboxes
              (<span className="font-semibold">[ ]</span>) are interactive — click or tap to fill them in before signing.
            </span>
          </div>

          <div className="lease-paper bg-white rounded-2xl shadow-md border border-slate-200 p-8 md:p-12 print:rounded-none print:shadow-none print:border-none">

            {/* Body of the lease — blank fields (____) become inputs, [ ] become checkboxes */}
            {renderInteractiveBody(body, values, update)}

            {/* ── SIGNATURES section ── */}
            <div className="mt-8 pt-6 border-t-2 border-slate-300 print:border-black">
              <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wide mb-3 print:text-black">
                Signatures
              </h3>
              {sigIntro && (
                <p className="text-[13px] text-slate-700 mb-5 print:text-black">{sigIntro}</p>
              )}

              {/* Acknowledgements + Initials */}
              {(checkboxFields.length > 0 || initialsField) && (
                <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200 no-print">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Acknowledgements</p>
                  <div className="flex flex-col gap-3 mb-4">
                    {checkboxFields.map((f) => (
                      <label key={f.id} className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${values[f.id] ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 bg-white hover:border-indigo-300'}`}>
                        <input type="checkbox" checked={!!values[f.id]} onChange={(e) => update(f.id, e.target.checked)}
                          className="mt-0.5 w-4 h-4 rounded text-indigo-600 border-slate-400 shrink-0" />
                        <span className="text-sm text-slate-700">
                          {f.label}{f.required && <span className="text-red-500 ml-1">*</span>}
                        </span>
                      </label>
                    ))}
                  </div>
                  {initialsField && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                        Initials{initialsField.required && <span className="text-red-500 ml-0.5">*</span>}
                      </label>
                      <input type="text" maxLength={6}
                        value={(values[initialsField.id] as string) ?? ''}
                        onChange={(e) => update(initialsField.id, e.target.value)}
                        placeholder="e.g. JD"
                        className="w-32 px-3 py-1.5 text-sm border-b-2 border-slate-400 bg-transparent focus:outline-none focus:border-indigo-500" />
                    </div>
                  )}
                </div>
              )}

              {/* Landlord signature block */}
              <div className="mb-8">
                <SigBlock
                  sigField={landlordSig}
                  dateFieldId="landlord_signature_date"
                  signerLabel="Landlord Signature"
                  signerName={data?.type || 'Landlord'}
                  values={values}
                  update={update}
                />
              </div>

              {/* Divider */}
              <div className="border-t border-slate-200 my-6 print:border-slate-400" />

              {/* Tenant signature block */}
              <div className="mb-8">
                <SigBlock
                  sigField={tenantSig}
                  dateFieldId="tenant_signature_date"
                  signerLabel="Tenant Signature"
                  signerName={tenantName}
                  values={values}
                  update={update}
                />
              </div>

              {/* Submit */}
              <div className="mt-6 no-print">
                {submitError && (
                  <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                    {submitError}
                  </div>
                )}
                <button onClick={handleSubmit} disabled={submitting}
                  className="w-full py-3.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm">
                  {submitting ? 'Submitting…' : 'Complete & Sign Lease'}
                </button>
                <p className="text-xs text-slate-400 text-center mt-2">
                  By signing, you agree to all terms stated in this lease.
                </p>
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
};

export default LeaseSigningPage;
