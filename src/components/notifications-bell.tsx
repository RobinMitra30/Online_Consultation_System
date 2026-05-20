import React, { useEffect, useState, useRef } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { useAuth } from './auth-provider';
import { Bell, Mail, Check, CheckCheck, Inbox, ExternalLink, X, Clock, Calendar } from 'lucide-react';
import { toast } from 'sonner';

interface NotificationItem {
  id: string;
  recipientId: string;
  recipientName: string;
  title: string;
  message: string;
  type: 'ALERT' | 'CONFIRMATION';
  createdAt: string;
  read: boolean;
  appointmentId: string;
  url?: string;
}

interface EmailItem {
  id: string;
  to: string;
  recipientId: string;
  recipientName: string;
  subject: string;
  html: string;
  text: string;
  sentAt: string;
  sentViaSMTP: boolean;
  appointmentId: string;
}

export function NotificationsBell() {
  const { user, appUser } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [currentTab, setCurrentTab] = useState<'alerts' | 'emails'>('alerts');
  const [selectedEmail, setSelectedEmail] = useState<EmailItem | null>(null);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const mountTimeRef = useRef(new Date().toISOString());

  // Listen to outer elements to auto-close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 1. Listen for real-time Alerts / Notifications in Firestore
  useEffect(() => {
    if (!appUser?.uid) return;

    const q = query(
      collection(db, 'notifications'),
      where('recipientId', '==', appUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: NotificationItem[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as NotificationItem);
      });

      // Sort descending by date
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setNotifications(items);

      // Trigger hot-toast alerts for any fresh incoming documents
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const docData = change.doc.data() as NotificationItem;
          // Verify that notification is unread AND created after component mount
          if (!docData.read && docData.createdAt >= mountTimeRef.current) {
            toast.success(docData.title, {
              description: docData.message,
              duration: 7000,
              icon: <Bell className="w-4 h-4 text-primary" />
            });
          }
        }
      });
    }, (error) => {
      console.error("Error listening to real-time notifications:", error);
    });

    return () => unsubscribe();
  }, [appUser?.uid]);

  // 2. Listen / Fetch System Generated emails for this recipient
  useEffect(() => {
    if (!appUser?.uid) return;

    const q = query(
      collection(db, 'emails'),
      where('recipientId', '==', appUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: EmailItem[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as EmailItem);
      });

      // Sort descending by date
      items.sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
      setEmails(items);
    }, (error) => {
      console.warn("Error listing system emails:", error);
    });

    return () => unsubscribe();
  }, [appUser?.uid]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAllRead = async () => {
    if (notifications.length === 0) return;
    try {
      const unreadList = notifications.filter(n => !n.read);
      for (const n of unreadList) {
        await updateDoc(doc(db, 'notifications', n.id), { read: true });
      }
      toast.success("All notifications marked as read");
    } catch (err) {
      console.error("Failed to mark read:", err);
    }
  };

  const handleMarkSingleRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (err) {
      console.error("Failed to mark read:", err);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Target Bell Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-full transition-all duration-200 cursor-pointer focus:outline-none"
        aria-label="Notifications"
        id="notification-bell-trigger"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
          </span>
        )}
      </button>

      {/* Primary Notifications View Panel */}
      {isOpen && (
        <div 
          className="absolute right-0 mt-3 w-80 sm:w-96 bg-card border border-border rounded-2xl shadow-xl overflow-hidden z-50 flex flex-col max-h-[500px]"
          id="notification-dropdown-panel"
        >
          {/* Header */}
          <div className="flex justify-between items-center px-4 py-3 bg-muted/10 border-b border-border">
            <div>
              <h3 className="font-bold text-sm text-foreground">Notifications</h3>
              <p className="text-[11px] text-muted-foreground">{unreadCount} unread system alerts</p>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-primary hover:text-primary/80 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Clear unread
              </button>
            )}
          </div>

          {/* Action Tabs */}
          <div className="flex border-b border-border text-xs bg-muted/20">
            <button
              onClick={() => setCurrentTab('alerts')}
              className={`flex-1 py-2 font-bold transition-colors border-b-2 ${
                currentTab === 'alerts'
                  ? 'border-primary text-primary bg-card'
                  : 'border-transparent text-muted-foreground hover:bg-muted/15'
              }`}
            >
              Alerts & Confirmations
              {unreadCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 text-[9px] font-bold bg-primary/25 text-primary rounded-full">
                  {unreadCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setCurrentTab('emails')}
              className={`flex-1 py-2 font-bold transition-colors border-b-2 ${
                currentTab === 'emails'
                  ? 'border-primary text-primary bg-card'
                  : 'border-transparent text-muted-foreground hover:bg-muted/15'
              }`}
            >
              Virtual Email Simulator
              {emails.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 text-[9px] font-bold bg-muted-foreground/20 text-muted-foreground rounded-full">
                  {emails.length}
                </span>
              )}
            </button>
          </div>

          {/* Tab Content List Scrollbox */}
          <div className="flex-1 overflow-y-auto max-h-[350px] divide-y divide-border scrollbar-none">
            {currentTab === 'alerts' ? (
              notifications.length > 0 ? (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={async () => {
                      if (!notif.read) {
                        await updateDoc(doc(db, 'notifications', notif.id), { read: true });
                      }
                    }}
                    className={`p-4 transition-all duration-200 text-left cursor-pointer flex gap-3 ${
                      notif.read ? 'bg-background hover:bg-muted/10' : 'bg-primary/5 hover:bg-primary/10'
                    }`}
                  >
                    <div className="mt-0.5">
                      <div className={`p-1.5 rounded-lg ${notif.read ? 'bg-muted text-muted-foreground' : 'bg-primary/20 text-primary'}`}>
                        <Bell className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-1">
                        <p className={`text-xs font-bold leading-none ${notif.read ? 'text-muted-foreground' : 'text-foreground'}`}>
                          {notif.title}
                        </p>
                        {!notif.read && (
                          <button
                            onClick={(e) => handleMarkSingleRead(notif.id, e)}
                            className="text-muted-foreground hover:text-primary p-0.5 rounded transition-colors"
                            title="Mark read"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">
                        {notif.message}
                      </p>
                      <span className="text-[9px] text-muted-foreground/80 mt-1.5 block font-mono">
                        {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-12 px-4 text-center">
                  <Inbox className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
                  <p className="text-xs text-muted-foreground">You don't have any alerts yet.</p>
                </div>
              )
            ) : (
              emails.length > 0 ? (
                emails.map((email) => (
                  <div
                    key={email.id}
                    onClick={() => setSelectedEmail(email)}
                    className="p-4 bg-background hover:bg-muted/20 transition-all text-left cursor-pointer flex gap-3"
                  >
                    <div className="mt-0.5">
                      <div className="p-1.5 bg-secondary text-secondary-foreground rounded-lg">
                        <Mail className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <p className="text-xs font-bold text-foreground truncate max-w-[180px]">
                          {email.subject}
                        </p>
                        <span className="inline-flex items-center text-[8px] px-1.5 py-0.5 font-semibold bg-green-500/10 text-green-500 rounded-full">
                          {email.sentViaSMTP ? 'SMTP Live' : 'Virtual Box'}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        <span className="font-semibold text-foreground">To:</span> {email.to}
                      </p>
                      <p className="text-[11px] text-muted-foreground line-clamp-2 mt-1 leading-normal">
                        Click to view fully generated HTML template
                      </p>
                      <span className="text-[9px] text-muted-foreground/80 mt-1 px-1 py-0.5 bg-muted rounded inline-block font-mono">
                        {new Date(email.sentAt).toLocaleDateString()} {new Date(email.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-12 px-4 text-center">
                  <Mail className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
                  <p className="text-xs text-muted-foreground">No outbound emails have been dispatched for you yet.</p>
                </div>
              )
            )}
          </div>

          <div className="bg-muted/10 px-4 py-2 border-t border-border text-[10px] text-center text-muted-foreground">
            Powered by HealthConsult Auto Notification System
          </div>
        </div>
      )}

      {/* Stylized HTML Email Renderer Modal (Virtual Mailbox) */}
      {selectedEmail && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="p-4 border-b border-border flex justify-between items-center bg-muted/20">
              <div className="text-left">
                <span className="text-[10px] font-bold text-primary tracking-wider uppercase">System Transmitted Email Draft</span>
                <h4 className="font-bold text-base text-foreground mt-0.5">{selectedEmail.subject}</h4>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1">
                  <span><strong className="text-foreground">To:</strong> {selectedEmail.to} ({selectedEmail.recipientName})</span>
                  <span>•</span>
                  <span><strong className="text-foreground">Sent:</strong> {new Date(selectedEmail.sentAt).toLocaleString()}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedEmail(null)}
                className="p-1 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                aria-label="Close Email Preview"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Simulated Workspace Warning */}
            <div className="px-4 py-2 bg-primary/10 border-b border-primary/20 text-left">
              <p className="text-[10px] leading-relaxed text-primary-foreground/90 font-medium font-sans">
                💡 <strong>HealthConsult Workspace simulator:</strong> This showcases the actual, production-ready responsive email compiler generated on the backend servers. Outbound HTML files align perfectly with standard mail client engines.
              </p>
            </div>

            {/* Email Canvas Iframe */}
            <div className="flex-1 p-6 overflow-y-auto bg-[#fafafa]">
              <div 
                className="mx-auto bg-white shadow-sm rounded-xl overflow-hidden border border-slate-200"
                dangerouslySetInnerHTML={{ __html: selectedEmail.html }}
              />
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border flex justify-between items-center bg-muted/10 text-xs text-muted-foreground">
              <span>Status: <strong className="text-foreground">{selectedEmail.sentViaSMTP ? 'Delivered via Production SMTP' : 'Queued/Delivered Virtual In-App'}</strong></span>
              <button
                onClick={() => setSelectedEmail(null)}
                className="px-4 py-1.5 bg-secondary text-secondary-foreground font-semibold rounded-lg hover:bg-secondary/80 cursor-pointer"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
