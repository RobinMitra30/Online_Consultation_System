import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../components/auth-provider';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

export default function QuestionnairePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    gender: '',
    phone: '',
    concern: '',
    symptoms: '',
    history: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.id]: e.target.value }));
  };

  const handleSelectChange = (value: string) => {
    setFormData(prev => ({ ...prev, gender: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setLoading(true);
    try {
      const qRef = collection(db, 'questionnaires');
      const docRef = await addDoc(qRef, {
        userId: user.uid,
        name: formData.name,
        age: formData.age ? parseInt(formData.age) : null,
        gender: formData.gender,
        phone: formData.phone,
        concern: formData.concern,
        symptoms: formData.symptoms,
        history: formData.history,
        createdAt: serverTimestamp()
      });
      
      // Store the active questionnaire id in local storage to pass to the booking flow
      localStorage.setItem('activeQuestionnaireId', docRef.id);
      
      navigate('/book');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'questionnaires');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Pre-Consultation Questionnaire</CardTitle>
          <CardDescription>Please provide your details so that our doctors can better understand your concerns.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input id="name" required value={formData.name} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Mobile Number *</Label>
                <Input id="phone" required value={formData.phone} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="age">Age</Label>
                <Input id="age" type="number" min="0" max="120" value={formData.age} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gender">Gender</Label>
                <Select value={formData.gender} onValueChange={handleSelectChange}>
                  <SelectTrigger id="gender">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t">
              <div className="space-y-2">
                <Label htmlFor="concern">Main Health Concern / Problem *</Label>
                <Input id="concern" placeholder="What brings you here today?" required value={formData.concern} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="symptoms">Symptoms</Label>
                <Textarea id="symptoms" placeholder="Describe your symptoms..." className="min-h-[100px]" value={formData.symptoms} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="history">Previous Medical History</Label>
                <Textarea id="history" placeholder="Any past medical conditions, surgeries, or ongoing treatments?" className="min-h-[100px]" value={formData.history} onChange={handleChange} />
              </div>
            </div>

            <div className="pt-6 flex justify-end gap-4">
              <Button type="button" variant="outline" onClick={() => navigate('/dashboard')}>Cancel</Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Submitting...' : 'Continue to Booking'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
