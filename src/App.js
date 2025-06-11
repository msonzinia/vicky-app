import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './lib/supabase';

// Componentes existentes
import LoginForm from './components/LoginForm';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import CalendarioView from './components/CalendarioView';
import PacientesView from './components/PacientesView';
import SupervisorasView from './components/SupervisorasView';
import AlquilerView from './components/AlquilerView';
import EntradaSView from './components/EntradaSView';
import SalidasView from './components/SalidasView';
import FacturarView from './components/FacturarView';
import DashboardView from './components/DashboardView';
import Modal from './components/Modal';
import CategorizarModal from './components/CategorizarModal';
import DayDetailModal from './components/DayDetailModal';
import ConfirmacionCambiosModal from './components/ConfirmacionCambiosModal';
import ConflictoHorarioModal from './components/ConflictoHorarioModal';
import ToastSystem from './components/ToastSystem';

// 🚀 NUEVO: Componentes mobile
import { useIsMobile, MobileHeader, CalendarioMobile, SidebarOverlay } from './components/MobileComponents';
import { EntradasMobile, SalidasMobile, DashboardMobile } from './components/MobileViews';
import BottomNavigation from './components/BottomNavigation';
import MobileModal from './components/MobileModal';
import MobileModalEntrada from './components/MobileModalEntrada';
import MobileModalSalida from './components/MobileModalSalida';
// ============================================================================
// 🚀 FUNCIONES JS QUE REEMPLAZAN LAS FUNCIONES DE SUPABASE
// ============================================================================

const crearFechaLocalParaBD = (fecha, horas, minutos) => {
  const año = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  const horasStr = String(horas).padStart(2, '0');
  const minutosStr = String(minutos).padStart(2, '0');

  return `${año}-${mes}-${dia} ${horasStr}:${minutosStr}:00`;
};

/**
 * Genera sesiones automáticas para un paciente nuevo (3 años desde fecha_inicio)
 */
const generarSesionsPacienteNuevo = async (pacienteId) => {
  try {
    console.log('🚀 Generando sesiones para paciente nuevo:', pacienteId);

    // 1. Obtener datos del paciente
    const { data: paciente, error: pacienteError } = await supabase
      .from('pacientes')
      .select('*')
      .eq('id', pacienteId)
      .single();

    if (pacienteError) throw pacienteError;

    // 2. Obtener horarios del paciente
    const { data: horarios, error: horariosError } = await supabase
      .from('horarios_pacientes')
      .select('*')
      .eq('paciente_id', pacienteId);

    if (horariosError) throw horariosError;

    if (!horarios || horarios.length === 0) {
      console.log('❌ No hay horarios configurados para el paciente');
      return 0;
    }

    // 3. Configurar fechas (3 años desde fecha_inicio)
    const fechaInicio = new Date(paciente.fecha_inicio);
    const fechaFin = new Date(fechaInicio);
    fechaFin.setFullYear(fechaFin.getFullYear() + 3); // 3 años

    console.log('📅 Generando sesiones desde:', fechaInicio.toISOString().split('T')[0]);
    console.log('📅 Hasta:', fechaFin.toISOString().split('T')[0]);

    // 4. Generar sesiones para cada horario
    const sesionesAInsertar = [];
    let contadorSesiones = 0;

    for (const horario of horarios) {
      const fechaActual = new Date(fechaInicio);

      // Encontrar la primera fecha que coincida con el día de la semana
      while (fechaActual.getDay() !== horario.dia_semana) {
        fechaActual.setDate(fechaActual.getDate() + 1);
      }

      // Generar sesiones semanales
      while (fechaActual <= fechaFin) {
        // 🔧 CORRECCIÓN: Crear fecha local directamente
        const [horas, minutos] = horario.hora_inicio.split(':');
        const fechaHoraLocal = crearFechaLocalParaBD(fechaActual, parseInt(horas), parseInt(minutos));

        const sesion = {
          tipo_sesion: 'Sesión',
          paciente_id: pacienteId,
          supervisora_id: null,
          fecha_hora: fechaHoraLocal, // ✅ Usar función helper
          precio_por_hora: paciente.precio_por_hora,
          duracion_horas: 1.0,
          estado: 'Pendiente',
          auto_generada: true,
          modificada_manualmente: false,
          eliminado: false,
          horario_origen_id: horario.id,
          version_generacion: 1,
          acompañado_supervisora: false,
          supervisora_acompanante_id: null
        };

        sesionesAInsertar.push(sesion);
        contadorSesiones++;

        // Siguiente semana
        fechaActual.setDate(fechaActual.getDate() + 7);
      }
    }

    // 5. Insertar sesiones en lotes de 100 (para evitar límites)
    const tamañoLote = 100;
    let sesionesInsertadas = 0;

    for (let i = 0; i < sesionesAInsertar.length; i += tamañoLote) {
      const lote = sesionesAInsertar.slice(i, i + tamañoLote);

      const { error: insertError } = await supabase
        .from('sesiones')
        .insert(lote);

      if (insertError) {
        console.error('❌ Error insertando lote de sesiones:', insertError);
        throw insertError;
      }

      sesionesInsertadas += lote.length;
      console.log(`✅ Insertadas ${sesionesInsertadas}/${sesionesAInsertar.length} sesiones`);
    }

    console.log(`🎉 Total de sesiones generadas: ${contadorSesiones}`);
    return contadorSesiones;

  } catch (error) {
    console.error('❌ Error generando sesiones:', error);
    throw error;
  }
};

/**
 * Gestiona horarios de paciente (actualizar, agregar, eliminar)
 */
const gestionarHorariosPaciente = async (pacienteId, horariosNuevos, accion = 'actualizar_completo') => {
  try {
    console.log('🔄 Gestionando horarios del paciente:', pacienteId);
    console.log('🔄 Acción:', accion);
    console.log('🔄 Horarios nuevos:', horariosNuevos);

    // 1. Obtener horarios actuales
    const { data: horariosActuales, error: horariosError } = await supabase
      .from('horarios_pacientes')
      .select('*')
      .eq('paciente_id', pacienteId);

    if (horariosError) throw horariosError;

    console.log('🔄 Horarios actuales en BD:', horariosActuales);

    const mañana = new Date();
    mañana.setDate(mañana.getDate() + 1);
    mañana.setHours(0, 0, 0, 0);

    if (accion === 'actualizar_completo') {
      // 2. CORREGIDO: Identificar horarios a eliminar
      const idsHorariosNuevos = horariosNuevos
        .filter(h => h.id) // Solo los que tienen ID
        .map(h => h.id);

      console.log('🔄 IDs de horarios que se mantienen:', idsHorariosNuevos);

      const horariosAEliminar = horariosActuales.filter(horarioActual => {
        // Si el horario actual NO está en la lista de IDs nuevos, se elimina
        return !idsHorariosNuevos.includes(horarioActual.id);
      });

      console.log('🗑️ Horarios a eliminar:', horariosAEliminar);

      // Eliminar horarios que ya no están
      for (const horarioAEliminar of horariosAEliminar) {
        console.log(`🗑️ Eliminando horario ID: ${horarioAEliminar.id}`);

        // PRIMERO: Eliminar sesiones futuras auto-generadas de este horario
        const { data: sesionesEliminadas, error: deleteSesionesError } = await supabase
          .from('sesiones')
          .update({ eliminado: true })
          .eq('horario_origen_id', horarioAEliminar.id)
          .eq('auto_generada', true)
          .gte('fecha_hora', mañana.toISOString())
          .select('id');

        if (deleteSesionesError) throw deleteSesionesError;

        console.log(`✅ Eliminadas ${sesionesEliminadas?.length || 0} sesiones del horario ${horarioAEliminar.id}`);

        // SEGUNDO: También eliminar sesiones manuales que tengan este horario_origen_id
        const { data: sesionesManualesEliminadas, error: deleteManualesError } = await supabase
          .from('sesiones')
          .update({ eliminado: true })
          .eq('horario_origen_id', horarioAEliminar.id)
          .eq('auto_generada', false)
          .gte('fecha_hora', mañana.toISOString())
          .select('id');

        if (deleteManualesError) throw deleteManualesError;

        console.log(`✅ Eliminadas ${sesionesManualesEliminadas?.length || 0} sesiones manuales del horario ${horarioAEliminar.id}`);

        // TERCERO: Para estar seguros, eliminar TODAS las sesiones futuras de este horario (sin filtros)
        const { data: todasLasSesiones, error: deleteTodasError } = await supabase
          .from('sesiones')
          .update({ horario_origen_id: null })
          .eq('horario_origen_id', horarioAEliminar.id)
          .select('id');

        if (deleteTodasError) throw deleteTodasError;

        console.log(`✅ Desvinculadas ${todasLasSesiones?.length || 0} sesiones del horario ${horarioAEliminar.id}`);

        // CUARTO: Ahora SÍ eliminar el horario
        const { error: deleteHorarioError } = await supabase
          .from('horarios_pacientes')
          .delete()
          .eq('id', horarioAEliminar.id);

        if (deleteHorarioError) {
          console.error(`❌ Error eliminando horario ${horarioAEliminar.id}:`, deleteHorarioError);
          throw deleteHorarioError;
        }

        console.log(`✅ Horario ${horarioAEliminar.id} eliminado exitosamente`);
      }

      // 3. Actualizar horarios existentes que cambiaron
      for (const horarioNuevo of horariosNuevos) {
        if (horarioNuevo.id) {
          const horarioActual = horariosActuales.find(h => h.id === horarioNuevo.id);

          if (horarioActual &&
            (horarioActual.dia_semana !== horarioNuevo.dia_semana ||
              horarioActual.hora_inicio !== horarioNuevo.hora_inicio)) {

            console.log(`🔄 Actualizando horario ID: ${horarioNuevo.id}`);

            // Actualizar horario
            const { error: updateHorarioError } = await supabase
              .from('horarios_pacientes')
              .update({
                dia_semana: horarioNuevo.dia_semana,
                hora_inicio: horarioNuevo.hora_inicio
              })
              .eq('id', horarioNuevo.id);

            if (updateHorarioError) throw updateHorarioError;

            // Eliminar sesiones futuras del horario anterior
            const { data: sesionesEliminadas, error: deleteSesionesError } = await supabase
              .from('sesiones')
              .update({ eliminado: true })
              .eq('horario_origen_id', horarioNuevo.id)
              .eq('auto_generada', true)
              .gte('fecha_hora', mañana.toISOString())
              .select('id');

            if (deleteSesionesError) throw deleteSesionesError;

            console.log(`✅ Eliminadas ${sesionesEliminadas?.length || 0} sesiones del horario modificado`);

            // Generar nuevas sesiones para este horario
            await generarSesionesFuturasParaHorario(pacienteId, horarioNuevo, mañana);
          }
        }
      }

      // 4. Crear horarios nuevos (sin id)
      const horariosACrear = horariosNuevos.filter(h => !h.id);

      console.log('➕ Horarios a crear:', horariosACrear);

      for (const horarioNuevo of horariosACrear) {
        console.log(`➕ Creando nuevo horario: ${horarioNuevo.dia_semana} a las ${horarioNuevo.hora_inicio}`);

        // Crear horario
        const { data: horarioCreado, error: createHorarioError } = await supabase
          .from('horarios_pacientes')
          .insert({
            paciente_id: pacienteId,
            dia_semana: horarioNuevo.dia_semana,
            hora_inicio: horarioNuevo.hora_inicio
          })
          .select()
          .single();

        if (createHorarioError) throw createHorarioError;

        console.log(`✅ Horario creado con ID: ${horarioCreado.id}`);

        // Generar sesiones para este nuevo horario
        await generarSesionesFuturasParaHorario(pacienteId, horarioCreado, mañana);
      }
    }

    console.log('✅ Gestión de horarios completada');
    return 'Horarios actualizados exitosamente';

  } catch (error) {
    console.error('❌ Error gestionando horarios:', error);
    throw error;
  }
};

/**
 * Genera sesiones futuras para un horario específico
 */
const generarSesionesFuturasParaHorario = async (pacienteId, horario, fechaDesde) => {
  try {
    // Obtener datos del paciente
    const { data: paciente, error: pacienteError } = await supabase
      .from('pacientes')
      .select('precio_por_hora')
      .eq('id', pacienteId)
      .single();

    if (pacienteError) throw pacienteError;

    // Configurar fecha límite (1 año hacia adelante)
    const fechaHasta = new Date(fechaDesde);
    fechaHasta.setFullYear(fechaHasta.getFullYear() + 1);

    const sesionesAInsertar = [];
    const fechaActual = new Date(fechaDesde);

    // Encontrar la primera fecha que coincida con el día de la semana
    while (fechaActual.getDay() !== horario.dia_semana) {
      fechaActual.setDate(fechaActual.getDate() + 1);
    }

    // Generar sesiones semanales
    while (fechaActual <= fechaHasta) {
      // 🔧 CORRECCIÓN: Crear fecha local directamente
      const [horas, minutos] = horario.hora_inicio.split(':');
      const fechaHoraLocal = crearFechaLocalParaBD(fechaActual, parseInt(horas), parseInt(minutos));

      const sesion = {
        tipo_sesion: 'Sesión',
        paciente_id: pacienteId,
        supervisora_id: null,
        fecha_hora: fechaHoraLocal, // ✅ Usar función helper
        precio_por_hora: paciente.precio_por_hora,
        duracion_horas: 1.0,
        estado: 'Pendiente',
        auto_generada: true,
        modificada_manualmente: false,
        eliminado: false,
        horario_origen_id: horario.id,
        version_generacion: 1,
        acompañado_supervisora: false,
        supervisora_acompanante_id: null
      };

      sesionesAInsertar.push(sesion);
      fechaActual.setDate(fechaActual.getDate() + 7);
    }

    // Insertar en lotes
    const tamañoLote = 100;
    for (let i = 0; i < sesionesAInsertar.length; i += tamañoLote) {
      const lote = sesionesAInsertar.slice(i, i + tamañoLote);

      const { error: insertError } = await supabase
        .from('sesiones')
        .insert(lote);

      if (insertError) throw insertError;
    }

    console.log(`✅ Generadas ${sesionesAInsertar.length} sesiones para horario ${horario.dia_semana} a las ${horario.hora_inicio}`);
    return sesionesAInsertar.length;

  } catch (error) {
    console.error('❌ Error generando sesiones futuras:', error);
    throw error;
  }
};

/**
 * Inactiva paciente y elimina sesiones futuras auto-generadas
 */
const inactivarPacienteCompleto = async (pacienteId) => {
  try {
    console.log('⏸️ Inactivando paciente:', pacienteId);

    const mañana = new Date();
    mañana.setDate(mañana.getDate() + 1);
    mañana.setHours(0, 0, 0, 0);

    // Eliminar sesiones futuras auto-generadas
    const { data, error } = await supabase
      .from('sesiones')
      .update({ eliminado: true })
      .eq('paciente_id', pacienteId)
      .eq('auto_generada', true)
      .gte('fecha_hora', mañana.toISOString())
      .select('id');

    if (error) throw error;

    const sesionesEliminadas = data?.length || 0;
    console.log(`✅ Eliminadas ${sesionesEliminadas} sesiones futuras auto-generadas`);

    return `Paciente inactivado. ${sesionesEliminadas} sesiones futuras eliminadas.`;

  } catch (error) {
    console.error('❌ Error inactivando paciente:', error);
    throw error;
  }
};

/**
 * Reactiva paciente y genera sesiones futuras
 */
const reactivarPacienteCompleto = async (pacienteId) => {
  try {
    console.log('▶️ Reactivando paciente:', pacienteId);

    // Actualizar fecha de última reactivación
    const { error: updateError } = await supabase
      .from('pacientes')
      .update({ fecha_ultima_reactivacion: new Date().toISOString() })
      .eq('id', pacienteId);

    if (updateError) throw updateError;

    // Obtener horarios del paciente
    const { data: horarios, error: horariosError } = await supabase
      .from('horarios_pacientes')
      .select('*')
      .eq('paciente_id', pacienteId);

    if (horariosError) throw horariosError;

    if (!horarios || horarios.length === 0) {
      return 'Paciente reactivado sin horarios configurados';
    }

    const mañana = new Date();
    mañana.setDate(mañana.getDate() + 1);
    mañana.setHours(0, 0, 0, 0);

    let totalSesionesGeneradas = 0;

    // Generar sesiones para cada horario
    for (const horario of horarios) {
      const sesionesGeneradas = await generarSesionesFuturasParaHorario(pacienteId, horario, mañana);
      totalSesionesGeneradas += sesionesGeneradas;
    }

    console.log(`✅ Paciente reactivado. ${totalSesionesGeneradas} sesiones generadas.`);
    return `Paciente reactivado. ${totalSesionesGeneradas} sesiones generadas.`;

  } catch (error) {
    console.error('❌ Error reactivando paciente:', error);
    throw error;
  }
};

/**
 * Actualiza precios en sesiones futuras (auto-generadas y manuales)
 */
const actualizarPreciosFuturosPaciente = async (pacienteId, nuevoPrecio) => {
  try {
    console.log('💰 Actualizando precios futuros para paciente:', pacienteId);

    const mañana = new Date();
    mañana.setDate(mañana.getDate() + 1);
    mañana.setHours(0, 0, 0, 0);

    // Actualizar precio en todas las sesiones futuras (auto y manuales)
    const { data, error } = await supabase
      .from('sesiones')
      .update({ precio_por_hora: nuevoPrecio })
      .eq('paciente_id', pacienteId)
      .gte('fecha_hora', mañana.toISOString())
      .eq('eliminado', false)
      .select('id');

    if (error) throw error;

    const sesionesActualizadas = data?.length || 0;
    console.log(`✅ Precio actualizado en ${sesionesActualizadas} sesiones futuras`);

    return `Precio actualizado en ${sesionesActualizadas} sesiones futuras`;

  } catch (error) {
    console.error('❌ Error actualizando precios:', error);
    throw error;
  }
};

/**
 * Actualiza nombre en TODAS las sesiones del paciente (pasadas y futuras)
 */
const actualizarNombrePacienteEnSesiones = async (pacienteId, nuevoNombre) => {
  try {
    console.log('👤 Actualizando nombre en todas las sesiones del paciente:', pacienteId);

    // Nota: En Supabase, el nombre se obtiene via JOIN, no se actualiza en sesiones
    // Esta función existe para mantener consistencia con la lógica original
    // pero no requiere actualización porque el nombre se obtiene dinámicamente

    console.log('✅ Nombre actualizado (se refleja automáticamente via JOIN)');
    return 'Nombre actualizado en todas las sesiones';

  } catch (error) {
    console.error('❌ Error actualizando nombre:', error);
    throw error;
  }
};

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

function App() {
  // 🚀 NUEVO: Estados de autenticación
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Estados principales
  const [activeView, setActiveView] = useState('calendario');
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [currencyMode, setCurrencyMode] = useState('ARS');
  const [loading, setLoading] = useState(true);
  const [fechaPrecargada, setFechaPrecargada] = useState(null);

  // Estados para datos
  const [pacientes, setPacientes] = useState([]);
  const [supervisoras, setSupervisoras] = useState([]);
  const [sesiones, setSesiones] = useState([]);
  const [alquilerConfig, setAlquilerConfig] = useState({ precio_mensual: 50000 });
  const [tipoCambio, setTipoCambio] = useState(1150);
  const [sesionsPendientes, setSesionsPendientes] = useState(0);

  // 🚀 NUEVO: Estados para mobile
  const [sidebarMobileOpen, setSidebarMobileOpen] = useState(false);
  const [lastUpdateTimestamp, setLastUpdateTimestamp] = useState(Date.now());
  const [mobileModalOpen, setMobileModalOpen] = useState(false);
  const [fechaDelCalendario, setFechaDelCalendario] = useState(new Date().toISOString().slice(0, 16));
  // 🚀 NUEVO: Estados para modales mobile específicos
  const [mobileModalEntradaOpen, setMobileModalEntradaOpen] = useState(false);
  const [mobileModalSalidaOpen, setMobileModalSalidaOpen] = useState(false);

  const isMobile = useIsMobile();


  // Estados para modal de confirmación
  const [showConfirmacionModal, setShowConfirmacionModal] = useState(false);
  const [cambiosDetectados, setCambiosDetectados] = useState({});
  const [formDataPendiente, setFormDataPendiente] = useState(null);
  const [selectedItemPendiente, setSelectedItemPendiente] = useState(null);

  // Estados para validación de conflictos
  const [showConflictoModal, setShowConflictoModal] = useState(false);
  const [conflictoDetectado, setConflictoDetectado] = useState(null);
  const [sesionConConflicto, setSesionConConflicto] = useState(null);

  // ============================================================================
  // ✅ FUNCIONES HELPER Y UTILITARIAS (definidas primero)
  // ============================================================================

  const convertirFechaParaGuardar = useCallback((fechaInput) => {
    if (!fechaInput) return null;
    return fechaInput.replace('T', ' ') + ':00';
  }, []);

  const convertirFechaParaInput = useCallback((fechaISO) => {
    if (!fechaISO) return '';

    try {
      console.log('📅 Convirtiendo fecha ISO a input:', fechaISO);

      // Si viene en formato 'YYYY-MM-DD HH:mm:ss' (desde la BD), convertir directamente
      if (fechaISO.includes(' ') && !fechaISO.includes('T')) {
        const [fechaParte, horaParte] = fechaISO.split(' ');
        const [horas, minutos] = horaParte.split(':');
        const fechaFormateada = `${fechaParte}T${horas}:${minutos}`;

        console.log('📅 Conversión directa desde BD:', fechaFormateada);
        return fechaFormateada;
      }

      // Si ya tiene T, puede que ya esté en formato correcto
      if (fechaISO.includes('T')) {
        return fechaISO.slice(0, 16);
      }

      // Fallback - no debería llegar aquí
      console.log('📅 Fallback - formato no reconocido:', fechaISO);
      return fechaISO;

    } catch (error) {
      console.error('❌ Error formateando fecha para input:', error);
      return '';
    }
  }, []);

  const diagnosticarFechasEnSesiones = useCallback(async () => {
    try {
      console.log('🔍 Iniciando diagnóstico de fechas...');

      const { data: sesiones, error } = await supabase
        .from('sesiones')
        .select('id, fecha_hora, tipo_sesion')
        .eq('eliminado', false)
        .order('fecha_hora')
        .limit(50);

      if (error) throw error;

      console.log(`📊 Analizando ${sesiones.length} sesiones...`);

      sesiones.forEach((sesion, index) => {
        const fecha = new Date(sesion.fecha_hora);

        console.log(`Sesión ${index + 1}:`, {
          id: sesion.id,
          tipo: sesion.tipo_sesion,
          fecha_iso: sesion.fecha_hora,
          fecha_parseada: fecha.toString(),
          dia_semana: fecha.getDay(),
          hora: fecha.getHours() + ':' + fecha.getMinutes().toString().padStart(2, '0')
        });
      });

      console.log('✅ Diagnóstico completado');

    } catch (error) {
      console.error('❌ Error en diagnóstico:', error);
    }
  }, []);

  const diagnosticarZonaHoraria = useCallback(() => {
    console.log('🔍 DIAGNÓSTICO DE ZONA HORARIA ARGENTINA:');

    const ahora = new Date();
    console.log('📊 Información actual:', {
      zona: Intl.DateTimeFormat().resolvedOptions().timeZone,
      offset_UTC: ahora.getTimezoneOffset() + ' minutos',
      hora_local: ahora.toLocaleString('es-AR'),
      hora_UTC: ahora.toUTCString(),
      ISO: ahora.toISOString()
    });

    // Probar conversión de 10:00 AM
    const testInput = '2025-01-30T10:00';
    const fechaGuardada = convertirFechaParaGuardar(testInput);
    const fechaParaInput = convertirFechaParaInput(fechaGuardada);

    console.log('🧪 PRUEBA 10:00 AM:');
    console.log('  1. Input:', testInput);
    console.log('  2. Para guardar:', fechaGuardada);
    console.log('  3. Para mostrar:', fechaParaInput);
    console.log('  4. ¿Coincide?:', testInput === fechaParaInput ? '✅ CORRECTO' : '❌ ERROR');

    if (fechaGuardada) {
      const fechaDB = new Date(fechaGuardada);
      console.log('🗄️ En base de datos se ve como:', fechaDB.toLocaleString('es-AR'));
    }
  }, [convertirFechaParaGuardar, convertirFechaParaInput]);

  const loadExampleData = useCallback(() => {
    setPacientes([
      {
        id: '1',
        nombre_apellido: 'Juan Pérez',
        nombre_apellido_tutor: 'Carlos Pérez',
        cuil: '20-12345678-9',
        precio_por_hora: 15000,
        fecha_inicio: '2025-01-15',
        activo: true,
        eliminado: false,
        color: '#3B82F6',
        horarios: [{ id: 'h1', dia_semana: 2, hora_inicio: '10:00' }]
      },
      {
        id: '2',
        nombre_apellido: 'María García',
        nombre_apellido_tutor: 'Laura García',
        cuil: '27-87654321-3',
        precio_por_hora: 18000,
        fecha_inicio: '2025-01-20',
        activo: true,
        eliminado: false,
        color: '#EF4444',
        horarios: [{ id: 'h2', dia_semana: 4, hora_inicio: '14:00' }]
      }
    ]);

    setSupervisoras([
      { id: '1', nombre_apellido: 'Dra. María González', precio_por_hora: 8000 },
      { id: '2', nombre_apellido: 'Lic. Ana Rodríguez', precio_por_hora: 7500 }
    ]);

    const sesionesEjemplo = [];
    const hoy = new Date();
    for (let i = -7; i <= 30; i++) {
      const fecha = new Date(hoy);
      fecha.setDate(hoy.getDate() + i);
      fecha.setHours(10, 0, 0, 0);

      if (fecha.getDay() === 2) {
        sesionesEjemplo.push({
          id: `s1-${i}`,
          tipo_sesion: 'Sesión',
          paciente_id: '1',
          supervisora_id: null,
          fecha_hora: fecha.toISOString(),
          precio_por_hora: 15000,
          duracion_horas: 1,
          estado: i < 0 ? 'Pendiente' : 'Pendiente',
          auto_generada: true,
          modificada_manualmente: false,
          eliminado: false,
          horario_origen_id: 'h1'
        });
      }
      if (fecha.getDay() === 4) {
        fecha.setHours(14, 0, 0, 0);
        sesionesEjemplo.push({
          id: `s2-${i}`,
          tipo_sesion: 'Sesión',
          paciente_id: '2',
          supervisora_id: null,
          fecha_hora: fecha.toISOString(),
          precio_por_hora: 18000,
          duracion_horas: 1,
          estado: i < 0 ? 'Pendiente' : 'Pendiente',
          auto_generada: true,
          modificada_manualmente: false,
          eliminado: false,
          horario_origen_id: 'h2'
        });
      }
    }
    setSesiones(sesionesEjemplo);

    const pendientes = sesionesEjemplo.filter(s =>
      s.estado === 'Pendiente' && new Date(s.fecha_hora) < hoy && !s.eliminado
    ).length;
    setSesionsPendientes(pendientes);
  }, []);

  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);

      const { data: pacientesData, error: pacientesError } = await supabase
        .from('pacientes')
        .select(`
          *,
          horarios_pacientes (
            id,
            dia_semana,
            hora_inicio
          )
        `)
        .order('eliminado')
        .order('activo', { ascending: false })
        .order('nombre_apellido');

      if (pacientesError) throw pacientesError;

      const pacientesConHorarios = (pacientesData || []).map(paciente => ({
        ...paciente,
        horarios: paciente.horarios_pacientes || []
      }));

      setPacientes(pacientesConHorarios);

      const { data: supervisorasData, error: supervisorasError } = await supabase
        .from('supervisoras')
        .select('*')
        .eq('eliminado', false)
        .order('nombre_apellido');

      if (supervisorasError) throw supervisorasError;
      setSupervisoras(supervisorasData || []);

      const fechaInicio = new Date();
      fechaInicio.setMonth(fechaInicio.getMonth() - 3);

      const { data: sesionesData, error: sesionesError } = await supabase
        .from('sesiones')
        .select('*')
        .eq('eliminado', false)
        .gte('fecha_hora', fechaInicio.toISOString())
        .order('fecha_hora');

      if (sesionesError) throw sesionesError;
      setSesiones(sesionesData || []);

      const pendientes = (sesionesData || []).filter(s =>
        s.estado === 'Pendiente' && new Date(s.fecha_hora) < new Date() && !s.eliminado
      ).length;
      setSesionsPendientes(pendientes);

      const { data: alquilerData, error: alquilerError } = await supabase
        .from('configuracion_alquiler')
        .select('*')
        .limit(1)
        .single();

      if (!alquilerError && alquilerData) {
        setAlquilerConfig(alquilerData);
      }

      setTipoCambio(1150);

    } catch (error) {
      console.error('Error loading data:', error);
      loadExampleData();
    } finally {
      setLoading(false);
    }
  }, [loadExampleData]);





  // ============================================================================
  // FUNCIONES PARA VALIDACIÓN DE CONFLICTOS
  // ============================================================================

  const verificarConflictoHorario = async (fechaHora, duracionHoras = 1.0, excluirSesionId = null) => {
    try {
      console.log('🔍 Verificando conflicto de horario...');
      console.log('Fecha/hora:', fechaHora);
      console.log('Duración:', duracionHoras);
      console.log('Excluir sesión ID:', excluirSesionId);

      // Si no existe la función en Supabase, simplemente retornamos que no hay conflicto
      try {
        const { data, error } = await supabase.rpc('verificar_conflicto_horario', {
          p_fecha_hora: fechaHora,
          p_duracion_horas: duracionHoras,
          p_excluir_sesion_id: excluirSesionId
        });

        if (error) {
          console.log('⚠️ Función verificar_conflicto_horario no existe en Supabase, omitiendo validación');
          return { hayConflicto: false };
        }

        console.log('Resultado verificación:', data);

        if (data && data.length > 0) {
          const conflicto = data[0];

          if (conflicto.conflicto) {
            return {
              hayConflicto: true,
              sesionConflictiva: {
                id: conflicto.sesion_conflictiva_id,
                pacienteNombre: conflicto.paciente_nombre,
                supervisoraNombre: conflicto.supervisora_nombre
              }
            };
          }
        }

        return { hayConflicto: false };
      } catch (rpcError) {
        console.log('⚠️ Función verificar_conflicto_horario no disponible, omitiendo validación');
        return { hayConflicto: false };
      }

    } catch (error) {
      console.error('Error en verificación de conflicto:', error);
      return { hayConflicto: false };
    }
  };

  const procederConGuardadoNormal = async (formData) => {
    if (modalType === 'add-paciente') {
      await ejecutarGuardadoPaciente(formData, false);
    } else if (modalType === 'edit-paciente') {
      const cambios = detectarCambiosPaciente(selectedItem, formData);
      if (cambios.mostrarModal) {
        setCambiosDetectados(cambios);
        setFormDataPendiente(formData);
        setSelectedItemPendiente(selectedItem);
        setShowModal(false);
        setShowConfirmacionModal(true);
        return;
      } else {
        await ejecutarGuardadoPaciente(formData, true);
      }
    } else {
      await ejecutarGuardadoOtrosTipos(formData);
    }
  };

  const confirmarCreacionConConflicto = async () => {
    try {
      console.log('✅ Usuario confirmó creación a pesar del conflicto');

      setShowConflictoModal(false);

      if (sesionConConflicto) {
        await procederConGuardadoNormal(sesionConConflicto);
        setSesionConConflicto(null);
        setConflictoDetectado(null);
      }
    } catch (error) {
      console.error('Error confirmando creación con conflicto:', error);
      handleError(error);
    }
  };

  const cancelarCreacionPorConflicto = () => {
    console.log('❌ Usuario canceló creación por conflicto');

    setShowConflictoModal(false);
    setSesionConConflicto(null);
    setConflictoDetectado(null);

    if (window.showToast) {
      window.showToast('💡 Cambia la fecha/hora para evitar la superposición', 'info', 4000);
    }
  };

  // Exponer funciones de diagnóstico
  useEffect(() => {
    window.diagnosticarFechasEnSesiones = diagnosticarFechasEnSesiones;
    window.diagnosticarZonaHoraria = diagnosticarZonaHoraria;
    return () => {
      delete window.diagnosticarFechasEnSesiones;
      delete window.diagnosticarZonaHoraria;
    };
  }, [diagnosticarFechasEnSesiones, diagnosticarZonaHoraria]);


  // 🚀 NUEVO: Verificar autenticación al cargar
  useEffect(() => {
    console.log('🔐 Verificando autenticación...');

    // Verificar si ya hay una sesión activa
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
      console.log('👤 Usuario actual:', session?.user?.email || 'No autenticado');
    });

    // Escuchar cambios de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('🔄 Cambio de autenticación:', event, session?.user?.email);
        setUser(session?.user ?? null);
        setAuthLoading(false);

        // Solo recargar si se desloguea, NO si se loguea
        if (event === 'SIGNED_OUT') {
          console.log('👋 Logout, recargando app...');
          window.location.reload();
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);


  // Cargar datos iniciales
  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // 🚀 Redirigir a vista 'calendario' si estamos en mobile al iniciar
  useEffect(() => {
    if (isMobile && activeView === 'dashboard') {
      setActiveView('calendario');
    }
  }, [isMobile, activeView]);

  // 🚀 NUEVO: Exponer Supabase para feriados y sincronización
  useEffect(() => {
    window.supabase = supabase;
    return () => {
      delete window.supabase;
    };
  }, []);


  useEffect(() => {
    if (pacientes.length > 0) {
      const eliminados = pacientes.filter(p => p.eliminado);
      console.log('✅ Pacientes eliminados cargados:', eliminados.length);
      if (eliminados.length > 0) {
        console.log('Lista de eliminados:', eliminados.map(p => p.nombre_apellido));
      }
    }
  }, [pacientes]);



  // 🚀 NUEVA FUNCIÓN: Calcular ganancia neta para mobile header
  const calcularGananciaNeta = () => {
    const hoy = new Date();
    const mesActual = hoy.getMonth();
    const añoActual = hoy.getFullYear();

    console.log('📊 Calculando estimado para mes actual:', {
      mes: mesActual + 1,
      año: añoActual
    });

    // 1. Filtrar sesiones solo del mes actual
    const sesionesDelMes = sesiones.filter(sesion => {
      const fechaSesion = new Date(sesion.fecha_hora);
      return fechaSesion.getMonth() === mesActual &&
        fechaSesion.getFullYear() === añoActual;
    });

    // 2. Estados que sí generan ingresos/gastos
    const estadosQueFacturan = ['Realizada', 'Cancelada sin antelación', 'Pendiente'];

    const sesionesFactivirables = sesionesDelMes.filter(sesion =>
      estadosQueFacturan.includes(sesion.estado)
    );

    // 3. INGRESOS: Sesiones de pacientes
    const sesionesIngresos = sesionesFactivirables.filter(sesion => sesion.paciente_id);
    const totalIngresos = sesionesIngresos.reduce((total, sesion) => {
      return total + (sesion.precio_por_hora * sesion.duracion_horas);
    }, 0);

    // 4. GASTOS: Supervisiones directas
    const sesionesSupervisiones = sesionesFactivirables.filter(sesion => sesion.supervisora_id);
    const gastoSupervisiones = sesionesSupervisiones.reduce((total, sesion) => {
      return total + (sesion.precio_por_hora * sesion.duracion_horas);
    }, 0);

    // 5. GASTOS: Acompañamientos de supervisoras (50% del precio de la sesión)
    const sesionesConAcompanamiento = sesionesFactivirables.filter(sesion =>
      sesion.acompañado_supervisora && sesion.supervisora_acompanante_id
    );
    const gastoAcompanamientos = sesionesConAcompanamiento.reduce((total, sesion) => {
      return total + ((sesion.precio_por_hora * sesion.duracion_horas) * 0.5);
    }, 0);

    // 6. ESTIMACIÓN: Supervisiones regulares (2 promedio por mes si no hay suficientes)
    let gastoSupervisionesEstimado = 0;
    const supervisionesRealesDelMes = sesionesSupervisiones.length;

    if (supervisionesRealesDelMes < 2 && supervisoras.length > 0) {
      const supervisorasActivas = supervisoras.filter(s => !s.eliminado);
      if (supervisorasActivas.length > 0) {
        const precioPromedioSupervisora = supervisorasActivas.reduce((sum, s) =>
          sum + s.precio_por_hora, 0) / supervisorasActivas.length;

        const supervisionesFaltantes = 2 - supervisionesRealesDelMes;
        gastoSupervisionesEstimado = precioPromedioSupervisora * 2 * supervisionesFaltantes; // 2 horas x supervisiones faltantes
      }
    }

    // 7. GASTO: Alquiler mensual
    const gastoAlquiler = alquilerConfig?.precio_mensual || 0;

    // 8. CÁLCULO FINAL
    const totalGastos = gastoSupervisiones + gastoAcompanamientos + gastoSupervisionesEstimado + gastoAlquiler;
    const estimadoNeto = totalIngresos - totalGastos;

    console.log('📋 Estimado del mes:', {
      ingresos: totalIngresos,
      gastos: {
        supervisiones: gastoSupervisiones,
        acompanamientos: gastoAcompanamientos,
        supervisionesEstimadas: gastoSupervisionesEstimado,
        alquiler: gastoAlquiler,
        total: totalGastos
      },
      neto: estimadoNeto,
      sesionesConsideradas: sesionesFactivirables.length
    });

    return estimadoNeto;
  };

  const formatCurrency = (amount, currency = currencyMode) => {
    if (currency === 'USD') {
      return `$${(amount / tipoCambio).toFixed(0)} USD`;
    }
    return `$${amount.toLocaleString()} ARS`;
  };

  const actualizarSesionLocal = (sesionActualizada) => {
    console.log('Actualizando sesión local:', sesionActualizada);

    setSesiones(prev => prev.map(s =>
      s.id === sesionActualizada.id ? { ...s, ...sesionActualizada } : s
    ));

    if (sesionActualizada.estado) {
      const hoy = new Date();
      const esPasada = new Date(sesionActualizada.fecha_hora) < hoy;

      if (esPasada) {
        if (sesionActualizada.estado === 'Pendiente') {
          setSesionsPendientes(prev => prev + 1);
        } else {
          setSesionsPendientes(prev => Math.max(0, prev - 1));
        }
      }
    }
  };

  const handleCategorizarSesionRapida = async (sesionOriginal, nuevoEstado) => {
    try {
      console.log('=== CATEGORIZACIÓN RÁPIDA ===');
      console.log('Sesión original:', sesionOriginal);
      console.log('Nuevo estado:', nuevoEstado);

      const updateData = {
        estado: nuevoEstado,
      };

      const { error } = await supabase
        .from('sesiones')
        .update(updateData)
        .eq('id', sesionOriginal.id);

      if (error) throw error;

      const sesionActualizada = {
        ...sesionOriginal,
        estado: nuevoEstado
      };

      actualizarSesionLocal(sesionActualizada);

      const hoy = new Date();
      const esPasada = new Date(sesionOriginal.fecha_hora) < hoy;
      const eraPendiente = sesionOriginal.estado === 'Pendiente';
      const esAhoraPendiente = nuevoEstado === 'Pendiente';

      if (esPasada && eraPendiente && !esAhoraPendiente) {
        setSesionsPendientes(prev => Math.max(0, prev - 1));
      } else if (esPasada && !eraPendiente && esAhoraPendiente) {
        setSesionsPendientes(prev => prev + 1);
      }

      // 🚀 NUEVO: Actualizar timestamp para sidebar
      setLastUpdateTimestamp(Date.now());

      return true;
    } catch (error) {
      console.error('Error en categorización rápida:', error);
      return false;
    }
  };

  const detectarCambiosPaciente = (selectedItem, formData) => {
    const cambiosInfo = {};
    const horariosEditados = [];
    const horariosNuevos = [];
    const horariosEliminados = [];

    if (formData.nombre_apellido !== selectedItem.nombre_apellido) {
      cambiosInfo.nombre_apellido = {
        anterior: selectedItem.nombre_apellido,
        nuevo: formData.nombre_apellido
      };
    }

    if (formData.nombre_apellido_tutor !== selectedItem.nombre_apellido_tutor) {
      cambiosInfo.nombre_apellido_tutor = {
        anterior: selectedItem.nombre_apellido_tutor,
        nuevo: formData.nombre_apellido_tutor
      };
    }

    if (formData.cuil !== selectedItem.cuil) {
      cambiosInfo.cuil = {
        anterior: selectedItem.cuil,
        nuevo: formData.cuil
      };
    }

    if (formData.precio_por_hora !== selectedItem.precio_por_hora) {
      cambiosInfo.precio_por_hora = {
        anterior: selectedItem.precio_por_hora,
        nuevo: formData.precio_por_hora
      };
    }

    if (formData.color !== selectedItem.color) {
      cambiosInfo.color = {
        anterior: selectedItem.color,
        nuevo: formData.color
      };
    }

    if (formData.fecha_inicio !== selectedItem.fecha_inicio?.split('T')[0]) {
      cambiosInfo.fecha_inicio = {
        anterior: selectedItem.fecha_inicio?.split('T')[0],
        nuevo: formData.fecha_inicio
      };
    }

    const esReactivacion = !selectedItem.activo && formData.activo;
    const esDesactivacion = selectedItem.activo && !formData.activo;

    const horariosOriginales = (selectedItem.horarios || []).map(h => ({
      id: h.id || null,
      dia_semana: h.dia_semana,
      hora_inicio: h.hora_inicio
    }));

    const horariosNuevosForm = (formData.horarios || []).map(h => ({
      id: h.id || null,
      dia_semana: h.dia_semana,
      hora_inicio: h.hora_inicio
    }));

    const horariosIguales = (h1, h2) => {
      return h1.dia_semana === h2.dia_semana && h1.hora_inicio === h2.hora_inicio;
    };

    const getDiaTexto = (dia) => {
      const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      return dias[dia];
    };

    horariosOriginales.forEach(horarioOriginal => {
      const existeEnNuevo = horariosNuevosForm.some(horarioNuevo => {
        if (horarioOriginal.id && horarioNuevo.id) {
          return horarioOriginal.id === horarioNuevo.id;
        }
        return horariosIguales(horarioOriginal, horarioNuevo);
      });

      if (!existeEnNuevo) {
        horariosEliminados.push({
          dia_semana: horarioOriginal.dia_semana,
          hora_inicio: horarioOriginal.hora_inicio,
          texto: `${getDiaTexto(horarioOriginal.dia_semana)} a las ${horarioOriginal.hora_inicio}`
        });
      }
    });

    horariosNuevosForm.forEach(horarioNuevo => {
      const existeEnOriginal = horariosOriginales.some(horarioOriginal => {
        if (horarioNuevo.id && horarioOriginal.id) {
          return horarioNuevo.id === horarioOriginal.id;
        }
        return horariosIguales(horarioNuevo, horarioOriginal);
      });

      if (!existeEnOriginal) {
        horariosNuevos.push({
          dia_semana: horarioNuevo.dia_semana,
          hora_inicio: horarioNuevo.hora_inicio,
          texto: `${getDiaTexto(horarioNuevo.dia_semana)} a las ${horarioNuevo.hora_inicio}`
        });
      }
    });

    horariosOriginales.forEach(horarioOriginal => {
      if (horarioOriginal.id) {
        const horarioNuevoCorrespondiente = horariosNuevosForm.find(h => h.id === horarioOriginal.id);

        if (horarioNuevoCorrespondiente && !horariosIguales(horarioOriginal, horarioNuevoCorrespondiente)) {
          horariosEditados.push({
            anterior: {
              dia_semana: horarioOriginal.dia_semana,
              hora_inicio: horarioOriginal.hora_inicio,
              texto: `${getDiaTexto(horarioOriginal.dia_semana)} a las ${horarioOriginal.hora_inicio}`
            },
            nuevo: {
              dia_semana: horarioNuevoCorrespondiente.dia_semana,
              hora_inicio: horarioNuevoCorrespondiente.hora_inicio,
              texto: `${getDiaTexto(horarioNuevoCorrespondiente.dia_semana)} a las ${horarioNuevoCorrespondiente.hora_inicio}`
            }
          });
        }
      }
    });

    const hayCambiosSignificativos =
      Object.keys(cambiosInfo).length > 0 ||
      horariosEditados.length > 0 ||
      horariosNuevos.length > 0 ||
      horariosEliminados.length > 0 ||
      esReactivacion ||
      esDesactivacion;

    return {
      cambiosInfo,
      horariosEditados,
      horariosNuevos,
      horariosEliminados,
      esReactivacion,
      esDesactivacion,
      mostrarModal: hayCambiosSignificativos,
      hayCambiosHorarios: horariosEditados.length > 0 || horariosNuevos.length > 0 || horariosEliminados.length > 0
    };
  };

  const openModal = (type, item = null) => {
    setModalType(type);
    setSelectedItem(item);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setModalType('');
    setSelectedItem(null);
    setFechaPrecargada(null);
  };

  const handleNuevaSesionConFecha = (fechaFormateada) => {
    console.log('Creando nueva sesión con fecha pre-cargada:', fechaFormateada);
    setFechaPrecargada(fechaFormateada);
    setShowModal(false);
    setTimeout(() => {
      openModal('add-sesion');
    }, 100);
  };

  const confirmarCambiosPaciente = async () => {
    try {
      setShowConfirmacionModal(false);

      if (formDataPendiente && selectedItemPendiente) {
        await ejecutarGuardadoPaciente(formDataPendiente, true, selectedItemPendiente);
        setFormDataPendiente(null);
        setSelectedItemPendiente(null);
        setCambiosDetectados({});
      }
    } catch (error) {
      console.error('Error al confirmar cambios:', error);
      handleError(error);
    }
  };

  const cancelarCambiosPaciente = () => {
    console.log('Cancelando cambios de paciente...');

    setShowConfirmacionModal(false);
    setFormDataPendiente(null);
    setSelectedItemPendiente(null);
    setCambiosDetectados({});

    if (window.showToast) {
      window.showToast('Cambios cancelados', 'info', 2000);
    }
  };

  const ejecutarGuardadoPaciente = async (formData, esEdicion, selectedItemParam = null) => {
    try {
      if (!esEdicion) {
        console.log('=== CREANDO PACIENTE NUEVO ===');

        const { data, error } = await supabase
          .from('pacientes')
          .insert([{
            nombre_apellido: formData.nombre_apellido,
            nombre_apellido_tutor: formData.nombre_apellido_tutor,
            cuil: formData.cuil,
            precio_por_hora: formData.precio_por_hora,
            fecha_inicio: formData.fecha_inicio,
            activo: formData.activo,
            color: formData.color
          }])
          .select()
          .single();

        if (error) throw error;

        const horariosInsertados = [];
        for (const horario of formData.horarios || []) {
          const { data: horarioInsertado, error: horarioError } = await supabase
            .from('horarios_pacientes')
            .insert({
              paciente_id: data.id,
              dia_semana: horario.dia_semana,
              // 🔧 CORRECCIÓN: NO convertir la hora - guardar directamente
              hora_inicio: horario.hora_inicio  // Era: convertirFechaParaGuardar(horario.hora_inicio)
            })
            .select()
            .single();

          if (horarioError) throw horarioError;
          horariosInsertados.push(horarioInsertado);
        }

        if (formData.activo && horariosInsertados.length > 0) {
          console.log('🚀 Generando sesiones con función JS...');
          try {
            const resultado = await generarSesionsPacienteNuevo(data.id);
            console.log(`✅ ${resultado} sesiones generadas exitosamente`);
          } catch (sesionesError) {
            console.error('❌ Error generando sesiones:', sesionesError);
          }
        }

        setPacientes(prev => [...prev, {
          ...data,
          horarios: horariosInsertados.map(h => ({
            id: h.id,
            dia_semana: h.dia_semana,
            hora_inicio: h.hora_inicio
          }))
        }]);

        if (window.showToast) {
          window.showToast(`Paciente ${formData.nombre_apellido} agregado exitosamente`, 'success');
        }

      } else {
        console.log('=== EDITANDO PACIENTE ===');

        const itemToEdit = selectedItemParam || selectedItem;
        if (!itemToEdit?.id) {
          throw new Error('Paciente no encontrado para editar');
        }

        const { error: updateError } = await supabase
          .from('pacientes')
          .update({
            nombre_apellido: formData.nombre_apellido,
            nombre_apellido_tutor: formData.nombre_apellido_tutor,
            cuil: formData.cuil,
            precio_por_hora: formData.precio_por_hora,
            fecha_inicio: formData.fecha_inicio,
            activo: formData.activo,
            color: formData.color
          })
          .eq('id', itemToEdit.id);

        if (updateError) throw updateError;

        const cambiosPrecio = formData.precio_por_hora !== itemToEdit.precio_por_hora;
        const cambiosNombre = formData.nombre_apellido !== itemToEdit.nombre_apellido;
        const esReactivacion = !itemToEdit.activo && formData.activo;
        const esDesactivacion = itemToEdit.activo && !formData.activo;

        const horariosAntes = JSON.stringify((itemToEdit.horarios || []).map(h =>
          ({ dia_semana: h.dia_semana, hora_inicio: h.hora_inicio })
        ).sort());
        const horariosAhora = JSON.stringify((formData.horarios || []).map(h =>
          ({ dia_semana: h.dia_semana, hora_inicio: h.hora_inicio })
        ).sort());
        const hayCambiosHorarios = horariosAntes !== horariosAhora;

        if (esDesactivacion) {
          try {
            const resultado = await inactivarPacienteCompleto(itemToEdit.id);
            console.log('✅ Resultado inactivación:', resultado);
          } catch (inactivarError) {
            console.error('❌ Error inactivando:', inactivarError);
          }
        }

        if (esReactivacion) {
          if (hayCambiosHorarios) {
            try {
              const resultado = await gestionarHorariosPaciente(itemToEdit.id, formData.horarios || [], 'actualizar_completo');
              console.log('✅ Resultado gestión horarios:', resultado);
            } catch (horariosError) {
              console.error('❌ Error actualizando horarios:', horariosError);
            }
          }

          try {
            const resultado = await reactivarPacienteCompleto(itemToEdit.id);
            console.log('✅ Resultado reactivación:', resultado);
          } catch (reactivarError) {
            console.error('❌ Error reactivando:', reactivarError);
          }
        }

        if (hayCambiosHorarios && formData.activo && !esReactivacion) {
          try {
            console.log('🔄 EJECUTANDO: Gestión de horarios para paciente activo');
            // 🔧 CORRECCIÓN: Los horarios en formData.horarios ya vienen en formato correcto
            const resultado = await gestionarHorariosPaciente(itemToEdit.id, formData.horarios || [], 'actualizar_completo');
            console.log('✅ Resultado gestión horarios:', resultado);
          } catch (horariosError) {
            console.error('❌ Error gestionando horarios:', horariosError);
          }
        }


        // NUEVO: También gestionar horarios si NO hay reactivación/desactivación pero sí cambios de horarios
        if (hayCambiosHorarios && !esReactivacion && !esDesactivacion) {
          try {
            console.log('🔄 EJECUTANDO: Gestión de horarios por cambios directos');
            const resultado = await gestionarHorariosPaciente(itemToEdit.id, formData.horarios || [], 'actualizar_completo');
            console.log('✅ Resultado gestión horarios directos:', resultado);
          } catch (horariosError) {
            console.error('❌ Error gestionando horarios directos:', horariosError);
          }
        }

        if (cambiosPrecio && !esReactivacion && !esDesactivacion && !hayCambiosHorarios) {
          try {
            const resultado = await actualizarPreciosFuturosPaciente(itemToEdit.id, formData.precio_por_hora);
            console.log('✅ Resultado actualización precios:', resultado);
          } catch (preciosError) {
            console.error('❌ Error actualizando precios:', preciosError);
          }
        }

        if (cambiosNombre) {
          try {
            const resultado = await actualizarNombrePacienteEnSesiones(itemToEdit.id, formData.nombre_apellido);
            console.log('✅ Resultado actualización nombre:', resultado);
          } catch (nombreError) {
            console.error('❌ Error actualizando nombre:', nombreError);
          }
        }

        const pacienteActualizado = {
          ...itemToEdit,
          ...formData,
          horarios: formData.horarios || []
        };

        setPacientes(prev => prev.map(p =>
          p.id === itemToEdit.id ? pacienteActualizado : p
        ));

        if (window.showToast) {
          window.showToast(`Paciente ${formData.nombre_apellido} actualizado exitosamente`, 'success');
        }
      }

      await loadSesiones();
      closeModal();

    } catch (error) {
      console.error('Error saving patient:', error);
      handleError(error);
    }
  };

  const ejecutarGuardadoOtrosTipos = async (formData) => {
    if (modalType === 'add-supervisora') {
      const { data, error } = await supabase
        .from('supervisoras')
        .insert([formData])
        .select()
        .single();

      if (error) throw error;
      setSupervisoras(prev => [...prev, data]);

      if (window.showToast) {
        window.showToast(`Supervisora ${data.nombre_apellido} agregada exitosamente`, 'success');
      }

    } else if (modalType === 'edit-supervisora') {
      const { error } = await supabase
        .from('supervisoras')
        .update(formData)
        .eq('id', selectedItem.id);

      if (error) throw error;

      setSupervisoras(prev => prev.map(s =>
        s.id === selectedItem.id ? { ...s, ...formData } : s
      ));

    } else if (modalType === 'add-entrada') {
      const entradaData = {
        fecha: formData.fecha,
        paciente_id: formData.paciente_id,
        metodo: formData.metodo,
        monto_ars: parseFloat(formData.monto_ars),
        tipo_cambio: formData.tipo_cambio || tipoCambio,
        comprobante_url: formData.comprobante_url || null,
        facturado: formData.facturado || false,
        factura_url: formData.factura_url || null,
        factura_a_nombre: formData.factura_a_nombre || null,
        factura_cuil: formData.factura_cuil || null,
        facturador: formData.facturador || null
      };

      const { error } = await supabase
        .from('pagos_recibidos')
        .insert([entradaData]);

      if (error) throw error;

      if (window.showToast) {
        window.showToast('Entrada registrada exitosamente', 'success');
      }

    // 🚀 NUEVO: Handler para salidas desde desktop
    } else if (modalType === 'add-salida') {
      const salidaData = {
        fecha: formData.fecha,
        concepto: formData.concepto,
        destinatario: formData.destinatario,
        supervisora_id: formData.supervisora_id || null,
        metodo: formData.metodo,
        monto_ars: parseFloat(formData.monto_ars),
        tipo_cambio: formData.tipo_cambio || tipoCambio,
        comprobante_url: formData.comprobante_url || null,
        facturado: formData.facturado || false,
        factura_url: formData.factura_url || null
      };

      const { error } = await supabase
        .from('pagos_hechos')
        .insert([salidaData]);

      if (error) throw error;

      if (window.showToast) {
        window.showToast('Salida registrada exitosamente', 'success');
      }

    } else if (modalType === 'add-sesion') {
      console.log('=== CREANDO NUEVA SESIÓN ===');
      console.log('FormData recibido:', formData);

      const sesionData = {
        ...formData,
        // 🔧 CORRECCIÓN: NO convertir fecha si ya viene en formato datetime-local correcto
        fecha_hora: convertirFechaParaGuardar(formData.fecha_hora),

        auto_generada: false,
        modificada_manualmente: false,
        eliminado: false
      };

      // 🔧 CORRECCIÓN: Asegurar que campos null sean realmente null (no undefined)
      if (!sesionData.paciente_id) sesionData.paciente_id = null;
      if (!sesionData.supervisora_id) sesionData.supervisora_id = null;
      if (!sesionData.supervisora_acompanante_id) sesionData.supervisora_acompanante_id = null;

      console.log('Datos finales para insertar:', sesionData);

      const { data, error } = await supabase
        .from('sesiones')
        .insert([sesionData])
        .select()
        .single();

      if (error) throw error;

      setSesiones(prev => [...prev, data]);

      if (window.showToast) {
        window.showToast(`${formData.tipo_sesion} agregada exitosamente`, 'success');
      }

      // Y también para 'edit-sesion':
    } else if (modalType === 'edit-sesion') {
      console.log('=== EDITANDO SESIÓN ===');

      // 🔧 CORRECCIÓN: NO usar convertirFechaParaGuardar
      const fechaConvertida = convertirFechaParaGuardar(formData.fecha_hora);


      const fechaOriginal = selectedItem.fecha_hora;

      const fechaOrg = new Date(fechaOriginal);
      const fechaNueva = new Date(fechaConvertida);
      const diferencia = Math.abs(fechaNueva.getTime() - fechaOrg.getTime());
      const seCambioFechaHora = diferencia > 60000;

      const updateData = {
        ...formData,
        fecha_hora: fechaConvertida,
        modificada_manualmente: seCambioFechaHora ? true : (selectedItem.modificada_manualmente || false)
      };

      // 🔧 CORRECCIÓN: Asegurar que campos null sean realmente null
      if (!updateData.paciente_id) updateData.paciente_id = null;
      if (!updateData.supervisora_id) updateData.supervisora_id = null;
      if (!updateData.supervisora_acompanante_id) updateData.supervisora_acompanante_id = null;

      const { error } = await supabase
        .from('sesiones')
        .update(updateData)
        .eq('id', selectedItem.id);

      if (error) throw error;
      setSesiones(prev => prev.map(s =>
        s.id === selectedItem.id ? { ...s, ...updateData } : s
      ));

      if (formData.estado !== selectedItem.estado) {
        const hoy = new Date();
        const esPasada = new Date(selectedItem.fecha_hora) < hoy;
        const eraPendiente = selectedItem.estado === 'Pendiente';
        const esAhoraPendiente = formData.estado === 'Pendiente';

        if (esPasada && eraPendiente && !esAhoraPendiente) {
          setSesionsPendientes(prev => Math.max(0, prev - 1));
        } else if (esPasada && !eraPendiente && esAhoraPendiente) {
          setSesionsPendientes(prev => prev + 1);
        }
      }

      if (window.showToast) {
        window.showToast('Sesión actualizada exitosamente', 'success');
      }
    }

    closeModal();
  };

  const handleError = (error) => {
    let errorMessage = 'Error al guardar los datos';
    if (error.message) {
      errorMessage += ': ' + error.message;
    }
    if (error.details) {
      errorMessage += ' - ' + error.details;
    }
    alert(errorMessage);
  };

  // FUNCIÓN PRINCIPAL CON VALIDACIÓN DE CONFLICTOS
  const handleModalSave = async (formData) => {
    try {
      console.log('Guardando con verificación de conflictos:', { modalType, formData });

      // Validar conflictos solo para sesiones (si la función existe)
      if ((modalType === 'add-sesion' || modalType === 'edit-sesion') && typeof verificarConflictoHorario === 'function') {
        const fechaHoraParaValidar = convertirFechaParaGuardar(formData.fecha_hora);
        const excluirId = modalType === 'edit-sesion' ? selectedItem?.id : null;

        console.log('Validando conflicto para sesión...');
        const resultadoConflicto = await verificarConflictoHorario(
          fechaHoraParaValidar,
          formData.duracion_horas || 1.0,
          excluirId
        );

        if (resultadoConflicto && resultadoConflicto.hayConflicto) {
          console.log('⚠️ Conflicto detectado:', resultadoConflicto);

          setConflictoDetectado(resultadoConflicto);
          setSesionConConflicto(formData);
          setShowConflictoModal(true);
          return;
        }
      }

      await procederConGuardadoNormal(formData);

    } catch (error) {
      console.error('Error en guardado con validación de conflictos:', error);
      handleError(error);
    }
  };

  const handleEliminarSesion = async (sesion) => {
    try {
      const { error } = await supabase
        .from('sesiones')
        .update({ eliminado: true })
        .eq('id', sesion.id);

      if (error) throw error;

      setSesiones(prev => prev.filter(s => s.id !== sesion.id));

      if (sesion.estado === 'Pendiente' && new Date(sesion.fecha_hora) < new Date()) {
        setSesionsPendientes(prev => Math.max(0, prev - 1));
      }

      if (window.showToast) {
        window.showToast(
          `Sesión de ${sesion.tipo_sesion} eliminada`,
          'success',
          5000,
          async () => {
            try {
              const { error: undoError } = await supabase
                .from('sesiones')
                .update({ eliminado: false })
                .eq('id', sesion.id);

              if (undoError) throw undoError;

              await loadSesiones();

              if (window.showToast) {
                window.showToast('Sesión restaurada', 'success', 3000);
              }
            } catch (undoError) {
              console.error('Error al deshacer:', undoError);
            }
          }
        );
      }

    } catch (error) {
      console.error('Error al eliminar sesión:', error);
      if (window.showToast) {
        window.showToast('Error al eliminar la sesión: ' + error.message, 'error');
      }
    }
  };

  const handleNuevaSesionMobile = () => {
    setMobileModalOpen(true);
  };

  // 🚀 NUEVO: Handlers para modales mobile de entradas y salidas
  const handleNuevaEntradaMobile = () => {
    console.log('🔍 Abriendo modal entrada mobile');
    setMobileModalEntradaOpen(true);
  };

  const handleNuevaSalidaMobile = () => {
    console.log('🔍 Abriendo modal salida mobile');
    setMobileModalSalidaOpen(true);
  };

  const handleMobileSave = async (formData) => {
    await handleModalSave(formData);
    setMobileModalOpen(false);
  };

  // 🚀 NUEVO: Handlers para guardar desde modales mobile
  const handleMobileEntradaSave = async (formData) => {
    try {
      const entradaData = {
        fecha: formData.fecha,
        paciente_id: formData.paciente_id,
        metodo: formData.metodo,
        monto_ars: parseFloat(formData.monto_ars),
        tipo_cambio: formData.tipo_cambio || tipoCambio,
        comprobante_url: formData.comprobante_url || null,
        facturado: formData.facturado || false,
        factura_url: formData.factura_url || null,
        factura_a_nombre: formData.factura_a_nombre || null,
        factura_cuil: formData.factura_cuil || null,
        facturador: formData.facturador || null
      };

      const { error } = await supabase
        .from('pagos_recibidos')
        .insert([entradaData]);

      if (error) throw error;

      if (window.showToast) {
        window.showToast('Entrada registrada exitosamente', 'success');
      }

      setMobileModalEntradaOpen(false);
    } catch (error) {
      console.error('Error guardando entrada mobile:', error);
      if (window.showToast) {
        window.showToast('Error al guardar entrada: ' + error.message, 'error');
      }
    }
  };

  const handleMobileSalidaSave = async (formData) => {
    try {
      const salidaData = {
        fecha: formData.fecha,
        concepto: formData.concepto,
        destinatario: formData.destinatario,
        supervisora_id: formData.supervisora_id || null,
        metodo: formData.metodo,
        monto_ars: parseFloat(formData.monto_ars),
        tipo_cambio: formData.tipo_cambio || tipoCambio,
        comprobante_url: formData.comprobante_url || null,
        facturado: formData.facturado || false,
        factura_url: formData.factura_url || null
      };

      const { error } = await supabase
        .from('pagos_hechos')
        .insert([salidaData]);

      if (error) throw error;

      if (window.showToast) {
        window.showToast('Salida registrada exitosamente', 'success');
      }

      setMobileModalSalidaOpen(false);
    } catch (error) {
      console.error('Error guardando salida mobile:', error);
      if (window.showToast) {
        window.showToast('Error al guardar salida: ' + error.message, 'error');
      }
    }
  };


  const handleCategorizacionMasiva = async (cambios) => {
    try {
      for (const cambio of cambios) {
        const { error } = await supabase
          .from('sesiones')
          .update({ estado: cambio.estado })
          .eq('id', cambio.id);

        if (error) {
          console.error('Error updating session:', cambio.id, error);
          throw error;
        }
      }

      setSesiones(prev => prev.map(sesion => {
        const cambio = cambios.find(c => c.id === sesion.id);
        return cambio ? { ...sesion, estado: cambio.estado } : sesion;
      }));

      const hoy = new Date();
      const nuevasPendientes = sesiones.filter(s => {
        const cambio = cambios.find(c => c.id === s.id);
        const estadoFinal = cambio ? cambio.estado : s.estado;
        return estadoFinal === 'Pendiente' && new Date(s.fecha_hora) < hoy;
      }).length;

      setSesionsPendientes(Math.max(0, nuevasPendientes - cambios.length));

      // 🚀 NUEVO: Actualizar timestamp para sidebar
      setLastUpdateTimestamp(Date.now());

    } catch (error) {
      console.error('Error al categorizar sesiones:', error);
      alert('Error al categorizar sesiones: ' + error.message);
    }
  };

  const loadSesiones = async () => {
    try {
      const fechaInicio = new Date();
      fechaInicio.setMonth(fechaInicio.getMonth() - 3);

      const { data, error } = await supabase
        .from('sesiones')
        .select('*')
        .eq('eliminado', false)
        .gte('fecha_hora', fechaInicio.toISOString())
        .order('fecha_hora');

      if (error) throw error;
      setSesiones(data || []);

      const pendientes = (data || []).filter(s =>
        s.estado === 'Pendiente' && new Date(s.fecha_hora) < new Date() && !s.eliminado
      ).length;
      setSesionsPendientes(pendientes);

    } catch (error) {
      console.error('Error loading sesiones:', error);
    }
  };

  const renderCurrentView = () => {
    // Para mobile, usar vistas específicas
    if (isMobile) {
      switch (activeView) {
        case 'entradas':
          return (
            <EntradasMobile
              sesiones={sesiones}
              pacientes={pacientes}
              formatCurrency={formatCurrency}
              currencyMode={currencyMode}
              tipoCambio={tipoCambio}
            />
          );
        case 'salidas':
          return (
            <SalidasMobile
              sesiones={sesiones}
              supervisoras={supervisoras}
              alquilerConfig={alquilerConfig}
              formatCurrency={formatCurrency}
            />
          );
        case 'dashboard':
          return (
            <DashboardMobile
              sesiones={sesiones}
              pacientes={pacientes}
              supervisoras={supervisoras}
              alquilerConfig={alquilerConfig}
              formatCurrency={formatCurrency}
            />
          );
        case 'calendario':
          // El calendario mobile se maneja por separado más abajo
          return null;
        default:
          // Para otras vistas, usar las vistas desktop normales
          break;
      }
    }

    // Vistas desktop normales (CÓDIGO EXISTENTE - NO CAMBIAR)
    switch (activeView) {
      case 'dashboard':
        return (
          <DashboardView
            currencyMode={currencyMode}
            tipoCambio={tipoCambio}
          />
        );
      case 'calendario':
        return (
          <CalendarioView
            sesiones={sesiones}
            pacientes={pacientes}
            supervisoras={supervisoras}
            openModal={openModal}
            currencyMode={currencyMode}
            tipoCambio={tipoCambio}
            onEliminarSesion={handleEliminarSesion}
          />
        );
      case 'pacientes':
        return (
          <PacientesView
            pacientes={pacientes}
            setPacientes={setPacientes}
            openModal={openModal}
            currencyMode={currencyMode}
            tipoCambio={tipoCambio}
          />
        );
      case 'coordinadoras':
        return (
          <SupervisorasView
            supervisoras={supervisoras}
            setSupervisoras={setSupervisoras}
            openModal={openModal}
            currencyMode={currencyMode}
            tipoCambio={tipoCambio}
          />
        );
      case 'facturar':
        return (
          <FacturarView
            pacientes={pacientes}
            supervisoras={supervisoras}
            currencyMode={currencyMode}
            tipoCambio={tipoCambio}
            alquilerConfig={alquilerConfig}
            openModal={openModal}
          />
        );
      case 'alquiler':
        return (
          <AlquilerView
            currencyMode={currencyMode}
            tipoCambio={tipoCambio}
          />
        );
      case 'entradas':
        return (
          <EntradaSView
            pacientes={pacientes}
            currencyMode={currencyMode}
            tipoCambio={tipoCambio}
          />
        );
      case 'salidas':
        return (
          <SalidasView
            supervisoras={supervisoras}
            currencyMode={currencyMode}
            tipoCambio={tipoCambio}
            alquilerConfig={alquilerConfig}
          />
        );
      default:
        return (
          <div className="glass-effect p-6 rounded-xl">
            <h3 className="text-xl font-bold mb-4">Vista no encontrada</h3>
            <p className="text-gray-600">La vista solicitada no existe.</p>
          </div>
        );
    }
  };

  // 🚀 NUEVO: Verificar autenticación primero
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-purple-50">
        <div className="text-center p-8">
          <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-6"></div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Verificando acceso...</h1>
          <p className="text-gray-600">Cargando autenticación segura</p>
        </div>
      </div>
    );
  }

  // 🚀 NUEVO: Si no hay usuario logueado, mostrar login
  if (!user) {
    return <LoginForm />;
  }

  // 🚀 MANTENER: Loading normal de la app (el que ya tenías)
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-purple-50">
        <div className="text-center p-8">
          <div className="relative mb-8">
            <div className="w-24 h-24 mx-auto mb-4 relative">
              <img
                src="/jel.png"
                alt="JEL Organizador"
                className="w-full h-full object-contain"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextElementSibling.style.display = 'flex';
                }}
              />
              <div className="w-full h-full bg-gradient-to-br from-purple-500 to-purple-700 rounded-2xl flex items-center justify-center text-white text-3xl font-bold shadow-lg hidden">
                JEL
              </div>
            </div>
            <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-6"></div>
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">JEL Organizador</h1>
          <p className="text-lg text-purple-600 font-medium mb-4">Cargando sistema de Victoria...</p>
          <p className="text-sm text-gray-500">Preparando sesiones, pacientes y facturación</p>
          <div className="w-64 h-2 bg-gray-200 rounded-full mx-auto mt-6 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-purple-500 to-purple-700 rounded-full animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-purple-50 via-white to-purple-50">
      {/* 🚀 Sidebar con clases responsive */}
      <div className={`${isMobile ? 'fixed left-0 top-0 h-full z-40 transform transition-transform duration-300 ease-in-out' : ''} ${isMobile ? (sidebarMobileOpen ? 'translate-x-0' : '-translate-x-full') : ''
        }`}>
        <Sidebar
          activeView={activeView}
          setActiveView={setActiveView}
          currencyMode={currencyMode}
          setCurrencyMode={setCurrencyMode}
          tipoCambio={tipoCambio}
          sesionsPendientes={sesionsPendientes}
          sesiones={sesiones}
          supervisoras={supervisoras}
          alquilerConfig={alquilerConfig}
          lastUpdateTimestamp={lastUpdateTimestamp}
          onCloseMobile={() => setSidebarMobileOpen(false)}
        />
      </div>

      {/* 🚀 Overlay para cerrar sidebar en mobile */}
      <SidebarOverlay
        isOpen={sidebarMobileOpen}
        onClose={() => setSidebarMobileOpen(false)}
      />

      <div className="main-content-adjusted flex-1 flex flex-col min-h-screen">
        {/* 🚀 Header mobile CON CONTEXTO */}
        {isMobile && (
          <MobileHeader
            onToggleSidebar={() => setSidebarMobileOpen(!sidebarMobileOpen)}
            gananciaNeta={calcularGananciaNeta()}
            sesionsPendientes={sesionsPendientes}
            formatCurrency={formatCurrency}
            onCategorizarSesiones={() => openModal('categorizar-sesiones')}
            onNuevaSesion={handleNuevaSesionMobile}
            // 🚀 NUEVO: Pasar contexto y handlers específicos
            context={activeView}
            onNuevaEntrada={handleNuevaEntradaMobile}
            onNuevaSalida={handleNuevaSalidaMobile}
          />
        )}

        {/* Header desktop normal */}
        {!isMobile && (
          <Header
            activeView={activeView}
            pacientes={pacientes}
            openModal={openModal}
            currentDate={new Date()}
          />
        )}

        <main className="flex-1 p-6 overflow-y-auto">
          {/* 🚀 Usar CalendarioMobile en mobile, normal en desktop */}
          {activeView === 'calendario' && isMobile ? (
            <CalendarioMobile
              sesiones={sesiones}
              pacientes={pacientes}
              supervisoras={supervisoras}
              onEditarSesion={(sesion) => openModal('edit-sesion', sesion)}
              onCategorizarSesion={handleCategorizarSesionRapida}
              formatCurrency={formatCurrency}
              onCategorizarSesiones={() => openModal('categorizar-sesiones')}
              onFechaChange={setFechaDelCalendario}
            />
          ) : (
            renderCurrentView()
          )}
        </main>
      </div>

      <Modal
        isOpen={showModal && modalType !== 'categorizar-sesiones' && modalType !== 'day-detail'}
        onClose={closeModal}
        type={modalType}
        data={selectedItem}
        pacientes={pacientes}
        supervisoras={supervisoras}
        onSave={handleModalSave}
        currencyMode={currencyMode}
        tipoCambio={tipoCambio}
        fechaPrecargada={fechaPrecargada}
      />

      <CategorizarModal
        isOpen={showModal && modalType === 'categorizar-sesiones'}
        onClose={closeModal}
        sesiones={sesiones}
        pacientes={pacientes}
        supervisoras={supervisoras}
        onSave={handleCategorizacionMasiva}
        currencyMode={currencyMode}
        tipoCambio={tipoCambio}
      />

      <DayDetailModal
        isOpen={showModal && modalType === 'day-detail'}
        onClose={closeModal}
        fecha={selectedItem?.fecha}
        sesiones={selectedItem?.sesiones || []}
        pacientes={pacientes}
        supervisoras={supervisoras}
        onEditarSesion={(sesion) => openModal('edit-sesion', sesion)}
        onEliminarSesion={handleEliminarSesion}
        onCategorizarSesion={handleCategorizarSesionRapida}
        onNuevaSesion={handleNuevaSesionConFecha}
        currencyMode={currencyMode}
        tipoCambio={tipoCambio}
      />

      <ConfirmacionCambiosModal
        isOpen={showConfirmacionModal}
        onClose={cancelarCambiosPaciente}
        onConfirm={confirmarCambiosPaciente}
        cambiosDetectados={cambiosDetectados}
        pacienteNombre={selectedItemPendiente?.nombre_apellido || ''}
      />

      <ConflictoHorarioModal
        isOpen={showConflictoModal}
        onClose={cancelarCreacionPorConflicto}
        onConfirmar={confirmarCreacionConConflicto}
        conflictoDetectado={conflictoDetectado}
        sesionNueva={sesionConConflicto}
      />

      <ToastSystem />
      
      {/* Bottom Navigation para mobile */}
      {isMobile && (
        <BottomNavigation
          activeView={activeView}
          setActiveView={setActiveView}
          sesionsPendientes={sesionsPendientes}
        />
      )}

      {/* 🚀 NUEVO: Modal Mobile para agregar sesiones */}
      <MobileModal
        isOpen={mobileModalOpen}
        onClose={() => setMobileModalOpen(false)}
        pacientes={pacientes}
        supervisoras={supervisoras}
        onSave={handleMobileSave}
        fechaPrecargada={fechaDelCalendario}
      />

      {/* 🚀 NUEVO: Modales Mobile para entradas y salidas */}
      <MobileModalEntrada
        isOpen={mobileModalEntradaOpen}
        onClose={() => setMobileModalEntradaOpen(false)}
        pacientes={pacientes}
        onSave={handleMobileEntradaSave}
        tipoCambio={tipoCambio}
      />

      <MobileModalSalida
        isOpen={mobileModalSalidaOpen}
        onClose={() => setMobileModalSalidaOpen(false)}
        supervisoras={supervisoras}
        alquilerConfig={alquilerConfig}
        onSave={handleMobileSalidaSave}
        tipoCambio={tipoCambio}
      />

      <ToastSystem />
    </div>
  );
};

export default App;