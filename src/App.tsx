import { useAuth } from '@/hooks/useAuth';
import AuthGate from '@/components/AuthGate';

export default function App() {
  const auth = useAuth();
  return <AuthGate auth={auth} />;
}


