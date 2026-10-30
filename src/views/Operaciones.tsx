import type { CapEvent, Holder, Scenario } from '../engine';
import { POOL_ID } from '../engine';
import { ROLE_LABEL } from '../lib/colors';
import { eur, eurPrecise, num, uid } from '../lib/format';
import { Card, Dot, Field, NumInput, Toggle } from '../components/ui';
import type { ViewProps } from './types';

const TYPE_LABEL: Record<CapEvent['type'], string> = {
  constitucion: 'Constitución',
  nota: 'Nota / préstamo convertible',
  ronda: 'Ronda',
  secundaria: 'Venta secundaria',
};

const today = () => new Date().toISOString().slice(0, 10);

export default function Operaciones({ s, res, mutate, colors }: ViewProps) {
  const people = s.holders.filter((h) => h.role !== 'pool');
  const investors = s.holders.filter((h) => h.role === 'inversor');
  const founders = s.holders.filter((h) => h.role === 'fundador');
  const used = new Set(JSON.stringify(s.events).match(/"(holderId|buyerId)":"([^"]+)"/g)?.map((m) => m.split('"')[3]) ?? []);

  const ev = <T extends CapEvent>(d: Scenario, id: string) => d.events.find((e) => e.id === id) as T;

  const addEvent = (type: CapEvent['type']) => mutate((d) => {
    const firstInv = d.holders.find((h) => h.role === 'inversor')?.id ?? newInvestor(d);
    const firstFounder = d.holders.find((h) => h.role === 'fundador')?.id ?? '';
    const base = { id: uid(), date: today() };
    if (type === 'nota') d.events.push({ ...base, type, name: 'Nota convertible', holderId: firstInv, amount: 100000, discount: 0.2, cap: 2000000 });
    if (type === 'ronda') d.events.push({ ...base, type, name: 'Nueva ronda', preMoney: 3000000, investments: [{ holderId: firstInv, amount: 500000 }], poolTargetPct: 0.1, poolTiming: 'pre', liqMultiple: 1, participating: false });
    if (type === 'secundaria') d.events.push({ ...base, type, name: 'Venta secundaria', sellers: [{ holderId: firstFounder, shares: 100 }], buyerId: firstInv, pricePerShare: 100, structure: 'sinVoto' });
  });

  const move = (i: number, dir: -1 | 1) => mutate((d) => {
    const j = i + dir;
    if (j < 1 || j >= d.events.length) return;
    [d.events[i], d.events[j]] = [d.events[j], d.events[i]];
  });

  const holderSelect = (value: string, onChange: (v: string) => void, list: Holder[] = people) => (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {list.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
    </select>
  );

  return (
    <div className="stack">
      <Card title="Socios" subtitle={`${s.company} · Los fundadores pueden tener voto plural y forman el bloque de control.`}
        actions={<input aria-label="Nombre de la empresa" value={s.company} onChange={(e) => mutate((d) => { d.company = e.target.value; })} />}>
        <ul className="holders">
          {s.holders.filter((h) => h.id !== POOL_ID).map((h) => (
            <li key={h.id}>
              <Dot color={colors[h.id]} />
              <input className="grow" aria-label="Nombre" value={h.name} onChange={(e) => mutate((d) => { d.holders.find((x) => x.id === h.id)!.name = e.target.value; })} />
              <select aria-label="Rol" value={h.role} onChange={(e) => mutate((d) => { d.holders.find((x) => x.id === h.id)!.role = e.target.value as Holder['role']; })}>
                {(['fundador', 'inversor', 'empleado'] as const).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
              <button className="icon" aria-label="Quitar socio" disabled={used.has(h.id)} title={used.has(h.id) ? 'Aparece en alguna operación' : 'Quitar'}
                onClick={() => mutate((d) => { d.holders = d.holders.filter((x) => x.id !== h.id); d.vesting = d.vesting.filter((v) => v.holderId !== h.id); })}>×</button>
            </li>
          ))}
        </ul>
        <div className="row wrap-row">
          <button className="btn btn-ghost" onClick={() => mutate((d) => { d.holders.splice(d.holders.length - 1, 0, { id: uid(), name: 'Nuevo fundador/a', role: 'fundador' }); })}>+ Fundador/a</button>
          <button className="btn btn-ghost" onClick={() => mutate((d) => { newInvestor(d); })}>+ Inversor</button>
        </div>
      </Card>

      <ol className="timeline">
        {s.events.map((e, i) => {
          const step = res.steps[i];
          return (
            <li key={e.id} className={`event event-${e.type}`}>
              <div className="event-head">
                <span className="tag">{TYPE_LABEL[e.type]}</span>
                <input className="event-name" aria-label="Nombre de la operación" value={e.name} onChange={(x) => mutate((d) => { ev(d, e.id).name = x.target.value; })} />
                <input type="date" aria-label="Fecha" value={e.date} onChange={(x) => mutate((d) => { ev(d, e.id).date = x.target.value; })} />
                {i > 0 && (
                  <span className="event-tools">
                    <button className="icon" aria-label="Subir" disabled={i === 1} onClick={() => move(i, -1)}>↑</button>
                    <button className="icon" aria-label="Bajar" disabled={i === s.events.length - 1} onClick={() => move(i, 1)}>↓</button>
                    <button className="icon" aria-label="Borrar" onClick={() => mutate((d) => { d.events = d.events.filter((x) => x.id !== e.id); })}>×</button>
                  </span>
                )}
              </div>

              {e.type === 'constitucion' && (
                <div className="lines">
                  {e.holdings.map((h, k) => (
                    <div className="line" key={k}>
                      {holderSelect(h.holderId, (v) => mutate((d) => { ev<typeof e>(d, e.id).holdings[k].holderId = v; }), founders.length ? [...founders, ...people.filter((p) => p.role !== 'fundador')] : people)}
                      <NumInput value={h.shares} suffix="part." onChange={(v) => mutate((d) => { ev<typeof e>(d, e.id).holdings[k].shares = Math.round(v); })} />
                      <button className="icon" aria-label="Quitar" onClick={() => mutate((d) => { ev<typeof e>(d, e.id).holdings.splice(k, 1); })}>×</button>
                    </div>
                  ))}
                  <button className="link" onClick={() => mutate((d) => { ev<typeof e>(d, e.id).holdings.push({ holderId: people[0]?.id ?? '', shares: 1000 }); })}>+ Añadir socio fundacional</button>
                </div>
              )}

              {e.type === 'nota' && (
                <div className="grid-4">
                  <Field label="Inversor">{holderSelect(e.holderId, (v) => mutate((d) => { ev<typeof e>(d, e.id).holderId = v; }))}</Field>
                  <Field label="Importe"><NumInput value={e.amount} suffix="€" step={1000} onChange={(v) => mutate((d) => { ev<typeof e>(d, e.id).amount = v; })} /></Field>
                  <Field label="Descuento"><NumInput value={e.discount} scale={100} max={95} suffix="%" onChange={(v) => mutate((d) => { ev<typeof e>(d, e.id).discount = Math.min(0.95, v); })} /></Field>
                  <Field label="Cap de valoración" hint="0 = sin cap"><NumInput value={e.cap} suffix="€" step={100000} onChange={(v) => mutate((d) => { ev<typeof e>(d, e.id).cap = v; })} /></Field>
                </div>
              )}

              {e.type === 'ronda' && (
                <>
                  <div className="grid-4">
                    <Field label="Valoración pre-money"><NumInput value={e.preMoney} suffix="€" step={100000} onChange={(v) => mutate((d) => { ev<typeof e>(d, e.id).preMoney = v; })} /></Field>
                    <Field label="Pool objetivo (post)"><NumInput value={e.poolTargetPct} scale={100} max={50} suffix="%" onChange={(v) => mutate((d) => { ev<typeof e>(d, e.id).poolTargetPct = Math.min(0.5, v); })} /></Field>
                    <Field label="Ampliación del pool">
                      <select value={e.poolTiming} onChange={(x) => mutate((d) => { ev<typeof e>(d, e.id).poolTiming = x.target.value as 'pre' | 'post'; })}>
                        <option value="pre">Antes de la ronda (pre-money)</option>
                        <option value="post">Después (diluye a todos)</option>
                      </select>
                    </Field>
                    <Field label="Preferencia de liquidación">
                      <span className="row">
                        <NumInput value={e.liqMultiple} step={0.5} suffix="x" onChange={(v) => mutate((d) => { ev<typeof e>(d, e.id).liqMultiple = v; })} />
                        <Toggle checked={e.participating} onChange={(v) => mutate((d) => { ev<typeof e>(d, e.id).participating = v; })} label="Participativa" />
                      </span>
                    </Field>
                  </div>
                  <div className="lines">
                    {e.investments.map((inv, k) => (
                      <div className="line" key={k}>
                        {holderSelect(inv.holderId, (v) => mutate((d) => { ev<typeof e>(d, e.id).investments[k].holderId = v; }), investors.length ? investors : people)}
                        <NumInput value={inv.amount} suffix="€" step={10000} onChange={(v) => mutate((d) => { ev<typeof e>(d, e.id).investments[k].amount = v; })} />
                        <button className="icon" aria-label="Quitar" onClick={() => mutate((d) => { ev<typeof e>(d, e.id).investments.splice(k, 1); })}>×</button>
                      </div>
                    ))}
                    <button className="link" onClick={() => mutate((d) => { ev<typeof e>(d, e.id).investments.push({ holderId: investors[0]?.id ?? newInvestor(d), amount: 100000 }); })}>+ Añadir inversor a la ronda</button>
                  </div>
                </>
              )}

              {e.type === 'secundaria' && (
                <>
                  <div className="grid-4">
                    <Field label="Comprador">{holderSelect(e.buyerId, (v) => mutate((d) => { ev<typeof e>(d, e.id).buyerId = v; }))}</Field>
                    <Field label="Precio por participación"><NumInput value={e.pricePerShare} suffix="€" onChange={(v) => mutate((d) => { ev<typeof e>(d, e.id).pricePerShare = v; })} /></Field>
                    <Field label="Se transmiten como">
                      <select value={e.structure} onChange={(x) => mutate((d) => { ev<typeof e>(d, e.id).structure = x.target.value as 'ordinarias' | 'sinVoto'; })}>
                        <option value="ordinarias">Ordinarias (con voto)</option>
                        <option value="sinVoto">Sin voto</option>
                      </select>
                    </Field>
                  </div>
                  <div className="lines">
                    {e.sellers.map((sl, k) => (
                      <div className="line" key={k}>
                        {holderSelect(sl.holderId, (v) => mutate((d) => { ev<typeof e>(d, e.id).sellers[k].holderId = v; }))}
                        <NumInput value={sl.shares} suffix="part." onChange={(v) => mutate((d) => { ev<typeof e>(d, e.id).sellers[k].shares = Math.round(v); })} />
                        <button className="icon" aria-label="Quitar" onClick={() => mutate((d) => { ev<typeof e>(d, e.id).sellers.splice(k, 1); })}>×</button>
                      </div>
                    ))}
                    <button className="link" onClick={() => mutate((d) => { ev<typeof e>(d, e.id).sellers.push({ holderId: founders[0]?.id ?? people[0]?.id ?? '', shares: 100 }); })}>+ Añadir vendedor</button>
                  </div>
                </>
              )}

              {step && (step.pricePerShare !== undefined && e.type === 'ronda' || step.sold !== undefined || step.warnings.length > 0) && (
                <div className="event-result">
                  {e.type === 'ronda' && step.pricePerShare !== undefined && (
                    <>
                      <span>Precio: <strong>{eurPrecise(step.pricePerShare)}</strong></span>
                      <span>Post-money: <strong>{eur(step.postMoney ?? 0)}</strong></span>
                      <span>Nuevas para inversores: <strong>{num(step.newInvestorShares ?? 0)}</strong></span>
                      {!!step.newPoolShares && <span>Pool: <strong>+{num(step.newPoolShares)}</strong></span>}
                      {step.conversions?.map((c) => (
                        <span key={c.noteId}>Conversión {s.holders.find((h) => h.id === c.holderId)?.name}: <strong>{num(c.shares)}</strong> a {eurPrecise(c.price)}</span>
                      ))}
                    </>
                  )}
                  {step.sold !== undefined && <span>Vendidas: <strong>{num(step.sold)}</strong> · Liquidez: <strong>{eur(step.proceeds ?? 0)}</strong></span>}
                  {step.warnings.map((w) => <span key={w} className="warn">{w}</span>)}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <div className="row wrap-row add-events">
        <button className="btn btn-ghost" onClick={() => addEvent('nota')}>+ Nota convertible</button>
        <button className="btn btn-ghost" onClick={() => addEvent('ronda')}>+ Ronda</button>
        <button className="btn btn-ghost" onClick={() => addEvent('secundaria')}>+ Venta secundaria</button>
      </div>
    </div>
  );
}

function newInvestor(d: Scenario) {
  const id = uid();
  d.holders.splice(Math.max(0, d.holders.length - 1), 0, { id, name: 'Nuevo inversor', role: 'inversor' });
  return id;
}
