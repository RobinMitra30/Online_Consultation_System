export type UserRole = 'patient' | 'admin' | 'doctor';

export interface User {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt?: string;
}

export type DoctorAvailabilityStatus = 'AVAILABLE' | 'BUSY' | 'BREAK' | 'OFFLINE' | 'EMERGENCY_LEAVE';

export interface Doctor {
  uid: string;
  doctorId?: string;
  name: string;
  email: string;
  phone: string;
  role: 'doctor';
  status: 'PENDING' | 'ACTIVE';
  googleConnected?: boolean;
  googleTokenExpired?: boolean;
  googleEmail?: string;
  googleAccessToken?: string;
  googleRefreshToken?: string;
  availabilityStatus?: DoctorAvailabilityStatus;
  specialization?: string;
  approvalStatus?: string;
  createdAt?: string;
}

export type AppUser = User | Doctor;

export interface Questionnaire {
  id?: string;
  userId: string;
  name: string;
  age?: number;
  gender?: string;
  phone: string;
  concern: string;
  symptoms?: string;
  history?: string;
  createdAt: string;
}

export interface Appointment {
  id?: string;
  userId: string;
  date: string;
  timeSlot: string;
  status: 'pending' | 'booked' | 'completed' | 'cancelled' | 'expired';
  paymentStatus?: 'pending' | 'paid';
  meetingLink?: string;
  questionnaireId?: string;
  patientName?: string;
  doctorId?: string;
  doctorName?: string;
  createdViaGoogleCalendar?: boolean;
  eventId?: string;
  createdAt: any;
  // Requested extensions
  appointmentId?: string;
  patientId?: string;
  appointmentTime?: string;
  appointmentStatus?: string;
  meetLink?: string;
  calendarEventId?: string;
}

export interface Meeting {
  meetingId: string;
  appointmentId: string;
  doctorId: string;
  patientId: string;
  meetLink: string;
  startTime?: string;
  endTime?: string;
  status: string;
}

export interface ChatMessage {
  id?: string;
  appointmentId: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: any;
}
