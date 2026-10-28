import { canTransition, processType, processes } from '../../src/desk/process-rules';
import { suggestIncidentCategory } from '../../src/desk/incident-rules';

describe('Reglas de Service Desk', () => {
  it('mapea exactamente siete procesos a tipos de ticket admitidos', () => {
    expect(processes).toHaveLength(7);
    expect(processType).toEqual({
      NEW_SERVICE:'SERVICE_REQUEST',CHANGE:'CHANGE',INCIDENT:'INCIDENT',EVENT:'EVENT',
      PROBLEM:'PROBLEM',ACCESS:'ACCESS',TECH_SERVICE:'SERVICE_REQUEST',
    });
  });

  it('impide ejecutar cambios sin pasar por planificación', () => {
    expect(canTransition('CHANGE','SUBMITTED','EXECUTING')).toBe(false);
    expect(canTransition('CHANGE','APPROVED','PLANNED')).toBe(true);
    expect(canTransition('CHANGE','PLANNED','EXECUTING')).toBe(true);
  });

  it('distingue rutas de evento, acceso y problema', () => {
    expect(canTransition('EVENT','SUBMITTED','CLOSED')).toBe(true);
    expect(canTransition('EVENT','CLASSIFIED','EVALUATED')).toBe(true);
    expect(canTransition('ACCESS','PENDING_APPROVAL','APPROVED')).toBe(true);
    expect(canTransition('PROBLEM','INVESTIGATING','KNOWN_ERROR')).toBe(true);
    expect(canTransition('INCIDENT','SUBMITTED','APPROVED')).toBe(false);
  });

  it('aplica como decisión del proyecto el intervalo más corto en los rótulos solapados', () => {
    const cases: Array<[number,string]> = [[180,'I1'],[181,'I2'],[480,'I2'],[481,'I3'],
      [2880,'I3'],[2881,'I4'],[10080,'I4']];
    for (const [estimatedMinutes,category] of cases) {
      const result = suggestIncidentCategory({securityImpact:false,interruptsOrDegrades:true,estimatedMinutes});
      expect(result).toEqual({category,rule:'PROJECT_SHORTEST_MATCH'});
    }
  });

  it('marca como regla del proyecto el vacío de 7 a 30 días', () => {
    const result = suggestIncidentCategory({securityImpact:false,interruptsOrDegrades:true,estimatedMinutes:10081});
    expect(result).toEqual({category:'I4',rule:'PROJECT_GAP_RULE_7_TO_30_DAYS'});
    expect(suggestIncidentCategory({securityImpact:false,interruptsOrDegrades:true,estimatedMinutes:43199}))
      .toEqual({category:'I4',rule:'PROJECT_GAP_RULE_7_TO_30_DAYS'});
    expect(suggestIncidentCategory({securityImpact:false,interruptsOrDegrades:true,estimatedMinutes:43200}))
      .toEqual({category:'I5',rule:'PROJECT_30_DAY_MONTH_THRESHOLD'});
    expect(suggestIncidentCategory({securityImpact:false,interruptsOrDegrades:true,estimatedMinutes:0}).rule).toBe('MANUAL_REVIEW');
  });

  it('prioriza seguridad y distingue ausencia de interrupción', () => {
    expect(suggestIncidentCategory({securityImpact:true,interruptsOrDegrades:false,estimatedMinutes:null}).category).toBe('I6');
    expect(suggestIncidentCategory({securityImpact:false,interruptsOrDegrades:false,estimatedMinutes:null}).category).toBe('I0');
    expect(suggestIncidentCategory({securityImpact:false,interruptsOrDegrades:true,estimatedMinutes:null}).rule).toBe('MANUAL_REVIEW');
  });
});
