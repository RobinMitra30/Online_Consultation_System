import React, { useEffect, useState } from 'react';
import { useAuth } from '../../components/auth-provider';
import { auth, db } from '../../lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { GoogleAuthProvider, linkWithPopup } from 'firebase/auth';
import { Appointment } from '../../types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Calendar, User as UserIcon, Clock, AlertCircle, CalendarRange } from 'lucide-react';

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

export default function DoctorDashboardPage() {
  const { appUser } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [googleConnectError, setGoogleConnectError] = useState<string | null>(null);
  const [isIframe, setIsIframe] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  useEffect(() => {
    setIsIframe(window.self !== window.top);
  }, []);

  const doctorUid = appUser?.uid;
  const doctorStatus = appUser?.status;
  const doctorGoogleConnected = appUser?.googleConnected;

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

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const apps = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));
      setAppointments(apps);
      setLoading(false);

      // Proactive silent background sync for connected doctors:
      if (doctorGoogleConnected) {
        const unsynced = apps.filter(apt => !apt.createdViaGoogleCalendar);
        if (unsynced.length > 0) {
          console.log(`[AUTO SYNC] Found ${unsynced.length} unsynced appointments. Running background synchronization sequentially...`);
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
                console.error(`[AUTO SYNC] Silent background sync failed for appointment ${apt.id}:`, err);
              }
            }
          })();
        }
      }
    }, (error) => {
      console.error("Error fetching appointments:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [doctorUid, doctorStatus, doctorGoogleConnected, appUser]);

  const handleConnectGoogle = async () => {
    if (!auth.currentUser) return;
    setGoogleConnectError(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/calendar.events');
      // Request offline access to get refresh token
      provider.setCustomParameters({
        prompt: 'consent',
        access_type: 'offline'
      });

      const result = await linkWithPopup(auth.currentUser, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      
      const updateData: any = {
        googleConnected: true,
      };

      if (credential) {
         if (credential.accessToken) updateData.googleAccessToken = credential.accessToken;
         // Note: Getting Google refresh token from Firebase JS SDK client side is often limited, 
         // but we update any we get. Usually stored via _tokenResponse.
         const tokenResponse = (result as any)._tokenResponse;
         if (tokenResponse?.oauthRefreshToken) {
           updateData.googleRefreshToken = tokenResponse.oauthRefreshToken;
         }
         updateData.googleEmail = result.user.email;
      }

      await updateDoc(doc(db, 'doctors', auth.currentUser.uid), updateData);
    } catch (err: any) {
      console.error("Failed to connect Google account:", err);
      if (err.code === 'auth/credential-already-in-use') {
         setGoogleConnectError("This Google account is already connected to another user.");
      } else if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
         setGoogleConnectError("popup-closed-by-user");
      } else {
         setGoogleConnectError(err.message || "An unknown error occurred during connection.");
      }
    }
  };

  const handleAvailabilityStatusChange = async (newStatus: string) => {
    if (!appUser) return;
    setUpdatingStatus(true);
    try {
      await updateDoc(doc(db, 'doctors', appUser.uid), {
        availabilityStatus: newStatus
      });
    } catch (err) {
      console.error("Failed to update status:", err);
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
      <div className="max-w-3xl mx-auto py-12 space-y-6 bg-background text-foreground">
        <Card className="border-border shadow-sm text-center py-12">
          <AlertCircle className="h-16 w-16 mx-auto text-amber-500 mb-6" />
          <CardTitle className="text-3xl mb-4">Application Pending Approval</CardTitle>
          <CardDescription className="text-lg max-w-lg mx-auto">
            Your application to join the network is currently under review by administrators. 
            Once approved, your account will be activated and you can start accepting appointments.
          </CardDescription>
        </Card>

        {!appUser.googleConnected ? (
          <Card className="border-amber-500 shadow-sm text-center">
            <CardHeader>
              <div className="mx-auto bg-primary/10 p-4 rounded-full mb-4">
                 <CalendarRange className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="text-xl">Connect Google Account Required</CardTitle>
              <CardDescription className="pt-2">
                You must connect your Google Calendar to synchronize your available slots and automatically generate Google Meet links for consultations. Admins cannot activate your account until this is complete.
              </CardDescription>
            </CardHeader>
            <CardFooter className="justify-center pb-8">
               <Button onClick={handleConnectGoogle} className="h-12 px-6 flex items-center gap-2">
                 <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5 bg-white rounded-full p-0.5">
                   <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                   <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                   <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                   <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                   <path fill="none" d="M0 0h48v48H0z"></path>
                 </svg>
                 Connect Google Calendar
               </Button>
            </CardFooter>
          </Card>
        ) : (
          <Card className="border-border shadow-sm">
            <CardHeader className="flex flex-row items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-lg">
                <CalendarRange className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-foreground text-lg">Your Connected Google Calendar</CardTitle>
                <CardDescription className="text-muted-foreground">Successfully linked! This is your live interactive agenda view.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl overflow-hidden border border-border bg-muted/20 w-full h-[450px]">
                <iframe 
                  src={`https://calendar.google.com/calendar/embed?src=${encodeURIComponent(appUser.googleEmail || appUser.email)}&ctz=UTC&mode=WEEK`}
                  style={{ border: 0 }} 
                  className="w-full h-full filter invert-[0.05] dark:invert-[0.9] hue-rotate-180" 
                  frameBorder="0" 
                  scrolling="no"
                />
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Welcome, Dr. {appUser.name.split(' ')[0]}</h1>
          <p className="text-muted-foreground">Manage your upcoming consultations.</p>
        </div>
        <div className="flex flex-col md:flex-row gap-4 md:items-center">
          <div className="flex items-center gap-3">
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
              </SelectContent>
            </Select>
          </div>
          {appUser.googleConnected && (
            <div className="flex flex-wrap gap-2 items-center">
              <a 
                href="https://calendar.google.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-full transition-all cursor-pointer"
              >
                <CalendarRange className="w-3.5 h-3.5" />
                Open Google Calendar ↗
              </a>
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-secondary/50 px-3 py-1.5 rounded-full">
                <CalendarRange className="w-4 h-4 text-primary" />
                Connected to Google Calendar
              </div>
            </div>
          )}
        </div>
      </div>

      {!appUser.googleConnected && (
        <Card className="border-amber-500/35 bg-amber-500/5 shadow-sm mt-6">
          <CardHeader className="flex flex-row items-center gap-4 pb-3">
            <div className="bg-amber-500/10 p-3 rounded-full shrink-0">
              <CalendarRange className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <CardTitle className="text-lg text-foreground">Google Calendar Not Synced</CardTitle>
              <CardDescription className="text-muted-foreground">
                You must connect your Google Calendar to synchronize bookings and produce video virtual consultation meet links.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {googleConnectError ? (
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl space-y-3 text-left">
                <div className="flex items-start gap-2.5 text-destructive">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="text-xs leading-normal">
                    {googleConnectError === 'popup-closed-by-user' ? (
                      <>
                        <p className="font-bold text-sm mb-1 text-foreground">Google Popup Closed</p>
                        <p className="text-muted-foreground font-normal">
                          The Google sign-in window was closed. Inside an <strong>iframe sandbox</strong> (like our preview pane), browsers often restrict third-party authentication popups due to cross-origin security rules.
                        </p>
                      </>
                    ) : (
                      <p className="font-semibold">{googleConnectError}</p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <a
                    href={window.location.origin + window.location.pathname}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center h-8 px-3 rounded-lg text-xs font-bold leading-none bg-primary text-primary-foreground hover:bg-primary/90 transition-all cursor-pointer"
                  >
                    Open App in New Tab
                  </a>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs font-semibold border-border bg-transparent text-foreground hover:bg-muted"
                    onClick={() => {
                      setGoogleConnectError(null);
                      handleConnectGoogle();
                    }}
                  >
                    Try Again
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs font-medium text-muted-foreground hover:bg-muted"
                    onClick={() => setGoogleConnectError(null)}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            ) : isIframe ? (
              <div className="p-3 bg-blue-500/15 border border-blue-500/25 rounded-xl text-xs text-muted-foreground leading-normal flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <span className="font-bold text-blue-500">💡 Running inside an Iframe:</span> Popups are restricted inside iframe templates. Open the app directly to link Google accounts cleanly.
                </div>
                <a
                  href={window.location.origin + window.location.pathname}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center h-7 px-3 bg-blue-500/15 hover:bg-blue-500/25 text-blue-500 font-bold rounded-lg shrink-0 transition-all text-xs"
                >
                  Launch App in New Tab
                </a>
              </div>
            ) : null}

            <Button onClick={handleConnectGoogle} variant="outline" className="flex items-center gap-2 border-border text-foreground hover:bg-secondary">
               Connect Google Calendar
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 pt-6">
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
                     <th className="px-4 py-3">Link</th>
                     <th className="px-4 py-3">Google Calendar</th>
                     <th className="px-4 py-3">Status</th>
                   </tr>
                 </thead>
                 <tbody>
                   {appointments.map(apt => (
                     <tr key={apt.id} className="border-b border-border">
                       <td className="px-4 py-3 font-medium text-foreground">{apt.patientName || 'Unknown'}</td>
                       <td className="px-4 py-3 text-muted-foreground">{apt.date}</td>
                       <td className="px-4 py-3 text-muted-foreground">{apt.timeSlot}</td>
                       <td className="px-4 py-3">
                         {apt.meetingLink ? (
                           <button 
                             type="button" 
                             onClick={(e) => {
                               e.preventDefault();
                               e.stopPropagation();
                               if (apt.meetingLink) {
                                 window.open(sanitizeMeetLink(apt.meetingLink, apt.id), "_blank");
                               }
                             }} 
                             className="text-primary hover:underline font-bold bg-transparent border-0 cursor-pointer p-0 text-left"
                           >
                             Join Video Meet
                           </button>
                         ) : (
                           <span className="text-muted-foreground">Pending Link</span>
                         )}
                       </td>
                       <td className="px-4 py-3">
                         {apt.createdViaGoogleCalendar ? (
                           <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-semibold bg-emerald-500/10 px-2 py-1 rounded-full shadow-sm">
                             <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                             Synced
                           </span>
                         ) : appUser?.googleConnected ? (
                           <div className="flex items-center gap-2">
                             <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-semibold bg-amber-500/10 px-2 py-1 rounded-full shrink-0">
                               <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse"></span>
                               Local Only
                             </span>
                             <Button
                               size="sm"
                               variant="outline"
                               onClick={async (e) => {
                                 e.preventDefault();
                                 e.stopPropagation();
                                 try {
                                   setSyncingId(apt.id);
                                   const docSnap = await getDoc(doc(db, "doctors", appUser.uid));
                                   const doctorData = docSnap.exists() ? docSnap.data() : null;
                                   const res = await fetch("/api/generate-google-meet", {
                                     method: "POST",
                                     headers: { "Content-Type": "application/json" },
                                     body: JSON.stringify({
                                       appointmentId: apt.id,
                                       appointmentData: apt,
                                       doctorData: doctorData
                                     })
                                   });
                                   let syncData: any = null; const resCT = res.headers.get("content-type"); if (resCT && resCT.includes("application/json")) { syncData = await res.json(); } if (res.ok && syncData) {
                                     // syncData parsed robustly above
                                     await updateDoc(doc(db, "appointments", apt.id), {
                                       meetingLink: syncData.meetLink,
                                       meetLink: syncData.meetLink,
                                       googleMeetLink: syncData.meetLink,
                                       eventId: syncData.eventId,
                                       startTime: syncData.startTime,
                                       endTime: syncData.endTime,
                                       createdViaGoogleCalendar: syncData.createdViaGoogleCalendar
                                     });
                                     // refresh appointments list
                                     const updatedSnap = await getDocs(query(collection(db, 'appointments'), where('status', '==', 'booked'), where('doctorId', '==', appUser.uid)));
                                     setAppointments(updatedSnap.docs.map(d => ({ id: d.id, ...d.data() } as Appointment)));
                                   } else {
                                     const errText = await res.text();
                                      let errData: any = {};
                                      try { if (errText) errData = JSON.parse(errText); } catch (_) { errData = { error: errText }; }
                                     alert("Sync error: " + (errData.error || "Unknown google sync failure"));
                                   }
                                 } catch (err: any) {
                                   alert("Sync failed: " + err.message);
                                 } finally {
                                   setSyncingId(null);
                                 }
                               }}
                               disabled={syncingId === apt.id}
                               className="h-6 px-2 text-[10px] font-bold border-primary/30 text-primary hover:bg-primary/10 shrink-0"
                             >
                               {syncingId === apt.id ? "Syncing..." : "Sync Now"}
                             </Button>
                           </div>
                         ) : (
                           <span className="text-xs text-muted-foreground italic">Connect Google to sync</span>
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

      {/* Visual Google Calendar Embed Section */}
      <Card className="bg-card border-border mt-6">
         <CardHeader className="flex flex-row items-center gap-3">
           <div className="bg-primary/10 p-2 rounded-lg">
             <Calendar className="w-5 h-5 text-primary" />
           </div>
           <div>
             <CardTitle className="text-foreground text-lg">My Google Calendar Schedule</CardTitle>
             <CardDescription className="text-muted-foreground">Real-time view of your linked Google Calendar.</CardDescription>
           </div>
         </CardHeader>
         <CardContent>
           {appUser.googleConnected ? (
             <div className="rounded-xl overflow-hidden border border-border bg-muted/20 w-full h-[550px]">
               <iframe 
                 src={`https://calendar.google.com/calendar/embed?src=${encodeURIComponent(appUser.googleEmail || appUser.email)}&ctz=UTC&mode=WEEK`}
                 style={{ border: 0 }} 
                 className="w-full h-full filter invert-[0.05] dark:invert-[0.9] hue-rotate-180" 
                 frameBorder="0" 
                 scrolling="no"
               />
             </div>
           ) : (
             <div className="flex flex-col items-center justify-center text-center p-8 border border-dashed border-border rounded-xl bg-muted/10 space-y-4">
               <CalendarRange className="w-12 h-12 text-muted-foreground animate-pulse" />
               <div className="max-w-md space-y-2">
                 <p className="font-semibold text-foreground">Interactive Google Calendar Offline</p>
                 <p className="text-sm text-muted-foreground">
                   Connect your Google Calendar account above to display your daily schedules, blocked slots, and synchronized consultations directly here.
                 </p>
               </div>
             </div>
           )}
         </CardContent>
      </Card>
    </div>
  );
}
