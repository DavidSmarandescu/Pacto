import { useMemo, useRef, useState } from 'react';
import { computeScenario, type Scenario } from './engine';
import { holderColors } from './lib/colors';
import { useScenarios } from './lib/store';
import { uid } from './lib/format';
import Resumen from './views/Resumen';
import Operaciones from './views/Operaciones';
import Salida from './views/Salida';
import Control from './views/Control';
import Vesting from './views/Vesting';
import Precios from './views/Precios';

const TABS = [
  { id: 'resumen', label: 'Cap table' },
  { id: 'control', label: 'Control' },
  { id: 'operaciones', label: 'Operaciones' },
  { id: 'salida', label: 'Salida' },
  { id: 'vesting', label: 'Vesting' },
  { id: 'precios', label: 'Precios' },
] as const;
type Tab = (typeof TABS)[number]['id'];

function readTab(): Tab {
  try {
    const t = localStorage.getItem('pacto:tab') as Tab | null;
    if (t && TABS.some((x) => x.id === t)) return t;
  } catch {
    // ignorado
  }
  return 'resumen';
}

export default function App() {
  const store = useScenarios();
  const { active: s, mutate } = store;
  const [tab, setTabState] = useState<Tab>(readTab);
  const fileRef = useRef<HTMLInputElement>(null);
  const res = useMemo(() => computeScenario(s), [s]);
  const colors = useMemo(() => holderColors(s.holders), [s.holders]);

  const setTab = (t: Tab) => {
    setTabState(t);
    try {
      localStorage.setItem('pacto:tab', t);
    } catch {
      // ignorado
    }
    document.getElementById('app')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(s, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${s.name.replace(/[^\w-]+/g, '_')}.pacto.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importJson = async (f: File) => {
    try {
      const data = JSON.parse(await f.text()) as Scenario;
      if (!Array.isArray(data.events) || !Array.isArray(data.holders)) throw new Error('formato');
      store.create({ ...data, id: uid() });
    } catch {
      alert('El archivo no es un escenario de Pacto válido.');
    }
  };

  const props = { s, res, mutate, colors };

  return (
    <>
      <div className="bg-map" aria-hidden />
      <header className="topbar">
        <div className="wrap topbar-inner">
          <a className="logo" href="#" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
            <span className="logo-mark" aria-hidden><i /><i /></span>
            Pacto
          </a>
          <div className="scenario-bar">
            <select aria-label="Escenario" value={s.id} onChange={(e) => store.select(e.target.value)}>
              {store.scenarios.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
            <details className="menu">
              <summary aria-label="Opciones del escenario">⋯</summary>
              <div className="menu-pop">
                <button onClick={() => store.create()}>Nuevo escenario</button>
                <button onClick={() => store.create({ ...structuredClone(s), id: uid(), name: `${s.name} (copia)` })}>Duplicar</button>
                <button onClick={exportJson}>Exportar JSON</button>
                <button onClick={() => fileRef.current?.click()}>Importar JSON</button>
                <button onClick={() => window.print()}>Imprimir / PDF</button>
                <button onClick={store.resetDemo}>Restaurar demo</button>
                <button className="danger" onClick={() => confirm('¿Borrar este escenario?') && store.remove(s.id)}>Borrar escenario</button>
              </div>
            </details>
            <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} />
          </div>
        </div>
      </header>

      <section className="hero wrap">
        <p className="eyebrow">Cap table · Rondas · Control</p>
        <h1>Vende parte de tu startup <span className="grad">sin perder el control.</span></h1>
        <p className="lead">
          Pacto simula rondas, notas convertibles, pool de opciones y salidas, y separa lo que es tuyo en euros
          de lo que es tuyo en votos. Descubre cuánto pueden vender los fundadores sin perder la mayoría.
        </p>
        <div className="hero-cta">
          <button className="btn btn-primary" onClick={() => setTab('control')}>Abrir el simulador de control</button>
          <button className="btn btn-ghost" onClick={() => setTab('precios')}>Ver precios</button>
        </div>
      </section>

      <div id="app" className="wrap">
        <nav className="tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>

        <main className="view">
          {tab === 'resumen' && <Resumen {...props} />}
          {tab === 'control' && <Control {...props} />}
          {tab === 'operaciones' && <Operaciones {...props} />}
          {tab === 'salida' && <Salida {...props} />}
          {tab === 'vesting' && <Vesting {...props} />}
          {tab === 'precios' && <Precios />}
        </main>
      </div>

      <footer className="wrap footer">
        <p>
          <strong>Aviso legal:</strong> Pacto es una herramienta orientativa y no constituye asesoramiento jurídico, fiscal ni financiero.
          Las referencias a la Ley de Sociedades de Capital (LSC) son simplificaciones; consulta con un abogado antes de modificar estatutos o firmar un pacto de socios.
        </p>
        <p className="muted">Todo se calcula en tu navegador. Tus datos no salen de tu dispositivo.</p>
      </footer>
    </>
  );
}
