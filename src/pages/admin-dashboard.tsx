import React, { useEffect, useState } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, getDocs, doc, updateDoc } from 'firebase/firestore';
import { Appointment, Doctor } from '../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Calendar, Users, Activity, CheckCircle2, Stethoscope, Mail } from 'lucide-react';

export default function AdminDashboardPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);

  const [testEmail, setTestEmail] = useState('robin.mitra124421@gmail.com');
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmail) return;
    setSendingTest(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/send-test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toEmail: testEmail })
      });
      
      let data: any = {};
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(text || `Server returned status ${res.status}`);
      }

      if (!res.ok) throw new Error(data.error || 'SMTP Delivery Failed');
      setTestResult({
        success: true,
        message: `Success! Testing email has been dispatched to ${testEmail} through SMTP. (Message ID: ${data.messageId})`
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'SMTP Configuration Error or Delivery Failure.'
      });
    } finally {
      setSendingTest(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const qApts = query(collection(db, 'appointments'));
      const snapshotApts = await getDocs(qApts);
      const fetchedApts = snapshotApts.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));
      fetchedApts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setAppointments(fetchedApts);

      const qDocs = query(collection(db, 'doctors'));
      const snapshotDocs = await getDocs(qDocs);
      const fetchedDocs = snapshotDocs.docs.map(doc => ({ uid: doc.id, ...doc.data() } as Doctor));
      setDoctors(fetchedDocs);
    } catch (error) {
       console.error("Error fetching admin data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'appointments', id), {
        status: newStatus
      });
      fetchData();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `appointments/${id}`);
    }
  };

  const handleDoctorStatusChange = async (uid: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'doctors', uid), {
        status: newStatus
      });
      fetchData();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `doctors/${uid}`);
    }
  };

  const today = format(new Date(), 'yyyy-MM-dd');
  const todaysAppointments = appointments.filter(a => a.date === today);
  const totalRevenue = appointments.filter(a => a.paymentStatus === 'paid').length * 500;
  const pendingDoctorsCount = doctors.filter(d => d.status === 'PENDING').length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-1">Manage all clinic operations and consultations</p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Total Appointments</CardTitle>
            <Calendar className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{appointments.length}</div>
          </CardContent>
        </Card>
        
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Pending Approvals</CardTitle>
            <Stethoscope className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{pendingDoctorsCount}</div>
          </CardContent>
        </Card>
        
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Revenue Summary</CardTitle>
            <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">₹{totalRevenue}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="text-foreground">SMTP Outbound Mail Tester</CardTitle>
            <CardDescription className="text-muted-foreground">Test your physical SMTP integration by dispatching live testing emails instantly.</CardDescription>
          </div>
          <Mail className="w-5 h-5 text-primary" />
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSendTestEmail} className="flex gap-4 max-w-xl items-end">
            <div className="flex-1 space-y-1.5">
              <label htmlFor="test-recipient" className="text-xs font-medium text-muted-foreground">Recipient Email Address</label>
              <Input
                id="test-recipient"
                type="email"
                placeholder="enter recipient email (e.g. user@gmail.com)"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                required
                className="bg-background border-border text-foreground text-sm"
              />
            </div>
            <Button type="submit" disabled={sendingTest} className="h-10 bg-primary hover:bg-primary/90 text-primary-foreground font-medium">
              {sendingTest ? 'Sending Test...' : 'Send Test Mail'}
            </Button>
          </form>

          {testResult && (
            <div className={`mt-4 p-3 rounded-md text-xs border ${
              testResult.success 
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 font-medium' 
                : 'bg-destructive/10 border-destructive/20 text-destructive font-medium'
            }`}>
              {testResult.message}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Doctor Management</CardTitle>
          <CardDescription className="text-muted-foreground">Approve or suspend doctor accounts.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-background">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {doctors.map(doc => (
                  <tr key={doc.uid} className="border-b border-border">
                    <td className="px-4 py-3 font-medium text-foreground">{doc.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{doc.email}</td>
                    <td className="px-4 py-3 text-muted-foreground">{doc.phone}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                        doc.status === 'ACTIVE' ? 'bg-primary/20 text-primary' : 'bg-amber-500/20 text-amber-500'
                      }`}>
                        {doc.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                       <Select 
                          value={doc.status} 
                          onValueChange={(val) => handleDoctorStatusChange(doc.uid, val)}
                       >
                        <SelectTrigger className="w-[130px] h-8 text-xs bg-background border-border text-foreground">
                          <SelectValue placeholder="Update Status" />
                        </SelectTrigger>
                        <SelectContent className="bg-background border-border text-foreground">
                          <SelectItem value="PENDING">Pending</SelectItem>
                          <SelectItem value="ACTIVE">
                            Active {!doc.googleConnected && '(No Google Sync)'}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
                {doctors.length === 0 && !loading && (
                   <tr>
                     <td colSpan={5} className="py-8 text-center text-muted-foreground">No doctors registered yet.</td>
                   </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">All Consultations</CardTitle>
          <CardDescription className="text-muted-foreground">View and manage patient appointments.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-background">
                <tr>
                  <th className="px-4 py-3">Patient</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map(apt => (
                  <tr key={apt.id} className="border-b border-border">
                    <td className="px-4 py-3 font-medium text-foreground">{apt.patientName || 'Unknown'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{format(new Date(apt.date), 'MMM d, yyyy')}</td>
                    <td className="px-4 py-3 text-muted-foreground">{apt.timeSlot}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                        apt.status === 'booked' ? 'bg-primary/20 text-primary' :
                        apt.status === 'completed' ? 'bg-chart-3/20 text-chart-3' :
                        'bg-destructive/20 text-destructive'
                      }`}>
                        {apt.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Select value={apt.status} onValueChange={(val) => handleStatusChange(apt.id!, val)}>
                        <SelectTrigger className="w-[130px] h-8 text-xs bg-background border-border text-foreground">
                          <SelectValue placeholder="Update Status" />
                        </SelectTrigger>
                        <SelectContent className="bg-background border-border text-foreground">
                          <SelectItem value="booked">Booked</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
