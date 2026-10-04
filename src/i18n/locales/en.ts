import type es from './es';

const en: typeof es = {
  tabs: {
    home: 'Home',
    settings: 'Settings',
  },
  home: {
    title: 'Chat Pisos',
    subtitle: 'Find a flat or flatmates in Madrid',
    districtChats: 'District chats',
    listings: 'Listings',
    privateMessages: 'Private messages',
    comingSoon: 'Coming soon',
  },
  settings: {
    title: 'Settings',
    language: 'Language',
    account: 'Account',
    signedInAs: 'Signed in as {{email}}',
    signOut: 'Log out',
  },
  auth: {
    tagline: 'Find a room, a flat or flatmates in Madrid, organised by district.',
    signUpTitle: 'Create your account',
    signInTitle: 'Log in',
    email: 'Email',
    emailPlaceholder: 'you@example.com',
    password: 'Password',
    passwordPlaceholder: 'At least 8 characters',
    acceptTerms: "I'm 18 or older and I accept the Terms and Privacy Policy.",
    signUpButton: 'Create account',
    signInButton: 'Log in',
    haveAccount: 'Already have an account?',
    noAccount: "Don't have an account yet?",
    switchToSignIn: 'Log in',
    switchToSignUp: 'Sign up',
    checkEmailTitle: 'Check your email',
    checkEmailBody: 'We sent a link to {{email}}. Open it to confirm your account, then log in.',
    backToSignIn: 'Back to log in',
    errors: {
      invalidEmail: 'Enter a valid email address.',
      shortPassword: 'Your password must be at least 8 characters.',
      mustAcceptTerms: 'Please confirm you are 18 or older and accept the terms.',
      invalidCredentials: 'Wrong email or password.',
      emailNotConfirmed: "You haven't confirmed your email yet. Check your inbox.",
      userExists: 'An account with this email already exists. Log in instead.',
      weakPassword: 'This password is too weak. Try a longer one.',
      rateLimit: 'Too many attempts. Wait a few minutes and try again.',
      generic: 'Something went wrong. Please try again.',
    },
  },
  languages: {
    es: 'Español',
    en: 'English',
  },
};

export default en;
