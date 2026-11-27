import React, { FormEvent, useState } from 'react';
import { SignIn, useAuth, useClerk, useSignUp } from '@clerk/react';
import { Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { formatPhilippinePhoneNumber, isValidPhilippinePhoneNumber, normalizePhilippinePhoneNumber } from '../philippinePhone';

const USERNAME_PATTERN = /^[a-z][a-z0-9_]{2,19}$/;

export const AuthScreen: React.FC<{ onRegistrationStateChange: (inProgress: boolean) => void }> = ({ onRegistrationStateChange }) => {
  const { signUp, fetchStatus } = useSignUp();
  const { getToken } = useAuth();
  const { signOut } = useClerk();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [surname, setSurname] = useState('');
  const [suffix, setSuffix] = useState('');
  const [gender, setGender] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const register = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const username = name.trim().toLowerCase();
    if (!firstName.trim() || !surname.trim()) {
      setError('Enter your first name and surname.');
      return;
    }
    if (!USERNAME_PATTERN.test(username)) {
      setError('Use 3–20 lowercase letters, numbers, or underscores; start with a letter.');
      return;
    }
    if (!isValidPhilippinePhoneNumber(contactNumber)) {
      setError('Enter a valid Philippine mobile number with 10 digits after +63.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setBusy(true);
    onRegistrationStateChange(true);
    try {
      const { error: signUpError } = await signUp.password({
        username,
        password,
        firstName: firstName.trim(),
        lastName: surname.trim(),
        unsafeMetadata: {
          middleName: middleName.trim(),
          suffix: suffix.trim(),
          gender,
          contactNumber: formatPhilippinePhoneNumber(contactNumber),
        },
      });
      if (signUpError) throw new Error(signUpError.message);
      if (signUp.status !== 'complete') {
        throw new Error('Clerk requires additional signup fields or verification. Enable username signup and disable required email verification in Clerk settings.');
      }

      const finalization = await signUp.finalize();
      if (finalization.error) throw new Error(finalization.error.message);
      const token = await getToken();
      if (!token) throw new Error('Your Clerk session could not be loaded after signup.');
      const response = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: 'save_profile',
          firstName: firstName.trim(),
          middleName: middleName.trim(),
          surname: surname.trim(),
          suffix,
          gender,
          phone: formatPhilippinePhoneNumber(contactNumber),
        }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Your account details could not be saved.');
    } catch (caught) {
      let message = caught instanceof Error ? caught.message : 'Account creation could not be completed.';
      if (signUp.status === 'complete') {
        try {
          await signOut();
        } catch (signOutError) {
          console.error('Incomplete registration could not be signed out:', signOutError);
          message += ' The account could not be signed out automatically; please sign out before retrying.';
        }
      }
      setError(message);
    } finally {
      setBusy(false);
      onRegistrationStateChange(false);
    }
  };

  const signInAppearance = {
    elements: {
      rootBox: '!w-full !min-w-0 !max-w-full',
      cardBox: '!w-full !min-w-0 !max-w-full shadow-none',
      card: '!w-full !min-w-0 !max-w-full border-0 bg-transparent p-0 shadow-none',
      headerTitle: '!text-[#17312e]',
      headerSubtitle: '!text-[#66736f]',
      formFieldLabel: '!text-[#17312e]',
      formFieldInput: 'border border-[#cfd8d2] bg-white !text-[#17312e]',
      formButtonPrimary: 'bg-[#17645c] hover:bg-[#104f49] shadow-none',
      footerActionText: '!text-[#66736f]',
      footerActionLink: '!text-[#17645c]',
    },
  };

  return (
    <main className="min-h-dvh bg-[#eef2ee] px-4 py-8 text-[#17312e] sm:flex sm:items-center sm:justify-center sm:py-12">
      <section className="mx-auto w-full max-w-md border border-[#d9e1dc] bg-[#fbfcfa] shadow-[0_18px_50px_rgba(23,58,55,0.12)]">
        <div className="border-b border-[#dfe6e1] px-6 py-5 sm:px-8">
          <div className="flex items-center gap-3">
            <div>
              <div className="text-sm font-bold">Masikap Health Center</div>
            </div>
          </div>
        </div>

        <div className="px-6 py-7 sm:px-8">
          <h1 className="text-2xl font-bold">{isRegistering ? 'Create an account' : 'Sign in'}</h1>
          {isRegistering && (
            <p className="mt-2 text-sm leading-relaxed text-[#66736f]">
              Create a username and add your patient details.
            </p>
          )}

          {isRegistering ? (
          <form onSubmit={register} className="mt-6 space-y-4">
            {isRegistering && (
              <>
                <label className="block">
                  <span className="mb-2 block text-xs font-bold text-[#17312e]">First name</span>
                  <input value={firstName} onChange={(event) => setFirstName(event.target.value)} autoComplete="given-name" maxLength={80} required className="h-11 w-full border border-[#cfd8d2] bg-white px-3 text-sm outline-none focus:border-[#17645c] focus:ring-2 focus:ring-[#17645c]/15" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-bold text-[#17312e]">Middle name</span>
                  <input value={middleName} onChange={(event) => setMiddleName(event.target.value)} autoComplete="additional-name" maxLength={80} className="h-11 w-full border border-[#cfd8d2] bg-white px-3 text-sm outline-none focus:border-[#17645c] focus:ring-2 focus:ring-[#17645c]/15" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-bold text-[#17312e]">Surname</span>
                  <input value={surname} onChange={(event) => setSurname(event.target.value)} autoComplete="family-name" maxLength={80} required className="h-11 w-full border border-[#cfd8d2] bg-white px-3 text-sm outline-none focus:border-[#17645c] focus:ring-2 focus:ring-[#17645c]/15" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-bold text-[#17312e]">Sex/Gender</span>
                  <select value={gender} onChange={(event) => setGender(event.target.value)} required className="h-11 w-full border border-[#cfd8d2] bg-white px-3 text-sm outline-none focus:border-[#17645c] focus:ring-2 focus:ring-[#17645c]/15">
                    <option value="" disabled>Select an option</option>
                    <option>Male</option><option>Female</option><option>Other</option><option>Prefer not to say</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-bold text-[#17312e]">Suffix (optional)</span>
                  <select value={suffix} onChange={(event) => setSuffix(event.target.value)} className="h-11 w-full border border-[#cfd8d2] bg-white px-3 text-sm outline-none focus:border-[#17645c] focus:ring-2 focus:ring-[#17645c]/15">
                    <option value="">None</option><option>Jr.</option><option>Sr.</option><option>I</option><option>II</option><option>III</option><option>IV</option><option>V</option>
                  </select>
                </label>
              </>
            )}
            <label className="block">
              <span className="mb-2 block text-xs font-bold text-[#17312e]">Username</span>
              <input value={name} onChange={(event) => setName(event.target.value.toLowerCase())} autoComplete="username" placeholder="3–20 lowercase letters, numbers, or underscores" minLength={3} maxLength={20} pattern="[a-z][a-z0-9_]{2,19}" required className="h-11 w-full border border-[#cfd8d2] bg-white px-3 text-sm outline-none transition-colors focus:border-[#17645c] focus:ring-2 focus:ring-[#17645c]/15" />
            </label>
            {isRegistering && (
              <label className="block">
                <span className="mb-2 block text-xs font-bold text-[#17312e]">Contact number</span>
                <div className="flex">
                  <span className="inline-flex items-center border border-r-0 border-[#cfd8d2] bg-[#f7f9f8] px-3 text-sm text-[#66736f]">+63</span>
                  <input type="tel" inputMode="numeric" autoComplete="tel-national" value={contactNumber} onChange={(event) => setContactNumber(normalizePhilippinePhoneNumber(event.target.value))} minLength={10} maxLength={10} pattern="9[0-9]{9}" placeholder="9XXXXXXXXX" required className="h-11 w-full border border-[#cfd8d2] bg-white px-3 text-sm outline-none focus:border-[#17645c] focus:ring-2 focus:ring-[#17645c]/15" />
                </div>
                <span className="mt-1 block text-xs text-[#66736f]">Enter 10 digits starting with 9.</span>
              </label>
            )}

            <label className="block">
              <span className="mb-2 block text-xs font-bold text-[#17312e]">Password</span>
              <div className="relative">
                <LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#66736f]" />
                <input type={isRegistering && passwordVisible ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={isRegistering ? 'new-password' : 'current-password'} placeholder="At least 6 characters" className="h-11 w-full border border-[#cfd8d2] bg-white pl-10 pr-10 text-sm outline-none transition-colors focus:border-[#17645c] focus:ring-2 focus:ring-[#17645c]/15" />
                {isRegistering && <button type="button" onClick={() => setPasswordVisible((visible) => !visible)} aria-label={passwordVisible ? 'Hide password' : 'Show password'} className="absolute right-0 top-0 flex h-11 w-10 items-center justify-center text-[#66736f]">{passwordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>}
              </div>
            </label>
            {isRegistering && (
              <label className="block">
                <span className="mb-2 block text-xs font-bold text-[#17312e]">Confirm password</span>
                <div className="relative">
                  <LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#66736f]" />
                  <input type={confirmPasswordVisible ? 'text' : 'password'} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" required className="h-11 w-full border border-[#cfd8d2] bg-white pl-10 pr-10 text-sm outline-none transition-colors focus:border-[#17645c] focus:ring-2 focus:ring-[#17645c]/15" />
                  <button type="button" onClick={() => setConfirmPasswordVisible((visible) => !visible)} aria-label={confirmPasswordVisible ? 'Hide confirm password' : 'Show confirm password'} className="absolute right-0 top-0 flex h-11 w-10 items-center justify-center text-[#66736f]">{confirmPasswordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                </div>
                {confirmPassword && <span role={password === confirmPassword ? 'status' : 'alert'} className={`mt-1 block text-xs ${password === confirmPassword ? 'text-emerald-700' : 'text-rose-700'}`}>{password === confirmPassword ? 'Passwords match.' : 'Passwords do not match.'}</span>}
              </label>
            )}

            {error && <div role="alert" className="border-l-2 border-rose-600 bg-rose-50 px-3 py-2 text-xs leading-relaxed text-rose-900">{error}</div>}

            <button type="submit" disabled={busy || fetchStatus === 'fetching' || password !== confirmPassword} className="flex h-11 w-full items-center justify-center gap-2 bg-[#17645c] text-sm font-bold text-white transition-colors hover:bg-[#104f49] disabled:opacity-60">
              {busy || fetchStatus === 'fetching' ? 'Creating account...' : 'Create account'}
            </button>
          </form>
          ) : (
            <div className="mt-6">
              <SignIn routing="hash" signUpUrl="#" appearance={signInAppearance} />
              {error && <p role="alert" className="mt-4 border-l-2 border-rose-600 bg-rose-50 px-3 py-2 text-xs leading-relaxed text-rose-900">{error}</p>}
            </div>
          )}

          <div className="mt-5 border-t border-[#dfe6e1] pt-5 text-center text-sm text-[#66736f]">
            {isRegistering ? 'Already have an account? ' : "Don't have an account? "}
            <button type="button" disabled={busy} onClick={() => { setError(''); setIsRegistering((registering) => !registering); }} className="font-bold text-[#17645c] hover:underline">
              {isRegistering ? 'Sign in' : 'Sign up'}
            </button>
          </div>

        </div>
      </section>
    </main>
  );
};
