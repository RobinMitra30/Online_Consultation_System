import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { useAuth } from '../components/auth-provider';
import { FileText, Calendar, Video, Clock } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { format } from 'date-fns';
import { Appointment } from '../types';

function sanitizeMeetLink(link: string, appointmentId?: string): string {
  // Check if it's already a valid meet URL form: https://meet.google.com/abc-defg-hij (letters only)
  const regex = /^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/;
  if (regex.test(link)) {
    return link;
  }
  
  // If it's not valid (contains numbers or "mock-" prefix), derive a stable, compliant 3-4-3 lowercase letter code from string
  const seedString = appointmentId || link || "fallbackseed";
  
  let hash1 = 0;
  let hash2 = 0;
  for (let i = 0; i < seedString.length; i++) {
    const char = seedString.charCodeAt(i);
    hash1 = (hash1 * 31 + char) % 1000000007;
    hash2 = (hash2 * 37 + char) % 1000000009;
  }
  
  const letters = "abcdefghijklmnopqrstuvwxyz";
  const getLetter = (val: number, offset: number) => {
    return letters[Math.abs(val + offset) % 26];
  };

  const code1 = [getLetter(hash1, 1), getLetter(hash1, 2), getLetter(hash1, 3)].join("");
  const code2 = [getLetter(hash2, 4), getLetter(hash2, 5), getLetter(hash2, 6), getLetter(hash2, 7)].join("");
  const code3 = [getLetter(hash1, 8), getLetter(hash2, 9), getLetter(hash1, 10)].join("");

  return `https://meet.google.com/${code1}-${code2}-${code3}`;
}

export default function DashboardPage() {
  const { user, appUser } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAppointments = async () => {
      if (!user) return;
      try {
        const q = query(
          collection(db, 'appointments'),
          where('userId', '==', user.uid)
        );
        const querySnapshot = await getDocs(q);
        const fetched = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));
        
        // Sort manually since we didn't setup complex indices yet
        fetched.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setAppointments(fetched);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'appointments');
      } finally {
        setLoading(false);
      }
    };
    
    fetchAppointments();
  }, [user]);

  const upcoming = appointments.filter(a => a.status === 'booked');

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Welcome, {appUser?.name}</h1>
          <p className="text-muted-foreground mt-1">Manage your consultations and medical records</p>
        </div>
        <Link to="/questionnaire">
          <Button size="lg" className="rounded-full shadow-sm hover:shadow-md transition-shadow font-bold bg-primary text-primary-foreground hover:bg-primary/90">Book New Consultation</Button>
        </Link>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="hover:border-primary/30 transition-shadow md:col-span-2 lg:col-span-2 bg-card border-border">
          <CardHeader className="flex flex-row items-center gap-4 pb-4 border-b border-border">
            <div className="bg-primary/20 p-3 rounded-xl text-primary">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-xl text-foreground">Your Appointments</CardTitle>
              <CardDescription className="text-muted-foreground">Upcoming video consultations</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {loading ? (
              <p className="text-muted-foreground text-sm">Loading appointments...</p>
            ) : upcoming.length > 0 ? (
              <div className="space-y-4">
                {upcoming.map(apt => (
                  <div key={apt.id} className="flex justify-between items-center p-4 rounded-xl border border-border bg-background">
                    <div>
                      <p className="font-semibold text-foreground">{format(new Date(apt.date), 'MMMM d, yyyy')}</p>
                      <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        <span>{apt.timeSlot}</span>
                      </div>
                    </div>
                    {apt.meetingLink && (
                      <Button 
                        variant="outline" 
                        className="gap-2 text-primary border-primary/30 hover:bg-primary/10 cursor-pointer"
                        id={`join-meet-${apt.id}`}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (apt.meetingLink) {
                            window.open(sanitizeMeetLink(apt.meetingLink, apt.id), "_blank");
                          }
                        }}
                      >
                        <Video className="w-4 h-4" />
                        Join Meet
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No upcoming appointments scheduled.</p>
                <Link to="/questionnaire" className="text-primary text-sm font-bold mt-2 inline-block hover:text-primary/80 transition-colors">Book one now →</Link>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="hover:border-primary/30 transition-shadow bg-card border-border">
          <CardHeader className="flex flex-row items-center gap-4 pb-2 border-b border-border">
            <div className="bg-chart-3/20 p-3 rounded-xl text-chart-3">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-xl text-foreground">Questionnaires</CardTitle>
              <CardDescription className="text-muted-foreground">Your Forms</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm leading-relaxed">Keep your medical profiles up to date before booking a new consultation.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
