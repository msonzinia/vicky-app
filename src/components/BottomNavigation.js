import React, { useState, useEffect, useRef } from 'react';
import { Calendar, ArrowDownToLine, ArrowUpFromLine, BarChart3 } from 'lucide-react';

// Hook para detectar dirección del scroll
const useScrollDirection = () => {
  const [scrollDirection, setScrollDirection] = useState(null);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    let ticking = false;

    const updateScrollDirection = () => {
      const scrollY = window.pageYOffset;
      const direction = scrollY > lastScrollY ? "down" : "up";

      if (direction !== scrollDirection && Math.abs(scrollY - lastScrollY) > 8) {
        setScrollDirection(direction);
      }
      
      setLastScrollY(scrollY > 0 ? scrollY : 0);
      ticking = false;
    };

    const requestTick = () => {
      if (!ticking) {
        requestAnimationFrame(updateScrollDirection);
        ticking = true;
      }
    };

    window.addEventListener("scroll", requestTick, { passive: true });
    return () => window.removeEventListener("scroll", requestTick);
  }, [scrollDirection, lastScrollY]);

  return scrollDirection;
};

// Hook para efectos sutiles de mouse
const useSubtleMouseEffects = () => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePosition({
        x: (e.clientX / window.innerWidth - 0.5) * 4,
        y: (e.clientY / window.innerHeight - 0.5) * 2
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return mousePosition;
};

const BottomNavigation = ({ activeView, setActiveView, sesionsPendientes }) => {
  const scrollDirection = useScrollDirection();
  const mousePosition = useSubtleMouseEffects();
  const [activeIndex, setActiveIndex] = useState(0);

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

  // Encontrar índice activo
  useEffect(() => {
    const index = navItems.findIndex(item => item.id === activeView);
    setActiveIndex(index >= 0 ? index : 0);
  }, [activeView]);

  // Calcular posición del indicador activo
  const getActiveIndicatorStyle = () => {
    const itemWidth = 100 / navItems.length;
    const left = activeIndex * itemWidth;
    
    return {
      left: `${left}%`,
      width: `${itemWidth}%`,
      transform: `translateX(${mousePosition.x * 0.08}px)`
    };
  };

  return (
    <>
      {/* Fondo sutil que reacciona al movimiento */}
      <div className="lg:hidden fixed inset-0 pointer-events-none z-40">
        <div 
          className="absolute inset-0 transition-all duration-1000 ease-out opacity-20"
          style={{
            background: `radial-gradient(circle at ${50 + mousePosition.x * 3}% ${85 + mousePosition.y * 2}%, 
              rgba(147, 197, 253, 0.15) 0%, 
              rgba(196, 181, 253, 0.10) 35%,
              transparent 65%)`
          }}
        />
      </div>

      {/* Bottom Navigation Container */}
      <div
        className={`lg:hidden fixed left-3 right-3 z-50 transition-all duration-700 ease-out ${
          scrollDirection === "down" ? "bottom-[-120px] opacity-0" : "bottom-5 opacity-100"
        }`}
      >
        {/* Container principal */}
        <div className="relative">
          {/* 🔮 FONDO PRINCIPAL - Glass morphism como iOS */}
          <div className="relative rounded-[26px] overflow-hidden">
            {/* Base translúcida principal */}
            <div 
              className="absolute inset-0"
              style={{
                background: 'rgba(255, 255, 255, 0.18)', // Más translúcido
                backdropFilter: 'blur(30px) saturate(1.8) brightness(1.1)', // Más blur y saturación
                WebkitBackdropFilter: 'blur(30px) saturate(1.8) brightness(1.1)',
                borderRadius: '26px',
                border: '0.5px solid rgba(255, 255, 255, 0.25)', // Borde más sutil
                boxShadow: `
                  0 25px 50px rgba(0, 0, 0, 0.12),
                  0 12px 25px rgba(0, 0, 0, 0.08),
                  inset 0 1px 0 rgba(255, 255, 255, 0.15),
                  inset 0 -1px 0 rgba(0, 0, 0, 0.03)
                `
              }}
            />

            {/* 💧 EFECTO GOTA DE AGUA - Bordes refractivos */}
            <div 
              className="absolute inset-0 rounded-[26px]"
              style={{
                background: `
                  linear-gradient(135deg, 
                    rgba(255, 255, 255, 0.35) 0%,
                    rgba(255, 255, 255, 0.12) 15%,
                    rgba(255, 255, 255, 0.05) 25%,
                    rgba(255, 255, 255, 0.02) 50%,
                    rgba(255, 255, 255, 0.08) 75%,
                    rgba(255, 255, 255, 0.25) 100%
                  )
                `,
                mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                maskComposite: 'xor',
                WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                WebkitMaskComposite: 'xor',
                padding: '1px',
                transform: `translateX(${mousePosition.x * 0.03}px) translateY(${mousePosition.y * 0.015}px)`
              }}
            />

            {/* ✨ REFLEJOS LUMINOSOS */}
            <div 
              className="absolute inset-0 rounded-[26px] opacity-60"
              style={{
                background: `
                  linear-gradient(125deg, 
                    rgba(255, 255, 255, 0.15) 0%,
                    transparent 30%,
                    transparent 70%,
                    rgba(255, 255, 255, 0.08) 100%
                  )
                `,
                transform: `translate(${mousePosition.x * 0.02}px, ${mousePosition.y * 0.01}px) rotate(${mousePosition.x * 0.01}deg)`
              }}
            />

            {/* 🎯 INDICADOR ACTIVO - Más sutil y legible */}
            <div
              className="absolute top-[8px] bottom-[8px] rounded-[20px] transition-all duration-500 ease-out"
              style={{
                ...getActiveIndicatorStyle(),
                background: 'rgba(255, 255, 255, 0.15)',
                backdropFilter: 'blur(15px) brightness(1.2)',
                WebkitBackdropFilter: 'blur(15px) brightness(1.2)',
                border: '0.5px solid rgba(255, 255, 255, 0.2)',
                boxShadow: `
                  inset 0 1px 2px rgba(255, 255, 255, 0.15),
                  inset 0 -1px 1px rgba(0, 0, 0, 0.03),
                  0 4px 12px rgba(0, 0, 0, 0.06)
                `
              }}
            />

            {/* 📱 CONTENIDO DE NAVEGACIÓN */}
            <div className="relative flex items-center py-4 px-1"> {/* Aumentado py de 3 a 4 */}
              {navItems.map(({ id, label, icon: Icon, badge }, index) => {
                const isActive = activeView === id;

                return (
                  <button
                    key={id}
                    onClick={() => {
                      console.log('🔍 Navegando a:', id);
                      setActiveView(id);
                    }}
                    className="flex-1 flex flex-col items-center py-2 px-1 transition-all duration-300 relative group"
                    style={{
                      minHeight: '62px', // Aumentado para acomodar iconos más grandes
                      transform: `translateY(${isActive ? -0.5 : 0}px)`
                    }}
                  >
                    {/* Icono con contraste mejorado */}
                    <div className="relative mb-1.5">
                      <Icon
                        size={24} // Más grande para mejor visibilidad
                        strokeWidth={2.2} // Líneas más gruesas
                        className={`transition-all duration-300 ${
                          isActive 
                            ? 'text-white drop-shadow-lg' 
                            : 'text-white/95 group-hover:text-white'
                        }`}
                        style={{
                          filter: isActive 
                            ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.4)) drop-shadow(0 0 12px rgba(255,255,255,0.6))' 
                            : 'drop-shadow(0 1px 3px rgba(0,0,0,0.3)) drop-shadow(0 0 6px rgba(255,255,255,0.2))',
                        }}
                      />

                      {/* Badge mejorado */}
                      {badge && (
                        <div 
                          className="absolute -top-2.5 -right-2.5 min-w-[20px] h-[20px] text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-lg"
                          style={{
                            background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
                            border: '1.5px solid rgba(255, 255, 255, 0.4)',
                            boxShadow: '0 3px 10px rgba(239, 68, 68, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.3)'
                          }}
                        >
                          {badge > 99 ? '99+' : badge}
                          
                          {/* Pulso más sutil */}
                          <div className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-35" 
                               style={{ animationDuration: '2s' }} />
                        </div>
                      )}
                    </div>

                    {/* Label con mejor legibilidad */}
                    <span 
                      className={`text-[11px] font-semibold transition-all duration-300 leading-tight ${
                        isActive 
                          ? 'text-white' 
                          : 'text-white/80 group-hover:text-white/90'
                      }`}
                      style={{
                        textShadow: isActive 
                          ? '0 1px 2px rgba(0,0,0,0.4), 0 0 8px rgba(255,255,255,0.3)' 
                          : '0 1px 2px rgba(0,0,0,0.3)',
                        fontWeight: isActive ? '600' : '500'
                      }}
                    >
                      {label}
                    </span>

                    {/* Efecto hover más visible */}
                    <div 
                      className="absolute inset-0 rounded-[20px] bg-white/8 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                      style={{ margin: '6px' }}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* 🌟 SOMBRA EXTERNA REALISTA */}
          <div 
            className="absolute inset-0 rounded-[26px] -z-10 transition-all duration-500"
            style={{
              background: 'rgba(0, 0, 0, 0.08)',
              filter: 'blur(25px)',
              transform: `translateY(12px) scale(0.92)`,
              opacity: scrollDirection === "down" ? 0 : 0.7
            }}
          />

          {/* Sombra secundaria más difusa */}
          <div 
            className="absolute inset-0 rounded-[26px] -z-20 transition-all duration-700"
            style={{
              background: 'rgba(0, 0, 0, 0.04)',
              filter: 'blur(40px)',
              transform: `translateY(20px) scale(0.88)`,
              opacity: scrollDirection === "down" ? 0 : 0.5
            }}
          />
        </div>
      </div>

      {/* CSS personalizado para efectos avanzados */}
      <style jsx>{`
        /* Optimización de renderizado */
        .nav-container {
          transform: translateZ(0);
          will-change: transform, opacity;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }

        /* Soporte para backdrop-filter */
        @supports (backdrop-filter: blur(30px)) {
          .glass-enhanced {
            backdrop-filter: blur(30px) saturate(1.8) brightness(1.1);
            -webkit-backdrop-filter: blur(30px) saturate(1.8) brightness(1.1);
          }
        }

        /* Fallback para navegadores sin soporte */
        @supports not (backdrop-filter: blur(30px)) {
          .glass-fallback {
            background: rgba(255, 255, 255, 0.25) !important;
          }
        }

        /* Animación sutil para elementos activos */
        @keyframes subtle-pulse {
          0%, 100% { 
            box-shadow: 0 0 0 rgba(255, 255, 255, 0.1);
          }
          50% { 
            box-shadow: 0 0 15px rgba(255, 255, 255, 0.12);
          }
        }

        /* Mejora de contraste en dispositivos con alta densidad */
        @media (-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi) {
          .high-dpi-text {
            text-rendering: optimizeLegibility;
          }
        }
      `}</style>
    </>
  );
};

export default BottomNavigation;