import { Link } from 'react-router';
import { Button } from '../components/ui/button';
import { Calendar, Video, ShieldCheck, Clock, UserIcon } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Doctor } from '../types';

export default function LandingPage() {
  const [activeDoctors, setActiveDoctors] = useState<Doctor[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, 'doctors'), 
      where('status', '==', 'ACTIVE')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ uid: d.id, ...d.data() } as Doctor));
      setActiveDoctors(docs);
    }, (error) => {
      console.error("Failed to sync doctors real-time", error);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="flex flex-col gap-16 py-10">
      <section className="text-center space-y-6 max-w-4xl mx-auto">
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-foreground">
          Professional Medical Advice, <br/> 
          <span className="text-primary">Online & On Your Time.</span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Book online video consultations with top doctors. Answer a brief questionnaire and get personalized medical guidance from the comfort of your home.
        </p>
        <div className="flex justify-center gap-4 pt-4">
          <Link to="/login">
            <Button size="lg" className="text-lg px-8 py-6 rounded-full hover:bg-primary/90 transition-all font-bold text-primary-foreground">
              Book Consultation
            </Button>
          </Link>
          <Link to="/login">
            <Button size="lg" variant="outline" className="text-lg px-8 py-6 rounded-full bg-transparent border-border hover:bg-accent text-foreground">
              Patient Login
            </Button>
          </Link>
        </div>
      </section>

      {activeDoctors.length > 0 && (
        <section className="pt-8 border-t border-border mt-8 flex-col flex items-center">
          <h2 className="text-2.5xl font-bold tracking-tight text-center mb-2">Registered Specialists</h2>
          <p className="text-sm text-muted-foreground mb-8">Consolidated status of healthcare providers synchronized on client in real-time</p>
          <div className="flex flex-wrap justify-center gap-6 max-w-5xl">
             {activeDoctors.map((doc, idx) => {
               const status = doc.availabilityStatus || 'AVAILABLE';
               const statusConfig = {
                 AVAILABLE: { color: 'bg-emerald-500', label: 'Online & Available', animate: 'animate-pulse' },
                 BUSY: { color: 'bg-red-500', label: 'In Consultation', animate: '' },
                 BREAK: { color: 'bg-blue-500', label: 'On Break', animate: '' },
                 OFFLINE: { color: 'bg-gray-400', label: 'Offline', animate: '' },
                 EMERGENCY_LEAVE: { color: 'bg-amber-500', label: 'Emergency Leave', animate: '' }
               }[status] || { color: 'bg-emerald-500', label: 'Online & Available', animate: 'animate-pulse' };

               return (
                 <div key={idx} className="flex items-center gap-4 bg-card p-4 rounded-xl border border-border min-w-[280px]">
                   <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center text-primary relative">
                     <UserIcon className="w-6 h-6" />
                     <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-card ${statusConfig.color} ${statusConfig.animate}`} />
                   </div>
                   <div>
                     <h4 className="font-bold">{doc.name}</h4>
                     <p className="text-sm text-muted-foreground">{doc.specialization || 'General Physician'}</p>
                     <p className="text-xs font-mono text-muted-foreground mt-1 flex items-center gap-1">
                       <span className="capitalize">{statusConfig.label}</span>
                     </p>
                   </div>
                 </div>
               );
             })}
          </div>
        </section>
      )}

      <section className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 pt-8">
        {[
          { icon: ShieldCheck, title: 'Verified Experts', desc: 'Consult with board-certified and experienced doctors.' },
          { icon: Clock, title: 'Flexible Timings', desc: 'Book 15-minute dedicated slots spanning from 10 AM to 6 PM.' },
          { icon: Video, title: 'HD Video Sessions', desc: 'Seamlessly integrated Google Meet links for consultations.' },
          { icon: Calendar, title: 'Easy Booking', desc: 'Secure payment gateway and instant automatic confirmations.' },
        ].map((feature, i) => (
          <div key={i} className="bg-card p-6 rounded-2xl border border-border hover:border-primary/30 transition-colors">
            <div className="bg-primary/20 w-12 h-12 rounded-xl flex items-center justify-center text-primary mb-4">
              <feature.icon className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2">{feature.title}</h3>
            <p className="text-muted-foreground leading-relaxed text-sm">{feature.desc}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
