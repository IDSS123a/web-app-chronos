/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { User } from '../types';
import { supabase } from '../lib/supabase-browser';
import { fetchCurrentUser } from '../lib/api-client';
import { ShieldAlert, LogIn, CheckCircle2 } from 'lucide-react';
import idssLogo from '../assets/logos/idss-logo.png';
import imhLogo from '../assets/logos/imh-logo.png';

interface LoginProps {
  onLoginSuccess: (user: User) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: username.trim(),
        password,
      });

      if (signInError) {
        setError('Pogrešno korisničko ime ili lozinka.');
        setLoading(false);
        return;
      }

      const user = await fetchCurrentUser();
      if (!user) {
        setError('Prijava uspješna, ali korisnički profil nije pronađen. Kontaktirajte administratora.');
        setLoading(false);
        return;
      }

      onLoginSuccess(user);
    } catch (err) {
      console.error('[Login] unexpected error:', err);
      setError('Greška prilikom prijave. Pokušajte ponovo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F4F7] flex flex-col justify-between py-12 px-4 sm:px-6 lg:px-8 font-sans">
      {/* Top Brand Centering */}
      <div className="flex-grow flex items-center justify-center">
        <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-3xl shadow-sm border border-slate-200 transition-all duration-300">
          
          {/* Logo / Brand Header */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="bg-slate-900 rounded-xl px-4 py-2.5">
                <img src={idssLogo} alt="Internationale Deutsche Schule Sarajevo" className="h-8 w-auto" />
              </div>
              <div className="bg-slate-900 rounded-xl px-4 py-2.5">
                <img src={imhLogo} alt="International Montessori House Sarajevo" className="h-8 w-auto" />
              </div>
            </div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-widest font-sans uppercase">
              CHRONOS
            </h1>
            <p className="text-[10px] uppercase tracking-widest text-amber-600 font-bold mt-1">
              Sistem za upravljanje rokovima
            </p>
            <div className="mt-3 flex justify-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <span>IDSS SARAJEVO</span>
              <span>•</span>
              <span>MONTESSORI HOUSE</span>
            </div>
          </div>

          {/* Login Form */}
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-[#E30613] p-4 rounded-2xl text-xs font-semibold flex items-start gap-2.5">
                <ShieldAlert className="w-4.5 h-4.5 shrink-0 mt-0.5 text-[#E30613]" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label htmlFor="username-input" className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">
                  Korisničko ime / Email
                </label>
                <input
                  id="username-input"
                  name="username"
                  type="email"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="appearance-none block w-full px-4 py-3 border border-slate-200 rounded-2xl placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors text-sm bg-slate-50/50"
                  placeholder="npr. sekretar@idss.ba"
                />
              </div>

              <div>
                <label htmlFor="password-input" className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">
                  Lozinka
                </label>
                <input
                  id="password-input"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-4 py-3 border border-slate-200 rounded-2xl placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors text-sm bg-slate-50/50"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {/* Long Session Note */}
            <div className="flex items-center justify-between text-[11px] text-slate-500 bg-slate-50 border border-slate-100 p-3 rounded-2xl">
              <span className="flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                Zapamti me na ovom računaru (30 dana)
              </span>
            </div>

            <div>
              <button
                id="login-submit-button"
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-slate-900 text-white font-extrabold text-xs uppercase tracking-widest rounded-full hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 disabled:opacity-50 transition-colors shadow-sm cursor-pointer flex items-center justify-center"
              >
                {loading ? (
                  <span className="flex items-center gap-2 font-extrabold">
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Prijavljivanje...
                  </span>
                ) : (
                  <span className="flex items-center gap-2 font-extrabold">
                    <LogIn className="w-4 h-4 text-amber-500" />
                    Pristupi sistemu
                  </span>
                )}
              </button>
            </div>
          </form>

        </div>
      </div>

      {/* Footer info */}
      <div className="text-center text-xs text-slate-400">
        <p>© 2026 Internationale Deutsche Schule Sarajevo & Montessori House Sarajevo.</p>
        <p className="mt-1">
          Baza podataka na centralnom nalogu: <span className="font-mono text-slate-500">idsssarajevo@gmail.com</span>
        </p>
      </div>
    </div>
  );
}
