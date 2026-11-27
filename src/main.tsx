import { ClerkProvider } from '@clerk/react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!publishableKey) {
  throw new Error('Missing Clerk publishable key. Set VITE_CLERK_PUBLISHABLE_KEY.');
}

createRoot(document.getElementById('root')!).render(
  <ClerkProvider publishableKey={publishableKey}>
    <App />
  </ClerkProvider>,
);
