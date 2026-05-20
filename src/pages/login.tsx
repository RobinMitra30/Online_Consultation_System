import { useNavigate } from 'react-router';
import { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth, googleProvider, db } from '../lib/firebase';
import { useAuth } from '../components/auth-provider';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import React, { useState, useEffect } from 'react';
import { Stethoscope, ShieldAlert, UserPlus, LogIn, CheckCircle2 } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';

export default function LoginPage() {
  const navigate = useNavigate();
  const { appUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loadingAction, setLoadingAction] = useState(false);

  useEffect(() => {
    if (appUser) {
      if (appUser.role === 'admin') {
        navigate('/admin');
      } else if (appUser.role === 'doctor') {
        navigate('/doctor/dashboard');
      } else {
        navigate('/dashboard');
      }
    }
  }, [appUser, navigate]);

  const handleGoogleLogin = async () => {
    try {
      setError('');
      setSuccess('');
      setLoadingAction(true);
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleEmailAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoadingAction(true);

    if (isSignUp) {
      // Patient Sign Up Flow
      if (!name.trim()) {
        setError('Please enter your full name.');
        setLoadingAction(false);
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        setLoadingAction(false);
        return;
      }
      if (password.length < 6) {
        setError('Password should be at least 6 characters.');
        setLoadingAction(false);
        return;
      }

      try {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        
        // Update Firebase Auth profile
        await updateProfile(result.user, { displayName: name });

        // Save new user document in Firestore to immediately establish the Patient role
        const userRef = doc(db, 'users', result.user.uid);
        await setDoc(userRef, {
          uid: result.user.uid,
          email: result.user.email,
          name: name,
          role: 'patient',
          createdAt: new Date().toISOString()
        });

        setSuccess('Account created successfully! Logging you in...');
      } catch (err: any) {
        if (err.code === 'auth/email-already-in-use') {
          setError('This email address is already in use by another account.');
        } else {
          setError(err.message || 'Failed to create patient account.');
        }
      } finally {
        setLoadingAction(false);
      }
    } else {
      // Patient / User Sign In Flow
      try {
        await signInWithEmailAndPassword(auth, email, password);
      } catch (err: any) {
        setError('Invalid email or password.');
      } finally {
        setLoadingAction(false);
      }
    }
  };

  return (
    <div className="flex justify-center items-center py-12 px-4 sm:px-6">
      <Card className="w-full max-w-md shadow-lg border border-border bg-card">
        <CardHeader className="space-y-3 items-center text-center pb-8 border-b border-border">
          <div className="bg-primary/20 p-3 rounded-2xl text-primary shadow-md">
            <Stethoscope className="h-8 w-8" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold text-foreground">
              {isSignUp ? 'Create Patient Account' : 'Welcome Back'}
            </CardTitle>
            <CardDescription className="text-base mt-1 text-muted-foreground animate-pulse">
              {isSignUp ? 'Register login ID and password to start consultations' : 'Sign in to book or manage consultations'}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-8">
          
          {/* External Social Auth Selection */}
          {!isSignUp && (
            <>
              <Button 
                variant="outline" 
                className="w-full h-12 text-base font-medium rounded-xl border-border hover:bg-accent text-foreground transition-all duration-200" 
                onClick={handleGoogleLogin}
                disabled={loadingAction}
              >
                <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Sign in with Google
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground font-medium tracking-wider">Or continue with credentials</span>
                </div>
              </div>
            </>
          )}

          <form onSubmit={handleEmailAction} className="space-y-4">
            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="name" className="text-foreground">Full Name</Label>
                <Input 
                  id="name" 
                  type="text" 
                  placeholder="John Doe" 
                  required 
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="h-11 rounded-xl bg-background border-border text-foreground transition-all duration-200 focus:ring-2 focus:ring-primary"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground">Email Address</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="patient@example.com" 
                required 
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="h-11 rounded-xl bg-background border-border text-foreground transition-all duration-200 focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground">Password</Label>
              <Input 
                id="password" 
                type="password" 
                placeholder="Minimum 6 characters"
                required 
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="h-11 rounded-xl bg-background border-border text-foreground transition-all duration-200 focus:ring-2 focus:ring-primary"
              />
            </div>

            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-foreground">Confirm Password</Label>
                <Input 
                  id="confirmPassword" 
                  type="password" 
                  placeholder="Repeat your password"
                  required 
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="h-11 rounded-xl bg-background border-border text-foreground transition-all duration-200 focus:ring-2 focus:ring-primary"
                />
              </div>
            )}

            {error && (
              <p className="text-sm text-destructive font-medium border border-destructive/20 bg-destructive/5 px-3 py-2 rounded-lg">
                ❌ {error}
              </p>
            )}

            {success && (
              <p className="text-sm text-emerald-600 dark:text-emerald-500 font-medium border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 rounded-lg flex items-center gap-1.5 animate-bounce">
                <CheckCircle2 className="w-4 h-4" /> {success}
              </p>
            )}

            <Button 
              type="submit" 
              className="w-full h-12 text-base font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-md flex items-center justify-center gap-2"
              disabled={loadingAction}
            >
              {isSignUp ? <UserPlus className="w-5 h-5" /> : <LogIn className="w-5 h-5" />}
              {isSignUp ? 'Create Patient Account' : 'Sign In'}
            </Button>
          </form>

          {/* Toggle between Login and Signup */}
          <div className="text-center pt-2">
            <button
              type="button"
              className="text-sm text-primary font-semibold hover:underline"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError('');
                setSuccess('');
              }}
            >
              {isSignUp ? 'Already have an account? Sign In' : 'New Patient? Create an account'}
            </button>
          </div>

          <div className="pt-4 border-t border-border space-y-4 text-xs text-muted-foreground">
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-foreground">Admin Access:</span> Sign in with administrator email <span className="font-mono text-primary font-bold">robin.mitra124421@gmail.com</span> to automatically access the Admin Portal.
              </div>
            </div>

            <div className="p-3.5 bg-secondary/35 border border-border rounded-xl space-y-2.5 text-left">
              <p className="font-bold text-foreground text-xs uppercase tracking-wider">🧪 Testing Credentials Mode</p>
              
              <div className="space-y-1">
                <p className="font-medium text-foreground">👨‍⚕️ Doctor Test Email:</p>
                <p className="font-mono text-primary select-all font-bold">structuremakers.india@gmail.com</p>
                <p className="text-[11px] text-muted-foreground font-normal">Automatically logs in, bypasses approval, and assigns a verified <strong>ACTIVE Doctor</strong> profile.</p>
              </div>

              <div className="space-y-1 pt-1 border-t border-border/40">
                <p className="font-medium text-foreground">🧑 Patient Test Email:</p>
                <p className="font-mono text-primary select-all font-bold">robin.mitra124421.mr@gmail.com</p>
                <p className="text-[11px] text-muted-foreground font-normal">Automatically signs in as a <strong>Patient</strong> to book appointments and fill intake forms.</p>
              </div>

              <div className="pt-2 border-t border-border/40 space-y-1">
                <p className="font-bold text-amber-600 dark:text-amber-500 flex items-center gap-1">⚠️ Error 403: access_denied? (Google OAuth Testing)</p>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Since your Google application is currently in <strong>"Testing Mode"</strong>, Google limits OAuth access to approved developer accounts.
                </p>
                <p className="text-[11px] font-semibold text-foreground pt-1">
                  How to test Google Calendar:
                </p>
                <ol className="list-decimal pl-4 text-[11px] space-y-1 text-muted-foreground font-normal">
                  <li>Go to Google Cloud Console → <strong>OAuth Consent Screen</strong>.</li>
                  <li>Scroll down to the <strong>"Test users"</strong> section.</li>
                  <li>Click <strong>"+ ADD USERS"</strong> and enter both <span className="font-mono text-foreground font-semibold">structuremakers.india@gmail.com</span> and <span className="font-mono text-foreground font-semibold">robin.mitra124421.mr@gmail.com</span>.</li>
                  <li>Save changes! Now you can sign in and link Google Calendar for both without 403 errors.</li>
                </ol>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
