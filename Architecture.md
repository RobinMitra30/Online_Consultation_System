Professional Markdown (.md) workflow documentation file with proper architecture diagrams and flowchart representations for an Online Medical Consultation Platform.

IMPORTANT OUTPUT REQUIREMENTS:
- Output ONLY valid Markdown
- Use Mermaid.js flowcharts and architecture diagrams
- Use proper flowchart shapes:
  - Rectangle boxes for processes
  - Diamond boxes for decisions
  - Rounded boxes for start/end
  - Arrows for workflow directions
- Use clean professional architecture diagrams
- Make diagrams visually structured and readable
- Create production-grade workflow documentation

The documentation should contain multiple workflow diagrams based on the following healthcare consultation platform architecture.

# Required Diagram Types

Generate:
- System Architecture Diagram
- Authentication Flowchart
- Patient Booking Workflow
- Doctor Approval Workflow
- Smart Doctor Assignment Flowchart
- Slot Locking & Collision Prevention Flowchart
- Payment Workflow
- Video Consultation Workflow
- Notification Workflow
- Real-Time Synchronization Workflow
- Database Relationship Diagram
- Appointment Lifecycle State Machine

Use:
- Mermaid flowcharts
- Mermaid sequence diagrams
- Mermaid state diagrams
- Mermaid ER diagrams

---

# 1. Core System Architecture Diagram

Create a professional architecture flow diagram showing:

Frontend:
- React SPA
- TypeScript
- Tailwind CSS

Backend:
- Node.js Express Server
- Cloud Run

Database:
- Firebase Firestore

Authentication:
- Firebase Auth

Video Consultation:
- Jitsi Meet

Payment:
- Razorpay

Realtime:
- Firestore listeners
- WebSockets/Firebase sync

Show arrows representing:
- Data flow
- Authentication flow
- API communication
- Realtime synchronization

---

# 2. Patient Authentication Workflow

Create flowchart showing:

(Start)
↓
Patient opens app
↓
Choose login method
↓
[Decision Diamond]
Google Login OR Email Login OR OTP Login
↓
Authenticate user
↓
Validate session
↓
Fetch role
↓
[Decision Diamond]
Patient valid?
↓
Open patient dashboard
↓
(End)

Include failure paths:
- Invalid login
- Session expired
- Unauthorized role

---

# 3. Patient Booking Workflow Diagram

Create complete end-to-end booking flowchart.

Flow:
Patient Login
↓
Fill Questionnaire
↓
Save questionnaire in Firestore
↓
Select Date
↓
Select 15-minute Slot
↓
[Decision Diamond]
Past slot?
→ YES → Block slot
→ NO → Continue
↓
Find available doctor
↓
Round-robin assignment
↓
Initialize Firestore transaction
↓
Create temporary slot lock
↓
Payment processing
↓
[Decision Diamond]
Payment successful?
→ NO → Release lock
→ YES → Confirm booking
↓
Generate Jitsi meeting room
↓
Send notifications
↓
Show appointment confirmation
↓
(End)

---

# 4. Smart Doctor Assignment Engine Diagram

Create detailed flowchart.

Flow:
Booking request arrives
↓
Fetch all doctors
↓
Filter ACTIVE doctors
↓
Filter AVAILABLE doctors
↓
Remove doctors with existing slot conflict
↓
[Decision Diamond]
Any doctors available?
→ NO → Reject booking
→ YES → Continue
↓
Apply round-robin algorithm
↓
Select least busy doctor
↓
Lock doctor slot
↓
Assign doctor
↓
Update active appointment count
↓
(End)

Include:
- Rotation pointer logic
- Load balancing
- Collision prevention

---

# 5. Slot Locking & Collision Prevention Workflow

Create atomic booking flowchart.

Flow:
Patient clicks Book
↓
Start Firestore transaction
↓
Check existing lock
↓
[Decision Diamond]
Lock exists?
→ YES
     ↓
  Check lock age
     ↓
  [Decision Diamond]
  Lock stale?
  → NO → Reject booking
  → YES → Override stale lock
→ NO → Continue
↓
Create lock document
↓
Process payment
↓
[Decision Diamond]
Payment success?
→ YES → Confirm booking
→ NO → Delete lock
↓
End transaction

Include:
- Race condition handling
- Parallel booking protection
- Atomic operations

---

# 6. Doctor Registration & Approval Workflow

Create flowchart.

Flow:
Doctor Signup
↓
Submit profile
↓
Upload documents
↓
Save doctor profile
↓
Set status = PENDING
↓
Admin notified
↓
Admin reviews profile
↓
[Decision Diamond]
Approve doctor?
→ NO → Reject profile
→ YES → Set ACTIVE
↓
Doctor logs in
↓
Doctor sets AVAILABLE
↓
Doctor joins appointment pool

---

# 7. Video Consultation Workflow

Create consultation session workflow.

Flow:
Appointment time arrives
↓
Patient opens dashboard
↓
Doctor opens dashboard
↓
Both click Join Consultation
↓
Open Jitsi meeting room
↓
Realtime chat enabled
↓
Consultation active
↓
Doctor marks complete
↓
Update appointment status
↓
Remove active lock
↓
Update doctor availability
↓
End session

Include:
- Meeting room generation
- Chat synchronization
- Session completion logic

---

# 8. Notification Workflow Diagram

Create flowchart showing:

Booking confirmed
↓
Generate notifications
↓
Send email to patient
↓
Send email to doctor
↓
Push notification
↓
Dashboard update
↓
Reminder scheduler
↓
24-hour reminder
↓
1-hour reminder
↓
10-minute reminder

---

# 9. Database Relationship Diagram

Generate Mermaid ER diagram for:

Collections:
- users
- doctors
- questionnaires
- appointments
- locks
- chat_messages

Show:
- Relationships
- Foreign keys
- Linked documents
- Data dependencies

---

# 10. Appointment Lifecycle State Machine

Create Mermaid state diagram.

States:
PENDING
↓
LOCKED
↓
PAYMENT_PROCESSING
↓
BOOKED
↓
CONSULTATION_ACTIVE
↓
COMPLETED

Alternative paths:
- CANCELLED
- PAYMENT_FAILED
- EXPIRED
- DOCTOR_REASSIGNED

Include transitions between states.

---

# 11. Realtime Synchronization Workflow

Create architecture diagram showing:

Firestore
↓
Realtime listeners
↓
Patient dashboard updates
↓
Doctor dashboard updates
↓
Slot synchronization
↓
Notification updates

Show:
- onSnapshot subscriptions
- Live updates
- Multi-device synchronization

---

- Be implementation-ready
- Be visually structured
- Represent a real production telemedicine platform architecture
