import React, { useRef } from 'react';

interface BatchUploadProps {
    title: string;
    description: string;
    onUpload: (files: FileList) => void;
    onImageUpload: (file: File) => void;
    isUploading: boolean;
    error?: string | null;
}

export const BatchUpload: React.FC<BatchUploadProps> = ({
    title,
    description,
    onUpload,
    onImageUpload,
    isUploading,
    error
}) => {
    const fileRef = useRef<HTMLInputElement>(null);
    const imageRef = useRef<HTMLInputElement>(null);

    return (
        <div className="w-full max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-5">
            <div className="text-center space-y-3">
                <h3 className="text-2xl font-black italic text-slate-900 uppercase tracking-tight">{title}</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{description}</p>
            </div>

            <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-[3rem] p-12 text-center transition-all hover:border-red-200 hover:bg-red-50/30 group">
                <div className="w-20 h-20 bg-white rounded-3xl shadow-sm border border-slate-100 flex items-center justify-center text-3xl mx-auto mb-8 group-hover:scale-110 transition-transform">
                    {isUploading ? '⏳' : '📥'}
                </div>

                <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-10 max-w-xs mx-auto leading-relaxed">
                    Drag and drop your operational Excel files here or use the professional upload portal.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <button
                        disabled={isUploading}
                        onClick={() => fileRef.current?.click()}
                        className="bg-red-600 text-white px-10 py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:shadow-red-200 hover:-translate-y-1 active:translate-y-0 transition-all disabled:opacity-50"
                    >
                        {isUploading ? 'SYNCHRONIZING...' : 'UPLOAD EXCEL BATCH'}
                    </button>

                    <button
                        disabled={isUploading}
                        onClick={() => imageRef.current?.click()}
                        className="bg-slate-900 text-white px-10 py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:shadow-slate-300 hover:-translate-y-1 active:translate-y-0 transition-all disabled:opacity-50 flex items-center gap-3"
                    >
                        <span className="text-lg">📸</span> {isUploading ? 'SCANNING...' : 'AI VISION SCAN'}
                    </button>
                </div>

                <input
                    ref={fileRef}
                    type="file"
                    className="hidden"
                    accept=".xlsx, .xls"
                    multiple
                    onChange={(e) => e.target.files && onUpload(e.target.files)}
                />
                <input
                    ref={imageRef}
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => e.target.files?.[0] && onImageUpload(e.target.files[0])}
                />
            </div>

            {error && (
                <div className="bg-red-50 border border-red-100 p-6 rounded-3xl flex gap-4 animate-in shake">
                    <span className="text-2xl pt-1">⚠️</span>
                    <div className="text-left">
                        <h4 className="text-[10px] font-black text-red-700 uppercase tracking-widest mb-1">Upload Anomaly Detected</h4>
                        <p className="text-xs text-red-600 font-medium leading-relaxed">{error}</p>
                    </div>
                </div>
            )}
        </div>
    );
};
