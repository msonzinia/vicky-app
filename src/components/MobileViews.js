import React, { useState, useEffect } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, BarChart3, TrendingUp, TrendingDown, Calendar, Users, UserCheck, Eye, EyeOff } from 'lucide-react';

// 🚀 Vista Mobile de Entradas
export const EntradasMobile = ({
  sesiones = [],
  pacientes = [],
  formatCurrency
}) => {
  const [mesActual] = useState(new Date());

  // Estados para visibilidad de montos
  const [isVisible, setIsVisible] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);

  // Cargar configuración inicial del localStorage
  useEffect(() => {
    const savedVisibility = localStorage.getItem('moneyVisibility');
    if (savedVisibility !== null) {
      setIsVisible(JSON.parse(savedVisibility));
    }
  }, []);

  // Función para toggle con animación
  const toggleVisibility = () => {
    setIsAnimating(true);

    setTimeout(() => {
      const newVisibility = !isVisible;
      setIsVisible(newVisibility);
      localStorage.setItem('moneyVisibility', JSON.stringify(newVisibility));
      setIsAnimating(false);
    }, 150);
  };

  // Función para formatear montos (mostrar o ocultar)
  const formatVisibleAmount = (amount, formatCurrency) => {
    if (isVisible) {
      return formatCurrency(amount);
    }

    const formattedAmount = formatCurrency(amount);
    const currencySymbol = formattedAmount.match(/[A-Z]{3}|\$/) || '';
    const length = formattedAmount.replace(/[^\d]/g, '').length;
    const hiddenAmount = '*'.repeat(Math.min(length, 6));

    if (formattedAmount.includes('USD')) {
      return `${hiddenAmount} USD`;
    } else {
      return `${hiddenAmount} ARS`;
    }
  };

  // Función para ocultar números simples
  const formatVisibleNumber = (number) => {
    if (isVisible) {
      return number.toString();
    }
    return '*'.repeat(Math.min(number.toString().length, 3));
  };

  console.log('🔍 EntradasMobile renderizada con:', { sesiones: sesiones.length, pacientes: pacientes.length });

  // Calcular entradas del mes actual
  const calcularEntradasMes = () => {
    const hoy = new Date();
    const mesActual = hoy.getMonth();
    const añoActual = hoy.getFullYear();

    const sesionesDelMes = sesiones.filter(sesion => {
      const fechaSesion = new Date(sesion.fecha_hora);
      return fechaSesion.getMonth() === mesActual &&
        fechaSesion.getFullYear() === añoActual &&
        ['Realizada', 'Cancelada sin antelación', 'Pendiente'].includes(sesion.estado);
    });

    const sesionesIngresos = sesionesDelMes.filter(s => s.paciente_id);

    // Agrupar por tipo
    const tipos = {
      'Sesión': { sesiones: [], total: 0, icon: '🧠' },
      'Evaluación': { sesiones: [], total: 0, icon: '📋' },
      'Re-evaluación': { sesiones: [], total: 0, icon: '📝' },
      'Devolución': { sesiones: [], total: 0, icon: '🔄' },
      'Reunión con colegio': { sesiones: [], total: 0, icon: '🏫' }
    };

    sesionesIngresos.forEach(sesion => {
      if (tipos[sesion.tipo_sesion]) {
        tipos[sesion.tipo_sesion].sesiones.push(sesion);
        tipos[sesion.tipo_sesion].total += sesion.precio_por_hora * sesion.duracion_horas;
      }
    });

    const totalGeneral = Object.values(tipos).reduce((sum, tipo) => sum + tipo.total, 0);

    return { tipos, totalGeneral, sesionesTotal: sesionesIngresos.length };
  };

  const { tipos, totalGeneral, sesionesTotal } = calcularEntradasMes();
  const nombreMes = mesActual.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6 max-w-md mx-auto pb-20">
      {/* Header con botón de visibilidad */}
      <div className="bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl p-6 shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
            <ArrowDownToLine size={24} />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Entradas</h1>
            <p className="text-green-100">{nombreMes}</p>
          </div>

          {/* 🚀 BOTÓN DE VISIBILIDAD MÁS GRANDE */}
          <button
            onClick={toggleVisibility}
            className={`p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all duration-300 ${isAnimating ? 'scale-110 rotate-180' : 'scale-100 rotate-0'
              }`}
            title={isVisible ? 'Ocultar montos' : 'Mostrar montos'}
          >
            {isVisible ? (
              <Eye size={18} className="text-green-100 hover:text-white transition-colors" />
            ) : (
              <EyeOff size={18} className="text-green-200 hover:text-white transition-colors" />
            )}
          </button>
        </div>

        {/* Montos principales con animación */}
        <div
          className={`text-center transition-all duration-300 ${isAnimating ? 'opacity-0 transform scale-95' : 'opacity-100 transform scale-100'
            }`}
        >
          <div className="text-3xl font-bold mb-2">
            {formatVisibleAmount(totalGeneral, formatCurrency)}
          </div>
          <div className="text-green-100">
            {sesionesTotal} sesión{sesionesTotal !== 1 ? 'es' : ''} facturada{sesionesTotal !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Desglose por tipo */}
      <div className="space-y-3">
        <h2 className="text-lg font-bold text-gray-800 px-2">Desglose por tipo</h2>

        {Object.entries(tipos).map(([tipoNombre, data]) => {
          if (data.sesiones.length === 0) return null;

          return (
            <div key={tipoNombre} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-2xl">{data.icon}</div>
                  <div>
                    <div className="font-bold text-gray-800">{tipoNombre}</div>
                    <div className="text-sm text-gray-600">
                      {data.sesiones.length} sesión{data.sesiones.length !== 1 ? 'es' : ''}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={`font-bold text-green-600 transition-all duration-300 ${isAnimating ? 'opacity-0 transform scale-95' : 'opacity-100 transform scale-100'
                      }`}
                  >
                    {formatVisibleAmount(data.total, formatCurrency)}
                  </div>
                  <div
                    className={`text-xs text-gray-500 transition-all duration-300 ${isAnimating ? 'opacity-0 transform scale-95' : 'opacity-100 transform scale-100'
                      }`}
                  >
                    {isVisible ? `${((data.total / totalGeneral) * 100).toFixed(1)}%` : '**%'}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Resumen rápido */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
        <h3 className="font-bold text-green-800 mb-3 flex items-center gap-2">
          <TrendingUp size={16} />
          Resumen del mes
        </h3>
        <div
          className={`space-y-2 text-sm transition-all duration-300 ${isAnimating ? 'opacity-0 transform scale-95' : 'opacity-100 transform scale-100'
            }`}
        >
          <div className="flex justify-between">
            <span className="text-green-700">Promedio por sesión:</span>
            <span className="font-bold text-green-800">
              {formatVisibleAmount(sesionesTotal > 0 ? totalGeneral / sesionesTotal : 0, formatCurrency)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-green-700">Sesiones restantes del mes:</span>
            <span className="font-bold text-green-800">
              {sesiones.filter(s =>
                s.estado === 'Pendiente' &&
                new Date(s.fecha_hora) > new Date() &&
                new Date(s.fecha_hora).getMonth() === mesActual.getMonth()
              ).length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// 🚀 Vista Mobile de Salidas
export const SalidasMobile = ({
  sesiones = [],
  supervisoras = [],
  alquilerConfig = {},
  formatCurrency
}) => {
  const [mesActual] = useState(new Date());

  // Estados para visibilidad de montos
  const [isVisible, setIsVisible] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);

  // Cargar configuración inicial del localStorage
  useEffect(() => {
    const savedVisibility = localStorage.getItem('moneyVisibility');
    if (savedVisibility !== null) {
      setIsVisible(JSON.parse(savedVisibility));
    }
  }, []);

  // Función para toggle con animación
  const toggleVisibility = () => {
    setIsAnimating(true);

    setTimeout(() => {
      const newVisibility = !isVisible;
      setIsVisible(newVisibility);
      localStorage.setItem('moneyVisibility', JSON.stringify(newVisibility));
      setIsAnimating(false);
    }, 150);
  };

  // Función para formatear montos (mostrar o ocultar)
  const formatVisibleAmount = (amount, formatCurrency) => {
    if (isVisible) {
      return formatCurrency(amount);
    }

    const formattedAmount = formatCurrency(amount);
    const currencySymbol = formattedAmount.match(/[A-Z]{3}|\$/) || '';
    const length = formattedAmount.replace(/[^\d]/g, '').length;
    const hiddenAmount = '*'.repeat(Math.min(length, 6));

    if (formattedAmount.includes('USD')) {
      return `${hiddenAmount} USD`;
    } else {
      return `${hiddenAmount} ARS`;
    }
  };

  // Función para ocultar números simples
  const formatVisibleNumber = (number) => {
    if (isVisible) {
      return number.toString();
    }
    return '*'.repeat(Math.min(number.toString().length, 3));
  };

  console.log('🔍 SalidasMobile renderizada con:', { sesiones: sesiones.length, supervisoras: supervisoras.length });

  const calcularSalidasMes = () => {
    const hoy = new Date();
    const mesActual = hoy.getMonth();
    const añoActual = hoy.getFullYear();

    const sesionesDelMes = sesiones.filter(sesion => {
      const fechaSesion = new Date(sesion.fecha_hora);
      return fechaSesion.getMonth() === mesActual &&
        fechaSesion.getFullYear() === añoActual &&
        ['Realizada', 'Cancelada sin antelación', 'Pendiente'].includes(sesion.estado);
    });

    // Supervisiones directas
    const supervisiones = sesionesDelMes.filter(s => s.supervisora_id);
    const gastoSupervision = supervisiones.reduce((total, s) =>
      total + (s.precio_por_hora * s.duracion_horas), 0);

    // Acompañamientos
    const acompanamientos = sesionesDelMes.filter(s =>
      s.acompañado_supervisora && s.supervisora_acompanante_id);
    const gastoAcompanamiento = acompanamientos.reduce((total, s) =>
      total + ((s.precio_por_hora * s.duracion_horas) * 0.5), 0);

    // Alquiler
    const gastoAlquiler = alquilerConfig?.precio_mensual || 0;

    const totalGastos = gastoSupervision + gastoAcompanamiento + gastoAlquiler;

    return {
      gastoSupervision,
      gastoAcompanamiento,
      gastoAlquiler,
      totalGastos,
      supervisiones: supervisiones.length,
      acompanamientos: acompanamientos.length
    };
  };

  const datos = calcularSalidasMes();
  const nombreMes = mesActual.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6 max-w-md mx-auto pb-20">
      {/* Header con botón de visibilidad */}
      <div className="bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl p-6 shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
            <ArrowUpFromLine size={24} />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Salidas</h1>
            <p className="text-red-100">{nombreMes}</p>
          </div>

          {/* 🚀 BOTÓN DE VISIBILIDAD MÁS GRANDE */}
          <button
            onClick={toggleVisibility}
            className={`p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all duration-300 ${isAnimating ? 'scale-110 rotate-180' : 'scale-100 rotate-0'
              }`}
            title={isVisible ? 'Ocultar montos' : 'Mostrar montos'}
          >
            {isVisible ? (
              <Eye size={18} className="text-red-100 hover:text-white transition-colors" />
            ) : (
              <EyeOff size={18} className="text-red-200 hover:text-white transition-colors" />
            )}
          </button>
        </div>

        {/* Montos principales con animación */}
        <div
          className={`text-center transition-all duration-300 ${isAnimating ? 'opacity-0 transform scale-95' : 'opacity-100 transform scale-100'
            }`}
        >
          <div className="text-3xl font-bold mb-2">
            {formatVisibleAmount(datos.totalGastos, formatCurrency)}
          </div>
          <div className="text-red-100">
            Total de gastos del mes
          </div>
        </div>
      </div>

      {/* Desglose de gastos */}
      <div className="space-y-3">
        <h2 className="text-lg font-bold text-gray-800 px-2">Desglose de gastos</h2>

        {/* Supervisiones */}
        {datos.gastoSupervision > 0 && (
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-2xl">👥</div>
                <div>
                  <div className="font-bold text-gray-800">Supervisiones</div>
                  <div className="text-sm text-gray-600">
                    {datos.supervisiones} sesión{datos.supervisiones !== 1 ? 'es' : ''}
                  </div>
                </div>
              </div>
              <div
                className={`text-right transition-all duration-300 ${isAnimating ? 'opacity-0 transform scale-95' : 'opacity-100 transform scale-100'
                  }`}
              >
                <div className="font-bold text-red-600">
                  -{formatVisibleAmount(datos.gastoSupervision, formatCurrency)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Acompañamientos */}
        {datos.gastoAcompanamiento > 0 && (
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-2xl">🤝</div>
                <div>
                  <div className="font-bold text-gray-800">Acompañamientos</div>
                  <div className="text-sm text-gray-600">
                    {datos.acompanamientos} sesión{datos.acompanamientos !== 1 ? 'es' : ''} (50%)
                  </div>
                </div>
              </div>
              <div
                className={`text-right transition-all duration-300 ${isAnimating ? 'opacity-0 transform scale-95' : 'opacity-100 transform scale-100'
                  }`}
              >
                <div className="font-bold text-red-600">
                  -{formatVisibleAmount(datos.gastoAcompanamiento, formatCurrency)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Alquiler */}
        {datos.gastoAlquiler > 0 && (
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-2xl">🏠</div>
                <div>
                  <div className="font-bold text-gray-800">Alquiler</div>
                  <div className="text-sm text-gray-600">Costo mensual</div>
                </div>
              </div>
              <div
                className={`text-right transition-all duration-300 ${isAnimating ? 'opacity-0 transform scale-95' : 'opacity-100 transform scale-100'
                  }`}
              >
                <div className="font-bold text-red-600">
                  -{formatVisibleAmount(datos.gastoAlquiler, formatCurrency)}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// 🚀 Vista Mobile de Dashboard
export const DashboardMobile = ({
  sesiones = [],
  pacientes = [],
  supervisoras = [],
  alquilerConfig = {},
  formatCurrency
}) => {
  const [mesActual] = useState(new Date());

  // Estados para visibilidad de montos
  const [isVisible, setIsVisible] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);

  // Cargar configuración inicial del localStorage
  useEffect(() => {
    const savedVisibility = localStorage.getItem('moneyVisibility');
    if (savedVisibility !== null) {
      setIsVisible(JSON.parse(savedVisibility));
    }
  }, []);

  // Función para toggle con animación
  const toggleVisibility = () => {
    setIsAnimating(true);

    setTimeout(() => {
      const newVisibility = !isVisible;
      setIsVisible(newVisibility);
      localStorage.setItem('moneyVisibility', JSON.stringify(newVisibility));
      setIsAnimating(false);
    }, 150);
  };

  // Función para formatear montos (mostrar o ocultar)
  const formatVisibleAmount = (amount, formatCurrency) => {
    if (isVisible) {
      return formatCurrency(amount);
    }

    const formattedAmount = formatCurrency(amount);
    const currencySymbol = formattedAmount.match(/[A-Z]{3}|\$/) || '';
    const length = formattedAmount.replace(/[^\d]/g, '').length;
    const hiddenAmount = '*'.repeat(Math.min(length, 6));

    if (formattedAmount.includes('USD')) {
      return `${hiddenAmount} USD`;
    } else {
      return `${hiddenAmount} ARS`;
    }
  };

  // Función para ocultar números simples
  const formatVisibleNumber = (number) => {
    if (isVisible) {
      return number.toString();
    }
    return '*'.repeat(Math.min(number.toString().length, 3));
  };

  console.log('🔍 DashboardMobile renderizada con:', {
    sesiones: sesiones.length,
    pacientes: pacientes.length,
    supervisoras: supervisoras.length
  });

  const calcularDashboard = () => {
    const hoy = new Date();
    const mesActual = hoy.getMonth();
    const añoActual = hoy.getFullYear();

    // Sesiones del mes actual
    const sesionesDelMes = sesiones.filter(sesion => {
      const fechaSesion = new Date(sesion.fecha_hora);
      return fechaSesion.getMonth() === mesActual &&
        fechaSesion.getFullYear() === añoActual &&
        ['Realizada', 'Cancelada sin antelación', 'Pendiente'].includes(sesion.estado);
    });

    // Ingresos
    const sesionesIngresos = sesionesDelMes.filter(s => s.paciente_id);
    const totalIngresos = sesionesIngresos.reduce((total, s) =>
      total + (s.precio_por_hora * s.duracion_horas), 0);

    // Gastos
    const supervisiones = sesionesDelMes.filter(s => s.supervisora_id);
    const gastoSupervision = supervisiones.reduce((total, s) =>
      total + (s.precio_por_hora * s.duracion_horas), 0);

    const acompanamientos = sesionesDelMes.filter(s =>
      s.acompañado_supervisora && s.supervisora_acompanante_id);
    const gastoAcompanamiento = acompanamientos.reduce((total, s) =>
      total + ((s.precio_por_hora * s.duracion_horas) * 0.5), 0);

    const gastoAlquiler = alquilerConfig?.precio_mensual || 0;
    const totalGastos = gastoSupervision + gastoAcompanamiento + gastoAlquiler;

    const gananciaNeta = totalIngresos - totalGastos;

    // Estadísticas adicionales
    const pacientesActivos = pacientes.filter(p => p.activo && !p.eliminado).length;
    const sesionsPendientes = sesiones.filter(s =>
      s.estado === 'Pendiente' && new Date(s.fecha_hora) < hoy).length;

    return {
      totalIngresos,
      totalGastos,
      gananciaNeta,
      sesionesRealizadas: sesionesDelMes.filter(s => s.estado === 'Realizada').length,
      pacientesActivos,
      sesionsPendientes,
      porcentajeGastos: totalIngresos > 0 ? (totalGastos / totalIngresos) * 100 : 0
    };
  };

  const datos = calcularDashboard();
  const nombreMes = mesActual.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6 max-w-md mx-auto pb-20">
      {/* Header principal con botón de visibilidad */}
      <div className={`bg-gradient-to-r ${datos.gananciaNeta >= 0 ? 'from-green-500 to-green-600' : 'from-red-500 to-red-600'} text-white rounded-xl p-6 shadow-lg`}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
            <BarChart3 size={24} />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Dashboard</h1>
            <p className={`${datos.gananciaNeta >= 0 ? 'text-green-100' : 'text-red-100'}`}>
              {nombreMes}
            </p>
          </div>

          {/* 🚀 BOTÓN DE VISIBILIDAD MÁS GRANDE */}
          <button
            onClick={toggleVisibility}
            className={`p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all duration-300 ${isAnimating ? 'scale-110 rotate-180' : 'scale-100 rotate-0'
              }`}
            title={isVisible ? 'Ocultar montos' : 'Mostrar montos'}
          >
            {isVisible ? (
              <Eye size={18} className={`${datos.gananciaNeta >= 0 ? 'text-green-100' : 'text-red-100'} hover:text-white transition-colors`} />
            ) : (
              <EyeOff size={18} className={`${datos.gananciaNeta >= 0 ? 'text-green-200' : 'text-red-200'} hover:text-white transition-colors`} />
            )}
          </button>
        </div>

        {/* Montos principales con animación */}
        <div
          className={`text-center transition-all duration-300 ${isAnimating ? 'opacity-0 transform scale-95' : 'opacity-100 transform scale-100'
            }`}
        >
          <div className="text-xs mb-1 opacity-90">
            {datos.gananciaNeta >= 0 ? 'Ganancia neta' : 'Pérdida neta'}
          </div>
          <div className="text-3xl font-bold mb-2">
            {formatVisibleAmount(Math.abs(datos.gananciaNeta), formatCurrency)}
          </div>
          <div className={`text-sm ${datos.gananciaNeta >= 0 ? 'text-green-100' : 'text-red-100'}`}>
            {datos.gananciaNeta >= 0 ? '📈 Mes positivo' : '📉 Mes negativo'}
          </div>
        </div>
      </div>

      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-2 gap-4">
        {/* Ingresos */}
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <ArrowDownToLine size={16} className="text-green-600" />
            <span className="text-green-800 font-medium text-sm">Ingresos</span>
          </div>
          <div
            className={`text-xl font-bold text-green-800 transition-all duration-300 ${isAnimating ? 'opacity-0 transform scale-95' : 'opacity-100 transform scale-100'
              }`}
          >
            {formatVisibleAmount(datos.totalIngresos, formatCurrency)}
          </div>
        </div>

        {/* Gastos */}
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <ArrowUpFromLine size={16} className="text-red-600" />
            <span className="text-red-800 font-medium text-sm">Gastos</span>
          </div>
          <div
            className={`text-xl font-bold text-red-800 transition-all duration-300 ${isAnimating ? 'opacity-0 transform scale-95' : 'opacity-100 transform scale-100'
              }`}
          >
            {formatVisibleAmount(datos.totalGastos, formatCurrency)}
          </div>
        </div>
      </div>

      {/* Estadísticas rápidas */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h3 className="font-bold text-gray-800 mb-4">Estadísticas del mes</h3>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-blue-600" />
              <span className="text-gray-700">Sesiones realizadas</span>
            </div>
            <span className="font-bold text-gray-800">{datos.sesionesRealizadas}</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-purple-600" />
              <span className="text-gray-700">Pacientes activos</span>
            </div>
            <span className="font-bold text-gray-800">{datos.pacientesActivos}</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserCheck size={16} className="text-orange-600" />
              <span className="text-gray-700">Supervisoras</span>
            </div>
            <span className="font-bold text-gray-800">
              {supervisoras.filter(s => !s.eliminado).length}
            </span>
          </div>

          {datos.sesionsPendientes > 0 && (
            <div className="flex items-center justify-between bg-yellow-50 -mx-2 px-2 py-2 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                <span className="text-yellow-800 font-medium">Pendientes</span>
              </div>
              <span className="font-bold text-yellow-800">{datos.sesionsPendientes}</span>
            </div>
          )}
        </div>
      </div>

      {/* Análisis de rentabilidad */}
      <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
        <h3 className="font-bold text-purple-800 mb-3 flex items-center gap-2">
          <TrendingUp size={16} />
          Análisis de rentabilidad
        </h3>
        <div
          className={`space-y-2 text-sm transition-all duration-300 ${isAnimating ? 'opacity-0 transform scale-95' : 'opacity-100 transform scale-100'
            }`}
        >
          <div className="flex justify-between">
            <span className="text-purple-700">Gastos sobre ingresos:</span>
            <span className="font-bold text-purple-800">
              {isVisible ? `${datos.porcentajeGastos.toFixed(1)}%` : '**%'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-purple-700">Margen de ganancia:</span>
            <span className="font-bold text-purple-800">
              {isVisible ? `${(100 - datos.porcentajeGastos).toFixed(1)}%` : '**%'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};