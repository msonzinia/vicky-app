import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, Info, X, RotateCcw } from 'lucide-react';

const ToastSystem = () => {
  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = 'success', duration = 5000, undoAction = null) => {
    const id = Date.now();
    const toast = { id, message, type, duration, undoAction, createdAt: Date.now() };
    setToasts(prev => [...prev, toast]);
    setTimeout(() => removeToast(id), duration);
    return id;
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  useEffect(() => {
    window.showToast = addToast;
    return () => delete window.showToast;
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50">
      {toasts.map(toast => (
        <div key={toast.id} className="bg-green-500 text-white p-3 rounded mb-2">
          {toast.message}
          <button onClick={() => removeToast(toast.id)} className="ml-2">×</button>
        </div>
      ))}
    </div>
  );
};

export default ToastSystem;