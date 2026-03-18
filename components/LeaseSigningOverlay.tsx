import React, { useCallback, useRef, useState, useEffect } from 'react';
import { LeaseSigningField, LeaseSigningMetadata } from '../types';
import { api } from '../services/api';

export type LeaseFormValues = Record<string, string | boolean>;

const DRAW = 'draw';
const UPLOAD = 'upload';
type SignatureMode = typeof DRAW | typeof UPLOAD;

interface SignaturePadProps {
  fieldId: string;
  label: string;
  required?: boolean;
  value: string;
  onChange: (dataUrl: string) => void;
  className?: string;
}

const SignaturePad: React.FC<SignaturePadProps> = ({
  label,
  required,
  value,
  onChange,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<SignatureMode>(DRAW);
  const isDrawing = useRef(false);

  const getCtx = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getContext('2d');
  }, []);

  const setCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const w = Math.round(rect.width * dpr);
    const h = Math.round(rect.height * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
    }
  }, []);

  useEffect(() => {
    setCanvasSize();
    const ctx = getCtx();
    if (ctx && value && mode === DRAW) {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
      };
      img.src = value;
    }
  }, [mode, value, getCtx, setCanvasSize]);

  const start = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      const canvas = canvasRef.current;
      const ctx = getCtx();
      if (!canvas || !ctx) return;
      const x = 'touches' in e ? e.touches[0].clientX - canvas.getBoundingClientRect().left : e.nativeEvent.offsetX;
      const y = 'touches' in e ? e.touches[0].clientY - canvas.getBoundingClientRect().top : e.nativeEvent.offsetY;
      isDrawing.current = true;
      ctx.beginPath();
      ctx.moveTo(x, y);
    },
    [getCtx]
  );

  const move = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      if (!isDrawing.current) return;
      const canvas = canvasRef.current;
      const ctx = getCtx();
      if (!canvas || !ctx) return;
      const x = 'touches' in e ? e.touches[0].clientX - canvas.getBoundingClientRect().left : e.nativeEvent.offsetX;
      const y = 'touches' in e ? e.touches[0].clientY - canvas.getBoundingClientRect().top : e.nativeEvent.offsetY;
      ctx.lineTo(x, y);
      ctx.stroke();
    },
    [getCtx]
  );

  const end = useCallback(() => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const dataUrl = canvas.toDataURL('image/png');
      onChange(dataUrl);
    } catch {
      // ignore
    }
  }, [onChange]);

  const clear = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    onChange('');
  }, [getCtx, onChange]);

  const handleUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const valid = /^image\/(jpeg|jpg|png)$/i.test(file.type);
      if (!valid) return;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const img = new Image();
        img.onload = () => {
          const box = boxRef.current?.getBoundingClientRect();
          const width = box?.width ?? 300;
          const height = box?.height ?? 120;
          const off = document.createElement('canvas');
          off.width = Math.round(width);
          off.height = Math.round(height);
          const ctx = off.getContext('2d');
          if (!ctx) return;
          const scale = Math.min(off.width / img.width, off.height / img.height);
          const w = img.width * scale;
          const h = img.height * scale;
          const x = (off.width - w) / 2;
          const y = (off.height - h) / 2;
          ctx.drawImage(img, x, y, w, h);
          try {
            onChange(off.toDataURL('image/png'));
          } catch {
            // ignore
          }
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    },
    [onChange]
  );

  return (
    <div
      ref={boxRef}
      className={`flex flex-col w-full h-full rounded border border-slate-300 bg-white overflow-hidden ${className}`}
    >
      <div className="flex items-center justify-between gap-1 px-1 py-0.5 border-b border-slate-200 bg-slate-50 shrink-0">
        <span className="text-[10px] md:text-xs font-medium text-slate-700 truncate">
          {label}
          {required ? ' *' : ''}
        </span>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={() => setMode(DRAW)}
            className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${mode === DRAW ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'}`}
          >
            Draw
          </button>
          <label className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-slate-200 text-slate-600 cursor-pointer hover:bg-slate-300">
            Upload
            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg"
              onChange={handleUpload}
              className="sr-only"
              aria-label={`Upload signature image for ${label}`}
            />
          </label>
          {value && (
            <button type="button" onClick={clear} className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-slate-200 text-slate-600 hover:bg-slate-300">
              Clear
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 min-h-0 relative">
        {mode === DRAW && (
          <canvas
            ref={canvasRef}
            onMouseDown={start}
            onMouseMove={move}
            onMouseUp={end}
            onMouseLeave={end}
            onTouchStart={start}
            onTouchMove={move}
            onTouchEnd={end}
            className="w-full h-full block touch-none"
            style={{ width: '100%', height: '100%' }}
            aria-label={label}
          />
        )}
        {mode === UPLOAD && (
          <>
            {value ? (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-50">
                <img src={value} alt="" className="max-w-full max-h-full object-contain" />
                <label className="absolute bottom-1 right-1 px-1.5 py-0.5 text-[10px] font-medium rounded bg-slate-200 text-slate-600 cursor-pointer hover:bg-slate-300">
                  Replace
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg"
                    onChange={handleUpload}
                    className="sr-only"
                    aria-label={`Replace signature for ${label}`}
                  />
                </label>
              </div>
            ) : (
              <label className="absolute inset-0 flex items-center justify-center cursor-pointer bg-slate-50 hover:bg-slate-100 border-2 border-dashed border-slate-300 rounded">
                <span className="text-[10px] md:text-xs text-slate-500 px-2 text-center">PNG or JPEG</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  onChange={handleUpload}
                  className="sr-only"
                  aria-label={`Upload signature for ${label}`}
                />
              </label>
            )}
          </>
        )}
      </div>
    </div>
  );
};

interface LeaseSigningOverlayProps {
  metadata: LeaseSigningMetadata;
  /** When provided (e.g. blob URL from authenticated fetch), used for the PDF viewer instead of metadata.pdfUrl. */
  pdfUrlOverride?: string | null;
  onValuesChange?: (values: LeaseFormValues) => void;
  onSubmitSuccess?: (result: { pdf_url: string; signed_at: string | null }) => void;
  onSubmitError?: (error: Error) => void;
}

const getInitialValues = (fields: LeaseSigningField[]): LeaseFormValues => {
  const out: LeaseFormValues = {};
  fields.forEach((f) => {
    if (f.type === 'checkbox') out[f.id] = false;
    if (f.type === 'text' || f.type === 'signature') out[f.id] = '';
  });
  return out;
};

const LeaseSigningOverlay: React.FC<LeaseSigningOverlayProps> = ({
  metadata,
  pdfUrlOverride,
  onValuesChange,
  onSubmitSuccess,
  onSubmitError,
}) => {
  const { fields, id: documentId } = metadata;
  const pdfUrl = (pdfUrlOverride != null && pdfUrlOverride !== '') ? pdfUrlOverride : metadata.pdfUrl;
  const [values, setValues] = useState<LeaseFormValues>(() => getInitialValues(fields));
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const update = useCallback(
    (id: string, value: string | boolean) => {
      setValues((prev) => {
        const next = { ...prev, [id]: value };
        onValuesChange?.(next);
        return next;
      });
    },
    [onValuesChange]
  );

  const handleSubmit = useCallback(async () => {
    setSubmitMessage(null);
    const requiredFields = fields.filter((f) => f.required);
    const missing = requiredFields.filter((f) => {
      const v = values[f.id];
      if (f.type === 'checkbox') return v !== true;
      if (f.type === 'signature') return !v || (typeof v === 'string' && v.trim() === '');
      return v == null || (typeof v === 'string' && v.trim() === '');
    });
    if (missing.length > 0) {
      setSubmitMessage({ type: 'error', text: 'Please fill all required fields (checkboxes, initials, dates, and signatures).' });
      return;
    }
    setSubmitting(true);
    try {
      const fieldsPayload = fields.map((f) => ({
        id: f.id,
        type: f.type,
        page: f.page,
        x: f.x,
        y: f.y,
        width: f.width,
        height: f.height,
      }));
      const result = await api.submitSignedLease(documentId, { values, fields: fieldsPayload });
      setSubmitMessage({ type: 'success', text: 'Lease signed successfully. Your signed PDF is ready.' });
      onSubmitSuccess?.(result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to submit');
      setSubmitMessage({ type: 'error', text: error.message });
      onSubmitError?.(error);
    } finally {
      setSubmitting(false);
    }
  }, [documentId, fields, values, onSubmitSuccess, onSubmitError]);

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="w-full rounded-xl overflow-hidden bg-slate-900/5 border border-slate-200 shadow-sm">
        <div className="relative w-full max-h-[80vh]">
          {/* PDF viewer */}
          <object
            data={pdfUrl}
            type="application/pdf"
            className="w-full h-[70vh] md:h-[80vh] block"
          >
            <iframe
              src={pdfUrl}
              title="Lease PDF"
              className="w-full h-[70vh] md:h-[80vh] block"
            />
          </object>

          {/* Interactive overlay: checkboxes and text inputs positioned from JSON */}
          <div className="pointer-events-none absolute inset-0">
            {fields.map((field: LeaseSigningField) => (
              <div
                key={field.id}
                className="absolute pointer-events-auto"
                style={{
                  left: `${field.x * 100}%`,
                  top: `${field.y * 100}%`,
                  width: `${field.width * 100}%`,
                  height: `${field.height * 100}%`,
                }}
              >
                  {field.type === 'checkbox' && (
                    <label className="flex items-center justify-center w-full h-full cursor-pointer rounded border border-slate-300 bg-white/95 hover:bg-white focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-1">
                      <input
                        type="checkbox"
                        checked={!!values[field.id]}
                        onChange={(e) => update(field.id, e.target.checked)}
                        required={field.required}
                        className="w-full max-w-[1.2rem] h-full max-h-[1.2rem] min-w-[14px] min-h-[14px] rounded border-slate-400 text-indigo-600 focus:ring-indigo-500"
                        aria-label={field.label}
                        aria-required={field.required}
                      />
                    </label>
                  )}
                  {field.type === 'text' && (
                    <input
                      type="text"
                      value={(values[field.id] as string) ?? ''}
                      onChange={(e) => update(field.id, e.target.value)}
                      required={field.required}
                      placeholder={field.label}
                      className="w-full h-full px-1 py-0.5 text-[10px] md:text-xs border border-slate-300 rounded bg-white/95 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      aria-label={field.label}
                      aria-required={field.required}
                    />
                  )}
                  {field.type === 'signature' && (
                    <SignaturePad
                      fieldId={field.id}
                      label={field.label}
                      required={field.required}
                      value={(values[field.id] as string) ?? ''}
                      onChange={(dataUrl) => update(field.id, dataUrl)}
                      className="min-w-0 min-h-0"
                    />
                  )}
              </div>
            ))}
          </div>
        </div>
      </div>
      {submitMessage && (
        <p
          className={`text-sm font-medium ${submitMessage.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}
          role="alert"
        >
          {submitMessage.text}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="px-5 py-2.5 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? 'Submitting…' : 'Complete & Sign'}
        </button>
        <p className="text-xs md:text-sm text-slate-500">
          Tick checkboxes, enter text, and sign above. Use Draw or Upload for signatures. Layout is responsive on all devices.
        </p>
      </div>
    </div>
  );
};

export default LeaseSigningOverlay;

