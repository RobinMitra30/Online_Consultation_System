import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { format, addDays, isSameDay, parse, isPast } from 'date-fns';
import { useAuth } from '../components/auth-provider';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, getDocs, query, where, onSnapshot, doc, updateDoc, getDoc, runTransaction, deleteDoc } from 'firebase/firestore';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Calendar } from '../components/ui/calendar';
import { CheckCircle2, Clock } from 'lucide-react';

const MAX_DOCTORS = 4;

const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

// Generates time slots from 10 AM to 6 PM inclusive
const generateTimeSlots = () => {
  const slots = [];
  let hours = 10;
  let minutes = 0;
  
  while (hours < 18 || (hours === 18 && minutes === 0)) {
    const formattedHour = hours > 12 ? hours - 12 : hours;
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedMinutes = minutes === 0 ? '00' : minutes;
    slots.push(`${formattedHour}:${formattedMinutes} ${ampm}`);
    
    minutes += 15;
    if (minutes === 60) {
      hours += 1;
      minutes = 0;
    }
  }
  return slots;
};

const ALL_SLOTS = generateTimeSlots();

function generateGoogleMeetLink(appointmentId: string): string {
  let hash1 = 0;
  let hash2 = 0;
  for (let i = 0; i < appointmentId.length; i++) {
    const char = appointmentId.charCodeAt(i);
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

const verifyAndAllocateDoctor = async (pendingObjId: string): Promise<{ success: boolean; doctorId?: string; error?: string }> => {
  try {
    const aptDocRef = doc(db, 'appointments', pendingObjId);
    
    // Run transaction
    const result = await runTransaction(db, async (transaction) => {
        const aptSnap = await transaction.get(aptDocRef);
        if (!aptSnap.exists()) {
           throw "Appointment record not found.";
        }
        const aptData = aptSnap.data();
        const { date: aptDate, timeSlot: aptTimeSlot, doctorId: currentDoctorId } = aptData;

        // Verify if doctor already locked for this slot
        const lockRef = doc(db, 'locks', `${aptDate}_${aptTimeSlot}_${currentDoctorId}`);
        const lockSnap = await transaction.get(lockRef);
        
        if (lockSnap.exists() && lockSnap.data().appointmentId && lockSnap.data().appointmentId !== aptDocRef.id) {
            const data = lockSnap.data();
            let isLockedValid = true;
            if (data.createdAt && data.createdAt.toDate) {
                const lockTime = data.createdAt.toDate().getTime();
                const now = new Date().getTime();
                if (now - lockTime > 15 * 60 * 1000) {
                   isLockedValid = false;
                }
            }
            if (isLockedValid) {
               throw "Doctor already booked for this slot.";
            }
        }
        
        // Lock it
        transaction.set(lockRef, { docId: currentDoctorId, status: 'locked', appointmentId: aptDocRef.id, createdAt: serverTimestamp() }, { merge: true });
        
        // Update appointment (it already has doctorId assigned outside, we are just verifying if it's still available)                
        transaction.update(aptDocRef, {
           status: 'booked'
        });
        
        return { success: true, doctorId: currentDoctorId };
    });

    return result;

  } catch (err) {
     console.error("verifyAndAllocateDoctor failed:", err);
     return { success: false, error: err as string || "Security check failed. Unable to verify doctor slot availability." };
  }
};

export default function BookingPage() {
  const { user, appUser } = useAuth();
  const navigate = useNavigate();
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [slotCounts, setSlotCounts] = useState<Record<string, number>>({});
  const [activeDoctorsCount, setActiveDoctorsCount] = useState(0); 
  const [loading, setLoading] = useState(false);
  const [paymentStep, setPaymentStep] = useState(false);
  const [pendingAppointmentId, setPendingAppointmentId] = useState<string | null>(null);

  useEffect(() => {
    // Real-time synchronization of active & available doctors
    const q = query(
      collection(db, 'doctors'), 
      where('status', '==', 'ACTIVE')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => d.data() as any);
      const availableDocs = docs.filter(d => (d.availabilityStatus === 'AVAILABLE' || !d.availabilityStatus) && d.status === 'ACTIVE');
      setActiveDoctorsCount(availableDocs.length);
    }, (error) => {
      console.error("Failed to fetch doctors count dynamically", error);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!date) return;
    const formattedDate = format(date, 'yyyy-MM-dd');
    
    const q = query(
      collection(db, 'appointments'),
      where('date', '==', formattedDate),
      where('status', 'in', ['booked', 'completed', 'pending'])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const counts: Record<string, number> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        counts[data.timeSlot] = (counts[data.timeSlot] || 0) + 1;
      });
      setSlotCounts(counts);
    }, (error) => {
      console.error("Snapshot error", error);
    });
    
    setSelectedSlot(null);
    return () => unsubscribe();
  }, [date]);

  const handleProceedToPayment = async () => {
    if (!user || !date || !selectedSlot) return;
    setLoading(true);
    
    const questionnaireId = localStorage.getItem('activeQuestionnaireId');
    const formattedDate = format(date, 'yyyy-MM-dd');

    try {
      // 1. Fetch active and available doctors to assign
      const qDocs = query(
        collection(db, 'doctors'),
        where('status', '==', 'ACTIVE')
      );
      const qsDocs = await getDocs(qDocs);
      const activeAndAvailableDoctors = qsDocs.docs
        .map(d => ({ uid: d.id, ...d.data() } as any))
        .filter(d => (d.availabilityStatus === 'AVAILABLE' || !d.availabilityStatus) && d.status === 'ACTIVE');

      if (activeAndAvailableDoctors.length === 0) {
        setLoading(false);
        alert("No active, connected, and available doctors could be found at this time.");
        return;
      }

      // 2. Query all booked or pending appointments on this slot to see which doctors are busy
      const qApts = query(
        collection(db, 'appointments'),
        where('date', '==', formattedDate),
        where('status', 'in', ['booked', 'pending'])
      );
      const qsApts = await getDocs(qApts);
      
      const busyDoctorIds = qsApts.docs
        .filter(d => d.data().timeSlot === selectedSlot)
        .map(doc => doc.data().doctorId)
        .filter(Boolean);

      // 3. Find doctors who are free
      const freeDoctors = activeAndAvailableDoctors.filter(doc => !busyDoctorIds.includes(doc.uid));

      if (freeDoctors.length === 0) {
        setLoading(false);
        alert("All available doctors are busy for this slot. Please select another slot.");
        setSelectedSlot(null);
        return;
      }

      // 4. Booking initiated

      let resolvedPatientName = appUser?.name || 'Patient';
      if (questionnaireId) {
        try {
          const qSnap = await getDoc(doc(db, 'questionnaires', questionnaireId));
          if (qSnap.exists()) {
            const qData = qSnap.data();
            if (qData && qData.name) {
              resolvedPatientName = qData.name;
            }
          }
        } catch (err) {
          console.error("Failed to fetch name from questionnaire background:", err);
        }
      }

      // 5. Use transaction to create appointment AND lock the slot
      const appointmentRef = await runTransaction(db, async (transaction) => {
         // Get Current Rotation Index
         const rotationRef = doc(db, 'meta', 'doctor_rotation');
         const rotationSnap = await transaction.get(rotationRef);
         const lastIndex = rotationSnap.exists() ? (rotationSnap.data().lastIndex || 0) : 0;
         
         // Loop through doctors to find an unlocked one
         let assignedDoctor = null;
         let assignedIndex = -1;

         for (let i = 0; i < freeDoctors.length; i++) {
             const candidate = freeDoctors[(lastIndex + i) % freeDoctors.length];
             const lockRef = doc(db, 'locks', `${formattedDate}_${selectedSlot}_${candidate.uid}`);
             const lockSnap = await transaction.get(lockRef);
             let isLocked = false;
             if (lockSnap.exists()) {
                 const data = lockSnap.data();
                 isLocked = true;
                 if (data.createdAt && data.createdAt.toDate) {
                     const lockTime = data.createdAt.toDate().getTime();
                     const now = new Date().getTime();
                     if (now - lockTime > 15 * 60 * 1000) { // 15 mins expiry
                         isLocked = false; 
                     }
                 }
             }

             if (!isLocked) {
                 assignedDoctor = candidate;
                 assignedIndex = (lastIndex + i) + 1;
                 break;
             }
         }

         if (!assignedDoctor) {
             throw "No doctors available for this slot.";
         }
         
         // Update Rotation Index
         transaction.set(rotationRef, { lastIndex: assignedIndex }, { merge: true });

         // Lock
         const ref = doc(collection(db, 'appointments'));
         const slotLockRef = doc(db, 'locks', `${formattedDate}_${selectedSlot}_${assignedDoctor.uid}`);
         transaction.set(slotLockRef, { docId: assignedDoctor.uid, status: 'locked', appointmentId: ref.id, createdAt: serverTimestamp() });
         
         transaction.set(ref, {
            userId: user.uid,
            patientName: resolvedPatientName,
            patientEmail: user.email || appUser?.email || '',
            date: formattedDate,
            timeSlot: selectedSlot,
            status: 'pending',
            paymentStatus: 'pending',
            doctorId: assignedDoctor.uid,
            doctorName: assignedDoctor.name,
            doctorEmail: assignedDoctor.email || '',
            questionnaireId: questionnaireId || null,
            createdAt: serverTimestamp()
         });
         return ref;
      });

      setPendingAppointmentId(appointmentRef.id);
      setPaymentStep(true);
    } catch (error) {
      if (error === "Doctor already booked for this slot.") {
         alert("This doctor slot was just taken. Please select another slot.");
      } else if (error === "No doctors available for this slot.") {
         alert(error);
      } else {
         handleFirestoreError(error, OperationType.CREATE, 'appointments');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBookSelected = async () => {
    if (!pendingAppointmentId || !appUser || !user) return;
    setLoading(true);
    
    const questionnaireId = localStorage.getItem('activeQuestionnaireId');

    try {
      const res = await loadRazorpayScript();
      if (!res) {
        alert("Razorpay SDK failed to load. Are you online?");
        setLoading(false);
        return;
      }

      const orderResponse = await fetch("/api/create-razorpay-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 500 }), // 500 INR
      });
      
      let orderData: any = {};
      const orderCT = orderResponse.headers.get("content-type");
      if (orderCT && orderCT.includes("application/json")) {
        orderData = await orderResponse.json();
      } else {
        const text = await orderResponse.text();
        throw new Error(text || `Server returned status ${orderResponse.status}`);
      }

      if (!orderResponse.ok || !orderData.id) {
        alert("Error creating order. Please ensure Razorpay keys are set.");
        setLoading(false);
        return;
      }

      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID, // Enter the Key ID generated from the Dashboard
        amount: orderData.amount, // Amount is in currency subunits. Default currency is INR. Hence, 50000 refers to 50000 paise
        currency: orderData.currency,
        name: "HealthConsult",
        description: "Consultation Fee",
        order_id: orderData.id, //This is a sample Order ID. Pass the `id` obtained in the response of Step 1
        handler: async function (response: any) {
          try {
            // Verify doctor availability before finalizing to prevent double booking
            const verifyRes = await verifyAndAllocateDoctor(pendingAppointmentId);
            if (!verifyRes.success) {
              alert(verifyRes.error || "Doctor availability check failed. Slot no longer available.");
              await updateDoc(doc(db, 'appointments', pendingAppointmentId), {
                status: 'cancelled',
              });
              setPaymentStep(false);
              setPendingAppointmentId(null);
              navigate('/booking');
              return;
            }

            await updateDoc(doc(db, 'appointments', pendingAppointmentId), {
              status: 'booked',
              paymentStatus: 'paid',
              paymentDetails: {
                paymentId: response.razorpay_payment_id,
                orderId: response.razorpay_order_id,
                signature: response.razorpay_signature,
              },
              questionnaireId: questionnaireId || null,
            });

            // Call the automatic Google Meet generation endpoint (no optional/passed parameters, keep it pure on server-side!)
            try {
              const meetRes = await fetch("/api/generate-google-meet", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  appointmentId: pendingAppointmentId
                })
              });
              
              let syncData: any = {};
              const meetCT = meetRes.headers.get("content-type");
              if (meetCT && meetCT.includes("application/json")) {
                syncData = await meetRes.json();
              } else {
                const text = await meetRes.text();
                throw new Error(text || `Server returned status ${meetRes.status}`);
              }

              if (!meetRes.ok) {
                throw new Error(syncData.error || "Failed to generate Google Meet on backend");
              }

              await updateDoc(doc(db, 'appointments', pendingAppointmentId), {
                meetingLink: syncData.meetLink,
                meetLink: syncData.meetLink,
                googleMeetLink: syncData.meetLink,
                eventId: syncData.eventId,
                startTime: syncData.startTime,
                endTime: syncData.endTime,
                createdViaGoogleCalendar: syncData.createdViaGoogleCalendar
              });
            } catch (meetErr) {
              console.warn("Falling back to unique client-side Google Meet link generation:", meetErr);
              const fallbackMeet = generateGoogleMeetLink(pendingAppointmentId);
              await updateDoc(doc(db, 'appointments', pendingAppointmentId), {
                meetingLink: fallbackMeet,
                meetLink: fallbackMeet,
                googleMeetLink: fallbackMeet
              });
            }
            
            setPaymentStep(false);
            setPendingAppointmentId(null);
            navigate('/dashboard');
          } catch (error) {
            handleFirestoreError(error, OperationType.UPDATE, 'appointments');
          }
        },
        prefill: {
          name: appUser.name,
          email: user.email,
        },
        theme: {
          color: "#14B8A6"
        }
      };

      const rzp1 = new (window as any).Razorpay(options);
      rzp1.on('payment.failed', function (response: any) {
        alert("Payment failed: " + response.error.description);
      });
      rzp1.open();
      
    } catch (error) {
      console.error(error);
      alert("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleMockPayment = async () => {
    if (!pendingAppointmentId || !appUser || !user) return;
    setLoading(true);
    
    const questionnaireId = localStorage.getItem('activeQuestionnaireId');

    try {
      // Verify doctor availability before finalizing to prevent double booking
      const verifyRes = await verifyAndAllocateDoctor(pendingAppointmentId);
      if (!verifyRes.success) {
        alert(verifyRes.error || "Doctor availability check failed. Slot no longer available.");
        await updateDoc(doc(db, 'appointments', pendingAppointmentId), {
          status: 'cancelled',
        });
        setPaymentStep(false);
        setPendingAppointmentId(null);
        setLoading(false);
        return;
      }

      await updateDoc(doc(db, 'appointments', pendingAppointmentId), {
        status: 'booked',
        paymentStatus: 'paid', // Treated as paid for testing
        paymentDetails: {
          testMode: 'cod_mock',
        },
        questionnaireId: questionnaireId || null,
      });

      // Fetch or generate stable, permanent meet link via backend
      try {
        const meetRes = await fetch("/api/generate-google-meet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ appointmentId: pendingAppointmentId })
        });
        
        let errData: any = {};
        const meetCT = meetRes.headers.get("content-type");
        if (meetCT && meetCT.includes("application/json")) {
          errData = await meetRes.json();
        } else {
          const text = await meetRes.text();
          throw new Error(text || `Server returned status ${meetRes.status}`);
        }

        if (!meetRes.ok) {
          throw new Error(errData.error || "Failed to generate video consultation room on backend");
        }
      } catch (meetErr) {
        console.warn("Falling back to unique client-side Google Meet link generation:", meetErr);
        const fallbackMeet = generateGoogleMeetLink(pendingAppointmentId);
        await updateDoc(doc(db, 'appointments', pendingAppointmentId), {
          meetingLink: fallbackMeet,
          meetLink: fallbackMeet,
          googleMeetLink: fallbackMeet
        });
      }
      
      setPaymentStep(false);
      setPendingAppointmentId(null);
      navigate('/dashboard');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'appointments');
    } finally {
      setLoading(false);
    }
  };

  const cancelPendingPayment = async () => {
    if (pendingAppointmentId) {
      try {
        const aptDocRef = doc(db, 'appointments', pendingAppointmentId);
        const aptSnap = await getDoc(aptDocRef);
        if (aptSnap.exists()) {
           const { date, timeSlot, doctorId } = aptSnap.data();
           // Remove lock document
           await deleteDoc(doc(db, 'locks', `${date}_${timeSlot}_${doctorId}`));
        }
        
        await updateDoc(aptDocRef, {
          status: 'cancelled',
        });
      } catch (error) {
        console.error("Error cancelling pending appointment:", error);
      }
    }
    setPaymentStep(false);
    setPendingAppointmentId(null);
  };

  if(!date) {
    setDate(new Date());
  }

  const maxDate = addDays(new Date(), 30);

  if (paymentStep) {
    return (
      <div className="max-w-md mx-auto py-12">
        <Card className="bg-card border-border">
          <CardHeader className="text-center">
            <CardTitle className="text-foreground">Complete Payment</CardTitle>
            <CardDescription className="text-muted-foreground">Consultation Fee: ₹500</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-background p-4 rounded-xl border border-border space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Date</span>
                <span className="font-medium text-foreground">{format(date!, 'PPP')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Time</span>
                <span className="font-medium text-foreground">{selectedSlot}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Duration</span>
                <span className="font-medium text-foreground">15 Minutes</span>
              </div>
            </div>
            
            <div className="space-y-3">
              <Button onClick={handleBookSelected} disabled={loading} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-12 font-bold">
                {loading ? 'Processing...' : 'Pay ₹500 (Confirm Booking)'}
              </Button>
              <Button onClick={handleMockPayment} disabled={loading} variant="outline" className="w-full text-foreground border-border hover:bg-accent h-12 font-bold">
                {loading ? 'Processing...' : 'Test Booking (Cash on Delivery)'}
              </Button>
              <Button variant="ghost" onClick={cancelPendingPayment} disabled={loading} className="w-full text-foreground hover:bg-accent text-muted-foreground">
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isToday = isSameDay(date || new Date(), new Date());

  return (
    <div className="max-w-4xl mx-auto py-8">
      <h2 className="text-3xl font-bold mb-8 text-center tracking-tight text-foreground">Select an Appointment Slot</h2>
      
      <div className="grid md:grid-cols-2 gap-8">
        <Card className="shadow-none border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground">1. Choose Date</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              disabled={(d) => {
                const startOfToday = new Date();
                startOfToday.setHours(0, 0, 0, 0);
                return d < startOfToday || d > maxDate;
              }}
              className="border border-border rounded-xl p-4 bg-background text-foreground"
            />
          </CardContent>
        </Card>

        <Card className="shadow-none border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground">2. Choose Time</CardTitle>
            <CardDescription className="text-muted-foreground">{date ? format(date, 'PPPP') : 'Select a date'}</CardDescription>
          </CardHeader>
          <CardContent>
            {date ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  {ALL_SLOTS.map((slot) => {
                    let isBooked = (slotCounts[slot] || 0) >= activeDoctorsCount;
                    // If it's today, we must also check if the slot is in the past
                    if (isToday && !isBooked) {
                      const slotDate = parse(slot, "h:mm a", date);
                      if (isPast(slotDate)) {
                        isBooked = true; // functionally disabled
                      }
                    }
                    
                    const isSelected = selectedSlot === slot;
                    return (
                      <Button
                        key={slot}
                        variant={isSelected ? 'default' : 'outline'}
                        className={`h-14 flex flex-col items-center justify-center p-1 ${isBooked ? 'opacity-60 cursor-not-allowed bg-accent border-border text-muted-foreground' : 'border-border text-muted-foreground hover:border-primary/50'} ${isSelected ? 'ring-2 ring-primary bg-primary/10 text-primary border-primary/50' : ''}`}
                        disabled={isBooked}
                        onClick={() => setSelectedSlot(slot)}
                      >
                        <span className="font-semibold text-xs">{slot}</span>
                        {isBooked && (
                          <span className="text-[9.5px] text-destructive font-semibold mt-0.5 whitespace-nowrap">No docs available</span>
                        )}
                      </Button>
                    );
                  })}
                </div>

                {activeDoctorsCount === 0 && (
                  <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-center">
                    <p className="text-amber-500 text-sm font-semibold">No doctors are currently available. Please check back later.</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">Select a date to view available time slots.</p>
            )}
            
            {selectedSlot && (
              <div className="mt-8 pt-6 border-t border-border">
                <Button 
                  className="w-full h-12 text-lg bg-primary text-primary-foreground hover:bg-primary/90 font-bold" 
                  onClick={handleProceedToPayment}
                  disabled={loading}
                >
                  {loading ? "Locking slot..." : "Proceed to Pay ₹500"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
