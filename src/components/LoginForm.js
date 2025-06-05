import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Eye, EyeOff, Lock, Mail, AlertCircle } from 'lucide-react';

const LoginForm = () => {
  const [email, setEmail] = useState('vickyguemes@gmail.com'); // Pre-cargado
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [capsLockOn, setCapsLockOn] = useState(false);

  // Detectar Caps Lock
  const handleKeyPress = (e) => {
    const capsLock = e.getModifierState && e.getModifierState('CapsLock');
    setCapsLockOn(capsLock);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      console.log('🔐 Intentando login con:', email);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password
      });

      if (error) {
        console.error('❌ Error de login:', error);
        if (error.message.includes('Invalid login credentials')) {
          setError('Email o contraseña incorrectos. Verifica tus datos.');
        } else if (error.message.includes('Email not confirmed')) {
          setError('Debes confirmar tu email antes de iniciar sesión');
        } else {
          setError('Error al iniciar sesión: ' + error.message);
        }
        return;
      }

      console.log('✅ Login exitoso para:', data.user.email);
      // El componente App.js detectará automáticamente el cambio

    } catch (error) {
      console.error('💥 Error inesperado:', error);
      setError('Error inesperado. Revisa tu conexión e intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-purple-50 p-4">
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-2xl max-w-md w-full border border-gray-100">

        {/* Header con logo */}
        <div className="text-center mb-6 md:mb-8">
          <div className="w-16 h-16 md:w-20 md:h-20 mx-auto mb-4 relative">
            <img
              src="/jel2.png"
              alt="JEL Logo"
              className="w-full h-full object-contain"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextElementSibling.style.display = 'flex';
              }}
            />
            <div className="w-full h-full bg-gradient-to-br from-purple-500 to-purple-700 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-lg hidden">
              JEL
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">JEL Organizador</h1>
          <p className="text-gray-600">Acceso Profesional - Victoria Güemes</p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
              <AlertCircle size={20} className="text-red-600 flex-shrink-0" />
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email profesional
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="email"
                placeholder="vickyguemes@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                required
                disabled={loading}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Contraseña
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Tu contraseña segura"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyPress}
                onKeyUp={handleKeyPress}
                className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                disabled={loading}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            {/* Alerta de Caps Lock */}
            {capsLockOn && (
              <div className="mt-2 flex items-center gap-2 text-yellow-600 text-sm">
                <AlertCircle size={16} />
                <span>⚠️ Mayúsculas activadas (Caps Lock)</span>
              </div>
            )}
          </div>

          {/* Botón de login */}
          <button
            type="submit"
            disabled={loading || !email || !password}
            className={`w-full py-3 md:py-4 px-4 rounded-lg font-medium transition-all shadow-lg text-base md:text-lg ${loading || !email || !password
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 shadow-purple-500/25'
              } text-white`}
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Verificando acceso...
              </div>
            ) : (
              'Acceder a JEL Organizador'
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-gray-500">
            🔒 Acceso seguro y protegido
          </p>
          <p className="text-xs text-gray-400 mt-2">
            Datos confidenciales según normativas profesionales
          </p>
          <p className="text-xs text-purple-600 mt-2 font-medium">
            vicky-app.vercel.app
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;