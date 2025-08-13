// src/hooks/useAuth.ts
import { sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth';

import { auth } from '../lib/firebase'; // your initialized firebase app

const actionCodeSettings = {
  url: window.location.origin + '/login',
  handleCodeInApp: true,
};

export const useAuth = () => {
  const sendLoginLink = async (email: string) => {
    await sendSignInLinkToEmail(auth, email, actionCodeSettings);
    window.localStorage.setItem('emailForSignIn', email);
  };

  const completeLogin = async () => {
    if (isSignInWithEmailLink(auth, window.location.href)) {
      const email = window.localStorage.getItem('emailForSignIn');
      if (!email) throw new Error('No email found in local storage');

      const result = await signInWithEmailLink(auth, email, window.location.href);
      window.localStorage.removeItem('emailForSignIn');
      return result;
    }
  };

  return {
    sendLoginLink,
    completeLogin,
  };
};
