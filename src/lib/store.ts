import { useCallback, useEffect, useState } from 'react';
import { demoScenario, DEMO_ID } from '../data/demo';
import type { Scenario } from '../engine';
import { uid } from './format';

const KEY = 'pacto:v1';

interface State {
  scenarios: Scenario[];
  activeId: string;
}

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as State;
      if (s.scenarios?.length) return s;
    }
  } catch {
    // Sin almacenamiento disponible: se arranca con la demo.
  }
  return { scenarios: [demoScenario()], activeId: DEMO_ID };
}

export function blankScenario(): Scenario {
  const a = uid();
  const b = uid();
  return {
    id: uid(),
    name: 'Nuevo escenario',
    company: 'Mi startup, S.L.',
    holders: [
      { id: a, name: 'Fundador/a 1', role: 'fundador' },
      { id: b, name: 'Fundador/a 2', role: 'fundador' },
      { id: 'pool', name: 'Pool de opciones', role: 'pool' },
    ],
    events: [{
      id: uid(), type: 'constitucion', name: 'Constitución', date: new Date().toISOString().slice(0, 10),
      holdings: [{ holderId: a, shares: 5000 }, { holderId: b, shares: 5000 }],
    }],
    governance: {
      votoPlural: 1,
      sindicacion: false,
      vetoMatters: [
        { id: uid(), name: 'Aprobar cuentas y nombrar administradores', threshold: 0.5 },
        { id: uid(), name: 'Fusión, escisión o transformación', threshold: 2 / 3 },
      ],
    },
    vesting: [],
  };
}

export function useScenarios() {
  const [state, setState] = useState<State>(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      // Almacenamiento lleno o bloqueado: los cambios viven solo en esta pestaña.
    }
  }, [state]);

  const active = state.scenarios.find((s) => s.id === state.activeId) ?? state.scenarios[0];

  const mutate = useCallback((fn: (draft: Scenario) => void) => {
    setState((st) => ({
      ...st,
      scenarios: st.scenarios.map((s) => {
        if (s.id !== st.activeId) return s;
        const draft = structuredClone(s);
        fn(draft);
        return draft;
      }),
    }));
  }, []);

  const select = (id: string) => setState((st) => ({ ...st, activeId: id }));
  const create = (s: Scenario = blankScenario()) =>
    setState((st) => ({ scenarios: [...st.scenarios, s], activeId: s.id }));
  const remove = (id: string) =>
    setState((st) => {
      const rest = st.scenarios.filter((s) => s.id !== id);
      const scenarios = rest.length ? rest : [demoScenario()];
      return { scenarios, activeId: scenarios[0].id };
    });
  const resetDemo = () =>
    setState((st) => {
      const others = st.scenarios.filter((s) => s.id !== DEMO_ID);
      return { scenarios: [demoScenario(), ...others], activeId: DEMO_ID };
    });

  return { scenarios: state.scenarios, active, mutate, select, create, remove, resetDemo };
}
