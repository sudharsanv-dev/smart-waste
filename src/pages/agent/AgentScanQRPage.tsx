// src/pages/agent/AgentScanQRPage.tsx
// Screen 3: Agent Household QR Scanner & Waste Collection (Phase 3)
// Real optical QR frame decoding via html5-qrcode, camera lifecycle management (hardware allocated on user action,
// released on stop/navigation/late permission), honest torch capability reporting, explicit review and confirmation gate,
// and demo simulation presets strictly hidden in production builds.

import React, { useState, useRef, useEffect } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { agentService } from '../../api/agentService';
import { AgentScanQRResponse } from '../../types/contracts';
import { LoadingSpinner } from '../../components/layout/LoadingEmptyError';
import { getStoreState } from '../../api/mockStore';
import {
  QrCode,
  Camera,
  CameraOff,
  Zap,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Scale,
  ShieldCheck,
  Upload,
  UserCheck,
  FileCheck2,
  RotateCcw,
} from 'lucide-react';
import { ENABLE_DEMO_TOOLS, IS_DEMO } from '../../lib/env';

interface DecodedHousehold {
  qr_payload: string;
  name: string;
  address: string;
  area_code: string;
  consumer_id?: string;
}

export const AgentScanQRPage: React.FC = () => {
  // Camera & Scanner State
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchNotice, setTorchNotice] = useState<string | null>(null);
  const [isDecodingFile, setIsDecodingFile] = useState(false);

  // Scan & Confirmation State (starts with EMPTY scan result)
  const [qrPayload, setQrPayload] = useState<string>('');
  const [decodedHousehold, setDecodedHousehold] = useState<DecodedHousehold | null>(null);
  const [wasteWeight, setWasteWeight] = useState<string>('3.5');
  const [notes, setNotes] = useState<string>('Routine segregated curbside collection');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scanResult, setScanResult] = useState<AgentScanQRResponse | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  // Scanner Instance & Lifecycle Refs
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isStartingRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);

  // Resolve household details from opaque QR payload
  const resolveHouseholdDetails = (payload: string): DecodedHousehold | null => {
    if (!payload || !payload.trim()) return null;
    let matchedConsumer: { user_id?: string; name?: string; area_code?: string; mobile_number?: string } | undefined;
    let matchedHousehold: { id?: string; name?: string; address?: string; area_code?: string; mobile_number?: string } | undefined;

    if (IS_DEMO) {
      try {
        const state = getStoreState();
        matchedConsumer = state.accounts.find((a) => a.qr_payload === payload);
        const consumerMobile = matchedConsumer?.mobile_number;
        matchedHousehold =
          state.households.find((h) => h.qr_payload === payload) ||
          (consumerMobile
            ? state.households.find((h) => h.mobile_number === consumerMobile)
            : undefined);
      } catch {
        // demo store fallback
      }
    }

    if (!matchedConsumer && !matchedHousehold) {
      return null;
    }

    return {
      qr_payload: payload,
      name: matchedConsumer?.name || matchedHousehold?.name || 'Curbside Resident',
      address: matchedHousehold?.address || 'Designated Curbside Address',
      area_code: matchedHousehold?.area_code || matchedConsumer?.area_code || '',
      consumer_id: matchedConsumer?.user_id || matchedHousehold?.id,
    };
  };

  // Called when a QR code is successfully decoded from camera stream or image file
  const handleDecodedQR = async (decodedText: string) => {
    if (!decodedText || !decodedText.trim()) return;
    const trimmed = decodedText.trim();
    setQrPayload(trimmed);
    setScanResult(null);
    setScanError(null);

    // Stop live scanner cleanly after a successful decode
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState?.();
        if (state === Html5QrcodeScannerState.SCANNING || (scannerRef.current as unknown as { isScanning?: boolean }).isScanning) {
          await scannerRef.current.stop();
        }
      } catch {
        // ignore
      }
    }
    setIsCameraActive(false);

    // Populate decoded household for explicit user confirmation
    const details = resolveHouseholdDetails(trimmed);
    setDecodedHousehold(details);
  };

  // Camera Lifecycle: Start camera ONLY on explicit user action
  const startCamera = async () => {
    setCameraError(null);
    setTorchNotice(null);
    setScanError(null);
    if (isStartingRef.current || isCameraActive) return;

    isStartingRef.current = true;
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera API (getUserMedia) is not supported in this browser environment.');
      }

      let scanner = scannerRef.current;
      if (!scanner) {
        scanner = new Html5Qrcode('agent-qr-viewfinder');
        scannerRef.current = scanner;
      }

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          handleDecodedQR(decodedText);
        },
        () => {
          // Normal frame with no QR code detected; keep listening
        }
      );

      // Guard against late permission response if user stopped or navigated away
      if (!isMountedRef.current || !isStartingRef.current) {
        try {
          await scanner.stop();
          scanner.clear();
        } catch {
          // ignore
        }
        return;
      }

      setIsCameraActive(true);
    } catch (err: unknown) {
      if (!isMountedRef.current) return;
      setIsCameraActive(false);
      const errStr = (err as { message?: string })?.message || String(err);
      if (
        errStr.toLowerCase().includes('permission') ||
        errStr.toLowerCase().includes('notallowed') ||
        errStr.toLowerCase().includes('denied')
      ) {
        setCameraError(
          'Camera permission was denied by user or security policy. Please allow camera permissions to scan household placards.'
        );
      } else {
        setCameraError(`Camera initialization failed: ${errStr}`);
      }
    } finally {
      isStartingRef.current = false;
    }
  };

  // Camera Lifecycle: Release camera hardware on stop or navigation
  const stopCamera = async () => {
    isStartingRef.current = false;
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState?.();
        if (state === Html5QrcodeScannerState.SCANNING || (scannerRef.current as unknown as { isScanning?: boolean }).isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (err) {
        console.warn('Error releasing camera scanner:', err);
      }
    }
    setIsCameraActive(false);
    setTorchOn(false);
    setTorchNotice(null);
  };

  // Torch / Flashlight Control with honest fallback handling
  const toggleTorch = async () => {
    setTorchNotice(null);
    if (!scannerRef.current || !isCameraActive) return;
    try {
      const nextTorch = !torchOn;
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: nextTorch } as MediaTrackConstraintSet],
      });
      setTorchOn(nextTorch);
    } catch {
      setTorchOn(false);
      setTorchNotice('Torch / flashlight is not supported by this camera hardware or browser.');
    }
  };

  // Image File QR Decoder (Known QR code image testing)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsDecodingFile(true);
    setScanError(null);
    setCameraError(null);

    try {
      let scanner = scannerRef.current;
      if (!scanner) {
        scanner = new Html5Qrcode('agent-qr-viewfinder');
        scannerRef.current = scanner;
      }
      const decodedText = await scanner.scanFile(file, true);
      if (decodedText) {
        await handleDecodedQR(decodedText);
      } else {
        setScanError('No readable QR code found in the uploaded image.');
      }
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message || String(err);
      setScanError(`Failed to decode QR code from file: ${msg}`);
    } finally {
      setIsDecodingFile(false);
      e.target.value = '';
    }
  };

  // Reset scan to start fresh
  const handleClearScan = () => {
    setQrPayload('');
    setDecodedHousehold(null);
    setScanResult(null);
    setScanError(null);
  };

  // Unmount cleanup: release camera hardware on route change or navigation
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      isStartingRef.current = false;
      if (scannerRef.current) {
        try {
          const state = scannerRef.current.getState?.();
          if (state === Html5QrcodeScannerState.SCANNING || (scannerRef.current as unknown as { isScanning?: boolean }).isScanning) {
            scannerRef.current
              .stop()
              .then(() => scannerRef.current?.clear())
              .catch(() => {});
          } else {
            scannerRef.current.clear();
          }
        } catch {
          // ignore
        }
      }
    };
  }, []);

  // Submit collection ONLY AFTER explicit confirmation
  const handleSubmitCollection = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!qrPayload.trim() || !decodedHousehold) return;

    setIsSubmitting(true);
    setScanResult(null);
    setScanError(null);

    try {
      // Submits proposed contract payload: { qr_payload, consumer_id, waste_weight_kg, notes }
      const res = await agentService.scanCollectionQR({
        qr_payload: qrPayload.trim(),
        consumer_id: decodedHousehold?.consumer_id,
        waste_weight_kg: parseFloat(wasteWeight) || 3.5,
        notes: notes.trim(),
      });

      setScanResult(res);
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { message?: string } }; message?: string };
      const msg = errObj.response?.data?.message || errObj.message || 'Failed to verify and record QR collection.';
      setScanError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="agent-scan-page">
      {/* Header & Camera Controls */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-emerald-600" />
            <h1 className="text-xl font-bold text-gray-900">Household Sanitation QR Scanner</h1>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Optical QR frame decoder powered by html5-qrcode. Point camera at resident QR placard or upload image.
          </p>
        </div>

        {/* Camera Control Buttons */}
        <div className="flex items-center gap-2">
          {!isCameraActive ? (
            <button
              type="button"
              onClick={startCamera}
              data-testid="start-camera-btn"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors shadow-sm"
            >
              <Camera className="w-4 h-4" />
              <span>Start Camera Scanner</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={toggleTorch}
                data-testid="torch-toggle-btn"
                className={`p-2 rounded-lg border text-xs font-semibold transition-colors ${
                  torchOn ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-gray-100 text-gray-700 border-gray-300'
                }`}
                title="Toggle Torch / Flashlight"
              >
                <Zap className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={stopCamera}
                data-testid="stop-camera-btn"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg transition-colors shadow-sm"
              >
                <CameraOff className="w-4 h-4" />
                <span>Stop Camera</span>
              </button>
            </>
          )}

          {/* Known QR Image File Upload Decoder */}
          <label
            htmlFor="upload-qr-file-input"
            data-testid="upload-qr-file-btn"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold text-xs rounded-lg cursor-pointer transition-colors border border-gray-200"
            title="Decode known QR placard image"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{isDecodingFile ? 'Decoding...' : 'Upload Image'}</span>
          </label>
          <input
            id="upload-qr-file-input"
            data-testid="upload-qr-file-input"
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      </div>

      {/* Honest Torch Notification */}
      {torchNotice && (
        <div
          data-testid="torch-notice"
          className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>{torchNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setTorchNotice(null)}
            className="text-amber-800 text-xs font-bold hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Outcome Notification Banners */}
      {scanResult && scanResult.status === 'COLLECTED' && (
        <div
          data-testid="scan-success-banner"
          className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl text-emerald-950 text-xs flex items-start gap-3 shadow-sm"
        >
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="font-bold text-sm text-emerald-900">Collection Recorded Successfully</h3>
            <p className="text-xs text-emerald-800">
              Household collection verified and credited. Receipt ID: <span className="font-mono font-bold">{scanResult.collection_id}</span> • Timestamp: {new Date(scanResult.timestamp).toLocaleTimeString()}.
            </p>
          </div>
        </div>
      )}

      {scanResult && scanResult.status === 'ALREADY_COLLECTED' && (
        <div
          data-testid="scan-duplicate-banner"
          className="p-4 bg-amber-50 border border-amber-300 rounded-2xl text-amber-950 text-xs flex items-start gap-3 shadow-sm"
        >
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="font-bold text-sm text-amber-900">Duplicate Scan Prevented (Idempotent)</h3>
            <p className="text-xs text-amber-800">
              {scanResult.message || 'Household waste collection already completed for today. Duplicate scan ignored.'}
            </p>
          </div>
        </div>
      )}

      {scanError && (
        <div
          data-testid="scan-error-banner"
          className="p-4 bg-rose-50 border border-rose-300 rounded-2xl text-rose-950 text-xs flex items-start gap-3 shadow-sm"
        >
          <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="font-bold text-sm text-rose-900">Collection Verification Failed</h3>
            <p className="text-xs text-rose-800">{scanError}</p>
          </div>
        </div>
      )}

      {/* Main Scanner Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Optical Viewfinder Box */}
        <div className="bg-slate-900 rounded-2xl p-4 text-white text-center flex flex-col items-center justify-center min-h-[340px] relative overflow-hidden border border-slate-800 shadow-md">
          {/* html5-qrcode viewfinder container */}
          <div
            id="agent-qr-viewfinder"
            data-testid="camera-video-stream"
            className={`w-full max-w-sm aspect-square overflow-hidden rounded-xl ${
              isCameraActive ? 'block' : 'hidden'
            }`}
          />

          {!isCameraActive && (
            <div className="space-y-3 p-6">
              <div className="w-16 h-16 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                <CameraOff className="w-8 h-8" />
              </div>
              <h3 className="text-sm font-bold text-slate-200">Optical Camera Standby</h3>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Camera is unallocated. Click "Start Camera Scanner" above or upload a known QR image to decode household placards.
              </p>
              {cameraError && (
                <p className="text-xs text-rose-400 max-w-xs mx-auto mt-2 bg-rose-950/40 p-2.5 rounded-lg border border-rose-800/40">
                  {cameraError}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Confirmation Review Card or Demo Simulation Panel */}
        <div className="space-y-4">
          {/* Explicit Confirmation Gate: Displayed once QR is decoded */}
          {qrPayload ? (
            <div
              data-testid="scan-confirmation-card"
              className={`bg-white rounded-2xl border-2 p-6 shadow-sm space-y-4 ${
                decodedHousehold ? 'border-emerald-500/80' : 'border-rose-400'
              }`}
            >
              {decodedHousehold ? (
                <>
                  <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <UserCheck className="w-5 h-5 text-emerald-600" />
                      <h3 className="text-sm font-bold text-gray-900">Confirm Household Collection</h3>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                      QR Decoded
                    </span>
                  </div>

                  {/* Decoded Household Summary */}
                  <div className="bg-gray-50 rounded-xl p-3.5 space-y-2 border border-gray-200 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500 font-medium">Resident:</span>
                      <strong className="text-gray-900 font-bold" data-testid="decoded-resident-name">
                        {decodedHousehold.name}
                      </strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500 font-medium">Assigned Ward:</span>
                      <span className="font-semibold text-gray-800" data-testid="decoded-ward">
                        Ward {decodedHousehold.area_code}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500 font-medium">Address:</span>
                      <span className="text-gray-700" data-testid="decoded-address">
                        {decodedHousehold.address}
                      </span>
                    </div>
                    <div className="flex justify-between items-start">
                      <span className="text-gray-500 font-medium">Placard Token:</span>
                      <span className="font-mono text-[11px] text-gray-700 max-w-[200px] truncate" data-testid="decoded-token">
                        {qrPayload}
                      </span>
                    </div>
                  </div>

                  {/* Collection Parameters */}
                  <form onSubmit={handleSubmitCollection} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                          Waste Weight (KG)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            max="100"
                            value={wasteWeight}
                            onChange={(e) => setWasteWeight(e.target.value)}
                            data-testid="scan-weight-input"
                            className="w-full text-xs font-bold p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none pl-8"
                          />
                          <Scale className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-3" />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                          Segregation Check
                        </label>
                        <div className="p-2.5 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-lg border border-emerald-200 text-center flex items-center justify-center gap-1">
                          <FileCheck2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Segregated (Pass)</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                        Field Collection Notes
                      </label>
                      <input
                        type="text"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        data-testid="scan-notes-input"
                        className="w-full text-xs p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        data-testid="submit-scan-btn"
                        className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-2"
                      >
                        {isSubmitting ? (
                          <LoadingSpinner size="sm" label="Verifying & Recording..." />
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Confirm & Record Collection</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={handleClearScan}
                        data-testid="clear-scan-btn"
                        className="p-2.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-colors border border-gray-200"
                        title="Clear and scan another"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                /* Unrecognized Household State */
                <div data-testid="household-not-recognized-state" className="space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                    <div className="flex items-center gap-2 text-rose-600">
                      <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
                      <h3 className="text-sm font-bold text-gray-900" data-testid="household-not-recognized-title">
                        Household not recognized
                      </h3>
                    </div>
                    <span className="text-[10px] font-bold text-rose-800 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
                      Unregistered Token
                    </span>
                  </div>

                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 text-xs text-rose-900 space-y-1.5">
                    <p className="font-semibold">
                      This QR placard token is not registered in the sanitation database.
                    </p>
                    <p className="text-[11px] text-rose-700">
                      Scanned Token: <span className="font-mono font-bold" data-testid="decoded-token">{qrPayload}</span>
                    </p>
                    <p className="text-[11px] text-rose-700 font-medium">
                      Confirmation is disabled until a valid registered household placard is scanned or resolved.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      disabled={true}
                      data-testid="submit-scan-btn"
                      className="flex-1 py-2.5 px-4 bg-gray-200 text-gray-400 font-bold text-xs rounded-xl cursor-not-allowed shadow-none border border-gray-300"
                    >
                      Confirmation Disabled (Household Not Recognized)
                    </button>

                    <button
                      type="button"
                      onClick={handleClearScan}
                      data-testid="clear-scan-btn"
                      className="p-2.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-colors border border-gray-200"
                      title="Clear and scan another"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-8 text-center space-y-2">
              <QrCode className="w-8 h-8 text-gray-300 mx-auto" />
              <h3 className="text-xs font-bold text-gray-700">Awaiting Household QR Scan</h3>
              <p className="text-[11px] text-gray-400 max-w-xs mx-auto">
                Start the camera scanner or upload an image of a resident placard to decode and verify collection.
              </p>
            </div>
          )}

          {/* Demo Scan Simulation & Preset Panel (Strictly Hidden on Production Builds) */}
          {IS_DEMO && ENABLE_DEMO_TOOLS && (
            <div
              data-testid="demo-scan-simulation-panel"
              className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs space-y-3"
            >
              <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-xs font-bold text-gray-900">Scan Simulation (Demo Mode Only)</h3>
                </div>
                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  Hidden on Prod
                </span>
              </div>

              {/* Fast Presets */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-gray-500 uppercase">Fast Presets:</span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleDecodedQR('GPC-QR-CONS-C1D2E3F4A5B67890')}
                    data-testid="simulate-scan-john-btn"
                    className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg transition-colors"
                  >
                    John Doe (Ward 600001)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDecodedQR('GPC-QR-CONS-UNRELATED999')}
                    data-testid="simulate-scan-unknown-btn"
                    className="px-2.5 py-1 text-[11px] font-semibold bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-lg transition-colors"
                  >
                    Unrecognized Token
                  </button>
                </div>
              </div>

              {/* Manual Token Input */}
              <div>
                <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">
                  Manual Opaque Token Input
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={qrPayload}
                    onChange={(e) => {
                      const val = e.target.value;
                      setQrPayload(val);
                      if (val) setDecodedHousehold(resolveHouseholdDetails(val));
                      else setDecodedHousehold(null);
                    }}
                    data-testid="scan-qr-input"
                    className="flex-1 text-xs font-mono font-bold p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    placeholder="e.g. GPC-QR-CONS-..."
                  />
                </div>
              </div>

              <div className="text-[10px] text-gray-400 pt-2 border-t border-gray-100 flex items-center gap-1.5">
                <ShieldCheck className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                <span>Calls proposed POST /api/v1/agent/collections/scan-qr (Section 4)</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgentScanQRPage;
