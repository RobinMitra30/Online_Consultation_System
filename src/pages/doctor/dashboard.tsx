import React, { useEffect, useState } from 'react';
import { useAuth } from '../../components/auth-provider';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { Appointment } from '../../types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Calendar, User as UserIcon, Clock, AlertCircle, CalendarRange, RefreshCw } from 'lucide-react';
import { Chat } from '../../components/chat';

function parseAppointmentTimes(dateStr: string, timeSlotStr: string): { start: Date; end: Date } {
  try {
    const parts = timeSlotStr.trim().split(" ");
    const timeVal = parts[0];
    const ampm = parts[1] ? parts[1].toUpperCase() : "AM";
    
    let [hoursStr, minutesStr] = timeVal.split(":");
    let hours = parseInt(hoursStr, 10);
    const minutes = parseInt(minutesStr, 10) || 0;
    
    if (ampm === "PM" && hours < 12) {
      hours += 12;
    } else if (ampm === "AM" && hours === 12) {
      hours = 0;
    }
    
    const startStr = `${dateStr}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00Z`;
    const start = new Date(startStr);
    const end = new Date(start.getTime() + 15 * 60 * 1000); // 15 mins duration
    
    return { start, end };
  } catch (e) {
    const start = new Date(dateStr + "T12:00:00Z");
    const end = new Date(start.getTime() + 15 * 60 * 1000);
    return { start, end };
  }
}

export default function DoctorDashboardPage() {
  const { appUser } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const doctorUid = appUser?.uid;
  const doctorStatus = appUser?.status;

  useEffect(() => {
    if (!appUser || appUser.role !== 'doctor') return;
    
    // Only fetch if they are active, or maybe pending just shows a nice message
    if (doctorStatus !== 'ACTIVE') {
       setLoading(false);
       return;
    }

    const q = query(
      collection(db, 'appointments'), 
      where('status', '==', 'booked'),
      where('doctorId', '==', doctorUid)
    );

    const unsubscribe = onSnapshot(q, async (querySnapshot) => {
      const apps = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));
      
      try {
        const uniqueQuestIds = Array.from(new Set(apps.map(apt => apt.questionnaireId).filter(Boolean))) as string[];
        const questsPromises = uniqueQuestIds.map(async (qId) => {
          try {
            const snap = await getDoc(doc(db, 'questionnaires', qId));
            return { id: qId, data: snap.exists() ? snap.data() : null };
          } catch (e) {
            console.warn(`Could not fetch questionnaire ${qId}:`, e);
            return { id: qId, data: null };
          }
        });
        const questsResults = await Promise.all(questsPromises);
        const questsMap: Record<string, any> = {};
        questsResults.forEach(res => {
          if (res.data) {
            questsMap[res.id] = res.data;
          }
        });

        const mappedApps = apps.map(apt => {
          let resolvedName = apt.patientName;
          if (apt.questionnaireId && questsMap[apt.questionnaireId]) {
            resolvedName = questsMap[apt.questionnaireId].name || resolvedName;
          }
          return {
            ...apt,
            patientName: resolvedName
          };
        });
        setAppointments(mappedApps);
      } catch (errQuest) {
        console.error("Failed to map questionnaire patient names in doctor dashboard:", errQuest);
        setAppointments(apps);
      }
      setLoading(false);

      // Proactive silent setup of consultation rooms for any appointments missing visual links
      const unsynced = apps.filter(apt => !apt.meetingLink);
      if (unsynced.length > 0) {
        console.log(`[AUTO SYNC] Found ${unsynced.length} appointments without consultation rooms. Setting up rooms sequentially...`);
        (async () => {
          for (const apt of unsynced) {
            try {
              const res = await fetch("/api/generate-google-meet", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  appointmentId: apt.id,
                  appointmentData: apt,
                  doctorData: appUser
                })
              });
              
              const resCT = res.headers.get("content-type");
              if (res.ok && resCT && resCT.includes("application/json")) {
                const syncData = await res.json();
                await updateDoc(doc(db, "appointments", apt.id), {
                  meetingLink: syncData.meetLink,
                  meetLink: syncData.meetLink,
                  googleMeetLink: syncData.meetLink,
                  eventId: syncData.eventId,
                  startTime: syncData.startTime,
                  endTime: syncData.endTime,
                  createdViaGoogleCalendar: syncData.createdViaGoogleCalendar
                });
              }
            } catch (err) {
              console.error(`[AUTO SYNC] Silent setup failed for appointment ${apt.id}:`, err);
            }
          }
        })();
      }
    }, (error) => {
      console.error("Error fetching appointments:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [doctorUid, doctorStatus, appUser]);

  const handleAvailabilityStatusChange = async (newStatus: string) => {
    if (!appUser) return;
    setUpdatingStatus(true);
    try {
      const response = await fetch('/api/update-doctor-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          doctorId: appUser.uid,
          availabilityStatus: newStatus
        })
      });

      if (!response.ok) {
        throw new Error("Failed to update status through server endpoint");
      }

      const resData = await response.json();
      if (resData.reassignments && resData.reassignments.length > 0) {
        const successfulCount = resData.reassignments.filter((r: any) => r.success).length;
        if (successfulCount > 0) {
          alert(`Status changed to ${newStatus}. Your ${successfulCount} booking(s) have been successfully auto-reallocated to available backup doctors. Patients have been notified instantly.`);
        }
      }
    } catch (err) {
      console.error("Failed to update status:", err);
      alert("Failed to update status. Please try again.");
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (appUser?.role !== 'doctor') {
    return <div className="text-center py-20 bg-background text-foreground">Unauthorized.</div>;
  }

  const currentAvailabilityStatus = (appUser as any)?.availabilityStatus || 'AVAILABLE';

  if (appUser.status === 'PENDING') {
    return (
      <div className="max-w-3xl mx-auto py-12 space-y-6 bg-background text-foreground animate-fade-in">
        <Card className="border-border shadow-md text-center py-12 px-6">
          <CardHeader className="flex flex-col items-center">
            <div className="bg-amber-500/10 p-4 rounded-full mb-4">
              <AlertCircle className="h-14 w-14 text-amber-500" />
            </div>
            <CardTitle className="text-3xl mb-2 font-bold tracking-tight">Application Pending Approval</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg text-muted-foreground max-w-lg mx-auto leading-relaxed">
              Your application to join the HealthConsult network is currently under review by our medical directors. 
              Once reviewed and activated, you will be able to set up your schedule, update availability, and conduct consultations in your secure virtual consultation rooms instantly.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Welcome, Dr. {appUser.name.split(' ')[0]}</h1>
          <p className="text-muted-foreground">Manage your upcoming virtual consultations.</p>
        </div>
        <div className="flex flex-col md:flex-row gap-4 md:items-center">
          <div className="flex items-center gap-3 bg-card border border-border px-4 py-2 rounded-xl">
            <span className="text-sm font-medium text-muted-foreground">My Status:</span>
            <Select 
              value={currentAvailabilityStatus} 
              onValueChange={handleAvailabilityStatusChange}
              disabled={updatingStatus}
            >
              <SelectTrigger className="w-[155px] bg-background border-border text-foreground font-bold text-xs h-9">
                <SelectValue placeholder="My Status" />
              </SelectTrigger>
              <SelectContent className="bg-background border-border text-foreground">
                <SelectItem value="AVAILABLE">🟢 Available</SelectItem>
                <SelectItem value="BUSY">🔴 Busy</SelectItem>
                <SelectItem value="BREAK">🔵 Break</SelectItem>
                <SelectItem value="OFFLINE">⚪ Offline</SelectItem>
                <SelectItem value="EMERGENCY_LEAVE">🚨 On Leave / Emergency</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="shadow-sm border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Patients</CardTitle>
            <UserIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '-' : appointments.length}</div>
          </CardContent>
        </Card>
      </div>
      
      {/* List of appointments */}
      <Card className="bg-card border-border">
         <CardHeader>
           <CardTitle className="text-foreground">My Assigned Appointments</CardTitle>
           <CardDescription className="text-muted-foreground">List of current bookings assigned to you.</CardDescription>
         </CardHeader>
         <CardContent>
           {loading ? (
             <p className="text-center py-8 text-sm text-muted-foreground">Loading consultations...</p>
           ) : appointments.length === 0 ? (
             <p className="text-center py-8 text-sm text-muted-foreground">No appointments currently booked with you.</p>
           ) : (
             <div className="overflow-x-auto">
               <table className="w-full text-sm text-left">
                 <thead className="text-xs text-muted-foreground uppercase bg-background">
                   <tr>
                     <th className="px-4 py-3">Patient Name</th>
                     <th className="px-4 py-3">Date</th>
                     <th className="px-4 py-3">Time</th>
                     <th className="px-4 py-3">Video Link</th>
                     <th className="px-4 py-3">Status</th>
                   </tr>
                 </thead>
                 <tbody>
                   {appointments.map(apt => (
                     <tr key={apt.id} className="border-b border-border hover:bg-muted/10 transition-colors">
                       <td className="px-4 py-3 font-medium text-foreground">{apt.patientName || 'Unknown'}</td>
                       <td className="px-4 py-3 text-muted-foreground">{apt.date}</td>
                       <td className="px-4 py-3 text-muted-foreground">{apt.timeSlot}</td>
                       <td className="px-4 py-3">
                         {apt.meetingLink ? (() => {
                           const { start, end } = parseAppointmentTimes(apt.date, apt.timeSlot);
                           const isEnded = now.getTime() > end.getTime();
                           
                           if (isEnded) {
                             return (
                               <span className="text-xs text-destructive font-semibold block animate-fade-in">
                                 Consultation session has ended.
                               </span>
                             );
                           }
                           
                           return (
                             <button 
                               type="button" 
                               onClick={async (e) => {
                                 e.preventDefault();
                                 e.stopPropagation();
                                 try {
                                   const response = await fetch("/api/validate-consultation-access", {
                                     method: "POST",
                                     headers: { "Content-Type": "application/json" },
                                     body: JSON.stringify({ appointmentId: apt.id, role: 'doctor' })
                                   });
                                   const data = await response.json();
                                   if (data.allowed && data.meetingLink) {
                                     window.open(data.meetingLink, "_blank");
                                   } else {
                                     alert(data.reason || data.error || "Unable to join the consultation session at this time.");
                                   }
                                 } catch (err) {
                                   console.error("Validation failed:", err);
                                   alert("Failed to connect to the verification server. Please try again.");
                                 }
                               }} 
                               className="text-primary hover:underline font-bold bg-transparent border-0 cursor-pointer p-0 text-left"
                             >
                               Join Consultation Room
                             </button>
                           );
                         })() : (
                           <span className="text-muted-foreground animate-pulse">Initializing Room...</span>
                         )}
                       </td>
                       <td className="px-4 py-3">
                         <span className="px-2 py-1 bg-primary/20 text-primary text-xs font-bold rounded-full uppercase">
                           {apt.status}
                         </span>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
           )}
         </CardContent>
      </Card>
      
      {appointments.length > 0 && (
         <div className="mt-8">
            <Chat appointmentId={appointments[0].id!} currentUserId={appUser.uid} currentUserName={appUser.name} />
         </div>
      )}
    </div>
  );
}
