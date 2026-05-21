# Platform Handbook: Online Medical Consultation System

Welcome to the Online Medical Consultation Platform. This handbook provides a detailed overview of our features, user workflows, and platform operations.

---

## 1. Introduction
Our platform is a modern, real-time telemedicine solution designed to make connecting with doctors simple, secure, and efficient. We eliminate the friction of traditional OPD booking by using intelligent scheduling, real-time synchronization, and seamless integrated video consultations.

---

## 2. Core Features

### Intelligent Appointment Booking
Our smart booking engine ensures that you get matched with an available doctor efficiently.
- **Round-Robin Assignment**: Patients are intelligently distributed among available doctors to balance workloads.
- **Real-Time Collision Prevention**: Every booking is processed inside an atomic transaction. This guarantees that two patients cannot book the same doctor for the same slot simultaneously.

### Real-Time Consultation Chat
Every consultation session includes a private, integrated chat room.
- **Instant Messaging**: Exchange messages directly with your doctor during the consultation.
- **Persistent History**: Chat messages are securely saved and associated with the specific consultation appointment.

### Role-Based Dashboards
- **Patient Dashboard**: Manage bookings, join video meetings, view your assigned doctor's details (such as their name), access prescriptions, and view consultation history.
- **Doctor Dashboard**: Manage your daily schedule, update your clinical status, and conduct consultations.
- **Admin Dashboard**: Oversee clinic operations, approve new doctor profiles, and monitor system-wide appointments.

---

## 3. Video Consultation Module
We utilize **Jitsi Meet** to provide high-quality video sessions.

- **How to Join**: Click the "Join Consultation" button on your dashboard. This will securely open the meeting in a new browser tab.
- **Auto-Generated Rooms**: Every appointment gets a private, unique Jitsi room link (e.g., `https://meet.jit.si/consultation-APT123`).
- **No Extra Sign-ins**: You do not need a Jitsi account. Access is authorized directly via our platform.

---

## 4. User Guides

### For Patients
1.  **Sign Up**: Create an account using your email or Google login.
2.  **Questionnaire**: Fill out the brief pre-consultation form so the doctor understands your medical needs.
3.  **Book**: Select a date and time slot.
4.  **Confirm**: Complete the payment step to lock in your appointment.
5.  **Join**: On the day of the appointment, visit your dashboard and click "Join Consultation".

### For Doctors
1.  **Register**: Create an account and submit your credentials.
2.  **Approval**: An administrator will review and approve your account.
3.  **Manage Availability**: Use your dashboard to set your status (Available, Busy, Break, Offline).
4.  **Conduct Sessions**: View your upcoming appointments and join meetings with patients.

### For Administrators
1.  **Doctor Management**: Review and approve newly registered doctors.
2.  **Monitoring**: Use the Admin Dashboard to track active consultations, total appointments, and overall clinic health.

---

## 5. Frequently Asked Questions (FAQ)

**Q: Is my consultation private?**
A: Yes. All meeting links are unique to your specific appointment and are protected.

**Q: What happens if I lose internet during a session?**
A: Simply refresh your Jitsi room tab or re-click the "Join Consultation" button from your patient/doctor dashboard.

**Q: Do I need to install any software for video calls?**
A: No, Jitsi Meet runs entirely within your modern web browser.

**Q: Can I chat with the doctor before the session?**
A: The chat module is designed for active consultation time. If you need to share details beforehand, please use the pre-consultation questionnaire.
