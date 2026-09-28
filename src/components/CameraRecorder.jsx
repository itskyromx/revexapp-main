import { useRef, useState, useEffect } from "react";
import { SwitchCamera, X, Check, RotateCcw, Loader2 } from "lucide-react";

const MAX_SECONDS = 60;

function pickMime() {
  const types = [
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  for (const t of types) {
    if (window.MediaRecorder && MediaRecorder.isTypeSupported(t)) return t;
  }
  return "video/webm";
}

export default function CameraRecorder({ onRecorded, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const blobRef = useRef(null);
  const [facing, setFacing] = useState("user");
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let active = true;
    setStarting(true);
    setError("");
    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing },
          audio: true,
        });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (e) {
        if (active) setError(e.message || "Camera unavailable");
      } finally {
        if (active) setStarting(false);
      }
    };
    start();
    return () => {
      active = false;
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, [facing]);

  const toggleCamera = () =>
    setFacing((f) => (f === "user" ? "environment" : "user"));

  const stopRec = () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const startRec = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const mime = pickMime();
    const mr = new MediaRecorder(streamRef.current, { mimeType: mime });
    mr.ondataavailable = (e) => {
      if (e.data && e.data.size) chunksRef.current.push(e.data);
    };
    mr.onstop = () => {
      const type = mr.mimeType || mime;
      const blob = new Blob(chunksRef.current, { type });
      blobRef.current = blob;
      setPreviewUrl(URL.createObjectURL(blob));
    };
    mr.start();
    recorderRef.current = mr;
    setRecording(true);
    setSeconds(0);
    timerRef.current = setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= MAX_SECONDS) {
          stopRec();
          return MAX_SECONDS;
        }
        return s + 1;
      });
    }, 1000);
  };

  const retake = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    blobRef.current = null;
    setPreviewUrl(null);
    setSeconds(0);
  };

  const useClip = async () => {
    if (!blobRef.current) return;
    setUploading(true);
    try {
      const ext = blobRef.current.type.includes("mp4") ? "mp4" : "webm";
      const file = new File(
        [blobRef.current],
        `haul-${Date.now()}.${ext}`,
        { type: blobRef.current.type }
      );
      await onRecorded(file, previewUrl);
    } finally {
      setUploading(false);
    }
  };

  if (error) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center text-white p-6 text-center">
        <p className="font-display uppercase text-lg mb-2">Camera unavailable</p>
        <p className="text-sm text-white/70 mb-4">{error}</p>
        <button onClick={onClose} className="acid-btn bg-white text-black">
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {previewUrl ? (
        <video
          src={previewUrl}
          className="flex-1 w-full object-cover"
          autoPlay
          loop
          muted
          playsInline
        />
      ) : (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="flex-1 w-full object-cover"
        />
      )}

      <div className="absolute top-0 inset-x-0 p-4 flex items-center justify-between">
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full flex items-center justify-center bg-black/50 text-white border-2 border-white/30"
        >
          <X className="w-5 h-5" />
        </button>
        {recording && (
          <span className="px-3 py-1 flex items-center gap-1.5 bg-brand-red text-white font-heading text-sm border-2 border-white/30">
            <span className="w-2 h-2 bg-white rounded-full blink" />
            {String(seconds).padStart(2, "0")}s
          </span>
        )}
      </div>

      <div className="absolute bottom-0 inset-x-0 pb-8 pt-6 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-center gap-10">
        {previewUrl ? (
          <>
            <button
              onClick={retake}
              className="flex flex-col items-center gap-1 text-white"
            >
              <span className="w-14 h-14 rounded-full flex items-center justify-center bg-white/15 text-white border-2 border-white/40">
                <RotateCcw className="w-6 h-6" />
              </span>
              <span className="text-[10px] font-heading uppercase">Retake</span>
            </button>
            <button
              onClick={useClip}
              disabled={uploading}
              className="flex flex-col items-center gap-1 text-white"
            >
              <span className="w-16 h-16 rounded-full flex items-center justify-center bg-brand-red text-white border-2 border-white">
                {uploading ? (
                  <Loader2 className="w-7 h-7 animate-spin" />
                ) : (
                  <Check className="w-8 h-8" strokeWidth={3} />
                )}
              </span>
              <span className="text-[10px] font-heading uppercase">Use</span>
            </button>
          </>
        ) : (
          <>
            <button
              onClick={toggleCamera}
              className="flex flex-col items-center gap-1 text-white"
            >
              <span className="w-12 h-12 rounded-full flex items-center justify-center bg-white/15 text-white border-2 border-white/40">
                <SwitchCamera className="w-6 h-6" />
              </span>
              <span className="text-[10px] font-heading uppercase">Flip</span>
            </button>
            <button
              onClick={recording ? stopRec : startRec}
              className="flex flex-col items-center gap-1"
            >
              <span
                className={`w-20 h-20 rounded-full border-[5px] flex items-center justify-center ${
                  recording ? "border-brand-red" : "border-white"
                }`}
              >
                <span
                  className={`rounded-full bg-brand-red ${
                    recording ? "w-8 h-8" : "w-16 h-16"
                  }`}
                />
              </span>
              <span className="text-[10px] font-heading uppercase text-white">
                {recording ? "Stop" : "Record"}
              </span>
            </button>
            <div className="w-12" />
          </>
        )}
      </div>

      {starting && (
        <div className="absolute inset-0 flex items-center justify-center text-white">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      )}
    </div>
  );
}