import { useEffect } from 'react';
import type { useAuth } from '@/hooks/useAuth';
import SignInScreen from './SignInScreen';
import PendingScreen from './PendingScreen';
import DeniedScreen from './DeniedScreen';
import FamilyPicker from './FamilyPicker';
import Dashboard from './Dashboard';
import LoadingScreen from './LoadingScreen';

interface Props {
  auth: ReturnType<typeof useAuth>;
}

export default function AuthGate({ auth }: Props) {
  const { stage, signInWithGoogle, signOut } = auth;

  useEffect(() => {
    if (stage.kind === 'approved' || stage.kind === 'pending' || stage.kind === 'needs-family') {
      if (window.location.hash.startsWith('#access_token=')) {
        window.history.replaceState(null, '', window.location.pathname);
      }
    }
  }, [stage.kind]);

  switch (stage.kind) {
    case 'loading':
      return <LoadingScreen />;
    case 'signed-out':
      return <SignInScreen onSignIn={signInWithGoogle} />;
    case 'pending':
      return <PendingScreen profile={stage.profile} onSignOut={signOut} />;
    case 'denied':
      return <DeniedScreen profile={stage.profile} onSignOut={signOut} />;
    case 'needs-family':
      return <FamilyPicker profile={stage.profile} />;
    case 'approved':
      return <Dashboard session={stage.session} profile={stage.profile} onSignOut={signOut} />;
  }
}


