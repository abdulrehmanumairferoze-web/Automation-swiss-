import React, { useEffect } from 'react';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

interface NotificationProps {
    message: string;
    type: NotificationType;
    onClose: () => void;
    duration?: number;
}

export const Notification: React.FC<NotificationProps> = ({ message, type, onClose, duration = 5000 }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, duration);
        return () => clearTimeout(timer);
    }, [onClose, duration]);

    const styles = {
        success: 'bg-green-600 text-white shadow-green-200',
        error: 'bg-red-600 text-white shadow-red-200',
        warning: 'bg-amber-500 text-white shadow-amber-200',
        info: 'bg-slate-900 text-white shadow-slate-200'
    };

    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };

    return (
        <div className="fixed bottom-10 right-10 z-[100] animate-in slide-in-from-right-10 pointer-events-none">
            <div className={`${styles[type]} px-8 py-5 rounded-2xl flex items-center gap-4 shadow-2xl pointer-events-auto border border-white/10 ring-4 ring-white/5`}>
                <span className="text-xl">{icons[type]}</span>
                <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70 leading-none mb-1.5">{type} message</span>
                    <p className="text-xs font-black tracking-tight leading-snug">{message}</p>
                </div>
                <button onClick={onClose} className="ml-4 p-1 hover:bg-black/10 rounded-lg transition-colors opacity-50 hover:opacity-100">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
        </div>
    );
};
