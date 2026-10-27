import { canTransition, processType, processes } from '../../src/desk/process-rules';
import { suggestIncidentCategory } from '../../src/desk/incident-rules';

describe('Reglas de Service Desk', () => {
  it('mapea exactamente siete procesos a tipos de ticket admitidos', () => {
    expect(processes).toHaveLength(7);
    expect(processType.NEW_SERVICE).toBe('SERVICE_REQUEST');
    expect(processType.TECH_SERVICE).toBe('SERVICE_REQUEST');
    expect(processType.EVENT).toBe('EVENT');
  });

  it('impide ejecutar cambios sin pasar por planificación', () => {
    expect(canTransition('CHANGE','SUBMITTED','EXECUTING')).toBe(false);
    expect(canTransition('CHANGE','APPROVED','PLANNED')).toBe(true);
    expect(canTransition('CHANGE','PLANNED','EXECUTING')).toBe(true);
  });

  it('distingue rutas de evento, acceso y problema', () => {
    expect(canTransition('EVENT','CLASSIFIED','EVALUATED')).toBe(true);
    expect(canTransition('ACCESS','PENDING_APPROVAL','APPROVED')).toBe(true);
    expect(canTransition('PROBLEM','INVESTIGATING','KNOWN_ERROR')).toBe(true);
    expect(canTransition('INCIDENT','SUBMITTED','APPROVED')).toBe(false);
  });

  it('clasifica las duraciones solapadas con el intervalo más corto', () => {
    expect(suggestIncidentCategory({securityImpact:false,interruptsOrDegrades:true,estimatedMinutes:180}).category).toBe('I1');
    expect(suggestIncidentCategory({securityImpact:false,interruptsOrDegrades:true,estimatedMinutes:181}).category).toBe('I2');
    expect(suggestIncidentCategory({securityImpact:false,interruptsOrDegrades:true,estimatedMinutes:480}).category).toBe('I2');
  });

  it('marca como regla del proyecto el vacío de 7 a 30 días', () => {
    const result = suggestIncidentCategory({securityImpact:false,interruptsOrDegrades:true,estimatedMinutes:10081});
    expect(result).toEqual({category:'I4',rule:'PROJECT_GAP_RULE_7_TO_30_DAYS'});
    expect(suggestIncidentCategory({securityImpact:false,interruptsOrDegrades:true,estimatedMinutes:43200}).category).toBe('I5');
  });

  it('prioriza seguridad y distingue ausencia de interrupción', () => {
    expect(suggestIncidentCategory({securityImpact:true,interruptsOrDegrades:false,estimatedMinutes:null}).category).toBe('I6');
    expect(suggestIncidentCategory({securityImpact:false,interruptsOrDegrades:false,estimatedMinutes:null}).category).toBe('I0');
    expect(suggestIncidentCategory({securityImpact:false,interruptsOrDegrades:true,estimatedMinutes:null}).rule).toBe('MANUAL_REVIEW');
  });
});
