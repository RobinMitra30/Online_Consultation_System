import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Stethoscope } from 'lucide-react';

export default function DoctorLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      // Double check they are in the doctors collection
      const docRef = await getDoc(doc(db, 'doctors', cred.user.uid));
      if (!docRef.exists()) {
         await auth.signOut();
         setError('No doctor account found with this email.');
         setLoading(false);
         return;
      }
      navigate('/doctor/dashboard');
    } catch (err: any) {
      setError('Invalid email or password.');
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center py-12">
      <Card className="w-full max-w-md shadow-lg border border-border bg-card">
        <CardHeader className="space-y-3 items-center text-center pb-8 border-b border-border">
          <div className="bg-primary/20 p-3 rounded-2xl text-primary shadow-md">
            <Stethoscope className="h-8 w-8" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold text-foreground">Doctor Login</CardTitle>
            <CardDescription className="text-base mt-1 text-muted-foreground">Access your medical dashboard.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-8">
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground">Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="doctor@medical.com" 
                required 
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="h-11 rounded-xl bg-background border-border text-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground">Password</Label>
              <Input 
                id="password" 
                type="password" 
                required 
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="h-11 rounded-xl bg-background border-border text-foreground"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={loading} className="w-full h-12 text-base font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90">
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <div className="text-center text-sm text-muted-foreground mt-4">
            Not registered yet? <Link to="/doctor/signup" className="text-primary hover:underline font-medium">Apply here</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
