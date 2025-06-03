import React from 'react';
import { Plus, Calendar, Users } from 'lucide-react';

const Header = ({
  activeView,
  sesionsPendientes,
  pacientes,
  openModal,
  currentDate
}) => {
  const getViewTitle = () => {
    switch (activeView) {
      case 'coordinadoras': return 'Supervisoras';
      case 'calendario': return 'Calendario';
      case 'pacientes': return 'Pacientes';
      case 'alquiler': return 'Configuración de Alquiler';
      case 'entradas': return 'Pagos Recibidos';
      case 'salidas': return 'Pagos Realizados';
      default: return activeView;
    }
  };

  const getViewDescription = () => {
    switch (activeView) {
      case 'calendario':
        return `${sesionsPendientes} sesión${sesionsPendientes !== 1 ? 'es' : ''} pendiente${sesionsPendientes !== 1 ? 's' : ''} de categorizar`;
      case 'pacientes':
        const activos = pacientes?.filter(p => p.activo).length || 0;
        return `${activos} paciente${activos !== 1 ? 's' : ''} activo${activos !== 1 ? 's' : ''}`;
      case 'coordinadoras':
        return 'Gestión de supervisoras y coordinadoras';
      case 'alquiler':
        return 'Configuración del costo mensual del consultorio';
      case 'entradas':
        return 'Registro de pagos recibidos de pacientes';
      case 'salidas':
        return 'Registro de gastos y pagos realizados';
      default:
        return '';
    }
  };

  // No mostrar header para calendario, alquiler, facturar Y DASHBOARD
  if (activeView === 'calendario' || activeView === 'alquiler' || activeView === 'facturar' || activeView === 'dashboard') {
    return null;
  }

  return (
    <div className="glass-effect p-6 border-b border-gray-200/50 shadow-sm">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-700 rounded-xl flex items-center justify-center shadow-lg">
            {activeView === 'pacientes' && <Users className="text-white" size={24} />}
            {activeView === 'coordinadoras' && <Users className="text-white" size={24} />}
            {(activeView === 'entradas' || activeView === 'salidas' || activeView === 'alquiler') &&
              <div className="text-white font-bold text-lg">$</div>
            }
          </div>

          <div>
            <h2 className="text-2xl font-bold text-gray-800">
              {getViewTitle()}
            </h2>
            <p className="text-gray-600 mt-1">
              {getViewDescription()}
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          {/* Botones específicos por vista - SIN entradas y salidas */}
          {activeView === 'pacientes' && (
            <button
              onClick={() => openModal('add-paciente')}
              className="btn-primary text-white px-6 py-3 rounded-xl flex items-center gap-2 font-medium shadow-lg"
            >
              <Plus size={20} />
              Nuevo Paciente
            </button>
          )}

          {activeView === 'coordinadoras' && (
            <button
              onClick={() => openModal('add-supervisora')}
              className="btn-primary text-white px-6 py-3 rounded-xl flex items-center gap-2 font-medium shadow-lg"
            >
              <Plus size={20} />
              Nueva Supervisora
            </button>
          )}
        </div>
      </div>

      {/* Fecha actual para otras vistas si es necesario */}
      {activeView !== 'calendario' && activeView === 'pacientes' && (
        <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
          <Calendar size={16} />
          <span>
            {currentDate.toLocaleDateString('es-AR', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </span>
        </div>
      )}
    </div>
  );
};

export default Header;