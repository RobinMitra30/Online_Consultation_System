import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Stethoscope } from 'lucide-react';
import { Doctor } from '../../types';

export default function DoctorSignupPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    // Set local storage flag so auth-provider doesn't create a patient doc
    localStorage.setItem('isDoctorSignup', 'true');

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      const newDoctor: Doctor = {
        uid: userCredential.user.uid,
        name,
        email,
        phone,
        role: 'doctor',
        status: 'PENDING',
        createdAt: new Date().toISOString()
      };
      
      await setDoc(doc(db, 'doctors', userCredential.user.uid), newDoctor);
      localStorage.removeItem('isDoctorSignup');
      
      // Navigate to dashboard where they will see the pending status
      // We might need to force reload to let auth provider fetch the new doc correctly since it aborted.
      window.location.href = '/doctor/dashboard';
    } catch (err: any) {
      localStorage.removeItem('isDoctorSignup');
      setError(err.message || 'An error occurred during signup.');
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
            <CardTitle className="text-2xl font-bold text-foreground">Doctor Registration</CardTitle>
            <CardDescription className="text-base mt-1 text-muted-foreground">Apply to join our medical network.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-8">
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" required value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input id="phone" type="tel" required value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={loading} className="w-full h-12 text-base font-semibold rounded-xl">
              {loading ? 'Submitting Application...' : 'Sign Up as Doctor'}
            </Button>
          </form>
          
          <div className="text-center text-sm text-muted-foreground mt-4">
            Already have an account? <Link to="/doctor/login" className="text-primary hover:underline font-medium">Log in</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
