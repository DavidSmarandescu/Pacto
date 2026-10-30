import { useMemo, useState } from 'react';
import {
  BUYER_ID, blocOrdinaryShares, capTable, controlStatus, maxSellable, MAYORIA_ORDINARIA, MAYORIA_REFORZADA,
  nonVotingRatio, MAX_NON_VOTING_SHARE, simulateSale, structureOptions, type Holder, type SaleStructure,
} from '../engine';
import { eur, eurPrecise, num, pct, uid } from '../lib/format';
import { Badge, Card, Dot, Field, NumInput, SplitBar, Stat, Toggle } from '../components/ui';
import type { ViewProps } from './types';

const LIMIT_TEXT = {
  control: 'perderían el umbral',
  legal: 'límite legal sin voto (50 %)',
  todo: 'pueden venderlo todo',
  sinControl: 'ya no tienen el umbral',
};

export default function Control({ s, res, mutate, colors }: ViewProps) {
  const gov = s.governance;
  const snap = res.final;
  const lastPrice = snap.pricePerShare ?? 0;
  const [plural, setPlural] = useState(Math.max(3, gov.votoPlural));
  const [price, setPrice] = useState(Math.round(lastPrice * 0.85) || 100);
  const [structure, setStructure] = useState<SaleStructure>('sinVoto');
  const [buyer, setBuyer] = useState<string>(s.holders.find((h) => h.role === 'inversor')?.id ?? BUYER_ID);

  const available = blocOrdinaryShares(snap, s.holders, gov);
  // Por defecto, una venta que conserva la mayoría ordinaria vendiendo sin voto.
  const [toSell, setToSell] = useState(() => Math.floor(maxSellable(snap, s.holders, gov, 'sinVoto', MAYORIA_ORDINARIA).shares * 0.75));
  const sell = Math.min(toSell, available);

  const buyerHolder: Holder = { id: BUYER_ID, name: 'Comprador', role: 'inversor' };
  const hs = [...s.holders, buyerHolder];
  const before = controlStatus(snap, s.holders, gov);
  const afterSnap = simulateSale(snap, hs, gov, sell, structure);
  const after = controlStatus(afterSnap, hs, gov);
  const nvRatio = nonVotingRatio(afterSnap.holdings);
  const name = (id: string) => (id === BUYER_ID ? 'Comprador' : s.holders.find((h) => h.id === id)?.name ?? id);

  const options = useMemo(() => structureOptions(plural).map((o) => {
    const g = { ...gov, votoPlural: o.votoPlural, sindicacion: o.sindicacion };
    return { ...o, ord: maxSellable(snap, s.holders, g, o.structure, MAYORIA_ORDINARIA), ref: maxSellable(snap, s.holders, g, o.structure, MAYORIA_REFORZADA) };
  }), [plural, gov, snap, s.holders]);

  const beforeRows = capTable(snap, hs, gov);
  const afterRows = capTable(afterSnap, hs, gov);
  const bloc = new Set(before.bloc);
  const blocNames = before.bloc.map(name).join(', ');

  const addAsOperation = () => {
    const per = before.bloc.map((id) => ({ id, ord: beforeRows.find((r) => r.holderId === id)?.byClass.ord ?? 0 }));
    const tot = per.reduce((a, p) => a + p.ord, 0);
    let left = sell;
    const sellers = per.map((p, i) => {
      const n = i === per.length - 1 ? left : Math.round((sell * p.ord) / (tot || 1));
      left -= n;
      return { holderId: p.id, shares: n };
    }).filter((x) => x.shares > 0);
    mutate((d) => {
      let buyerId = buyer;
      if (buyerId === BUYER_ID) {
        buyerId = uid();
        d.holders.splice(d.holders.length - 1, 0, { id: buyerId, name: 'Nuevo inversor (secundaria)', role: 'inversor' });
      }
      d.events.push({
        id: uid(), type: 'secundaria', name: 'Venta secundaria simulada', date: new Date().toISOString().slice(0, 10),
        sellers, buyerId, pricePerShare: price, structure,
      });
    });
  };

  return (
    <div className="stack">
      <Card className="intro" title="Simulador de control" subtitle="Derechos económicos y derechos políticos no tienen por qué ir juntos. Combina estas estructuras para vender sin ceder el mando.">
        <div className="grid-2">
          <div className="controls">
            <Toggle checked={gov.sindicacion} onChange={(v) => mutate((d) => { d.governance.sindicacion = v; })}
              label={<span><strong>Pacto de sindicación de voto</strong><span className="muted small block">Los fundadores votan juntos lo que decidan entre ellos.</span></span>} />
            <Field label="Voto plural en participaciones de fundador (estatutos)" hint="1 = una participación, un voto. Art. 188 LSC permite pactar otra proporción en una SL.">
              <div className="row">
                <input type="range" min={1} max={10} value={gov.votoPlural} onChange={(e) => mutate((d) => { d.governance.votoPlural = +e.target.value; })} />
                <strong className="pill">×{gov.votoPlural}</strong>
              </div>
            </Field>
          </div>
          <div className="stats stats-2">
            <Stat label="Bloque · % económico" value={pct(before.blocEconPct)} hint={blocNames} />
            <Stat label="Bloque · % de voto" value={pct(before.blocVotePct)} tone={before.ordinaria ? 'ok' : 'bad'}
              hint={<span className="badges"><Badge ok={before.ordinaria}>Mayoría ordinaria</Badge><Badge ok={before.reforzada}>Reforzada 2/3</Badge></span>} />
          </div>
        </div>
      </Card>

      <Card title="Simula una venta secundaria" subtitle="Los fundadores del bloque venden participaciones existentes a prorrata. No hay ampliación de capital: entra dinero a sus bolsillos, no a la empresa.">
        <div className="grid-3">
          <Field label={`Participaciones a vender (máx. ${num(available)})`}>
            <input type="range" min={0} max={available} step={1} value={sell} onChange={(e) => setToSell(+e.target.value)} />
            <span className="row"><NumInput value={sell} onChange={(v) => setToSell(Math.round(v))} max={available} suffix="part." />
              <span className="muted small">{available ? pct(sell / available) : '—'} de lo suyo</span></span>
          </Field>
          <Field label="Precio por participación" hint={lastPrice ? `Última ronda: ${eurPrecise(lastPrice)}` : undefined}>
            <NumInput value={price} onChange={setPrice} suffix="€" />
          </Field>
          <Field label="Cómo se venden">
            <div className="seg">
              <button className={structure === 'ordinarias' ? 'on' : ''} onClick={() => setStructure('ordinarias')}>Ordinarias</button>
              <button className={structure === 'sinVoto' ? 'on' : ''} onClick={() => setStructure('sinVoto')}>Sin voto</button>
            </div>
          </Field>
        </div>

        <div className="stats">
          <Stat label="Liquidez para los fundadores" value={eur(sell * price)} tone="accent" />
          <Stat label="% económico del bloque" value={`${pct(before.blocEconPct)} → ${pct(after.blocEconPct)}`} />
          <Stat label="% de voto del bloque" value={`${pct(before.blocVotePct)} → ${pct(after.blocVotePct)}`} tone={after.ordinaria ? 'ok' : 'bad'}
            hint={<span className="badges"><Badge ok={after.ordinaria}>&gt;50 %</Badge><Badge ok={after.reforzada}>≥2/3</Badge></span>} />
        </div>

        {structure === 'sinVoto' && nvRatio > MAX_NON_VOTING_SHARE && (
          <p className="alert">⚠ Las participaciones sin voto serían el {pct(nvRatio)} del capital. En una SL no pueden superar la mitad (art. 98 LSC).</p>
        )}
        {!after.ordinaria && before.ordinaria && (
          <p className="alert">⚠ Con esta venta el bloque fundador pierde la mayoría ordinaria. Prueba a vender sin voto o activar voto plural.</p>
        )}

        <div className="table-wrap">
          <table className="table compact">
            <thead><tr><th>Socio</th><th className="num">Antes eco./voto</th><th className="num">Después eco./voto</th><th className="hide-sm">Después</th></tr></thead>
            <tbody>
              {afterRows.map((r) => {
                const b = beforeRows.find((x) => x.holderId === r.holderId);
                return (
                  <tr key={r.holderId} className={bloc.has(r.holderId) ? 'is-bloc' : ''}>
                    <td><div className="who"><Dot color={colors[r.holderId]} /><strong>{name(r.holderId)}</strong></div></td>
                    <td className="num muted">{b ? `${pct(b.econPct)} / ${pct(b.votePct)}` : '—'}</td>
                    <td className="num">{pct(r.econPct)} / {pct(r.votePct)}</td>
                    <td className="hide-sm"><SplitBar econ={r.econPct} vote={r.votePct} color={colors[r.holderId]} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="row wrap-row">
          <Field label="Comprador al añadir la operación">
            <select value={buyer} onChange={(e) => setBuyer(e.target.value)}>
              {s.holders.filter((h) => h.role === 'inversor').map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
              <option value={BUYER_ID}>Nuevo inversor</option>
            </select>
          </Field>
          <button className="btn btn-primary" disabled={sell <= 0} onClick={addAsOperation}>Añadir como operación</button>
        </div>
      </Card>

      <Card title="¿Cuánto podéis vender sin perder el control?" subtitle={`Máximo de participaciones que el bloque puede vender a ${eurPrecise(price)} manteniendo cada mayoría, según la estructura.`}
        actions={<Field label="Voto plural a comparar"><span className="row"><input type="range" min={2} max={10} value={plural} onChange={(e) => setPlural(+e.target.value)} /><strong className="pill">×{plural}</strong></span></Field>}>
        <div className="options">
          {options.map((o) => (
            <article key={o.id} className="option">
              <h4>{o.name}</h4>
              <p className="muted small">{o.description}</p>
              <dl>
                <div>
                  <dt>Mayoría ordinaria (&gt;50 %)</dt>
                  <dd><strong>{num(o.ord.shares)}</strong> part. · {eur(o.ord.shares * price)}</dd>
                  <dd className="muted tiny">{available ? pct(o.ord.shares / available) : '—'} de lo suyo · {LIMIT_TEXT[o.ord.limitedBy]}</dd>
                </div>
                <div>
                  <dt>Reforzada (≥2/3)</dt>
                  <dd><strong>{num(o.ref.shares)}</strong> part. · {eur(o.ref.shares * price)}</dd>
                  <dd className="muted tiny">{LIMIT_TEXT[o.ref.limitedBy]}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </Card>

      <Card title="Mayorías y vetos" subtitle="Materias que el bloque fundador aprueba solo y las que el resto de socios puede bloquear. Ajusta los umbrales de tus estatutos o pacto de socios.">
        <ul className="vetos">
          {before.vetoes.map((v) => (
            <li key={v.id}>
              <input className="grow" aria-label="Materia" value={v.name} onChange={(e) => mutate((d) => { const m = d.governance.vetoMatters.find((x) => x.id === v.id); if (m) m.name = e.target.value; })} />
              <NumInput value={v.threshold} scale={100} step={1} max={100} suffix="%" onChange={(val) => mutate((d) => { const m = d.governance.vetoMatters.find((x) => x.id === v.id); if (m) m.threshold = Math.min(1, val); })} />
              <Badge ok={v.foundersPass}>{v.foundersPass ? 'Fundadores deciden' : 'Bloqueable por inversores'}</Badge>
              <button className="icon" aria-label="Quitar" onClick={() => mutate((d) => { d.governance.vetoMatters = d.governance.vetoMatters.filter((x) => x.id !== v.id); })}>×</button>
            </li>
          ))}
        </ul>
        <button className="btn btn-ghost" onClick={() => mutate((d) => { d.governance.vetoMatters.push({ id: uid(), name: 'Nueva materia reservada', threshold: 0.75 }); })}>+ Añadir materia</button>
        <p className="muted small note">
          En una SL, los acuerdos ordinarios exigen mayoría de votos válidos; ampliar capital o modificar estatutos, más de la mitad de los votos;
          y transformación, fusión o escisión, al menos dos tercios (arts. 198–199 LSC). Los estatutos y el pacto de socios pueden reforzarlas.
        </p>
      </Card>

      <p className="disclaimer">Herramienta orientativa: no es asesoramiento jurídico. Crear participaciones sin voto o con voto plural exige modificar estatutos con las mayorías legales y, en su caso, el consentimiento de los afectados.</p>
    </div>
  );
}
