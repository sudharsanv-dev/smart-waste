// src/pages/auth/ConsumerRegisterPage.tsx
// New Household Resident Registration (Section 4 // TODO_BACKEND_SATHEESH)
// Generates opaque fixture QR payload, registers resident in selected ward, separate from seeded data

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { consumerService } from '../../api/consumerService';
import { LoadingSpinner, ErrorState } from '../../components/layout/LoadingEmptyError';
import { UserCheck, ShieldAlert, Home, Phone, Mail, MapPin, Lock, ArrowLeft } from 'lucide-react';

const WARD_OPTIONS = [
  { code: '600001', name: '600001 — North Ward (Harbour & Marina Zone)' },
  { code: '600002', name: '600002 — Central Commercial District' },
  { code: '600040', name: '600040 — Anna Nagar Green Enclave' },
  { code: '600096', name: '600096 — South Eco Suburb' },
];

export const ConsumerRegisterPage: React.FC = () => {
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [areaCode, setAreaCode] = useState('600001');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successPayload, setSuccessPayload] = useState<{
    userId: string;
    qrToken: string;
    areaCode: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanMobile = mobileNumber.trim();
    if (!/^\d{10}$/.test(cleanMobile)) {
      setErrorMessage('Mobile number must be exactly 10 digits.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await consumerService.register({
        name: name.trim(),
        mobile_number: cleanMobile,
        email: email.trim() || `${cleanMobile}@resident.greenpulse.city`,
        address: address.trim(),
        area_code: areaCode,
        password,
      });

      setSuccessPayload({
        userId: res.user_id,
        qrToken: res.qr_code_payload,
        areaCode: res.area_code,
      });
    } catch (err: unknown) {
      console.error('Registration failed:', err);
      const msg = err instanceof Error ? err.message : 'Registration failed. Please try again.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8" data-testid="consumer-register-page">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white mx-auto flex items-center justify-center font-bold text-2xl shadow-sm mb-3">
          ♻️
        </div>
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">GreenPulse City</h2>
        <p className="text-xs text-gray-500 mt-1">
          Household Resident Registration • Smart Waste Management System
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg">
        <div className="bg-white py-8 px-4 shadow-sm rounded-2xl border border-gray-200 sm:px-10">
          {successPayload ? (
            <div className="text-center space-y-4" data-testid="register-success-msg">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
                <UserCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Registration Successful!</h3>
              <p className="text-xs text-gray-600">
                Welcome to GreenPulse City Waste Management. Your household has been registered with Ward{' '}
                <span className="font-semibold text-gray-900">{successPayload.areaCode}</span>.
              </p>

              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-left space-y-1.5 text-xs">
                <div className="text-gray-500">Allocated Opaque QR Token:</div>
                <div className="font-mono font-bold text-gray-900 text-xs break-all" data-testid="allocated-qr-token">
                  {successPayload.qrToken}
                </div>
                <div className="text-[10px] text-gray-400 mt-1">
                  * Demo security token. Dues start at ₹0.00. Ready for login and scanning.
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  data-testid="register-login-link"
                  onClick={() => navigate('/login', { state: { registeredMobile: mobileNumber.trim() } })}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-sm transition-colors"
                >
                  Proceed to Login
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="border-b border-gray-100 pb-3 mb-2 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Household Details</h3>
                  <span className="text-[11px] text-gray-500">Register new premises for garbage collection</span>
                </div>
                <Link
                  to="/login"
                  data-testid="back-to-login"
                  className="text-xs text-emerald-600 hover:text-emerald-700 font-medium inline-flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Sign In</span>
                </Link>
              </div>

              {errorMessage && <ErrorState message={errorMessage} onRetry={() => setErrorMessage(null)} />}

              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Resident / Head of Household Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Home className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Meera Patel"
                    data-testid="register-name"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Mobile Number & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Mobile Number (10 digits) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      value={mobileNumber}
                      onChange={(e) => setMobileNumber(e.target.value)}
                      placeholder="9876543299"
                      data-testid="register-mobile"
                      className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="meera@example.com"
                      data-testid="register-email"
                      className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Area Code / Ward */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Ward / Area Code <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                  <select
                    value={areaCode}
                    onChange={(e) => setAreaCode(e.target.value)}
                    data-testid="register-area-code"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                  >
                    {WARD_OPTIONS.map((w) => (
                      <option key={w.code} value={w.code}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Street Address <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. 77 Marina Way, North Ward"
                  data-testid="register-address"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {/* Passwords */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min 6 characters"
                      data-testid="register-password"
                      className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Confirm Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm password"
                      data-testid="register-confirm-password"
                      className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Notice */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-[11px] text-amber-900 flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Demo Mode Notice:</strong> Registrations create an isolated household record with an opaque QR token. Newly registered residents start with ₹0.00 dues, completely separate from seeded households.
                </span>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                data-testid="register-submit-btn"
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 mt-4"
              >
                {isLoading ? (
                  <LoadingSpinner size="sm" label="Registering household..." />
                ) : (
                  <span>Register Household & Generate QR</span>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConsumerRegisterPage;
