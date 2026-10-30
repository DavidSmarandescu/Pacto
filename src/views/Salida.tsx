import { useMemo, useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { capTable, waterfall } from '../engine';
import { eur, eurShort, pct } from '../lib/format';
import { Card, Dot, NumInput, Stat, Toggle } from '../components/ui';
import { axisProps, tooltipProps } from './chart';
import type { ViewProps } from './types';

/** Lo que ha puesto cada socio: rondas, notas y compras en secundaria. */
function invested(s: ViewProps['s']) {
  const out: Record<string, number> = {};
  for (const e of s.events) {
    if (e.type === 'nota') out[e.holderId] = (out[e.holderId] ?? 0) + e.amount;
    if (e.type === 'ronda') for (const i of e.investments) out[i.holderId] = (out[i.holderId] ?? 0) + i.amount;
    if (e.type === 'secundaria') out[e.buyerId] = (out[e.buyerId] ?? 0) + e.sellers.reduce((a, x) => a + x.shares, 0) * e.pricePerShare;
  }
  return out;
}

export default function Salida({ s, res, colors }: ViewProps) {
  const snap = res.final;
  const post = snap.postMoney ?? 10_000_000;
  const [exit, setExit] = useState(Math.round(post * 2 / 100000) * 100000 || 1_000_000);
  const [withPool, setWithPool] = useState(true);
  const max = Math.max(post * 5, exit);
  const w = waterfall(snap, exit, withPool);
  const rows = capTable(snap, s.holders, s.governance).filter((r) => withPool || r.holderId !== 'pool');
  const inv = invested(s);
  const name = (id: string) => s.holders.find((h) => h.id === id)?.name ?? id;
  const ids = rows.map((r) => r.holderId);

  const curve = useMemo(() => {
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const v = (max * i) / 40;
      const r = waterfall(snap, v, withPool);
      const p: Record<string, number> = { v };
      for (const id of ids) p[id] = Math.round(r.byHolder[id] ?? 0);
      pts.push(p);
    }
    return pts;
  }, [snap, max, withPool, ids.join()]);

  const founders = s.holders.filter((h) => h.role === 'fundador').reduce((a, h) => a + (w.byHolder[h.id] ?? 0), 0);
  const convertedNames = w.converted.map((c) => snap.classes[c]?.name ?? c);

  return (
    <div className="stack">
      <Card title="Waterfall de salida" subtitle="Cuánto cobra cada socio si se vende la compañía, aplicando las preferencias de liquidación de cada serie.">
        <div className="exit-input">
          <label className="field-label" htmlFor="exit">Precio de venta de la empresa</label>
          <input id="exit" type="range" min={0} max={max} step={Math.max(10000, Math.round(max / 200 / 10000) * 10000)} value={exit} onChange={(e) => setExit(+e.target.value)} />
          <div className="row wrap-row">
            <NumInput value={exit} suffix="€" step={100000} onChange={setExit} />
            <span className="muted small">{post ? `${(exit / post).toLocaleString('es-ES', { maximumFractionDigits: 2 })}× la última valoración post-money` : ''}</span>
            <Toggle checked={withPool} onChange={setWithPool} label="Pool concedido y ejercido" />
          </div>
        </div>
        <div className="stats">
          <Stat label="Para fundadores" value={eur(founders)} hint={exit ? pct(founders / exit) : ''} tone="accent" />
          <Stat label="Preferencias pagadas" value={eur(w.prefPaid)} hint={exit ? pct(w.prefPaid / exit) : ''} />
          <Stat label="Por participación ordinaria" value={eur(w.perCommonShare)} />
          <Stat label="Series que convierten" value={convertedNames.length ? convertedNames.join(', ') : 'Ninguna'} hint="Prefieren cobrar como ordinarias" />
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Socio</th><th className="num">% económico</th><th className="num">Cobra</th><th className="num">% del total</th><th className="num hide-sm">Invertido</th><th className="num hide-sm">Múltiplo</th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const got = w.byHolder[r.holderId] ?? 0;
                const put = inv[r.holderId];
                return (
                  <tr key={r.holderId}>
                    <td><div className="who"><Dot color={colors[r.holderId]} /><strong>{name(r.holderId)}</strong></div></td>
                    <td className="num">{pct(r.econPct)}</td>
                    <td className="num"><strong>{eur(got)}</strong></td>
                    <td className="num">{exit ? pct(got / exit) : '—'}</td>
                    <td className="num hide-sm muted">{put ? eur(put) : '—'}</td>
                    <td className="num hide-sm">{put ? `${(got / put).toLocaleString('es-ES', { maximumFractionDigits: 1 })}×` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Cobro según el precio de venta" subtitle="Las curvas se tuercen donde cada serie deja de cobrar su preferencia y convierte a ordinarias.">
        <div className="chart">
          <ResponsiveContainer width="100%" height={340}>
            <LineChart data={curve} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="rgba(148,180,255,.1)" />
              <XAxis dataKey="v" type="number" domain={[0, max]} {...axisProps} tickFormatter={eurShort} />
              <YAxis {...axisProps} tickFormatter={eurShort} width={64} />
              <Tooltip {...tooltipProps} labelFormatter={(v: number) => `Venta por ${eur(v)}`} formatter={(v: number, k: string) => [eur(v), name(k)]} />
              <Legend formatter={(k: string) => <span className="legend-item">{name(k)}</span>} />
              <ReferenceLine x={exit} stroke="#5FE3FF" strokeDasharray="4 4" />
              {ids.map((id) => <Line key={id} type="monotone" dataKey={id} stroke={colors[id]} dot={false} strokeWidth={2} isAnimationActive={false} />)}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
