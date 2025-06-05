import React, { useState, useEffect } from 'react';
import { Calendar, ArrowDownToLine, ArrowUpFromLine, BarChart3 } from 'lucide-react';

// Hook para detectar dirección del scroll
const useScrollDirection = () => {
  const [scrollDirection, setScrollDirection] = useState(null);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const updateScrollDirection = () => {
      const scrollY = window.pageYOffset;
      const direction = scrollY > lastScrollY ? "down" : "up";

      if (direction !== scrollDirection && (scrollY - lastScrollY > 10 || scrollY - lastScrollY < -10)) {
        setScrollDirection(direction);
      }
      setLastScrollY(scrollY > 0 ? scrollY : 0);
    };

    window.addEventListener("scroll", updateScrollDirection);
    return () => window.removeEventListener("scroll", updateScrollDirection);
  }, [scrollDirection, lastScrollY]);

  return scrollDirection;
};

const BottomNavigation = ({ activeView, setActiveView, sesionsPendientes }) => {
  const scrollDirection = useScrollDirection();

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
      id: 'dashboard',
      label: 'Dashboard',
      icon: BarChart3,
      badge: null
    }
  ];

  return (
    <div className={`lg:hidden fixed left-4 right-4 z-50 transition-all duration-300 ease-in-out ${scrollDirection === "down" ? "bottom-[-100px]" : "bottom-8"
      }`}>
      {/* Contenedor principal flotante */}
      <div className="bg-white/95 backdrop-blur-lg border border-gray-200/50 rounded-2xl shadow-2xl">
        <div className="flex justify-around items-center py-3 px-4">
          {navItems.map(({ id, label, icon: Icon, badge }) => {
            const isActive = activeView === id;

            return (
              <button
                key={id}
                onClick={() => {
                  console.log('🔍 Navegando a:', id); // Debug log
                  setActiveView(id);
                }}
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
        <div className="absolute top-1 left-1/2 transform -translate-x-1/2 w-12 h-1 bg-gray-300 rounded-full"></div>
      </div>
    </div>
  );
};

export default BottomNavigation;