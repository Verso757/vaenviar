"use client";

import { useEffect, useRef, useState } from "react";

export function SignaturePad() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [dataUrl, setDataUrl] = useState<string>("");
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);

    const context = canvas.getContext("2d");
    if (!context) return;
    context.scale(dpr, dpr);
    context.lineWidth = 2;
    context.lineCap = "round";
    context.strokeStyle = "#111";
  }, []);

  function getPoint(evt: PointerEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: evt.clientX - rect.left,
      y: evt.clientY - rect.top,
    };
  }

  function start(evt: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    canvas.setPointerCapture(evt.pointerId);
    setIsDrawing(true);

    const p = getPoint(evt.nativeEvent, canvas);
    context.beginPath();
    context.moveTo(p.x, p.y);
  }

  function move(evt: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const p = getPoint(evt.nativeEvent, canvas);
    context.lineTo(p.x, p.y);
    context.stroke();
  }

  function end(evt: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      canvas.releasePointerCapture(evt.pointerId);
    } catch {
      // ignore
    }

    setIsDrawing(false);
    setDataUrl(canvas.toDataURL("image/png"));
  }

  function clear() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    context.clearRect(0, 0, canvas.width, canvas.height);
    setDataUrl("");
  }

  return (
    <div className="app-card">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Firma</p>
        <button type="button" className="btn-secondary px-3 py-1 text-xs" onClick={clear}>
          Limpiar
        </button>
      </div>

      <div className="mt-3">
        <canvas
          ref={canvasRef}
          className="h-40 w-full touch-none rounded border bg-white"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          onPointerLeave={end}
        />
      </div>

      <input type="hidden" name="signatureData" value={dataUrl} />
    </div>
  );
}
