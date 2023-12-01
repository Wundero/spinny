"use client";
import React, { useEffect, useRef, useState } from "react";

export type WheelProps<T> = {
  segments: T[];
  displayText: (segment: T) => string;
  segColors: string[];
  winningSegment?: T;
  onFinished: (winner: T) => void;
  buttonText?: string;
  size?: number;
  upDuration?: number;
  downDuration?: number;
  fontFamily?: string;
};

const COLORS = ["red", "blue", "green"];

export function WheelComponent<T>({
  segments,
  segColors,
  winningSegment,
  onFinished,
  displayText,
  buttonText = "Spin",
  size = 290,
  upDuration = 100,
  downDuration = 1000,
  fontFamily = "proxima-nova",
}: WheelProps<T>) {
  const currentSegment = useRef<T | null>(null);
  const [isStarted, setStarted] = useState(false);
  const timerHandle = useRef<NodeJS.Timer | null>(null);
  const wheelRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timerDelay = segments.length;
  let angleCurrent = 0;
  let angleDelta = 0;
  let canvasContext: CanvasRenderingContext2D | null = null;
  let maxSpeed = Math.PI / segments.length;
  const upTime = segments.length * upDuration;
  const downTime = segments.length * downDuration;
  let spinStart = 0;
  let frames = 0;
  const centerX = 300;
  const centerY = 300;
  useEffect(() => {
    wheelInit();
    setTimeout(() => {
      window.scrollTo(0, 1);
    }, 0);
  }, []);
  const wheelInit = () => {
    initCanvas();
    wheelDraw();
  };

  const initCanvas = () => {
    if (!canvasRef.current || !wheelRef.current) return;
    let canvas = canvasRef.current;
    console.log(navigator);
    if (navigator.userAgent.indexOf("MSIE") !== -1) {
      canvas = document.createElement("canvas");
      canvas.setAttribute("width", "1000");
      canvas.setAttribute("height", "600");
      canvas.setAttribute("id", "canvas");
      wheelRef.current.appendChild(canvas);
    }
    canvas.addEventListener("click", spin, false);
    canvasContext = canvas.getContext("2d");
  };
  const spin = () => {
    setStarted(true);
    if (!timerHandle.current) {
      spinStart = new Date().getTime();
      // maxSpeed = Math.PI / ((segments.length*2) + Math.random())
      maxSpeed = Math.PI / segments.length;
      frames = 0;
      timerHandle.current = setInterval(onTimerTick, timerDelay);
    }
  };
  const onTimerTick = () => {
    frames++;
    draw();
    const duration = new Date().getTime() - spinStart;
    let progress = 0;
    let finished = false;
    if (duration < upTime) {
      progress = duration / upTime;
      angleDelta = maxSpeed * Math.sin((progress * Math.PI) / 2);
    } else {
      if (winningSegment) {
        if (
          currentSegment.current === winningSegment &&
          frames > segments.length
        ) {
          progress = duration / upTime;
          angleDelta =
            maxSpeed * Math.sin((progress * Math.PI) / 2 + Math.PI / 2);
          progress = 1;
        } else {
          progress = duration / downTime;
          angleDelta =
            maxSpeed * Math.sin((progress * Math.PI) / 2 + Math.PI / 2);
        }
      } else {
        progress = duration / downTime;
        angleDelta =
          maxSpeed * Math.sin((progress * Math.PI) / 2 + Math.PI / 2);
      }
      if (progress >= 1) finished = true;
    }

    angleCurrent += angleDelta;
    while (angleCurrent >= Math.PI * 2) angleCurrent -= Math.PI * 2;
    if (finished) {
      onFinished(currentSegment.current!);
      if (timerHandle.current) {
        clearInterval(timerHandle.current);
      }
      timerHandle.current = null;
      angleDelta = 0;
    }
  };

  const wheelDraw = () => {
    clear();
    drawWheel();
    drawNeedle();
  };

  const draw = () => {
    clear();
    drawWheel();
    drawNeedle();
  };

  const drawSegment = (key: number, lastAngle: number, angle: number) => {
    if (!canvasContext) return;
    const ctx = canvasContext;
    const value = segments[key]!;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, size, lastAngle, angle, false);
    ctx.lineTo(centerX, centerY);
    ctx.closePath();
    ctx.fillStyle = segColors[key] ?? COLORS[key % COLORS.length]!;
    ctx.fill();
    ctx.stroke();
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate((lastAngle + angle) / 2);
    ctx.fillStyle = "black";
    ctx.font = "bold 1em " + fontFamily;
    ctx.fillText(displayText(value).slice(0, 21), size / 2 + 20, 0);
    ctx.restore();
  };

  const drawWheel = () => {
    if (!canvasContext) return;
    const ctx = canvasContext;
    let lastAngle = angleCurrent;
    const len = segments.length;
    const PI2 = Math.PI * 2;
    ctx.lineWidth = 1;
    ctx.strokeStyle = "white";
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.font = "1em " + fontFamily;
    for (let i = 1; i <= len; i++) {
      const angle = PI2 * (i / len) + angleCurrent;
      drawSegment(i - 1, lastAngle, angle);
      lastAngle = angle;
    }

    // Draw a center circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, 50, 0, PI2, false);
    ctx.closePath();
    ctx.fillStyle = "white";
    ctx.lineWidth = 10;
    ctx.strokeStyle = "black";
    ctx.fill();
    ctx.font = "bold 1em " + fontFamily;
    ctx.fillStyle = "black";
    ctx.textAlign = "center";
    ctx.fillText(buttonText, centerX, centerY + 3);
    ctx.stroke();

    // Draw outer circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, size, 0, PI2, false);
    ctx.closePath();

    ctx.lineWidth = 10;
    ctx.strokeStyle = "white";
    ctx.stroke();
  };

  const drawNeedle = () => {
    if (!canvasContext) return;
    const ctx = canvasContext;
    ctx.lineWidth = 1;
    ctx.strokeStyle = "black";
    ctx.fillStyle = "black";
    ctx.beginPath();
    ctx.moveTo(centerX + 20, centerY - 50);
    ctx.lineTo(centerX - 20, centerY - 50);
    ctx.lineTo(centerX, centerY - 70);
    ctx.closePath();
    ctx.fill();
    const change = angleCurrent + Math.PI / 2;
    let i =
      segments.length -
      Math.floor((change / (Math.PI * 2)) * segments.length) -
      1;
    if (i < 0) i = i + segments.length;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "white";
    ctx.font = "bold 1.5em " + fontFamily;
    currentSegment.current = segments[i]!;
    isStarted &&
      ctx.fillText(
        displayText(segments[i]!),
        centerX + 10,
        centerY + size + 50,
      );
  };
  const clear = () => {
    if (!canvasContext) return;
    const ctx = canvasContext;
    ctx.clearRect(0, 0, 1000, 800);
  };
  return (
    <div ref={wheelRef}>
      <canvas
        ref={canvasRef}
        width="1000"
        height="800"
      />
    </div>
  );
}
