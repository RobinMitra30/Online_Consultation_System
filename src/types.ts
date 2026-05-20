export type UserRole = 'patient' | 'admin' | 'doctor';

export interface User {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt?: string;
}

export type DoctorAvailabilityStatus = 'AVAILABLE' | 'BUSY' | 'BREAK' | 'OFFLINE';

export interface Doctor {
  uid: string;
  name: string;
  email: string;
  phone: string;
  role: 'doctor';
  status: 'PENDING' | 'ACTIVE';
  googleConnected?: boolean;
  googleEmail?: string;
  googleAccessToken?: string;
  googleRefreshToken?: string;
  availabilityStatus?: DoctorAvailabilityStatus;
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
}
