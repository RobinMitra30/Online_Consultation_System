import { Link, useNavigate } from 'react-router';
import { useAuth } from './auth-provider';
import { auth } from '../lib/firebase';
import { Button } from './ui/button';
import { Stethoscope } from 'lucide-react';
import { NotificationsBell } from './notifications-bell';

export function Navbar() {
  const { user, appUser } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await auth.signOut();
    navigate('/');
  };

  return (
    <nav className="border-b border-border bg-card">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 justify-between items-center">
          <Link to="/" className="flex items-center gap-2">
            <div className="bg-primary/20 p-2 rounded-lg text-primary font-bold flex items-center justify-center">
              <span className="text-sm">hc</span>
            </div>
            <span className="text-xl font-semibold tracking-tight text-foreground">
              HealthConsult
            </span>
          </Link>
          
          <div className="flex items-center gap-4">
            {user ? (
              <>
                {appUser?.role === 'admin' ? (
                  <Link to="/admin">
                    <Button variant="ghost">Admin Dashboard</Button>
                  </Link>
                ) : appUser?.role === 'doctor' ? (
                  <Link to="/doctor/dashboard">
                    <Button variant="ghost">Doctor Dashboard</Button>
                  </Link>
                ) : (
                  <Link to="/dashboard">
                    <Button variant="ghost">Dashboard</Button>
                  </Link>
                )}
                <NotificationsBell />
                <Button variant="outline" onClick={handleLogout}>Logout</Button>
              </>
            ) : (
              <>
                <Link to="/doctor/login">
                  <Button variant="ghost" className="hidden sm:flex text-muted-foreground hover:text-foreground">For Doctors</Button>
                </Link>
                <Link to="/login">
                  <Button>Sign In</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
