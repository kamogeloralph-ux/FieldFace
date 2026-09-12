import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "../lib/trpc";
import { getCurrentPosition } from "../lib/geolocation";
import { cacheEmployeeStatus, getCachedEmployeeStatus, queueClock, syncQueuedClocks } from "../lib/offlineClock";

type Stage = "idle" | "camera" | "preview" | "submitting" | "done";

export default function ClockScreen() {
  const navigate = useNavigate();
  const me = trpc.auth.employeeMe.useQuery();
  const status = trpc.timeEntries.status.useQuery(undefined, {
    enabled: !!me.data,
    placeholderData: () => getCachedEmployeeStatus(),
  });
  const utils = trpc.useUtils();
  const clock = trpc.timeEntries.clock.useMutation();
  const logout = trpc.auth.employeeLogout.useMutation();

  const [stage, setStage] = useState<Stage>("idle");
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ withinGeofence: boolean; distanceMeters: number; entryType: string; queued?: boolean } | null>(null);
  const [offline, setOffline] = useState(() => !navigator.onLine);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (me.isSuccess && me.data === null) navigate("/");
  }, [me.isSuccess, me.data, navigate]);

  useEffect(() => {
    return () => stopCamera();
  }, []);

  useEffect(() => {
    if (status.data) cacheEmployeeStatus(status.data);
  }, [status.data]);

  useEffect(() => {
    const sync = async () => {
      setOffline(false);
      try {
        await syncQueuedClocks(async (payload) => clock.mutateAsync(payload));
        await utils.timeEntries.status.invalidate();
      } catch {
        setOffline(true);
      }
    };
    const goOffline = () => setOffline(true);
    window.addEventListener("online", sync);
    window.addEventListener("offline", goOffline);
    if (navigator.onLine) void sync();
    return () => { window.removeEventListener("online", sync); window.removeEventListener("offline", goOffline); };
  }, []);

  async function startCamera() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 960 } },
        audio: false,
      });
      streamRef.current = stream;
      setStage("camera");
      // Video element mounts on next render; attach once available.
      setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      }, 0);
    } catch {
      setError("Couldn't access your camera. Please allow camera access and try again.");
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  function takePhoto() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Mirror the image so it matches what the employee sees (front camera).
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    setPhotoDataUrl(canvas.toDataURL("image/jpeg", 0.85));
    stopCamera();
    setStage("preview");
  }

  function retake() {
    setPhotoDataUrl(null);
    startCamera();
  }

  async function confirmAndSubmit() {
    if (!photoDataUrl || !status.data) return;
    setStage("submitting");
    setError(null);
    try {
      const pos = await getCurrentPosition();
      const payload = {
        entryType: status.data.nextAction,
        selfieBase64: photoDataUrl,
        latitude: pos.latitude,
        longitude: pos.longitude,
        gpsAccuracyMeters: pos.accuracy,
      };
      let res: { withinGeofence: boolean; distanceMeters: number; entryType: string };
      let queued = false;
      try {
        res = await clock.mutateAsync(payload);
      } catch (requestError) {
        if (navigator.onLine) throw requestError;
        await queueClock(payload);
        queued = true;
        res = { withinGeofence: false, distanceMeters: 0, entryType: payload.entryType };
        setOffline(true);
        cacheEmployeeStatus({ ...status.data, nextAction: payload.entryType === "clock_in" ? "clock_out" : "clock_in" });
      }
      setResult({ withinGeofence: res.withinGeofence, distanceMeters: res.distanceMeters, entryType: res.entryType, queued });
      setStage("done");
      utils.timeEntries.status.invalidate();
      utils.timeEntries.myShifts.invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setStage("preview");
    }
  }

  if (me.isLoading || status.isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">Loading...</div>;
  }

  const nextAction = status.data?.nextAction ?? "clock_in";
  const actionLabel = nextAction === "clock_in" ? "Clock In" : "Clock Out";

  return (
    <div className="min-h-screen max-w-sm mx-auto flex flex-col px-5 py-6">
      <header className="flex items-center justify-between mb-5">
        <div>
          <p className="text-xs text-slate-500">Logged in as</p>
          <p className="font-semibold text-slate-800">{me.data?.fullName}</p>
        </div>
        <div className="flex gap-2">
          <button className="text-sm text-slate-500 underline" onClick={() => navigate("/history")}>
            History
          </button>
          <button className="text-sm text-slate-500 underline" onClick={() => navigate("/payslips")}>
            Payslips
          </button>
          <button
            className="text-sm text-slate-500 underline"
            onClick={() => logout.mutate(undefined, { onSuccess: () => navigate("/") })}
          >
            Log out
          </button>
        </div>
      </header>

      {offline && <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">Offline mode: clock actions are saved securely and will sync automatically when you reconnect.</div>}

      {stage === "idle" && (
        <div className="space-y-3">
          <button className="btn-primary text-lg py-4" onClick={startCamera}>
            {actionLabel} — Take Selfie
          </button>
          {status.data?.site && (
            <div className="card !p-0 overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-4 py-3 text-left"
                onClick={() => setDetailsOpen((open) => !open)}
                aria-expanded={detailsOpen}
              >
                <span><span className="text-xs text-slate-500 block">Designated area</span><span className="font-semibold text-slate-800">{status.data.site.name}</span></span>
                <span className="text-slate-400 text-xl">{detailsOpen ? "−" : "+"}</span>
              </button>
              {detailsOpen && status.data.site.referencePhotoUrl && (
                <img src={status.data.site.referencePhotoUrl} alt="Designated selfie spot" className="w-full object-cover aspect-video" />
              )}
              {detailsOpen && !status.data.site.referencePhotoUrl && <p className="px-4 pb-3 text-sm text-slate-500">Stand at the designated site before taking your selfie.</p>}
            </div>
          )}
        </div>
      )}

      {stage === "camera" && (
        <div className="flex flex-col items-center gap-4">
          <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-xl -scale-x-100 aspect-[3/4] object-cover bg-black" />
          <button className="btn-primary" onClick={takePhoto}>
            Take Photo
          </button>
          <button className="btn-secondary" onClick={() => { stopCamera(); setStage("idle"); }}>
            Cancel
          </button>
        </div>
      )}

      {stage === "preview" && photoDataUrl && (
        <div className="flex flex-col items-center gap-4">
          <img src={photoDataUrl} alt="Your selfie" className="w-full rounded-xl aspect-[3/4] object-cover" />
          {error && <p className="text-red-600 text-sm text-center">{error}</p>}
          <button className="btn-primary" onClick={confirmAndSubmit}>
            Confirm {actionLabel}
          </button>
          <button className="btn-secondary" onClick={retake}>
            Retake
          </button>
        </div>
      )}

      {stage === "submitting" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-500">
          <p>Getting your location and submitting...</p>
        </div>
      )}

      {stage === "done" && result && (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl ${result.withinGeofence ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
            {result.withinGeofence ? "✓" : "!"}
          </div>
          <p className="text-lg font-semibold text-slate-800">
            {result.queued ? `${result.entryType === "clock_in" ? "Clock in" : "Clock out"} saved offline` : `${result.entryType === "clock_in" ? "Clocked in" : "Clocked out"} successfully`}
          </p>
          {result.queued && <p className="text-sm text-amber-700 max-w-xs">Your selfie and location will be sent when the connection returns.</p>}
          {!result.withinGeofence && (
            <p className="text-amber-700 text-sm max-w-xs">
              You were about {result.distanceMeters}m from the designated area. This has been recorded and flagged for your supervisor.
            </p>
          )}
          <button
            className="btn-secondary"
            onClick={() => {
              setStage("idle");
              setPhotoDataUrl(null);
              setResult(null);
            }}
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}
