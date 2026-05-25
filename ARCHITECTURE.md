# Online Medical Consultation Platform — Complete Workflow Documentation

---

# 1. Core System Architecture Diagram

```mermaid
flowchart LR

    subgraph Frontend
        A[React SPA]
        B[TypeScript]
        C[Tailwind CSS]
    end

    subgraph Backend
        D[Node.js Express API]
        E[Google Cloud Run]
    end

    subgraph Firebase
        F[Firebase Auth]
        G[Firestore Database]
        H[Realtime Listeners]
    end

    subgraph Integrations
        I[Jitsi Meet]
        J[Razorpay]
        K[Notification Services]
    end

    A -- API Requests --> D
    B --> A
    C --> A

    D --> E

    E -- Authentication --> F
    E -- Database Access --> G

    G --> H

    H -- Live Updates --> A

    E -- Video Meetings --> I
    E -- Payments --> J
    E -- Notifications --> K
```

---

# 2. Patient Authentication Workflow

```mermaid
flowchart TD

    A([Start])

    B[Patient Opens App]

    C[Choose Login Method]

    D{Select Method}

    E[Google Login]
    F[Email Login]
    G[OTP Login]

    H[Authenticate User]

    I[Validate Session]

    J[Fetch User Role]

    K{Valid Patient Role}

    L[Open Patient Dashboard]

    M([End])

    N[Invalid Login]

    O[Session Expired]

    P[Unauthorized Role]

    A --> B --> C --> D

    D -- Google --> E
    D -- Email --> F
    D -- OTP --> G

    E --> H
    F --> H
    G --> H

    H --> I

    I -- Invalid --> N
    I -- Expired --> O
    I -- Valid --> J

    J --> K

    K -- Yes --> L --> M

    K -- No --> P
```

---

# 3. Patient Booking Workflow

```mermaid
flowchart TD

    A([Start])

    B[Patient Login]

    C[Fill Medical Questionnaire]

    D[Save Questionnaire in Firestore]

    E[Select Date]

    F[Select 15 Minute Slot]

    G{Past Slot}

    H[Block Slot]

    I[Find Available Doctor]

    J[Apply Round Robin Assignment]

    K[Initialize Firestore Transaction]

    L[Create Temporary Slot Lock]

    M[Process Payment]

    N{Payment Successful}

    O[Release Slot Lock]

    P[Confirm Booking]

    Q[Generate Jitsi Meeting Room]

    R[Send Notifications]

    S[Show Appointment Confirmation]

    T([End])

    A --> B --> C --> D --> E --> F --> G

    G -- Yes --> H

    G -- No --> I --> J --> K --> L --> M --> N

    N -- No --> O --> T

    N -- Yes --> P --> Q --> R --> S --> T
```

---

# 4. Smart Doctor Assignment Workflow

```mermaid
flowchart TD

    A([Booking Request])

    B[Fetch All Doctors]

    C[Filter ACTIVE Doctors]

    D[Filter AVAILABLE Doctors]

    E[Remove Slot Conflicts]

    F{Doctors Available}

    G[Reject Booking]

    H[Apply Round Robin Algorithm]

    I[Check Rotation Pointer]

    J[Select Least Busy Doctor]

    K[Lock Doctor Slot]

    L[Assign Doctor]

    M[Update Appointment Count]

    N([End])

    A --> B --> C --> D --> E --> F

    F -- No --> G --> N

    F -- Yes --> H --> I --> J --> K --> L --> M --> N
```

---

# 5. Slot Locking and Collision Prevention Workflow

```mermaid
flowchart TD

    A([Patient Clicks Book])

    B[Start Firestore Transaction]

    C[Check Existing Lock]

    D{Lock Exists}

    E[Check Lock Age]

    F{Lock Stale}

    G[Reject Booking]

    H[Override Stale Lock]

    I[Create Lock Document]

    J[Process Payment]

    K{Payment Success}

    L[Confirm Booking]

    M[Delete Lock]

    N([End Transaction])

    A --> B --> C --> D

    D -- Yes --> E

    D -- No --> I

    E --> F

    F -- No --> G --> N

    F -- Yes --> H --> I

    I --> J --> K

    K -- Yes --> L --> N

    K -- No --> M --> N
```

---

# 6. Doctor Registration and Approval Workflow

```mermaid
flowchart TD

    A([Doctor Signup])

    B[Submit Doctor Profile]

    C[Upload Documents]

    D[Save Profile]

    E[Set Status Pending]

    F[Notify Admin]

    G[Admin Reviews Profile]

    H{Approve Doctor}

    I[Reject Profile]

    J[Set Status Active]

    K[Doctor Login]

    L[Doctor Sets Available]

    M[Join Appointment Pool]

    N([End])

    A --> B --> C --> D --> E --> F --> G --> H

    H -- No --> I --> N

    H -- Yes --> J --> K --> L --> M --> N
```

---

# 7. Payment Workflow

```mermaid
flowchart TD

    A([Start Payment])

    B[Create Razorpay Order]

    C[Initialize Secure Transaction]

    D[Open Razorpay Checkout]

    E[Patient Completes Payment]

    F{Payment Success}

    G[Verify Payment Signature]

    H{Verification Passed}

    I[Confirm Appointment]

    J[Generate Invoice]

    K[Send Receipt]

    L[Release Slot Lock]

    M[Show Payment Failure]

    N([End])

    A --> B --> C --> D --> E --> F

    F -- No --> L --> M --> N

    F -- Yes --> G --> H

    H -- No --> L --> M --> N

    H -- Yes --> I --> J --> K --> N
```

---

# 8. Video Consultation Workflow

```mermaid
flowchart TD

    A([Appointment Time])

    B[Patient Opens Dashboard]

    C[Doctor Opens Dashboard]

    D[Join Consultation]

    E[Open Jitsi Meeting Room]

    F[Enable Realtime Chat]

    G[Consultation Active]

    H[Doctor Marks Complete]

    I[Update Appointment Status]

    J[Remove Active Locks]

    K[Update Doctor Availability]

    L([End Session])

    A --> B
    A --> C

    B --> D
    C --> D

    D --> E --> F --> G --> H --> I --> J --> K --> L
```

---

# 9. Notification Workflow

```mermaid
flowchart TD

    A([Booking Confirmed])

    B[Generate Notifications]

    C[Send Email to Patient]

    D[Send Email to Doctor]

    E[Send Push Notifications]

    F[Update Dashboard]

    G[Schedule Reminder Jobs]

    H[24 Hour Reminder]

    I[1 Hour Reminder]

    J[10 Minute Reminder]

    K([End])

    A --> B

    B --> C
    B --> D
    B --> E
    B --> F

    F --> G --> H --> I --> J --> K
```

---

# 10. Realtime Synchronization Workflow

```mermaid
flowchart LR

    A[Firestore Database]

    B[Realtime Listeners]

    C[Patient Dashboard]

    D[Doctor Dashboard]

    E[Slot Synchronization]

    F[Notification Updates]

    G[Multi Device Sync]

    A --> B

    B --> C

    B --> D

    B --> E

    E --> F

    F --> G
```

---

# 11. Database Relationship Diagram

```mermaid
erDiagram

    USERS {
        string user_id
        string name
        string email
        string role
    }

    DOCTORS {
        string doctor_id
        string specialization
        string status
        boolean available
    }

    QUESTIONNAIRES {
        string questionnaire_id
        string patient_id
        string symptoms
    }

    APPOINTMENTS {
        string appointment_id
        string patient_id
        string doctor_id
        string slot
        string status
    }

    LOCKS {
        string lock_id
        string appointment_slot
        string doctor_id
    }

    CHAT_MESSAGES {
        string message_id
        string appointment_id
        string sender_id
        string message
    }

    USERS ||--o{ QUESTIONNAIRES : submits

    USERS ||--o{ APPOINTMENTS : books

    DOCTORS ||--o{ APPOINTMENTS : handles

    DOCTORS ||--o{ LOCKS : owns

    QUESTIONNAIRES ||--|| APPOINTMENTS : linked

    APPOINTMENTS ||--o{ CHAT_MESSAGES : contains
```

---

# 12. Appointment Lifecycle State Machine

```mermaid
stateDiagram-v2

    [*] --> PENDING

    PENDING --> LOCKED

    LOCKED --> PAYMENT_PROCESSING

    PAYMENT_PROCESSING --> BOOKED : Payment Success

    PAYMENT_PROCESSING --> PAYMENT_FAILED : Payment Failed

    BOOKED --> CONSULTATION_ACTIVE : Consultation Started

    CONSULTATION_ACTIVE --> COMPLETED : Session Completed

    BOOKED --> CANCELLED : Cancelled

    BOOKED --> EXPIRED : No Show

    BOOKED --> DOCTOR_REASSIGNED : Doctor Unavailable

    DOCTOR_REASSIGNED --> BOOKED

    PAYMENT_FAILED --> [*]

    CANCELLED --> [*]

    EXPIRED --> [*]

    COMPLETED --> [*]
```

---

# Production Engineering Notes

## Scalability Features

- Stateless backend architecture using Google Cloud Run
- Firestore realtime synchronization
- Horizontal API scaling
- Distributed lock handling
- Atomic Firestore transactions
- Event-driven notification system

---

# Security Features

- Firebase Authentication
- JWT Session Validation
- Role-Based Access Control (RBAC)
- Secure Payment Verification
- Protected Video Sessions
- Firestore Security Rules

---

# Reliability Features

- Slot collision prevention
- Realtime synchronization
- Transaction rollback handling
- Stale lock cleanup
- Multi-device synchronization support
- Doctor failover assignment

---

# Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript + Tailwind CSS |
| Backend | Node.js + Express.js |
| Hosting | Google Cloud Run |
| Database | Firebase Firestore |
| Authentication | Firebase Authentication |
| Video Calls | Jitsi Meet |
| Payments | Razorpay |
| Notifications | Firebase + Email Services |
| Realtime Sync | Firestore Realtime Listeners |

---

# End of Documentation
