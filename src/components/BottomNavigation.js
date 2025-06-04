import React from 'react';
import { Calendar, ArrowDownToLine, ArrowUpFromLine, BarChart3 } from 'lucide-react';

const BottomNavigation = ({ activeView, setActiveView, sesionsPendientes }) => {
  const navItems = [
    {
      id: 'calendario',
      label: 'Calendario',
      icon: Calendar,
      badge: sesionsPendientes > 0 ? sesionsPendientes : null
    },
    {
      id: 'entradas',
      label: 'Entradas',
      icon: ArrowDownToLine,
      badge: null
    },
    {
      id: 'salidas',
      label: 'Salidas',
      icon: ArrowUpFromLine,
      badge: null
    },
    {
      id: 'dashboard',        // ← VERIFICAR que esto esté exactamente así
      label: 'Dashboard',
      icon: BarChart3,
      badge: null
    }
  ];


  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-2xl">
      {/* Contenedor principal */}
      <div className="flex justify-around items-center py-2 px-4 bg-gradient-to-t from-gray-50 to-white">
        {navItems.map(({ id, label, icon: Icon, badge }) => {
          const isActive = activeView === id;

          return (
            <button
              key={id}
              onClick={() => setActiveView(id)}
              className={`relative flex flex-col items-center py-2 px-3 rounded-xl transition-all duration-300 transform ${isActive
                ? 'scale-110 bg-gradient-to-br from-purple-500 to-purple-700 shadow-lg text-white'
                : 'hover:bg-gray-100 text-gray-600 hover:text-gray-800 active:scale-95'
                }`}
            >
              {/* Indicador de vista activa */}
              {isActive && (
                <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-8 h-1 bg-white rounded-full shadow-sm"></div>
              )}

              {/* Icono con badge */}
              <div className="relative">
                <Icon
                  size={isActive ? 22 : 20}
                  className={`transition-all duration-300 ${isActive ? 'text-white' : 'text-gray-600'
                    }`}
                />

                {/* Badge para notificaciones */}
                {badge && (
                  <div className="absolute -top-2 -right-2 min-w-[18px] h-[18px] bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse shadow-lg">
                    {badge > 99 ? '99+' : badge}
                  </div>
                )}
              </div>

              {/* Label */}
              <span className={`text-xs font-medium mt-1 transition-all duration-300 ${isActive ? 'text-white' : 'text-gray-600'
                }`}>
                {label}
              </span>

              {/* Efecto de ripple al tocar (solo activo) */}
              {isActive && (
                <div className="absolute inset-0 rounded-xl bg-white/20 animate-pulse"></div>
              )}
            </button>
          );
        })}
      </div>

      {/* Línea decorativa superior */}
      <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-12 h-1 bg-gray-300 rounded-b-full"></div>
    </div>
  );
};

export default BottomNavigation;