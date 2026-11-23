import React, { useState } from 'react';
import { SignIn, SignUp } from '@clerk/react';
import masikapLogo from '../assets/images/MASIKAP.png';

const authAppearance = {
  variables: {
    colorPrimary: '#8b00ff',
    colorPrimaryForeground: '#ffffff',
    colorBackground: '#ffffff',
    colorForeground: '#18181b',
    colorMutedForeground: '#52525b',
    colorBorder: '#e4e4e7',
    colorInput: '#ffffff',
    colorInputForeground: '#18181b',
    colorRing: '#8b00ff',
    fontFamily: 'Inter, sans-serif',
    borderRadius: '0.5rem',
    fontSize: '0.75rem',
    spacing: '0.75rem',
  },
  options: {
    socialButtonsPlacement: 'top' as const,
    socialButtonsVariant: 'blockButton' as const,
  },
  elements: {
    rootBox: {
      display: 'flex',
      width: '100%',
      minWidth: '0',
      maxWidth: '100%',
      justifyContent: 'center',
    },
    cardBox: {
      display: 'flex',
      width: '100%',
      minWidth: '0',
      maxWidth: '100%',
      justifyContent: 'center',
    },
    card: {
      width: '100%',
      minWidth: '0',
      maxWidth: '100%',
      boxSizing: 'border-box',
      border: '1px solid #e4e4e7',
      borderRadius: '12px',
      backgroundColor: '#ffffff',
      padding: '1.25rem',
      boxShadow: '0 8px 24px rgba(24, 24, 27, 0.12)',
    },
    headerTitle: { color: '#18181b', textAlign: 'center' },
    headerSubtitle: { color: '#52525b', textAlign: 'center' },
    formFieldLabel: { color: '#27272a' },
    formFieldHintText: { color: '#52525b' },
    formFieldErrorText: { color: '#be123c' },
    socialButtonsBlockButton: {
      borderColor: '#e4e4e7',
      backgroundColor: '#ffffff',
      borderRadius: '8px',
      boxShadow: 'none',
    },
    socialButtonsBlockButtonText: { color: '#27272a' },
    formFieldInput: {
      borderColor: '#d4d4d8',
      color: '#18181b',
      borderRadius: '8px',
      padding: '0.375rem 0.625rem',
    },
    phoneInputInput: { color: '#18181b' },
    dividerLine: { backgroundColor: '#d4d4d8' },
    dividerText: { color: '#52525b' },
    formButtonPrimary: {
      backgroundColor: '#8b00ff',
      borderRadius: '8px',
      padding: '0.375rem 0.75rem',
      boxShadow: 'none',
    },
    footerAction: { display: 'none' },
    footer: {
      backgroundColor: '#fafafa',
      borderTop: '1px solid #e4e4e7',
      borderBottomLeftRadius: '12px',
      borderBottomRightRadius: '12px',
    },
    footerActionText: { color: '#52525b' },
    footerActionLink: { color: '#6b21a8' },
    identityPreviewText: { color: '#18181b' },
  },
};

export const AuthScreen: React.FC = () => {
  const [isRegistering, setIsRegistering] = useState(false);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-white px-3 py-4 text-[#18181b] sm:px-4 sm:py-12">
      <section className="mx-auto w-full min-w-0 max-w-[360px] border border-[#e4e4e7] bg-white">
        <div className="border-b border-[#e4e4e7] px-5 py-3">
          <div className="flex items-center gap-3">
            <img src={masikapLogo} alt="Masikap Health Center" className="h-8 w-8 shrink-0 rounded-full border border-[#e4e4e7] object-cover" />
            <div>
              <div className="text-xs font-bold text-[#18181b]">Masikap Health Center</div>
              <div className="mt-0.5 text-[10px] text-[#52525b]">Health Center · Pateros</div>
            </div>
          </div>
        </div>
        <div className="flex w-full min-w-0 justify-center px-5 py-5">
          {isRegistering ? (
            <SignUp routing="hash" signInUrl="#" appearance={authAppearance} />
          ) : (
            <SignIn routing="hash" signUpUrl="#" appearance={authAppearance} />
          )}
        </div>
        <div className="mx-5 border-t border-[#e4e4e7] py-3 text-center text-xs text-[#52525b]">
          {isRegistering ? 'Already have an account? ' : "Don't have an account? "}
          <button
            type="button"
            onClick={() => setIsRegistering((registering) => !registering)}
            className="font-semibold text-purple-700 hover:text-purple-800"
          >
            {isRegistering ? 'Sign in' : 'Sign up'}
          </button>
        </div>
      </section>
    </main>
  );
};
