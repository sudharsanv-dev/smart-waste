// src/pages/consumer/ConsumerQRPage.tsx
// Screen 3: Household QR Code Profile (Phase 2)
// High-contrast QR code display using qrcode.react, opaque fixture token display, fullscreen bright-view, download mock, and security notice

import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { QRCodeSVG } from 'qrcode.react';
import { QrCode, Maximize2, Minimize2, Download, ShieldAlert, CheckCircle } from 'lucide-react';

export const ConsumerQRPage: React.FC = () => {
  const { user } = useAuth();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);

  const qrPayload = user?.qr_payload || 'GPC-QR-CONS-C1D2E3F4A5B67890';
  const householdName = user?.name || 'Resident';
  const areaCode = user?.area_code || '600001';

  const handleCopy = () => {
    navigator.clipboard?.writeText(qrPayload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    // Demo download simulation
    const svg = document.getElementById('consumer-qr-svg');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `GreenPulse-Household-QR-${areaCode}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6" data-testid="consumer-qr-page">
      {/* Page Header */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-emerald-600" />
            <h1 className="text-xl font-bold text-gray-900">Household Sanitation QR Code</h1>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Display this digital placard for verification by your designated waste collection agent.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsFullscreen(true)}
            data-testid="fullscreen-qr-toggle"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold rounded-lg transition-colors"
          >
            <Maximize2 className="w-4 h-4" />
            <span>Fullscreen Bright-View</span>
          </button>

          <button
            type="button"
            onClick={handleDownload}
            data-testid="download-qr-btn"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 text-xs font-semibold rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Download Placard</span>
          </button>
        </div>
      </div>

      {/* Main QR Card */}
      <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-xs max-w-xl mx-auto text-center space-y-6">
        <div className="space-y-1">
          <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider bg-emerald-50 px-2.5 py-0.5 rounded-full inline-block">
            Corporation of GreenPulse City
          </span>
          <h2 className="text-lg font-bold text-gray-900 mt-1">{householdName}</h2>
          <p className="text-xs text-gray-500">
            Registered Ward: <span className="font-semibold text-gray-800">{areaCode}</span> • Official Collection Node
          </p>
        </div>

        {/* QR Code Container */}
        <div className="p-6 bg-white border-2 border-dashed border-gray-300 rounded-2xl inline-block shadow-xs">
          <QRCodeSVG
            id="consumer-qr-svg"
            value={qrPayload}
            size={220}
            level="H"
            includeMargin={true}
            className="mx-auto"
          />
        </div>

        {/* Monospace Opaque Token Display */}
        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-left space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
              Opaque Security Token:
            </span>
            <button
              type="button"
              onClick={handleCopy}
              data-testid="copy-qr-token-btn"
              className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold"
            >
              {copied ? 'Copied!' : 'Copy Token'}
            </button>
          </div>
          <div
            className="font-mono font-bold text-sm text-gray-900 break-all select-all bg-white p-2.5 rounded border border-gray-200"
            data-testid="consumer-qr-token-value"
          >
            {qrPayload}
          </div>
          <div className="text-[11px] text-gray-500 flex items-center gap-1.5 pt-1">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
            <span>Active & Authorized for Sanitation Agent Scanner</span>
          </div>
        </div>

        {/* Household Placard Details */}
        <div className="grid grid-cols-2 gap-3 text-left text-xs bg-emerald-50/50 p-4 rounded-xl border border-emerald-100">
          <div>
            <span className="text-gray-500 block text-[10px] uppercase font-semibold">Registered Resident</span>
            <span className="font-bold text-gray-900">{householdName}</span>
          </div>
          <div>
            <span className="text-gray-500 block text-[10px] uppercase font-semibold">Contact Mobile</span>
            <span className="font-bold text-gray-900">{user?.mobile_number || '9876543210'}</span>
          </div>
          <div>
            <span className="text-gray-500 block text-[10px] uppercase font-semibold">Service Area</span>
            <span className="font-bold text-gray-900">Ward {areaCode}</span>
          </div>
          <div>
            <span className="text-gray-500 block text-[10px] uppercase font-semibold">Token Type</span>
            <span className="font-bold text-emerald-800">Opaque Fixture Key</span>
          </div>
        </div>
      </div>

      {/* Security & Stale Token Notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-amber-900 text-xs space-y-2">
        <div className="flex items-center gap-2 font-bold text-amber-950">
          <ShieldAlert className="w-4 h-4 text-amber-600" />
          <span>Security & Token Lifecycle Disclosure (TODO_BACKEND_SATHEESH)</span>
        </div>
        <p className="text-[11px] leading-relaxed text-amber-900">
          <strong>Privacy Guaranteed:</strong> This QR code encodes an opaque, random fixture identifier (e.g. <code>GPC-QR-CONS-...</code>). It never encodes raw telephone numbers, unencrypted passwords, or sensitive personal credentials. The visual output from <code>qrcode.react</code> is an optical symbology encoding, not client-side encryption. Stale or compromised tokens can be immediately revoked and reissued from the Municipal Administration Console.
        </p>
      </div>

      {/* Fullscreen Bright-View Modal */}
      {isFullscreen && (
        <div
          data-testid="fullscreen-qr-modal"
          className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center p-6 text-center select-none"
        >
          <div className="max-w-md w-full space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-gray-100">
              <div className="text-left">
                <span className="text-xs uppercase font-bold text-emerald-700">GreenPulse City</span>
                <h3 className="text-base font-bold text-gray-900">Agent Scan Placard</h3>
              </div>
              <button
                type="button"
                data-testid="close-fullscreen-qr"
                onClick={() => setIsFullscreen(false)}
                className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
              >
                <Minimize2 className="w-6 h-6" />
              </button>
            </div>

            <div className="p-8 bg-white border-4 border-black rounded-3xl inline-block shadow-2xl">
              <QRCodeSVG value={qrPayload} size={280} level="H" includeMargin={true} />
            </div>

            <div className="space-y-1">
              <div className="font-mono text-sm font-bold text-gray-900 break-all">{qrPayload}</div>
              <div className="text-xs text-gray-500">
                {householdName} • Ward {areaCode}
              </div>
            </div>

            <p className="text-[11px] text-gray-400">
              Increase phone screen brightness to maximum for rapid camera scanner detection.
            </p>

            <button
              type="button"
              onClick={() => setIsFullscreen(false)}
              className="w-full py-2.5 px-4 bg-gray-900 hover:bg-black text-white font-semibold rounded-xl text-xs"
            >
              Exit Fullscreen
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConsumerQRPage;
