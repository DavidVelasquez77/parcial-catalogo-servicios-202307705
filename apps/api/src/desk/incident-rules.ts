export const incidentLabels: Record<string,string> = {
  I0: 'No causa interrupción',
  I1: 'Hasta 3 horas, incluidas degradaciones',
  I2: 'Hasta 8 horas, incluidas degradaciones',
  I3: 'Hasta 2 días',
  I4: 'Hasta 1 semana',
  I5: '1 mes o más',
  I6: 'Seguridad de recursos o información',
};

export function suggestIncidentCategory(input: {
  securityImpact: boolean;
  interruptsOrDegrades: boolean;
  estimatedMinutes: number | null;
}) {
  if (input.securityImpact) return { category: 'I6', rule: 'LECCION_25_SECURITY' };
  if (!input.interruptsOrDegrades) return { category: 'I0', rule: 'LECCION_25_NO_INTERRUPTION' };
  const minutes = input.estimatedMinutes;
  if (minutes === null || !Number.isFinite(minutes) || minutes < 0) {
    return { category: null, rule: 'MANUAL_REVIEW' };
  }
  if (minutes <= 180) return { category: 'I1', rule: 'LECCION_25_SHORTEST_MATCH' };
  if (minutes <= 480) return { category: 'I2', rule: 'LECCION_25_SHORTEST_MATCH' };
  if (minutes <= 2880) return { category: 'I3', rule: 'LECCION_25_SHORTEST_MATCH' };
  if (minutes <= 10080) return { category: 'I4', rule: 'LECCION_25_SHORTEST_MATCH' };
  if (minutes < 43200) return { category: 'I4', rule: 'PROJECT_GAP_RULE_7_TO_30_DAYS' };
  return { category: 'I5', rule: 'LECCION_25_MONTH_OR_MORE' };
}
