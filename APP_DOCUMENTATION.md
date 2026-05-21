# Online Medical Consultation & Telemedicine Platform - Technical Documentation

## Project Overview
This platform is a comprehensive, real-time web application designed to digitize the Outpatient Department (OPD) booking experience and facilitate secure, seamless tele-consultations.

### Telemedicine Workflow
1. **Patient Registration/Login**: Patients authenticate to access the booking portal.
2. **Pre-Consultation Questionnaire**: Patients submit medical details to assist the doctor.
3. **Appointment Booking**: Patients select a slot; the system intelligently assigns the optimal available doctor.
4. **Payment**: Secure payment processing ensures booking confirmation.
5. **Meeting Generation**: Platform dynamically provisions a private consultation room (Jitsi).
6. **Consultation**: Patient and doctor join the session seamlessly.
7. **Post-Consultation**: Access to records, prescriptions, and invoices.

### User Roles
- **Patient**: Books slots, manages appointments, chats, and meets doctors.
- **Doctor**: Manages schedule, conducts consultations, chats with patients, views appointment history.
- **Admin**: Oversees platform operations, doctor approvals, and analytics.

---

## Patient Authentication System
- **Google OAuth (Patients)**: Streamlined onboarding for new and returning patients.
- **Email/Password**: Standard fallback authentication.
- **Session Management**: Firebase Authentication handles sessions, persisting credentials across site reloads.

---

## Smart Appointment Booking System
- **Calendar Architecture**: 24-hour cycle rendering with configurable OPD timings.
- **Slot Granularity**: Standardized 15-minute intervals.
- **Slot Logic**: Slots are dynamically generated based on doctor availability.
- **Real-time Availability**: Firestore real-time listeners ensure that available/booked statuses are reflected immediately to all users.

### Past Slot Blocking
- Strictly blocks any slot where the date is in the past.
- Automatically hides or disables slots that are occurring in the current or past time window relative to the system clock.

---

## Multi-Doctor Management System
- **Doctor Signup**: Simplified registration via email/password. **Does not require Google OAuth.**
- **Doctor Approval**: Admins must review and approve profiles before they appear in the booking pool.
- **Availability Controls**: Doctors can toggle status (Available, Busy, Break, Offline).

---

## Smart Doctor Assignment Engine
To ensure equitable distribution, the system utilizes a **Round-Robin Assignment Algorithm**:
1. **Pool Identification**: Fetches all doctors currently marked as `AVAILABLE`.
2. **Rotation Index**: Tracks the `lastIndex` in a `meta/doctor_rotation` document.
3. **Selection**: Assigns a doctor using `lastIndex % totalAvailableDoctors`.
4. **Collision Check**: Verifies if the selected doctor already has a lock on that slot (using Firestore Transactions).
5. **Update**: Increments `lastIndex` upon a successful booking lock.

---

## Collision Prevention System
The platform enforces strict atomicity using **Firestore Transactions**:
1. **Attempt Lock**: When a user clicks "Book", a transaction checks for a lock document (`locks/{date}_{slot}_{doctorId}`).
2. **Transaction Integrity**: If the lock exists, the transaction fails, prompting the user with "No doctors available" or "Slot taken".
3. **Race Condition Protection**: By bundling the read (lock check) and write (lock set) in one atomic transaction, parallel booking requests are guaranteed to fail if they attempt to book the same slot/doctor.

---

## Video Consultation System (Jitsi Integration)
The platform features a native, simplified meeting experience without required OAuth dependencies to reduce friction.

- **Room Generation**: Automated upon payment confirmation.
- **Room Lifecycle**: Rooms are private and mapped to `appointmentId`.
- **Naming Pattern**: `consultation-[appointmentId]`.
- **Join Flow**: Doctors and patients use `window.open(meetingLink, "_blank")`.

---

## Database Architecture (Firestore)

### Doctor Schema
```json
{
  "uid": "DOC001",
  "name": "Dr. Smith",
  "availabilityStatus": "AVAILABLE",
  "currentActiveAppointments": 0,
  "role": "doctor"
}
```

### Appointment Schema
```json
{
  "appointmentId": "APT001",
  "patientId": "PAT001",
  "assignedDoctorId": "DOC001",
  "slotTime": "10:00 AM",
  "date": "2026-05-22",
  "status": "booked",
  "meetLink": "https://meet.jit.si/consultation-APT001"
}
```

---

## Real-Time Synchronization
- **WebSocket/Firebase**: Utilizes Firestore `onSnapshot` listeners to observe changes in `appointments`, `doctors`, and `chat_messages` collections.
- **Dashboard Updates**: When a doctor is assigned or a status changes, React state hooks automatically trigger UI re-renders across all active sessions.

---

## Edge Cases & Failure Handling
| Scenario | Handling Strategy |
| :--- | :--- |
| **Simultaneous Booking** | Firestore transaction fails atomic check; user notified. |
| **Payment Failure** | Slot is NOT locked permanently; error message shown to user. |
| **Doctor Offline** | Assignment logic skips doctors whose `status` is not `AVAILABLE`. |
| **Meeting Link Expired** | System re-provisions or notifies Admin. |

---

## Production Deployment Architecture
- **Frontend**: Vite-compiled React app served as a static SPA.
- **Backend/API**: Node.js Express server running on Cloud Run.
- **Database**: Firestore (Server-side SDK used for sensitive operations).
- **Environment**: Managed via `.env` files (API keys for Firebase Admin, Razorpay, etc.).
